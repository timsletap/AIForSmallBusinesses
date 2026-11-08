import Link from "next/link";
import { profileFromParams, profileToParams } from "@/lib/schemas/profile";
import { recommend } from "@/lib/ranking/score";
import { getStore } from "@/lib/storage/db";
import { industryById } from "@/lib/taxonomy/industries";
import { toolLabel } from "@/lib/taxonomy/tools";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { ResultCard } from "@/components/ResultCard";
import { ProfileHidden } from "@/components/ProfileHidden";
import { Button, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your matches | AI Tool Matchmaker" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ResultsPage({ searchParams }: { searchParams: SP }) {
  const profile = profileFromParams(await searchParams);
  if (!profile) {
    return (
      <EmptyState title="We need a few answers first.">
        <p className="mb-4">Tell us about your business so we can match you.</p>
        <Button href="/advisor">Start</Button>
      </EmptyState>
    );
  }

  let tools;
  try {
    tools = await getStore().listTools({ status: "published" });
  } catch {
    return <EmptyState title="We couldn't load tools right now.">Please try again in a minute.</EmptyState>;
  }
  const r = recommend(tools, profile);
  const query = profileToParams(profile).toString();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-brand-strong">Your best matches</h1>
        <p className="text-muted">
          For a {industryById(profile.industry)?.label.toLowerCase()} that wants help with{" "}
          {profile.use_cases.map((u) => getUseCase(u)?.reason).join(" and ")}, about $
          {profile.budget_usd}/month
          {profile.current_tools.length > 0 && <>, using {profile.current_tools.map(toolLabel).join(", ")}</>}.{" "}
          <Link href={`/advisor?${new URLSearchParams({ q: profile.problem_text ?? "", uc: profile.use_cases.join(",") })}`} className="underline">
            Change answers
          </Link>
        </p>
      </header>

      <form action="/compare" method="get" className="space-y-4">
        <ProfileHidden profile={profile} />
        {r.ranked.length === 0 ? (
          <EmptyState title="We don't have a good match yet.">
            <p>
              None of our checked tools fit this problem yet. Try picking a different problem, or{" "}
              <Link href="/tools" className="underline">
                browse all tools
              </Link>
              .
            </p>
          </EmptyState>
        ) : (
          <ol className="space-y-4">
            {r.ranked.map((s, i) => (
              <li key={s.tool.id}>
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
          <details className="rounded-2xl border border-line bg-stone-50">
            <summary className="min-h-12 px-4 flex items-center font-bold text-lg">
              Might work, check first ({r.check_first.length})
            </summary>
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
            <p className="text-muted">Tick 2 or 3 tools to compare them. No picks? Your plan uses your top match.</p>
            <div className="no-print sticky bottom-0 -mx-4 px-4 py-2 bg-background/95 border-t border-line grid grid-cols-2 gap-2 sm:flex">
              <button type="submit" className="min-h-11 px-4 rounded-xl border-2 border-brand bg-white text-brand-strong font-bold">
                Compare picks
              </button>
              <button type="submit" formAction="/plan" className="min-h-11 px-4 rounded-xl bg-brand text-white font-bold hover:bg-brand-strong">
                Build my plan
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
