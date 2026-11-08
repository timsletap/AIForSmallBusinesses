import { NextResponse } from "next/server";
import { z } from "zod";
import { runDiscovery } from "@/lib/pipeline/run";
import { getStore, storageMode } from "@/lib/storage/db";
import { INDUSTRY_IDS } from "@/lib/taxonomy/industries";
import { USE_CASE_IDS } from "@/lib/taxonomy/useCases";
import { apiError, badInput, isAdmin } from "@/lib/http/errors";

export const maxDuration = 300;

const Body = z
  .object({
    query: z.string().trim().max(300).optional(),
    use_case: z.enum(USE_CASE_IDS).optional(),
    industry: z.enum(INDUSTRY_IDS).optional(),
    max: z.number().int().min(1).max(3).default(3),
  })
  .refine((b) => b.query || b.use_case, { message: "Give a search query or a use case" });

export async function POST(req: Request) {
  if (!isAdmin(req)) return apiError(401, "unauthorized", "Wrong admin password.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badInput(parsed.error);
  const b = parsed.data;
  const run = await runDiscovery({ query: b.query, useCase: b.use_case, industry: b.industry, max: b.max });
  return NextResponse.json({ run, storage: storageMode() });
}

/** Admin dashboard data: all tools (any status) and recent runs. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return apiError(401, "unauthorized", "Wrong admin password.");
  const store = getStore();
  const [tools, runs] = await Promise.all([store.listTools(), store.listRuns(10)]);
  return NextResponse.json({ tools, runs, storage: storageMode() });
}
