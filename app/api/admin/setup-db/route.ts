import { NextResponse } from "next/server";
import { importSeedTools, pgClient, runMigrations } from "@/lib/storage/migrate";
import { apiError, isAdmin } from "@/lib/http/errors";

export const maxDuration = 60;

/**
 * One-time database setup on the server, where the Supabase secrets live: applies migrations and
 * loads the committed seed tools into an empty table. Safe to call again (idempotent).
 */
export async function POST(req: Request) {
  if (!isAdmin(req)) return apiError(401, "unauthorized", "Wrong admin password.");
  const client = pgClient();
  try {
    await client.connect();
    const log = await runMigrations(client);
    log.push(await importSeedTools(client));
    return NextResponse.json({ ok: true, log });
  } catch (e) {
    return apiError(500, "setup_failed", (e as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}
