/**
 * Audit the live database: are vendor sites and cited source links real and working, how old is
 * each vendor's domain, and does every tool page on the site load?
 * Usage: npx tsx scripts/audit.ts [baseUrl]   (default: production; needs ADMIN_PASSWORD in .env.local)
 * Writes logs/audit.json and prints a summary.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { promises as fs } from "fs";
import type { Tool } from "@/lib/schemas/tool";
import { domainKey } from "@/lib/discovery/canonical";

const BASE = process.argv[2] ?? "https://ai-tool-matchmaker-eight.vercel.app";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const PARKED = /domain (is )?for sale|buy this domain|this domain may be for sale|parked (free|domain)|domain has expired|sedo|hugedomains|dan\.com/i;

type LinkResult = { url: string; status: number | "error"; finalUrl?: string; problem?: string };

async function checkLink(url: string): Promise<LinkResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: ctrl.signal });
      clearTimeout(t);
      const body = (await res.text()).slice(0, 20_000);
      const r: LinkResult = { url, status: res.status, finalUrl: res.url };
      const from = domainKey(url);
      const to = domainKey(res.url);
      if (res.status === 404 || res.status === 410) r.problem = "page not found";
      else if (res.status >= 500) r.problem = `server error ${res.status}`;
      else if (res.status === 403 || res.status === 429) r.problem = undefined; // bot protection, not broken
      else if (res.status >= 400) r.problem = `HTTP ${res.status}`;
      else if (PARKED.test(body)) r.problem = "parked / for-sale domain";
      else if (from && to && from !== to && !to.endsWith(`.${from}`) && !from.endsWith(`.${to}`)) r.problem = `redirects to another site (${to})`;
      return r;
    } catch (e) {
      if (attempt === 1) return { url, status: "error", problem: `did not load (${(e as Error).name})` };
    }
  }
  return { url, status: "error", problem: "did not load" };
}

/** Domain registration date from RDAP (public registry data). */
async function domainCreated(domain: string): Promise<string | null> {
  const root = domain.split(".").slice(-2).join(".");
  try {
    const res = await fetch(`https://rdap.org/domain/${root}`, { headers: { Accept: "application/rdap+json", "User-Agent": "curl/8.9.1" }, redirect: "follow" });
    if (!res.ok) return null;
    const j = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
    return j.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
  } catch {
    return null;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

async function main() {
  const pw = process.env.ADMIN_PASSWORD;
  const res = await fetch(`${BASE}/api/admin/discover`, { headers: { "x-admin-password": pw ?? "" } });
  if (!res.ok) throw new Error(`Could not load tools from ${BASE} (${res.status})`);
  const tools = ((await res.json()) as { tools: Tool[] }).tools.filter((t) => t.status === "published");
  console.log(`Auditing ${tools.length} published tools on ${BASE}\n`);

  const report = await pool(tools, 6, async (t) => {
    const urls = [
      ...new Set(
        [t.canonical_url, t.pricing.pricing_url, ...Object.values(t.evidence).map((e) => e.source_url), ...Object.values(t.vendor_checks).map((c) => c.source_url)]
          .filter((u): u is string => !!u && /^https?:/.test(u)),
      ),
    ];
    const links = await pool(urls, 3, checkLink);
    const created = await domainCreated(domainKey(t.canonical_url) ?? "");
    const ageDays = created ? Math.floor((Date.now() - Date.parse(created)) / 86_400_000) : null;
    const page = await checkLink(`${BASE}/tools/${t.slug}`);
    const home = links.find((l) => l.url === t.canonical_url)!;
    const problems = [
      ...(home.problem ? [`homepage: ${home.problem}`] : []),
      ...links.filter((l) => l !== home && l.problem).map((l) => `source ${l.url}: ${l.problem}`),
      ...(page.status !== 200 ? [`tool page on our site: HTTP ${page.status}`] : []),
    ];
    return { slug: t.slug, name: t.name, id: t.id, url: t.canonical_url, created, ageDays, homeStatus: home.status, problems, links };
  });

  await fs.mkdir("logs", { recursive: true });
  await fs.writeFile("logs/audit.json", JSON.stringify(report, null, 2));
  for (const r of report.sort((a, b) => (a.ageDays ?? 99999) - (b.ageDays ?? 99999))) {
    const age = r.ageDays === null ? "age ?" : r.ageDays < 365 ? `NEW ${r.ageDays}d` : `${Math.floor(r.ageDays / 365)}y`;
    console.log(`${r.problems.length ? "✗" : "✓"} ${r.name.padEnd(24)} ${age.padEnd(9)} ${String(r.homeStatus).padEnd(5)} ${r.url}`);
    for (const p of r.problems) console.log(`     - ${p}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
