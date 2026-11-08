/**
 * Prepopulate the database by running the discovery pipeline over:
 *   1. a starter list of well-known vendor homepages (names only; every fact is extracted from their pages), then
 *   2. search queries for each use case × its most relevant industries.
 * Usage: npm run seed            (all)
 *        npm run seed -- --search-only | --list-only | --only=Jobber,HubSpot
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { processCandidate, runDiscovery } from "@/lib/pipeline/run";
import { getStore } from "@/lib/storage/db";
import { SEED_INDUSTRIES, type IndustryId } from "@/lib/taxonomy/industries";
import { USE_CASES, type UseCaseId } from "@/lib/taxonomy/useCases";

const STARTER: { name: string; url: string; useCase: UseCaseId }[] = [
  { name: "Goodcall", url: "https://goodcall.com", useCase: "missed_calls" },
  { name: "Smith.ai", url: "https://smith.ai", useCase: "missed_calls" },
  { name: "Slang.ai", url: "https://slang.ai", useCase: "missed_calls" },
  { name: "Rosie", url: "https://heyrosie.com", useCase: "missed_calls" },
  { name: "Vagaro", url: "https://vagaro.com", useCase: "booking_waitlist" },
  { name: "Waitwhile", url: "https://waitwhile.com", useCase: "booking_waitlist" },
  { name: "Booksy", url: "https://booksy.com", useCase: "booking_waitlist" },
  { name: "Fresha", url: "https://fresha.com", useCase: "booking_waitlist" },
  { name: "Podium", url: "https://podium.com", useCase: "auto_replies" },
  { name: "Birdeye", url: "https://birdeye.com", useCase: "auto_replies" },
  { name: "Tidio", url: "https://tidio.com", useCase: "auto_replies" },
  { name: "ManyChat", url: "https://manychat.com", useCase: "auto_replies" },
  { name: "Less Annoying CRM", url: "https://lessannoyingcrm.com", useCase: "customer_list" },
  { name: "Capsule CRM", url: "https://capsulecrm.com", useCase: "customer_list" },
  { name: "HubSpot", url: "https://hubspot.com", useCase: "customer_list" },
  { name: "Mailchimp", url: "https://mailchimp.com", useCase: "win_back" },
  { name: "Constant Contact", url: "https://constantcontact.com", useCase: "win_back" },
  { name: "SimpleTexting", url: "https://simpletexting.com", useCase: "win_back" },
  { name: "Jobber", url: "https://getjobber.com", useCase: "scheduling_dispatch" },
  { name: "Housecall Pro", url: "https://housecallpro.com", useCase: "scheduling_dispatch" },
  { name: "Workiz", url: "https://workiz.com", useCase: "scheduling_dispatch" },
  { name: "FieldPulse", url: "https://fieldpulse.com", useCase: "scheduling_dispatch" },
];

async function main() {
  const args = process.argv.slice(2);
  const log = (m: string) => console.log(m);

  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  if (!args.includes("--search-only")) {
    for (const s of STARTER.filter((x) => !only || only.includes(x.name))) {
      try {
        await processCandidate({ name: s.name, url: s.url, found_via: "starter list" }, log, { useCase: s.useCase });
      } catch (e) {
        console.log(`✗ ${s.name}: ${(e as Error).message}`);
      }
    }
  }

  if (!args.includes("--list-only") && !only) {
    for (const uc of USE_CASES) {
      for (const industry of SEED_INDUSTRIES[uc.id] as IndustryId[]) {
        const run = await runDiscovery({ useCase: uc.id, industry, max: 3 }, log);
        console.log(`  run ${uc.id} × ${industry}:`, run.counts);
      }
    }
  }

  const tools = await getStore().listTools({ status: "published" });
  console.log(`\nPublished tools: ${tools.length}`);
  for (const uc of USE_CASES) {
    const n = tools.filter((t) => t.use_cases[0] === uc.id).length;
    const any = tools.filter((t) => t.use_cases.includes(uc.id)).length;
    console.log(`  ${uc.id}: ${n} primary, ${any} total`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
