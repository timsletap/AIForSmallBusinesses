import { z } from "zod";
import { processCandidate } from "@/lib/pipeline/run";
import { parseLogLine, type DiscoverEvent } from "@/lib/pipeline/events";
import { resultFor } from "@/lib/pipeline/publicResult";
import { verifyCandidate } from "@/lib/pipeline/token";
import { getStore } from "@/lib/storage/db";
import { apiError, badInput } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
// One vendor: a homepage + up to 3 pages, one extraction, checks and a registry lookup.
export const maxDuration = 120;

const Body = z.object({
  runId: z.string().uuid(),
  name: z.string().min(1).max(120),
  url: z.string().url(),
  token: z.string().min(10).max(200),
});

/**
 * Public discovery, step 2 of 2: process ONE vendor from a signed search result (fetch → extract →
 * verify → save), streaming its steps as newline-delimited JSON, ending with its result card.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badInput(parsed.error);
  const { runId, name, url, token } = parsed.data;
  if (!verifyCandidate(runId, url, token)) return apiError(403, "bad_token", "This search has expired. Please search again.");

  const store = getStore();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: DiscoverEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const log: string[] = [];
      let current: { name: string; url: string } | null = null;
      let outcome: "new" | "updated" | "skipped" | "failed" = "failed";
      try {
        const r = await processCandidate({ name, url, found_via: "public discovery" }, (line) => {
          log.push(line);
          const e = parseLogLine(line, current);
          if (e?.type === "candidate") current = { name: e.name, url: e.url };
          if (e && e.type !== "result") send(e);
        });
        outcome = r.outcome;
        send(r.tool ? resultFor(r.tool) : { type: "result", name, status: r.outcome === "skipped" ? "skipped" : "failed", url, detail: log.at(-1)?.replace(/^✗ [^:]+: /, "") ?? "Couldn't read their site" });
      } catch (e) {
        send({ type: "result", name, status: "failed", url, detail: (e as Error).message.slice(0, 140) });
      } finally {
        // Record the outcome on the run (best effort; never blocks the result).
        try {
          const run = (await store.listRuns(60)).find((x) => x.id === runId);
          if (run) {
            run.counts[outcome]++;
            run.log.push(...log);
            run.status = "done";
            run.finished_at = new Date().toISOString();
            await store.saveRun(run);
          }
        } catch {
          // Run log is informational.
        }
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
