import Link from "next/link";
import type { Scored } from "@/lib/ranking/score";
import { breakEven } from "@/lib/ranking/reasons";
import type { Profile } from "@/lib/schemas/profile";
import { FitMeter } from "@/components/FitMeter";
import { ToolLogo } from "@/components/ToolLogo";
import { Button, Card, ENGAGEMENT, TrustBadge, Warnings, priceText } from "@/components/ui";
import { Icon } from "@/components/Icon";

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
        <div className="min-w-0 flex gap-3">
          <ToolLogo name={t.name} url={t.canonical_url} size={44} className="mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-xl font-bold">
              {rank && <span className="text-muted mr-1">{rank}.</span>}
              <Link href={`/tools/${t.slug}?${query}`} className="hover:text-gold">
                {t.name}
              </Link>
            </h3>
            <p className="text-muted">{t.description}</p>
          </div>
        </div>
        <div className="shrink-0 -mt-1 -mr-2">
          <FitMeter score={s.fit} factors={s.factors} reasons={s.reasons} size={96} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TrustBadge level={t.trust_level} />
        <span className="font-bold">{priceText(t)}</span>
        {s.over_budget_by !== null && (
          <span className="text-warn text-sm font-bold">Over your budget by ${s.over_budget_by}</span>
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

      {payback && <p className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/[0.05] px-3 py-2 text-[0.95rem]"><Icon name="insight" size={18} className="mt-0.5 shrink-0 text-gold" />{payback}</p>}

      {s.check_first.length > 0 && <Warnings items={s.check_first} />}
      <Warnings items={t.warnings} max={2} />

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
