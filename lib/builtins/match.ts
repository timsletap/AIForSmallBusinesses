import type { Profile } from "@/lib/schemas/profile";
import type { ToolId } from "@/lib/taxonomy/tools";
import type { BuiltInFeature } from "./schema";

export type BuiltInMatch = { platform: ToolId; features: BuiltInFeature[] };

/**
 * Built-in AI features in tools the owner already uses that fit their problem, grouped by platform.
 * Order: the owner's first problem before the second, then features included at no extra cost,
 * then unknown cost, then paid add-ons. Pure and deterministic.
 */
export function builtInMatches(features: BuiltInFeature[], p: Profile, perPlatform = 2): BuiltInMatch[] {
  const rank = (f: BuiltInFeature) => {
    const ucIdx = Math.min(...f.use_cases.map((u) => p.use_cases.indexOf(u)).filter((i) => i >= 0));
    const cost = f.availability === "included" ? 0 : f.availability === null ? 1 : 2;
    return ucIdx * 10 + cost;
  };
  const byPlatform = new Map<ToolId, BuiltInFeature[]>();
  for (const f of features) {
    if (!p.current_tools.includes(f.platform)) continue;
    if (!f.use_cases.some((u) => p.use_cases.includes(u))) continue;
    byPlatform.set(f.platform, [...(byPlatform.get(f.platform) ?? []), f]);
  }
  return [...byPlatform.entries()]
    .map(([platform, fs]) => ({
      platform,
      features: fs.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, perPlatform),
    }))
    .sort((a, b) => rank(a.features[0]) - rank(b.features[0]) || a.platform.localeCompare(b.platform));
}
