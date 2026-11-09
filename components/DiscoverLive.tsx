"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { DiscoverEvent, Stage } from "@/lib/pipeline/events";
import { USE_CASES, type UseCaseId } from "@/lib/taxonomy/useCases";
import { ToolLogo } from "@/components/ToolLogo";

const STAGES: { id: Stage; label: string; detail: string }[] = [
  { id: "search", label: "Search the web", detail: "Live web search for AI products" },
  { id: "site", label: "Find official sites", detail: "Directories and reviews are ignored" },
  { id: "extract", label: "Extract the facts", detail: "Prices, features and setup, word-for-word" },
  { id: "verify", label: "Verify the vendor", detail: "6 safety checks + website track record" },
  { id: "save", label: "Add to directory", detail: "Only approved tools go live" },
];
const ORDER: Stage[] = STAGES.map((s) => s.id);

type Cand = { name: string; url?: string; stage: Stage; message: string; result?: Extract<DiscoverEvent, { type: "result" }> };

export function DiscoverLive() {
  const [query, setQuery] = useState("");
  const [useCase, setUseCase] = useState<UseCaseId | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [feed, setFeed] = useState<string[]>([]);
  const [cands, setCands] = useState<Cand[]>([]);
  const [done, setDone] = useState<Extract<DiscoverEvent, { type: "done" }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const upsert = (name: string, patch: Partial<Cand>) =>
    setCands((cs) => {
      const i = cs.findIndex((c) => c.name === name);
      if (i < 0) return [...cs, { name, stage: "site", message: "", ...patch }];
      const next = [...cs];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  function handle(e: DiscoverEvent) {
    switch (e.type) {
      case "stage":
        setStage(e.stage);
        setFeed((f) => [...f, e.message]);
        break;
      case "candidates":
        setStage("site");
        setFeed((f) => [...f, e.names.length ? `Found ${e.names.length} new product(s) to investigate` : "Everything found is already in the directory"]);
        e.names.forEach((n) => upsert(n, { stage: "site", message: "Queued" }));
        break;
      case "candidate":
        setStage(e.stage);
        upsert(e.name, { url: e.url, stage: e.stage, message: e.message });
        break;
      case "result":
        setStage("save");
        upsert(e.name, { stage: "save", message: e.detail, result: e });
        break;
      case "done":
        setDone(e);
        setFeed((f) => [...f, e.message]);
        break;
      case "error":
        setError(e.message);
        break;
    }
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() && !useCase) return setError("Type what you need AI for, or pick a problem.");
    setRunning(true);
    setError(null);
    setDone(null);
    setFeed([]);
    setCands([]);
    setStage("search");
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query.trim() ? { query: query.trim(), use_case: useCase ?? undefined } : { use_case: useCase }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? "Discovery couldn't start. Please try again.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) if (l.trim()) handle(JSON.parse(l) as DiscoverEvent);
      }
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const reached = (s: Stage) => (stage ? ORDER.indexOf(s) <= ORDER.indexOf(stage) : false);

  return (
    <div className="space-y-8">
      <form onSubmit={start} className="glass rounded-3xl p-5 sm:p-7 glow-ring space-y-4">
        <label htmlFor="need" className="block font-display text-xl font-extrabold">
          What do you need AI for?
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="need"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. answering phone orders for a pizza shop"
            maxLength={160}
            className="flex-1 min-h-12 rounded-xl border-2 border-line bg-surface-2 px-4 text-lg focus:border-gold"
          />
          <button
            disabled={running}
            className="min-h-12 px-6 rounded-xl bg-brand text-white font-bold text-lg hover:bg-brand-hover disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {running && <span aria-hidden className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {running ? "Discovering…" : "Discover new tools"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Or pick a problem">
          {USE_CASES.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUseCase(useCase === u.id ? null : u.id)}
              aria-pressed={useCase === u.id}
              className={`min-h-10 px-3 rounded-full border text-sm font-bold transition ${
                useCase === u.id ? "bg-gold text-black border-gold" : "border-line text-muted hover:text-white hover:border-white/40"
              }`}
            >
              {u.short}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-warn font-bold">
            {error}
          </p>
        )}
      </form>

      {/* Pipeline */}
      <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2" aria-label="Discovery progress">
        {STAGES.map((s, i) => {
          const active = running && stage === s.id;
          const on = reached(s.id) || (!!done && true);
          return (
            <li
              key={s.id}
              className={`relative rounded-2xl border p-4 transition-all duration-500 ${
                active ? "border-gold bg-gold/10 shadow-[0_0_30px_-8px_rgba(255,210,0,.6)]" : on ? "border-brand/60 bg-brand/10" : "border-line bg-surface/70"
              }`}
              aria-current={active ? "step" : undefined}
            >
              <p className={`font-display text-xs font-extrabold tracking-[0.2em] ${active ? "text-gold" : on ? "text-white" : "text-muted"}`}>
                0{i + 1}
              </p>
              <p className="font-bold mt-1 flex items-center gap-2">
                {on && !active ? <span className="text-gold">✓</span> : active ? <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-gold animate-pulse" /> : null}
                {s.label}
              </p>
              <p className="text-sm text-muted">{s.detail}</p>
            </li>
          );
        })}
      </ol>

      <div ref={resultsRef} className="grid gap-6 lg:grid-cols-[1.4fr_1fr] scroll-mt-24">
        <section aria-label="Products being investigated" className="space-y-3">
          {cands.length === 0 && !running && !done && (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              Results appear here as we find, read and verify each product.
            </p>
          )}
          {cands.map((c) => {
            const r = c.result;
            const ok = r?.status === "published";
            return (
              <article
                key={c.name}
                className={`rounded-2xl border p-4 animate-[fadeUp_.35s_ease-out_both] ${
                  ok ? "border-gold bg-gold/10" : r ? "border-line bg-surface" : "border-line bg-surface-2"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.url && <ToolLogo name={c.name} url={c.url} size={40} />}
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-extrabold">{c.name}</h3>
                      {c.url && <p className="text-sm text-muted break-all">{c.url.replace(/^https?:\/\//, "")}</p>}
                    </div>
                  </div>
                  {r ? (
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold border ${
                        ok ? "bg-gold text-black border-gold" : r.status === "failed" ? "border-line text-muted" : "border-brand/60 bg-brand/15 text-warn"
                      }`}
                    >
                      {ok ? "✓ Added to directory" : r.status === "failed" ? "Couldn't read site" : "Held for review"}
                    </span>
                  ) : (
                    <span className="rounded-full px-3 py-1 text-sm font-bold border border-line text-muted inline-flex items-center gap-2">
                      <span aria-hidden className="h-2 w-2 rounded-full bg-gold animate-pulse" />
                      {STAGES.find((s) => s.id === c.stage)?.label}
                    </span>
                  )}
                </div>
                <p className="mt-2">{c.message}</p>
                {r && r.checks !== undefined && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex gap-1" aria-label={`${r.checks} of 6 vendor checks passed`}>
                      {Array.from({ length: 6 }, (_, i) => (
                        <span key={i} className={`h-2 w-6 rounded-full ${i < r.checks! ? "bg-gold" : "bg-line-strong"}`} />
                      ))}
                    </span>
                    <span className="text-muted">{r.checks}/6 checks</span>
                    {r.price && <span className="text-muted">· {r.price}</span>}
                  </div>
                )}
                {ok && r?.slug && (
                  <Link href={`/tools/${r.slug}`} className="mt-3 inline-flex min-h-11 items-center font-bold text-gold underline underline-offset-4">
                    See its new listing →
                  </Link>
                )}
              </article>
            );
          })}
          {done && (
            <p className="rounded-2xl border border-line bg-surface p-4 font-bold" role="status">
              {done.message} {done.held > 0 && `${done.held} held for review: we only list companies with a track record and full checks.`}
            </p>
          )}
        </section>

        <section aria-label="Live log" className="rounded-2xl border border-line bg-black/60 p-4 font-mono text-sm min-h-40">
          <p className="text-muted mb-2">Live log</p>
          <ul className="space-y-1.5" aria-live="polite">
            {feed.map((f, i) => (
              <li key={i} className="animate-[fadeUp_.25s_ease-out_both]">
                <span className="text-gold">›</span> {f}
              </li>
            ))}
            {running && <li className="text-muted animate-pulse">working…</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
