import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/pipeline/run";
import { dayNumber, rotationSlot } from "@/lib/pipeline/rotate";
import { apiError, isAdmin } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily discovery (vercel.json cron): searches the next problem × business-type slot with fresh
 * wording and processes only vendors not already in the database. Admins can trigger it too.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron && !isAdmin(req)) return apiError(401, "unauthorized", "Not allowed.");
  // Admin runs move to the next slot so repeated clicks keep exploring.
  const n = dayNumber() + (fromCron ? 0 : Math.floor(Date.now() / 60_000) % 997);
  const slot = rotationSlot(n);
  const run = await runDiscovery({ query: slot.query, useCase: slot.useCase, industry: slot.industry, max: 3, onlyNew: true, source: "cron" });
  return NextResponse.json({ run, slot });
}
