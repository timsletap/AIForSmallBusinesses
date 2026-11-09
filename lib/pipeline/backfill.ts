import type { Tool } from "@/lib/schemas/tool";
import { findRealContact } from "@/lib/verification/contact";
import { CHECK_WARNING_TEXTS, checkWarnings, trustLevel } from "@/lib/verification/vendorChecks";

/** Warning wording retired by later rule changes; removed from stored tools on backfill. */
const RETIRED_WARNINGS = new Set(["We couldn't find the company's name and a way to contact them."]);

/**
 * Re-apply the current deterministic rules to a stored tool without re-fetching anything:
 * the contact-details check (a real phone/email/address; the company name never fails it),
 * check warnings, and trust level. Returns true if anything changed.
 */
export function backfillTool(t: Tool): boolean {
  const before = JSON.stringify(t);
  const c = t.vendor_checks.vendor_identity;
  const contact = findRealContact(c?.note ?? "") ?? (t.evidence.contact ? findRealContact(t.evidence.contact.quote) : null);
  t.vendor_checks.vendor_identity = {
    pass: !!contact,
    source_url: c?.source_url ?? t.canonical_url,
    note: `${t.vendor ?? t.name} · ${contact ?? "no contact details found"}`,
  };
  // Same order the pipeline uses: track-record warning first, then check warnings, then the rest.
  const other = t.warnings.filter((w) => !CHECK_WARNING_TEXTS.has(w) && !RETIRED_WARNINGS.has(w));
  const young = (w: string) => /website is only|couldn't confirm how long/i.test(w);
  t.warnings = [...other.filter(young), ...checkWarnings(t.vendor_checks), ...other.filter((w) => !young(w))];
  t.trust_level = trustLevel(t.vendor_checks, t.admin_reviewed);
  // A vendor that falls to unverified can never stay listed.
  if (t.trust_level === "unverified" && t.status === "published") t.status = "draft";
  return JSON.stringify(t) !== before;
}
