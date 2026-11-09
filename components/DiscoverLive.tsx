"use client";

import Link from "next/link";
import { useState } from "react";
import type { DiscoverEvent, Stage } from "@/lib/pipeline/events";
import { APPROVAL_RULES } from "@/lib/pipeline/approval";
import { ToolLogo } from "@/components/ToolLogo";

const STAGES: { id: Stage; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "site", label: "Read site" },
  { id: "extract", label: "Read details" },
  { id: "verify", label: "Check" },
  { id: "save", label: "Results" },
];
const ORDER = STAGES.map((s) => s.id);

const SUGGESTIONS = ["Email marketing for a bakery", "Booking for a barbershop", "Phone answering for a plumber"];

type Result = Extract<DiscoverEvent, { type: "result" }>;
type Cand = { name: string; url?: string; stage: Stage; message: string; result?: Result };

function RuleList({ rules }: { rules: NonNullable<Result["rules"]> }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {rules.map((r) => (
        <li key={r.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${r.pass ? "border-gold/30 bg-gold/[0.06]" : "border-brand/40 bg-brand/[0.08]"}`}>
          <span
            aria-hidden
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${r.pass ? "bg-gold text-black" : "bg-brand text-white"}`}
          >
            {r.pass ? "✓" : "✕"}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              <span className="sr-only">{r.pass ? "Passed: " : "Failed: "}</span>
              {r.label}
            </span>
            <span className="block text-xs text-muted">{r.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DiscoverLive() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [done, setDone] = useState<Extract<DiscoverEvent, { type: "done" }> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setStatus(e.message);
        break;
      case "candidates":
        setStage("site");
        setStatus(e.names.length ? `Found ${e.names.length} new product${e.names.length === 1 ? "" : "s"} to check` : "Everything found is already in the directory");
        e.names.forEach((n) => upsert(n, { stage: "site", message: "Waiting" }));
        break;
      case "candidate":
        setStage(e.stage);
        upsert(e.name, { url: e.url, stage: e.stage, message: e.message });
        break;
      case "result":
        setStage("save");
        upsert(e.name, { stage: "save", message: e.detail, result: e, url: e.url });
        break;
      case "done":
        setDone(e);
        setStatus(e.message);
        break;
      case "error":
        setError(e.message);
        break;
    }
  }

  async function run(q: string) {
    if (q.trim().length < 3) return setError("Tell us what you need help with.");
    setQuery(q);
    setRunning(true);
    setError(null);
    setDone(null);
    setCands([]);
    setStage("search");
    setStatus(`Searching the web for “${q.trim()}”`);
    try {
      // Step 1: search once, get signed candidates.
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) throw new Error(j?.error?.message ?? "Discovery couldn't start. Please try again.");
      const list = j.candidates as { name: string; url: string; token: string }[];
      handle({ type: "candidates", names: list.map((c) => c.name) });

      // Step 2: one vendor per request, so a slow site can't time out the whole run.
      let approved = 0;
      let held = 0;
      for (const c of list) {
        upsert(c.name, { url: c.url, stage: "site", message: "Opening the official website" });
        const pr = await fetch("/api/discover/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: j.runId, ...c }),
        });
        if (!pr.ok || !pr.body) {
          const pj = await pr.json().catch(() => null);
          handle({ type: "result", name: c.name, status: "failed", url: c.url, detail: pj?.error?.message ?? "Couldn't check this vendor" });
          continue;
        }
        await readStream(pr.body, (e) => {
          if (e.type === "result") {
            if (e.status === "published") approved++;
            else held++;
            // Keep the card keyed by the search name even if the site calls itself something else.
            handle({ ...e, name: c.name });
          } else if (e.type === "candidate") {
            handle({ ...e, name: c.name });
          } else handle(e);
        });
      }
      handle({
        type: "done",
        approved,
        held,
        message: list.length === 0 ? "No new tools this time: everything we found is already in the directory." : `${approved} new tool${approved === 1 ? "" : "s"} added to the directory.`,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function readStream(body: ReadableStream<Uint8Array>, onEvent: (e: DiscoverEvent) => void) {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) if (l.trim()) onEvent(JSON.parse(l) as DiscoverEvent);
    }
    if (buf.trim()) onEvent(JSON.parse(buf) as DiscoverEvent);
  }

  const stageIdx = stage ? ORDER.indexOf(stage) : -1;
  const started = running || !!done || cands.length > 0;

  return (
    <div className="space-y-6">
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="mx-auto max-w-3xl space-y-4"
      >
        <label htmlFor="need" className="sr-only">
          What do you need help with?
        </label>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2 sm:flex-row focus-within:border-gold/60 transition">
          <input
            id="need"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. phone orders for a pizza shop"
            maxLength={160}
            className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-lg outline-none placeholder:text-muted"
          />
          <button
            disabled={running}
            className="min-h-12 rounded-xl bg-white px-6 font-bold text-black transition hover:bg-gold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {running && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
            {running ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={running}
              onClick={() => void run(s)}
              className="rounded-full border border-line px-3 py-1 text-muted transition hover:border-white/40 hover:text-white disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-center font-bold text-warn">
            {error}
          </p>
        )}
      </form>

      {/* Progress */}
      {started && (
        <div className="mx-auto max-w-4xl space-y-3" aria-label="Discovery progress">
          <ol className="relative grid grid-cols-5">
            <div aria-hidden className="absolute left-[10%] right-[10%] top-[11px] h-px bg-line" />
            <div
              aria-hidden
              className="absolute left-[10%] top-[11px] h-px bg-gradient-to-r from-brand to-gold transition-all duration-700"
              style={{ width: `${Math.max(0, stageIdx) * 20}%` }}
            />
            {STAGES.map((s, i) => {
              const state = done || i < stageIdx ? "done" : i === stageIdx && running ? "active" : "todo";
              return (
                <li key={s.id} className="relative flex flex-col items-center gap-2" aria-current={state === "active" ? "step" : undefined}>
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full border text-[0.65rem] font-semibold transition ${
                      state === "done"
                        ? "border-gold bg-gold text-black"
                        : state === "active"
                          ? "border-gold bg-background text-gold shadow-[0_0_18px_rgba(255,210,0,.55)]"
                          : "border-line bg-background text-muted"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={`text-xs text-center ${state === "todo" ? "text-muted" : "text-white"}`}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {status && (
            <p className="text-center text-sm text-muted" role="status" aria-live="polite">
              {status}
            </p>
          )}
        </div>
      )}

      {/* Results, or the rules before any search */}
      {cands.length > 0 ? (
        <section aria-label="Products checked" className="mx-auto max-w-4xl space-y-4">
          {cands.map((c) => {
            const r = c.result;
            const ok = r?.status === "published";
            return (
              <article
                key={c.name}
                className={`rounded-2xl border bg-surface p-4 animate-[fadeUp_.35s_ease-out_both] ${ok ? "border-gold/60" : "border-line"}`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {c.url ? <ToolLogo name={c.name} url={c.url} size={44} /> : <span className="h-11 w-11 rounded-xl bg-surface-2" />}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                    {c.url && <p className="truncate text-sm text-muted">{c.url.replace(/^https?:\/\//, "")}</p>}
                  </div>
                  {r ? (
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        ok ? "bg-gold text-black" : r.status === "failed" ? "border border-line text-muted" : "border border-brand/60 text-warn"
                      }`}
                    >
                      {ok ? "Added to directory" : r.status === "failed" ? "Couldn't read site" : "Held back"}
                    </span>
                  ) : (
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-gold">{STAGES.find((s) => s.id === c.stage)?.label}…</span>
                  )}
                </div>
                {r?.description && <p className="mt-3 text-sm text-muted">{r.description}</p>}
                {!r && <p className="mt-3 text-sm text-muted">{c.message}</p>}
                {r && !ok && <p className="mt-3 text-sm text-muted">{r.detail}</p>}
                {r?.rules && (
                  <details className="mt-3">
                    <summary className="min-h-9 cursor-pointer text-sm text-muted">View checks</summary>
                    <RuleList rules={r.rules} />
                  </details>
                )}
                {(r?.price || (ok && r?.slug)) && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                    <span className="text-muted">{r?.price}</span>
                    {ok && r?.slug && (
                      <Link href={`/tools/${r.slug}`} className="font-bold text-gold hover:underline">
                        View tool →
                      </Link>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {done && (
            <p className="text-center text-sm text-muted">
              {done.approved > 0
                ? `${done.approved} added to the directory.`
                : "Nothing added. Tools with missing checks need a review."}
            </p>
          )}
        </section>
      ) : (
        !running && (
          <details className="mx-auto max-w-3xl rounded-xl border border-line px-4">
            <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted">How tools get added</summary>
            <ol className="grid gap-3 pb-4 sm:grid-cols-2">
              {APPROVAL_RULES.map((r) => (
                <li key={r.id}>
                  <p className="text-sm font-bold">{r.label}</p>
                  <p className="text-sm text-muted">{r.detail}</p>
                </li>
              ))}
            </ol>
          </details>
        )
      )}
    </div>
  );
}
