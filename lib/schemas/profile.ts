import { z } from "zod";
import { INDUSTRY_IDS } from "@/lib/taxonomy/industries";
import { TOOL_IDS } from "@/lib/taxonomy/tools";
import { USE_CASE_IDS } from "@/lib/taxonomy/useCases";

export const Profile = z.object({
  problem_text: z.string().max(2000).optional(),
  use_cases: z.array(z.enum(USE_CASE_IDS)).min(1).max(2),
  industry: z.enum(INDUSTRY_IDS),
  budget_usd: z.number().min(0).max(100000),
  current_tools: z.array(z.enum(TOOL_IDS)).default([]),
  must_work_with: z.array(z.enum(TOOL_IDS)).default([]),
  tech_comfort: z.enum(["low", "medium", "high"]),
});
export type Profile = z.infer<typeof Profile>;

/** Parse a profile from URL search params (results/plan/compare pages keep state in the URL). */
export function profileFromParams(sp: Record<string, string | string[] | undefined>): Profile | null {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const list = (k: string) => get(k).split(",").filter(Boolean);
  const parsed = Profile.safeParse({
    problem_text: get("q") || undefined,
    use_cases: list("uc"),
    industry: get("industry"),
    budget_usd: Number(get("budget")),
    current_tools: list("tools"),
    must_work_with: list("must"),
    tech_comfort: get("comfort") || "medium",
  });
  return parsed.success ? parsed.data : null;
}

export function profileToParams(p: Profile): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.problem_text) sp.set("q", p.problem_text);
  sp.set("uc", p.use_cases.join(","));
  sp.set("industry", p.industry);
  sp.set("budget", String(p.budget_usd));
  if (p.current_tools.length) sp.set("tools", p.current_tools.join(","));
  if (p.must_work_with.length) sp.set("must", p.must_work_with.join(","));
  sp.set("comfort", p.tech_comfort);
  return sp;
}
