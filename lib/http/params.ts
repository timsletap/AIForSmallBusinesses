/** Tool slugs from ?ids=a,b,c or repeated ?ids=a&ids=b. */
export function idsFromParams(sp: Record<string, string | string[] | undefined>, max = 3): string[] {
  const raw = sp.ids;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((s) => s.split(","));
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(0, max);
}
