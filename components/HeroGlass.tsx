"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ToolLogo } from "@/components/ToolLogo";

// Loaded only in the browser, after the page is usable, so slow phones aren't held up by it.
const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false });

export type FeaturedTool = {
  name: string;
  url: string;
  description: string;
  price: string;
  checks: number;
  quote: string | null;
  quoteSource: string | null;
  useCase: string;
};

/** A real listing from the directory, shown as the hero card. Decorative; the real page is linked elsewhere. */
function ListingCard({ t }: { t: FeaturedTool }) {
  return (
    <div className="w-[21rem] p-5 text-left text-white">
      <div className="flex items-center gap-3">
        <ToolLogo name={t.name} url={t.url} size={44} />
        <div className="min-w-0">
          <p className="font-display text-xl font-extrabold leading-tight">{t.name}</p>
          <p className="text-xs text-white/70">{t.useCase}</p>
        </div>
        <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-gold/60 bg-gold/15 px-2 py-0.5 text-[0.7rem] font-bold text-gold">
          {t.checks}/6 checks
        </span>
      </div>
      <p className="mt-3 text-sm text-white/85">{t.description}</p>
      <div className="mt-4 flex items-center gap-1" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < t.checks ? "bg-gold" : "bg-white/15"}`} />
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-white/60">Price</p>
          <p className="font-display text-lg font-extrabold">{t.price}</p>
        </div>
        {t.quote && (
          <p className="max-w-[11rem] text-right text-[0.72rem] leading-snug text-white/70">
            “{t.quote}”<br />
            <span className="text-gold">✓ {t.quoteSource}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function HeroGlass({ tool }: { tool: FeaturedTool }) {
  const [fancy, setFancy] = useState(false);
  useEffect(() => {
    // Liquid glass only on larger screens that haven't asked for reduced motion.
    setFancy(window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches);
  }, []);

  return (
    <div aria-hidden className="relative h-[24rem] select-none">
      <div className="absolute inset-10 rounded-[2rem] bg-[radial-gradient(circle_at_35%_35%,rgba(226,24,51,.85)_0%,transparent_60%),radial-gradient(circle_at_70%_75%,rgba(255,210,0,.55)_0%,transparent_55%)] blur-3xl opacity-60" />
      {fancy ? (
        <LiquidGlass
          displacementScale={56}
          blurAmount={0.1}
          saturation={125}
          aberrationIntensity={1.5}
          elasticity={0.12}
          cornerRadius={24}
          mode="standard"
          style={{ position: "absolute", top: "50%", left: "50%" }}
        >
          <ListingCard t={tool} />
        </LiquidGlass>
      ) : (
        <div className="glass absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl shadow-2xl">
          <ListingCard t={tool} />
        </div>
      )}
    </div>
  );
}
