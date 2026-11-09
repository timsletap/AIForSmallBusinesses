import Link from "next/link";
import { profileFromParams, profileToParams } from "@/lib/schemas/profile";
import { recommend, scoreTool, type Scored } from "@/lib/ranking/score";
import { isRecommendable } from "@/lib/ranking/constraints";
import { getStore } from "@/lib/storage/db";
import { idsFromParams } from "@/lib/http/params";
import { Button, Card, EmptyState, ENGAGEMENT, SETUP_LABEL, SourceLink, TrustBadge, Warnings, priceText } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { AlreadyInYourTools } from "@/components/AlreadyInYourTools";
import { builtInMatches } from "@/lib/builtins/match";
import { loadBuiltIns } from "@/lib/builtins/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your adoption plan | AI Tool Matchmaker" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PlanPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const profile = profileFromParams(sp);
  if (!profile) {
    return (
      <EmptyState title="We need a few answers to build your plan.">
        <div className="mt-4">
          <Button href="/advisor">Start</Button>
        </div>
      </EmptyState>
    );
  }
  const tools = (await getStore().listTools({ status: "published" })).filter(isRecommendable);
  const ids = idsFromParams(sp);

  let chosen: Scored[];
  if (ids.length) {
    chosen = ids
      .map((id) => tools.find((t) => t.slug === id))
      .filter((t) => !!t)
      .map((t) => scoreTool(t, profile))
      .filter((s): s is Scored => !!s);
  } else {
    const r = recommend(tools, profile);
    const best = [...new Set(Object.values(r.best_by_use_case))];
    chosen = best.length ? r.ranked.filter((s) => best.includes(s.tool.id)) : r.ranked.slice(0, 1);
  }
  const query = profileToParams(profile).toString();

  if (!chosen.length) {
    return (
      <EmptyState title="No tools picked yet.">
        <p className="mb-4">Go back to your matches and pick one or more tools.</p>
        <Button href={`/results?${query}`}>Back to my matches</Button>
      </EmptyState>
    );
  }

  const known = chosen.filter((s) => s.price !== null);
  const total = known.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const unknownPrice = chosen.filter((s) => s.price === null);
  const underBudget = total <= profile.budget_usd;
  const needs = [...new Set(chosen.flatMap((s) => s.tool.integration_requirements))];
  const already = builtInMatches(await loadBuiltIns(), profile);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-strong">Your plan to get started</h1>
          <p className="text-muted">
            {chosen.length === 1 ? "1 tool" : `${chosen.length} tools`} · made {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        </div>
        <PrintButton />
      </header>

      <AlreadyInYourTools matches={already} />

      <Card className="space-y-2">
        <h2 className="text-xl font-bold">What it costs each month</h2>
        <ul className="space-y-1">
          {chosen.map((s) => (
            <li key={s.tool.id} className="flex justify-between gap-3">
              <span>{s.tool.name}</span>
              <span className="font-bold tabular-nums text-right">
                {s.price === null ? "Ask vendor" : s.price === 0 ? "Free" : `$${s.price}`}
                {s.price === 0 && s.tool.pricing.est_monthly_usd_min ? (
                  <span className="block text-sm font-normal text-muted">paid plans from ${s.tool.pricing.est_monthly_usd_min}</span>
                ) : null}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t-2 border-foreground pt-1 font-bold text-lg">
            <span>Total</span>
            <span className="tabular-nums">
              ${total}
              {unknownPrice.length > 0 && "+"}/month
            </span>
          </li>
        </ul>
        <p className={`font-bold ${underBudget ? "text-good" : "text-warn"}`}>
          {underBudget
            ? `✓ Within your $${profile.budget_usd}/month budget${unknownPrice.length ? " (not counting prices we couldn't find)" : ""}.`
            : `⚠ Over your $${profile.budget_usd}/month budget by $${total - profile.budget_usd}. Start with one tool, or ask about a smaller plan.`}
        </p>
        <p className="text-sm text-muted">Starting prices from each vendor&apos;s website. Taxes, add-ons and phone minutes can cost extra.</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-xl font-bold">What you need first</h2>
        {needs.length ? (
          <ul className="space-y-1 list-disc pl-6">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : (
          <p>Nothing special: an email address and a way to pay.</p>
        )}
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Step by step</h2>
        {chosen.map((s, i) => (
          <Card key={s.tool.id} className="space-y-3 break-inside-avoid">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">
                {chosen.length > 1 && `${i + 1}. `}
                {s.tool.name}
              </h3>
              <TrustBadge level={s.tool.trust_level} />
            </div>
            <p className="text-muted">
              {priceText(s.tool)}
              {s.tool.setup_complexity && <> · {SETUP_LABEL[s.tool.setup_complexity]}</>}
              {s.tool.pricing.free_trial_days ? <> · {s.tool.pricing.free_trial_days}-day free trial</> : null}
            </p>
            {s.tool.setup_steps.length ? (
              <ol className="space-y-2">
                {s.tool.setup_steps.map((step, n) => (
                  <li key={n} className="flex gap-3">
                    <span aria-hidden className="shrink-0 h-7 w-7 rounded-full border-2 border-brand text-center font-bold leading-6">
                      {n + 1}
                    </span>
                    <span>
                      <span className="sr-only">Step {n + 1}: </span>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-warn">The vendor doesn&apos;t list setup steps. Ask them to walk you through it.</p>
            )}
            <Warnings items={s.tool.warnings} />
            <div className="flex flex-wrap gap-3 items-center">
              <Button href={s.tool.canonical_url} external>
                {s.tool.engagement ? ENGAGEMENT[s.tool.engagement] : "Visit their website"}
              </Button>
              <SourceLink href={s.tool.pricing.pricing_url}>Pricing source</SourceLink>
            </div>
          </Card>
        ))}
      </section>

      <Card className="space-y-2 border-2 border-brand bg-brand-soft">
        <h2 className="text-xl font-bold text-brand-strong">Free help near you</h2>
        <p>
          You don&apos;t have to do this alone. These programs are free, funded by the U.S. Small Business Administration, and
          can help you set up new tools, plan the cost, and train your staff.
        </p>
        <ul className="space-y-2">
          <li>
            <a className="underline font-bold" href="https://www.sba.gov/local-assistance/find" target="_blank" rel="noreferrer">
              Find your local SBA office or Small Business Development Center (SBDC)
            </a>
          </li>
          <li>
            <a className="underline font-bold" href="https://www.score.org/find-mentor" target="_blank" rel="noreferrer">
              Get a free SCORE mentor
            </a>
          </li>
          <li>
            <a className="underline font-bold" href="https://americassbdc.org/find-your-sbdc/" target="_blank" rel="noreferrer">
              Find your nearest SBDC (America&apos;s SBDC)
            </a>
          </li>
        </ul>
      </Card>

      <p className="no-print">
        <Link href={`/results?${query}`} className="underline">
          ← Back to my matches
        </Link>
      </p>
    </div>
  );
}
