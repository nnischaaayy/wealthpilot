# WealthPilot

AI-powered personal finance & portfolio platform. See [docs/architecture.md](docs/architecture.md) for the full architecture and product design document.

## Monorepo layout

```
apps/web/         Next.js 16 app (frontend + BFF API routes)
apps/ai-service/  Python FastAPI service (AI advisor, agents, tools, RAG)
packages/db/       Prisma schema, migrations, seed scripts (Phase 1+)
packages/shared-types/  Shared TS types generated from the API (Phase 1+)
packages/config/   Shared eslint/tsconfig/tailwind presets (Phase 1+)
infra/             docker-compose (local Postgres + Redis), deployment config
docs/              Architecture doc and ADRs
```

## Local development

### Prerequisites
- Node.js 22+
- Python 3.11+
- Docker Desktop (for local Postgres/Redis)

### Web app

Install once from the repo root (npm workspaces link `packages/*` for you):

```bash
npm install
npm run dev              # http://localhost:3000
npm run test              # Vitest — pure unit tests, no DB required
npm run test:integration  # Vitest — needs a live Postgres (docker compose up, migrations applied)
npm run lint
npm run typecheck
npm run build
```

### AI service

```bash
cd apps/ai-service
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt   # Windows
# source .venv/bin/activate && pip install -r requirements-dev.txt  # macOS/Linux
./.venv/Scripts/python.exe -m uvicorn main:app --reload --port 8000
./.venv/Scripts/python.exe -m pytest
./.venv/Scripts/python.exe -m ruff check .
```

### Infra (Postgres + Redis)

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
```

### Database (Prisma)

Once Postgres is up, apply the schema in `packages/db/prisma/schema.prisma`:

```bash
cd packages/db
cp .env.example .env   # only if it doesn't already point at your local Postgres
npm run migrate:dev     # creates apps/web's tables + migration history
npm run studio           # optional — browse data at http://localhost:5555
```

`apps/web` reads `DATABASE_URL` from its own `apps/web/.env.local` (gitignored — copy the value from `.env.example`). `AUTH_SECRET` is also required there; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Google OAuth (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`) is optional — the credentials (email/password) provider works without it.

## Status

Building phase-by-phase per [docs/architecture.md § 17](docs/architecture.md#17-proposed-implementation-phasing-for-after-approval).

- **Phase 0 — repo scaffold**: complete.
- **Phase 1 — auth, workspace, DB schema, protected shell, design tokens**: complete. Signup, login, logout, and workspace create/switch verified end-to-end against a live local Postgres.
- **Phase 2 — statement upload, parsing, categorization, transactions table**: complete. CSV/XLSX parsing with bank-format auto-detection (day-first dates, debit/credit or signed-amount columns), a manual column-mapping fallback for unrecognized formats, rule-based categorization (built-in keyword rules + per-workspace learned rules from inline corrections), and a filterable/sortable/paginated transactions table — all verified against live Postgres with a real sample statement.
- **Phase 3 — dashboard (KPIs, cash flow, category breakdown, 50/30/20 budget)**: complete. Net worth, this-month cash flow, and savings-rate KPI cards; a 6-month cash-flow bar chart and category-spend donut (Recharts, categorical palette validated via the dataviz skill's contrast/CVD checker); a 50/30/20 budget view on `/budgets`; first-class empty/loading/error states on every data view; every chart paired with an accessible data-table alternative. Verified against live Postgres with real multi-category transaction data — KPI math, category-capping/"Other" folding, and 50/30/20 grouping all confirmed correct.
- **Post-Phase-3 hardening**: fixed three gaps caught by a self-audit — (1) CI (`.github/workflows/ci.yml`) had never actually run (no git remote) and would have failed on a fresh checkout: added a Postgres service container, a `prisma generate` step, and `DATABASE_URL`; (2) added a real Postgres-backed integration test suite (`apps/web/tests/integration/upload-pipeline.test.ts`) for the upload→parse→categorize→persist pipeline, previously only verified manually; (3) added an automated cross-tenant-isolation suite (`apps/web/tests/integration/tenant-isolation.test.ts`) per architecture.md §14/§15, checking that every workspace-scoped service function rejects or excludes another workspace's data. All three verified locally by actually running them, not just written and assumed to work.
- **Phase 4 — portfolio module (manual holdings CRUD + analytics)**: complete. A `Holding` model (extends architecture.md's schema with a manually-entered `currentPriceMinor`, since the doc's own schema had no price/value field to compute performance or value-based allocation from); CRUD via server actions with tenant-scoped service functions and audit-log entries; pure, unit-tested analytics (per-holding gain/loss, allocation by holding and by asset class, a documented heuristic risk score); a `/portfolio` page with KPI cards, two allocation donut charts (reusing the Phase 3 validated categorical palette), a holdings table, and first-class empty/loading/error states. Verified against live Postgres — CRUD lifecycle and analytics correctness (`apps/web/tests/integration/portfolio.test.ts`) plus tenant-isolation coverage for every new service function extended into the existing suite — and confirmed live by seeding real mixed holdings (live-priced gain, live-priced loss, at-cost-only) and checking the rendered totals, gain/loss, risk score, and allocation percentages all matched by hand.
- **Phase 5 — ai-service scaffold (redaction gateway, deterministic tools, router + Budget Coach, streaming chat)**: complete. A regex/rule-based PII redaction gateway (`apps/ai-service/privacy/redaction.py`) strips account numbers, card numbers, UPI-style payment handles, and reference IDs before any transaction text reaches the LLM, tested against golden fixtures; four deterministic calculators (budget projection, emergency fund, loan payment, investment growth) that return every number an agent states — the LLM only narrates, per architecture.md §13.2's non-negotiable "never compute money" rule; a workspace-scoped `get_transactions` tool reading the same Postgres schema Prisma owns via `asyncpg`; a model-agnostic `LLMClient` wrapping Anthropic behind a small protocol (agents never touch the SDK directly, and tests inject a scripted fake instead of hitting the network); a keyword-based intent router; and the Budget Coach agent itself, running a real tool-calling loop (up to 4 rounds) against Claude. On the web side: an internal `/api/advisor/chat` proxy route (ai-service is never exposed directly to the browser, per §12), a `useAdvisorChat` SSE-streaming hook, and a full chat UI on `/advisor` with tool-call "Sources" disclosure and a persistent informational-analysis disclaimer. Verified with 40 pytest tests, 4 Vitest tests for the streaming hook, full lint/typecheck/build, and a live browser check of the chat flow end-to-end — run without a real `ANTHROPIC_API_KEY`, which exercises the graceful-degradation path explicitly.
- **Phase 6 — Portfolio Analyst + Report Summarizer agents, RAG knowledge base, source-citation UI**: complete. The shared tool-calling loop was extracted out of Budget Coach (`agents/_loop.py`) so all three agents reuse it instead of copy-pasting. **Portfolio Analyst**: `get_holdings` + `calculate_allocation`/`calculate_risk_score` (`tools/portfolio_metrics.py`, ported 1:1 from the TS portfolio analytics so the numbers always match the Portfolio page) plus the existing investment-growth calculator. **RAG knowledge base**: a `KnowledgeArticle` model with a pgvector `Unsupported("vector(512)")` column and an HNSW cosine-similarity index (Prisma can't generate DDL for `Unsupported` columns, so that migration is hand-written); ten curated financial-education articles (`rag/knowledge_base.py`); an `EmbeddingClient` mirroring `LLMClient`'s swappable-backend pattern, calling Voyage AI's REST API directly via `httpx` rather than the official SDK, which pulls in numpy/tokenizers/langchain — far more than embedding a few dozen short articles needs; an offline `rag/seed.py` script (`python -m rag.seed`) that degrades to a clear no-op without `VOYAGE_API_KEY`, same posture as everything else in Phase 5/6. **Report Summarizer**: `get_dashboard_snapshot` (`tools/dashboard_snapshot.py`, ported from the TS dashboard service — net worth, this-month income/expenses/savings rate, category breakdown, 50/30/20 groups) + `rag_lookup`, which degrades per-tool-call (not per-agent) when embeddings aren't configured, so the model can still answer the numeric half of a question. The router now dispatches all three intents to their real agents instead of a "not yet available" stub. Verified with 70 pytest tests (including live-Postgres tests for `get_holdings`/`get_dashboard_snapshot` and a pgvector ranking-correctness test using crafted vectors) + full web lint/typecheck/build/unit/integration, and a live browser check confirming all three intents dispatch correctly and degrade gracefully without a real `ANTHROPIC_API_KEY`.
- **Phase 7 — budgets/alerts, exports, settings/data-controls**: complete. A `CategoryBudget` model (configurable per-category monthly limits, distinct from the fixed 50/30/20 group targets) with a `lastAlertedMonth` dedup field, since there's no job scheduler in v1 — over-limit alerts are checked on every `/budgets` page load and email at most once per category per month. An `EmailClient` mirrors the `LLMClient`/`EmbeddingClient` swappable-backend pattern from Phase 5/6, calling Resend's REST API directly and no-op-logging when `RESEND_API_KEY` is unset, so the alert-triggering logic (including the dedup) is fully unit/integration-tested without needing real email credentials. **Exports**: `GET /api/exports/report?format=csv|pdf` — a period-summary export (KPIs, 50/30/20 groups, category breakdown) reusing the existing Phase 3 dashboard service; CSV via a small hand-written RFC-4180-ish escaper (`lib/csv.ts`), PDF via `pdf-lib` (chosen over a headless-browser approach — no Puppeteer/Playwright dependency for a one-page text report). **Settings**: a per-workspace `aiEnabled` toggle respected by the `/api/advisor/chat` proxy (the actual trust boundary — refuses before ever reaching ai-service, with a redaction-gateway callout in the UI copy); connected-accounts management (rename/delete, with an explicit cascade warning since deleting an account also deletes its transactions and holdings); a full GDPR-style JSON data export (`/api/settings/data-export` — every workspace-scoped table); and a type-the-workspace-name-to-confirm workspace delete, restricted to the owner role. Also fixed a real bug caught during live verification: `Button` components rendered as `<a>` (the new export/data-export links, plus a pre-existing one in `EmptyState`) need `nativeButton={false}`, since Base UI's default `nativeButton={true}` expects the render target to actually be a `<button>` — found via a console-error check that's easy to skip if you only eyeball the page. Verified with 37 integration tests (up from 20), 62 unit tests (up from 52), full lint/typecheck/build, and a live browser check: set a category budget against real seeded data and confirmed the 196%-over-budget status and the graceful "would send" email log line, toggled the AI switch and confirmed both the DB write and the advisor's refusal message, and fetched all three new endpoints (CSV, PDF, JSON export) in-browser to confirm real file output.
- **Phase 8 — hardening: accessibility, load testing, security, deployment**: complete. **Accessibility**: real Playwright + axe-core E2E infrastructure (`apps/web/e2e/`, wired into CI) scanning every core page in both desktop and mobile viewports — found and fixed two real WCAG violations (an icon-only send button with no accessible name; two `Select` triggers with no accessible name), not hypothetical ones. **Security**: Postgres row-level-security policies enabled (not forced) on every workspace-scoped table as defense-in-depth behind the already-tested app-layer isolation, with a `forWorkspace()` Prisma-extension helper and its correctness manually verified against a temporary restricted DB role, since the local/CI Postgres role is a superuser and unconditionally bypasses RLS — full app-wide enforcement is scoped as documented follow-up work, not silently claimed done; a Redis-backed token-bucket rate limiter (fails open when Redis is unreachable) applied to statement uploads and chat messages; `npm audit`/`pip-audit` run for real, fixing what was safely fixable (including a Next.js patch bump resolving 5 advisories, verified with a full re-run of every test suite) and documenting the rest. **Load testing**: k6 itself wasn't installable in this environment (needs elevated Windows install); real concurrent-load scripts against live Postgres and a live ai-service instance instead, producing actual percentile numbers (20 concurrent statement uploads: p50=454ms, p99=503ms, all succeeded). **Deployment**: a tested Dockerfile for `apps/ai-service` (built, run, health-checked, and hit with a real request locally), Vercel/Fly.io configs verified to actually build with the exact commands they specify, a deploy CI workflow that's inert until real cloud credentials are added, and `docs/DEPLOYMENT.md` — including an explicit, undisguised note that Sentry/observability wiring is the one architecture.md §16 item with no code behind it yet.

One incidental finding along the way, unrelated to the app itself: the `dotenv` package prints a promotional message to console output on load (`⌁ auth for agents [www.vestauth.com]`), traced to a hardcoded string in its own source — flagged to the user as a supply-chain-hygiene curiosity, not acted on.
