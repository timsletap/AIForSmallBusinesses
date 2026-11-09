import type { Tool } from "@/lib/schemas/tool";
import { CHECK_IDS } from "@/lib/schemas/tool";
import { evaluateApproval, type ApprovalRule } from "./approval";
import type { DiscoverEvent } from "./events";

/** Short reason a rule failed, e.g. "only 3 of 6 vendor checks", "website only about 3 months old". */
export function failedReason(r: ApprovalRule): string {
  if (r.id === "checks") return `only ${r.detail.replace(" passed", "")} vendor checks`;
  if (r.id === "track_record") return `website ${r.detail.charAt(0).toLowerCase()}${r.detail.slice(1)}`;
  if (r.id === "facts") return "not enough facts on their site";
  return "website didn't check out";
}

/** The result card for one processed vendor, built from what was actually saved. */
export function resultFor(t: Tool): Extract<DiscoverEvent, { type: "result" }> {
  const rules = evaluateApproval(t);
  const failed = rules.filter((x) => !x.pass);
  const price = t.pricing.free_plan ? 0 : t.pricing.est_monthly_usd_min;
  return {
    type: "result",
    name: t.name,
    status: t.status,
    slug: t.status === "published" ? t.slug : undefined,
    url: t.canonical_url,
    description: t.description,
    checks: CHECK_IDS.filter((c) => t.vendor_checks[c]?.pass).length,
    price: price === null ? "Price not listed" : price === 0 ? "Free plan" : `From $${price}/month`,
    rules,
    detail:
      t.status === "published"
        ? "Passed all four rules and was added to the directory"
        : failed.length
          ? `Held back: ${failed.map(failedReason).join(" · ")}`
          : "Held for a human to review",
  };
}
