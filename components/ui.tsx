import Link from "next/link";
import type { Tool, TrustLevel } from "@/lib/schemas/tool";
import { TRUST_BADGE } from "@/lib/verification/vendorChecks";
import { Icon } from "@/components/Icon";

// UMD palette: gold = verified by hand, white = automated checks passed, red tint = some checks missing.
const TONES: Record<string, string> = {
  green: "bg-gold/15 text-gold border-gold/60",
  blue: "bg-white/10 text-white border-white/40",
  amber: "bg-brand/15 text-warn border-brand/60",
  gray: "bg-white/5 text-muted border-white/20",
};

const ICONS: Record<TrustLevel, string> = { verified: "✔", checks_passed: "✓", partial: "!", unverified: "?" };

export function TrustBadge({ level }: { level: TrustLevel }) {
  const b = TRUST_BADGE[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-bold ${TONES[b.tone]}`}>
      <span aria-hidden>{ICONS[level]}</span>
      {b.label}
    </span>
  );
}

export function priceText(t: Pick<Tool, "pricing">): string {
  const p = t.pricing;
  const min = p.est_monthly_usd_min;
  const max = p.est_monthly_usd_max;
  if (p.free_plan && (!min || min === 0)) return max ? `Free plan; paid up to $${max}/mo` : "Free plan available";
  if (min == null) return "Price not listed";
  if (min === 0) return "Free";
  return max && max > min ? `$${min} to $${max}/month` : `From $${min}/month`;
}

export const ENGAGEMENT: Record<NonNullable<Tool["engagement"]>, string> = {
  self_serve: "Sign up on their website",
  free_trial: "Start a free trial",
  book_demo: "Book a call with their team",
  needs_setup_help: "Ask them for setup help",
};

export const SETUP_LABEL: Record<NonNullable<Tool["setup_complexity"]>, string> = {
  low: "Easy: about an hour, do it yourself",
  medium: "Medium: a few hours",
  high: "Harder: plan for help",
};

export function Button({
  href,
  children,
  variant = "primary",
  external,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
}) {
  const cls =
    variant === "primary"
      ? "bg-brand text-on-brand hover:bg-brand-hover"
      : "bg-surface text-brand-strong border-2 border-brand hover:bg-brand-soft";
  const c = `inline-flex items-center justify-center min-h-11 px-5 rounded-xl font-bold text-base ${cls}`;
  return external ? (
    <a href={href} className={c} target="_blank" rel="noreferrer">
      {children}
      <span className="sr-only"> (opens the vendor&apos;s website)</span>
    </a>
  ) : (
    <Link href={href} className={c}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Warnings({ items, max }: { items: string[]; max?: number }) {
  if (!items.length) return null;
  const shown = max ? items.slice(0, max) : items;
  return (
    <ul className="space-y-1 text-[0.95rem] text-warn">
      {shown.map((w) => (
        <li key={w} className="flex gap-2">
          <Icon name="alert" size={16} className="mt-1 shrink-0" />
          <span>
            <span className="sr-only">Warning: </span>
            {w}
          </span>
        </li>
      ))}
      {max && items.length > max && <li className="text-muted">+ {items.length - max} more on the tool page</li>}
    </ul>
  );
}

export function SourceLink({ href, children = "Source" }: { href: string | null | undefined; children?: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sm underline text-brand-strong">
      {children}
    </a>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="text-center py-10">
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </Card>
  );
}

/** A heading or label that links to the vendor page it came from (instead of a separate "source" link). */
export function SourceTitle({ href, children }: { href: string | null | undefined; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group/src inline-flex items-baseline gap-1 hover:text-gold">
      {children}
      <Icon name="external" size={13} className="text-muted transition group-hover/src:text-gold group-hover/src:-translate-y-0.5 self-center" />
      <span className="sr-only"> (opens the vendor&apos;s page)</span>
    </a>
  );
}
