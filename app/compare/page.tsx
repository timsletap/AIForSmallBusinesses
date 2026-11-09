import Link from "next/link";
import { profileFromParams, profileToParams } from "@/lib/schemas/profile";
import { isRecommendable } from "@/lib/ranking/constraints";
import { monthlyPrice, scoreTool } from "@/lib/ranking/score";
import { getStore } from "@/lib/storage/db";
import { idsFromParams } from "@/lib/http/params";
import { industryById } from "@/lib/taxonomy/industries";
import { toolLabel } from "@/lib/taxonomy/tools";
import { CHECK_IDS, type Tool } from "@/lib/schemas/tool";
import { Button, EmptyState, ENGAGEMENT, SETUP_LABEL, TrustBadge, priceText } from "@/components/ui";
import { FitMeter } from "@/components/FitMeter";
import { ToolLogo } from "@/components/ToolLogo";
import { PageHeader } from "@/components/PageHeader";
import { FactorChart, PaybackChart, PriceChart, SERIES, type ChartTool } from "@/components/CompareCharts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare tools | TerpTool" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const checksPassed = (t: Tool) => CHECK_IDS.filter((c) => t.vendor_checks[c]?.pass).length;
const EASE: Record<string, number> = { low: 3, medium: 2, high: 1 };

export default async function ComparePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const profile = profileFromParams(sp);
  const ids = idsFromParams(sp);
  const all = await getStore().listTools({ status: "published" });
  const tools = ids.map((id) => all.find((t) => t.slug === id)).filter((t): t is Tool => !!t && isRecommendable(t));
  const query = profile ? profileToParams(profile).toString() : "";
  const back = profile ? `/results?${query}` : "/tools";

  if (tools.length < 2) {
    return (
      <EmptyState title="Pick 2 or 3 tools to compare.">
        <p className="mb-4">Select tools from your matches, then choose Compare.</p>
        <Button href={back}>Go back</Button>
      </EmptyState>
    );
  }

  const scored = tools.map((t) => (profile ? scoreTool(t, profile) : null));
  const prices = tools.map(monthlyPrice);
  const known = prices.filter((p): p is number => p !== null);

  // Winner per dimension (ties share the badge).
  const badges = tools.map(() => [] as string[]);
  const award = (label: string, values: (number | null)[], best: "max" | "min") => {
    const vs = values.filter((v): v is number => v !== null);
    if (vs.length < 2 || new Set(vs).size === 1) return;
    const target = best === "max" ? Math.max(...vs) : Math.min(...vs);
    values.forEach((v, i) => v === target && badges[i].push(label));
  };
  award("Best fit", scored.map((s) => s?.fit ?? null), "max");
  award("Lowest price", prices, "min");
  award("Most vendor checks", tools.map(checksPassed), "max");
  award("Easiest setup", tools.map((t) => (t.setup_complexity ? EASE[t.setup_complexity] : null)), "max");

  const chartTools: ChartTool[] = tools.map((t, i) => ({
    name: t.name,
    min: t.pricing.est_monthly_usd_min,
    max: t.pricing.est_monthly_usd_max,
    freePlan: !!t.pricing.free_plan,
    plan: t.pricing.plan_name,
    factors: scored[i]?.factors ?? null,
  }));
  const industry = industryById(profile?.industry ?? "other")!;
  const mine = new Set(profile?.current_tools ?? []);
  const cols = tools.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: "Price", cells: tools.map((t) => <strong key={t.id}>{priceText(t)}</strong>) },
    {
      label: "Free trial",
      cells: tools.map((t) => <span key={t.id}>{t.pricing.free_trial_days ? `${t.pricing.free_trial_days} days` : t.pricing.free_plan ? "Free plan" : "–"}</span>),
    },
    {
      label: "Works with",
      cells: tools.map((t) =>
        t.integrations.length ? (
          <span key={t.id} className="flex flex-wrap gap-1">
            {t.integrations.map((i) => (
              <span key={i} className={`rounded-md px-1.5 py-0.5 text-xs border ${mine.has(i) ? "border-gold text-gold" : "border-line text-muted"}`}>
                {mine.has(i) && "✓ "}
                {toolLabel(i)}
              </span>
            ))}
          </span>
        ) : (
          <span key={t.id} className="text-muted">Not listed</span>
        ),
      ),
    },
    { label: "Setup", cells: tools.map((t) => <span key={t.id}>{t.setup_complexity ? SETUP_LABEL[t.setup_complexity] : "Not listed"}</span>) },
    {
      label: "Vendor checks",
      cells: tools.map((t) => (
        <span key={t.id} className="flex items-center gap-2">
          <span className="flex gap-0.5" aria-hidden>
            {CHECK_IDS.map((c) => (
              <span key={c} className={`h-2 w-3.5 rounded-sm ${t.vendor_checks[c]?.pass ? "bg-gold" : "bg-line-strong"}`} />
            ))}
          </span>
          <span className="text-sm tabular-nums">{checksPassed(t)}/6</span>
        </span>
      )),
    },
    { label: "Get started", cells: tools.map((t) => <span key={t.id}>{t.engagement ? ENGAGEMENT[t.engagement] : "Visit their site"}</span>) },
  ];

  return (
    <div className="space-y-10">
      <Link href={back} className="text-sm text-muted hover:text-white">
        ← Back
      </Link>
      <PageHeader
        eyebrow="Compare"
        title="Head to head"
        sub={
          <>
            {tools.map((t) => t.name).join(" vs ")}
            {profile && <> · scored for your {industry.label.toLowerCase()}</>}
          </>
        }
      >
        {profile && <Button href={`/plan?${query}&ids=${tools.map((t) => t.slug).join(",")}`}>Build my plan</Button>}
      </PageHeader>

      {/* Contenders */}
      <section className={`grid gap-4 ${cols}`} aria-label="Tools compared">
        {tools.map((t, i) => (
          <article key={t.id} className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: SERIES[i] }} />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ToolLogo name={t.name} url={t.canonical_url} size={48} />
                <div className="min-w-0">
                  <Link href={`/tools/${t.slug}?${query}`} className="font-display text-xl font-semibold hover:text-gold">
                    {t.name}
                  </Link>
                  <p className="text-sm text-muted truncate">{t.vendor ?? new URL(t.canonical_url).hostname}</p>
                </div>
              </div>
              {scored[i] && <FitMeter score={scored[i]!.fit} factors={scored[i]!.factors} reasons={scored[i]!.reasons} size={88} />}
            </div>
            <p className="text-sm text-muted min-h-[2.5rem]">{t.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <TrustBadge level={t.trust_level} />
              {badges[i].map((b) => (
                <span key={b} className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-black">
                  {b}
                </span>
              ))}
            </div>
            <div className="flex items-end justify-between border-t border-line pt-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">From</p>
                <p className="font-display text-2xl font-semibold">
                  {prices[i] === null ? "Ask" : prices[i] === 0 ? "Free" : `$${prices[i]}`}
                  {prices[i] ? <span className="text-sm font-bold text-muted">/mo</span> : null}
                </p>
              </div>
              <Button href={t.canonical_url} external>
                {t.engagement ? ENGAGEMENT[t.engagement] : "Visit site"}
              </Button>
            </div>
          </article>
        ))}
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Charts">
        <PriceChart tools={chartTools} budget={profile?.budget_usd ?? null} />
        {profile ? <FactorChart tools={chartTools} /> : <PaybackChart tools={chartTools} typicalSale={industry.typicalSale} saleWord={industry.saleWord} />}
        {profile && (
          <div className="lg:col-span-2">
            <PaybackChart tools={chartTools} typicalSale={industry.typicalSale} saleWord={industry.saleWord} />
          </div>
        )}
      </section>

      {/* Head-to-head table */}
      <section aria-labelledby="facts-h" className="space-y-3">
        <h2 id="facts-h" className="font-display text-2xl font-semibold">
          The facts, side by side
        </h2>
        <div className="overflow-hidden rounded-2xl border border-line">
          {rows.map((r, ri) => (
            <div key={r.label} className={`grid gap-3 p-4 sm:grid-cols-[10rem_repeat(var(--n),minmax(0,1fr))] ${ri % 2 ? "bg-surface" : "bg-background"}`} style={{ ["--n" as string]: tools.length }}>
              <p className="font-bold text-muted">{r.label}</p>
              {r.cells.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-sm sm:hidden" style={{ background: SERIES[i] }} />
                  <span className="sm:hidden text-sm text-muted w-24 shrink-0">{tools[i].name}</span>
                  <div className="min-w-0">{c}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        {known.length < tools.length && <p className="text-sm text-muted">“Ask” means the vendor doesn&apos;t publish a price on their site.</p>}
      </section>
    </div>
  );
}
