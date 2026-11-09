import { createHash } from "crypto";
import { getLlm, parseJsonLoose, type ChatMessage } from "@/lib/llm/provider";
import { canonicalUrl, domainKey } from "@/lib/discovery/canonical";
import { fetchPage } from "@/lib/discovery/fetchPage";
import { quoteFound } from "@/lib/extraction/extract";
import { USE_CASES, USE_CASE_IDS, type UseCaseId } from "@/lib/taxonomy/useCases";
import { toolLabel, type ToolId } from "@/lib/taxonomy/tools";
import { BuiltInFeature, FeatureExtraction } from "./schema";

/** Platforms owners already pay for, and the only domains facts about them may come from. */
export const PLATFORM_SOURCES: Partial<Record<ToolId, { domains: string[]; hint: string }>> = {
  square: { domains: ["squareup.com", "square.com"], hint: "Square POS, Square Appointments, Square Marketing, Square AI" },
  quickbooks: { domains: ["quickbooks.intuit.com", "intuit.com"], hint: "QuickBooks Online, Intuit Assist" },
  google_business_profile: {
    domains: ["business.google.com", "support.google.com", "blog.google"],
    hint: "Google Business Profile messaging, review replies, booking",
  },
  gmail_outlook: {
    domains: ["workspace.google.com", "support.google.com", "microsoft.com", "support.microsoft.com"],
    hint: "Gemini in Gmail and Google Workspace, Copilot in Outlook and Microsoft 365, Microsoft Bookings",
  },
  shopify: { domains: ["shopify.com", "help.shopify.com"], hint: "Shopify Magic, Shopify Sidekick, Shopify Inbox, Shopify Email" },
  clover: { domains: ["clover.com"], hint: "Clover POS marketing, customer engagement, AI features" },
  toast: { domains: ["pos.toasttab.com", "toasttab.com", "support.toasttab.com"], hint: "Toast POS AI, Toast marketing, guest engagement" },
  instagram_facebook: {
    domains: ["facebook.com", "business.facebook.com", "meta.com", "about.meta.com", "business.instagram.com"],
    hint: "Meta Business Suite automated responses, Meta AI for business messaging",
  },
};

export type Log = (msg: string) => void;

function onPlatform(url: string, domains: string[]): boolean {
  const d = domainKey(url);
  return !!d && domains.some((x) => d === x || d.endsWith(`.${x}`));
}

/** Official pages describing a platform's built-in AI features. */
async function findPages(platform: ToolId, max: number): Promise<string[]> {
  const src = PLATFORM_SOURCES[platform]!;
  const { citations } = await getLlm().chat(
    [
      {
        role: "user",
        content: `Find official pages describing built-in AI or automation features in ${toolLabel(platform)} (${src.hint}) that help a small business with: ${USE_CASES.map((u) => u.short.toLowerCase()).join(", ")}. List the page URLs.`,
      },
    ],
    { webSearch: { maxResults: 10, includeDomains: src.domains }, maxTokens: 600, timeoutMs: 90_000 },
  );
  const urls = citations.map((c) => canonicalUrl(c.url)).filter((u): u is string => !!u && onPlatform(u, src.domains));
  return [...new Set(urls)].slice(0, max);
}

const SYSTEM = `You list AI or automation features that are built into a software platform, using ONLY the page text provided.
Rules:
- Only features of the platform itself (not third-party apps or partner integrations).
- Only features that help with one of these problems: ${USE_CASES.map((u) => `${u.id} (${u.description})`).join("; ")}.
- use_cases: only the ids above.
- description: one plain sentence, under 25 words, 8th-grade reading level, no hype.
- availability: "included" only if the page says it comes with the product or plan at no extra charge; "paid_addon" if it costs extra; otherwise null.
- cost_note: short price/plan note copied from the page if shown, else null.
- how_to_start: 2-4 short owner-facing steps if the page explains how to turn it on, else [].
- quote: a short EXACT copy (5-25 words) from the page that shows this feature exists. Copy character-for-character.
- If the page has no such features, return {"features": []}.
Return ONLY JSON: {"features":[{"name","description","use_cases","availability","cost_note","how_to_start","quote"}]}`;

/** Discover built-in AI features for one platform. Every feature must be quoted from an official page. */
export async function discoverPlatform(platform: ToolId, log: Log, maxPages = 4): Promise<BuiltInFeature[]> {
  const src = PLATFORM_SOURCES[platform];
  if (!src) return [];
  const urls = await findPages(platform, maxPages);
  log(`${toolLabel(platform)}: ${urls.length} official page(s) found`);
  const out: BuiltInFeature[] = [];
  for (const url of urls) {
    const page = await fetchPage(url);
    if (!page || !onPlatform(page.finalUrl, src.domains)) {
      log(`  ✗ ${url}: did not load, blocked by robots.txt, or left the official site`);
      continue;
    }
    let parsed;
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Platform: ${toolLabel(platform)}\n=== PAGE ${page.url} ===\n${page.text}` },
      ];
      const { text } = await getLlm().chat(messages, { json: true, maxTokens: 2500, timeoutMs: 90_000 });
      try {
        parsed = FeatureExtraction.parse(parseJsonLoose(text));
      } catch (e) {
        // One repair attempt: show the model its error.
        const { text: retry } = await getLlm().chat(
          [
            ...messages,
            { role: "assistant", content: text },
            { role: "user", content: `That was not valid JSON (${(e as Error).message.slice(0, 200)}). Reply again with ONLY the corrected JSON object.` },
          ],
          { json: true, maxTokens: 2500, timeoutMs: 90_000 },
        );
        parsed = FeatureExtraction.parse(parseJsonLoose(retry));
      }
    } catch (e) {
      log(`  ✗ ${url}: extraction failed (${(e as Error).message.slice(0, 80)})`);
      continue;
    }
    for (const f of parsed.features) {
      const use_cases = f.use_cases.filter((u): u is UseCaseId => (USE_CASE_IDS as readonly string[]).includes(u));
      if (!use_cases.length) continue;
      if (!quoteFound(f.quote, page.url, [{ url: page.url, text: page.text }])) {
        log(`  dropped "${f.name}": quote not found on page`);
        continue;
      }
      if (out.some((o) => o.name.toLowerCase() === f.name.toLowerCase())) continue;
      out.push(
        BuiltInFeature.parse({
          id: createHash("sha1").update(`${platform}:${f.name.toLowerCase()}`).digest("hex").slice(0, 12),
          platform,
          name: f.name,
          description: f.description,
          use_cases,
          availability: f.availability,
          cost_note: f.cost_note,
          how_to_start: f.how_to_start,
          source_url: page.url,
          quote: f.quote,
          last_checked_at: new Date().toISOString(),
        }),
      );
      log(`  ✓ ${f.name} (${use_cases.join(", ")}, ${f.availability ?? "cost not stated"})`);
    }
  }
  return out;
}
