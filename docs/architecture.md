# WealthPilot — AI-Powered Personal Finance & Portfolio Platform
## Architecture & Product Design Document (v1.0 — Pre-Implementation)

Status: **Draft for approval — no code written yet, per engagement instructions.**

---

## 0. Research Summary (Why This Architecture)

Before designing, I reviewed the two repos you referenced plus adjacent open-source and commercial products. Key findings and how they shape this design:

### 0.1 `anujdevsingh/financial_genius_agent` (FinGenius)
- **What it is**: A FastAPI backend that ingests real bank statements (CSV/XLSX), normalizes messy data (day-first dates, debit/credit columns, UPI merchant strings), computes a dashboard snapshot (KPIs, 50/30/20 budget, cash flow), and exposes a chat-based AI advisor built as a **LangGraph ReAct agent** with 5 tool categories: structured-output categorization, RAG over a financial knowledge base (Chroma), embeddings-based semantic transaction search, deterministic financial calculators (budget/emergency-fund/debt/investment/loan), and the orchestrating agent itself.
- **Notable engineering decisions worth adopting**:
  - **Server-side session isolation** (signed, HttpOnly cookie; server never trusts a client-supplied ID) — directly informs our auth/session design.
  - **PII redaction layer sitting between the app and the LLM provider** — account numbers, reference IDs, and payment-VPA strings are stripped before anything reaches OpenAI. We adopt this as a mandatory "redaction gateway" in front of every outbound AI call.
  - **Deterministic tools vs. generative tools split**: calculators are plain functions the agent calls (not LLM-guessed math) — this is the correct pattern and we replicate it: **never let the LLM compute money**, only let it call verified functions.
  - **Rate limiting + a global daily "LLM-unit" budget cap** — necessary for any product exposing an LLM to end users; we generalize this into a token/cost governor.
  - **Weakness we deliberately fix**: single-file vanilla JS frontend, in-memory-only storage (no persistence, no multi-device, no real auth, no multi-tenant DB). Fine for a portfolio demo, not viable for a real product. We replace this with a typed, componentized frontend and a real persisted, multi-tenant data layer.

### 0.2 `AI4Finance-Foundation/FinRobot`
- **What it is**: A multi-agent financial-analysis platform structured around three concerns: `agents/` (role-based LLM agents — equity analyst, risk assessor, etc.), `data_source/` (connectors to Finnhub, SEC filings, FMP), and `functional/` (reusable analytical toolkits: charting, quantitative functions, report building). Agents are composed via a "Financial Chain-of-Thought" prompting pattern and can collaborate (multi-agent workflows) rather than being one monolithic prompt.
- **What we adopt**:
  - **Separation of agents (reasoning/orchestration) from data_source (I/O) from functional (deterministic business logic)** — this three-layer split maps cleanly onto our own AI service: `agents/` (orchestration graphs), `connectors/` (market data, bank aggregation APIs), `tools/` (pure functions: ratios, projections, risk scores).
  - **Role-scoped agents instead of one generalist agent** — for our product this means a small agent roster (Budget Coach, Portfolio Analyst, Tax/Report Summarizer) behind a single router, rather than one prompt trying to do everything.
  - **Citations/evidence-grounding for financial claims** — FinRobot's report generation pulls directly from filings/data sources rather than letting the model free-associate; we require the same "grounded-only" constraint for anything resembling financial advice.

### 0.3 Modern SaaS / fintech dashboard products (Stripe Dashboard, Mercury, Copilot Money, Monarch Money, and 2026 open-source admin kits such as `shadcn-admin`, `next-shadcn-dashboard-starter`, Tremor-based analytics kits)
- **Consistent architectural pattern across all of them**:
  - Next.js **App Router** with server components for data-heavy pages and client components only where interactivity is required (forms, charts, real-time widgets).
  - **shadcn/ui + Radix UI + Tailwind** as the component foundation — because components are copy-owned (not a black-box npm dependency), accessible by default (Radix handles ARIA/keyboard nav), and themeable via CSS variables/design tokens rather than hardcoded classes.
  - **Feature-based/vertical-slice folder structure** (`features/<domain>/{components,hooks,api,types}`) instead of horizontal layering (`components/`, `hooks/`, `services/` at the root) — this scales far better once the app has 6–10 real domains (accounts, transactions, budgets, portfolio, AI chat, settings, billing).
  - **Server state vs. UI state separation**: TanStack Query (or RSC + server actions) owns anything from the network; Zustand (or React context) owns ephemeral UI state (sidebar open/closed, active tab, wizard step). Nobody reaches for Redux anymore for this class of app.
  - **URL-driven state for filters/tables** (`nuqs` or native search params) so table filters/pagination are shareable/bookmarkable and survive refresh.
  - **Command palette (Cmd+K), dark/light theme via CSS variables, responsive sidebar → drawer on mobile** are now table-stakes UX patterns for this product category, not nice-to-haves.
  - **Accessibility**: WCAG 2.1 AA is the de facto bar for fintech SaaS in 2026 — driven by Radix primitives (correct roles, focus traps, keyboard nav) plus semantic HTML and tested contrast ratios, not retrofitted after launch.
- **Why this matters for a finance product specifically**: money UIs need tabular-figure typography (`font-variant-numeric: tabular-nums`) so digits align in columns, strict color semantics (green/red must not be the *only* signal — pair with icons/text for colorblind users), and empty/loading/error states designed as first-class UI (a broken chart on a finance page destroys trust immediately).

### 0.4 Synthesis — what this project borrows from each source
| Source | What we take |
|---|---|
| FinGenius | Statement ingestion pipeline design, PII redaction gateway, deterministic-tool-calling pattern, session/rate-limit discipline |
| FinRobot | agents/connectors/tools three-layer split, role-scoped multi-agent roster, grounded-evidence constraint |
| Modern SaaS dashboards | Next.js App Router + shadcn/ui + Tailwind, feature-sliced folders, TanStack Query + Zustand split, accessibility-first components |

This synthesis is the basis for everything below.

---

## 1. Product Requirements

### 1.1 Product Vision
WealthPilot is a personal finance and portfolio management web application that lets a user connect or upload their financial data (bank statements, brokerage holdings), see a unified real-time picture of their money, and converse with an AI advisor that answers questions **grounded strictly in the user's own data plus vetted financial reference material** — never generic, unsourced advice.

### 1.2 Goals (v1 scope)
1. Ingest transactions via CSV/XLSX upload (bank-agnostic parser) and via a mocked/aggregator API adapter (Plaid-shaped interface, swappable later).
2. Categorize transactions automatically (rules first, LLM fallback for unknowns, capped).
3. Show a dashboard: net worth, cash flow, spending by category, budget (50/30/20 configurable), and a portfolio view (holdings, allocation, performance).
4. Provide an AI Advisor chat, grounded in the user's data, that can: answer spending questions, run "what-if" projections, explain portfolio allocation/risk, and summarize a statement period — using tool-calling, not free text guessing.
5. Multi-user, authenticated, persisted (not in-memory), with per-user data isolation enforced at the database layer.
6. Be accessible (WCAG 2.1 AA), responsive (mobile/tablet/desktop), and fast (Core Web Vitals green).

### 1.3 Non-goals (v1)
- Real bank OAuth aggregation (Plaid/TrueLayer) integration is stubbed behind an adapter interface — not a live integration in phase 1.
- Real brokerage trade execution (this is an analysis/tracking product, not a trading platform).
- Multi-currency conversion beyond display formatting (no live FX conversion engine in v1).
- Regulatory-grade licensed financial advice — the product must always present itself as informational/educational, not fiduciary advice (see Legal/Compliance in Security section).

### 1.4 Success metrics
- Time-to-first-insight after upload < 5s (p95) for statements ≤ 5,000 rows.
- AI Advisor first-token latency < 1.5s (p95), full grounded answer < 6s (p95).
- Zero cross-tenant data leakage (verified by automated tests every build).
- Lighthouse accessibility score ≥ 95 on all primary routes.

---

## 2. User Personas

**1. Priya, 29, Product Manager (Primary persona)**
Tech-comfortable, has 3 bank accounts and a brokerage account, wants one place to see where money goes and whether she's on track for a house down payment. Uses the product 2–3x/week on both desktop (payday review) and mobile (quick balance checks). Wants the AI to answer "can I afford X" questions in her own numbers, not generic tips.

**2. Marcus, 45, Small business owner (Secondary persona)**
Less technical, manages both personal and business-adjacent spending, anxious about retirement readiness. Needs very clear visual summaries, larger touch targets, low cognitive load, and reassurance-style AI copy (not judgmental). Occasional user (weekly), desktop-first.

**3. Dana, 34, Power user / early-retirement (FIRE) enthusiast (Tertiary persona)**
Tracks a multi-account portfolio closely, wants granular category rules, CSV exports, and detailed portfolio analytics (allocation drift, risk). Will push the AI advisor with complex multi-step questions and wants to see its reasoning/sources.

---

## 3. User Journeys

### 3.1 Onboarding & first insight (Priya)
Sign up → verify email → create workspace → prompted to "Upload a statement or connect an account" → drag-drop CSV → parsing progress indicator → categorization preview screen (user can correct 2–3 miscategorized rows, which trains a per-user rule) → dashboard renders with KPIs/charts → contextual tooltip: "Ask your AI Advisor about this" → first chat message.

### 3.2 Weekly check-in (Marcus)
Log in → dashboard loads (server-rendered, cached) → glance at net worth trend + budget bar → notices "Dining" over budget → taps category → drill-down transaction list → asks AI Advisor "why is dining higher this month?" → AI cites the specific transactions and merchants driving the delta → Marcus sets a category alert threshold.

### 3.3 Portfolio deep-dive (Dana)
Opens Portfolio tab → sees allocation donut + performance chart → asks AI Advisor "how concentrated am I in tech stocks?" → agent calls a portfolio-analysis tool (deterministic, not hallucinated) → returns concentration % with citation to holdings data → Dana exports a CSV report.

### 3.4 Error/edge journey
Upload a corrupted/unsupported file → parser returns a structured error → UI shows an actionable message ("We couldn't find a date column — here's what we detected") with a manual column-mapping fallback UI, not a dead end.

---

## 4. Feature Specification

| Feature | Description | Priority |
|---|---|---|
| Auth & workspace | Email/password + OAuth (Google), session via httpOnly JWT, multi-tenant workspace model | P0 |
| Statement upload & parsing | CSV/XLSX ingestion, bank-format auto-detection, column mapping fallback UI | P0 |
| Transaction categorization | Rule-engine first, LLM fallback (capped/cached), user-correctable, per-user learned rules | P0 |
| Dashboard (net worth, cash flow, budget) | KPI cards, trend charts, 50/30/20 budget bar, category breakdown | P0 |
| Transactions table | Sortable/filterable/paginated, URL-persisted filters, inline edit category | P0 |
| Portfolio tracking | Manual holdings entry (v1) + adapter interface for future brokerage sync; allocation, performance, risk metrics | P1 |
| AI Advisor chat | Grounded chat, tool-calling (calculators, RAG, semantic search over transactions), citation of sources, streaming responses | P0 |
| Budgets & alerts | Configurable category budgets, threshold alerts (in-app + email) | P1 |
| Reports/export | PDF/CSV export of period summaries | P2 |
| Settings & data controls | Profile, connected sources, data export/delete (GDPR-style), AI data-usage toggle | P0 |
| Accessibility & theming | Light/dark, reduced-motion, keyboard nav, screen-reader labeling throughout | P0 |

---

## 5. UI Wireframes (textual)

### 5.1 App shell (desktop, ≥1024px)
```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar: [Logo] [Workspace switcher]      [Search ⌘K] [Theme] [Avatar] │
├───────────────┬──────────────────────────────────────────────────────┤
│ Sidebar        │  Page content (max-width container, 24px gutter)     │
│ ─ Dashboard    │                                                       │
│ ─ Transactions │   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ ─ Budgets      │   │ Net Worth│ │Cash Flow │ │ Savings %│  KPI cards │
│ ─ Portfolio    │   └──────────┘ └──────────┘ └──────────┘            │
│ ─ AI Advisor   │   ┌────────────────────────────┐ ┌────────────────┐ │
│ ─ Settings     │   │ Cash flow trend (line)      │ │ Spend by cat   │ │
│                │   │                              │ │ (donut)        │ │
│                │   └────────────────────────────┘ └────────────────┘ │
│ [Collapse ⟨⟨]  │   ┌────────────────────────────────────────────────┐ │
│                │   │ Recent transactions (table, 10 rows) [View all]│ │
└───────────────┴────────────────────────────────────────────────────┘
        Persistent AI Advisor entry point: floating action button (bottom-right)
        opening a slide-over chat panel, always available cross-page.
```

### 5.2 Mobile (<768px)
```
┌───────────────────────────┐
│ Topbar: [☰] Logo   [⌘K][●]│
├───────────────────────────┤
│ KPI cards (horiz. scroll) │
│ Cash flow (compact chart) │
│ Category donut            │
│ Transactions (5 rows)     │
├───────────────────────────┤
│ Bottom tab bar:            │
│ [Home][Txns][Budget][AI][⚙]│
└───────────────────────────┘
```
Sidebar collapses to the bottom tab bar; AI Advisor becomes its own full-screen tab rather than a slide-over (thumb-reachable, avoids overlay-on-overlay on small screens).

### 5.3 AI Advisor panel
```
┌───────────────────────────────────┐
│ AI Advisor                    [x] │
├───────────────────────────────────┤
│ [assistant] Based on your March    │
│ transactions, dining spend is ₹8,4│
│ 00, 22% above your budget.        │
│ Sources: 14 transactions ▾        │
│                                    │
│ [user] why is that higher?        │
│                                    │
│ [assistant, streaming...] ▍       │
├───────────────────────────────────┤
│ Suggested: "Am I on track for..." │
│ [Type a message...........] [Send]│
└───────────────────────────────────┘
```
Every assistant answer that references numbers has an expandable "Sources" disclosure listing the underlying transactions/tool calls used — this is the grounding-transparency requirement carried over from the FinRobot evidence-citation pattern.

---

## 6. Design System

### 6.1 Foundation
- **Base**: Tailwind CSS v4 (CSS-variable design tokens) + shadcn/ui components (Radix primitives) — copy-owned, not a locked dependency.
- **Typography**: Inter (UI text), tabular numerals (`font-variant-numeric: tabular-nums`) for all monetary figures and tables. Type scale: 12/14/16/20/24/32/40px.
- **Color tokens** (semantic, theme-able via CSS vars, both light/dark defined):
  - `--background`, `--foreground`, `--card`, `--border`, `--muted`
  - `--primary` (brand action color), `--positive` (gains/income — green), `--negative` (loss/spend over budget — red), `--warning` (amber)
  - Rule: color is never the sole indicator — a "negative" value always also gets a ▼ icon or "-" prefix and text label for colorblind accessibility.
- **Spacing scale**: 4px base unit (4/8/12/16/24/32/48/64).
- **Radius**: `--radius-sm/md/lg` tokens (default 8px), consistent across cards/buttons/inputs.
- **Elevation**: 3-level shadow scale (flat cards, raised popovers/modals, floating action button).
- **Motion**: 150–200ms ease-out for micro-interactions; respects `prefers-reduced-motion`.
- **Iconography**: lucide-react, 20px default, 1.5px stroke.

### 6.2 Accessibility rules baked into the system
- Minimum 4.5:1 contrast for text, 3:1 for large text/icons.
- All interactive elements reachable by keyboard, visible focus ring (`--ring` token), no keyboard traps.
- Charts always paired with a data-table or textual summary alternative for screen readers.
- Form errors announced via `aria-live="polite"` regions, not color alone.

---

## 7. Component Inventory

**Primitives (from shadcn/ui, copy-owned in `components/ui/`)**: Button, Input, Select, Dialog, Sheet (slide-over), DropdownMenu, Tabs, Tooltip, Popover, Badge, Card, Table, Skeleton, Toast/Sonner, Avatar, Command (⌘K palette), Checkbox, Switch, Progress.

**Domain components** (`features/*/components/`):
- `KpiCard` (value, delta, trend sparkline, label)
- `CashFlowChart`, `CategoryDonutChart`, `NetWorthTrendChart`, `PortfolioAllocationChart` (Recharts-based, theme-aware)
- `BudgetProgressBar` (category, spent/limit, over-budget state)
- `TransactionsTable` (sort/filter/paginate, inline category edit, virtualized for large sets)
- `StatementUploadDropzone` (drag-drop, progress, error/mapping fallback)
- `ColumnMappingWizard` (manual header→field mapping for unrecognized statement formats)
- `PortfolioHoldingsTable`, `HoldingEditDialog`
- `AiChatPanel`, `AiMessageBubble` (with streaming + source-citation disclosure), `AiSuggestedPrompts`
- `AppSidebar`, `AppTopbar`, `MobileTabBar`, `WorkspaceSwitcher`
- `EmptyState`, `ErrorState`, `LoadingSkeletonGrid` (first-class states for every data view)

---

## 8. Folder Structure

Feature-sliced structure (per research above), Next.js App Router, TypeScript throughout.

```
wealthpilot/
├── apps/
│   ├── web/                        # Next.js app (frontend + BFF API routes)
│   │   ├── app/                    # App Router: routes only, thin
│   │   │   ├── (auth)/login/       (auth)/signup/
│   │   │   ├── (app)/dashboard/    (app)/transactions/
│   │   │   │   (app)/budgets/      (app)/portfolio/
│   │   │   │   (app)/advisor/      (app)/settings/
│   │   │   └── api/                # Route handlers (proxy to backend / server actions)
│   │   ├── features/
│   │   │   ├── auth/{components,hooks,api,types}
│   │   │   ├── dashboard/{components,hooks,api,types}
│   │   │   ├── transactions/{components,hooks,api,types}
│   │   │   ├── budgets/{...}
│   │   │   ├── portfolio/{...}
│   │   │   └── advisor/{components,hooks,api,types}   # chat UI, streaming hook
│   │   ├── components/ui/          # shadcn primitives (copy-owned)
│   │   ├── components/layout/      # Sidebar, Topbar, MobileTabBar
│   │   ├── lib/                    # api client, query client, formatters, cn()
│   │   ├── stores/                 # Zustand stores (ui-only state)
│   │   ├── styles/                 # globals.css, tokens.css
│   │   ├── tests/                  # Playwright e2e
│   │   └── middleware.ts           # auth/session guard
│   └── ai-service/                 # Python FastAPI microservice (the "agent brain")
│       ├── agents/                 # role-scoped agents + LangGraph orchestration graph
│       │   ├── router.py           # classifies intent → routes to sub-agent
│       │   ├── budget_coach.py
│       │   ├── portfolio_analyst.py
│       │   └── report_summarizer.py
│       ├── tools/                  # deterministic functions the agent calls
│       │   ├── calculators.py      # budget, emergency fund, investment growth, loan
│       │   ├── categorize.py       # structured-output categorization
│       │   └── portfolio_metrics.py
│       ├── rag/                    # vector store + retriever over finance knowledge base
│       ├── connectors/             # market-data + (future) bank-aggregator adapters
│       ├── privacy/                # PII redaction gateway (mandatory pre-LLM step)
│       ├── ingestion/               # statement parsing (bank-format detection)
│       ├── main.py                 # FastAPI app, streaming endpoints
│       └── tests/
├── packages/
│   ├── db/                         # Prisma schema + migrations + seed scripts
│   ├── shared-types/                # generated/shared TS types (OpenAPI codegen)
│   └── config/                     # eslint, tsconfig, tailwind config presets
├── infra/
│   ├── docker-compose.yml          # local: web, ai-service, postgres, redis
│   └── deploy/                     # Vercel config, Fly.io/Render config for ai-service
├── .github/workflows/               # CI: lint, typecheck, unit, e2e, build
└── docs/                            # this architecture doc + ADRs
```

**Rationale**: The frontend (`apps/web`) is a Next.js monolith for DX and SEO/SSR benefits; the AI agent brain is a **separate Python service** because the best agent/RAG tooling (LangGraph, LangChain, vector libraries) is Python-native — this mirrors both reference repos, which are Python-first for the AI layer. The web app talks to `ai-service` over an internal HTTP/streaming API, never exposing it directly to the browser.

---

## 9. API Specification (representative endpoints)

Base: `/api/v1`. Auth via `Authorization: Bearer <jwt>` (session token), workspace-scoped (`workspaceId` derived from token, never trusted from client body).

```
POST   /auth/register                       {email, password}
POST   /auth/login                          {email, password} -> {accessToken, refreshToken}
POST   /auth/refresh
POST   /auth/logout

GET    /workspaces/me
POST   /workspaces                          {name}

POST   /statements/upload                   multipart file -> {jobId}
GET    /statements/upload/:jobId/status     -> {status, mappingRequired?, preview?}
POST   /statements/upload/:jobId/mapping    {columnMap} (manual fallback)
POST   /statements/upload/:jobId/confirm    -> persists transactions

GET    /transactions?from&to&category&page&pageSize&sort
PATCH  /transactions/:id                    {category?, note?}
POST   /transactions/rules                  {matcher, category}   (user-learned rule)

GET    /dashboard/summary?period=month
GET    /dashboard/cashflow?range=6m
GET    /budgets
PUT    /budgets/:category                   {limit}

GET    /portfolio/holdings
POST   /portfolio/holdings                  {symbol, quantity, costBasis}
PUT    /portfolio/holdings/:id
DELETE /portfolio/holdings/:id
GET    /portfolio/analytics                 -> {allocation, performance, riskScore}

POST   /advisor/chat                        {message, conversationId} -> SSE stream
GET    /advisor/conversations/:id
GET    /advisor/conversations/:id/sources   -> tool-call/citation trail

GET    /exports/report?period&format=pdf|csv
GET    /settings/data-export
DELETE /settings/account                    (GDPR-style delete, cascades)
```

**Conventions**: all list endpoints are cursor-paginated; all monetary values transmitted as integer minor units (paise/cents) with an explicit `currency` field to avoid floating-point money bugs; every mutating endpoint requires an idempotency key on financial-affecting operations (uploads, holdings edits).

---

## 10. Database Schema (PostgreSQL, via Prisma)

```
Workspace(id, name, createdAt)
User(id, email, passwordHash, name, createdAt)
WorkspaceMember(id, workspaceId FK, userId FK, role[owner|member], createdAt)

Account(id, workspaceId FK, name, institution, type[checking|savings|credit|brokerage],
        currency, createdAt)

Transaction(id, workspaceId FK, accountId FK, postedAt, amountMinor, currency,
            description, merchantRaw, merchantNormalized, category, subcategory,
            source[upload|manual|adapter], redactedFieldsHash, createdAt)
            -- index: (workspaceId, postedAt), (workspaceId, category)

CategoryRule(id, workspaceId FK, matcherPattern, category, priority, createdAt)

Budget(id, workspaceId FK, category, limitMinor, period[monthly], createdAt)

Holding(id, workspaceId FK, accountId FK, symbol, quantity, costBasisMinor,
        assetClass, createdAt, updatedAt)

PortfolioSnapshot(id, workspaceId FK, asOf, totalValueMinor, allocationJson, riskScore)

Conversation(id, workspaceId FK, userId FK, title, createdAt)
Message(id, conversationId FK, role[user|assistant|tool], content,
        toolCallsJson, sourcesJson, createdAt)

UploadJob(id, workspaceId FK, status[pending|mapping_required|processing|done|error],
          fileName, detectedFormat, errorDetail, createdAt)

AuditLog(id, workspaceId FK, actorUserId FK, action, entityType, entityId, metadataJson, createdAt)
```

All tenant-scoped tables carry `workspaceId` and every query goes through a repository layer that injects the current workspace filter — never optional, enforced by a lint rule/test that fails CI if a raw Prisma query on a tenant table omits `workspaceId`. Postgres Row-Level Security is enabled as a second, defense-in-depth layer.

---

## 11. State Management Strategy

- **Server state** (anything from the API/DB): **TanStack Query** in the client components that need it, and **React Server Components + server actions** for the initial page loads (dashboard, transactions list) — avoids duplicate client-side fetch waterfalls and gets fast first paint.
- **UI-only state** (sidebar collapsed, active modal, chat panel open/closed, theme): **Zustand**, small isolated stores per concern — no global monolithic store.
- **URL state**: filters, pagination, date range, and selected tab live in the URL (`nuqs`) so views are shareable, back-button-safe, and refresh-safe.
- **Form state**: `react-hook-form` + `zod` schemas shared between client validation and the API layer (same schema, imported from `packages/shared-types`) so validation logic is never duplicated.
- **Streaming AI state**: a dedicated `useAdvisorChat` hook manages the SSE stream from `/advisor/chat`, buffering tokens into the message list, with the "sources" panel derived from the final tool-call trail.
- **No Redux** — the split above covers every case this app needs with less boilerplate and better DX.

---

## 12. Authentication Strategy

- **Primary**: email + password (Argon2id hashing) plus Google OAuth, via **Auth.js (NextAuth)** on the Next.js side issuing short-lived access JWTs (15 min) + rotating httpOnly refresh cookies (7 days, `SameSite=Lax`, `Secure`).
- **Session model borrows FinGenius's discipline**: the server is the source of truth for session identity; the client never sets or guesses an identifier. CSRF protection via double-submit token on state-changing requests, since cookies are used.
- **Workspace scoping**: JWT carries `userId` + active `workspaceId`; switching workspace re-issues a token, never trusts a client-supplied workspace header for authorization decisions (only for UX convenience, always re-verified server-side against `WorkspaceMember`).
- **Authorization**: role-based (`owner`, `member`) at the workspace level to start; policy checks centralized in a single `can(user, action, resource)` function, not scattered `if` checks.
- **MFA**: TOTP-based 2FA optional in v1, recommended before handling connected-bank data in a later phase.

---

## 13. AI Workflow

### 13.1 Orchestration pattern
A **router agent** classifies the user's message intent, then dispatches to one of three role-scoped sub-agents (mirroring FinRobot's role-based agent roster, kept intentionally small for v1):

1. **Budget Coach** — spending/cash-flow/budget questions. Tools: `get_transactions`, `categorize_transaction` (structured output), `search_transactions_semantic` (embeddings), `calculate_budget_projection`.
2. **Portfolio Analyst** — allocation/risk/performance questions. Tools: `get_holdings`, `calculate_allocation`, `calculate_risk_score`, `calculate_investment_growth`.
3. **Report Summarizer** — "summarize my month/quarter" requests. Tools: `get_dashboard_snapshot`, `rag_lookup` (financial glossary/education KB).

### 13.2 Grounding & safety rules (non-negotiable, carried from research)
- The LLM **never computes money** — every numeric answer must come from a deterministic tool call, not free generation. This is enforced by having tools return the numbers and the LLM only narrate them.
- Every response referencing user data must attach a **source trail** (which transactions/tool calls produced it), rendered in the "Sources" disclosure in the UI.
- **PII redaction gateway**: before any text leaves the process boundary to the LLM provider, account numbers, reference IDs, and raw payment strings are stripped (regex + rule-based, tested with golden fixtures), regardless of which agent is calling.
- **Educational framing**: system prompt and UI copy both state the assistant provides informational analysis, not licensed financial/investment advice; a persistent disclaimer footer in the chat panel.
- **Cost governance**: per-workspace daily token budget + per-minute rate limit (pattern taken directly from FinGenius's daily LLM-unit cap), with graceful degradation (deterministic dashboard still works if the AI budget is exhausted).

### 13.3 RAG
A small, curated financial-education knowledge base (budgeting frameworks, investment-risk concepts, glossary) embedded and stored in pgvector (co-located with the main Postgres DB, avoiding an extra service for v1). Retrieval is used only for *conceptual* questions ("what is an emergency fund"), never as a substitute for the deterministic tools when the question is about the user's own numbers.

### 13.4 Model
Primary: a hosted LLM with strong tool-calling and streaming support (model-agnostic interface — `apps/ai-service` wraps the provider behind an internal `LLMClient` so the underlying model can be swapped without touching agent code).

---

## 14. Security Considerations

- **Tenant isolation**: `workspaceId` filter enforced at repository layer + Postgres RLS as defense-in-depth; automated cross-tenant-leak tests in CI (attempt to read workspace B's data with workspace A's token → must 403).
- **Secrets**: never in the frontend bundle; all provider keys live in the `ai-service` backend only, accessed via server-only env vars.
- **Transport**: TLS everywhere; HSTS; httpOnly + Secure + SameSite cookies for session tokens.
- **Input validation**: all API input validated with zod schemas server-side (never trust client validation alone); file uploads size/type restricted, virus-scanned before parsing, parsed in a sandboxed worker (never `eval`/dynamic execution of uploaded content).
- **PII handling**: redaction gateway (Section 13.2) before any LLM call; data retention policy documented; user-triggered data export/delete (GDPR-style) implemented as a real, tested endpoint, not a placeholder.
- **Rate limiting & abuse prevention**: per-user and per-workspace limits on uploads, chat messages, and API calls (Redis-backed token bucket).
- **Audit logging**: security-relevant actions (login, holdings edits, data export/delete, category-rule changes) written to an append-only `AuditLog`.
- **Dependency hygiene**: automated dependency scanning (`npm audit` / `pip-audit`) in CI, Dependabot enabled.
- **Compliance framing**: the product explicitly disclaims licensed financial/investment advice (see 13.2) to keep scope inside "informational tooling," which is the correct legal posture for a v1 product without a licensed advisor in the loop — this is a product/legal decision to revisit with counsel before any monetized "advice" claims.

---

## 15. Testing Plan

| Layer | Tool | Coverage target |
|---|---|---|
| Unit (frontend) | Vitest + React Testing Library | Components, hooks, formatters, zod schemas |
| Unit (ai-service) | Pytest | Tools (calculators — exact numeric assertions), redaction gateway (golden fixtures), categorization rules |
| Integration | Vitest (API routes) / Pytest (FastAPI TestClient) | Upload→parse→categorize→persist pipeline; auth flows; tenant-isolation checks |
| Contract | OpenAPI schema validation | Frontend `shared-types` generated from the same OpenAPI spec the backend serves — CI fails on drift |
| E2E | Playwright | Core journeys from Section 3 (onboarding, weekly check-in, portfolio deep-dive), across desktop + mobile viewport, with axe-core accessibility assertions on every page |
| Load/perf | k6 (basic) | Upload endpoint under concurrent load, chat streaming latency budget |
| Security | Automated tenant-leak test suite (Section 14) | Runs on every PR |

CI gate: lint → typecheck → unit → integration → build → (nightly) e2e + a11y scan. No merge to `main` without green CI; no phase in the implementation plan is considered "done" without its tests passing.

---

## 16. Deployment Plan

- **Frontend (`apps/web`)**: Vercel (native Next.js support, edge caching for static/SSR pages, preview deployments per PR).
- **AI service (`apps/ai-service`)**: containerized FastAPI on Fly.io or Render (needs a long-lived process for streaming + background ingestion jobs, unlike serverless-friendly Next.js routes).
- **Database**: managed Postgres (Neon/Supabase/RDS) with pgvector extension enabled; automated daily backups, point-in-time recovery.
- **Cache/queue**: Redis (rate limiting, upload-job queue) — managed (Upstash) to avoid ops overhead in early phases.
- **Environments**: `local` (docker-compose), `preview` (per-PR, ephemeral DB branch), `staging`, `production`.
- **CI/CD**: GitHub Actions — on PR: lint/typecheck/unit/integration/build; on merge to `main`: deploy to staging automatically, production via manual approval gate.
- **Observability**: structured logging (pino/structlog), error tracking (Sentry) on both frontend and ai-service, uptime checks on `/health` endpoints, cost dashboard for LLM token spend (mirroring FinGenius's daily-cap concept, but as a monitored metric rather than a hard-coded constant).
- **Migrations**: Prisma Migrate, applied via CI pipeline with a manual approval step for production.

---

## 17. Proposed Implementation Phasing (for after approval)

1. **Phase 0** — Repo scaffold, tooling (TS strict, eslint/prettier, Tailwind/shadcn setup), CI skeleton, empty but running app + health-check tests.
2. **Phase 1** — Auth + workspace model + DB schema/migrations, protected shell layout (sidebar/topbar/mobile nav), design tokens.
3. **Phase 2** — Statement upload/parsing pipeline + transactions table + categorization (rules engine first).
4. **Phase 3** — Dashboard (KPIs, cash flow, budget) with real data, empty/loading/error states.
5. **Phase 4** — Portfolio module (manual holdings CRUD + analytics).
6. **Phase 5** — AI service scaffold: redaction gateway, deterministic tools/calculators, router + Budget Coach agent, streaming chat UI.
7. **Phase 6** — Portfolio Analyst + Report Summarizer agents, RAG knowledge base, source-citation UI.
8. **Phase 7** — Budgets/alerts, exports, settings/data-controls (GDPR export/delete).
9. **Phase 8** — Hardening: accessibility audit, load testing, security review, deployment to staging/production.

Each phase ends with: compiling app, passing tests (unit + relevant integration/e2e), and a short demo-able increment — no phase ships placeholder/mocked business logic where real logic is feasible at that stage.

---

## Open Questions For You Before I Start Building
1. Should the initial LLM provider be a specific one you already have API access to (OpenAI/Anthropic/other), or should I keep the `LLMClient` abstraction and default to one for scaffolding?
2. Do you want real bank aggregation (Plaid-style OAuth) stubbed as an interface only in v1, or is CSV/XLSX upload the sole ingestion path for now?
3. Any existing brand/visual identity to match, or should I proceed with the neutral design-token system in Section 6?
4. Preferred hosting constraints (must it be Vercel/AWS/etc., or is my Section 16 proposal acceptable)?

Once you confirm the scope and answer the above (or tell me to use my best judgment), I'll begin Phase 0.
