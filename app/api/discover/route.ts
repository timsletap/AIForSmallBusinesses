import { z } from "zod";
import { runDiscovery } from "@/lib/pipeline/run";
import { parseLogLine, type DiscoverEvent } from "@/lib/pipeline/events";
import { buildQuery } from "@/lib/discovery/search";
import { getStore } from "@/lib/storage/db";
import { domainKey } from "@/lib/discovery/canonical";
import { USE_CASE_IDS } from "@/lib/taxonomy/useCases";
import { INDUSTRY_IDS } from "@/lib/taxonomy/industries";
import { apiError, badInput } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Every public search costs LLM + web-search credit, so it is capped per visitor and per day. */
const DAILY_PUBLIC_RUNS = 40;
const PER_VISITOR_WINDOW_MS = 10 * 60_000;
const PER_VISITOR_RUNS = 3;
const recentByVisitor = new Map<string, number[]>();

const Body = z
  .object({
    query: z.string().trim().min(3).max(160).optional(),
    use_case: z.enum(USE_CASE_IDS).optional(),
    industry: z.enum(INDUSTRY_IDS).optional(),
  })
  .refine((b) => b.query || b.use_case, { message: "Tell us what you need AI for" });

/**
 * Public "Discover new tools": searches the web, extracts facts from official sites, runs vendor
 * checks and adds approved tools to the directory, streaming each step as newline-delimited JSON.
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
  const today = new Date().toISOString().slice(0, 10);
  const runsToday = (await getStore().listRuns(DAILY_PUBLIC_RUNS + 10)).filter(
    (r) => r.started_at.startsWith(today) && r.query.source === "public",
  ).length;
  if (runsToday >= DAILY_PUBLIC_RUNS) {
    return apiError(429, "daily_limit", "We've hit today's search limit. Browse the directory, or try again tomorrow.");
  }
  recentByVisitor.set(visitor, [...mine, now]);

  const b = parsed.data;
  const query = b.query ? `AI software for small businesses: ${b.query}` : buildQuery(b.use_case!, b.industry ?? "other");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: DiscoverEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let current: { name: string; url: string } | null = null;
      const results: Extract<DiscoverEvent, { type: "result" }>[] = [];
      try {
        const run = await runDiscovery(
          { query, useCase: b.use_case, industry: b.industry, max: 3, onlyNew: true, source: "public" },
          (line) => {
            const e = parseLogLine(line, current);
            if (!e) return;
            if (e.type === "candidate") current = { name: e.name, url: e.url };
            if (e.type === "result") results.push(e);
            if (e.type !== "result") send(e);
          },
        );
        // Attach directory links and the plain reason a tool was held.
        const tools = await getStore().listTools();
        for (const r of results) {
          const t = tools.find((x) => x.name === r.name) ?? null;
          if (t) {
            r.slug = t.status === "published" ? t.slug : undefined;
            if (t.status !== "published") r.detail = t.warnings[0] ?? r.detail;
          }
          send(r);
        }
        const approved = results.filter((r) => r.status === "published").length;
        send({
          type: "done",
          approved,
          held: results.length - approved,
          message:
            run.counts.found === 0
              ? "No new tools this time: everything we found is already in the directory."
              : `${approved} new tool${approved === 1 ? "" : "s"} added to the directory.`,
        });
      } catch (e) {
        send({ type: "error", message: `Discovery stopped: ${(e as Error).message.slice(0, 120)}` });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

/** Newest tools in the directory, for the "Recently discovered" feed. */
export async function GET() {
  const tools = (await getStore().listTools({ status: "published" }))
    .sort((a, b) => b.last_checked_at.localeCompare(a.last_checked_at))
    .slice(0, 8)
    .map((t) => ({ name: t.name, slug: t.slug, domain: domainKey(t.canonical_url), use_case: t.use_cases[0], checked: t.last_checked_at }));
  return Response.json({ tools });
}
