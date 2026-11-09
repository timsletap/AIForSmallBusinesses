import Link from "next/link";
import { getStore } from "@/lib/storage/db";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { domainKey } from "@/lib/discovery/canonical";
import { DiscoverLive } from "@/components/DiscoverLive";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover new AI tools | AI Tool Matchmaker" };

export default async function DiscoverPage() {
  const all = await getStore().listTools();
  const published = all.filter((t) => t.status === "published");
  const newest = [...published].sort((a, b) => b.last_checked_at.localeCompare(a.last_checked_at)).slice(0, 6);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Discover"
        title="Search the web for new AI tools"
        sub="We find products on the open web, read each company's official site, check the vendor, and add only the ones that pass every rule."
      >
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
          <span className="text-white">{published.length}</span> approved · <span className="text-white">{all.length}</span> investigated ·{" "}
          <span className="text-white">{all.length - published.length}</span> held back
        </p>
      </PageHeader>

      <DiscoverLive />

      <section aria-labelledby="recent-h" className="space-y-4">
        <h2 id="recent-h" className="text-center font-mono text-xs uppercase tracking-[0.22em] text-muted">
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
