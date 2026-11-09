/**
 * Discover AI features built into platforms owners already use and write data/builtins.json.
 * Usage: npm run builtins                 (all platforms)
 *        npm run builtins -- square,shopify (only these; others are kept as they are)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { promises as fs } from "fs";
import { discoverPlatform, PLATFORM_SOURCES } from "@/lib/builtins/discover";
import { BuiltInFeature } from "@/lib/builtins/schema";
import type { ToolId } from "@/lib/taxonomy/tools";

const FILE = "data/builtins.json";

async function main() {
  const only = process.argv[2]?.split(",").filter(Boolean) as ToolId[] | undefined;
  const platforms = (Object.keys(PLATFORM_SOURCES) as ToolId[]).filter((p) => !only || only.includes(p));
  let existing: BuiltInFeature[] = [];
  try {
    existing = BuiltInFeature.array().parse(JSON.parse(await fs.readFile(FILE, "utf8")));
  } catch {
    // First run.
  }

  const fresh: BuiltInFeature[] = [];
  for (const p of platforms) {
    try {
      fresh.push(...(await discoverPlatform(p, (m) => console.log(m))));
    } catch (e) {
      console.log(`✗ ${p}: ${(e as Error).message.slice(0, 160)}`);
      // Keep what we had for a platform whose run failed.
      fresh.push(...existing.filter((f) => f.platform === p));
    }
  }
  const kept = existing.filter((f) => !platforms.includes(f.platform));
  const all = [...kept, ...fresh].sort((a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name));
  await fs.writeFile(FILE, JSON.stringify(all, null, 2) + "\n");
  console.log(`\n${all.length} built-in features saved to ${FILE}`);
  for (const p of Object.keys(PLATFORM_SOURCES)) console.log(`  ${p}: ${all.filter((f) => f.platform === p).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
