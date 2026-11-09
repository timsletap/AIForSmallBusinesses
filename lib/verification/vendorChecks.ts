import { CHECK_IDS, type CheckId, type TrustLevel, type VendorChecks } from "@/lib/schemas/tool";
import { domainKey, slugify } from "@/lib/discovery/canonical";
import { findRealContact, hasRealContact } from "./contact";

export const CHECK_LABELS: Record<CheckId, string> = {
  official_site: "Official website",
  vendor_identity: "Contact details",
  privacy_policy: "Privacy policy",
  terms: "Terms of service",
  security_docs: "Security information",
  public_pricing: "Prices listed publicly",
};

const FAIL_WARNINGS: Record<CheckId, string> = {
  official_site: "We couldn't confirm this is the company's official website.",
  vendor_identity: "We couldn't find a phone number, email or address for this company on their site.",
  privacy_policy: "We couldn't find a privacy policy.",
  terms: "We couldn't find terms of service.",
  security_docs: "We couldn't find information about how they keep your data safe.",
  public_pricing: "Price isn't listed on the vendor's site. Ask before signing up.",
};

export type CheckInput = {
  name: string;
  homepage: { finalUrl: string; https: boolean; text: string } | null;
  links: Partial<Record<"pricing" | "privacy" | "terms" | "security" | "contact", string>>;
  fetchedUrls: string[];
  vendor: { value: string; source_url: string } | null;
  contact: { value: string; source_url: string } | null;
  security: { value: string; source_url: string } | null;
  price: { source_url: string } | null;
  freePlan: { source_url: string } | null;
};

/** Domain "matches the product" if the product name's first word (or its slug) appears in the domain. */
export function domainMatchesProduct(name: string, url: string): boolean {
  const d = (domainKey(url) ?? "").replace(/[^a-z0-9]/g, "");
  const parts = slugify(name).split("-").filter((p) => p.length >= 3 && !["the", "app", "inc"].includes(p));
  if (!parts.length) return false;
  return d.includes(parts.join("")) || parts.some((p) => d.includes(p));
}


export function runVendorChecks(i: CheckInput): VendorChecks {
  const home = i.homepage;
  const homeUrl = home?.finalUrl ?? null;
  // Demo screens on vendor homepages show sample callers; only real-looking contacts count.
  const contactMatch = home ? findRealContact(home.text) : null;
  const contact = (i.contact && hasRealContact(i.contact.value) ? i.contact.value : null) ?? contactMatch;
  const securityText = home && /\bSOC ?2\b|ISO ?27001|trust center|HIPAA|PCI[- ]DSS/i.exec(home.text);

  return {
    official_site: {
      pass: !!home && home.https && domainMatchesProduct(i.name, home.finalUrl),
      source_url: homeUrl,
      note: !home ? "Site did not load" : !home.https ? "Site is not secure (no HTTPS)" : null,
    },
    // The company name is always known (their own brand, or a legal name when stated); the check is
    // whether a real way to reach them is published.
    vendor_identity: {
      pass: !!contact,
      source_url: i.contact?.source_url ?? i.links.contact ?? homeUrl,
      note: [i.vendor?.value ?? i.name, contact ?? "no contact details found"].join(" · "),
    },
    privacy_policy: {
      pass: !!i.links.privacy,
      source_url: i.links.privacy ?? null,
      note: null,
    },
    terms: {
      pass: !!i.links.terms,
      source_url: i.links.terms ?? null,
      note: null,
    },
    security_docs: {
      pass: !!i.links.security || !!i.security || !!securityText,
      source_url: i.links.security ?? i.security?.source_url ?? (securityText ? homeUrl : null),
      note: i.security?.value ?? securityText?.[0] ?? null,
    },
    public_pricing: {
      pass: !!i.price || !!i.freePlan,
      source_url: i.price?.source_url ?? i.freePlan?.source_url ?? i.links.pricing ?? null,
      note: null,
    },
  };
}

export function passedCount(checks: VendorChecks): number {
  return CHECK_IDS.filter((c) => checks[c]?.pass).length;
}

export function trustLevel(checks: VendorChecks, adminReviewed: boolean): TrustLevel {
  const n = passedCount(checks);
  if (n >= 5) return adminReviewed ? "verified" : "checks_passed";
  if (n >= 3) return "partial";
  return "unverified";
}

export function checkWarnings(checks: VendorChecks): string[] {
  return CHECK_IDS.filter((c) => !checks[c]?.pass).map((c) => FAIL_WARNINGS[c]);
}

export const TRUST_BADGE: Record<TrustLevel, { label: string; tone: "green" | "blue" | "amber" | "gray" }> = {
  verified: { label: "Verified vendor", tone: "green" },
  checks_passed: { label: "Vendor checks passed", tone: "blue" },
  partial: { label: "Some checks missing", tone: "amber" },
  unverified: { label: "Not verified", tone: "gray" },
};

/** Every warning a failed check can produce (to tell them apart from other warnings). */
export const CHECK_WARNING_TEXTS = new Set(Object.values(FAIL_WARNINGS));
