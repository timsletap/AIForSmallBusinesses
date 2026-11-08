import { NextResponse } from "next/server";
import { z } from "zod";
import { classify } from "@/lib/ranking/classify";
import { apiError, badInput } from "@/lib/http/errors";

const Body = z.object({ text: z.string().trim().min(3).max(2000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badInput(parsed.error);
  try {
    return NextResponse.json(await classify(parsed.data.text));
  } catch {
    return apiError(502, "classify_failed", "We couldn't read that right now. Please pick the problem closest to yours.");
  }
}
