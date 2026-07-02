# MEZA — Launch Roadmap

## BLOCKERS
*Nothing works for a real user until these are fixed.*
- Server-side Supabase client has no session/JWT context (`lib/supabase.ts` singleton) — every protected API route always 401s or risks cross-request session confusion. **Fix first.**
- `[id]` dynamic routes (`restaurants/[id]`, `experiments/[id]`, `recommendations/[id]`) read `id` from query string instead of the route param; frontend calls them as path segments — single-resource operations are broken.
- `Queue` icon imported from `lucide-react` in `app/dashboard/page.tsx` / `app/occupancy/page.tsx` doesn't exist — build/runtime failure.
- `lib/api-client.ts` `getExperimentResults` references an undefined variable (`id` vs `experimentId`).
- `next.config.mjs` `typescript.ignoreBuildErrors: true` hides real type errors from the build.
- Mixed lockfiles (`package-lock.json` + stub `pnpm-lock.yaml`).

## MVP LAUNCH
*Minimum to hand this to one real paying/pilot restaurant.*
- All BLOCKERS resolved and `npm run build` genuinely green (no `ignoreBuildErrors` masking).
- CSV-upload UI page wired to the real `pos-orders` POST endpoint (currently backend-only).
- Password reset flow (Supabase `resetPasswordForEmail` + a reset page).
- Basic rate limiting on `auth/signup` and `auth/signin`.
- Error tracking (Sentry) wired into both client and API routes — you cannot safely run a paid product blind.
- Remove or clearly label the "Recommendations" panel until it's backed by at least a simple rule-based generator (don't ship an empty promise).
- One documented backup/PITR setting on the Supabase project.

## PRODUCTION V1
*Needed before public/self-serve launch.*
- Billing: Stripe Checkout + webhook handler, a `subscriptions` table, at least one plan-limit enforced (e.g. restaurants per account).
- Multi-role authorization (owner/manager/staff) with a restaurant-membership table, replacing the current single-owner-only model.
- Minimal rule-based recommendation engine over existing occupancy/revenue/environment data.
- Explicit input validation (zod) on all POST/PATCH bodies; allow-list updatable fields per route.
- CI pipeline: typecheck + lint + build on every PR; migration-apply check.
- Structured logging + basic product analytics (PostHog).
- CSV upload hardening: file size cap, row cap, batched inserts.
- Rebuild GST/tax export and daily-summary reporting against the new schema (existed in the old app, was lost in the migration and is specifically valuable for Indian restaurant operators).

## V2
*Should wait.*
- CV/camera-based occupancy pipeline — needs accuracy validation against real restaurant footage, model fine-tuning, and deployment/fleet tooling before it's trustworthy enough to sell.
- Experimentation ROI auto-computation (currently manual).
- Menu-mix / item-level analytics dashboards (data already captured via `pos_order_items`, just needs an aggregation layer).
- Labor/staffing analytics surfaced from `operational_snapshots` (table exists, unused).
- Zone/table-layout configuration UI.
- Learned (vs. rule-based) recommendation model, once enough usage data exists to train/validate one.
