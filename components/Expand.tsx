/**
 * Condensed card: a short summary with a ⊕ that expands to the details. Native <details>, so it
 * works without JavaScript and with keyboards and screen readers.
 */
export function Expand({
  icon,
  title,
  summary,
  children,
  accent = "#ffd200",
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <details className="group rounded-2xl border border-line bg-surface/80 open:border-white/25 open:bg-surface transition-colors">
      <summary className="list-none [&::-webkit-details-marker]:hidden flex items-start gap-4 p-5 min-h-11">
        <span aria-hidden className="grid place-items-center h-11 w-11 shrink-0 rounded-xl text-xl" style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </span>
        <span className="flex-1">
          <span className="block font-display text-lg font-semibold">{title}</span>
          <span className="block text-muted">{summary}</span>
        </span>
        <span
          aria-hidden
          className="grid place-items-center h-8 w-8 shrink-0 rounded-full border border-line text-lg transition-transform duration-300 group-open:rotate-45 group-open:border-gold group-open:text-gold"
        >
          +
        </span>
        <span className="sr-only">Show details</span>
      </summary>
      <div className="px-5 pb-5 pt-1 animate-[fadeUp_.3s_ease-out_both]">{children}</div>
    </details>
  );
}
