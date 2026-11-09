import { getLlm, parseJsonLoose, type ChatMessage } from "@/lib/llm/provider";
import { Extraction } from "./schema";
import type { Tool } from "@/lib/schemas/tool";
import { EXTRACTION_SYSTEM, extractionUser } from "./prompts";

export type SourcePage = { url: string; text: string };

export async function extract(name: string, pages: SourcePage[]): Promise<Extraction> {
  const messages: ChatMessage[] = [
    { role: "system", content: EXTRACTION_SYSTEM },
    { role: "user", content: extractionUser(name, pages) },
  ];
  const { text } = await getLlm().chat(messages, { json: true, maxTokens: 4000, timeoutMs: 90_000 });
  try {
    return Extraction.parse(parseJsonLoose(text));
  } catch (e) {
    // One repair attempt: show the model its error.
    const { text: retry } = await getLlm().chat(
      [
        ...messages,
        { role: "assistant", content: text },
        {
          role: "user",
          content: `That was not valid for the required shape (${(e as Error).message.slice(0, 300)}). Reply again with ONLY the corrected JSON object.`,
        },
      ],
      { json: true, maxTokens: 4000, timeoutMs: 90_000 },
    );
    return Extraction.parse(parseJsonLoose(retry));
  }
}

const normChar = (c: string) =>
  c.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");

/** Text with whitespace removed and characters normalized, plus each kept char's index in the original. */
function compress(text: string): { s: string; idx: number[] } {
  let s = "";
  const idx: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    s += normChar(text[i]);
    idx.push(i);
  }
  return { s, idx };
}

/**
 * Find the quote in the page ignoring whitespace and quote/dash styles, and return the page's own
 * wording for it (properly spaced), or null when the page doesn't contain it.
 */
export function locateQuote(quote: string, text: string): string | null {
  const q = compress(quote).s;
  if (q.length < 3) return null;
  const t = compress(text);
  const at = t.s.indexOf(q);
  if (at < 0) return null;
  return text.slice(t.idx[at], t.idx[at + q.length - 1] + 1).replace(/\s+/g, " ").trim();
}

/** The page containing the quote: the cited page first, then any fetched page. */
export function quoteFound(quote: string, sourceUrl: string, pages: SourcePage[]): string | null {
  return findQuote(quote, sourceUrl, pages)?.url ?? null;
}

function findQuote(quote: string, sourceUrl: string, pages: SourcePage[]): { url: string; span: string } | null {
  const ordered = [...pages.filter((p) => p.url === sourceUrl), ...pages.filter((p) => p.url !== sourceUrl)];
  for (const p of ordered) {
    const span = locateQuote(quote, p.text);
    if (span) return { url: p.url, span };
  }
  return null;
}

const CONTACT_IN_QUOTE = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{8,}\d|\b\d{2,5}\s+\w+.*\b(street|st|avenue|ave|road|rd|suite|blvd|drive|dr|wacker|olive)\b/i;
const SECURITY_IN_QUOTE = /secur|\bsoc ?(1|2|3|ii)\b|iso ?27001|encrypt|complian|\btrust center\b|hipaa|pci|gdpr|penetration|audit/i;

/** Does the quote actually support the value it's attached to? */
export function quoteSupports(key: CitedKey, value: unknown, quote: string): boolean {
  const q = quote.toLowerCase();
  switch (key) {
    case "price_monthly_min":
    case "price_monthly_max": {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 && n <= 5000 && (n === 0 || q.replace(/[,\s]/g, "").includes(String(Math.round(n))));
    }
    case "free_trial_days":
      return /trial|free/.test(q) && q.includes(String(value));
    case "free_plan":
      // "Free plan" must say free and not be a trial or demo; "no free plan" needs no wording check.
      return value === false || (/\bfree\b/.test(q) && !/\b(demo|trial)\b/.test(q));
    case "plan_name":
      return String(value)
        .split(/,|\/| and /)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .every((part) => q.includes(part));
    case "vendor": {
      const word = String(value).toLowerCase().split(/[^a-z0-9.]+/).find((w) => w.length >= 3 && !["the", "inc", "llc", "ltd", "corp", "inc."].includes(w));
      return !!word && q.includes(word);
    }
    case "contact":
      return CONTACT_IN_QUOTE.test(quote);
    case "security":
      return SECURITY_IN_QUOTE.test(quote);
    default:
      return true;
  }
}

type CitedKey = {
  [K in keyof Extraction]: Extraction[K] extends { quote: string } | null ? K : never;
}[keyof Extraction];

export const CITED_KEYS: CitedKey[] = [
  "vendor",
  "free_plan",
  "free_trial_days",
  "price_monthly_min",
  "price_monthly_max",
  "plan_name",
  "integrations",
  "works_standalone",
  "contact",
  "security",
];


/** The value a stored tool holds for each cited field, so it can be offered back for re-checking. */
function storedValue(key: CitedKey, t: Tool): unknown {
  switch (key) {
    case "vendor": return t.vendor;
    case "free_plan": return t.pricing.free_plan;
    case "free_trial_days": return t.pricing.free_trial_days;
    case "price_monthly_min": return t.pricing.est_monthly_usd_min;
    case "price_monthly_max": return t.pricing.est_monthly_usd_max;
    case "plan_name": return t.pricing.plan_name;
    case "integrations": return t.integrations.length ? t.integrations : null;
    case "works_standalone": return t.works_standalone;
    case "contact": return t.evidence.contact?.quote ?? null;
    case "security": return t.vendor_checks.security_docs?.note ?? t.evidence.security?.quote ?? null;
  }
}

/**
 * On a refresh the model sometimes misses a value it found last time. For each field the new
 * extraction left empty but the stored tool has evidence for, put the old value and quote back.
 * validateExtraction then re-checks that quote against the freshly fetched pages, so a value
 * survives only if the vendor's site still says it. Mutates `ex`; returns the fields offered back.
 */
export function carryForward(ex: Extraction, existing: Tool): string[] {
  const offered: string[] = [];
  for (const key of CITED_KEYS) {
    const ev = existing.evidence[key];
    const value = storedValue(key, existing);
    if (ex[key] || !ev || value == null) continue;
    (ex as Record<string, unknown>)[key] = { value, source_url: ev.source_url, quote: ev.quote, claim_type: ev.claim_type };
    offered.push(key);
  }
  return offered;
}

/** Keep only integration names that appear somewhere on the vendor's own fetched pages. */
function groundedIntegrations(names: string[], pages: SourcePage[]): string[] {
  const all = compress(pages.map((p) => p.text).join(" ")).s;
  return names.filter((n) => {
    const c = compress(n).s;
    return c.length >= 2 && all.includes(c);
  });
}

/**
 * Drop any cited value whose quote isn't on the fetched pages or doesn't support the value (a
 * price needs its number, a plan its name, contact an email/phone/address…). Surviving quotes are
 * replaced with the page's exact, properly spaced wording.
 */
export function validateExtraction(ex: Extraction, pages: SourcePage[]): { ex: Extraction; dropped: string[] } {
  const out = structuredClone(ex);
  const dropped: string[] = [];
  if (out.integrations) {
    out.integrations.value = groundedIntegrations(out.integrations.value, pages);
    if (!out.integrations.value.length) out.integrations = null;
  }
  for (const key of CITED_KEYS) {
    const v = out[key];
    if (!v) continue;
    const hit = findQuote(v.quote, v.source_url, pages);
    if (hit && quoteSupports(key, v.value, hit.span)) {
      v.source_url = hit.url;
      v.quote = hit.span;
    } else {
      dropped.push(key);
      (out as Record<string, unknown>)[key] = null;
    }
  }
  const min = out.price_monthly_min?.value;
  const max = out.price_monthly_max?.value;
  if (min != null && max != null && max < min) {
    out.price_monthly_max = null;
    dropped.push("price_monthly_max");
  }
  return { ex: out, dropped };
}
