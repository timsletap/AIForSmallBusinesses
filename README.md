# TerpTool

**The right AI tools for your small business, verified.**

Helps Main Street and rural small business owners with little AI knowledge find, compare and adopt the right AI tools.

**Flow:** describe a problem → answer 3 quick questions → ranked, checked recommendations with plain-language reasons → compare → a printable adoption plan with free SBA help links.

Every tool comes from a prepopulated database built by an automated discovery pipeline. Every vendor is checked (official site, company identity, privacy policy, terms, security docs, public pricing). Every fact links to the vendor page it came from. Missing or unverified information shows as a warning and is never guessed.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind 4 · zod · OpenRouter (LLM + Exa web search) · cheerio · Supabase Postgres (optional) · Vitest · Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in OPENROUTER_API_KEY and ADMIN_PASSWORD at minimum
npm run dev                   # http://localhost:3000
```

### Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes (for discovery + classifier) | LLM extraction/classification and web search |
| `LLM_MODEL` | no | Defaults to `anthropic/claude-haiku-5.5` |
| `ADMIN_PASSWORD` | yes | Protects `/admin` and `/api/admin/*` |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Use Supabase instead of the JSON store |
| `CRON_SECRET` | no (P1) | Scheduled refresh |

Secrets are only read on the server. The owner pages work without any keys. The classifier then falls back to keywords plus the problem picker.

### Storage

- **Without Supabase:** the app reads and writes `data/tools.json` and `data/runs.json`. The seeded file is committed, so it ships with each deploy. On Vercel the filesystem is read-only, so admin changes last only as long as the server instance.
- **With Supabase (production uses this):** installed through the Vercel Marketplace, which adds `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING` and other vars to the Vercel project. To set up the schema and data, deploy, then call `POST /api/admin/setup-db` with the `x-admin-password` header. It runs on Vercel where the secrets live, applies `supabase/migrations/*.sql` once each, and imports `data/tools.json` into an empty table. It's safe to call again. Locally, with `POSTGRES_URL_NON_POOLING` in `.env.local`, `npm run migrate -- --import` does the same. RLS allows anonymous reads of published tools only. All writes go through server routes with the service role key.
- Local dev without Supabase vars in `.env.local` keeps using the JSON file, so seeding locally doesn't touch production. To push new local seed data to production, use admin discovery on the live site, or empty the `tools` table and rerun setup-db after deploying.

## Data pipeline

```
search (OpenRouter web plugin, Exa) → find official site → canonicalize + dedupe by domain
→ fetch homepage + up to 3 key pages (robots.txt respected, 1 req/s per domain, 10 s timeout)
→ LLM extraction into a zod schema (every value carries source_url + exact quote)
→ validate (quote must appear in fetched text; unmatched prices → null; price 0..5000)
→ vendor checks → trust level + warnings → save (draft or published)
```

Code is split by stage: `lib/discovery` → `lib/extraction` → `lib/verification` → `lib/storage` → `lib/ranking` → `app/`. The orchestrator is `lib/pipeline/run.ts`.

- `npm run seed`: runs the pipeline over a starter list of well-known vendor homepages (names only; every fact is extracted from their own pages), then search queries for each use case × relevant industries. Flags: `--list-only`, `--search-only`.
- `npx tsx scripts/backfill.ts`: re-applies deterministic rules (trust levels, warnings, low-tech integration inference) without re-fetching.
- **Admin** (`/admin`): run discovery for a use case + industry or a custom query, see the run log, and Verify, Unverify or Reject tools. Verify marks a tool `admin_reviewed`, which shows as **Verified vendor** when ≥ 5 checks pass, and the pipeline then never overwrites its reviewed fields. Unverify undoes a hand check: trust falls back to what the automated checks support.

### "Already in your tools"

Before recommending anything new, Results and Plan show AI features built into software the owner already uses (Square, QuickBooks, Google Business Profile, Gmail/Outlook, Shopify, Clover, Toast, Facebook/Instagram) that fit their problem. Included features come first, then unknown cost, then paid add-ons.

- `npm run builtins [-- square,shopify]`: searches **only each platform's official domains** (`PLATFORM_SOURCES` in `lib/builtins/discover.ts`), fetches the pages under the same robots.txt and rate-limit rules, extracts features, and keeps only those whose quote appears on the page. The output goes to `data/builtins.json`, which ships with the build as read-only reference data.
- Matching is pure and tested (`lib/builtins/match.ts`, `tests/builtins.test.ts`).
- Adding a platform takes one entry in `PLATFORM_SOURCES`.

### Trust levels

| Level | Rule | Shown |
| --- | --- | --- |
| verified | admin reviewed and ≥ 5/6 checks | green "Verified vendor" |
| checks_passed | ≥ 5/6 checks | "Vendor checks passed" |
| partial | 3–4 checks | amber badge and a warning per failed check |
| unverified | ≤ 2 checks | never published, never recommended |

### Data and scraping policy

- Facts come **only** from the vendor's own website. Directories and review sites (G2, Capterra, Yelp…) are filtered out and never used as fact sources.
- We respect `robots.txt` (including wildcards), rate-limit to 1 request/second per domain, and time out at 10 s. Sites that block automated reading are skipped rather than worked around.
- We don't scrape review platforms. `reviews` stays empty unless a permitted source is added.
- No customer data is stored. Owner answers live only in the URL.

## Ranking

The ranking is pure, deterministic and unit-tested (`lib/ranking/score.ts`). There's no LLM on the results path.

| Factor | Weight |
| --- | --- |
| Use-case fit (primary 1.0, secondary 0.6) | 30 |
| Works with your tools (incl. phone line, spreadsheets) | 20 |
| Vendor trust (checks ÷ 6, +0.1 admin reviewed) | 15 |
| Affordability (≤ budget or free plan 1.0, linear to 0 at 2× budget, unknown 0.4) | 15 |
| Ease of setup (low 1, medium 0.6, high 0.2; high comfort floors at 0.6) | 15 |
| Reviews (rating ÷ 5, unknown 0.5) | 5 |

Hard constraints: only published, never unverified. A missing "must work with" tool, or high setup effort for low-comfort owners, moves a tool to the "Might work, check first" group. Ties go to higher trust, then lower price. When a problem spans two use cases, the best tool for each is always included.

## Tests

```bash
npm test          # vitest: scoring, constraints, canonical URLs, robots.txt, vendor checks, quote validation
npm run typecheck
```

## Deploy (Vercel)

```bash
npx vercel login
npx vercel --prod
npx vercel env add OPENROUTER_API_KEY production   # also ADMIN_PASSWORD, LLM_MODEL, and Supabase vars if used
```

## Extensibility

- Industries, use cases and current tools are data in `lib/taxonomy/*.ts`. Adding one is a single entry, with no UI changes.
- The pipeline is schema-first and idempotent: it dedupes by domain and updates rows instead of duplicating them.
- Future implementation-provider marketplace: a `providers` table (name, service area, tools supported, verification) and a slot on the Plan page under "Free help near you". It isn't built yet.

## Team

Smit Patel, Daniel Petrov. Built for the UMD hackathon (submissions belong to the University of Maryland per the rules).
