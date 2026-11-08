# BUILD SPEC: AI Tool Matchmaker (MVP)

**Audience:** a senior-level agentic coding developer building this end to end.
**Owners:** Smit Patel, Daniel Petrov
**Date:** November 8, 2026
**Deadline:** working, deployed build by **~9:45pm ET Sun Nov 8**. The public link must stay live through **Nov 17**.

This spec supersedes earlier drafts. It merges the hackathon brief, the organizers' Q&A clarifications, and our technical design, then **cuts everything not needed for a working MVP**. Anything not marked P0 is optional tonight.

---

## 1. What we are building

A web app that helps **Main Street and rural small business owners** with little AI knowledge confidently find and adopt the right AI tools.

**The core flow (organizers' words):** describe a problem → discover tools → compare recommendations → learn how to adopt them.

**What makes it trustworthy:** every tool comes from a prepopulated database built by an automated discovery pipeline, every vendor is **verified** (identity, official site, privacy policy, security docs), every fact links to its source, and missing or unverified information is shown as a warning, never guessed.

### Product principles

- **Applicable to diverse Main Street businesses:** match on tools owners already use, including low-tech ones (phone line, paper, Excel), and point to free SBA help.
- **Extensible:** pipeline + database + modular code that grows to more tools, industries, categories and integrations.
- **Usable by a first-time, non-technical owner:** simple, accessible, works on a phone.

### Requirements traceability (brief + Q&A)

| Requirement | Source | Covered by |
| --- | --- | --- |
| Discover, compare, adopt AI tools | Brief | Sections 6, 8 |
| Non-technical users, plain-English problems | Brief, Q&A 1 | Problem box + classifier, plain-language UI |
| Main Street and rural focus | Q&A 1 | Industries list, mobile-first, lightweight pages |
| Show tools, rating, cost, how to engage | Brief | Tool cards, tool page |
| Rating beyond reviews | Brief | Fit Score; reviews are 5% |
| Tools discovered by the platform | Brief | Discovery pipeline (Section 5) |
| Prepopulated DB with periodic discovery is enough | Q&A 2 | Seed script + admin trigger + cron config; no live scraping in the user flow |
| Accuracy over quantity | Q&A 2 | 20 to 25 tools, human spot-checked |
| Extensible to more tools/industries/categories/integrations | Q&A 2 | Taxonomies are data; schema-first pipeline |
| Verify vendors; show badges, sources, warnings | Q&A 3 | Vendor verification (Section 5.4), trust card |
| Trust is part of the evaluation | Q&A 3 | Trust = 15% of Fit Score + hard gate |
| Recommend by needs, budget, industry, software, ease | Q&A 4 | Ranking (Section 6) |
| Setup guidance + integration requirements | Q&A 4 | Tool page + adoption plan |
| Future integration with implementation providers | Q&A 4 | Architecture hook only (Section 10) |
| Real, testable platform | Q&A 5 | Deployed app on real data |
| Advanced features modular | Q&A 5 | P1/P2 items behind flags, separate modules |
| Multiple tools may be needed | Brief | P1 stack suggestion |

---

## 2. Priorities

**P0 = required tonight. P1 = only after all P0 is done and deployed, in listed order. P2 = roadmap, do not build tonight.**

| Priority | Feature |
| --- | --- |
| **P0** | Prepopulated database of 20 to 25 accurate tools, built by the discovery pipeline |
| **P0** | Vendor verification checks, trust badges, source links, missing-info warnings |
| **P0** | Plain-English problem box → use-case classification (with fallback picker) |
| **P0** | Short intake: industry, budget, current tools (incl. low-tech), tech comfort |
| **P0** | Personalized ranked results with Fit Score breakdown and plain-language reasons |
| **P0** | Tool page: what it does, pricing, integrations, setup steps, integration requirements, trust card, sources |
| **P0** | Compare 2 to 3 tools side by side |
| **P0** | Adoption plan: setup steps, what you need first, total monthly cost vs budget, SBA free help links, print button |
| **P0** | Browse/search page with keyword search and filters (industry, use case, max price) |
| **P0** | Minimal admin: run discovery for a query, see run log, verify/reject tools |
| **P0** | Deployed on Vercel; works on phone; accessibility basics; scoring unit tests; README |
| P1 | **Break-even line** on each result ("pays for itself if it brings back 2 customers a month") |
| P1 | **"Already in your tools"**: AI features built into tools the owner already pays for (Square, QuickBooks, Google), shown first |
| P1 | Two-tool stack suggestion when the problem spans two use cases |
| P1 | Cron schedule for periodic discovery/refresh |
| P1 | Extraction accuracy script on 10 hand-checked tools |
| P2 | 30-day pilot plan, semantic search, LLM-written explanations, weight sliders, LLM rerank, review queue UI, shareable plan links, more data sources (Product Hunt API), implementation-provider marketplace, multilingual UI, professional services vertical |

---

## 3. Stack and repo

- **Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui**
- **Supabase Postgres** (pgvector not needed for P0)
- **zod** for every schema
- **OpenAI** (model from env) for extraction and classification, behind a small provider interface so Gemini can be swapped in
- **Brave Search API** (or Exa) for discovery
- `fetch` + `cheerio` for page text (Firecrawl optional if a key exists)
- **Vitest** for tests; **Vercel** for deploy

Check each third-party API's **current docs** before calling it. Do not rely on memory for endpoints, headers or response shapes.

```
/app
  page.tsx                  Home: problem box + "Find AI for my business"
  advisor/page.tsx          Intake (3 short steps)
  results/page.tsx          Ranked recommendations
  tools/page.tsx            Browse + search + filters
  tools/[slug]/page.tsx     Tool page
  compare/page.tsx          ?ids=a,b,c
  plan/page.tsx             Adoption plan (state in URL params)
  admin/page.tsx            Minimal admin (password gate)
  api/classify/route.ts
  api/recommend/route.ts
  api/admin/discover/route.ts
  api/admin/tools/[id]/route.ts   (verify / reject)
/lib
  discovery/   search.ts, canonical.ts, fetchPage.ts
  extraction/  extract.ts, prompts.ts
  verification/ vendorChecks.ts
  storage/     db.ts
  ranking/     score.ts, constraints.ts, reasons.ts
  llm/         provider.ts
  taxonomy/    useCases.ts, industries.ts, tools.ts
  schemas/     tool.ts, profile.ts
/supabase/migrations/0001_init.sql
/scripts/seed.ts            Runs the pipeline over the seed query list
/tests/score.test.ts, canonical.test.ts, vendorChecks.test.ts
README.md, .env.example
```

Keep modules separate: **discovery → extraction → verification → storage → ranking → UI.**

### Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_PROVIDER=openai
OPENAI_API_KEY=
LLM_MODEL=
SEARCH_PROVIDER=brave
BRAVE_API_KEY=
EXA_API_KEY=
FIRECRAWL_API_KEY=      # optional
ADMIN_PASSWORD=
CRON_SECRET=            # P1
```

Secrets are server-only.

---

## 4. Taxonomies (data, not code)

Adding an industry, use case or integration = one entry in these files. No UI changes.

**Industries:** `restaurant`, `coffee_bakery`, `salon_barber`, `hvac_plumbing`, `landscaping`, `retail`, `other`.

**Use cases (6):**

| ID | Owner-facing label |
| --- | --- |
| `missed_calls` | Answer calls and messages when I'm busy |
| `booking_waitlist` | Manage bookings and my line |
| `auto_replies` | Answer the same questions for me (reviews, DMs, email) |
| `customer_list` | Clean up and organize my customer list |
| `win_back` | Bring back customers who stopped coming |
| `scheduling_dispatch` | Schedule jobs and crews |

**Current tools (intake + integration matching), including low-tech:** `phone_line`, `paper`, `excel_sheets`, `gmail_outlook`, `quickbooks`, `square`, `clover`, `toast`, `shopify`, `google_business_profile`, `instagram_facebook`, `none`.

`tools.ts` includes a synonym map so extracted integration names normalize to these IDs (e.g. "Square POS", "Square Appointments" → `square`).

---

## 5. Data and discovery pipeline

Real-time scraping is **not** part of the user flow. The database is **prepopulated** by running the pipeline (seed script), and the admin can run it again on demand. Accuracy matters more than count.

### 5.1 Database (`0001_init.sql`)

**`tools`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| slug | text unique | |
| name, vendor | text | vendor = legal/company name if found |
| canonical_url | text unique | |
| description | text | one plain sentence |
| status | enum | `draft`, `published`, `rejected` |
| use_cases | text[] | first = primary |
| industries | text[] | |
| pricing | jsonb | `{free_plan, free_trial_days, est_monthly_usd_min, est_monthly_usd_max, plan_name, pricing_url}` |
| integrations | text[] | normalized IDs |
| works_standalone | boolean null | |
| integration_requirements | text[] | e.g. "Needs a business phone number that can forward calls" |
| setup_complexity | enum null | `low`, `medium`, `high` |
| setup_steps | text[] | owner-facing, ordered |
| engagement | enum null | `self_serve`, `free_trial`, `book_demo`, `needs_setup_help` |
| reviews | jsonb null | `{rating, count, source_url}`; only from permitted pages |
| vendor_checks | jsonb | Section 5.4 |
| trust_level | enum | `verified`, `checks_passed`, `partial`, `unverified` |
| warnings | text[] | plain-language, shown to owners |
| evidence | jsonb | map of field → `{source_url, quote, claim_type}` |
| missing_fields | text[] | |
| last_checked_at | timestamptz | |
| admin_reviewed | boolean default false | |

**`discovery_runs`**: id, query jsonb, status, counts jsonb (found, new, updated, skipped, failed), log text[], started_at, finished_at.

RLS: anonymous read on `tools` where `status = 'published'`. All writes through server routes with the service role key.

### 5.2 Pipeline steps

1. **Search** (Brave/Exa) with queries built from use case × industry, e.g. `"AI missed call text back for salons pricing"`.
2. **Find the official site.** Aggregator and listing results (directories, review sites) are used only to get the product name; resolve to the vendor's own domain. Facts come **only from the vendor's official pages**.
3. **Canonicalize + dedupe** by normalized domain (lowercase, strip `www.`, query strings, fragments). Existing tool → update, not a new row.
4. **Fetch** homepage plus up to 3 linked pages among pricing, integrations, privacy, terms, security/trust. Respect `robots.txt`, 1 request/sec per domain, 10 s timeout.
5. **Extract** with the LLM into the zod schema. Rules in the prompt: use only provided page text; every non-null value carries `source_url` and a short exact `quote`; unknown = `null`; marketing statements labeled `vendor_claim`; map only to taxonomy IDs.
6. **Validate:** zod parse; check each quote appears in the fetched page text; **an unmatched price is set to null**; prices must be 0 to 5000/month.
7. **Verify vendor** (5.4) and compute `trust_level` and `warnings`.
8. **Save** as `draft` (if trust is `unverified` or key fields missing) or `published`. Never overwrite a field on an `admin_reviewed` tool.

Process **one candidate per request** in the admin route to stay under serverless time limits; the admin page loops until done.

### 5.3 Seeding

`scripts/seed.ts` runs the pipeline across the 6 use cases × the industries most relevant to each, aiming for **20 to 25 published tools, at least 3 per use case**. The team then opens each tool page, checks pricing and integrations against the vendor site, and marks good ones `admin_reviewed` (shown as **Verified**).

### 5.4 Vendor verification (required by Q&A)

Automated checks from fetched pages, stored in `vendor_checks`:

| Check | Pass when |
| --- | --- |
| `official_site` | HTTPS, domain matches the product, page loads |
| `vendor_identity` | Company name plus a contact method (email, address or phone) found on the site |
| `privacy_policy` | Privacy policy page found and linked |
| `terms` | Terms of service page found |
| `security_docs` | Security page, trust center, or named certification (e.g. SOC 2) mentioned on an official page |
| `public_pricing` | Pricing found on an official page |

**Trust level**

| Level | Rule | Owner sees |
| --- | --- | --- |
| `verified` | `admin_reviewed` and ≥ 5 checks pass | Green "Verified vendor" badge |
| `checks_passed` | ≥ 5 checks pass | "Vendor checks passed" badge |
| `partial` | 3 to 4 checks pass | Amber badge + warnings for each failed check |
| `unverified` | ≤ 2 checks pass | **Never recommended.** Not published |

Warnings are plain sentences: "We couldn't find a privacy policy," "Price isn't listed on the vendor's site, ask before signing up." A vendor-provided claim is labeled "Vendor says" in the UI.

---

## 6. Ranking engine (pure, deterministic, unit-tested)

### 6.1 Profile

```ts
type Profile = {
  problem_text?: string;
  use_cases: UseCaseId[];        // from classifier or picker, 1 to 2
  industry: IndustryId;
  budget_usd: number;            // monthly
  current_tools: ToolId[];
  must_work_with: ToolId[];      // optional subset
  tech_comfort: 'low' | 'medium' | 'high';
};
```

### 6.2 Hard constraints

- Only `published` tools; `unverified` never shown.
- `must_work_with` not listed in integrations → moved to "Might work, check first" group.
- Low tech comfort → `setup_complexity = high` moved to the same group.
- Over budget is **not** excluded; it scores lower and shows "Over your budget by $X."

### 6.3 Fit Score (0 to 100)

| Factor | Weight | f in [0, 1] |
| --- | --- | --- |
| Use-case fit | 30 | 1.0 primary use case match, 0.6 secondary; +0 if no match (not shown) |
| Works with your tools | 20 | matched relevant current tools ÷ relevant current tools; no relevant tools → 1.0 if `works_standalone` else 0.5 |
| Vendor trust | 15 | checks passed ÷ 6; +0.1 if admin reviewed (cap 1.0) |
| Affordability | 15 | 1.0 if ≤ budget or free plan; linear to 0 at 2× budget; unknown price 0.4 |
| Ease of setup | 15 | low 1.0, medium 0.6, high 0.2; tech comfort high → floor 0.6 |
| Reviews | 5 | rating ÷ 5; unknown 0.5 |

`fit = round(Σ weight × f)`. Ties → higher trust, then lower price.

### 6.4 Reasons (deterministic, no LLM)

Each result shows 3 plain bullets built from its strongest and weakest factors, e.g. "Works with your Square and phone line," "Fits your $50 budget at about $29/month," "Easy setup, about 30 minutes," or "No privacy policy found." No LLM on the results path, so results are fast and stable.

### 6.5 Classifier

`POST /api/classify {text}` → `{use_cases: UseCaseId[], confidence}` using the LLM with the 6 labels and descriptions. Low confidence or error → the UI shows the 6 problem cards to pick from. Never blocks the flow.

---

## 7. API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/classify` | plain-English problem → use cases |
| POST | `/api/recommend` | profile → `{ranked, check_first}` with score breakdowns, reasons, warnings |
| GET | `/tools` page data via server components | browse/search with `q`, `industry`, `use_case`, `max_price` |
| POST | `/api/admin/discover` | `{query or use_case + industry}` → processes up to 3 candidates, returns run log |
| POST | `/api/admin/tools/[id]` | `{action: 'verify' | 'reject'}` |

All inputs validated with zod. Errors return `{error: {code, message}}`; the UI shows a plain sentence.

---

## 8. Pages and UX

### UX rules

- Written for an owner with little AI knowledge: plain words, about 8th grade reading level. Never say "LLM," "API," "integration" on owner pages; say "works with your Square."
- **Rural and phone-first:** mobile layout first (375px), server-rendered pages, no heavy images or videos, fast on slow connections, large tap targets (44px), readable 16px+ text.
- Accessibility: labeled inputs, 4.5:1 contrast, keyboard navigation, visible focus, no color-only meaning (badges have text).
- Every list has empty and error states in plain words.

### Pages (all P0)

| Page | Contents |
| --- | --- |
| **Home** | Headline, one big text box ("What's slowing your business down?"), "Find AI for my business" button, 6 problem cards, link to browse |
| **Advisor** | 3 steps with a progress bar: (1) your business: industry, (2) your budget per month, (3) what you already use (checkbox chips incl. phone line, paper, Excel) + "How comfortable are you with new apps?" Pre-filled problem from Home |
| **Results** | Top 3 to 5 tools: name, one-line description, Fit Score with "Why this score?" breakdown, 3 reasons, price per month, trust badge + warnings, "How to get started" (engagement) button, compare checkboxes, "Build my plan" button. "Might work, check first" group collapsed below |
| **Tool page** | What it does, who it's for, pricing (with source link), works with (owner's tools highlighted), integration requirements ("What you need first"), setup steps, trust card (each vendor check with pass/fail and link), warnings, sources list with last-checked date |
| **Compare** | 2 to 3 tools in columns: price, Fit Score factors, works with, setup effort, trust level, how to get started |
| **Plan** | Chosen tools, "What you need first" (integration requirements), setup steps per tool, total monthly cost vs budget, "Free help near you" box linking the SBA local assistance finder (Small Business Development Centers, SCORE mentors), print button |
| **Browse** | Keyword search + filters (industry, problem, max price), tool cards with trust badges |
| **Admin** | Password gate; form to run discovery for a use case + industry or a custom query; run log; table of tools with status, trust level, Verify / Reject buttons |

---

## 9. Non-functional

| Requirement |
| --- |
| Public link, no login on owner pages, live through Nov 17 |
| Results load in under 1.5 s (no LLM on that path) |
| Secrets server-side only; admin protected by password |
| External calls have timeouts and one retry; failures logged and shown as plain messages |
| Respect robots.txt and site terms; no scraping of review platforms |
| No customer data stored |

---

## 10. Extensibility notes

- **More tools/data:** pipeline is schema-first and idempotent (dedupe by domain); Postgres indexes on `use_cases`, `industries`, `integrations`.
- **More industries/categories/integrations:** taxonomy files today, DB tables later; no UI changes needed.
- **Periodic updates:** the same pipeline runs on a schedule (P1 cron) to refresh prices and checks; `last_checked_at` drives a "stale" flag.
- **Future implementation providers (Q&A 4):** not built. Design hook only: a future `providers` table (name, service area, tools supported, verification) and a slot on the Plan page under "Free help near you." Do not build tonight.

---

## 11. Tests and docs (P0, keep small)

- `score.test.ts`: factor math, constraints, unknown handling, tie-break, determinism.
- `canonical.test.ts`: URL normalization and dedupe.
- `vendorChecks.test.ts`: trust level thresholds; unverified never returned by recommend.
- README: setup, env vars, migration, `npm run seed`, tests, deploy, data and scraping policy.

### Definition of done

- [ ] 20 to 25 published tools from the pipeline, at least 3 per use case, team spot-checked
- [ ] Every shown price and claim has a source link; missing info shows a warning
- [ ] Vendor checks and trust badges on every tool; no unverified tool is ever recommended
- [ ] Home → Advisor → Results → Compare → Plan works end to end on a phone
- [ ] Plain-English problem classifies correctly for 3 test phrases; picker fallback works
- [ ] Browse search and filters work
- [ ] Admin run adds or updates a tool that then appears in Browse and Results
- [ ] Tests pass; README done; deployed

---

## 12. Build order (from ~5:15pm)

| # | Milestone | Done when | Est. |
| --- | --- | --- | --- |
| M0 | Scaffold Next.js + Tailwind + shadcn, Supabase project + migration, deploy hello page | Live URL; tables exist | 20 min |
| M1 | Schemas, taxonomies, LLM + search providers | One search + one LLM call succeed | 20 min |
| M2 | Pipeline: search → canonical → fetch → extract → validate → vendor checks → save | One tool lands as `published` with evidence + checks | 60 min |
| M3 | Run seed in background; team spot-checks and verifies | 20 to 25 good tools | runs alongside M4 to M6 |
| M4 | Ranking + reasons + tests + `/api/recommend` + `/api/classify` | Tests pass; personas return sensible top 3 | 35 min |
| M5 | Home, Advisor, Results, Plan | Golden path works on phone | 50 min |
| M6 | Tool page, Compare, Browse | All linked from Results | 40 min |
| M7 | Minimal admin | Run + verify/reject work on deployed URL | 15 min |
| M8 | Polish: empty/error states, a11y pass, README, final deploy | Definition of done checked | 20 min |

**If behind, cut in this order:** Browse filters (keep search) → Compare limited to 2 tools → admin run log detail → classifier (keep problem cards only). **Never cut:** vendor verification + warnings, sources, Results with reasons, Plan with setup steps and SBA links, deploy.

P1 items start only after M8 is deployed.

---

## 13. Acceptance scenarios (must work end to end on the deployed URL)

**Persona 1: a family diner in a small rural town.** Uses a business phone line, Square and Facebook. $50/month. Low tech comfort. Types: "We miss calls during the lunch rush and lose takeout orders."

1. Classified to `missed_calls`. Results show 3 tools with Fit Scores, reasons, prices, trust badges.
2. Tap "Why this score?" on the top pick; open its tool page and show the trust card and sources.
3. Compare the top 2.
4. Build the plan: what you need first, setup steps, total cost under budget, free SBA help.

**Persona 2: an HVAC company.** Uses QuickBooks, a spreadsheet and a phone line. $100/month. Types: "Our customer info is scattered and old customers never call back for tune-ups."

5. Classified to `customer_list` and `win_back`; results show the best tool for each.

**Discovery:**

6. In admin, run discovery for one use case + industry; the log shows each step, and the new or updated tool appears in Browse and Results with its trust badge and sources.

---

## 14. Open questions

1. Which keys do we have tonight: OpenAI or Gemini, Brave or Exa? --> we have an openrouter api key with 25$ on it
2. Vercel plan's function time limit (affects candidates per admin request). --> wont have to worry about users its just mvp
3. Per hackathon rules, all submissions belong to the University of Maryland. --> OK
