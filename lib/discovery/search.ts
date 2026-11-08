import { z } from "zod";
import { getLlm, parseJsonLoose } from "@/lib/llm/provider";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { industryById } from "@/lib/taxonomy/industries";
import { AGGREGATOR_DOMAINS, dedupeByDomain, homepageUrl, isAggregator } from "./canonical";

export type Candidate = { name: string; url: string; found_via: string };

export function buildQuery(useCase: string, industry: string): string {
  const uc = getUseCase(useCase);
  const ind = industryById(industry);
  const what = uc ? uc.description.split(",")[0].toLowerCase() : useCase;
  return `AI ${what} software for small ${ind ? ind.label.toLowerCase() : industry} businesses pricing`;
}

const CandidateList = z.object({
  candidates: z.array(z.object({ name: z.string(), official_url: z.string() })),
});

/**
 * Web search via the LLM provider's search plugin. Listing/review results are used only to learn
 * product names; each candidate is resolved to the vendor's own homepage.
 */
export async function searchCandidates(query: string, limit = 6): Promise<Candidate[]> {
  const { text, citations } = await getLlm().chat(
    [
      {
        role: "system",
        content:
          "You find software products from web search results. Return only JSON. Only include real, currently available software products that a small business can sign up for. official_url must be the vendor's own website homepage (not a review site, directory, app store or article).",
      },
      {
        role: "user",
        content: `Search: ${query}\n\nReturn JSON: {"candidates":[{"name":"Product name","official_url":"https://vendor.com"}]} with up to ${limit} distinct products, best matches first.`,
      },
    ],
    {
      webSearch: { maxResults: 10, excludeDomains: AGGREGATOR_DOMAINS.slice(0, 12) },
      maxTokens: 1200,
      timeoutMs: 90_000,
    },
  );

  let fromModel: Candidate[] = [];
  try {
    const parsed = CandidateList.parse(parseJsonLoose(text));
    fromModel = parsed.candidates.map((c) => ({ name: c.name, url: c.official_url, found_via: "search+llm" }));
  } catch {
    // Fall through to raw citations.
  }
  const fromCitations = citations.map((c) => ({ name: c.title, url: c.url, found_via: c.url }));

  return dedupeByDomain(
    [...fromModel, ...fromCitations]
      .filter((c) => !isAggregator(c.url))
      .map((c) => ({ ...c, url: homepageUrl(c.url) ?? "" }))
      .filter((c) => !!c.url),
  ).slice(0, limit);
}
