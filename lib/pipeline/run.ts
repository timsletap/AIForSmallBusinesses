import { randomUUID } from "crypto";
import type { DiscoveryRun, Evidence, Tool } from "@/lib/schemas/tool";
import { canonicalUrl, homepageUrl, sameSite, slugify } from "@/lib/discovery/canonical";
import { disallowed, fetchPage, findKeyLinks, type FetchedPage } from "@/lib/discovery/fetchPage";
import { buildQuery, searchCandidates, type Candidate } from "@/lib/discovery/search";
import { carryForward, extract, validateExtraction, CITED_KEYS } from "@/lib/extraction/extract";
import type { Extraction } from "@/lib/extraction/schema";
import { runVendorChecks, trustLevel, checkWarnings } from "@/lib/verification/vendorChecks";
import { getStore } from "@/lib/storage/db";
import { INDUSTRY_IDS, type IndustryId } from "@/lib/taxonomy/industries";
import { USE_CASE_IDS, type UseCaseId } from "@/lib/taxonomy/useCases";
import { inferLowTechIntegrations, normalizeIntegrations } from "@/lib/taxonomy/tools";

export type Outcome = "new" | "updated" | "skipped" | "failed";
type Log = (msg: string) => void;

const KEY_FIELDS = ["description", "use_cases", "setup_steps"] as const;

/** Fields an admin has reviewed are never overwritten by the pipeline. */
const ADMIN_LOCKED: (keyof Tool)[] = [
  "name", "vendor", "description", "use_cases", "industries", "pricing", "integrations",
  "works_standalone", "integration_requirements", "setup_complexity", "setup_steps", "engagement", "evidence",
];

/** Run the whole pipeline for one candidate: fetch → extract → validate → verify → save. */
export async function processCandidate(
  cand: Candidate,
  log: Log,
  hints: { useCase?: UseCaseId; industry?: IndustryId } = {},
): Promise<{ outcome: Outcome; tool?: Tool }> {
  const home = homepageUrl(cand.url);
  if (!home) {
    log(`✗ ${cand.name}: bad URL ${cand.url}`);
    return { outcome: "failed" };
  }
  const store = getStore();
  const existing = await store.getToolByDomain(home);
  log(`→ ${cand.name} (${home}) ${existing ? "already in database, updating" : "new candidate"}`);

  const homepage = await fetchPage(home);
  if (!homepage) {
    log(`✗ ${cand.name}: ${(await disallowed(home)) ? "robots.txt asks bots not to read this site, skipped" : "homepage did not load"}`);
    return { outcome: "failed" };
  }
  if (!sameSite(homepage.finalUrl, home)) {
    log(`✗ ${cand.name}: redirected off-site to ${homepage.finalUrl}`);
    return { outcome: "skipped" };
  }
  const links = findKeyLinks(homepage);
  log(`  found pages: ${Object.keys(links).join(", ") || "none"}`);

  // Homepage + up to 3 linked pages, in priority order.
  const pages: FetchedPage[] = [homepage];
  for (const kind of ["pricing", "integrations", "security"] as const) {
    if (pages.length >= 4) break;
    const u = links[kind];
    if (!u || pages.some((p) => p.url === u)) continue;
    const p = await fetchPage(u);
    if (p) pages.push(p);
  }
  if (pages.length < 4 && links.privacy) {
    const p = await fetchPage(links.privacy);
    if (p) pages.push(p);
  }
  log(`  fetched ${pages.length} page(s)`);

  let ex: Extraction;
  try {
    ex = await extract(cand.name, pages.map((p) => ({ url: p.url, text: p.text })));
  } catch (e) {
    log(`✗ ${cand.name}: extraction failed (${(e as Error).message.slice(0, 120)})`);
    return { outcome: "failed" };
  }
  if (existing) {
    const carried = carryForward(ex, existing);
    if (carried.length) log(`  re-checking previous values: ${carried.join(", ")}`);
  }
  const { ex: v, dropped } = validateExtraction(ex, pages.map((p) => ({ url: p.url, text: p.text })));
  if (dropped.length) log(`  dropped unverified fields: ${dropped.join(", ")}`);

  const use_cases = ex.use_cases.filter((u): u is UseCaseId => (USE_CASE_IDS as readonly string[]).includes(u));
  // The use case we searched for becomes primary when the vendor pages support it.
  if (hints.useCase && use_cases.includes(hints.useCase)) use_cases.splice(0, 0, ...use_cases.splice(use_cases.indexOf(hints.useCase), 1));
  else if (hints.useCase && use_cases.length === 0) use_cases.push(hints.useCase);
  if (!use_cases.length) {
    log(`✗ ${cand.name}: doesn't match any of our problem types`);
    return { outcome: "skipped" };
  }
  const industries = ex.industries.filter((i): i is IndustryId => (INDUSTRY_IDS as readonly string[]).includes(i));

  const checks = runVendorChecks({
    name: ex.name || cand.name,
    homepage,
    links,
    fetchedUrls: pages.map((p) => p.url),
    vendor: v.vendor,
    contact: v.contact,
    security: v.security,
    price: v.price_monthly_min,
    freePlan: v.free_plan?.value ? v.free_plan : null,
  });

  const evidence: Record<string, Evidence> = {};
  for (const k of CITED_KEYS) {
    const c = v[k];
    if (c) evidence[k] = { source_url: c.source_url, quote: c.quote, claim_type: c.claim_type };
  }

  const pricing: Tool["pricing"] = {
    free_plan: v.free_plan?.value ?? null,
    free_trial_days: v.free_trial_days ? Math.round(v.free_trial_days.value) : null,
    est_monthly_usd_min: v.price_monthly_min?.value ?? (v.free_plan?.value ? 0 : null),
    est_monthly_usd_max: v.price_monthly_max?.value ?? null,
    plan_name: v.plan_name?.value ?? null,
    pricing_url: v.price_monthly_min?.source_url ?? links.pricing ?? null,
  };

  const missing: string[] = [];
  if (pricing.est_monthly_usd_min == null) missing.push("price");
  if (!v.integrations) missing.push("integrations");
  if (!ex.setup_steps.length) missing.push("setup_steps");
  if (!ex.setup_complexity) missing.push("setup_complexity");

  const adminReviewed = existing?.admin_reviewed ?? false;
  const level = trustLevel(checks, adminReviewed);
  const warnings = checkWarnings(checks);
  if (!v.integrations) warnings.push("The vendor's site doesn't say which apps it works with. Ask before buying.");

  const fresh: Tool = {
    id: existing?.id ?? randomUUID(),
    slug: existing?.slug ?? slugify(ex.name || cand.name),
    name: ex.name || cand.name,
    vendor: v.vendor?.value ?? null,
    canonical_url: canonicalUrl(home)!,
    description: ex.description,
    status: "draft",
    use_cases,
    industries,
    pricing,
    integrations: inferLowTechIntegrations(normalizeIntegrations(v.integrations?.value ?? []), ex.integration_requirements),
    works_standalone: v.works_standalone?.value ?? null,
    integration_requirements: ex.integration_requirements,
    setup_complexity: ex.setup_complexity,
    setup_steps: ex.setup_steps,
    engagement: ex.engagement,
    reviews: null,
    vendor_checks: checks,
    trust_level: level,
    warnings,
    evidence,
    missing_fields: missing,
    last_checked_at: new Date().toISOString(),
    admin_reviewed: adminReviewed,
  };

  // Admin-reviewed tools keep their reviewed fields; only checks and freshness refresh.
  const merged: Tool = existing?.admin_reviewed
    ? { ...fresh, ...Object.fromEntries(ADMIN_LOCKED.map((k) => [k, existing[k]])) }
    : fresh;

  const keyMissing = KEY_FIELDS.some((k) => !merged[k] || (Array.isArray(merged[k]) && !(merged[k] as unknown[]).length));
  merged.status =
    existing?.status === "rejected"
      ? "rejected"
      : level === "unverified" || keyMissing
        ? "draft"
        : "published";

  await store.saveTool(merged);
  log(
    `✓ ${merged.name}: ${merged.status}, trust ${level} (${Object.values(checks).filter((c) => c.pass).length}/6 checks), price ${pricing.est_monthly_usd_min ?? "unknown"}`,
  );
  return { outcome: existing ? "updated" : "new", tool: merged };
}

export type DiscoverInput = { query?: string; useCase?: UseCaseId; industry?: IndustryId; max?: number };

/** Search, then process up to `max` candidates. Records a discovery_runs row with the log. */
export async function runDiscovery(input: DiscoverInput, onLog?: Log): Promise<DiscoveryRun> {
  const query = input.query || buildQuery(input.useCase ?? "missed_calls", input.industry ?? "other");
  const run: DiscoveryRun = {
    id: randomUUID(),
    query: { query, use_case: input.useCase ?? null, industry: input.industry ?? null },
    status: "running",
    counts: { found: 0, new: 0, updated: 0, skipped: 0, failed: 0 },
    log: [],
    started_at: new Date().toISOString(),
    finished_at: null,
  };
  const log: Log = (m) => {
    run.log.push(m);
    onLog?.(m);
  };
  const store = getStore();
  await store.createRun(run);
  try {
    log(`search: "${query}"`);
    const cands = await searchCandidates(query, input.max ?? 3);
    run.counts.found = cands.length;
    log(`found ${cands.length} candidate(s): ${cands.map((c) => c.name).join(", ")}`);
    for (const c of cands) {
      try {
        const { outcome } = await processCandidate(c, log, { useCase: input.useCase, industry: input.industry });
        run.counts[outcome]++;
      } catch (e) {
        run.counts.failed++;
        log(`✗ ${c.name}: ${(e as Error).message.slice(0, 160)}`);
      }
    }
    run.status = "done";
  } catch (e) {
    run.status = "failed";
    log(`✗ run failed: ${(e as Error).message.slice(0, 200)}`);
  }
  run.finished_at = new Date().toISOString();
  await store.saveRun(run);
  return run;
}
