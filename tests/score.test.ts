import { describe, expect, it } from "vitest";
import {
  affordabilityFit,
  easeFit,
  recommend,
  reviewsFit,
  scoreTool,
  trustFit,
  scoreUseCase,
  worksWithFit,
} from "@/lib/ranking/score";
import { checks, profile, tool } from "./fixtures";

describe("factor math", () => {
  it("use-case fit: primary 1.0, secondary 0.6, none 0", () => {
    const t = tool({ use_cases: ["missed_calls", "auto_replies"] });
    expect(scoreUseCase(t, ["missed_calls"]).f).toBe(1);
    expect(scoreUseCase(t, ["auto_replies"]).f).toBe(0.6);
    expect(scoreUseCase(t, ["win_back"]).f).toBe(0);
    expect(scoreUseCase(t, ["auto_replies", "missed_calls"]).matched).toBe("missed_calls");
  });

  it("works with: matched ÷ relevant, ignoring paper", () => {
    const t = tool({ integrations: ["square"] });
    expect(worksWithFit(t, profile({ current_tools: ["square", "quickbooks", "paper"] })).f).toBe(0.5);
    expect(worksWithFit(t, profile({ current_tools: ["square"] })).matched).toEqual(["square"]);
  });

  it("works with: no relevant tools → 1.0 standalone, else 0.5", () => {
    expect(worksWithFit(tool({ works_standalone: true }), profile({ current_tools: ["paper"] })).f).toBe(1);
    expect(worksWithFit(tool({ works_standalone: null }), profile()).f).toBe(0.5);
  });

  it("trust: checks ÷ 6, +0.1 admin reviewed, capped", () => {
    expect(trustFit(tool({ vendor_checks: checks(3) }))).toBeCloseTo(0.5);
    expect(trustFit(tool({ vendor_checks: checks(6), admin_reviewed: true }))).toBe(1);
    expect(trustFit(tool({ vendor_checks: checks(5), admin_reviewed: true }))).toBeCloseTo(5 / 6 + 0.1);
  });

  it("affordability: within budget 1, linear to 0 at 2x, unknown 0.4", () => {
    expect(affordabilityFit(50, 50)).toBe(1);
    expect(affordabilityFit(75, 50)).toBeCloseTo(0.5);
    expect(affordabilityFit(100, 50)).toBe(0);
    expect(affordabilityFit(500, 50)).toBe(0);
    expect(affordabilityFit(null, 50)).toBe(0.4);
    expect(affordabilityFit(0, 0)).toBe(1);
  });

  it("free plan counts as within budget", () => {
    const s = scoreTool(tool({ pricing: { ...tool().pricing, free_plan: true, est_monthly_usd_min: 200 } }), profile());
    expect(s?.factors.find((f) => f.id === "affordability")?.f).toBe(1);
  });

  it("ease: low/medium/high, high comfort floors at 0.6", () => {
    expect(easeFit(tool({ setup_complexity: "low" }), "low")).toBe(1);
    expect(easeFit(tool({ setup_complexity: "medium" }), "low")).toBe(0.6);
    expect(easeFit(tool({ setup_complexity: "high" }), "low")).toBe(0.2);
    expect(easeFit(tool({ setup_complexity: "high" }), "high")).toBe(0.6);
  });

  it("reviews: rating ÷ 5, unknown 0.5", () => {
    expect(reviewsFit(tool({ reviews: { rating: 4, count: 10, source_url: "x" } }))).toBeCloseTo(0.8);
    expect(reviewsFit(tool())).toBe(0.5);
  });

  it("fit = round(Σ weight × f); perfect tool scores 100", () => {
    const t = tool({
      integrations: ["square"],
      admin_reviewed: true,
      reviews: { rating: 5, count: 1, source_url: "x" },
    });
    expect(scoreTool(t, profile({ current_tools: ["square"] }))?.fit).toBe(100);
  });

  it("over budget shows the gap", () => {
    const s = scoreTool(tool({ pricing: { ...tool().pricing, est_monthly_usd_min: 79 } }), profile({ budget_usd: 50 }));
    expect(s?.over_budget_by).toBe(29);
    expect(s?.reasons.some((r) => r.includes("Over your budget by $29"))).toBe(true);
  });
});

describe("constraints", () => {
  it("never returns unpublished or unverified tools", () => {
    const r = recommend(
      [tool({ name: "Draft", status: "draft" }), tool({ name: "Unv", trust_level: "unverified" }), tool({ name: "Ok" })],
      profile(),
    );
    expect(r.ranked.map((s) => s.tool.name)).toEqual(["Ok"]);
    expect(r.check_first).toEqual([]);
  });

  it("drops tools with no use-case match", () => {
    expect(recommend([tool({ use_cases: ["win_back"] })], profile()).ranked).toEqual([]);
  });

  it("must_work_with missing → check first group", () => {
    const r = recommend([tool({ name: "A", integrations: [] })], profile({ must_work_with: ["square"] }));
    expect(r.ranked).toEqual([]);
    expect(r.check_first[0].tool.name).toBe("A");
  });

  it("low comfort + high setup → check first group", () => {
    const r = recommend([tool({ setup_complexity: "high" })], profile({ tech_comfort: "low" }));
    expect(r.check_first).toHaveLength(1);
    expect(r.ranked).toHaveLength(0);
  });

  it("over budget is not excluded", () => {
    const r = recommend([tool({ pricing: { ...tool().pricing, est_monthly_usd_min: 400 } })], profile());
    expect(r.ranked).toHaveLength(1);
  });
});

describe("ordering", () => {
  it("ties break on trust, then lower price", () => {
    const base = { vendor_checks: checks(5) };
    const cheap = tool({ name: "Cheap", ...base, pricing: { ...tool().pricing, est_monthly_usd_min: 10 } });
    const pricey = tool({ name: "Pricey", ...base, pricing: { ...tool().pricing, est_monthly_usd_min: 40 } });
    expect(recommend([pricey, cheap], profile()).ranked.map((s) => s.tool.name)).toEqual(["Cheap", "Pricey"]);

    const trusted = tool({ name: "Trusted", vendor_checks: checks(6), pricing: { ...tool().pricing, est_monthly_usd_min: 40 } });
    const s1 = scoreTool(trusted, profile())!;
    const s2 = scoreTool(pricey, profile())!;
    expect(s1.fit).toBeGreaterThanOrEqual(s2.fit);
  });

  it("is deterministic", () => {
    const tools = Array.from({ length: 8 }, (_, i) =>
      tool({ name: `T${i}`, pricing: { ...tool().pricing, est_monthly_usd_min: (i * 13) % 70 } }),
    );
    const a = recommend(tools, profile()).ranked.map((s) => s.tool.id);
    const b = recommend([...tools].reverse(), profile()).ranked.map((s) => s.tool.id);
    expect(a).toEqual(b);
  });

  it("two use cases include the best tool for each", () => {
    const tools = [
      ...Array.from({ length: 6 }, (_, i) => tool({ name: `List${i}`, use_cases: ["customer_list"] })),
      tool({ name: "WinBack", use_cases: ["win_back"], pricing: { ...tool().pricing, est_monthly_usd_min: 90 } }),
    ];
    const r = recommend(tools, profile({ use_cases: ["customer_list", "win_back"] }));
    expect(r.ranked).toHaveLength(5);
    expect(r.ranked.map((s) => s.tool.name)).toContain("WinBack");
    expect(r.best_by_use_case.win_back).toBe("winback");
  });

  it("returns 3 reasons", () => {
    const s = scoreTool(tool({ integrations: ["square"] }), profile({ current_tools: ["square", "phone_line"] }))!;
    expect(s.reasons).toHaveLength(3);
    expect(s.reasons[0]).toMatch(/Built for|Works with/);
  });
});

describe("break-even", () => {
  it("rounds up customers needed at a typical sale", async () => {
    const { breakEven } = await import("@/lib/ranking/reasons");
    expect(breakEven(49, "restaurant")).toMatch(/about 2 extra customers a month \(based on a typical \$25 order\)/);
    expect(breakEven(99, "hvac_plumbing")).toMatch(/about 1 extra customer a month/);
    expect(breakEven(0, "restaurant")).toBeNull();
    expect(breakEven(null, "restaurant")).toBeNull();
  });
});
