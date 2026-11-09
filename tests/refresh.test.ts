import { describe, expect, it } from "vitest";
import { daysSinceChecked, isStale, pickStalest } from "@/lib/pipeline/refresh";
import { tool } from "./fixtures";

const NOW = Date.parse("2026-12-10T00:00:00Z");

describe("scheduled refresh", () => {
  it("picks the tools checked longest ago, skipping rejected ones", () => {
    const tools = [
      tool({ name: "New", last_checked_at: "2026-12-09T00:00:00Z" }),
      tool({ name: "Old", last_checked_at: "2026-11-01T00:00:00Z" }),
      tool({ name: "Rejected", status: "rejected", last_checked_at: "2026-10-01T00:00:00Z" }),
      tool({ name: "Mid", last_checked_at: "2026-11-20T00:00:00Z" }),
    ];
    expect(pickStalest(tools, 2).map((t) => t.name)).toEqual(["Old", "Mid"]);
  });

  it("flags tools not checked for 30+ days as stale", () => {
    expect(daysSinceChecked({ last_checked_at: "2026-11-10T00:00:00Z" }, NOW)).toBe(30);
    expect(isStale({ last_checked_at: "2026-11-10T00:00:00Z" }, NOW)).toBe(true);
    expect(isStale({ last_checked_at: "2026-11-20T00:00:00Z" }, NOW)).toBe(false);
  });
});

describe("discovery rotation", () => {
  it("covers every use case × industry before repeating, then changes wording", async () => {
    const { rotationSlot } = await import("@/lib/pipeline/rotate");
    const pairs = 6 * 6;
    const seen = new Set(Array.from({ length: pairs }, (_, n) => `${rotationSlot(n).useCase}/${rotationSlot(n).industry}`));
    expect(seen.size).toBe(pairs);
    expect(rotationSlot(0).useCase).toBe(rotationSlot(pairs).useCase);
    expect(rotationSlot(0).query).not.toBe(rotationSlot(pairs).query);
  });
});
