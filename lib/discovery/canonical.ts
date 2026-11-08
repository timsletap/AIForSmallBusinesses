/** Directory, review and listing sites: used only to learn a product's name, never as a fact source. */
export const AGGREGATOR_DOMAINS = [
  "g2.com", "capterra.com", "getapp.com", "softwareadvice.com", "trustradius.com", "trustpilot.com",
  "producthunt.com", "yelp.com", "reddit.com", "youtube.com", "facebook.com", "linkedin.com",
  "twitter.com", "x.com", "medium.com", "forbes.com", "techradar.com", "pcmag.com", "zapier.com",
  "wikipedia.org", "crunchbase.com", "apps.apple.com", "play.google.com", "quora.com",
  "nerdwallet.com", "businessnewsdaily.com", "fitsmallbusiness.com", "instagram.com", "tiktok.com",
  "github.com", "theresanaiforthat.com", "futuretools.io", "saasworthy.com", "sourceforge.net",
];

/** Lowercase host, strip `www.`, query strings, fragments and trailing slashes. */
export function canonicalUrl(input: string): string | null {
  const raw = input.trim();
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  return `https://${host}${path}`;
}

/** Normalized domain used for dedupe: "https://www.Foo.com/pricing?x=1" → "foo.com". */
export function domainKey(input: string): string | null {
  const c = canonicalUrl(input);
  return c ? new URL(c).hostname : null;
}

/** Homepage of the vendor: canonical root of the domain. */
export function homepageUrl(input: string): string | null {
  const d = domainKey(input);
  return d ? `https://${d}` : null;
}

export function isAggregator(input: string): boolean {
  const d = domainKey(input);
  if (!d) return true;
  return AGGREGATOR_DOMAINS.some((a) => d === a || d.endsWith(`.${a}`));
}

export function sameSite(a: string, b: string): boolean {
  const da = domainKey(a);
  const db = domainKey(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(`.${db}`) || db.endsWith(`.${da}`);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Keep the first occurrence of each domain. */
export function dedupeByDomain<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = domainKey(it.url);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
