"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Factor } from "@/lib/ranking/score";

/** Plain-word band for a Fit Score, so meaning never depends on color alone. */
export function fitBand(score: number): { label: string; color: string; soft: string } {
  if (score >= 80) return { label: "Great match", color: "#ffd200", soft: "rgba(255,210,0,0.12)" };
  if (score >= 65) return { label: "Good match", color: "#ffffff", soft: "rgba(255,255,255,0.08)" };
  if (score >= 50) return { label: "Fair match", color: "#a8a8ad", soft: "rgba(255,255,255,0.05)" };
  return { label: "Weak match", color: "#ff8a96", soft: "rgba(226,24,51,0.12)" };
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Number that eases from its previous value to `value`. */
function useAnimatedNumber(value: number, reduce: boolean): number {
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (value - a) * eased);
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return shown;
}

/** Semicircle gauge that fills to the score. */
function Gauge({ score, size }: { score: number; size: number }) {
  const reduce = usePrefersReducedMotion();
  const shown = useAnimatedNumber(score, reduce);
  const band = fitBand(score);
  const r = 40;
  const arc = Math.PI * r;
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" aria-hidden className="block">
      <path d="M10 52 A40 40 0 0 1 90 52" fill="none" stroke="#2a2a2f" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M10 52 A40 40 0 0 1 90 52"
        fill="none"
        stroke={band.color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={arc}
        strokeDashoffset={arc * (1 - shown / 100)}
      />
      <text x="50" y="50" textAnchor="middle" fontSize="22" fontWeight="700" fill="#ffffff">
        {shown}
      </text>
    </svg>
  );
}

/**
 * Fit Score meter with a pop-up breakdown: gauge + plain-word band; tapping opens each factor's
 * animated bar and the reasons.
 */
export function FitMeter({
  score,
  factors,
  reasons = [],
  size = 104,
  defaultOpen = false,
}: {
  score: number;
  factors: Factor[];
  reasons?: string[];
  size?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [grown, setGrown] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const band = fitBand(score);

  useEffect(() => {
    if (!open) return setGrown(false);
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  // Pop-up closes on Escape or a tap outside it.
  useEffect(() => {
    if (!open || defaultOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, defaultOpen]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Fit Score ${score} out of 100, ${band.label}. ${open ? "Hide" : "Show"} why.`}
        className="group flex flex-col items-center rounded-2xl px-2 pt-1 pb-1.5 min-h-11 transition-colors hover:bg-surface-2"
        style={{ background: open ? band.soft : undefined }}
      >
        <Gauge score={score} size={size} />
        <span className="text-sm font-bold leading-tight" style={{ color: band.color }}>
          {band.label}
        </span>
        <span className="text-xs text-muted underline decoration-dotted group-hover:decoration-solid">
          {open ? "Hide why" : "Why this score?"}
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-label="Fit Score breakdown"
        hidden={!open}
        className={
          defaultOpen
            ? "mt-2 rounded-2xl border border-line bg-surface p-3"
            : "absolute right-0 top-full z-30 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 shadow-xl text-left"
        }
      >
        <p className="font-bold mb-2">
          Fit Score {score} / 100: {band.label.toLowerCase()} for your business
        </p>
        <ul className="space-y-2">
          {factors.map((f) => (
            <li key={f.id}>
              <div className="flex justify-between text-sm">
                <span>{f.label}</span>
                <span className="tabular-nums text-muted">
                  {Math.round(f.points)} of {f.weight} pts
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-line-strong overflow-hidden" aria-hidden>
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: grown ? `${f.f * 100}%` : "0%", background: fitBand(f.f * 100).color }}
                />
              </div>
            </li>
          ))}
        </ul>
        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden>•</span>
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
