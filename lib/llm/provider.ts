/**
 * Small LLM provider interface. OpenRouter speaks the OpenAI chat-completions format,
 * so OpenAI (or Gemini via OpenRouter) can be swapped in by changing env vars.
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type WebCitation = { url: string; title: string; content?: string };

export type ChatOptions = {
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  /** Enable the provider's web search (OpenRouter `web` plugin). */
  webSearch?: { maxResults?: number; excludeDomains?: string[] };
};

export type ChatResult = { text: string; citations: WebCitation[] };

export interface LlmProvider {
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
}

class OpenAiCompatibleProvider implements LlmProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: 0,
    };
    if (opts.json) body.response_format = { type: "json_object" };
    if (opts.webSearch) {
      body.plugins = [
        {
          id: "web",
          engine: "exa",
          max_results: opts.webSearch.maxResults ?? 8,
          ...(opts.webSearch.excludeDomains?.length ? { exclude_domains: opts.webSearch.excludeDomains } : {}),
        },
      ];
    }

    const res = await withRetry(() =>
      fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-tool-matchmaker.vercel.app",
            "X-Title": "AI Tool Matchmaker",
          },
          body: JSON.stringify(body),
        },
        opts.timeoutMs ?? 60_000,
      ),
    );
    const data = (await res.json()) as {
      choices?: { message?: { content?: string; annotations?: { type: string; url_citation?: WebCitation }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok || !data.choices?.[0]) {
      throw new Error(`LLM error ${res.status}: ${data.error?.message ?? "no choices"}`);
    }
    const msg = data.choices[0].message ?? {};
    const citations = (msg.annotations ?? [])
      .filter((a) => a.type === "url_citation" && a.url_citation?.url)
      .map((a) => a.url_citation!);
    return { text: msg.content ?? "", citations };
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** One retry on network errors and 429/5xx. */
export async function withRetry(fn: () => Promise<Response>): Promise<Response> {
  try {
    const r = await fn();
    if (r.status === 429 || r.status >= 500) {
      await new Promise((ok) => setTimeout(ok, 1500));
      return await fn();
    }
    return r;
  } catch {
    await new Promise((ok) => setTimeout(ok, 1500));
    return await fn();
  }
}

/** Parse JSON from a model reply, tolerating ```json fences or surrounding prose. */
export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("No JSON in model reply");
  return JSON.parse(raw.slice(start, end + 1));
}

let cached: LlmProvider | null = null;

export function getLlm(): LlmProvider {
  if (cached) return cached;
  const provider = process.env.LLM_PROVIDER ?? "openrouter";
  const model = process.env.LLM_MODEL || "anthropic/claude-haiku-5.5";
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
    cached = new OpenAiCompatibleProvider("https://api.openai.com/v1", process.env.OPENAI_API_KEY, model);
  } else {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
    cached = new OpenAiCompatibleProvider("https://openrouter.ai/api/v1", process.env.OPENROUTER_API_KEY, model);
  }
  return cached;
}
