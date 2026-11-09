"use client";

import { useMemo, useState } from "react";
import type { Factor } from "@/lib/ranking/score";

/**
 * Validated categorical palette for up to 3 tools on the dark surface (#0f0f10):
 * UMD red, blue, UMD gold. Blue sits between red and gold because those two converge for
 * deuteranopes; every series also gets a direct label and a legend, so color is never alone.
 */
export const SERIES = ["#e8455a", "#4a8fe0", "#b38b00"];

export type ChartTool = {
  name: string;
  min: number | null;
  max: number | null;
  freePlan: boolean;
  plan: string | null;
  factors: Factor[] | null;
};

const money = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toLocaleString()}`;

function Legend({ tools }: { tools: ChartTool[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
      {tools.map((t, i) => (
        <li key={t.name} className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
          {t.name}
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      {children}
    </section>
  );
}

/** Monthly price range per tool (cheapest → highest listed plan) against the owner's budget. */
export function PriceChart({ tools, budget }: { tools: ChartTool[]; budget: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(budget ?? 0, ...tools.map((t) => t.max ?? t.min ?? 0)) * 1.15 || 100;
  const x = (v: number) => (v / top) * 100;

  return (
    <Panel title="Monthly price" sub="From each vendor's own pricing page: cheapest plan to highest listed plan.">
      <div className="relative space-y-3" role="list">
        {tools.map((t, i) => {
          const lo = t.freePlan ? 0 : t.min;
          const hi = t.max ?? t.min;
          return (
            <div
              key={t.name}
              role="listitem"
              className="grid grid-cols-[7.5rem_1fr] items-center gap-3"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="truncate text-sm font-bold">{t.name}</span>
              <div className="relative h-9">
                <div aria-hidden className="absolute inset-y-[14px] left-0 right-0 rounded-full bg-white/5" />
                {lo == null ? (
                  <span className="absolute inset-y-0 left-0 flex items-center text-sm text-muted">Price not listed: ask the vendor</span>
                ) : (
                  <>
                    <div
                      aria-hidden
                      className="absolute top-[11px] h-[14px] rounded-[4px] transition-all duration-700"
                      style={{ left: `${x(lo)}%`, width: `max(14px, ${x((hi ?? lo) - lo)}%)`, background: SERIES[i], opacity: hover === null || hover === i ? 1 : 0.35 }}
                    />
                    <span
                      className="absolute top-0 text-xs font-bold tabular-nums whitespace-nowrap"
                      style={x(hi ?? lo) > 62 ? { right: `calc(${100 - x(hi ?? lo)}% + 6px)`, top: -8 } : { left: `calc(${x(hi ?? lo)}% + 18px)`, top: 9 }}
                    >
                      {lo === 0 && t.freePlan ? "Free" : money(lo)}
                      {hi && hi > lo ? ` – ${money(hi)}` : ""}
                    </span>
                  </>
                )}
                {hover === i && lo != null && (
                  <div role="tooltip" className="absolute z-10 -top-14 left-0 rounded-lg border border-line bg-black px-3 py-2 text-xs shadow-xl whitespace-nowrap">
                    <p className="font-bold">{t.name}{t.plan ? ` · ${t.plan}` : ""}</p>
                    <p className="text-muted">
                      {money(lo)}/mo = {money(Math.round(lo * 12))}/year{hi && hi > lo ? `; up to ${money(hi)}/mo` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {budget != null && budget > 0 && (
          // One dashed line across every row: label column is 7.5rem + 0.75rem gap.
          <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: `calc(8.25rem + (100% - 8.25rem) * ${x(budget) / 100})` }}>
            <div className="absolute inset-y-0 border-l-2 border-dashed border-white/50" />
            <span className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-white/80">Your budget {money(budget)}</span>
          </div>
        )}
      </div>
      {budget != null && budget > 0 && <div className="h-3" aria-hidden />}
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
        {tools.map((t, i) => {
          const lo = t.freePlan ? 0 : t.min;
          return (
            <div key={t.name} className="bg-surface p-3">
              <dt className="flex items-center gap-1.5 text-muted truncate">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: SERIES[i] }} />
                {t.name}
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{lo == null ? "Ask" : lo === 0 ? "$0" : money(Math.round(lo * 12))}</dd>
              <dd className="text-xs text-muted">per year to start</dd>
            </div>
          );
        })}
      </dl>
      {budget != null && budget > 0 && (
        <p className="text-sm text-muted">
          {tools.filter((t) => (t.freePlan ? 0 : t.min) != null && (t.freePlan ? 0 : t.min!) <= budget).length} of {tools.length} start within your{" "}
          {money(budget)}/month budget.
        </p>
      )}
    </Panel>
  );
}

/**
 * Payback estimator: value the owner expects (their own numbers) minus each tool's monthly price,
 * accumulated over 12 months. Clearly an estimate from the owner's inputs, not a vendor claim.
 */
export function PaybackChart({ tools, typicalSale, saleWord }: { tools: ChartTool[]; typicalSale: number; saleWord: string }) {
  const [hours, setHours] = useState(3);
  const [rate, setRate] = useState(20);
  const [customers, setCustomers] = useState(2);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const monthlyValue = hours * 4.33 * rate + customers * typicalSale;

  const series = useMemo(
    () =>
      tools.map((t) => {
        const price = t.freePlan ? 0 : t.min;
        if (price == null) return null;
        return Array.from({ length: 13 }, (_, m) => Math.round(m * (monthlyValue - price)));
      }),
    [tools, monthlyValue],
  );
  const vals = series.flatMap((s) => s ?? [0]);
  const maxV = Math.max(100, ...vals);
  const minV = Math.min(0, ...vals);
  const W = 1000,
    H = 300,
    padL = 56,
    padR = 110,
    padT = 12,
    padB = 26;
  const sx = (m: number) => padL + (m / 12) * (W - padL - padR);
  const sy = (v: number) => padT + ((maxV - v) / (maxV - minV || 1)) * (H - padT - padB);
  const ticks = [minV, minV / 2, 0, maxV / 2, maxV].filter((v, i, a) => a.indexOf(v) === i && (v === 0 || Math.abs(v) > 1));

  return (
    <Panel
      title="Estimated payback"
      sub="Your estimate, from your own numbers: value of time saved and extra customers, minus each tool's starting price."
    >
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        {[
          [`Hours saved per week: ${hours}`, hours, setHours, 0, 20, 1],
          [`Your time is worth: $${rate}/hour`, rate, setRate, 10, 80, 5],
          [`Extra customers per month: ${customers} (typical ${saleWord} $${typicalSale})`, customers, setCustomers, 0, 20, 1],
        ].map(([label, v, set, min, max, step]) => (
          <label key={String(label).split(":")[0]} className="block">
            <span className="font-bold">{label as string}</span>
            <input
              type="range"
              min={min as number}
              max={max as number}
              step={step as number}
              value={v as number}
              onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              className="mt-2 block w-full accent-[#ffd200]"
            />
          </label>
        ))}
      </div>
      <p className="text-sm">
        Expected value: <strong className="text-gold">{money(Math.round(monthlyValue))}/month</strong>
      </p>
      <Legend tools={tools} />
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cumulative net value over 12 months for each tool">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.07)"} strokeDasharray={v === 0 ? "4 4" : undefined} />
              <text x={padL - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="#a8a8ad">
                {v < 0 ? "-" : ""}${Math.abs(Math.round(v)) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.abs(Math.round(v))}
              </text>
            </g>
          ))}
          {[0, 3, 6, 9, 12].map((m) => (
            <text key={m} x={sx(m)} y={H - 6} textAnchor="middle" fontSize="11" fill="#a8a8ad">
              {m === 0 ? "Start" : `Mo ${m}`}
            </text>
          ))}
          {series.map((s, i) =>
            s ? (
              <g key={tools[i].name}>
                <polyline
                  fill="none"
                  stroke={SERIES[i]}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.map((v, m) => `${sx(m)},${sy(v)}`).join(" ")}
                />
                <text x={W - padR + 6} y={sy(s[12]) + 4} fontSize="11" fontWeight="700" fill="#ffffff">
                  {tools[i].name.length > 12 ? `${tools[i].name.slice(0, 11)}…` : tools[i].name}
                </text>
              </g>
            ) : null,
          )}
          {hoverMonth !== null && (
            <g>
              <line x1={sx(hoverMonth)} x2={sx(hoverMonth)} y1={padT} y2={H - padB} stroke="rgba(255,255,255,.35)" />
              {series.map((s, i) =>
                s ? <circle key={i} cx={sx(hoverMonth)} cy={sy(s[hoverMonth])} r="5" fill={SERIES[i]} stroke="#0f0f10" strokeWidth="2" /> : null,
              )}
            </g>
          )}
          {Array.from({ length: 13 }, (_, m) => (
            <rect
              key={m}
              x={sx(m) - (W - padL - padR) / 24}
              y={padT}
              width={(W - padL - padR) / 12}
              height={H - padT - padB}
              fill="transparent"
              onMouseEnter={() => setHoverMonth(m)}
              onMouseLeave={() => setHoverMonth(null)}
            />
          ))}
        </svg>
        {hoverMonth !== null && (
          <div role="tooltip" className="pointer-events-none absolute top-2 right-2 rounded-lg border border-line bg-black px-3 py-2 text-xs shadow-xl">
            <p className="font-bold mb-1">{hoverMonth === 0 ? "Start" : `After ${hoverMonth} month${hoverMonth > 1 ? "s" : ""}`}</p>
            {series.map((s, i) =>
              s ? (
                <p key={i} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[i] }} />
                  {tools[i].name}: <strong className="tabular-nums">{s[hoverMonth] < 0 ? "-" : ""}{money(Math.abs(s[hoverMonth]))}</strong>
                </p>
              ) : null,
            )}
          </div>
        )}
      </div>
      {series.some((s) => !s) && (
        <p className="text-sm text-muted">Tools without a listed price aren&apos;t charted. Ask those vendors for a quote.</p>
      )}
      <table className="sr-only">
        <caption>Net value after 12 months</caption>
        <tbody>
          {series.map((s, i) => (
            <tr key={i}>
              <th>{tools[i].name}</th>
              <td>{s ? money(s[12]) : "price not listed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Fit Score factors side by side: grouped horizontal bars, one row per factor. */
export function FactorChart({ tools }: { tools: ChartTool[] }) {
  const withFactors = tools.filter((t) => t.factors);
  if (!withFactors.length) return null;
  const rows = withFactors[0].factors!;
  return (
    <Panel title="Fit Score breakdown" sub="Points earned on each factor, for your business.">
      <Legend tools={tools} />
      <div className="space-y-4">
        {rows.map((r, ri) => (
          <div key={r.id} className="grid grid-cols-[8.5rem_1fr] gap-3 items-center">
            <span className="text-sm">
              {r.label}
              <span className="block text-xs text-muted">out of {r.weight}</span>
            </span>
            <div className="space-y-[2px]">
              {tools.map((t, i) => {
                const f = t.factors?.[ri];
                return (
                  <div key={t.name} className="flex items-center gap-2" title={`${t.name}: ${f ? Math.round(f.points) : 0} of ${r.weight}`}>
                    <div className="h-2.5 flex-1 rounded-[4px] bg-white/5 overflow-hidden">
                      <div className="h-full rounded-[4px] transition-all duration-700" style={{ width: `${(f?.f ?? 0) * 100}%`, background: SERIES[i] }} />
                    </div>
                    <span className="w-6 text-right text-xs tabular-nums text-muted">{f ? Math.round(f.points) : "–"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
