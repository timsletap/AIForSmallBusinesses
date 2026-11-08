/**
 * Re-apply deterministic post-processing rules to stored tools without re-fetching:
 * low-tech integration inference, "free demo is not a free plan", trust level and warnings.
 * Also copies data/tools.json into Supabase when run with --import-json and Supabase keys are set.
 * Usage: npx tsx scripts/backfill.ts [--import-json]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { promises as fs } from "fs";
import { Tool } from "@/lib/schemas/tool";
import { getStore, storageMode } from "@/lib/storage/db";
import { inferLowTechIntegrations } from "@/lib/taxonomy/tools";
import { CHECK_WARNING_TEXTS, checkWarnings, trustLevel } from "@/lib/verification/vendorChecks";

async function main() {
  const store = getStore();
  const tools = process.argv.includes("--import-json")
    ? Tool.array().parse(JSON.parse(await fs.readFile("data/tools.json", "utf8")))
    : await store.listTools();

  let changed = 0;
  for (const t of tools) {
    const before = JSON.stringify(t);
    t.integrations = inferLowTechIntegrations(t.integrations, t.integration_requirements);
    const fp = t.evidence.free_plan;
    if (t.pricing.free_plan && fp && /\b(demo|trial)\b/i.test(fp.quote)) {
      t.pricing.free_plan = null;
      delete t.evidence.free_plan;
    }
    t.trust_level = trustLevel(t.vendor_checks, t.admin_reviewed);
    const other = t.warnings.filter((w) => !CHECK_WARNING_TEXTS.has(w));
    t.warnings = [...checkWarnings(t.vendor_checks), ...other];
    if (!t.evidence.integrations && !t.warnings.some((w) => w.includes("which apps"))) {
      t.warnings.push("The vendor's site doesn't say which apps it works with. Ask before buying.");
    }
    if (t.trust_level === "unverified" && t.status === "published") t.status = "draft";
    if (JSON.stringify(t) !== before || process.argv.includes("--import-json")) {
      await store.saveTool(t);
      changed++;
    }
  }
  console.log(`storage=${storageMode()} tools=${tools.length} saved=${changed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
