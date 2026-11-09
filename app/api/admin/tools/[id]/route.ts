import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/storage/db";
import { checkWarnings, trustLevel } from "@/lib/verification/vendorChecks";
import { apiError, badInput, isAdmin } from "@/lib/http/errors";
import { processCandidate } from "@/lib/pipeline/run";

export const maxDuration = 120;

const Body = z.object({ action: z.enum(["verify", "unverify", "reject", "recheck"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return apiError(401, "unauthorized", "Wrong admin password.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badInput(parsed.error);
  const { id } = await ctx.params;
  const store = getStore();
  const tool = await store.getTool(id);
  if (!tool) return apiError(404, "not_found", "No tool with that id.");

  if (parsed.data.action === "recheck") {
    // Re-run the pipeline on this vendor now (same as the daily refresh, for one tool).
    const log: string[] = [];
    const r = await processCandidate({ name: tool.name, url: tool.canonical_url, found_via: "admin re-check" }, (m) => log.push(m), {
      useCase: tool.use_cases[0],
    });
    return NextResponse.json({ tool: r.tool ?? (await store.getTool(id)), log });
  }

  if (parsed.data.action === "reject") {
    tool.status = "rejected";
  } else if (parsed.data.action === "unverify") {
    // Undo a hand check: trust falls back to what the automated checks alone support.
    tool.admin_reviewed = false;
    tool.trust_level = trustLevel(tool.vendor_checks, false);
    if (tool.trust_level === "unverified") tool.status = "draft";
  } else {
    tool.admin_reviewed = true;
    tool.trust_level = trustLevel(tool.vendor_checks, true);
    // An admin can publish a draft, but never an unverified vendor.
    tool.status = tool.trust_level === "unverified" ? "draft" : "published";
    tool.warnings = [...new Set([...checkWarnings(tool.vendor_checks), ...tool.warnings])];
  }
  await store.saveTool(tool);
  return NextResponse.json({ tool });
}
