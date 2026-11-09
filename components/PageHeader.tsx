/** Centered page header used across the site: eyebrow, headline, short subtitle, optional actions. */
export function PageHeader({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mx-auto max-w-3xl text-center space-y-3 pt-2 sm:pt-6 pb-2">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">{eyebrow}</p>}
      <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight">{title}</h1>
      {sub && <div className="text-lg text-muted">{sub}</div>}
      {children && <div className="flex flex-wrap justify-center gap-3 pt-2">{children}</div>}
    </header>
  );
}
