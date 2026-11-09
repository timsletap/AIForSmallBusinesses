import type { BuiltInMatch } from "@/lib/builtins/match";
import type { BuiltInFeature } from "@/lib/builtins/schema";
import { toolLabel } from "@/lib/taxonomy/tools";
import { ToolLogo } from "@/components/ToolLogo";

const COST: Record<"included" | "paid_addon" | "unknown", { label: string; cls: string }> = {
  included: { label: "No extra cost", cls: "bg-gold/15 text-gold border-gold/50" },
  paid_addon: { label: "Costs extra", cls: "bg-brand/15 text-warn border-brand/50" },
  unknown: { label: "Ask about cost", cls: "bg-white/5 text-muted border-white/20" },
};

/** Logo source for each platform's built-in features. */
const PLATFORM_SITE: Record<string, string> = {
  square: "https://squareup.com",
  quickbooks: "https://quickbooks.intuit.com",
  google_business_profile: "https://business.google.com",
  gmail_outlook: "https://workspace.google.com",
  shopify: "https://shopify.com",
  clover: "https://clover.com",
  toast: "https://toasttab.com",
  instagram_facebook: "https://facebook.com",
};

function Feature({ f }: { f: BuiltInFeature }) {
  const cost = COST[f.availability ?? "unknown"];
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* The feature name links to the platform's own page that describes it. */}
        <a href={f.source_url} target="_blank" rel="noreferrer" className="font-bold hover:text-gold underline-offset-4 hover:underline">
          {f.name}
          <span className="sr-only"> (opens {toolLabel(f.platform)}&apos;s page)</span>
        </a>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${cost.cls}`}>{cost.label}</span>
      </div>
      <p className="text-muted mt-0.5">{f.description}</p>
      {f.how_to_start.length > 0 && (
        <details className="mt-1 group/how">
          <summary className="list-none [&::-webkit-details-marker]:hidden inline-flex min-h-9 items-center gap-1 text-sm font-bold text-gold">
            How to turn it on <span aria-hidden className="transition-transform group-open/how:rotate-180">▾</span>
          </summary>
          <ol className="mt-1 list-decimal pl-5 space-y-1 text-sm text-muted">
            {f.how_to_start.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

/**
 * "Already in your tools": AI built into software the owner already pays for. Collapsed to one
 * line by default; expands to the features.
 */
export function AlreadyInYourTools({ matches }: { matches: BuiltInMatch[] }) {
  if (!matches.length) return null;
  const names = matches.map((m) => toolLabel(m.platform));
  const count = matches.reduce((n, m) => n + m.features.length, 0);
  return (
    <details className="group rounded-2xl border border-gold/30 bg-gold/[0.04] open:bg-surface">
      <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-3 p-4 min-h-14">
        <span className="flex -space-x-2">
          {matches.map((m) => (
            <ToolLogo key={m.platform} name={toolLabel(m.platform)} url={PLATFORM_SITE[m.platform] ?? "https://example.invalid"} size={32} className="ring-2 ring-background" />
          ))}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold">Check what you already have</span>
          <span className="block text-sm text-muted truncate">
            {names.join(" and ")} {names.length > 1 ? "have" : "has"} {count} built-in feature{count === 1 ? "" : "s"} that could help, before you pay for anything new
          </span>
        </span>
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-sm transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4 space-y-4">
        {matches.map((m) => (
          <div key={m.platform}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted mb-2">Built into {toolLabel(m.platform)}</p>
            <ul className="divide-y divide-line">
              {m.features.map((f) => (
                <Feature key={f.id} f={f} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
