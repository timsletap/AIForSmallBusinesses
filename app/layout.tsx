import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

const font = Atkinson_Hyperlegible({
  variable: "--font-sans-face",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Tool Matchmaker: find the right AI for your small business",
  description:
    "Describe what's slowing your business down. Get checked, plain-English AI tool picks that fit your budget and the tools you already use.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#166534" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${font.variable} antialiased min-h-screen flex flex-col`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-white">
          Skip to content
        </a>
        <header className="no-print border-b border-line bg-surface">
          <nav className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-2" aria-label="Main">
            <Link href="/" className="font-bold text-brand-strong flex items-center gap-2 min-h-11">
              <span aria-hidden className="inline-block h-7 w-7 rounded-lg bg-brand text-white text-center leading-7 text-sm">
                AI
              </span>
              <span className="text-base sm:text-lg whitespace-nowrap">Tool Matchmaker</span>
            </Link>
            <div className="flex gap-0 sm:gap-1 text-[0.95rem] sm:text-base whitespace-nowrap">
              <Link href="/advisor" className="px-2 sm:px-3 min-h-11 inline-flex items-center rounded-lg hover:bg-brand-soft">
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Get matched</span>
              </Link>
              <Link href="/tools" className="px-2 sm:px-3 min-h-11 inline-flex items-center rounded-lg hover:bg-brand-soft">
                Browse
              </Link>
            </div>
          </nav>
        </header>
        <main id="main" className="flex-1 min-w-0 mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
          {children}
        </main>
        <footer className="no-print border-t border-line text-sm text-muted">
          <div className="mx-auto max-w-5xl px-4 py-6 space-y-2">
            <p>
              Every tool here was checked against the company&apos;s own website. Prices and features can change, so
              confirm with the vendor before you pay. We don&apos;t take money from vendors and we don&apos;t store your
              answers.
            </p>
            <p>
              Free one-on-one help:{" "}
              <a className="underline" href="https://www.sba.gov/local-assistance/find" target="_blank" rel="noreferrer">
                SBA local assistance
              </a>
              {" · "}
              <a className="underline" href="https://www.score.org/find-mentor" target="_blank" rel="noreferrer">
                SCORE mentors
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
