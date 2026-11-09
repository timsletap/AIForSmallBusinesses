import Link from "next/link";
import { getStore } from "@/lib/storage/db";
import { WEIGHTS, FACTOR_LABELS, type FactorId } from "@/lib/ranking/score";
import { CHECK_LABELS } from "@/lib/verification/vendorChecks";
import { CHECK_IDS } from "@/lib/schemas/tool";
import { domainKey } from "@/lib/discovery/canonical";
import { Expand } from "@/components/Expand";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "About & how we verify | AI Tool Matchmaker",
  description: "How we discover AI tools, prove every fact against the vendor's own website, check vendors, and score fit.",
};

const DISCOVERY_STEPS = [
  ["Search", "A live web search looks for AI products. Directory and review sites are thrown out."],
  ["Trace", "Each product is traced to the company's own official website. Vendors can't pay to be listed."],
  ["Read", "We read the homepage plus pricing, integrations, security and privacy pages, respecting robots.txt."],
  ["Refresh", "Daily: the oldest listings are re-checked against live sites, and a new area is searched for new tools."],
];

const PROOF_RULES = [
  "Every fact must come with the page it came from and an exact quote. No quote, no fact.",
  "Code, not AI, confirms each quote appears word-for-word on the vendor's page.",
  "The quote must back up the value: the price is in it, the plan name matches, a free trial is never called a free plan.",
  "Anything that can't be proven is removed and shown to owners as a plain-English warning.",
];

const CHECK_HOW: Record<string, string> = {
  official_site: "Secure HTTPS site whose domain matches the product",
  vendor_identity: "Company name plus an email, phone or address",
  privacy_policy: "Privacy policy linked from their site",
  terms: "Terms of service linked from their site",
  security_docs: "Security page, trust center or certification",
  public_pricing: "Price or free plan published on their site",
};

const FACTOR_COLORS: Record<FactorId, string> = {
  use_case: "#e21833",
  works_with: "#ffd200",
  trust: "#ffffff",
  affordability: "#ff7a8a",
  ease: "#ffe680",
  reviews: "#8a8a92",
};

const FACTOR_HOW: Record<FactorId, string> = {
  use_case: "Built for your exact problem, or just also helps?",
  works_with: "Connects to what you already use, even a phone line",
  trust: "Vendor checks passed, plus a bonus for a hand check",
  affordability: "Full marks within budget, zero at double it",
  ease: "Set it up yourself, or need help?",
  reviews: "Kept small: reviews are easy to game",
};

export default async function AboutPage() {
  const all = await getStore().listTools();
  const live = all.filter((t) => t.status === "published");
  const passed = all.filter((t) => t.trust_level === "verified" || t.trust_level === "checks_passed").length;
  const example =
    live.find((t) => t.slug === "goodcall" && t.evidence.price_monthly_min) ??
    live.find((t) => t.evidence.price_monthly_min && t.evidence.security);
  const pct = (n: number) => Math.round((n / Math.max(all.length, 1)) * 100);

  return (
    <div className="space-y-16">
      <header className="space-y-5 max-w-3xl">
        <p className="inline-flex items-center gap-2.5 rounded-full border border-gold/40 bg-gold/10 pl-1.5 pr-3 py-1 text-sm font-bold text-gold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/umd-terrapins-m.svg" alt="" width={18} height={20} className="h-5 w-auto" />
          About · A University of Maryland project
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.02]">
          Every fact has a receipt. <span className="text-gradient">Every vendor is checked.</span>
        </h1>
        <p className="text-lg text-muted">
          An &ldquo;Angie&apos;s List&rdquo; for AI tools, except we find the tools ourselves, prove what they claim,
          and rate them on how well they fit <em>your</em> business, not just on reviews.
        </p>
      </header>

      <section aria-label="At a glance" className="grid grid-cols-3 border-y border-line">
        {[
          [String(all.length), "products investigated"],
          [String(passed), "passed vendor checks"],
          [String(live.length), "approved and live"],
        ].map(([n, l], i) => (
          <div key={l} className={`py-5 px-3 sm:px-5 ${i ? "border-l border-line" : ""}`}>
            <p className="font-display text-3xl sm:text-5xl font-extrabold">{n}</p>
            <p className="text-sm text-muted">{l}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="how-h" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="how-h" className="font-display text-2xl sm:text-3xl font-extrabold">
            How it works, in four parts
          </h2>
          <p className="text-sm text-muted">Tap ⊕ to see the details</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 items-start">
          <Expand icon="🔎" title="Discovered, not submitted" summary="We search the open web and trace every product to its official site." accent="#e21833">
            <ol className="space-y-3">
              {DISCOVERY_STEPS.map(([h, p], i) => (
                <li key={h} className="flex gap-3">
                  <span className="font-display font-extrabold text-gold w-6">0{i + 1}</span>
                  <span>
                    <span className="font-bold">{h}.</span> <span className="text-muted">{p}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/discover" className="mt-4 inline-flex min-h-11 items-center font-bold text-gold underline underline-offset-4">
              Watch it run live →
            </Link>
          </Expand>

          <Expand icon="🧾" title="Proven word-for-word" summary="Every price and claim is tied to an exact quote on the vendor's own page." accent="#ffd200">
            <ul className="space-y-2">
              {PROOF_RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-gold">✓</span>
                  <span className="text-muted">{r}</span>
                </li>
              ))}
            </ul>
          </Expand>

          <Expand icon="🛡️" title="Six vendor checks + track record" summary="We check the company, not just the product, and hold back brand-new websites." accent="#ffffff">
            <ul className="grid gap-2 sm:grid-cols-2">
              {CHECK_IDS.map((id, i) => (
                <li key={id} className="flex gap-3 rounded-xl bg-surface-2 p-3">
                  <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-gold text-black font-display font-extrabold text-sm">{i + 1}</span>
                  <span>
                    <span className="font-bold block">{CHECK_LABELS[id]}</span>
                    <span className="text-sm text-muted">{CHECK_HOW[id]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-muted">
              <span className="font-bold text-white">Track record:</span> we look up when the website was registered in the
              public domain registry. Sites under two years old wait for a human review.
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                [all.length, "investigated", 100, "rgba(226,24,51,.25)"],
                [passed, "passed 5+ checks", pct(passed), "rgba(255,255,255,.12)"],
                [live.length, "approved", pct(live.length), "rgba(255,210,0,.28)"],
              ].map(([n, l, w, c]) => (
                <div key={String(l)} className="relative rounded-lg bg-surface-2 overflow-hidden">
                  <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${w}%`, background: String(c) }} />
                  <p className="relative px-3 py-1.5 text-sm">
                    <span className="font-bold tabular-nums">{n}</span> <span className="text-muted">{l}</span>
                  </p>
                </div>
              ))}
            </div>
          </Expand>

          <Expand icon="🎯" title="Rated beyond reviews: the Fit Score" summary="0–100 for your business, from six weighted factors. Fixed rules, no paid ranking." accent="#ff7a8a">
            <div className="flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label="Fit Score weights">
              {(Object.keys(WEIGHTS) as FactorId[]).map((f) => (
                <div key={f} style={{ width: `${WEIGHTS[f]}%`, background: FACTOR_COLORS[f] }} />
              ))}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {(Object.keys(WEIGHTS) as FactorId[]).map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FACTOR_COLORS[f] }} />
                  <span>
                    <span className="font-bold">
                      {FACTOR_LABELS[f]} · {WEIGHTS[f]}%
                    </span>
                    <span className="block text-sm text-muted">{FACTOR_HOW[f]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              Same answers, same score, every time. Vendors that fail most checks are never recommended.
            </p>
          </Expand>
        </div>
      </section>

      {example && (
        <section aria-labelledby="receipt-h" className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="space-y-3">
            <h2 id="receipt-h" className="font-display text-2xl sm:text-3xl font-extrabold">
              A real receipt
            </h2>
            <p className="text-muted">
              From {example.name}&apos;s live listing: each fact is tied to the vendor&apos;s exact words, with a link so you
              can check it yourself.
            </p>
            <Link href={`/tools/${example.slug}`} className="inline-flex min-h-11 items-center font-bold text-gold underline underline-offset-4">
              Open the listing →
            </Link>
          </div>
          <div className="glass rounded-3xl p-5 glow-ring font-mono text-sm space-y-3">
            {(["price_monthly_min", "security"] as const)
              .filter((k) => example.evidence[k])
              .map((k) => (
                <div key={k} className="rounded-xl bg-black/50 border border-line p-3">
                  <p className="text-gold">{k === "price_monthly_min" ? "starting_price" : "security"}</p>
                  <p className="text-white mt-1">“{example.evidence[k]!.quote}”</p>
                  <p className="text-muted mt-1 break-all">
                    {domainKey(example.evidence[k]!.source_url)}
                    {new URL(example.evidence[k]!.source_url).pathname} <span className="text-gold">✓ word-for-word</span>
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      <section aria-labelledby="about-h" className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10 space-y-5">
        <div aria-hidden className="md-flag-stripe absolute top-0 left-0 right-0 h-1.5" />
        <div className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/umd-wordmark-white.svg" alt="University of Maryland" width={240} height={48} className="h-10 w-auto" />
          <h2 id="about-h" className="font-display text-2xl sm:text-3xl font-extrabold">
            About us
          </h2>
        </div>
        <p className="text-lg max-w-3xl">
          Built at the University of Maryland by <strong>Smit Patel</strong> and <strong>Daniel Petrov</strong> to give
          Main Street businesses the same confidence with AI that big companies get from an IT department.
        </p>
        <Expand icon="🤝" title="Our promises" summary="No paid placement. No stored answers. Honest when a tool isn't a fit." accent="#ffd200">
          <ul className="space-y-2 text-muted">
            <li>We don&apos;t take money from vendors or sell placement. Rankings come only from the Fit Score.</li>
            <li>We don&apos;t store your answers; they live in your page&apos;s link and nowhere else.</li>
            <li>When information is missing, we say so instead of guessing.</li>
            <li>We point you to free help from SBA advisors and SCORE mentors near you.</li>
          </ul>
        </Expand>
        <div className="flex flex-wrap gap-3">
          <Link href="/advisor" className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-bold text-white hover:bg-brand-hover">
            Find my match
          </Link>
          <Link href="/discover" className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-5 font-bold hover:border-gold hover:text-gold">
            Watch discovery live
          </Link>
        </div>
      </section>
    </div>
  );
}
