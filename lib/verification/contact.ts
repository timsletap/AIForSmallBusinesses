/**
 * Real-vs-placeholder contact details. Vendor homepages often show demo screens with sample data
 * (e.g. a fake caller "(555) 010-0199"), which must never be shown as the vendor's contact.
 */
const PHONE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const EMAIL = /[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi;
const ADDRESS = /\b\d{2,5}\s+\w+(?:\s\w+)*\s(?:street|st|avenue|ave|road|rd|suite|blvd|boulevard|drive|dr|wacker|olive|balboa)\b/i;

/** 555 exchange numbers are reserved for fiction (555-0100…0199 in particular); 000/123 area codes aren't real. */
export function isFictionalPhone(area: string, exchange: string, line: string): boolean {
  return exchange === "555" || area === "555" || area === "000" || area === "123" || /^(\d)\1{6}$/.test(exchange + line);
}

const PLACEHOLDER_EMAIL = /@(example|test|domain|email|yourcompany|company|acme)\.|^(you|your|name|john|jane|user)@/i;

/** First real-looking contact (email, phone or street address) in the text, or null. */
export function findRealContact(text: string): string | null {
  for (const m of text.matchAll(EMAIL)) if (!PLACEHOLDER_EMAIL.test(m[0])) return m[0];
  for (const m of text.matchAll(PHONE)) if (!isFictionalPhone(m[1], m[2], m[3])) return m[0].trim();
  const a = text.match(ADDRESS);
  return a ? a[0] : null;
}

export const hasRealContact = (text: string) => findRealContact(text) !== null;
