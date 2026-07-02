# MEZA — Fake Implementation Audit

Full repo grep for `Math.random`, `TODO`, `FIXME`, `mock`, `stub`, `placeholder`, `fake`, `hardcoded`, "not implemented" found **zero fabricated-data red flags** in application code — the only `placeholder` hits are HTML input attributes. This is a genuinely better starting point than most pre-launch codebases. The problems here are architectural (auth wiring) and missing-feature (no recommendation engine), not fake data.

## REAL
- Supabase Auth (signup/signin/session/signout) — `app/api/auth/**`, `components/auth-provider.tsx`. Real `supabase.auth.*` calls.
- All CRUD API routes (`restaurants`, `occupancy`, `environment`, `experiments`, `table-sessions`, `pos-orders`, `revenue`, `dashboard`) — genuine Supabase queries against the real schema, no mocked responses.
- CSV bulk import (`app/api/pos-orders POST`) — real `papaparse` parsing and real inserts.
- Charts (`RevenueChart`, `OccupancyChart`, `CorrelationScatter`) — driven entirely by fetched data, real empty states, no baked-in sample data.
- Database schema and RLS policies — real, tenant-scoped, indexed.
- CV pipeline heuristics (person detection via Caffe SSD, ROI-based table/queue detection) — real logic, not `Math.random()` fabrication.

## FAKE
- None identified in current disk-state code. (The old RestaurantApp had fabricated analytics — `lib/analytics.ts`, `components/BostonMatrix.tsx`, `components/TheftAlerts.tsx`, etc. — but those files are already deleted from disk, not merely hidden.)

## PARTIAL
- **"Recommendations" feature** — real CRUD table + API + UI list, but **no generation logic exists anywhere in the repo**. Nothing computes a recommendation from occupancy/revenue/environment data; the table can only be populated by a manual `POST`. Marketed in the README as "data-driven suggestions" but there is no data-driven process behind it today. Classify as PARTIAL: infrastructure real, intelligence missing.
- **CV occupancy pipeline** — real code, but non-functional out of the box: requires external Caffe model files not included in the repo (`deploy.prototxt`, `res10_300x300_ssd_iter_140000.caffemodel`), uses a generic pretrained face/person detector rather than a restaurant-tuned model, and is a standalone script with no deployment/orchestration story (no systemd unit, no Docker image, no retry/health reporting beyond a bare `while True` loop).
- **`operational_snapshots`** — real table + TypeScript types, but no API route and no UI ever reads or writes it. Fully unimplemented feature, not fake data.

## BROKEN
- **Server-side auth context** (`lib/supabase.ts` singleton, no `@supabase/ssr`/cookie/bearer wiring) — every protected API route's `supabase.auth.getUser()` has no session to read, so all routes 401 for real users today. This isn't "fake," it's non-functional plumbing. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md).
- `app/dashboard/page.tsx` and `app/occupancy/page.tsx` import a nonexistent `Queue` icon from `lucide-react` — compile/runtime failure.
- `lib/api-client.ts:87` — `getExperimentResults` references an undefined `id` variable.
- Multiple `lib/api-client.ts` methods target routes that don't exist (`/occupancy/bulk`, `/environment/bulk`, `/operational`, `/pos-orders/upload`, `/revenue/by-day`, `/revenue/by-hour`, `/revenue/by-day-of-week`, `/experiment-results`).
- `app/api/occupancy/route.ts` `hour` query filter is a dead code path (impossible exact-timestamp match).
- `restaurants/[id]`, `experiments/[id]`, `recommendations/[id]` routes read `id` from `searchParams` instead of the dynamic route param, while the frontend calls them as `/resource/${id}` path segments — `id` is always `undefined` server-side.
- `app/api/revenue/route.ts` — unguarded null dereference if a Supabase query errors.

## Disabled features
- None found disabled via feature flag — the missing surfaces (billing, roles, operational analytics, recommendation generation) were simply never built, not built-and-disabled.
