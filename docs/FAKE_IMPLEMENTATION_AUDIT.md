# MEZA — Fake Implementation Audit

Full repo grep for `Math.random`, `TODO`, `FIXME`, `mock`, `stub`, `placeholder`, `fake`, `hardcoded`, "not implemented" found **zero fabricated-data red flags** in application code — the only `placeholder` hits are HTML input attributes. This is a genuinely better starting point than most pre-launch codebases. The problems here are architectural (auth wiring) and missing-feature (no recommendation engine), not fake data.

## REAL
- Supabase Auth (signup/signin/session/signout) — `app/api/auth/**`, `components/auth-provider.tsx`. Real `supabase.auth.*` calls.
- All CRUD API routes (`restaurants`, `occupancy`, `environment`, `experiments`, `table-sessions`, `pos-orders`, `revenue`, `dashboard`) — genuine Supabase queries against the real schema, no mocked responses.
- CSV bulk import (`app/api/pos-orders POST`) — real `papaparse` parsing and real inserts.
- Charts (`RevenueChart`, `OccupancyChart`, `CorrelationScatter`) — driven entirely by fetched data, real empty states, no baked-in sample data.
- Database schema and RLS policies — real, tenant-scoped, indexed. Now includes automated-capture provenance: `environment_snapshots.source` (`manual`/`sensor`/`weather_api`, see `supabase/migrations/004_sensor_fields.sql`) so manual vs. automated data is always distinguishable.
- CV pipeline heuristics (person detection via YOLOv8n, ROI-based table/queue detection) — real logic, not `Math.random()` fabrication. Detector itself swapped from a generic Caffe face/person SSD to Ultralytics YOLOv8n (see ML_AUDIT.md) - still not restaurant-tuned, still needs pilot-site validation (`cv_pipeline/EVALUATION.md`), but now has real deployment plumbing (`cv_pipeline/Dockerfile`, `cv_pipeline/meza-occupancy-detector@.service`).
- **`edge_sensors/collector.py` + `edge_sensors/weather_fetch.py`** — real ingestion scripts posting `environment_snapshots` rows with `source='sensor'`/`source='weather_api'` respectively. `collector.py`'s per-sensor hardware read logic (I2C/UART wiring) is intentionally left as a documented `NotImplementedError` stub per sensor (wiring/addressing varies by board) - `--mock` mode is real, fully-functional, and clearly labeled, not silently degrading to fake data.
- **V1 recommendation engine** (`lib/recommendation-engine.ts`, `lib/correlation.ts`, `app/api/cron/recommendations`) — real Pearson-correlation + threshold-rule engine, writes real `recommendations` rows with `rule_key`, non-fabricated `confidence` (Fisher z-transformation over the actual sample), and `expected_revenue_impact` only when derivable from real average item prices (otherwise left `null`). Scheduled via Vercel Cron (`vercel.json`).
- **Experiment templates** (`scripts/seed-experiment-templates.mjs`) — real, falsifiable hypothesis/control/test rows, inserted with `status='planned'` (not auto-run).

## FAKE
- None identified in current disk-state code. (The old RestaurantApp had fabricated analytics — `lib/analytics.ts`, `components/BostonMatrix.tsx`, `components/TheftAlerts.tsx`, etc. — but those files are already deleted from disk, not merely hidden.)

## PARTIAL
- **CV occupancy pipeline** — real code, real deployment plumbing (Dockerfile, systemd unit) as of this pass, but still **accuracy-unvalidated**: YOLOv8n is a generic COCO-pretrained detector, not fine-tuned on restaurant CCTV footage, and no evaluation harness has been run against labeled pilot footage yet (`cv_pipeline/EVALUATION.md` documents the gap explicitly rather than fabricating a number). Model weights (`yolov8n.pt`) are still not bundled in the repo (baked into the Docker image at build time instead, or auto-downloaded on first run for non-Docker installs).
- **`operational_snapshots`** — real table + TypeScript types, but no API route and no UI ever reads or writes it. Fully unimplemented feature, not fake data.
- **`edge_sensors/collector.py` real hardware adapters** — the five sensor adapter classes (`TempHumiditySensor`, `CO2Sensor`, `PM25Sensor`, `LuxSensor`, `SoundLevelSensor`) are real interfaces with a working collection loop and posting path, but each raises `NotImplementedError` for the actual I2C/UART register read - a per-install hardware bring-up task, not fake data (the collector posts `null` for any unread sensor rather than a fabricated number).

## BROKEN
- ~~Server-side auth context~~ — **stale, already fixed**: `lib/api-client.ts`'s `fetchAPI()` forwards the browser session's bearer token, and `getServerSupabase()` (`lib/supabase.ts`) creates a per-request client with that `Authorization` header, so `auth.getUser()`/RLS resolve correctly. Verified live in this pass (signup → create restaurant → authenticated POST/GET round-trip all succeeded against the real Supabase project). See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for whether that doc still reflects this.
- `app/dashboard/page.tsx` and `app/occupancy/page.tsx` import a nonexistent `Queue` icon from `lucide-react` — compile/runtime failure.
- `lib/api-client.ts:87` — `getExperimentResults` references an undefined `id` variable.
- Multiple `lib/api-client.ts` methods target routes that don't exist (`/occupancy/bulk`, `/environment/bulk`, `/operational`, `/pos-orders/upload`, `/revenue/by-day`, `/revenue/by-hour`, `/revenue/by-day-of-week`, `/experiment-results`).
- `app/api/occupancy/route.ts` `hour` query filter is a dead code path (impossible exact-timestamp match).
- `restaurants/[id]`, `experiments/[id]`, `recommendations/[id]` routes read `id` from `searchParams` instead of the dynamic route param, while the frontend calls them as `/resource/${id}` path segments — `id` is always `undefined` server-side.
- `app/api/revenue/route.ts` — unguarded null dereference if a Supabase query errors.

## Disabled features
- None found disabled via feature flag — the missing surfaces (billing, roles, operational analytics) were simply never built, not built-and-disabled. Recommendation generation is no longer in this list — see REAL, above.
