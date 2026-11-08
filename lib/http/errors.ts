import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function badInput(e: ZodError) {
  return apiError(400, "bad_input", e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
}

/** Admin routes: password in the x-admin-password header. */
export function isAdmin(req: Request): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && req.headers.get("x-admin-password") === pw;
}
