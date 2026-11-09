import { NextResponse } from "next/server";
import { backfillTool } from "@/lib/pipeline/backfill";
import { getStore } from "@/lib/storage/db";
import { apiError, isAdmin } from "@/lib/http/errors";

export const maxDuration = 60;

/** Re-apply current deterministic rules to every stored tool (no fetching). Admin only; idempotent. */
export async function POST(req: Request) {
  if (!isAdmin(req)) return apiError(401, "unauthorized", "Wrong admin password.");
  const store = getStore();
  const tools = await store.listTools();
  const changed: string[] = [];
  for (const t of tools) {
    if (backfillTool(t)) {
      await store.saveTool(t);
      changed.push(t.name);
    }
  }
  return NextResponse.json({ checked: tools.length, changed });
}
