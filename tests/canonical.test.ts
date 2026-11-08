import { describe, expect, it } from "vitest";
import { canonicalUrl, dedupeByDomain, domainKey, homepageUrl, isAggregator, sameSite } from "@/lib/discovery/canonical";
import { normalizeIntegration, normalizeIntegrations } from "@/lib/taxonomy/tools";

describe("canonicalUrl", () => {
  it("lowercases host, strips www, query, fragment, trailing slash", () => {
    expect(canonicalUrl("HTTPS://www.Example.com/Pricing/?utm=1#plans")).toBe("https://example.com/Pricing");
    expect(canonicalUrl("example.com")).toBe("https://example.com");
    expect(canonicalUrl("http://example.com/")).toBe("https://example.com");
  });
  it("rejects junk", () => {
    expect(canonicalUrl("not a url")).toBeNull();
    expect(canonicalUrl("mailto:a@b.com")).toBeNull();
    expect(canonicalUrl("ftp://example.com")).toBeNull();
  });
  it("domainKey and homepageUrl", () => {
    expect(domainKey("https://www.getjobber.com/pricing?x=1")).toBe("getjobber.com");
    expect(homepageUrl("https://www.getjobber.com/pricing")).toBe("https://getjobber.com");
  });
});

describe("dedupe", () => {
  it("keeps first per domain", () => {
    const out = dedupeByDomain([
      { url: "https://www.a.com/x", n: 1 },
      { url: "https://a.com/pricing", n: 2 },
      { url: "https://b.com", n: 3 },
    ]);
    expect(out.map((o) => o.n)).toEqual([1, 3]);
  });
  it("sameSite treats subdomains as same", () => {
    expect(sameSite("https://help.a.com/x", "https://a.com")).toBe(true);
    expect(sameSite("https://a.com", "https://b.com")).toBe(false);
  });
  it("flags aggregators", () => {
    expect(isAggregator("https://www.g2.com/products/x")).toBe(true);
    expect(isAggregator("https://getjobber.com")).toBe(false);
  });
});

describe("integration synonyms", () => {
  it("normalizes names to taxonomy ids", () => {
    expect(normalizeIntegration("Square POS")).toBe("square");
    expect(normalizeIntegration("Square Appointments")).toBe("square");
    expect(normalizeIntegration("QuickBooks Online")).toBe("quickbooks");
    expect(normalizeIntegration("Google Calendar")).toBe("gmail_outlook");
    expect(normalizeIntegration("Salesforce")).toBeNull();
    expect(normalizeIntegrations(["Facebook", "Instagram", "Zapier"])).toEqual(["instagram_facebook"]);
  });
});

describe("robots.txt", () => {
  it("handles wildcards, allow and groups", async () => {
    const { parseRobots, robotsAllows } = await import("@/lib/discovery/fetchPage");
    const rules = parseRobots(
      ["User-agent: GPTBot", "Disallow: /", "", "User-agent: Googlebot", "User-agent: *", "Disallow: /*?", "Disallow: /admin", "Allow: /admin/public", "Disallow: /*.pdf$"].join("\n"),
    );
    expect(robotsAllows(rules, "/")).toBe(true);
    expect(robotsAllows(rules, "/pricing")).toBe(true);
    expect(robotsAllows(rules, "/pricing?x=1")).toBe(false);
    expect(robotsAllows(rules, "/admin/x")).toBe(false);
    expect(robotsAllows(rules, "/admin/public")).toBe(true);
    expect(robotsAllows(rules, "/a.pdf")).toBe(false);
    expect(robotsAllows(parseRobots("User-agent: *\nDisallow: /"), "/")).toBe(false);
  });
});
