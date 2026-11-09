import { INDUSTRIES, type IndustryId } from "@/lib/taxonomy/industries";
import { USE_CASES, type UseCaseId } from "@/lib/taxonomy/useCases";

/** Different phrasings surface different vendors for the same need. */
const TEMPLATES = [
  (what: string, who: string) => `AI ${what} software for small ${who} businesses pricing`,
  (what: string, who: string) => `best AI tool for ${who} owners ${what}`,
  (what: string, who: string) => `${what} app for ${who} small business free trial`,
  (what: string, who: string) => `affordable AI ${what} for local ${who} shops`,
];

export type RotationSlot = { useCase: UseCaseId; industry: IndustryId; query: string };

/**
 * The discovery search for a given run number. Cycles through every use case × industry, and each
 * full cycle uses the next phrasing, so daily runs keep reaching new vendors instead of repeating.
 */
export function rotationSlot(n: number): RotationSlot {
  const industries = INDUSTRIES.filter((i) => i.id !== "other");
  const pairs = USE_CASES.flatMap((u) => industries.map((i) => ({ u, i })));
  const { u, i } = pairs[((n % pairs.length) + pairs.length) % pairs.length];
  const template = TEMPLATES[Math.floor(n / pairs.length) % TEMPLATES.length];
  const what = u.description.split(",")[0].toLowerCase();
  return { useCase: u.id, industry: i.id, query: template(what, i.label.toLowerCase()) };
}

/** Run number for a date: one slot per day. */
export const dayNumber = (d = new Date()) => Math.floor(d.getTime() / 86_400_000);
