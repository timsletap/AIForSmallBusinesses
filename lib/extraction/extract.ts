import { getLlm, parseJsonLoose, type ChatMessage } from "@/lib/llm/provider";
import { Extraction } from "./schema";
import { EXTRACTION_SYSTEM, extractionUser } from "./prompts";

export type SourcePage = { url: string; text: string };

export async function extract(name: string, pages: SourcePage[]): Promise<Extraction> {
  const messages: ChatMessage[] = [
    { role: "system", content: EXTRACTION_SYSTEM },
    { role: "user", content: extractionUser(name, pages) },
  ];
  const { text } = await getLlm().chat(messages, { json: true, maxTokens: 4000, timeoutMs: 90_000 });
  try {
    return Extraction.parse(parseJsonLoose(text));
  } catch (e) {
    // One repair attempt: show the model its error.
    const { text: retry } = await getLlm().chat(
      [
        ...messages,
        { role: "assistant", content: text },
        {
          role: "user",
          content: `That was not valid for the required shape (${(e as Error).message.slice(0, 300)}). Reply again with ONLY the corrected JSON object.`,
        },
      ],
      { json: true, maxTokens: 4000, timeoutMs: 90_000 },
    );
    return Extraction.parse(parseJsonLoose(retry));
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/** Does the quote appear in the page it cites (or, failing that, any fetched page)? */
export function quoteFound(quote: string, sourceUrl: string, pages: SourcePage[]): string | null {
  const q = norm(quote);
  if (q.length < 3) return null;
  const cited = pages.find((p) => p.url === sourceUrl);
  if (cited && norm(cited.text).includes(q)) return cited.url;
  const any = pages.find((p) => norm(p.text).includes(q));
  return any ? any.url : null;
}

type CitedKey = {
  [K in keyof Extraction]: Extraction[K] extends { quote: string } | null ? K : never;
}[keyof Extraction];

export const CITED_KEYS: CitedKey[] = [
  "vendor",
  "free_plan",
  "free_trial_days",
  "price_monthly_min",
  "price_monthly_max",
  "plan_name",
  "integrations",
  "works_standalone",
  "contact",
  "security",
];

const PRICE_KEYS = new Set<CitedKey>(["price_monthly_min", "price_monthly_max"]);

/**
 * Drop any cited value whose quote can't be found in the fetched text. A price must also have
 * its number in the quote and be within 0..5000/month, otherwise it is set to null.
 */
export function validateExtraction(ex: Extraction, pages: SourcePage[]): { ex: Extraction; dropped: string[] } {
  const out = structuredClone(ex);
  const dropped: string[] = [];
  for (const key of CITED_KEYS) {
    const v = out[key];
    if (!v) continue;
    const url = quoteFound(v.quote, v.source_url, pages);
    let ok = !!url;
    if (ok && PRICE_KEYS.has(key)) {
      const n = Number(v.value);
      const digits = String(Math.round(n));
      ok = Number.isFinite(n) && n >= 0 && n <= 5000 && (n === 0 || v.quote.replace(/,/g, "").includes(digits));
    }
    if (ok) {
      v.source_url = url!;
    } else {
      dropped.push(key);
      (out as Record<string, unknown>)[key] = null;
    }
  }
  // A free demo or trial is not a free plan.
  if (out.free_plan?.value && /\b(demo|trial)\b/i.test(out.free_plan.quote)) {
    out.free_plan = null;
    dropped.push("free_plan");
  }
  const min = out.price_monthly_min?.value;
  const max = out.price_monthly_max?.value;
  if (min != null && max != null && max < min) {
    out.price_monthly_max = null;
    dropped.push("price_monthly_max");
  }
  return { ex: out, dropped };
}
