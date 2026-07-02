# MEZA — Production Audit

Scope: current on-disk state of the repo (the working tree reflects an in-progress migration off the old Prisma/SQLite "RestaurantApp" onto a Supabase-based multi-tenant product called MEZA / "Experience Intelligence Platform"). Old files are `git rm`'d on disk; new Supabase-era files are untracked. This audit evaluates disk state, not git history.

## Architecture

**Current architecture**
- Next.js 14 App Router monolith, deployed as a single app (frontend + `/api` route handlers).
- Supabase Postgres as the only datastore, with RLS policies scoping every table to `restaurants.owner_id = auth.uid()`.
- Supabase Auth (email/password) for identity.
- Zustand for client state (`lib/store.ts`), persisted to localStorage (selected restaurant).
- A standalone Python CV script (`cv_pipeline/occupancy_detector.py`) intended to run on edge hardware (Raspberry Pi/Jetson) and push occupancy snapshots directly to Supabase's REST API.
- No queue/worker system, no cron, no background jobs, no email service, no billing integration.

**Target architecture** (implied by the 10-phase brief: a real multi-tenant SaaS)
- Next.js app on Vercel, server-side Supabase client using per-request auth (cookies or bearer tokens), not a shared singleton.
- Supabase Postgres with RLS (schema already close to this — see Database section).
- Background job runner (Supabase Edge Functions, cron, or a small worker service) for recurring aggregation, recommendation generation, and alerting.
- Billing (Stripe) with plan gating.
- Observability: error tracking (Sentry), product analytics (PostHog), structured logs.
- CI pipeline running typecheck/lint/build on every PR.

**Missing components**
- Working server-side auth context (see Security/SaaS audits — this is the #1 blocker).
- Any recommendation-generation logic (the `recommendations` table is pure CRUD; nothing writes AI-generated rows to it).
- Billing/subscriptions of any kind.
- Background jobs / schedulers.
- Monitoring, logging, error tracking.
- CI configuration (no `.github/workflows`).
- Multi-role authorization (owner/manager/analyst/staff) — only a single implicit "owner" role exists.
- `operational_snapshots` has a DB table and TypeScript types but no API route or UI ever reads/writes it.

## Frontend

**Completed**
- Auth pages (`app/signin`, `app/signup`) using real Supabase Auth via `components/auth-provider.tsx`.
- `app/dashboard`, `app/occupancy`, `app/environment`, `app/experiments`, `app/recommendations`, `app/create-restaurant` — all wired to real `/api/*` routes via `lib/api-client.ts`, with empty-state handling (no hardcoded fake data).
- Chart components (`RevenueChart`, `OccupancyChart`, `CorrelationScatter`) are real Recharts components driven by props, not mocked data.

**Incomplete**
- No settings/billing page, no team/role management UI, no CSV-upload UI page for POS import (the backend route `app/api/pos-orders` (POST, multipart) exists but no page calls it), no page for `operational_snapshots`.
- No error boundaries; a failed fetch just logs to console (`dashboard/page.tsx:81`) and leaves the UI in a stuck loading/empty state.

**Broken**
- `app/dashboard/page.tsx:20` and `app/occupancy/page.tsx` import `Queue` from `lucide-react` — this icon does not exist in the package. This is a hard build/runtime failure.
- `lib/api-client.ts:87` `getExperimentResults` references an undefined variable `id` instead of `experimentId` — throws if ever called.
- Several `api-client.ts` methods target routes that don't exist (`/occupancy/bulk`, `/environment/bulk`, `/operational`, `/pos-orders/upload`, `/revenue/by-day`, `/revenue/by-hour`, `/revenue/by-day-of-week`, `/experiment-results`) — the real revenue route uses a single `?endpoint=` query param design instead.

**Mock implementations / placeholders**
- None found in the current page/component set — the old mock-heavy RestaurantApp components (`BostonMatrix`, `DesiDashboard`, `PriceSimulator`, `TheftAlerts`, etc.) have been deleted from disk, not just hidden.

**Placeholder/dead components**
- `components/Badge.tsx`, `components/Card.tsx` — exact duplicates of `components/ui/badge.tsx` / `card.tsx`, unused anywhere. Dead code.
- `components/CorrelationScatter.tsx` — real, functional, but currently has zero importers (orphaned from a deleted analytics page).

## Backend

**Completed** — CRUD routes for `restaurants`, `occupancy`, `environment`, `experiments`, `recommendations`, `table-sessions`, `pos-orders` (incl. CSV bulk import), `revenue` (day/summary/hour via query param), `dashboard` (aggregate), `auth` (signup/signin/signout/session). All query real Supabase tables with column names matching the migration 1:1.

**Incomplete**
- No `operational` route despite the table + types existing.
- No route ever writes to `recommendations` except manual POST — there is no generator.
- No pagination on list endpoints; no rate limiting on any route including `auth/signup` (open to abuse).

**Broken**
- **Every route is effectively broken for real users.** `lib/supabase.ts` creates one module-level `createClient(anonKey)` with no cookie/session wiring (`@supabase/ssr` is not installed, no `Authorization` header is ever read). `supabase.auth.getUser()` in every handler therefore has no session to inspect. In practice this means real requests either 401 permanently, or — worse — in a warm serverless instance the singleton's in-memory auth state can bleed across concurrent requests for different users. This single bug makes the entire API surface non-functional end-to-end today. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md).
- `app/api/occupancy/route.ts:31` — the `hour` filter does an exact `eq('timestamp', ...)` match against a truncated string; this can never match a real timestamp row. Dead filter.
- `app/api/revenue/route.ts` — none of the four query branches check `error`; a Supabase error yields `orders === null` and an unguarded `.reduce()`/`.length` throws, producing a confusing 500.
- `app/api/restaurants/[id]/route.ts`, `app/api/experiments/[id]/route.ts`, `app/api/recommendations/[id]/route.ts` — these are Next.js dynamic-segment routes (`[id]`), but the handlers read the id via `searchParams.get('id')` (a query string param) instead of the route's `context.params.id`. Meanwhile `lib/api-client.ts` calls them as path segments (`/restaurants/${id}`). Result: `id` is always `undefined` server-side for every real call the frontend makes — every single-resource GET/PATCH/DELETE is broken, independent of the auth bug.

**Mocked APIs** — none; all routes hit real Supabase.

**Missing APIs** — `operational`, any recommendation-generation endpoint, any billing/webhook endpoint, any bulk endpoints the frontend already calls (`occupancy/bulk`, `environment/bulk`).

## Database

**Schema quality** — Good. `supabase/migrations/001_initial_schema.sql` is a single well-normalized migration: `restaurants` (tenant root) → `occupancy_snapshots`, `table_sessions`, `environment_snapshots`, `operational_snapshots`, `experiments` → `experiment_results`, `recommendations`, `pos_orders` → `pos_order_items`. All child tables carry `restaurant_id` (or transitively via a parent FK) for tenant scoping.

**Indexes** — Present and sensible: composite `(restaurant_id, timestamp desc)` indexes on every time-series table, plus lookup indexes on owner/table-number/external-id.

**Constraints** — Foreign keys with `on delete cascade` throughout; `not null` on required fields. No `check` constraints (e.g. nothing prevents negative `total_amount` or an `occupancy_percentage` outside 0–100) — minor, low-risk gap.

**RLS** — Enabled on every table, with `owner_id = auth.uid()` (direct or via subquery chain) policies for select/insert/update. **However, this protection is currently dead in practice**: since the server-side Supabase client never forwards the caller's JWT (see Backend/Security), `auth.uid()` evaluates to `null` for every request made through the Next.js API, so RLS silently returns empty results rather than actually gatekeeping a live user session. Once auth wiring is fixed, RLS becomes effective and is well-designed.

**Migrations** — Only one migration file exists; no migration tooling/versioning workflow documented (no `supabase migration list`/CI check). Fine for pre-launch, but there's no rollback story.

**Backup strategy** — None documented or automated. Supabase's paid tiers include daily backups by default, but nothing in-repo configures PITR, backup verification, or a restore runbook.

## ML

See [ML_AUDIT.md](ML_AUDIT.md) for full detail. Summary: `cv_pipeline/occupancy_detector.py` is a real (not fake) heuristic computer-vision script using a generic pretrained Caffe SSD face/person detector plus manual ROI-based table-region heuristics — not restaurant-specific, no training pipeline, no evaluation harness, and it requires model files (`deploy.prototxt`, `res10_300x300_ssd_iter_140000.caffemodel`) that are not present in the repo, so it cannot run as-is. There is no server-side ML/inference of any kind — "recommendations" are a static CRUD table with no generation logic behind them despite being marketed as a feature.

## Security

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for full detail. Headline issues: broken server-side auth context (critical), no rate limiting anywhere (including signup/signin — brute-force and signup-spam risk), no CSRF concern for JSON APIs but no origin checks either, no input size limits on CSV upload, `next.config.mjs` sets `typescript.ignoreBuildErrors: true` which will silently ship type errors (including the confirmed `api-client.ts` ReferenceError) to production.

## Deployment

See [DEPLOYMENT_AUDIT.md](DEPLOYMENT_AUDIT.md). Headline blockers: no CI, no monitoring/error-tracking, no backup automation, mixed lockfiles (`package-lock.json` + a stub, non-functional `pnpm-lock.yaml`), no `middleware.ts` for edge-level session refresh, no deployment config for the CV pipeline (it's a standalone script with hardcoded placeholder credentials meant to be edited per-install, not a deployable service).
