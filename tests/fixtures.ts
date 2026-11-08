import type { Profile } from "@/lib/schemas/profile";
import type { Tool, VendorChecks } from "@/lib/schemas/tool";

export function checks(passing: number): VendorChecks {
  const ids = ["official_site", "vendor_identity", "privacy_policy", "terms", "security_docs", "public_pricing"] as const;
  return Object.fromEntries(
    ids.map((id, i) => [id, { pass: i < passing, source_url: i < passing ? "https://x.com" : null, note: null }]),
  ) as VendorChecks;
}

export function tool(over: Partial<Tool> = {}): Tool {
  const name = over.name ?? "Test Tool";
  return {
    id: over.id ?? name.toLowerCase().replace(/\s+/g, "-"),
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    vendor: "Test Inc.",
    canonical_url: `https://${name.toLowerCase().replace(/\s+/g, "")}.com`,
    description: "Does a thing.",
    status: "published",
    use_cases: ["missed_calls"],
    industries: [],
    pricing: {
      free_plan: false,
      free_trial_days: null,
      est_monthly_usd_min: 30,
      est_monthly_usd_max: null,
      plan_name: null,
      pricing_url: null,
    },
    integrations: [],
    works_standalone: null,
    integration_requirements: [],
    setup_complexity: "low",
    setup_steps: ["Sign up"],
    engagement: "self_serve",
    reviews: null,
    vendor_checks: checks(6),
    trust_level: "checks_passed",
    warnings: [],
    evidence: {},
    missing_fields: [],
    last_checked_at: "2026-11-08T00:00:00Z",
    admin_reviewed: false,
    ...over,
  };
}

export function profile(over: Partial<Profile> = {}): Profile {
  return {
    use_cases: ["missed_calls"],
    industry: "restaurant",
    budget_usd: 50,
    current_tools: [],
    must_work_with: [],
    tech_comfort: "medium",
    ...over,
  };
}
