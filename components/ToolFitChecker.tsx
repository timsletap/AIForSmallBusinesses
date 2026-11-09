"use client";

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/schemas/profile";
import type { Tool } from "@/lib/schemas/tool";
import { scoreTool } from "@/lib/ranking/score";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { FitMeter } from "@/components/FitMeter";
import { ProfileEditor } from "@/components/ProfileEditor";
import { Card, Warnings } from "@/components/ui";

/**
 * "How well does this fit my business?" Owners enter (or tweak) their answers and the Fit Score
 * meter updates live, so they can judge any tool themselves.
 */
export function ToolFitChecker({ tool, initial }: { tool: Tool; initial: Profile | null }) {
  const [profile, setProfile] = useState<Profile>(
    initial ?? {
      use_cases: [tool.use_cases[0]],
      industry: tool.industries.find((i) => i !== "other") ?? "other",
      budget_usd: 50,
      current_tools: [],
      must_work_with: [],
      tech_comfort: "medium",
    },
  );
  const [started, setStarted] = useState(!!initial);
  const scored = useMemo(() => scoreTool(tool, profile), [tool, profile]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h2 className="text-xl font-bold">How well does {tool.name} fit your business?</h2>
          <p className="text-muted">
            {started
              ? "Change any answer and the score updates right away."
              : "Answer a few quick questions and we'll score it for your business: your problem, budget, the tools you use, and how easy it is to set up."}
          </p>
        </div>
        {started && (
          <div className="shrink-0">
            {scored ? (
              <FitMeter score={scored.fit} factors={scored.factors} reasons={scored.reasons} size={128} />
            ) : (
              <p className="max-w-[14rem] rounded-xl bg-surface-2 p-3 font-bold" role="status">
                Not a fit: {tool.name} doesn&apos;t help with {profile.use_cases.map((u) => getUseCase(u)?.short.toLowerCase()).join(" or ")}.
              </p>
            )}
          </div>
        )}
      </div>

      {started ? (
        <>
          {scored && scored.check_first.length > 0 && <Warnings items={scored.check_first} />}
          <details className="rounded-xl border border-line" open={!initial}>
            <summary className="min-h-11 px-3 flex items-center font-bold">✏️ Your answers</summary>
            <div className="p-3 pt-0">
              <ProfileEditor value={profile} onChange={setProfile} />
            </div>
          </details>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="min-h-12 px-6 rounded-xl bg-brand text-on-brand font-bold text-lg hover:bg-brand-hover"
        >
          Check my fit
        </button>
      )}
    </Card>
  );
}
