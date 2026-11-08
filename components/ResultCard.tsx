import Link from "next/link";
import type { Scored } from "@/lib/ranking/score";
import { breakEven } from "@/lib/ranking/reasons";
import type { Profile } from "@/lib/schemas/profile";
import { Button, Card, ENGAGEMENT, TrustBadge, Warnings, priceText } from "@/components/ui";

export function FitBreakdown({ s }: { s: Scored }) {
  return (
    <details className="rounded-xl bg-stone-50 border border-line">
      <summary className="min-h-11 px-3 flex items-center font-bold text-brand-strong">Why this score?</summary>
      <table className="w-full text-sm mx-3 mb-3" style={{ width: "calc(100% - 1.5rem)" }}>
        <caption className="sr-only">Fit Score breakdown</caption>
        <thead>
          <tr className="text-left text-muted">
            <th className="font-normal py-1">What we checked</th>
            <th className="font-normal py-1 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {s.factors.map((f) => (
            <tr key={f.id} className="border-t border-line">
              <td className="py-1.5">
                {f.label}
                <div className="h-1.5 mt-1 rounded bg-stone-200 overflow-hidden" aria-hidden>
                  <div className="h-full bg-brand" style={{ width: `${f.f * 100}%` }} />
                </div>
              </td>
              <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                {Math.round(f.points)} / {f.weight}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-foreground font-bold">
            <td className="py-1.5">Fit Score</td>
            <td className="py-1.5 text-right">{s.fit} / 100</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

export function ResultCard({
  s,
  rank,
  query,
  industry,
  selectable = true,
}: {
  s: Scored;
  rank?: number;
  query: string;
  industry: Profile["industry"];
  selectable?: boolean;
}) {
  const t = s.tool;
  const payback = breakEven(s.price, industry);
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold">
            {rank && <span className="text-muted mr-1">{rank}.</span>}
            <Link href={`/tools/${t.slug}?${query}`} className="underline decoration-2 underline-offset-2 hover:text-brand-strong">
              {t.name}
            </Link>
          </h3>
          <p className="text-muted">{t.description}</p>
        </div>
        <div className="shrink-0 text-center rounded-xl bg-brand-soft px-3 py-2" aria-label={`Fit Score ${s.fit} out of 100`}>
          <div className="text-2xl font-bold text-brand-strong leading-none">{s.fit}</div>
          <div className="text-xs text-muted">Fit Score</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TrustBadge level={t.trust_level} />
        <span className="font-bold">{priceText(t)}</span>
        {s.over_budget_by !== null && (
          <span className="text-amber-900 text-sm font-bold">Over your budget by ${s.over_budget_by}</span>
        )}
      </div>

      <ul className="space-y-1">
        {s.reasons.map((r) => (
          <li key={r} className="flex gap-2">
            <span aria-hidden className="text-brand">•</span>
            {r}
          </li>
        ))}
      </ul>

      {payback && <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[0.95rem]">💡 {payback}</p>}

      {s.check_first.length > 0 && <Warnings items={s.check_first} />}
      <Warnings items={t.warnings} max={2} />

      <FitBreakdown s={s} />

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button href={t.canonical_url} external>
          {t.engagement ? ENGAGEMENT[t.engagement] : "Visit their website"}
        </Button>
        <Button href={`/tools/${t.slug}?${query}`} variant="secondary">
          Details
        </Button>
        {selectable && (
          <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer font-bold">
            <input type="checkbox" name="ids" value={t.slug} className="h-6 w-6 accent-[var(--brand)]" />
            Pick for compare or plan
          </label>
        )}
      </div>
    </Card>
  );
}
