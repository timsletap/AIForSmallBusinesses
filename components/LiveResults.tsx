"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/schemas/profile";
import { profileToParams } from "@/lib/schemas/profile";
import type { Tool } from "@/lib/schemas/tool";
import type { BuiltInFeature } from "@/lib/builtins/schema";
import { builtInMatches } from "@/lib/builtins/match";
import { recommend } from "@/lib/ranking/score";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { industryById } from "@/lib/taxonomy/industries";
import { AlreadyInYourTools } from "@/components/AlreadyInYourTools";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileHidden } from "@/components/ProfileHidden";
import { ResultCard } from "@/components/ResultCard";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";

/**
 * Results that re-rank instantly as the owner adjusts their answers. Scoring is the same pure,
 * deterministic engine the server uses; the URL is kept in sync so results stay shareable.
 */
export function LiveResults({ tools, builtins, initial }: { tools: Tool[]; builtins: BuiltInFeature[]; initial: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const r = useMemo(() => recommend(tools, profile), [tools, profile]);
  const already = useMemo(() => builtInMatches(builtins, profile), [builtins, profile]);
  const query = profileToParams(profile).toString();

  useEffect(() => {
    const t = setTimeout(() => router.replace(`/results?${query}`, { scroll: false }), 400);
    return () => clearTimeout(t);
  }, [query, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Your matches"
        title="Your best matches"
        sub={
          <p aria-live="polite">
            For a {industryById(profile.industry)?.label.toLowerCase()} that wants help with{" "}
            {profile.use_cases.map((u) => getUseCase(u)?.reason).join(" and ")}, about ${profile.budget_usd}/month.
          </p>
        }
      />

      <details className="no-print rounded-2xl border-2 border-line bg-surface group" open={false}>
        <summary className="min-h-12 px-4 flex items-center justify-between gap-3 font-bold text-lg">
          <span>
            <Icon name="edit" size={18} className="inline -mt-0.5 mr-2 text-gold" />Adjust your answers <span className="font-normal text-base text-muted">(scores update as you go)</span>
          </span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="px-4 pb-4">
          <ProfileEditor value={profile} onChange={setProfile} />
        </div>
      </details>

      <AlreadyInYourTools matches={already} />

      {already.length > 0 && r.ranked.length > 0 && <h2 className="text-xl font-bold">New tools that fit</h2>}

      <form action="/compare" method="get" className="space-y-4">
        <ProfileHidden profile={profile} />
        {r.ranked.length === 0 ? (
          <EmptyState title="We don't have a good match yet.">
            <p>
              None of our checked tools fit this problem yet. Try another problem above, or{" "}
              <Link href="/tools" className="underline">
                browse all tools
              </Link>
              .
            </p>
          </EmptyState>
        ) : (
          <ol className="space-y-4">
            {r.ranked.map((s, i) => (
              <li key={s.tool.id} className="animate-[fadeUp_.35s_ease-out_both] motion-reduce:animate-none">
                {profile.use_cases.length > 1 && Object.values(r.best_by_use_case).includes(s.tool.id) && (
                  <p className="text-sm font-bold text-accent mb-1">
                    Best pick for:{" "}
                    {Object.entries(r.best_by_use_case)
                      .filter(([, id]) => id === s.tool.id)
                      .map(([uc]) => getUseCase(uc)?.label)
                      .join(", ")}
                  </p>
                )}
                <ResultCard s={s} rank={i + 1} query={query} industry={profile.industry} />
              </li>
            ))}
          </ol>
        )}

        {r.check_first.length > 0 && (
          <details className="rounded-2xl border border-line bg-surface-2">
            <summary className="min-h-12 px-4 flex items-center font-bold text-lg">Might work, check first ({r.check_first.length})</summary>
            <div className="p-3 space-y-3">
              <p className="text-muted px-1">These could fit, but something needs checking before you sign up.</p>
              {r.check_first.map((s) => (
                <ResultCard key={s.tool.id} s={s} query={query} industry={profile.industry} />
              ))}
            </div>
          </details>
        )}

        {r.ranked.length > 0 && (
          <>
            <p className="text-muted">Tick 2 or 3 tools to compare them side by side. No picks? Your plan uses your top match.</p>
            <div className="no-print sticky bottom-[5.5rem] z-20 grid grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-surface p-2 shadow-xl sm:flex sm:justify-center">
              <button type="submit" className="min-h-11 px-4 rounded-xl border-2 border-brand bg-surface-2 text-brand-strong font-bold">
                Compare picks
              </button>
              <button type="submit" formAction="/plan" className="min-h-11 px-4 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover">
                Build my plan
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
