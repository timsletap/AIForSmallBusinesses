import Link from "next/link";
import { ProblemBox } from "@/components/ProblemBox";
import { HeroGlass, type FeaturedTool } from "@/components/HeroGlass";
import { ToolLogo } from "@/components/ToolLogo";
import { Icon } from "@/components/Icon";
import { priceText } from "@/components/ui";
import { getStore } from "@/lib/storage/db";
import { isRecommendable } from "@/lib/ranking/constraints";
import { domainKey } from "@/lib/discovery/canonical";
import { USE_CASES } from "@/lib/taxonomy/useCases";
import { CHECK_IDS, type Tool } from "@/lib/schemas/tool";

export const dynamic = "force-dynamic";

const passed = (t: Tool) => CHECK_IDS.filter((c) => t.vendor_checks[c]?.pass).length;

export default async function Home() {
  const all = await getStore().listTools();
  const live = all.filter(isRecommendable);
  // Hero: a real listing with a verified price quote and full checks.
  const pick =
    live.find((t) => t.slug === "goodcall" && t.evidence.price_monthly_min) ??
    [...live].sort((a, b) => passed(b) - passed(a)).find((t) => t.evidence.price_monthly_min) ??
    live[0];
  const featured: FeaturedTool | null = pick
    ? {
        name: pick.name,
        url: pick.canonical_url,
        description: pick.description,
        price: priceText(pick),
        checks: passed(pick),
        quote: pick.evidence.price_monthly_min?.quote ?? null,
        quoteSource: pick.evidence.price_monthly_min ? domainKey(pick.evidence.price_monthly_min.source_url) : null,
        useCase: USE_CASES.find((u) => u.id === pick.use_cases[0])?.label ?? "",
      }
    : null;
  const byUseCase = (id: string) => live.filter((t) => t.use_cases.includes(id as Tool["use_cases"][number])).length;

  return (
    <div className="space-y-20">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center pt-2 sm:pt-8">
        <div className="space-y-7">
          <p className="flex items-center gap-2.5 text-sm font-bold text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/umd-terrapins-m.svg" alt="" width={16} height={18} className="h-[18px] w-auto" />
            <span className="text-white">University of Maryland</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-line-strong" />
            AI directory for Main Street businesses
          </p>
          <h1 className="font-display text-[2.6rem] sm:text-6xl font-extrabold leading-[1.02] tracking-tight">
            Find AI tools that actually fit your business<span className="text-gold">.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted max-w-xl">
            {live.length} vetted AI products for restaurants, salons, trades and shops, each with its real price, six vendor
            checks, and a score for how well it fits <em className="text-white not-italic">your</em> business.
          </p>
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <ProblemBox />
          </div>
          <p className="text-sm text-muted">
            Not sure where to start?{" "}
            <Link href="/tools" className="text-white underline underline-offset-4 hover:text-gold">
              Browse the full directory
            </Link>
          </p>
        </div>
        <div className="hidden sm:block">{featured && <HeroGlass tool={featured} />}</div>
      </section>

      {/* Real vendors in the directory */}
      <section aria-labelledby="dir-h" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <h2 id="dir-h" className="text-sm font-bold uppercase tracking-[0.18em] text-muted">
            In the directory now
          </h2>
          <p className="text-sm text-muted">
            <span className="text-white font-bold">{live.length}</span> approved of <span className="text-white font-bold">{all.length}</span> investigated ·
            re-checked daily
          </p>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {live.slice(0, 20).map((t) => (
            <li key={t.id}>
              <Link
                href={`/tools/${t.slug}`}
                className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-line hover:bg-surface transition"
              >
                <ToolLogo name={t.name} url={t.canonical_url} size={32} />
                <span className="truncate font-bold text-[0.95rem]">{t.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="problems" aria-labelledby="problems-h" className="space-y-5 scroll-mt-20">
        <h2 id="problems-h" className="font-display text-2xl sm:text-3xl font-extrabold">
          Start from the problem
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <li key={u.id} className="bg-background">
              <Link href={`/advisor?uc=${u.id}`} className="group flex h-full items-start gap-4 p-5 transition hover:bg-surface">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-gold group-hover:border-gold">
                  <Icon name={u.id} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{u.label}</span>
                  <span className="mt-1 block text-sm text-muted">{byUseCase(u.id)} vetted tools</span>
                </span>
                <Icon name="arrow" size={18} className="mt-1 text-muted transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="why-h" className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-3">
          <h2 id="why-h" className="font-display text-2xl sm:text-3xl font-extrabold">
            Built for trust, not clicks
          </h2>
          <Link href="/about" className="inline-flex items-center gap-1.5 text-sm font-bold text-gold hover:underline">
            How we verify every tool <Icon name="arrow" size={16} />
          </Link>
        </div>
        <ul className="grid gap-6 sm:grid-cols-3">
          {[
            ["receipt", "Prices with receipts", "Every price links to the exact words on the vendor's own site. If it isn't listed, we say so."],
            ["shield", "Vendors checked", "Six safety checks plus a track-record check on every company before it's listed."],
            ["gauge", "Scored for your business", "A Fit Score from your budget, your current tools and how much setup you want. No paid ranking."],
          ].map(([icon, h, p]) => (
            <li key={h} className="space-y-2">
              <Icon name={icon} className="text-gold" />
              <h3 className="font-bold">{h}</h3>
              <p className="text-sm text-muted">{p}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
