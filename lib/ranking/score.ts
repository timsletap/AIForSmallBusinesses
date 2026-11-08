import type { Profile } from "@/lib/schemas/profile";
import type { Tool } from "@/lib/schemas/tool";
import { CHECK_IDS } from "@/lib/schemas/tool";
import { NON_INTEGRATING, type ToolId } from "@/lib/taxonomy/tools";
import type { UseCaseId } from "@/lib/taxonomy/useCases";
import { checkFirstReasons, isRecommendable } from "./constraints";
import { buildReasons } from "./reasons";

export type FactorId = "use_case" | "works_with" | "trust" | "affordability" | "ease" | "reviews";

export const WEIGHTS: Record<FactorId, number> = {
  use_case: 30,
  works_with: 20,
  trust: 15,
  affordability: 15,
  ease: 15,
  reviews: 5,
};

export const FACTOR_LABELS: Record<FactorId, string> = {
  use_case: "Fits your problem",
  works_with: "Works with your tools",
  trust: "Vendor trust",
  affordability: "Fits your budget",
  ease: "Easy to set up",
  reviews: "Reviews",
};

export type Factor = { id: FactorId; label: string; weight: number; f: number; points: number };

export type Scored = {
  tool: Tool;
  fit: number;
  factors: Factor[];
  matched_tools: ToolId[];
  relevant_tools: ToolId[];
  matched_use_case: UseCaseId;
  price: number | null;
  over_budget_by: number | null;
  reasons: string[];
  check_first: string[];
};

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** Lowest monthly cost to use the tool: 0 with a free plan, else the cheapest listed price. */
export function monthlyPrice(t: Tool): number | null {
  if (t.pricing.free_plan) return 0;
  return t.pricing.est_monthly_usd_min;
}

/** 1.0 if the tool's primary use case is one of the owner's, 0.6 if listed as secondary, else 0. */
export function scoreUseCase(t: Tool, useCases: UseCaseId[]): { f: number; matched: UseCaseId | null } {
  let best: { f: number; matched: UseCaseId | null } = { f: 0, matched: null };
  for (const uc of useCases) {
    const f = t.use_cases[0] === uc ? 1 : t.use_cases.includes(uc) ? 0.6 : 0;
    if (f > best.f) best = { f, matched: uc };
  }
  return best;
}

/** Current tools that can connect to software at all (paper and "none" can't). */
export function relevantTools(p: Profile): ToolId[] {
  return p.current_tools.filter((t) => !NON_INTEGRATING.includes(t));
}

export function worksWithFit(t: Tool, p: Profile): { f: number; matched: ToolId[]; relevant: ToolId[] } {
  const relevant = relevantTools(p);
  if (!relevant.length) return { f: t.works_standalone ? 1 : 0.5, matched: [], relevant };
  const matched = relevant.filter((r) => t.integrations.includes(r));
  return { f: matched.length / relevant.length, matched, relevant };
}

export function trustFit(t: Tool): number {
  const passed = CHECK_IDS.filter((c) => t.vendor_checks[c]?.pass).length;
  return clamp(passed / 6 + (t.admin_reviewed ? 0.1 : 0));
}

export function affordabilityFit(price: number | null, budget: number): number {
  if (price === null) return 0.4;
  if (price <= budget) return 1;
  if (budget <= 0) return 0;
  return clamp(1 - (price - budget) / budget);
}

export function easeFit(t: Tool, comfort: Profile["tech_comfort"]): number {
  const base = t.setup_complexity === "low" ? 1 : t.setup_complexity === "medium" ? 0.6 : t.setup_complexity === "high" ? 0.2 : 0.5;
  return comfort === "high" ? Math.max(base, 0.6) : base;
}

export function reviewsFit(t: Tool): number {
  return t.reviews ? clamp(t.reviews.rating / 5) : 0.5;
}

/** Score one tool for a profile. Returns null when the tool doesn't fit the problem at all. */
export function scoreTool(t: Tool, p: Profile): Scored | null {
  const uc = scoreUseCase(t, p.use_cases);
  if (!uc.matched) return null;
  const ww = worksWithFit(t, p);
  const price = monthlyPrice(t);
  const fs: Record<FactorId, number> = {
    use_case: uc.f,
    works_with: ww.f,
    trust: trustFit(t),
    affordability: affordabilityFit(price, p.budget_usd),
    ease: easeFit(t, p.tech_comfort),
    reviews: reviewsFit(t),
  };
  const factors: Factor[] = (Object.keys(WEIGHTS) as FactorId[]).map((id) => ({
    id,
    label: FACTOR_LABELS[id],
    weight: WEIGHTS[id],
    f: fs[id],
    points: Math.round(WEIGHTS[id] * fs[id] * 10) / 10,
  }));
  const fit = Math.round(factors.reduce((s, f) => s + f.weight * f.f, 0));
  const scored: Scored = {
    tool: t,
    fit,
    factors,
    matched_tools: ww.matched,
    relevant_tools: ww.relevant,
    matched_use_case: uc.matched,
    price,
    over_budget_by: price !== null && price > p.budget_usd ? Math.round(price - p.budget_usd) : null,
    reasons: [],
    check_first: checkFirstReasons(t, p),
  };
  scored.reasons = buildReasons(scored, p);
  return scored;
}

/** Ties: higher fit, then higher trust, then lower price (unknown last), then name for stability. */
export function compareScored(a: Scored, b: Scored): number {
  if (b.fit !== a.fit) return b.fit - a.fit;
  const ta = trustFit(a.tool);
  const tb = trustFit(b.tool);
  if (tb !== ta) return tb - ta;
  const pa = a.price ?? Number.POSITIVE_INFINITY;
  const pb = b.price ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return a.tool.name.localeCompare(b.tool.name);
}

export type Recommendation = {
  ranked: Scored[];
  check_first: Scored[];
  best_by_use_case: Partial<Record<UseCaseId, string>>;
};

export function recommend(tools: Tool[], p: Profile, limit = 5): Recommendation {
  const all = tools
    .filter(isRecommendable)
    .map((t) => scoreTool(t, p))
    .filter((s): s is Scored => s !== null)
    .sort(compareScored);
  const ok = all.filter((s) => s.check_first.length === 0);
  const ranked = ok.slice(0, limit);

  // When the problem spans two use cases, make sure the best tool for each is in the list.
  const best_by_use_case: Partial<Record<UseCaseId, string>> = {};
  for (const uc of p.use_cases) {
    const best = ok.find((s) => s.tool.use_cases[0] === uc) ?? ok.find((s) => s.tool.use_cases.includes(uc));
    if (!best) continue;
    best_by_use_case[uc] = best.tool.id;
    if (!ranked.includes(best)) {
      if (ranked.length >= limit) {
        const keep = new Set(Object.values(best_by_use_case));
        const drop = ranked.findLastIndex((s) => !keep.has(s.tool.id));
        ranked.splice(drop, 1);
      }
      ranked.push(best);
      ranked.sort(compareScored);
    }
  }
  return { ranked, check_first: all.filter((s) => s.check_first.length > 0).slice(0, 5), best_by_use_case };
}
