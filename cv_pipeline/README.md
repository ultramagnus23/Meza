# MEZA Occupancy CV Pipeline

Runs on edge hardware (Raspberry Pi 4 / Jetson Nano) next to a restaurant's
existing CCTV system. Detects people in an RTSP stream, maps them onto
configured table/queue regions, and posts anonymous occupancy metadata to
Supabase. **No image is ever stored or transmitted** — each frame is
discarded immediately after processing.

## Why this is modular per restaurant / per camera

Nothing camera-specific lives in this Python file. A restaurant registers
its cameras (RTSP URL, table regions, queue region) from the MEZA dashboard
at `/cameras`, which writes to the `cameras` table (see
`supabase/migrations/002_cameras.sql`). This script reads that
configuration at startup by `CAMERA_ID` and re-fetches nothing camera- or
restaurant-specific from anywhere else — so the same script, unmodified,
runs any camera at any restaurant. To add a new camera, add a row from the
dashboard and start a new process with that camera's id; to change table
layout, edit the regions on the dashboard and restart the process.

## One-time setup

1. Register the camera and its table regions in the MEZA dashboard
   (`/cameras`) — note the camera's id shown there.
2. Download the person-detector model files into this directory (not
   bundled in the repo):
   - `deploy.prototxt`
   - `res10_300x300_ssd_iter_140000.caffemodel`
   (Available from any standard OpenCV face/person SSD model mirror.)
3. Install dependencies: `pip install -r requirements.txt`

## Running

```bash
CAMERA_ID=<camera id from the dashboard> \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_KEY=<service role key> \
python occupancy_detector.py
```

Run one process per camera. `SUPABASE_SERVICE_KEY` is a privileged
credential — keep it on the edge device only, never in a browser bundle or
committed to source control (it bypasses Row Level Security by design so
the pipeline can write on behalf of any restaurant it's configured for).

## Multiple restaurants / multiple cameras

Each restaurant's owner manages their own cameras from their own MEZA
account (RLS-isolated). Each edge device only needs the `CAMERA_ID`(s) for
the cameras physically at that site — there is no cross-restaurant
configuration to manage centrally beyond issuing/rotating the service key.

## Accuracy note

The bundled detector is a generic pretrained face/person SSD model, not
fine-tuned for restaurant CCTV angles. Validate occupancy accuracy against
a pilot site before relying on these numbers operationally — see
`docs/ML_AUDIT.md` in the main repo for the full assessment and
recommended next steps (fine-tuning, evaluation harness) before wider
rollout.
