import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { NavPill } from "@/components/NavPill";

// Geist (a precise grotesk) for everything, Geist Mono for small technical captions.
const font = Geist({ variable: "--font-sans-face", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "TerpTool: The right AI tools for your small business, verified.",
  description:
    "Describe what's slowing your business down. Get checked, plain-English AI tool picks that fit your budget and the tools you already use.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#121318" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${font.variable} ${mono.variable} antialiased min-h-screen flex flex-col`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-surface-2 focus:z-50">
          Skip to content
        </a>
        <header className="no-print flex justify-center pt-6 pb-2">
          <Link href="/" aria-label="TerpTool, University of Maryland, home" className="grid h-11 w-11 place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/umd-terrapins-m.svg" alt="" width={30} height={33} className="h-[33px] w-auto" />
          </Link>
        </header>
        <div className="relative z-50">
          <NavPill />
        </div>
        <main id="main" className="flex-1 min-w-0 mx-auto w-full max-w-6xl px-5 pt-8 pb-28 sm:pt-12">
          {children}
        </main>
        <footer className="no-print border-t border-line text-sm text-muted pb-24">
          <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-[2fr_1fr]">
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pb-6 border-b border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/umd-wordmark-white.svg" alt="University of Maryland" width={220} height={44} className="h-9 w-auto" />
              <span className="text-white/80"><strong className="text-white">TerpTool</strong>: the right AI tools for your small business, verified. Built at the University of Maryland.</span>
              <span aria-hidden className="md-flag-stripe h-1.5 w-24 rounded-full ml-auto hidden sm:block" />
            </div>
            <p>
              Every tool here was checked against the company&apos;s own website. Prices and features can change, so
              confirm with the vendor before you pay. We don&apos;t take money from vendors and we don&apos;t store your
              answers.
            </p>
            <p className="sm:text-right">
              <a className="underline hover:text-gold" href="/about">About &amp; how we verify tools</a>
              <br />
              Free one-on-one help:{" "}
              <a className="underline hover:text-gold" href="https://www.sba.gov/local-assistance/find" target="_blank" rel="noreferrer">
                SBA local assistance
              </a>
              {" · "}
              <a className="underline hover:text-gold" href="https://www.score.org/find-mentor" target="_blank" rel="noreferrer">
                SCORE mentors
              </a>
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
