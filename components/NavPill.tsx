"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/tools", label: "Browse" },
  { href: "/about", label: "About" },
];

/** Floating navigation pill, bottom-center (Room & Pillar-style). */
export function NavPill() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-1 rounded-2xl border border-white/15 bg-[#1d1e26] p-1.5 shadow-[0_16px_50px_-12px_rgba(0,0,0,.9)]"
    >
      <Link href="/" aria-label="Home" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/umd-terrapins-m.svg" alt="" width={20} height={22} className="h-[22px] w-auto" />
      </Link>
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`hidden sm:inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-medium transition ${
              active ? "text-gold" : "text-muted hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href="/tools"
        className="sm:hidden inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-muted hover:text-white"
      >
        Browse
      </Link>
      <Link
        href="/advisor"
        className="ml-1 inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-black transition hover:bg-[#ffe14d]"
      >
        Get matched
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </nav>
  );
}
