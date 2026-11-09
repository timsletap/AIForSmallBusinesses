import * as cheerio from "cheerio";
import { fetchWithTimeout } from "@/lib/llm/provider";
import { domainKey, isAggregator, sameSite } from "./canonical";

const UA = "Mozilla/5.0 (compatible; TerpToolBot/1.0; small-business research by the University of Maryland)";
const TIMEOUT_MS = 10_000;
const MAX_TEXT = 12_000;

export type FetchedPage = {
  url: string;
  finalUrl: string;
  status: number;
  https: boolean;
  title: string;
  text: string;
  links: { href: string; text: string }[];
};

const lastHit = new Map<string, number>();
async function politeDelay(url: string) {
  const d = domainKey(url) ?? url;
  const wait = (lastHit.get(d) ?? 0) + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(d, Date.now());
}

type RobotsRule = { allow: boolean; pattern: string };
const robotsCache = new Map<string, RobotsRule[]>();

/** Parse the rules that apply to `*` or our bot from a robots.txt body. */
export function parseRobots(body: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let applies = false;
  let inAgentBlock = false;
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).split("#")[0].trim();
    if (key === "user-agent") {
      // Consecutive user-agent lines share one group.
      const hit = val === "*" || /terptool/i.test(val);
      applies = inAgentBlock ? applies || hit : hit;
      inAgentBlock = true;
      continue;
    }
    inAgentBlock = false;
    if (applies && (key === "disallow" || key === "allow") && val) rules.push({ allow: key === "allow", pattern: val });
  }
  return rules;
}

function ruleMatches(pattern: string, path: string): boolean {
  const re = pattern
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$|\$$/, "$");
  return new RegExp(`^${re}`).test(path);
}

/** Longest matching rule wins; Allow wins ties. No match → allowed. */
export function robotsAllows(rules: RobotsRule[], pathWithQuery: string): boolean {
  let best: RobotsRule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r.pattern, pathWithQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

/** True if robots.txt disallows this URL for us. Unreachable robots.txt → allowed. Cached per host. */
export async function disallowed(url: string): Promise<boolean> {
  const u = new URL(url);
  let rules = robotsCache.get(u.host);
  if (!rules) {
    rules = [];
    try {
      await politeDelay(url);
      const r = await fetchWithTimeout(`${u.protocol}//${u.host}/robots.txt`, { headers: { "User-Agent": UA } }, TIMEOUT_MS);
      if (r.ok) rules = parseRobots(await r.text());
    } catch {
      // No robots.txt rules.
    }
    robotsCache.set(u.host, rules);
  }
  return !robotsAllows(rules, u.pathname + u.search);
}

async function fetchOnce(url: string): Promise<Response> {
  await politeDelay(url);
  return fetchWithTimeout(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" }, TIMEOUT_MS);
}

export async function fetchPage(url: string): Promise<FetchedPage | null> {
  if (await disallowed(url)) return null;
  let res: Response;
  try {
    res = await fetchOnce(url);
  } catch {
    try {
      res = await fetchOnce(url);
    } catch {
      return null;
    }
  }
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  const html = await res.text();
  const $ = cheerio.load(html);
  const finalUrl = res.url || url;
  const links: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    try {
      const href = new URL($(el).attr("href") ?? "", finalUrl).toString();
      links.push({ href, text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 80) });
    } catch {
      // Bad href.
    }
  });
  const title = $("title").first().text().trim();
  return { url, finalUrl, status: res.status, https: finalUrl.startsWith("https://"), title, text: htmlToText($).slice(0, MAX_TEXT), links };
}

/**
 * Visible body text with a space between elements, so "<h3>Starter</h3><p>$79 a month</p>" reads
 * "Starter $79 a month" rather than "Starter$79 a month".
 */
export function htmlToText(input: string | cheerio.CheerioAPI): string {
  const $ = typeof input === "string" ? cheerio.load(input) : input;
  $("script, style, noscript, svg, iframe, template").remove();
  $("br").replaceWith(" ");
  $("body *").after(" ");
  return $("body").text().replace(/\s+/g, " ").trim();
}

export type PageKind = "pricing" | "integrations" | "privacy" | "terms" | "security" | "contact";

const KIND_PATTERNS: Record<PageKind, RegExp> = {
  pricing: /pricing|plans\b|price/i,
  integrations: /integrations?|marketplace/i,
  privacy: /privacy/i,
  terms: /terms|\btos\b|conditions|legal/i,
  security: /security|trust|soc-?2|compliance/i,
  contact: /contact|about/i,
};

/** Policies are often hosted by a parent company (Mailchimp → intuit.com), so these may be off-site. */
const OFFSITE_OK: PageKind[] = ["privacy", "terms"];

/** Links on the official site that look like pricing/integrations/privacy/terms/security/contact pages. */
export function findKeyLinks(page: FetchedPage): Partial<Record<PageKind, string>> {
  const out: Partial<Record<PageKind, string>> = {};
  for (const kind of Object.keys(KIND_PATTERNS) as PageKind[]) {
    const matches = page.links.filter((l) => {
      if (!/^https?:/.test(l.href)) return false;
      const path = new URL(l.href).pathname;
      return KIND_PATTERNS[kind].test(path) || KIND_PATTERNS[kind].test(l.text);
    });
    const hit =
      (kind === "contact" ? matches.find((l) => sameSite(l.href, page.finalUrl) && /contact/i.test(new URL(l.href).pathname + " " + l.text)) : undefined) ??
      matches.find((l) => sameSite(l.href, page.finalUrl)) ??
      (OFFSITE_OK.includes(kind)
        ? matches.find((l) => l.href.startsWith("https://") && !isAggregator(l.href) && KIND_PATTERNS[kind].test(l.text))
        : undefined);
    if (hit) out[kind] = hit.href.split("#")[0];
  }
  return out;
}
