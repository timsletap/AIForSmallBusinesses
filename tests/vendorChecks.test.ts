import { describe, expect, it } from "vitest";
import { checkWarnings, domainMatchesProduct, runVendorChecks, trustLevel } from "@/lib/verification/vendorChecks";
import { quoteFound, validateExtraction } from "@/lib/extraction/extract";
import { Extraction } from "@/lib/extraction/schema";
import { recommend } from "@/lib/ranking/score";
import { checks, profile, tool } from "./fixtures";

describe("trust level thresholds", () => {
  it.each([
    [6, true, "verified"],
    [5, true, "verified"],
    [6, false, "checks_passed"],
    [5, false, "checks_passed"],
    [4, true, "partial"],
    [3, false, "partial"],
    [2, true, "unverified"],
    [0, false, "unverified"],
  ] as const)("%i checks, admin=%s → %s", (n, admin, level) => {
    expect(trustLevel(checks(n), admin)).toBe(level);
  });

  it("warns for each failed check in plain words", () => {
    const w = checkWarnings(checks(4));
    expect(w).toHaveLength(2);
    expect(w.join(" ")).toMatch(/Price isn't listed/);
  });
});

describe("recommend gate", () => {
  it("unverified tools are never returned, even when perfect otherwise", () => {
    const r = recommend([tool({ trust_level: "unverified", vendor_checks: checks(2) })], profile());
    expect(r.ranked).toHaveLength(0);
    expect(r.check_first).toHaveLength(0);
  });
});

describe("vendor checks", () => {
  const home = { finalUrl: "https://getjobber.com", https: true, text: "Contact us at hello@getjobber.com. SOC 2 Type II" };
  it("passes with full evidence", () => {
    const c = runVendorChecks({
      name: "Jobber",
      homepage: home,
      links: { privacy: "https://getjobber.com/privacy", terms: "https://getjobber.com/terms" },
      fetchedUrls: [],
      vendor: { value: "Jobber Software Inc.", source_url: home.finalUrl },
      contact: null,
      security: null,
      price: { source_url: "https://getjobber.com/pricing" },
      freePlan: null,
    });
    expect(Object.values(c).every((x) => x.pass)).toBe(true);
  });
  it("fails official site without https or a matching domain", () => {
    const c = runVendorChecks({
      name: "Jobber",
      homepage: { ...home, https: false },
      links: {},
      fetchedUrls: [],
      vendor: null,
      contact: null,
      security: null,
      price: null,
      freePlan: null,
    });
    expect(c.official_site.pass).toBe(false);
    expect(trustLevel(c, false)).toBe("unverified");
    expect(domainMatchesProduct("Housecall Pro", "https://housecallpro.com")).toBe(true);
    expect(domainMatchesProduct("Jobber", "https://randomsite.com")).toBe(false);
  });
});

describe("quote validation", () => {
  const pages = [{ url: "https://a.com/pricing", text: "Starter plan  $29 per month, billed monthly." }];
  it("finds exact quotes, whitespace-insensitive", () => {
    expect(quoteFound("Starter plan $29 per month", "https://a.com/pricing", pages)).toBe("https://a.com/pricing");
    expect(quoteFound("Starter plan $19 per month", "https://a.com/pricing", pages)).toBeNull();
  });
  it("nulls a price whose quote isn't on the page", () => {
    const ex = Extraction.parse({
      name: "A",
      description: "x",
      price_monthly_min: { value: 19, source_url: "https://a.com/pricing", quote: "only $19 a month", claim_type: "fact" },
      plan_name: { value: "Starter", source_url: "https://a.com/pricing", quote: "Starter plan", claim_type: "fact" },
    });
    const { ex: v, dropped } = validateExtraction(ex, pages);
    expect(v.price_monthly_min).toBeNull();
    expect(v.plan_name?.value).toBe("Starter");
    expect(dropped).toEqual(["price_monthly_min"]);
  });
  it("nulls a price whose number isn't in the quote", () => {
    const ex = Extraction.parse({
      name: "A",
      description: "x",
      price_monthly_min: { value: 49, source_url: "https://a.com/pricing", quote: "Starter plan $29 per month", claim_type: "fact" },
    });
    expect(validateExtraction(ex, pages).ex.price_monthly_min).toBeNull();
  });
});
