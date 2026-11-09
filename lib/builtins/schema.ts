import { z } from "zod";
import { TOOL_IDS } from "@/lib/taxonomy/tools";
import { USE_CASE_IDS } from "@/lib/taxonomy/useCases";

/** An AI feature built into software the owner may already pay for (Square, QuickBooks, Google…). */
export const BuiltInFeature = z.object({
  id: z.string(),
  platform: z.enum(TOOL_IDS),
  name: z.string(),
  description: z.string(),
  use_cases: z.array(z.enum(USE_CASE_IDS)).min(1),
  /** "included" in plans the owner likely has, "paid_addon", or null when the page doesn't say. */
  availability: z.enum(["included", "paid_addon"]).nullable(),
  cost_note: z.string().nullable(),
  how_to_start: z.array(z.string()),
  source_url: z.string(),
  quote: z.string(),
  last_checked_at: z.string(),
});
export type BuiltInFeature = z.infer<typeof BuiltInFeature>;

/** What the LLM returns per page before validation. */
export const FeatureExtraction = z.object({
  features: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        use_cases: z.array(z.string()).default([]),
        availability: z.enum(["included", "paid_addon"]).nullable().catch(null),
        cost_note: z.string().nullable().catch(null),
        how_to_start: z.array(z.string()).default([]),
        quote: z.string(),
      }),
    )
    .default([]),
});
