import { z } from "zod";
import { getLlm, parseJsonLoose } from "@/lib/llm/provider";
import { CLASSIFY_SYSTEM } from "@/lib/extraction/prompts";
import { USE_CASE_IDS, type UseCaseId } from "@/lib/taxonomy/useCases";

export type Classification = { use_cases: UseCaseId[]; confidence: number; source: "llm" | "keywords" };

const Reply = z.object({
  use_cases: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

/** Cheap fallback when the LLM is unavailable. Low confidence on purpose so the UI asks to confirm. */
const KEYWORDS: Record<UseCaseId, RegExp> = {
  missed_calls: /\b(miss(ed|ing)? (calls?|orders?)|phone|calls?|voicemail|answer)\b/i,
  booking_waitlist: /\b(book(ing|ings)?|appointments?|reservations?|wait ?list|walk-?ins?|no-?shows?|line)\b/i,
  auto_replies: /\b(reviews?|dms?|messages?|emails?|questions?|replies|reply|inbox|comments?)\b/i,
  customer_list: /\b(customer (list|info|data)|contacts?|scattered|organi[sz]e|spreadsheet|crm)\b/i,
  win_back: /\b(come back|call back|never (come|call)|repeat|loyal(ty)?|win back|tune-?ups?|stopped coming|regulars)\b/i,
  scheduling_dispatch: /\b(schedul(e|ing)|dispatch|crews?|jobs?|routes?|technicians?|techs?)\b/i,
};

export function classifyByKeywords(text: string): Classification {
  const hits = USE_CASE_IDS.map((id) => ({ id, n: (text.match(new RegExp(KEYWORDS[id], "gi")) ?? []).length }))
    .filter((h) => h.n > 0)
    .sort((a, b) => b.n - a.n);
  return { use_cases: hits.slice(0, 2).map((h) => h.id), confidence: hits.length ? 0.4 : 0, source: "keywords" };
}

export async function classify(text: string): Promise<Classification> {
  try {
    const { text: reply } = await getLlm().chat(
      [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user", content: text.slice(0, 1500) },
      ],
      { json: true, maxTokens: 200, timeoutMs: 15_000 },
    );
    const r = Reply.parse(parseJsonLoose(reply));
    const use_cases = r.use_cases.filter((u): u is UseCaseId => (USE_CASE_IDS as readonly string[]).includes(u)).slice(0, 2);
    return { use_cases, confidence: use_cases.length ? r.confidence : 0, source: "llm" };
  } catch {
    return classifyByKeywords(text);
  }
}
