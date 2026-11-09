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

describe("admin unverify", () => {
  it("drops verified back to checks_passed with the same checks", () => {
    expect(trustLevel(checks(6), true)).toBe("verified");
    expect(trustLevel(checks(6), false)).toBe("checks_passed");
  });
});

describe("refresh carry-forward", () => {
  it("keeps a previous price only if its quote is still on the vendor's page", async () => {
    const { carryForward } = await import("@/lib/extraction/extract");
    const prev = tool({
      pricing: { ...tool().pricing, est_monthly_usd_min: 29 },
      evidence: { price_monthly_min: { source_url: "https://a.com/pricing", quote: "Starter plan $29 per month", claim_type: "fact" } },
    });
    const fresh = () => Extraction.parse({ name: "A", description: "x" });

    const still = fresh();
    expect(carryForward(still, prev)).toEqual(["price_monthly_min"]);
    const samePages = [{ url: "https://a.com/pricing", text: "Starter plan  $29 per month, billed monthly." }];
    expect(validateExtraction(still, samePages).ex.price_monthly_min?.value).toBe(29);

    const changed = fresh();
    carryForward(changed, prev);
    const newPages = [{ url: "https://a.com/pricing", text: "Starter plan $39 per month" }];
    expect(validateExtraction(changed, newPages).ex.price_monthly_min).toBeNull();
  });

  it("never overrides a value the new extraction found", async () => {
    const { carryForward } = await import("@/lib/extraction/extract");
    const prev = tool({
      vendor: "Old Inc.",
      evidence: { vendor: { source_url: "https://a.com", quote: "Old Inc.", claim_type: "fact" } },
    });
    const ex = Extraction.parse({ name: "A", description: "x", vendor: { value: "New Inc.", source_url: "https://a.com", quote: "New Inc." } });
    expect(carryForward(ex, prev)).toEqual([]);
    expect(ex.vendor?.value).toBe("New Inc.");
  });
});

describe("quotes must support their values (real failures from the live data)", () => {
  it("reads page elements with spaces between them", async () => {
    const { htmlToText } = await import("@/lib/discovery/fetchPage");
    expect(htmlToText("<body><h3>Starter</h3><p>$79 a month</p><a>Login</a><span>412-569-0026</span></body>")).toBe(
      "Starter $79 a month Login 412-569-0026",
    );
  });

  it("shows the page's own spacing for a run-together quote", async () => {
    const { locateQuote } = await import("@/lib/extraction/extract");
    expect(locateQuote("Professional$49per month", "Plans: Professional $49 per month For solo owners")).toBe("Professional $49 per month");
    expect(locateQuote("Enterprise $999", "Professional $49 per month")).toBeNull();
  });

  it.each([
    ["plan_name", "Core, Connect, Grow, Plus", "We recommend the Connect plan for you.", false],
    ["plan_name", "Starter", "Our Starter plan gives you:", true],
    ["free_plan", true, "For solo operators just getting started.", false],
    ["free_plan", true, "25 calls / month, free forever", true],
    ["free_plan", true, "Start your free trial", false],
    ["free_trial_days", 14, "Try Capsule free for 14 days.", true],
    ["free_trial_days", 30, "Try Capsule free for 14 days.", false],
    ["security", "x", "Privacy Policy Terms of Service Trust Center Careers", true],
    ["security", "x", "Give us a call and we'll walk you through it.", false],
    ["contact", "x", "Give us a call and we'll walk you through it.", false],
    ["contact", "x", "Call us toll free: 1-888-721-1115", true],
    ["vendor", "Birdeye Inc", "© 2026 Birdeye Inc", true],
    ["vendor", "The Rocket Science Group", "Mailchimp® is a registered trademark of The Rocket Science Group.", true],
    ["vendor", "Acme Inc", "© 2026 Other Co", false],
  ] as const)("%s = %j with %j → %s", async (key, value, quote, ok) => {
    const { quoteSupports } = await import("@/lib/extraction/extract");
    expect(quoteSupports(key, value, quote)).toBe(ok);
  });

  it("keeps only integrations the vendor's pages actually name", () => {
    const ex = Extraction.parse({
      name: "A",
      description: "x",
      integrations: { value: ["QuickBooks", "Salesforce"], source_url: "https://a.com", quote: "Sync with QuickBooks" },
    });
    const v = validateExtraction(ex, [{ url: "https://a.com", text: "Sync with QuickBooks Online and Gmail." }]).ex;
    expect(v.integrations?.value).toEqual(["QuickBooks"]);
  });
});

describe("more quote checks from the live data", () => {
  it.each([
    ["price_monthly_min", 19.95, "Independent 7 day trial $19.95 per month", true],
    ["price_monthly_min", 20, "Independent 7 day trial $19.95 per month", false],
    ["price_monthly_min", 13, "$ 13 00 /mo for 12 months", true],
    ["security", "x", "Lawnager is not yet SOC 2 Type II certified independently", false],
    ["security", "x", "SOC 2 TYPE II ISO 27001 GDPR & CCPA HIPAA", true],
  ] as const)("%s = %j with %j → %s", async (key, value, quote, ok) => {
    const { quoteSupports } = await import("@/lib/extraction/extract");
    expect(quoteSupports(key, value, quote)).toBe(ok);
  });
});

describe("placeholder contacts (Goodcall's homepage demo showed a fake caller)", () => {
  it("ignores fictional 555 numbers and placeholder emails", async () => {
    const { findRealContact } = await import("@/lib/verification/contact");
    expect(findRealContact("Incoming call from (555) 010-0199 about a leaky pipe")).toBeNull();
    expect(findRealContact("Email jane@example.com to book")).toBeNull();
    expect(findRealContact("Demo (555) 010-0199 · Sales 1-888-721-1115")).toBe("1-888-721-1115");
    expect(findRealContact("Contact us at hello@waitwhile.com")).toBe("hello@waitwhile.com");
    expect(findRealContact("1017 Olive St. #300 St. Louis")).toMatch(/1017 Olive St/);
  });

  it("vendor identity fails when the only phone on the page is a demo number", () => {
    const c = runVendorChecks({
      name: "Goodcall",
      homepage: { finalUrl: "https://goodcall.com", https: true, text: "Goodcall answers calls. Caller: (555) 010-0199" },
      links: {},
      fetchedUrls: [],
      vendor: { value: "Goodcall", source_url: "https://goodcall.com" },
      contact: null,
      security: null,
      price: null,
      freePlan: null,
    });
    expect(c.vendor_identity.pass).toBe(false);
    expect(c.vendor_identity.note ?? "").not.toMatch(/555/);
  });

  it("a contact quote with only a fake number doesn't count", async () => {
    const { quoteSupports } = await import("@/lib/extraction/extract");
    expect(quoteSupports("contact", "x", "Call (555) 010-0199")).toBe(false);
  });
});

describe("track record: website at least 3 months old", () => {
  it("holds back only sites under 3 months (or unconfirmed)", async () => {
    const { domainAgeWarning, MIN_DOMAIN_AGE_DAYS } = await import("@/lib/verification/domainAge");
    expect(MIN_DOMAIN_AGE_DAYS).toBe(90);
    expect(domainAgeWarning(60)).toMatch(/only about 2 months old/);
    expect(domainAgeWarning(89)).not.toBeNull();
    expect(domainAgeWarning(90)).toBeNull();
    expect(domainAgeWarning(330)).toBeNull();
    expect(domainAgeWarning(null)).toMatch(/couldn't confirm/);
  });
});

describe("contact details check (the company name never fails it)", () => {
  const base = {
    name: "HubSpot",
    homepage: { finalUrl: "https://hubspot.com", https: true, text: "HubSpot" },
    links: {},
    fetchedUrls: [],
    security: null,
    price: null,
    freePlan: null,
  };
  it("passes with a real contact even when no legal company name is stated", () => {
    const c = runVendorChecks({ ...base, vendor: null, contact: { value: "1 888 482 7768", source_url: "https://hubspot.com" } });
    expect(c.vendor_identity.pass).toBe(true);
    expect(c.vendor_identity.note).toBe("HubSpot · 1 888 482 7768");
  });
  it("fails only for missing contact details, with a precise warning", () => {
    const c = runVendorChecks({ ...base, vendor: { value: "HubSpot, Inc.", source_url: "https://hubspot.com" }, contact: null });
    expect(c.vendor_identity.pass).toBe(false);
    expect(checkWarnings(c)).toContain("We couldn't find a phone number, email or address for this company on their site.");
    expect(checkWarnings(c).join(" ")).not.toMatch(/company's name/);
  });
  it("backfill fixes stored tools that failed only for a missing legal name", async () => {
    const { backfillTool } = await import("@/lib/pipeline/backfill");
    const t = tool({ name: "Waitwhile", vendor: null, vendor_checks: { ...checks(6), vendor_identity: { pass: false, source_url: null, note: "hello@waitwhile.com" } }, warnings: ["We couldn't find the company's name and a way to contact them."] });
    expect(backfillTool(t)).toBe(true);
    expect(t.vendor_checks.vendor_identity.pass).toBe(true);
    expect(t.warnings).toEqual([]);
  });
});
