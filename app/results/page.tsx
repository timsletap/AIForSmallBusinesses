import { profileFromParams } from "@/lib/schemas/profile";
import { isRecommendable } from "@/lib/ranking/constraints";
import { getStore } from "@/lib/storage/db";
import { loadBuiltIns } from "@/lib/builtins/load";
import { LiveResults } from "@/components/LiveResults";
import { Button, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your matches | TerpTool" };

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
    tools = (await getStore().listTools({ status: "published" })).filter(isRecommendable);
  } catch {
    return <EmptyState title="We couldn't load tools right now.">Please try again in a minute.</EmptyState>;
  }
  // Rendered on the server first (fast, works without JavaScript), then re-ranks live as answers change.
  return <LiveResults tools={tools} builtins={await loadBuiltIns()} initial={profile} />;
}
