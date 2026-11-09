import Link from "next/link";
import { getStore } from "@/lib/storage/db";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { domainKey } from "@/lib/discovery/canonical";
import { DiscoverLive } from "@/components/DiscoverLive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover new AI tools | AI Tool Matchmaker" };

export default async function DiscoverPage() {
  const all = await getStore().listTools();
  const published = all.filter((t) => t.status === "published");
  const newest = [...published].sort((a, b) => b.last_checked_at.localeCompare(a.last_checked_at)).slice(0, 6);

  return (
    <div className="space-y-12">
      <header className="space-y-4 max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand/50 bg-brand/15 px-3 py-1 text-sm font-bold">
          <span aria-hidden className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          Live discovery engine
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.02]">
          We find the tools. <span className="text-gradient">You don&apos;t have to.</span>
        </h1>
        <p className="text-lg text-muted">
          Search the web for new AI products right now. We read each company&apos;s official website, pull out the
          facts word-for-word, run six vendor safety checks plus a track-record check, and only add the ones that pass.
        </p>
      </header>

      <section aria-label="Directory stats" className="grid grid-cols-3 border-y border-line">
        {[
          [String(published.length), "approved tools live"],
          [String(all.length), "products investigated"],
          [String(all.length - published.length), "held back or rejected"],
        ].map(([n, l], i) => (
          <div key={l} className={`py-5 px-3 sm:px-5 ${i ? "border-l border-line" : ""}`}>
            <p className="font-display text-3xl sm:text-4xl font-extrabold">{n}</p>
            <p className="text-sm text-muted">{l}</p>
          </div>
        ))}
      </section>

      <DiscoverLive />

      <section aria-labelledby="recent-h" className="space-y-4">
        <h2 id="recent-h" className="font-display text-2xl font-extrabold">
          Recently checked
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {newest.map((t) => (
            <li key={t.id}>
              <Link href={`/tools/${t.slug}`} className="block rounded-2xl border border-line bg-surface/80 p-4 hover:border-gold transition">
                <p className="font-bold">{t.name}</p>
                <p className="text-sm text-muted">
                  {domainKey(t.canonical_url)} · {getUseCase(t.use_cases[0])?.short}
                </p>
                <p className="text-xs text-muted mt-1">
                  Checked {new Date(t.last_checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
