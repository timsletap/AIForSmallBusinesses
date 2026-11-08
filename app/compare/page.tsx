import Link from "next/link";
import { profileFromParams, profileToParams } from "@/lib/schemas/profile";
import { isRecommendable } from "@/lib/ranking/constraints";
import { scoreTool } from "@/lib/ranking/score";
import { getStore } from "@/lib/storage/db";
import { idsFromParams } from "@/lib/http/params";
import { toolLabel } from "@/lib/taxonomy/tools";
import { Button, EmptyState, ENGAGEMENT, SETUP_LABEL, TrustBadge, priceText } from "@/components/ui";
import { WEIGHTS, FACTOR_LABELS, type FactorId } from "@/lib/ranking/score";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare tools | AI Tool Matchmaker" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const profile = profileFromParams(sp);
  const ids = idsFromParams(sp);
  const all = await getStore().listTools({ status: "published" });
  const tools = ids.map((id) => all.find((t) => t.slug === id)).filter((t) => !!t && isRecommendable(t)).map((t) => t!);
  const query = profile ? profileToParams(profile).toString() : "";
  const back = profile ? `/results?${query}` : "/tools";

  if (tools.length < 2) {
    return (
      <EmptyState title="Pick 2 or 3 tools to compare.">
        <p className="mb-4">Tick “Pick for compare or plan” on two or three tools, then press Compare.</p>
        <Button href={back}>Go back</Button>
      </EmptyState>
    );
  }
  const scored = profile ? tools.map((t) => scoreTool(t, profile)) : [];
  const mine = new Set(profile?.current_tools ?? []);

  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: "Price", cells: tools.map((t) => <strong key={t.id}>{priceText(t)}</strong>) },
    ...(profile
      ? [
          { label: "Fit Score", cells: scored.map((s, i) => <strong key={i} className="text-xl">{s ? `${s.fit} / 100` : "Not a fit"}</strong>) },
          ...(Object.keys(WEIGHTS) as FactorId[]).map((f) => ({
            label: FACTOR_LABELS[f],
            cells: scored.map((s, i) => {
              const x = s?.factors.find((y) => y.id === f);
              return <span key={i} className="tabular-nums">{x ? `${Math.round(x.points)} / ${x.weight}` : "–"}</span>;
            }),
          })),
        ]
      : []),
    {
      label: "Works with",
      cells: tools.map((t) =>
        t.integrations.length ? (
          <span key={t.id}>
            {t.integrations.map((i, n) => (
              <span key={i} className={mine.has(i) ? "font-bold text-brand-strong" : ""}>
                {n > 0 && ", "}
                {mine.has(i) && "✓ "}
                {toolLabel(i)}
              </span>
            ))}
          </span>
        ) : (
          <span key={t.id} className="text-amber-900">Not listed</span>
        ),
      ),
    },
    { label: "Setup effort", cells: tools.map((t) => <span key={t.id}>{t.setup_complexity ? SETUP_LABEL[t.setup_complexity] : "Not listed"}</span>) },
    { label: "Vendor trust", cells: tools.map((t) => <TrustBadge key={t.id} level={t.trust_level} />) },
    { label: "Warnings", cells: tools.map((t) => <span key={t.id} className="text-amber-900">{t.warnings.length ? t.warnings.join(" ") : "None"}</span>) },
    {
      label: "How to get started",
      cells: tools.map((t) => (
        <Button key={t.id} href={t.canonical_url} external>
          {t.engagement ? ENGAGEMENT[t.engagement] : "Visit website"}
        </Button>
      )),
    },
  ];

  return (
    <div className="space-y-5">
      <Link href={back} className="underline">
        ← Back
      </Link>
      <h1 className="text-3xl font-bold text-brand-strong">Compare side by side</h1>

      {/* Phone: one card per tool, same rows in the same order. */}
      <div className="sm:hidden space-y-4">
        {tools.map((t, col) => (
          <section key={t.id} className="rounded-2xl border border-line bg-surface p-4" aria-labelledby={`cmp-${t.id}`}>
            <h2 id={`cmp-${t.id}`} className="text-xl font-bold mb-2">
              <Link href={`/tools/${t.slug}?${query}`} className="underline">
                {t.name}
              </Link>
            </h2>
            <dl className="divide-y divide-line">
              {rows.map((r) => (
                <div key={r.label} className="py-2 grid grid-cols-[8rem_1fr] gap-2">
                  <dt className="font-bold text-muted">{r.label}</dt>
                  <dd>{r.cells[col]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {/* Wider screens: tools in columns. */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left">
          <caption className="sr-only">Comparison of {tools.map((t) => t.name).join(", ")}</caption>
          <thead>
            <tr className="border-b-2 border-foreground">
              <th scope="col" className="p-3 w-36">
                <span className="sr-only">Feature</span>
              </th>
              {tools.map((t) => (
                <th key={t.id} scope="col" className="p-3 align-bottom">
                  <Link href={`/tools/${t.slug}?${query}`} className="text-lg underline">
                    {t.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line align-top">
                <th scope="row" className="p-3 font-bold text-muted">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="p-3">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profile && (
        <Button href={`/plan?${query}&ids=${tools.map((t) => t.slug).join(",")}`}>Build my plan with these</Button>
      )}
    </div>
  );
}
