import { CHECK_IDS, type Tool } from "@/lib/schemas/tool";
import { MIN_DOMAIN_AGE_LABEL } from "@/lib/verification/domainAge";

export type ApprovalRule = { id: string; label: string; pass: boolean; detail: string };

/** The four rules a discovered tool must all pass to be added to the directory automatically. */
export const APPROVAL_RULES = [
  { id: "official_site", label: "Real, secure official website", detail: "Loads over HTTPS and the domain matches the product" },
  { id: "checks", label: "Passes 5 of 6 vendor checks", detail: "Contact details, privacy, terms, security, public pricing" },
  { id: "facts", label: "Key facts found on their site", detail: "What it does, which problem it solves, how to set it up" },
  { id: "track_record", label: `Website at least ${MIN_DOMAIN_AGE_LABEL} old`, detail: "Checked in the public domain registry" },
] as const;

const YOUNG = /website is only|couldn't confirm how long/i;

/** Evaluate the rules from a saved tool record, so what owners see matches what the pipeline decided. */
export function evaluateApproval(t: Tool): ApprovalRule[] {
  const passed = CHECK_IDS.filter((c) => t.vendor_checks[c]?.pass).length;
  const ageWarning = t.warnings.find((w) => YOUNG.test(w));
  const registered = t.vendor_checks.official_site?.note?.match(/registered in (\d{4})/)?.[1];
  const factsOk = !!t.description && t.use_cases.length > 0 && t.setup_steps.length > 0;
  return [
    { ...APPROVAL_RULES[0], pass: !!t.vendor_checks.official_site?.pass, detail: t.vendor_checks.official_site?.pass ? new URL(t.canonical_url).hostname : "Site didn't load securely or doesn't match the product" },
    { ...APPROVAL_RULES[1], pass: passed >= 5, detail: `${passed} of 6 passed` },
    { ...APPROVAL_RULES[2], pass: factsOk, detail: factsOk ? `${t.setup_steps.length} setup steps found` : "Couldn't find enough on their site" },
    {
      ...APPROVAL_RULES[3],
      pass: !ageWarning || t.admin_reviewed,
      detail: ageWarning ? ageWarning.replace(/^This company's website is only /, "Only ").replace(/, so there's little track record\.$/, "") : registered ? `Registered in ${registered}` : "Established",
    },
  ];
}
