import type { Profile } from "@/lib/schemas/profile";
import type { Tool } from "@/lib/schemas/tool";
import { toolLabel } from "@/lib/taxonomy/tools";

/** Hard gate: only published tools, and never an unverified vendor. */
export function isRecommendable(t: Tool): boolean {
  return t.status === "published" && t.trust_level !== "unverified";
}

/** Reasons a tool goes in the "Might work, check first" group instead of the main list. */
export function checkFirstReasons(t: Tool, p: Profile): string[] {
  const out: string[] = [];
  const missing = p.must_work_with.filter((m) => m !== "none" && !t.integrations.includes(m));
  if (missing.length) {
    out.push(`We couldn't confirm it works with your ${missing.map(toolLabel).join(" and ")}.`);
  }
  if (p.tech_comfort === "low" && t.setup_complexity === "high") {
    out.push("Setup takes more work. You may want help getting started.");
  }
  return out;
}
