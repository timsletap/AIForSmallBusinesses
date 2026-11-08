import { z } from "zod";
import { INDUSTRY_IDS } from "@/lib/taxonomy/industries";
import { TOOL_IDS } from "@/lib/taxonomy/tools";
import { USE_CASE_IDS } from "@/lib/taxonomy/useCases";

export const CheckId = z.enum([
  "official_site",
  "vendor_identity",
  "privacy_policy",
  "terms",
  "security_docs",
  "public_pricing",
]);
export type CheckId = z.infer<typeof CheckId>;
export const CHECK_IDS = CheckId.options;

export const VendorCheck = z.object({
  pass: z.boolean(),
  source_url: z.string().nullable(),
  note: z.string().nullable(),
});
export type VendorCheck = z.infer<typeof VendorCheck>;
export const VendorChecks = z.record(CheckId, VendorCheck);
export type VendorChecks = Record<CheckId, VendorCheck>;

export const TrustLevel = z.enum(["verified", "checks_passed", "partial", "unverified"]);
export type TrustLevel = z.infer<typeof TrustLevel>;

export const Pricing = z.object({
  free_plan: z.boolean().nullable(),
  free_trial_days: z.number().int().min(0).max(365).nullable(),
  est_monthly_usd_min: z.number().min(0).max(5000).nullable(),
  est_monthly_usd_max: z.number().min(0).max(5000).nullable(),
  plan_name: z.string().nullable(),
  pricing_url: z.string().nullable(),
});
export type Pricing = z.infer<typeof Pricing>;

export const Evidence = z.object({
  source_url: z.string(),
  quote: z.string(),
  claim_type: z.enum(["fact", "vendor_claim"]),
});
export type Evidence = z.infer<typeof Evidence>;

export const Reviews = z.object({
  rating: z.number().min(0).max(5),
  count: z.number().int().min(0),
  source_url: z.string(),
});

export const Tool = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  vendor: z.string().nullable(),
  canonical_url: z.string(),
  description: z.string(),
  status: z.enum(["draft", "published", "rejected"]),
  use_cases: z.array(z.enum(USE_CASE_IDS)),
  industries: z.array(z.enum(INDUSTRY_IDS)),
  pricing: Pricing,
  integrations: z.array(z.enum(TOOL_IDS)),
  works_standalone: z.boolean().nullable(),
  integration_requirements: z.array(z.string()),
  setup_complexity: z.enum(["low", "medium", "high"]).nullable(),
  setup_steps: z.array(z.string()),
  engagement: z.enum(["self_serve", "free_trial", "book_demo", "needs_setup_help"]).nullable(),
  reviews: Reviews.nullable(),
  vendor_checks: VendorChecks,
  trust_level: TrustLevel,
  warnings: z.array(z.string()),
  evidence: z.record(z.string(), Evidence),
  missing_fields: z.array(z.string()),
  last_checked_at: z.string(),
  admin_reviewed: z.boolean(),
});
export type Tool = z.infer<typeof Tool>;

export const DiscoveryRun = z.object({
  id: z.string(),
  query: z.record(z.string(), z.unknown()),
  status: z.enum(["running", "done", "failed"]),
  counts: z.object({
    found: z.number(),
    new: z.number(),
    updated: z.number(),
    skipped: z.number(),
    failed: z.number(),
  }),
  log: z.array(z.string()),
  started_at: z.string(),
  finished_at: z.string().nullable(),
});
export type DiscoveryRun = z.infer<typeof DiscoveryRun>;
