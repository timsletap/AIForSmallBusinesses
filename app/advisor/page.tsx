import { Suspense } from "react";
import { Advisor } from "@/components/Advisor";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Tell us about your business | TerpTool" };

export default function AdvisorPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Get matched" title="A few quick questions" sub="Three steps. About a minute." />
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<p className="text-center text-muted">Loading…</p>}>
          <Advisor />
        </Suspense>
      </div>
    </div>
  );
}
