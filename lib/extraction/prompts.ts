import { INDUSTRIES } from "@/lib/taxonomy/industries";
import { CURRENT_TOOLS } from "@/lib/taxonomy/tools";
import { USE_CASES } from "@/lib/taxonomy/useCases";

export const EXTRACTION_SYSTEM = `You extract facts about a software product for small business owners.

RULES
- Use ONLY the page text provided. Never use outside knowledge. If a fact is not in the text, use null.
- Every cited field is {"value": ..., "source_url": "<one of the provided page URLs>", "quote": "<short EXACT copy of words from that page, 3-25 words>", "claim_type": "fact" | "vendor_claim"} or null.
- The quote must be copied character-for-character from the page text so it can be found again. Do not paraphrase quotes.
- The quote must itself show the value: a price quote contains that dollar amount; a plan_name quote contains the plan name; a free_trial_days quote contains the number of days; a free_plan quote says "free" (and is not about a trial or demo); a contact quote contains the email, phone or address; a security quote names the security practice or certification; a vendor quote contains the company name (the footer copyright line is ideal).
- plan_name is ONE plan: the cheapest paid plan a small business would use.
- Marketing statements ("best", "#1", "boost revenue 30%") are "vendor_claim". Prices, plan names, integrations and policies are "fact".
- Prices are US dollars PER MONTH for the cheapest paid plan a small business would use (min) and a typical mid plan (max). Convert annual prices to monthly only if the page shows the monthly figure. If no dollar price is shown, null.
- use_cases, industries and integrations must use ONLY these IDs:
  use_cases: ${USE_CASES.map((u) => `${u.id} (${u.description})`).join("; ")}
  industries: ${INDUSTRIES.map((i) => i.id).join(", ")}
- free_plan is true only for a permanent free tier a business can keep using. A free demo or free trial is NOT a free plan.
- integrations.value is a list of product names the tool works with, as written on the page (e.g. "Square", "QuickBooks Online", "Google Calendar").
- description: one plain sentence (under 25 words, 8th-grade reading level) saying what the tool does. No hype.
- setup_steps: 3-6 short owner-facing steps to get started, based on the pages (e.g. "Create an account", "Forward your business phone number").
- integration_requirements: what the owner needs first, in plain words (e.g. "A business phone number that can forward calls"). Empty list if none.
- setup_complexity: low (self sign-up, under an hour), medium (a few hours or some configuration), high (needs sales call, hardware or a consultant).
- engagement: self_serve (sign up online, paid), free_trial, book_demo (must talk to sales), needs_setup_help.
- contact: an email, phone or street address for the company if shown.
- security: a security page, trust center or named certification (SOC 2, ISO 27001, HIPAA, PCI) if mentioned.
- vendor: the company or legal name (e.g. from the footer "© 2026 Acme Inc.").

Return ONLY one valid JSON object (no markdown fences, no comments), exactly this shape:
{
  "name": "string",
  "vendor": CITED string | null,
  "description": "string",
  "use_cases": ["id", ...],
  "industries": ["id", ...],
  "free_plan": CITED boolean | null,
  "free_trial_days": CITED number | null,
  "price_monthly_min": CITED number | null,
  "price_monthly_max": CITED number | null,
  "plan_name": CITED string | null,
  "integrations": CITED array of strings | null,
  "works_standalone": CITED boolean | null,
  "integration_requirements": ["string", ...],
  "setup_complexity": "low" | "medium" | "high" | null,
  "setup_steps": ["string", ...],
  "engagement": "self_serve" | "free_trial" | "book_demo" | "needs_setup_help" | null,
  "contact": CITED string | null,
  "security": CITED string | null
}
where CITED means {"value": ..., "source_url": "...", "quote": "...", "claim_type": "fact"}.
use_cases, industries, integration_requirements and setup_steps are plain arrays, NOT cited objects.
Escape any double quotes inside strings as \\".`;

export function extractionUser(name: string, pages: { url: string; text: string }[]): string {
  const known = CURRENT_TOOLS.map((t) => t.label).join(", ");
  return `Product (from search, may be wrong): ${name}
Owner tools we care about matching: ${known}

${pages.map((p) => `=== PAGE ${p.url} ===\n${p.text}`).join("\n\n")}`;
}

export const CLASSIFY_SYSTEM = `You sort a small business owner's problem into 1 or 2 categories.
Categories:
${USE_CASES.map((u) => `- ${u.id}: ${u.label}. ${u.description}`).join("\n")}

Return ONLY JSON: {"use_cases": ["id", ...], "confidence": 0.0-1.0}
Use 2 categories only when the problem clearly has two parts. Order by importance. If the text is not about a business problem, return {"use_cases": [], "confidence": 0}.`;
