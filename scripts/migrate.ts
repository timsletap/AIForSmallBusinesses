/**
 * Apply supabase/migrations/*.sql and, with --import, load data/tools.json into an empty tools table.
 * Usage: npm run migrate [-- --import]   (needs POSTGRES_URL_NON_POOLING in .env.local)
 * On Vercel, where the Supabase secrets live, use POST /api/admin/setup-db instead.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { importSeedTools, pgClient, runMigrations } from "@/lib/storage/migrate";

async function main() {
  const client = pgClient();
  await client.connect();
  try {
    for (const line of await runMigrations(client)) console.log(line);
    if (process.argv.includes("--import")) console.log(await importSeedTools(client));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
