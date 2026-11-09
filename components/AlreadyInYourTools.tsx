import type { BuiltInMatch } from "@/lib/builtins/match";
import type { BuiltInFeature } from "@/lib/builtins/schema";
import { toolLabel } from "@/lib/taxonomy/tools";
import { SourceLink } from "@/components/ui";

const COST: Record<"included" | "paid_addon" | "unknown", { label: string; cls: string }> = {
  included: { label: "No extra cost", cls: "bg-gold/15 text-gold border-gold/60" },
  paid_addon: { label: "Costs extra", cls: "bg-brand/15 text-warn border-brand/60" },
  unknown: { label: "Ask about cost", cls: "bg-white/5 text-muted border-white/25" },
};

function Feature({ f }: { f: BuiltInFeature }) {
  const cost = COST[f.availability ?? "unknown"];
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{f.name}</span>
        <span className={`rounded-full border px-2 py-0.5 text-sm font-bold ${cost.cls}`}>{cost.label}</span>
      </div>
      <p>{f.description}</p>
      {f.cost_note && <p className="text-sm text-muted">{f.cost_note}</p>}
      {f.how_to_start.length > 0 && (
        <details>
          <summary className="min-h-11 flex items-center text-brand-strong font-bold">How to turn it on</summary>
          <ol className="list-decimal pl-6 space-y-1">
            {f.how_to_start.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
      <p className="text-sm text-muted">
        {toolLabel(f.platform)} says: “{f.quote}” <SourceLink href={f.source_url}>source</SourceLink>
      </p>
    </li>
  );
}

/** "Already in your tools": AI and automation built into software the owner already pays for. Shown before new tools. */
export function AlreadyInYourTools({ matches }: { matches: BuiltInMatch[] }) {
  if (!matches.length) return null;
  const names = matches.map((m) => toolLabel(m.platform));
  return (
    <section aria-labelledby="already-h" className="rounded-2xl border-2 border-brand bg-brand-soft p-4 sm:p-5 space-y-4">
      <div>
        <h2 id="already-h" className="text-xl font-bold text-brand-strong">
          Check what you already have first
        </h2>
        <p>
          You already use {names.join(" and ")}. {names.length > 1 ? "They have" : "It has"} AI and automation built in that may help, sometimes at no
          extra cost. Try {names.length > 1 ? "these" : "this"} before paying for something new.
        </p>
      </div>
      {matches.map((m) => (
        <div key={m.platform} className="rounded-xl bg-surface p-4 space-y-3">
          <h3 className="font-bold text-lg">Built into {toolLabel(m.platform)}</h3>
          <ul className="space-y-4 divide-y divide-line [&>li+li]:pt-4">
            {m.features.map((f) => (
              <Feature key={f.id} f={f} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
