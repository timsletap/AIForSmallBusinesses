import { NextResponse } from "next/server";
import { refreshStalest } from "@/lib/pipeline/refresh";
import { apiError, isAdmin } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily Vercel cron (vercel.json) sends `Authorization: Bearer $CRON_SECRET`. Admins can also trigger it. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron && !isAdmin(req)) return apiError(401, "unauthorized", "Not allowed.");
  const run = await refreshStalest(3);
  return NextResponse.json({ run });
}
