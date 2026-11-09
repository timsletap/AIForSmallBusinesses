import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { searchCandidates } from "@/lib/discovery/search";
import { domainKey } from "@/lib/discovery/canonical";
import { signCandidate } from "@/lib/pipeline/token";
import { getStore } from "@/lib/storage/db";
import { apiError, badInput } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Every public search costs LLM + web-search credit, so it is capped per visitor and per day. */
const DAILY_PUBLIC_RUNS = 40;
const PER_VISITOR_WINDOW_MS = 10 * 60_000;
const PER_VISITOR_RUNS = 3;
const MAX_CANDIDATES = 3;
const recentByVisitor = new Map<string, number[]>();

const Body = z.object({ query: z.string().trim().min(3).max(160) });

/**
 * Public discovery, step 1 of 2: search the web and return new candidates (vendors not already in
 * the directory), each with a short-lived signed token. The browser then sends each candidate to
 * /api/discover/process, one vendor per request, so no single request can run out of time.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badInput(parsed.error);

  const visitor = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const mine = (recentByVisitor.get(visitor) ?? []).filter((t) => now - t < PER_VISITOR_WINDOW_MS);
  if (mine.length >= PER_VISITOR_RUNS) {
    return apiError(429, "slow_down", "You've run a few searches already. Please try again in about 10 minutes.");
  }
  const store = getStore();
  const today = new Date().toISOString().slice(0, 10);
  const runsToday = (await store.listRuns(DAILY_PUBLIC_RUNS + 10)).filter((r) => r.started_at.startsWith(today) && r.query.source === "public").length;
  if (runsToday >= DAILY_PUBLIC_RUNS) {
    return apiError(429, "daily_limit", "We've hit today's search limit. Browse the directory, or try again tomorrow.");
  }
  recentByVisitor.set(visitor, [...mine, now]);

  const query = `AI software for small businesses: ${parsed.data.query}`;
  try {
    const found = await searchCandidates(query, MAX_CANDIDATES * 3);
    const known = new Set((await store.listTools()).map((t) => domainKey(t.canonical_url)));
    const fresh = found.filter((c) => !known.has(domainKey(c.url))).slice(0, MAX_CANDIDATES);
    const runId = randomUUID();
    await store.createRun({
      id: runId,
      query: { query, source: "public" },
      status: "running",
      counts: { found: fresh.length, new: 0, updated: 0, skipped: found.length - fresh.length, failed: 0 },
      log: [`search: "${query}"`, `found ${fresh.length} new candidate(s): ${fresh.map((c) => c.name).join(", ") || "none"}`],
      started_at: new Date().toISOString(),
      finished_at: null,
    });
    return NextResponse.json({
      runId,
      skipped: found.length - fresh.length,
      candidates: fresh.map((c) => ({ name: c.name, url: c.url, token: signCandidate(runId, c.url) })),
    });
  } catch (e) {
    return apiError(502, "search_failed", `The web search didn't work right now: ${(e as Error).message.slice(0, 100)}`);
  }
}
