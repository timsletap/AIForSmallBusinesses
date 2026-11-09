import { promises as fs } from "fs";
import path from "path";
import { Client } from "pg";
import { Tool } from "@/lib/schemas/tool";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export function pgClient(): Client {
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL_NON_POOLING is not set");
  // Supabase requires TLS; its certificate chain isn't in Node's default store.
  return new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } });
}

/** Apply supabase/migrations/*.sql in order, once each. Returns a log line per file. */
export async function runMigrations(client: Client): Promise<string[]> {
  const log: string[] = [];
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())");
  // Not exposed through Supabase's public API.
  await client.query("alter table schema_migrations enable row level security");
  const applied = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));

  for (const file of (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) {
      log.push(`skip ${file} (already applied)`);
      continue;
    }
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      log.push(`applied ${file}`);
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  return log;
}

/** Copy the committed seed database (data/tools.json) into an empty tools table. */
export async function importSeedTools(client: Client): Promise<string> {
  const { rows } = await client.query<{ n: string }>("select count(*)::text as n from tools");
  if (Number(rows[0].n) > 0) return `skip import (tools table already has ${rows[0].n} rows)`;
  const tools = Tool.array().parse(JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "tools.json"), "utf8")));
  await client.query(
    `insert into tools select * from jsonb_populate_recordset(null::tools, $1::jsonb)`,
    [JSON.stringify(tools)],
  );
  return `imported ${tools.length} tools`;
}
