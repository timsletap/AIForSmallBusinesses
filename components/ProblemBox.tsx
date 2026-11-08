"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProblemBox() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) {
      setMsg("Tell us a little about the problem, or pick one of the cards below.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { use_cases?: string[]; confidence?: number };
      if (res.ok && data.use_cases?.length && (data.confidence ?? 0) >= 0.5) {
        const sp = new URLSearchParams({ q: text, uc: data.use_cases.join(",") });
        router.push(`/advisor?${sp}`);
        return;
      }
      const sp = new URLSearchParams({ q: text, pick: "1" });
      if (data.use_cases?.length) sp.set("uc", data.use_cases.join(","));
      router.push(`/advisor?${sp}`);
    } catch {
      setMsg("We couldn't read that right now. Please pick the problem closest to yours below.");
      document.getElementById("problems")?.scrollIntoView({ behavior: "smooth" });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="problem" className="block text-xl font-bold">
        What&apos;s slowing your business down?
      </label>
      <textarea
        id="problem"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="For example: We miss calls during the lunch rush and lose takeout orders."
        className="w-full rounded-xl border-2 border-line bg-white p-3 text-lg focus:border-brand"
        maxLength={2000}
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto min-h-12 px-6 rounded-xl bg-brand text-white text-lg font-bold hover:bg-brand-strong disabled:opacity-70"
      >
        {busy ? "Reading your problem…" : "Find AI for my business"}
      </button>
      <p role="status" aria-live="polite" className="text-amber-900">
        {msg}
      </p>
    </form>
  );
}
