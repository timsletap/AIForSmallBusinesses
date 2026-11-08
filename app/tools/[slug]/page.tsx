import Link from "next/link";
import { notFound } from "next/navigation";
import { profileFromParams, profileToParams } from "@/lib/schemas/profile";
import { CHECK_IDS } from "@/lib/schemas/tool";
import { isRecommendable } from "@/lib/ranking/constraints";
import { scoreTool } from "@/lib/ranking/score";
import { getStore } from "@/lib/storage/db";
import { industryById } from "@/lib/taxonomy/industries";
import { CURRENT_TOOLS, toolLabel } from "@/lib/taxonomy/tools";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { CHECK_LABELS } from "@/lib/verification/vendorChecks";
import { FitBreakdown } from "@/components/ResultCard";
import { Button, Card, ENGAGEMENT, SETUP_LABEL, SourceLink, TrustBadge, Warnings, priceText } from "@/components/ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const FIELD_LABELS: Record<string, string> = {
  vendor: "Company",
  free_plan: "Free plan",
  free_trial_days: "Free trial",
  price_monthly_min: "Starting price",
  price_monthly_max: "Higher plan price",
  plan_name: "Plan name",
  integrations: "Works with",
  works_standalone: "Works on its own",
  contact: "Contact",
  security: "Security",
};

export async function generateMetadata({ params }: Props) {
  const t = await getStore().getTool((await params).slug);
  return { title: t ? `${t.name} | AI Tool Matchmaker` : "Tool not found" };
}

export default async function ToolPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const t = await getStore().getTool(slug);
  if (!t || !isRecommendable(t)) notFound();
  const profile = profileFromParams(await searchParams);
  const scored = profile ? scoreTool(t, profile) : null;
  const mine = new Set(profile?.current_tools ?? []);
  const query = profile ? profileToParams(profile).toString() : "";
  const sources = [...new Set([t.canonical_url, ...Object.values(t.evidence).map((e) => e.source_url), ...Object.values(t.vendor_checks).map((c) => c.source_url)].filter((u): u is string => !!u).map((u) => u.replace(/\/+$/, "")))];

  return (
    <article className="space-y-6">
      {profile && (
        <Link href={`/results?${query}`} className="no-print underline">
          ← Back to my matches
        </Link>
      )}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-brand-strong">{t.name}</h1>
          <TrustBadge level={t.trust_level} />
        </div>
        {t.vendor && <p className="text-muted">Made by {t.vendor}</p>}
        <p className="text-lg">{t.description}</p>
        <div className="flex flex-wrap gap-3">
          <Button href={t.canonical_url} external>
            {t.engagement ? ENGAGEMENT[t.engagement] : "Visit their website"}
          </Button>
          {profile && (
            <Button href={`/plan?${query}&ids=${t.slug}`} variant="secondary">
              Make a plan with this tool
            </Button>
          )}
        </div>
      </header>

      {scored && (
        <Card className="space-y-2">
          <h2 className="text-xl font-bold">Fit Score for you: {scored.fit} / 100</h2>
          <ul className="list-disc pl-6">
            {scored.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <FitBreakdown s={scored} />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-xl font-bold">What it helps with</h2>
          <ul className="list-disc pl-6">
            {t.use_cases.map((u) => (
              <li key={u}>{getUseCase(u)?.label}</li>
            ))}
          </ul>
          {t.industries.filter((i) => i !== "other").length > 0 && (
            <p className="text-muted">Good for: {t.industries.filter((i) => i !== "other").map((i) => industryById(i)?.label).join(", ")}</p>
          )}
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-bold">Price</h2>
          <p className="text-lg font-bold">{priceText(t)}</p>
          {t.pricing.plan_name && <p>Plan: {t.pricing.plan_name}</p>}
          {t.pricing.free_trial_days ? <p>{t.pricing.free_trial_days}-day free trial</p> : null}
          {t.evidence.price_monthly_min && (
            <blockquote className="border-l-4 border-line pl-3 text-muted italic">
              “{t.evidence.price_monthly_min.quote}”
            </blockquote>
          )}
          <SourceLink href={t.pricing.pricing_url}>See prices on their site</SourceLink>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-bold">Works with</h2>
          {t.integrations.length ? (
            <ul className="flex flex-wrap gap-2">
              {t.integrations.map((i) => (
                <li
                  key={i}
                  className={`rounded-full px-3 py-1 border-2 font-bold ${mine.has(i) ? "border-brand bg-brand-soft text-brand-strong" : "border-line"}`}
                >
                  {mine.has(i) && <span aria-hidden>✓ </span>}
                  {toolLabel(i)}
                  {mine.has(i) && <span className="sr-only"> (you use this)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-amber-900">⚠ Their site doesn&apos;t say which apps it works with. Ask before buying.</p>
          )}
          {profile &&
            [...mine]
              .filter((m) => !t.integrations.includes(m) && !["paper", "none"].includes(m))
              .map((m) => (
                <p key={m} className="text-sm text-muted">
                  Not listed: {CURRENT_TOOLS.find((c) => c.id === m)?.label}
                </p>
              ))}
          {t.works_standalone && <p>Also works on its own, no other apps needed.</p>}
          <SourceLink href={t.evidence.integrations?.source_url}>Source</SourceLink>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-bold">What you need first</h2>
          {t.integration_requirements.length ? (
            <ul className="list-disc pl-6">
              {t.integration_requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p>Nothing special listed: an email address and a way to pay.</p>
          )}
          {t.setup_complexity && <p className="text-muted">Setup: {SETUP_LABEL[t.setup_complexity]}</p>}
        </Card>
      </div>

      <Card className="space-y-2">
        <h2 className="text-xl font-bold">How to get started</h2>
        {t.setup_steps.length ? (
          <ol className="list-decimal pl-6 space-y-1">
            {t.setup_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : (
          <p className="text-amber-900">The vendor doesn&apos;t list setup steps. Ask them to walk you through it.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Can you trust this company?</h2>
        <p className="text-muted">We checked the vendor&apos;s own website for these things:</p>
        <ul className="divide-y divide-line">
          {CHECK_IDS.map((id) => {
            const c = t.vendor_checks[id];
            return (
              <li key={id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-6 w-6 rounded-full text-center font-bold leading-6 text-white ${c?.pass ? "bg-green-700" : "bg-amber-700"}`}
                  >
                    {c?.pass ? "✓" : "!"}
                  </span>
                  <span className="font-bold">{CHECK_LABELS[id]}</span>
                  <span className={c?.pass ? "text-green-800" : "text-amber-900"}>{c?.pass ? "Found" : "Not found"}</span>
                </span>
                <span className="flex items-center gap-3">
                  {c?.note && <span className="text-sm text-muted">{c.note}</span>}
                  {c?.pass && <SourceLink href={c.source_url}>View</SourceLink>}
                </span>
              </li>
            );
          })}
        </ul>
        {t.admin_reviewed && <p className="text-green-800 font-bold">✔ Our team also checked this tool by hand.</p>}
        <Warnings items={t.warnings} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Where these facts come from</h2>
        <dl className="space-y-2">
          {Object.entries(t.evidence).map(([field, e]) => (
            <div key={field}>
              <dt className="font-bold">
                {FIELD_LABELS[field] ?? field}
                {e.claim_type === "vendor_claim" && <span className="ml-2 text-sm text-accent">Vendor says</span>}
              </dt>
              <dd className="text-muted">
                “{e.quote}” <SourceLink href={e.source_url}>source</SourceLink>
              </dd>
            </div>
          ))}
        </dl>
        <h3 className="font-bold pt-2">Pages we read</h3>
        <ul className="text-sm space-y-1 break-all">
          {sources.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer" className="underline">
                {u}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Last checked {new Date(t.last_checked_at).toLocaleDateString("en-US", { dateStyle: "long" })}. Details can
          change, so confirm with the vendor before you pay.
        </p>
      </Card>
    </article>
  );
}
