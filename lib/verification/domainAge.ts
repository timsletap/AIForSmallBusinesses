import { fetchWithTimeout } from "@/lib/llm/provider";
import { domainKey } from "@/lib/discovery/canonical";

/** Vendors need a track record: domains younger than this are never auto-published. */
export const MIN_DOMAIN_AGE_DAYS = 90;
/** Plain-language form of the rule, used wherever it is shown to people. */
export const MIN_DOMAIN_AGE_LABEL = "3 months";

const cache = new Map<string, string | null>();

/** Registration date of the vendor's domain from RDAP (public registry data), or null if unknown. */
export async function domainRegisteredAt(url: string): Promise<string | null> {
  const host = domainKey(url);
  if (!host) return null;
  const root = host.split(".").slice(-2).join(".");
  if (cache.has(root)) return cache.get(root)!;
  let date: string | null = null;
  try {
    // rdap.org redirects to the right registry; it blocks requests without a normal user agent.
    const res = await fetchWithTimeout(
      `https://rdap.org/domain/${root}`,
      { headers: { Accept: "application/rdap+json", "User-Agent": "curl/8.9.1" }, redirect: "follow" },
      10_000,
    );
    if (res.ok) {
      const j = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
      date = j.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
    }
  } catch {
    // Unknown.
  }
  cache.set(root, date);
  return date;
}

export function domainAgeDays(registeredAt: string | null, now = Date.now()): number | null {
  return registeredAt ? Math.floor((now - Date.parse(registeredAt)) / 86_400_000) : null;
}

/** Plain-language warning for a young or unconfirmed domain, or null when it has a track record. */
export function domainAgeWarning(days: number | null): string | null {
  if (days === null) return "We couldn't confirm how long this company's website has existed.";
  if (days < MIN_DOMAIN_AGE_DAYS) {
    const months = Math.max(1, Math.round(days / 30));
    return `This company's website is only about ${months} month${months === 1 ? "" : "s"} old, so there's little track record.`;
  }
  return null;
}
