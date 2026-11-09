import { Suspense } from "react";
import { Advisor } from "@/components/Advisor";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Tell us about your business | AI Tool Matchmaker" };

export default function AdvisorPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Get matched" title="A few quick questions" sub="Three short steps. About a minute. Nothing is stored." />
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<p className="text-center text-muted">Loading…</p>}>
          <Advisor />
        </Suspense>
      </div>
    </div>
  );
}
