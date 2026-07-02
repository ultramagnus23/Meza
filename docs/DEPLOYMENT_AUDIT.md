# MEZA — Production Deployment Audit

## Frontend (Vercel)
- Next.js 14 App Router — deploys to Vercel with no custom config needed.
- **Blocker**: `next.config.mjs` sets `typescript: { ignoreBuildErrors: true }`. This means Vercel builds will succeed even with real type errors (e.g. the confirmed `api-client.ts` `ReferenceError`), silently shipping broken code. Must be removed before launch.
- **Blocker**: mixed lockfiles — a real `package-lock.json` and a stub, near-empty `pnpm-lock.yaml` both exist. Vercel's package-manager auto-detection could pick either, producing inconsistent installs. Pick one (npm, given `package-lock.json` is the real one) and delete the other.
- No `vercel.json` — fine, defaults are adequate for this app, but env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) must be configured in the Vercel project dashboard before first deploy.

## Database (Supabase PostgreSQL)
- Schema is deployable as-is via `supabase/migrations/001_initial_schema.sql`.
- **Blocker**: no automated backup/PITR configuration in-repo (this is normally a Supabase dashboard setting, not code, but there is no documented runbook for it, and free-tier Supabase projects do not include backups by default).
- No migration CI (nothing verifies new migrations apply cleanly before merge).

## ML (CV pipeline / edge)
- No deployment target — this is a script for restaurant-owned edge hardware (Pi/Jetson), not a cloud service. Nothing to deploy centrally today; see ML_AUDIT.md for why this should be postponed regardless.
- If/when built out, this would need either a lightweight fleet-management approach (per-site config + OTA updates) or, alternatively, cloud-based inference (Railway/similar with a GPU-less container, given the model is CPU-friendly).

## Storage (Supabase Storage)
- **Not used at all.** No bucket references, no file-upload-to-storage code anywhere. CSV uploads are parsed in-memory and never persisted as files (acceptable for now, but means there's no audit trail of the original uploaded file if a customer disputes an import).

## Background jobs
- **None exist.** No cron, no queue, no worker process. This matters for: (a) any future recommendation-generation job, (b) recurring aggregation/rollups, (c) trial-expiry/billing checks once billing exists. Supabase Edge Functions + `pg_cron`, or a small Vercel Cron Job hitting an API route, would be the lightest-weight fix.

## Monitoring
- **Sentry**: not integrated.
- **PostHog**: not integrated.
- **Logging**: routes only `console.error` on failure; no structured logging, no log aggregation.
- **Metrics/tracing**: none.
This means a production incident today would be invisible until a customer reports it. This is a launch blocker for a paid product, not a nice-to-have.

## Backups
- **DB backups**: dependent on Supabase plan tier, not configured/documented in-repo.
- **Storage backups**: N/A (no storage usage yet).

## Deployment blockers (ranked)
1. `next.config.mjs` `ignoreBuildErrors: true` masking real TypeScript errors.
2. No error tracking (Sentry) — cannot safely operate a paid product blind.
3. Mixed lockfiles risking inconsistent installs.
4. No CI (no `.github/workflows`) — nothing prevents a broken build/lint/typecheck from reaching `main`.
5. No backup/PITR runbook for the database that holds every paying customer's data.
