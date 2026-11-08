import { NextResponse } from "next/server";
import { Profile } from "@/lib/schemas/profile";
import { recommend } from "@/lib/ranking/score";
import { getStore } from "@/lib/storage/db";
import { apiError, badInput } from "@/lib/http/errors";

export async function POST(req: Request) {
  const parsed = Profile.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badInput(parsed.error);
  try {
    const tools = await getStore().listTools({ status: "published" });
    const r = recommend(tools, parsed.data);
    const slim = (s: (typeof r.ranked)[number]) => ({
      id: s.tool.id,
      slug: s.tool.slug,
      name: s.tool.name,
      description: s.tool.description,
      fit: s.fit,
      factors: s.factors,
      reasons: s.reasons,
      price_per_month: s.price,
      over_budget_by: s.over_budget_by,
      trust_level: s.tool.trust_level,
      warnings: s.tool.warnings,
      check_first: s.check_first,
    });
    return NextResponse.json({
      ranked: r.ranked.map(slim),
      check_first: r.check_first.map(slim),
      best_by_use_case: r.best_by_use_case,
    });
  } catch {
    return apiError(500, "recommend_failed", "We couldn't load recommendations. Please try again.");
  }
}
