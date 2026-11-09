"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoveryRun, Tool } from "@/lib/schemas/tool";
import { INDUSTRIES } from "@/lib/taxonomy/industries";
import { USE_CASES } from "@/lib/taxonomy/useCases";

const KEY = "atm-admin-pw";
const input = "block w-full min-h-11 rounded-xl border-2 border-line bg-white px-3";

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [storage, setStorage] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useCase, setUseCase] = useState<string>(USE_CASES[0].id);
  const [industry, setIndustry] = useState<string>("restaurant");
  const [query, setQuery] = useState("");
  const [lastRun, setLastRun] = useState<DiscoveryRun | null>(null);
  const [filter, setFilter] = useState<"all" | Tool["status"]>("all");

  const load = useCallback(async (password: string) => {
    const res = await fetch("/api/admin/discover", { headers: { "x-admin-password": password } });
    if (res.status === 401) {
      setAuthed(false);
      setMsg("Wrong password.");
      return false;
    }
    const data = await res.json();
    setTools(data.tools);
    setRuns(data.runs);
    setStorage(data.storage);
    setAuthed(true);
    return true;
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) {
        setPw(saved);
        void load(saved);
      }
    } catch {
      // Storage unavailable.
    }
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (await load(pw)) {
      try {
        sessionStorage.setItem(KEY, pw);
      } catch {
        // Storage unavailable.
      }
    }
  }

  async function discover(e: React.FormEvent) {
    e.preventDefault();
    await runJob("Running discovery. This can take 1 to 3 minutes…", () =>
      fetch("/api/admin/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": pw },
        body: JSON.stringify(query.trim() ? { query: query.trim(), use_case: useCase } : { use_case: useCase, industry }),
      }),
    );
  }

  /** Same job the daily cron runs: re-check the 3 tools checked longest ago. */
  async function refreshOldest() {
    await runJob("Re-checking the 3 oldest tools. This can take 1 to 3 minutes…", () =>
      fetch("/api/cron/refresh", { headers: { "x-admin-password": pw } }),
    );
  }

  async function runJob(startMsg: string, call: () => Promise<Response>) {
    setBusy(true);
    setMsg(startMsg);
    setLastRun(null);
    try {
      const res = await call();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Run failed");
      setLastRun(data.run);
      setMsg(`Done: ${JSON.stringify(data.run.counts)}`);
      await load(pw);
    } catch (err) {
      setMsg(`Run failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "verify" | "unverify" | "reject" | "recheck") {
    if (action === "recheck") setMsg("Re-checking the vendor's site. This takes about a minute…");
    const res = await fetch(`/api/admin/tools/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error?.message ?? "Action failed");
    setTools((ts) => ts.map((t) => (t.id === id ? data.tool : t)));
    if (action === "recheck") setMsg((data.log as string[]).filter((l) => /^[✓✗]/.test(l)).join(" ") || "Re-check finished.");
  }

  if (!authed) {
    return (
      <form onSubmit={login} className="max-w-sm space-y-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <label className="block">
          <span className="font-bold">Password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={input} autoComplete="current-password" />
        </label>
        <button className="min-h-11 px-5 rounded-xl bg-brand text-white font-bold">Sign in</button>
        <p role="alert" className="text-red-800">
          {msg}
        </p>
      </form>
    );
  }

  const shown = tools.filter((t) => filter === "all" || t.status === filter);
  const counts = { published: 0, draft: 0, rejected: 0 } as Record<Tool["status"], number>;
  tools.forEach((t) => counts[t.status]++);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted">
          Storage: <strong>{storage}</strong>
          {storage === "json" && " (changes on a hosted server last until it restarts; add Supabase keys to keep them)"}
          {" · "}
          {counts.published} published, {counts.draft} draft, {counts.rejected} rejected
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xl font-bold">Run discovery</h2>
        <form onSubmit={discover} className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="font-bold">Use case</span>
            <select value={useCase} onChange={(e) => setUseCase(e.target.value)} className={input}>
              {USE_CASES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="font-bold">Industry</span>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={input}>
              {INDUSTRIES.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="font-bold">Or a custom search query (optional)</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={input} placeholder="e.g. AI phone answering for pizza shops" />
          </label>
          <button disabled={busy} className="min-h-11 px-5 rounded-xl bg-brand text-white font-bold disabled:opacity-60 sm:w-fit">
            {busy ? "Running…" : "Run (up to 3 candidates)"}
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={refreshOldest}
            disabled={busy}
            className="min-h-11 px-5 rounded-xl border-2 border-brand text-brand-strong bg-white font-bold disabled:opacity-60"
          >
            Refresh the 3 oldest tools now
          </button>
          <span className="text-sm text-muted">This also runs by itself once a day.</span>
        </div>
        <p role="status" className="font-bold">
          {msg}
        </p>
        {lastRun && (
          <pre className="text-sm bg-stone-900 text-stone-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{lastRun.log.join("\n")}</pre>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Tools ({shown.length})</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="min-h-11 rounded-xl border-2 border-line px-3" aria-label="Filter by status">
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm text-left">
            <thead className="border-b-2 border-foreground">
              <tr>
                <th className="p-2">Tool</th>
                <th className="p-2">Status</th>
                <th className="p-2">Trust</th>
                <th className="p-2">Checks</th>
                <th className="p-2">Price</th>
                <th className="p-2">Missing</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className="border-b border-line align-top">
                  <td className="p-2">
                    <a href={`/tools/${t.slug}`} className="underline font-bold">
                      {t.name}
                    </a>
                    <div className="text-muted">{t.use_cases.join(", ")}</div>
                    <a href={t.canonical_url} target="_blank" rel="noreferrer" className="text-muted underline">
                      {t.canonical_url}
                    </a>
                  </td>
                  <td className="p-2">{t.status}</td>
                  <td className="p-2">
                    {t.trust_level}
                    {t.admin_reviewed && " ✔"}
                  </td>
                  <td className="p-2">{Object.values(t.vendor_checks).filter((c) => c.pass).length}/6</td>
                  <td className="p-2">
                    {t.pricing.est_monthly_usd_min ?? "?"}
                    {t.pricing.free_plan ? " (free plan)" : ""}
                  </td>
                  <td className="p-2">{t.missing_fields.join(", ") || "–"}</td>
                  <td className="p-2 space-x-2 whitespace-nowrap">
                    {t.admin_reviewed ? (
                      <button onClick={() => act(t.id, "unverify")} className="min-h-9 px-3 rounded-lg border-2 border-green-800 text-green-900 bg-white font-bold">
                        Unverify
                      </button>
                    ) : (
                      <button onClick={() => act(t.id, "verify")} className="min-h-9 px-3 rounded-lg bg-green-800 text-white font-bold">
                        Verify
                      </button>
                    )}
                    <button onClick={() => act(t.id, "reject")} disabled={t.status === "rejected"} className="min-h-9 px-3 rounded-lg bg-red-800 text-white font-bold disabled:opacity-40">
                      Reject
                    </button>
                    <button onClick={() => act(t.id, "recheck")} className="min-h-9 px-3 rounded-lg border-2 border-line bg-white font-bold">
                      Re-check
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Recent runs</h2>
        {runs.length === 0 && <p className="text-muted">No runs yet.</p>}
        {runs.map((r) => (
          <details key={r.id} className="rounded-xl border border-line bg-surface">
            <summary className="p-3">
              {new Date(r.started_at).toLocaleString()} · {String(r.query.query)} · {r.status} · {JSON.stringify(r.counts)}
            </summary>
            <pre className="text-sm bg-stone-900 text-stone-100 p-3 overflow-x-auto whitespace-pre-wrap">{r.log.join("\n")}</pre>
          </details>
        ))}
      </section>
    </div>
  );
}
