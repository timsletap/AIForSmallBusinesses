import Link from "next/link";
import { ProblemBox } from "@/components/ProblemBox";
import { USE_CASES } from "@/lib/taxonomy/useCases";

const ICONS: Record<string, string> = {
  missed_calls: "📞",
  booking_waitlist: "📅",
  auto_replies: "💬",
  customer_list: "📇",
  win_back: "🔁",
  scheduling_dispatch: "🚚",
};

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-brand-strong">
          Find the right AI tool for your business, in plain English.
        </h1>
        <p className="text-lg text-muted max-w-2xl">
          Tell us your problem. We&apos;ll show a few tools that fit your budget and the things you already use, check
          that each company is real, and give you a simple plan to get started.
        </p>
        <div className="rounded-2xl border-2 border-brand bg-surface p-4 sm:p-6">
          <ProblemBox />
        </div>
      </section>

      <section id="problems" aria-labelledby="problems-h" className="space-y-3 scroll-mt-4">
        <h2 id="problems-h" className="text-xl font-bold">
          Or pick the problem closest to yours
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <li key={u.id}>
              <Link
                href={`/advisor?uc=${u.id}`}
                className="flex items-start gap-3 h-full rounded-2xl border border-line bg-surface p-4 min-h-11 hover:border-brand hover:bg-brand-soft"
              >
                <span aria-hidden className="text-2xl">
                  {ICONS[u.id]}
                </span>
                <span className="font-bold">{u.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 text-base">
        {[
          ["Checked companies", "We check each vendor's website, privacy policy, terms and security info, and tell you what's missing."],
          ["Real prices", "Prices come straight from the vendor's site, with a link. If a price isn't listed, we say so."],
          ["Free local help", "Your plan links to free SBA advisors and SCORE mentors near you."],
        ].map(([h, p]) => (
          <div key={h} className="rounded-2xl bg-brand-soft p-4">
            <h3 className="font-bold text-brand-strong">{h}</h3>
            <p className="text-muted">{p}</p>
          </div>
        ))}
      </section>

      <p>
        <Link href="/tools" className="underline font-bold text-brand-strong">
          Browse all tools →
        </Link>
      </p>
    </div>
  );
}
