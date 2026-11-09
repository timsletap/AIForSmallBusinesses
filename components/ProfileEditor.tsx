"use client";

import type { Profile } from "@/lib/schemas/profile";
import { INDUSTRIES } from "@/lib/taxonomy/industries";
import { CURRENT_TOOLS, type ToolId } from "@/lib/taxonomy/tools";
import { USE_CASES, type UseCaseId } from "@/lib/taxonomy/useCases";

const chip = (on: boolean) =>
  `min-h-11 px-3 rounded-full border-2 text-[0.95rem] font-bold cursor-pointer select-none inline-flex items-center gap-1.5 ${
    on ? "bg-brand text-on-brand border-brand" : "bg-surface-2 border-line hover:border-brand"
  }`;

const COMFORT = [
  { id: "low", label: "Keep it simple" },
  { id: "medium", label: "I can figure it out" },
  { id: "high", label: "I'm comfortable" },
] as const;

/** Compact editor for the owner's answers. Every change calls onChange right away (scores update live). */
export function ProfileEditor({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const set = (patch: Partial<Profile>) => onChange({ ...value, ...patch });
  const toggleUseCase = (id: UseCaseId) => {
    const has = value.use_cases.includes(id);
    if (has && value.use_cases.length === 1) return; // at least one problem
    set({ use_cases: has ? value.use_cases.filter((u) => u !== id) : [...value.use_cases, id].slice(-2) });
  };
  const toggleTool = (id: ToolId) => {
    const has = value.current_tools.includes(id);
    const current_tools = has ? value.current_tools.filter((t) => t !== id) : [...value.current_tools.filter((t) => t !== "none"), id];
    set({ current_tools, must_work_with: value.must_work_with.filter((m) => current_tools.includes(m)) });
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="font-bold mb-1.5">What do you need help with? (up to 2)</legend>
        <div className="flex flex-wrap gap-2">
          {USE_CASES.map((u) => (
            <label key={u.id} className={chip(value.use_cases.includes(u.id))}>
              <input type="checkbox" className="sr-only" checked={value.use_cases.includes(u.id)} onChange={() => toggleUseCase(u.id)} />
              {value.use_cases.includes(u.id) && <span aria-hidden>✓</span>}
              {u.short}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-bold">Your business</span>
          <select
            value={value.industry}
            onChange={(e) => set({ industry: e.target.value as Profile["industry"] })}
            className="mt-1 block w-full min-h-11 rounded-xl border-2 border-line bg-surface-2 px-3"
          >
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-bold">
            Budget: <span className="tabular-nums">{value.budget_usd === 0 ? "free only" : `$${value.budget_usd}/month`}</span>
          </span>
          <input
            type="range"
            min={0}
            max={500}
            step={5}
            value={Math.min(value.budget_usd, 500)}
            onChange={(e) => set({ budget_usd: Number(e.target.value) })}
            className="mt-3 block w-full h-2 accent-[var(--brand)] cursor-pointer"
            aria-valuetext={value.budget_usd === 0 ? "Free only" : `${value.budget_usd} dollars per month`}
          />
        </label>
      </div>

      <fieldset>
        <legend className="font-bold mb-1.5">What you already use</legend>
        <div className="flex flex-wrap gap-2">
          {CURRENT_TOOLS.filter((t) => t.id !== "none").map((t) => (
            <label key={t.id} className={chip(value.current_tools.includes(t.id))}>
              <input type="checkbox" className="sr-only" checked={value.current_tools.includes(t.id)} onChange={() => toggleTool(t.id)} />
              {value.current_tools.includes(t.id) && <span aria-hidden>✓</span>}
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-bold mb-1.5">Comfort with new apps</legend>
        <div className="flex flex-wrap gap-2">
          {COMFORT.map((c) => (
            <label key={c.id} className={chip(value.tech_comfort === c.id)}>
              <input
                type="radio"
                name="comfort-live"
                className="sr-only"
                checked={value.tech_comfort === c.id}
                onChange={() => set({ tech_comfort: c.id })}
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
