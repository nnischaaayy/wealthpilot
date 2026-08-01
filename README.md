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
- Docker Desktop (for local Postgres/Redis) — not required until Phase 1

### Web app

Install once from the repo root (npm workspaces link `packages/*` for you):

```bash
npm install
npm run dev         # http://localhost:3000
npm run test        # Vitest
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

## Status

Building phase-by-phase per [docs/architecture.md § 17](docs/architecture.md#17-proposed-implementation-phasing-for-after-approval). Currently: **Phase 0 — repo scaffold** complete.
