# MEZA — Machine Learning Audit

## Inventory

There is exactly **one** ML/CV component in the repo: `cv_pipeline/occupancy_detector.py`. There is no server-side ML, no model-serving endpoint, and no recommendation model — the `recommendations` table is populated only by manual API calls, with zero inference code anywhere.

### 1. Occupancy Detector (`cv_pipeline/occupancy_detector.py`)

- **What it is**: A person-detection + ROI-heuristic pipeline meant to run on edge hardware (Raspberry Pi/Jetson) against an RTSP CCTV stream.
- **Model**: OpenCV DNN module loading a Caffe SSD face/person detector (`res10_300x300_ssd_iter_140000.caffemodel` + `deploy.prototxt`). This is a generic, off-the-shelf pretrained detector — not trained or fine-tuned on restaurant-specific data.
- **INPUTS**: Live RTSP video frames (1 fps), hardcoded percentage-based table/queue ROI coordinates.
- **OUTPUTS**: `occupancy_percentage`, `occupied_tables`, `available_tables`, `people_count`, `queue_length`, `wait_time` (heuristic: 3 min/queued person), posted directly to the Supabase REST API as an `occupancy_snapshots` row.
- **ACCURACY**: Unmeasured — no ground-truth comparison, no evaluation script, no accuracy metric reported anywhere in the repo. A generic face-detector-based approach for overhead/wide-angle CCTV table occupancy is likely to have meaningfully degraded accuracy versus a model actually trained for this camera angle/use case; this needs pilot-site validation before being sold as a metric customers can trust.
- **COST**: Runs on commodity edge hardware (Pi 4 class per README's ₹10,000 budget) — CPU-only Caffe DNN inference is cheap, no cloud GPU cost, no per-inference API cost.
- **LATENCY**: Not benchmarked, but architecture (1 fps, 5-minute snapshot interval) implies it's designed for near-real-time-enough occupancy tracking, not low-latency use.
- **DEPLOYMENT STRATEGY**: None currently — it's a bare Python script with placeholder config (`RTSP_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `RESTAURANT_ID` all literal placeholder strings meant to be hand-edited per install). No containerization, no systemd service, no auto-restart/health-check, no OTA update path, no fleet management for multiple restaurant deployments. Also missing the actual model weight files from the repo — cannot run until an operator downloads them separately.
- **Training pipeline**: None. No training script, no dataset, no labeling tooling, no fine-tuning path even though a restaurant-specific fine-tune would likely materially improve table-occupancy accuracy over a generic person detector.
- **Evaluation**: None. No test set, no precision/recall reporting, no drift monitoring once deployed.
- **Monitoring**: None. The run loop prints to stdout and retries after a bare 10s sleep on error — no alerting, no metrics export, no dead-camera detection beyond a console log.

**Recommendation: POSTPONE.** This is legitimate engineering, not vaporware, but it is not launch-critical: MVP value (see BUSINESS_VALUE_AUDIT.md) can be delivered from POS CSV data and manually-entered occupancy alone. Shipping this to a real pilot customer today risks presenting unvalidated occupancy numbers as trustworthy analytics. Before re-prioritizing it: (1) source or fine-tune a detector actually validated against restaurant CCTV footage, (2) build a minimal evaluation harness against labeled pilot footage, (3) containerize + add health monitoring before asking any real restaurant to install it on hardware.

### 2. "Recommendations" (`recommendations` table + API)

Not actually an ML or heuristic model — it's a plain data table with no writer. There is no code anywhere that reads occupancy/revenue/environment data and derives a recommendation. Despite being one of the five headline features in the README, this component **does not exist** as anything beyond a place to manually store a recommendation string if one were externally computed.

**Recommendation: KEEP the schema/API, but treat the actual "engine" as unbuilt (POSTPONE/build for V1).** A first version does not need to be ML at all — a small set of deterministic rules over existing `occupancy_snapshots`/`pos_orders`/`environment_snapshots` data (e.g. threshold-based staffing/queue alerts) would deliver real value cheaply and honestly, without requiring a training pipeline, before any investment in a learned model is justified.

## Summary table

| Model | Status | Decision |
|---|---|---|
| CV occupancy detector | Real code, unvalidated accuracy, not deployable as-is | POSTPONE — validate accuracy and add deployment tooling before promoting to customers |
| Recommendation engine | Does not exist | Build a minimal rule-based version for V1; do not market "AI recommendations" until something generates rows |
