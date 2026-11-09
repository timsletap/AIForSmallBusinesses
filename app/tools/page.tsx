import Link from "next/link";
import { isRecommendable } from "@/lib/ranking/constraints";
import { filterTools } from "@/lib/ranking/browse";
import { getStore } from "@/lib/storage/db";
import { INDUSTRIES } from "@/lib/taxonomy/industries";
import { USE_CASES, getUseCase } from "@/lib/taxonomy/useCases";
import { Card, EmptyState, TrustBadge, priceText } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { ToolLogo } from "@/components/ToolLogo";
import type { Tool } from "@/lib/schemas/tool";

export const dynamic = "force-dynamic";
export const metadata = { title: "Browse AI tools | TerpTool" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";


const select = "block w-full min-h-11 rounded-xl border-2 border-line bg-surface-2 px-3 text-base";

export default async function BrowsePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const industry = one(sp.industry);
  const use_case = one(sp.use_case);
  const maxRaw = one(sp.max_price);
  const max_price = maxRaw === "" ? null : Number(maxRaw);

  let all: Tool[];
  try {
    all = (await getStore().listTools({ status: "published" })).filter(isRecommendable);
  } catch {
    return <EmptyState title="We couldn't load tools right now.">Please try again in a minute.</EmptyState>;
  }
  const tools = filterTools(all, { q, industry, use_case, max_price: Number.isFinite(max_price) ? max_price : null });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The directory"
        title="Browse AI tools"
        sub={<>{all.length} vetted tools. Every price and claim links back to the vendor&apos;s own website.</>}
      />

      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end" role="search">
        <label className="sm:col-span-2 lg:col-span-4">
          <span className="font-bold">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Try: phone, Square, reviews, booking"
            className="mt-1 block w-full min-h-11 rounded-xl border-2 border-line bg-surface-2 px-3 text-lg"
          />
        </label>
        <label>
          <span className="font-bold">Problem</span>
          <select name="use_case" defaultValue={use_case} className={select}>
            <option value="">Any problem</option>
            {USE_CASES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.short}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="font-bold">Business type</span>
          <select name="industry" defaultValue={industry} className={select}>
            <option value="">Any business</option>
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="font-bold">Max price per month</span>
          <select name="max_price" defaultValue={maxRaw} className={select}>
            <option value="">Any price</option>
            {[0, 25, 50, 100, 200].map((p) => (
              <option key={p} value={p}>
                {p === 0 ? "Free" : `$${p}`}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 px-5 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover">
            Search
          </button>
          {(q || industry || use_case || maxRaw) && (
            <Link href="/tools" className="min-h-11 px-4 inline-flex items-center underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p role="status" className="font-bold">
        {tools.length} {tools.length === 1 ? "tool" : "tools"} found
      </p>

      {tools.length === 0 ? (
        <EmptyState title="No tools match that.">Try fewer words or clear a filter.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {tools.map((t) => (
            <li key={t.id}>
              <Card className="h-full space-y-2">
                <div className="flex items-center gap-3">
                  <ToolLogo name={t.name} url={t.canonical_url} size={40} />
                  <h2 className="text-lg font-bold">
                    <Link href={`/tools/${t.slug}`} className="hover:text-gold">
                      {t.name}
                    </Link>
                  </h2>
                </div>
                <p className="text-muted">{t.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <TrustBadge level={t.trust_level} />
                  <span className="font-bold">{priceText(t)}</span>
                </div>
                <p className="text-sm text-muted">{t.use_cases.map((u) => getUseCase(u)?.short).join(" · ")}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
