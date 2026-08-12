# Deployment checklist

Deployment-ready, not deployed: everything in this checklist is real,
testable configuration (verified locally — see the notes under each
section), but nothing has actually been deployed anywhere. That needs
accounts and credentials only you can provide. Architecture reference:
`docs/architecture.md` §16.

## What's already done

- **`apps/ai-service/Dockerfile`** — multi-stage, non-root, healthchecked.
  Built and run locally against this repo's Postgres; `/health` and
  `/advisor/chat` both verified working inside the container.
- **`apps/ai-service/fly.toml`** — Fly.io app config (`iad` region,
  shared-cpu-1x/512mb, scales to zero when idle).
- **`apps/web/vercel.json`** — monorepo-aware install/build commands
  (`npm ci` and `next build` from the repo root, not `apps/web`, so the
  `@wealthpilot/db` workspace package resolves correctly). Verified locally
  by running the exact same commands from the repo root.
- **`packages/db`'s `postinstall` script** now runs `prisma generate`
  automatically — Vercel's default `npm install` step will pick this up
  without any custom build-command override for that part.
- **`.github/workflows/deploy.yml`** — staging-on-merge-to-main,
  production-behind-a-GitHub-Environment-approval, for both apps. Every job
  is gated on its required repo variable being set (`vars.VERCEL_PROJECT_ID`,
  `vars.FLY_APP_NAME`), so merging this workflow is a no-op until you wire up
  real accounts — it will not fail CI and will not attempt to deploy without
  credentials.
- **`.github/dependabot.yml`** — weekly npm/pip/GitHub Actions update PRs.

## What you need to provide before this goes live

### 1. Database — managed Postgres with pgvector
Neon, Supabase, or RDS (architecture.md's suggestions), or any Postgres 16+
host with the `vector` extension available. Run migrations against it once
provisioned:
```bash
DATABASE_URL=<production-url> npx prisma migrate deploy
```
Then seed the RAG knowledge base (needs `VOYAGE_API_KEY` too — see below):
```bash
cd apps/ai-service && python -m rag.seed
```

### 2. Cache — managed Redis
Upstash (architecture.md's suggestion) or any Redis 7+ host. Rate limiting
(Phase 8) fails open without it — the app still works, just without the
abuse-prevention layer, so this is a "should have," not a hard blocker.

### 3. Vercel project (`apps/web`)
Create a project, set **Root Directory** to `apps/web`, framework
auto-detects as Next.js. Environment variables needed:

| Variable | Required? |
|---|---|
| `DATABASE_URL` | Yes |
| `AUTH_SECRET` | Yes — generate with `openssl rand -base64 32` |
| `AI_SERVICE_URL` | Yes — the deployed ai-service's URL |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | No — Google sign-in disabled without them |
| `RESEND_API_KEY` | No — budget-alert emails stay in-app-only without it |
| `REDIS_URL` | No — rate limiting fails open without it |

Then set repo variables `VERCEL_PROJECT_ID` / `VERCEL_ORG_ID` and secret
`VERCEL_TOKEN` for `deploy.yml` to pick it up.

### 4. Fly.io (or Render) app (`apps/ai-service`)
```bash
cd apps/ai-service
fly launch --config fly.toml --no-deploy   # creates the app, don't deploy yet
fly secrets set DATABASE_URL_AI=<production-url>
fly secrets set ANTHROPIC_API_KEY=<key>    # optional — AI advisor degrades gracefully without it
fly secrets set VOYAGE_API_KEY=<key>       # optional — RAG lookup degrades gracefully without it
fly secrets set REDIS_URL=<production-url> # optional
fly deploy
```
Then set repo variable `FLY_APP_NAME` and secret `FLY_API_TOKEN` for
`deploy.yml`.

Fly.io requires a card on file for new accounts as of 2024 — Render is a
card-free alternative (free tier, sleeps after 15min idle): connect the repo
directly in Render's dashboard, set **Root Directory** to `apps/ai-service`
(it auto-detects the Dockerfile), and add the same env vars in Render's
dashboard instead of via `fly secrets set`. No GitHub Actions wiring needed —
Render deploys automatically on push, same as Vercel.

**Free-tier alternative to `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`:** set
`GEMINI_API_KEY` instead (from [aistudio.google.com](https://aistudio.google.com),
no card required). `llm_client.py` and `embedding_client.py` both prefer
Anthropic/Voyage when present and fall back to Gemini otherwise — see
`gemini_backend.py` / `gemini_embedding_backend.py`.

### 5. GitHub repo settings
- **Environments**: create `staging` and `production`. Add required
  reviewers to `production` — that's the actual manual-approval gate
  architecture.md §16 asks for; without it, `deploy.yml`'s production jobs
  run immediately after staging, same as any other job.
- **Secrets**: `VERCEL_TOKEN`, `FLY_API_TOKEN`.
- **Variables**: `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `FLY_APP_NAME`,
  `FLY_APP_NAME_PROD`.

### 6. Observability — not yet implemented
architecture.md §16 also calls for Sentry error tracking on both apps and a
cost dashboard for LLM token spend. Neither is wired up: both would need a
real Sentry project (another account this session doesn't have) and are
substantial enough additions (SDK integration, instrumentation files,
testing) that bundling them into an already-large hardening phase risked
doing them shallowly. Flagging this explicitly rather than silently
skipping it — it's the one architecture.md §16 item with no code behind it
at all, everything else above has been built and verified locally to the
extent possible without live cloud credentials.
