"use client";

import { useState } from "react";

/** Vendor logo tile; falls back to the first letter if the logo can't be loaded. */
export function ToolLogo({ name, url, size = 40, className = "" }: { name: string; url: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Letter fallback.
  }
  const box = { width: size, height: size };
  if (failed || !domain) {
    return (
      <span
        aria-hidden
        style={box}
        className={`grid shrink-0 place-items-center rounded-xl bg-surface-2 ring-1 ring-line font-display font-semibold text-white ${className}`}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span aria-hidden style={box} className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-white/10 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/logo?d=${encodeURIComponent(domain)}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-[78%] w-[78%] object-contain"
      />
    </span>
  );
}
