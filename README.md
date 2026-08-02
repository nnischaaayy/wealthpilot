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
- **Phase 5 — ai-service scaffold (redaction gateway, deterministic tools, router + Budget Coach, streaming chat)**: complete. A regex/rule-based PII redaction gateway (`apps/ai-service/privacy/redaction.py`) strips account numbers, card numbers, UPI-style payment handles, and reference IDs before any transaction text reaches the LLM, tested against golden fixtures; four deterministic calculators (budget projection, emergency fund, loan payment, investment growth) that return every number an agent states — the LLM only narrates, per architecture.md §13.2's non-negotiable "never compute money" rule; a workspace-scoped `get_transactions` tool reading the same Postgres schema Prisma owns via `asyncpg`; a model-agnostic `LLMClient` wrapping Anthropic behind a small protocol (agents never touch the SDK directly, and tests inject a scripted fake instead of hitting the network); a keyword-based intent router; and the Budget Coach agent itself, running a real tool-calling loop (up to 4 rounds) against Claude. `search_transactions_semantic` and `categorize_transaction` (also named for Budget Coach in §13.1) are deliberately deferred to Phase 6 alongside the pgvector RAG knowledge base, since semantic search needs the same embedding infra RAG does. On the web side: an internal `/api/advisor/chat` proxy route (ai-service is never exposed directly to the browser, per §12), a `useAdvisorChat` SSE-streaming hook, and a full chat UI on `/advisor` with tool-call "Sources" disclosure and a persistent informational-analysis disclaimer. Verified with 40 pytest tests (including live-Postgres tests for `get_transactions` and a scripted-backend suite that exercises the full tool-calling loop without a network call) + 4 new Vitest tests for the streaming hook, full lint/typecheck/build, and a live browser check of the chat flow end-to-end (message send → SSE stream → rendered response) — run without a real `ANTHROPIC_API_KEY`, which exercises the graceful-degradation path explicitly: the advisor says so plainly and the rest of the app keeps working, rather than the request failing silently.
