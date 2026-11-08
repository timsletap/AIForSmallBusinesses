import { Suspense } from "react";
import { Advisor } from "@/components/Advisor";

export const metadata = { title: "Tell us about your business | AI Tool Matchmaker" };

export default function AdvisorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-brand-strong">A few quick questions</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Advisor />
      </Suspense>
    </div>
  );
}
