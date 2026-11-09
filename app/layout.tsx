import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible, Inter_Tight } from "next/font/google";
import "./globals.css";

// Body text: Atkinson Hyperlegible (built for low-vision readability). Headlines: Inter Tight.
const font = Atkinson_Hyperlegible({
  variable: "--font-sans-face",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const display = Inter_Tight({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "AI Tool Matchmaker: find the right AI for your small business",
  description:
    "Describe what's slowing your business down. Get checked, plain-English AI tool picks that fit your budget and the tools you already use.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#050505" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${font.variable} ${display.variable} antialiased min-h-screen flex flex-col`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-surface-2 focus:z-50">
          Skip to content
        </a>
        <header className="no-print sticky top-0 z-40 border-b border-line bg-background/75 backdrop-blur-md">
          <div aria-hidden className="md-flag-stripe h-1" />
          <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-2" aria-label="Main">
            <Link href="/" className="font-display font-extrabold tracking-tight flex items-center gap-2.5 min-h-11" aria-label="AI Tool Matchmaker, University of Maryland, home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/umd-terrapins-m.svg" alt="" width={30} height={33} className="h-8 w-auto" />
              <span className="leading-none">
                <span className="block text-base sm:text-lg whitespace-nowrap">Tool Matchmaker</span>
                <span className="hidden sm:block text-[0.65rem] font-bold tracking-[0.18em] text-gold uppercase mt-0.5">University of Maryland</span>
              </span>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2 text-[0.95rem] whitespace-nowrap">
              <Link href="/discover" className="px-2 sm:px-3 min-h-11 inline-flex items-center gap-1.5 rounded-lg text-muted hover:text-white">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                Discover
              </Link>
              <Link href="/about" className="hidden md:inline-flex px-3 min-h-11 items-center rounded-lg text-muted hover:text-white">
                About
              </Link>
              <Link href="/tools" className="px-2 sm:px-3 min-h-11 inline-flex items-center rounded-lg text-muted hover:text-white">
                Browse
              </Link>
              <Link
                href="/advisor"
                className="px-3 sm:px-4 min-h-10 inline-flex items-center rounded-full bg-white text-black font-bold hover:bg-gold transition-colors"
              >
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Get matched</span>
              </Link>
            </div>
          </nav>
        </header>
        <main id="main" className="flex-1 min-w-0 mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
          {children}
        </main>
        <footer className="no-print border-t border-line text-sm text-muted">
          <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-[2fr_1fr]">
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pb-6 border-b border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/umd-wordmark-white.svg" alt="University of Maryland" width={220} height={44} className="h-9 w-auto" />
              <span className="text-white/80">Built at the University of Maryland for Main Street businesses.</span>
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
      </body>
    </html>
  );
}
