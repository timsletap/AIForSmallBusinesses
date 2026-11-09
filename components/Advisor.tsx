"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { INDUSTRIES } from "@/lib/taxonomy/industries";
import { CURRENT_TOOLS } from "@/lib/taxonomy/tools";
import { USE_CASES, USE_CASE_IDS } from "@/lib/taxonomy/useCases";

const BUDGETS = [0, 25, 50, 100, 200, 500];
const COMFORT = [
  { id: "low", label: "I'd like it simple", hint: "I don't love new apps" },
  { id: "medium", label: "I can figure it out", hint: "I use a few apps already" },
  { id: "high", label: "I'm comfortable", hint: "I set up apps on my own" },
] as const;

const chip = (on: boolean) =>
  `min-h-11 px-4 rounded-full border-2 font-bold text-base cursor-pointer select-none inline-flex items-center gap-2 ${
    on ? "bg-brand text-on-brand border-brand" : "bg-surface-2 border-line hover:border-brand"
  }`;

const option = (on: boolean) =>
  `flex items-center gap-3 min-h-12 px-4 rounded-xl border-2 cursor-pointer ${
    on ? "border-brand bg-brand-soft" : "border-line bg-surface-2 hover:border-brand"
  }`;

export function Advisor() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const initialUc = (sp.get("uc") ?? "").split(",").filter((u) => (USE_CASE_IDS as readonly string[]).includes(u));
  const unsure = sp.get("pick") === "1" || initialUc.length === 0;

  const [step, setStep] = useState(0);
  const [useCases, setUseCases] = useState<string[]>(initialUc);
  const [editProblem, setEditProblem] = useState(unsure);
  const [industry, setIndustry] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [must, setMust] = useState<string[]>([]);
  const [comfort, setComfort] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max = 99) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < max) set([...list, id]);
  };

  function next() {
    setError(null);
    if (step === 0) {
      if (!useCases.length) return setError("Pick at least one problem.");
      if (!industry) return setError("Pick the kind of business you run.");
    }
    if (step === 1) {
      const b = customBudget ? Number(customBudget) : budget;
      if (b === null || !Number.isFinite(b) || b < 0) return setError("Pick a monthly budget, or type an amount.");
    }
    if (step === 2) {
      if (!comfort) return setError("Tell us how comfortable you are with new apps.");
      const b = customBudget ? Number(customBudget) : budget!;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("uc", useCases.join(","));
      params.set("industry", industry);
      params.set("budget", String(Math.round(b)));
      const realTools = tools.filter((t) => t !== "none");
      if (realTools.length) params.set("tools", realTools.join(","));
      const m = must.filter((x) => realTools.includes(x));
      if (m.length) params.set("must", m.join(","));
      params.set("comfort", comfort);
      router.push(`/results?${params}`);
      return;
    }
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  }

  const STEPS = ["Your business", "Your budget", "What you use"];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-muted font-bold">
          Step {step + 1} of 3: {STEPS[step]}
        </p>
        <div
          className="mt-2 h-3 rounded-full bg-line-strong overflow-hidden"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={step + 1}
        >
          <div className="h-full bg-brand transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
      </div>

      {step === 0 && (
        <>
          <fieldset className="space-y-3">
            <legend className="text-xl font-bold mb-2">What do you need help with?</legend>
            {q && (
              <p className="rounded-xl bg-surface-2 p-3 text-muted">
                You said: <q className="italic">{q}</q>
              </p>
            )}
            {!editProblem && useCases.length > 0 ? (
              <div className="space-y-2">
                <p>We think this is about:</p>
                <ul className="space-y-1">
                  {useCases.map((u) => (
                    <li key={u} className="font-bold text-brand-strong">
                      ✓ {USE_CASES.find((x) => x.id === u)?.label}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setEditProblem(true)} className="underline min-h-11">
                  Not quite? Change it
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {unsure && q && <p className="text-warn">We weren&apos;t sure. Pick one or two that fit best:</p>}
                {USE_CASES.map((u) => (
                  <label key={u.id} className={option(useCases.includes(u.id))}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--brand)]"
                      checked={useCases.includes(u.id)}
                      onChange={() => toggle(useCases, setUseCases, u.id, 2)}
                    />
                    <span className="font-bold">{u.label}</span>
                  </label>
                ))}
                <p className="text-sm text-muted">You can pick up to 2.</p>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xl font-bold mb-2">What kind of business do you run?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {INDUSTRIES.map((i) => (
                <label key={i.id} className={option(industry === i.id)}>
                  <input
                    type="radio"
                    name="industry"
                    className="h-5 w-5 accent-[var(--brand)]"
                    checked={industry === i.id}
                    onChange={() => setIndustry(i.id)}
                  />
                  <span className="font-bold">{i.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {step === 1 && (
        <fieldset className="space-y-3">
          <legend className="text-xl font-bold mb-2">How much could you spend each month?</legend>
          <p className="text-muted">Choose a budget. Any higher prices will be marked.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BUDGETS.map((b) => (
              <label key={b} className={option(budget === b && !customBudget)}>
                <input
                  type="radio"
                  name="budget"
                  className="h-5 w-5 accent-[var(--brand)]"
                  checked={budget === b && !customBudget}
                  onChange={() => {
                    setBudget(b);
                    setCustomBudget("");
                  }}
                />
                <span className="font-bold">{b === 0 ? "Free only" : `$${b}`}</span>
              </label>
            ))}
          </div>
          <label className="block">
            <span className="font-bold">Or type an amount ($ per month)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={customBudget}
              onChange={(e) => setCustomBudget(e.target.value)}
              className="mt-1 block w-40 min-h-11 rounded-xl border-2 border-line px-3 text-lg"
            />
          </label>
        </fieldset>
      )}

      {step === 2 && (
        <>
          <fieldset className="space-y-3">
            <legend className="text-xl font-bold mb-2">What do you already use?</legend>
            <p className="text-muted">Pick all that apply, including paper or a phone.</p>
            <div className="flex flex-wrap gap-2">
              {CURRENT_TOOLS.map((t) => (
                <label key={t.id} className={chip(tools.includes(t.id))}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={tools.includes(t.id)}
                    onChange={() => {
                      if (t.id === "none") setTools(tools.includes("none") ? [] : ["none"]);
                      else toggle(tools.filter((x) => x !== "none"), setTools, t.id);
                    }}
                  />
                  {tools.includes(t.id) && <span aria-hidden>✓</span>}
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          {tools.filter((t) => !["none", "paper"].includes(t)).length > 0 && (
            <fieldset className="space-y-2">
              <legend className="font-bold mb-1">Must it connect to any of these? (optional)</legend>
              <div className="flex flex-wrap gap-2">
                {tools
                  .filter((t) => !["none", "paper"].includes(t))
                  .map((id) => (
                    <label key={id} className={chip(must.includes(id))}>
                      <input type="checkbox" className="sr-only" checked={must.includes(id)} onChange={() => toggle(must, setMust, id)} />
                      {must.includes(id) && <span aria-hidden>✓</span>}
                      {CURRENT_TOOLS.find((t) => t.id === id)?.label}
                    </label>
                  ))}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xl font-bold mb-2">How comfortable are you with new apps?</legend>
            {COMFORT.map((c) => (
              <label key={c.id} className={option(comfort === c.id)}>
                <input
                  type="radio"
                  name="comfort"
                  className="h-5 w-5 accent-[var(--brand)]"
                  checked={comfort === c.id}
                  onChange={() => setComfort(c.id)}
                />
                <span>
                  <span className="font-bold block">{c.label}</span>
                  <span className="text-muted text-sm">{c.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}

      <p role="alert" className="text-bad font-bold min-h-6">
        {error}
      </p>

      <div className="flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="min-h-12 px-5 rounded-xl border-2 border-brand text-brand-strong font-bold bg-surface-2"
          >
            Back
          </button>
        )}
        <button type="button" onClick={next} className="flex-1 sm:flex-none min-h-12 px-6 rounded-xl bg-brand text-on-brand font-bold text-lg hover:bg-brand-hover">
          {step === 2 ? "Show my matches" : "Next"}
        </button>
      </div>
    </div>
  );
}
