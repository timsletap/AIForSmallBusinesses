import { describe, expect, it } from "vitest";
import { builtInMatches } from "@/lib/builtins/match";
import type { BuiltInFeature } from "@/lib/builtins/schema";
import { profile } from "./fixtures";

const f = (over: Partial<BuiltInFeature>): BuiltInFeature => ({
  id: over.name ?? "x",
  platform: "square",
  name: "Feature",
  description: "Does a thing.",
  use_cases: ["missed_calls"],
  availability: "included",
  cost_note: null,
  how_to_start: [],
  source_url: "https://squareup.com/x",
  quote: "quote",
  last_checked_at: "2026-11-08T00:00:00Z",
  ...over,
});

describe("already in your tools", () => {
  const features = [
    f({ name: "Square Assistant", use_cases: ["missed_calls"] }),
    f({ name: "Square Marketing AI", use_cases: ["win_back"], availability: "paid_addon" }),
    f({ name: "QB Assist", platform: "quickbooks", use_cases: ["customer_list"] }),
    f({ name: "GBP replies", platform: "google_business_profile", use_cases: ["auto_replies"] }),
  ];

  it("only shows platforms the owner uses, for their problem", () => {
    const m = builtInMatches(features, profile({ current_tools: ["square", "phone_line"], use_cases: ["missed_calls"] }));
    expect(m).toHaveLength(1);
    expect(m[0].platform).toBe("square");
    expect(m[0].features.map((x) => x.name)).toEqual(["Square Assistant"]);
  });

  it("returns nothing when the owner uses none of the platforms", () => {
    expect(builtInMatches(features, profile({ current_tools: ["paper"] }))).toEqual([]);
  });

  it("orders by the owner's first problem, then included before paid add-ons", () => {
    const m = builtInMatches(
      [...features, f({ name: "Square Loyalty AI", use_cases: ["win_back"], availability: "included" })],
      profile({ current_tools: ["square", "quickbooks"], use_cases: ["customer_list", "win_back"] }),
    );
    expect(m.map((x) => x.platform)).toEqual(["quickbooks", "square"]);
    expect(m[1].features.map((x) => x.name)).toEqual(["Square Loyalty AI", "Square Marketing AI"]);
  });
});
