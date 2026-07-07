# MEZA — Machine Learning Audit

## Inventory

Two ML/heuristic components now exist: `cv_pipeline/occupancy_detector.py`
(CV) and the V1 rules-based recommendation engine
(`lib/recommendation-engine.ts` + `app/api/cron/recommendations`). Neither
is a trained/learned model in the ML sense — the CV detector uses an
off-the-shelf pretrained YOLOv8n, and the recommendation engine is
deterministic correlation + threshold rules, per this doc's own prior
recommendation to build that version first.

### 1. Occupancy Detector (`cv_pipeline/occupancy_detector.py`)

- **What it is**: A person-detection + ROI-heuristic pipeline meant to run on edge hardware (Raspberry Pi/Jetson) against an RTSP CCTV stream.
- **Model**: Ultralytics YOLOv8n (`yolov8n.pt`), CPU-friendly. Swapped from
  the previous Caffe SSD face/person detector (see prior audit) - still a
  generic, off-the-shelf pretrained detector, **not** trained or
  fine-tuned on restaurant-specific data. This is a real, actively
  maintained model family (unlike the old SSD, which had aged out), but
  the fine-tuning gap this doc originally flagged is unchanged.
- **INPUTS**: Live RTSP video frames, hardcoded-per-camera percentage-based table/queue ROI coordinates (from the `cameras` table).
- **OUTPUTS**: `occupancy_percentage`, `occupied_tables`, `available_tables`, `people_count`, `queue_length`, `wait_time` (heuristic: 3 min/queued person), posted directly to the Supabase REST API as an `occupancy_snapshots` row.
- **ACCURACY**: Still unmeasured — no ground-truth comparison, no evaluation script, no accuracy metric reported anywhere in the repo. `cv_pipeline/EVALUATION.md` (new) documents exactly how to validate this against a pilot site's labeled footage and explicitly states no evaluation has been run - it does not invent a number. A generic detector for overhead/wide-angle CCTV table occupancy is still likely to have meaningfully degraded accuracy versus a model actually trained for this camera angle/use case.
- **COST**: Runs on commodity edge hardware (Pi 4 class per README's ₹10,000 budget) — CPU-only YOLOv8n inference is cheap, no cloud GPU cost, no per-inference API cost.
- **LATENCY**: Not benchmarked, but architecture (per-camera snapshot interval, default 300s) implies it's designed for near-real-time-enough occupancy tracking, not low-latency use.
- **DEPLOYMENT STRATEGY**: Now has real plumbing: `cv_pipeline/Dockerfile` (bakes in `yolov8n.pt` at build time for offline operation) and `cv_pipeline/meza-occupancy-detector@.service` (systemd template unit, one instance per camera). Camera health is reported back to `cameras.last_snapshot_at`/`last_error`/`status` on every cycle (`report_camera_status()`, unchanged from prior pass - this was already wired, just verified still intact through the detector swap). Still no OTA update path or fleet management dashboard beyond what `/cameras` already provides.
- **Training pipeline**: None. No training script, no dataset, no labeling tooling, no fine-tuning path even though a restaurant-specific fine-tune would likely materially improve table-occupancy accuracy over a generic person detector.
- **Evaluation**: Harness still not implemented (no labeled pilot data exists yet to build it against) - but the gap and the exact steps to close it are now documented in `cv_pipeline/EVALUATION.md` instead of being unmentioned.
- **Monitoring**: Camera-level status/error reporting exists (`cameras.last_error`/`last_snapshot_at`/`status`, via `report_camera_status()`). No alerting/metrics export beyond that table, no drift monitoring once deployed.

**Recommendation: still POSTPONE for accuracy-trust purposes, but deployment blockers are cleared.** MVP value (see BUSINESS_VALUE_AUDIT.md) can still be delivered from POS CSV data and manually-entered/sensor-based occupancy alone. The detector, Docker image, and systemd unit are now real and deployable, so a pilot install is mechanically possible - but do not present its `occupancy_snapshots` output as a validated accuracy metric to a customer until `cv_pipeline/EVALUATION.md`'s steps have actually been run against that site's own labeled footage.

### 2. Recommendation engine (`lib/recommendation-engine.ts`, `app/api/cron/recommendations`)

**Built, per this doc's prior recommendation.** A deterministic V1, not a
learned model:

- **What it is**: Pulls the last 30 days of `occupancy_snapshots`,
  `environment_snapshots`, `table_sessions`, and `pos_order_items` per
  restaurant, computes Pearson correlations (`lib/correlation.ts`) between
  environment variables and outcome variables (matching what
  `CorrelationScatter.tsx` visualizes), and applies 6 threshold rules
  (temperature↔dessert attach, sound level↔dwell time, occupancy↔queue,
  music volume↔drink orders, lux↔dwell time, CO2↔dwell time) - each rule
  is its own function with a docstring stating its hypothesis and evidence
  threshold (`|r| >= 0.3`, `n >= 12`, Fisher-z confidence `>= 0.8`).
- **Confidence**: Derived from a real Fisher z-transformation
  two-tailed significance test over the actual matched sample - not a
  fabricated or hardcoded number.
- **Expected revenue impact**: Only populated when derivable from real
  average dessert/drink item prices for that restaurant (via
  `pos_order_items`); left `null` otherwise (e.g. the occupancy/queue rule
  never sets it, since a walk-in-to-order conversion rate isn't in the
  data).
- **Scheduling**: Vercel Cron (`vercel.json`, daily), calling
  `app/api/cron/recommendations` with the service-role Supabase client
  (`getServiceSupabase()` in `lib/supabase.ts`) since a scheduled job has
  no restaurant-owner session to forward.
- **Dedup**: Each rule carries a stable `rule_key`
  (`supabase/migrations/005_recommendation_rule_key.sql`) so the cron job
  doesn't re-insert the same finding on every run within a 7-day window.
- **Verified**: Logic-tested against known-correlated synthetic in-memory
  data (all 3 expected rules fired with correct math); route-tested live
  against the production DB (ran cleanly across all restaurants, correctly
  withheld the occupancy/queue recommendation on real seeded demo data
  because the actual queue magnitude didn't clear the evidence bar).
- **Not done**: No learned/trained model, by design - this is intentionally the "build the deterministic version first" step this doc originally called for, not a final state.

## Summary table

| Model | Status | Decision |
|---|---|---|
| CV occupancy detector | Real code (YOLOv8n), real deployment plumbing (Docker/systemd), still accuracy-unvalidated | Deployable to a pilot; validate accuracy (`cv_pipeline/EVALUATION.md`) before presenting numbers as trustworthy analytics |
| Recommendation engine | Built - deterministic Pearson-correlation + threshold-rule V1, scheduled via Vercel Cron | Ship it; revisit a learned model only after this V1 has run against real restaurant data for a while |
