import { z } from "zod";

/** A value the LLM extracted, with the exact quote and page it came from. */
const Cited = <T extends z.ZodTypeAny>(v: T) =>
  z.preprocess(
    (x) => (x && typeof x === "object" && (x as { value?: unknown }).value != null ? x : null),
    z
      .object({
        value: v,
        source_url: z.string(),
        quote: z.string(),
        claim_type: z.enum(["fact", "vendor_claim"]).catch("fact"),
      })
      .nullable(),
  );

/** Plain string list; tolerates the model wrapping items as {value: "..."}. */
const IdList = z
  .array(z.union([z.string(), z.object({ value: z.string() }).transform((o) => o.value)]))
  .nullable()
  .default([])
  .transform((a) => a ?? []);

export const Extraction = z.object({
  name: z.string(),
  vendor: Cited(z.string()),
  description: z.string(),
  use_cases: IdList,
  industries: IdList,
  free_plan: Cited(z.boolean()),
  free_trial_days: Cited(z.number()),
  price_monthly_min: Cited(z.number()),
  price_monthly_max: Cited(z.number()),
  plan_name: Cited(z.string()),
  integrations: Cited(z.array(z.string())),
  works_standalone: Cited(z.boolean()),
  integration_requirements: z.array(z.string()).default([]),
  setup_complexity: z.enum(["low", "medium", "high"]).nullable().default(null),
  setup_steps: z.array(z.string()).default([]),
  engagement: z.enum(["self_serve", "free_trial", "book_demo", "needs_setup_help"]).nullable().default(null),
  contact: Cited(z.string()),
  security: Cited(z.string()),
});
export type Extraction = z.infer<typeof Extraction>;
