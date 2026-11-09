import { randomUUID } from "crypto";
import type { DiscoveryRun, Tool } from "@/lib/schemas/tool";
import { getStore } from "@/lib/storage/db";
import { processCandidate } from "./run";

export const STALE_DAYS = 30;

export function daysSinceChecked(t: Pick<Tool, "last_checked_at">, now = Date.now()): number {
  return Math.floor((now - new Date(t.last_checked_at).getTime()) / 86_400_000);
}

export const isStale = (t: Pick<Tool, "last_checked_at">, now = Date.now()) => daysSinceChecked(t, now) >= STALE_DAYS;

/** The `n` non-rejected tools checked longest ago. */
export function pickStalest(tools: Tool[], n: number): Tool[] {
  return tools
    .filter((t) => t.status !== "rejected")
    .sort((a, b) => a.last_checked_at.localeCompare(b.last_checked_at) || a.slug.localeCompare(b.slug))
    .slice(0, n);
}

/**
 * Re-run the pipeline on the stalest tools: refreshes prices, checks, trust and last_checked_at.
 * Idempotent (running twice just re-checks again) and never overwrites admin-reviewed fields.
 */
export async function refreshStalest(n = 3): Promise<DiscoveryRun> {
  const store = getStore();
  const run: DiscoveryRun = {
    id: randomUUID(),
    query: { query: `refresh ${n} stalest tools` },
    status: "running",
    counts: { found: 0, new: 0, updated: 0, skipped: 0, failed: 0 },
    log: [],
    started_at: new Date().toISOString(),
    finished_at: null,
  };
  await store.createRun(run);
  const picked = pickStalest(await store.listTools(), n);
  run.counts.found = picked.length;
  run.log.push(`refreshing: ${picked.map((t) => `${t.name} (${daysSinceChecked(t)}d old)`).join(", ") || "nothing"}`);
  for (const t of picked) {
    try {
      const { outcome } = await processCandidate(
        { name: t.name, url: t.canonical_url, found_via: "scheduled refresh" },
        (m) => run.log.push(m),
        { useCase: t.use_cases[0] },
      );
      run.counts[outcome]++;
    } catch (e) {
      run.counts.failed++;
      run.log.push(`✗ ${t.name}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  run.status = "done";
  run.finished_at = new Date().toISOString();
  await store.saveRun(run);
  return run;
}
