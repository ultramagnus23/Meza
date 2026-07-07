"""
CV Pipeline for Anonymous Occupancy Detection (OPTIONAL hardware add-on)
Runs on edge device (Raspberry Pi / Jetson Nano), one process per camera.
Processes CCTV RTSP stream - outputs metadata only, no image storage.

MEZA works fully without this: occupancy data can also be logged from the
dashboard forms, and this script has a --simulate mode (below) that posts
realistic fake occupancy events without any camera, RTSP feed, or detector
model - useful for demos, dev, and testing the ingestion path end-to-end.

Nothing camera- or restaurant-specific is hardcoded here. All configuration
(RTSP URL, table ROI regions, queue region, snapshot interval) is fetched
from the `cameras` table in Supabase at startup, keyed by CAMERA_ID. This
lets one restaurant register any number of cameras from the MEZA dashboard
(/cameras) and point this same script at each of them by passing a
different CAMERA_ID - no code changes required per install.

Required environment variables:
  CAMERA_ID            - id of the row in the `cameras` table to run
  SUPABASE_URL          - e.g. https://your-project.supabase.co
  SUPABASE_SERVICE_KEY  - service role key (edge device only - never ship
                           this to a browser or commit it to source control)

Run (real camera, requires opencv-python + downloaded detector model):
  CAMERA_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    python occupancy_detector.py

Run (no hardware, no opencv required - posts synthetic snapshots):
  CAMERA_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    python occupancy_detector.py --simulate
"""

import argparse
import os
import random
import sys
import time
import json
from datetime import datetime

import requests


class ConfigError(RuntimeError):
    pass


def load_camera_config(supabase_url: str, service_key: str, camera_id: str) -> dict:
    """Fetch this camera's connection + ROI config from the `cameras` table."""
    resp = requests.get(
        f"{supabase_url}/rest/v1/cameras",
        params={"id": f"eq.{camera_id}", "select": "*"},
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        },
        timeout=10,
    )
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        raise ConfigError(f"No camera found with id={camera_id}")
    return rows[0]


def report_camera_status(supabase_url: str, service_key: str, camera_id: str, **fields):
    """Best-effort status/error reporting back to the cameras table (non-fatal on failure)."""
    try:
        requests.patch(
            f"{supabase_url}/rest/v1/cameras",
            params={"id": f"eq.{camera_id}"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            data=json.dumps(fields),
            timeout=10,
        )
    except Exception as e:
        print(f"[warn] failed to report camera status: {e}")


class OccupancyDetector:
    def __init__(self, config: dict, supabase_url: str, supabase_key: str, simulate: bool = False):
        self.config = config
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.simulate = simulate

        self.camera_id = config["id"]
        self.restaurant_id = config["restaurant_id"]
        self.rtsp_url = config["rtsp_url"]
        self.snapshot_interval = config.get("snapshot_interval_seconds") or 300
        self.table_regions = config.get("table_regions") or []
        self.queue_region = config.get("queue_region")

        if not self.table_regions:
            print("[warn] this camera has no table_regions configured - "
                  "occupancy_percentage will always be 0. Configure table "
                  "regions from the MEZA dashboard's Cameras page.")

        if self.simulate:
            # No camera, no RTSP connection, no detector model - just posts
            # realistic synthetic snapshots on the same interval/reporting
            # codepath a real camera would use.
            self.cap = None
            self.person_detector = None
        else:
            # Imported lazily so --simulate works on a machine with no
            # opencv-python installed at all (e.g. a laptop, not the Pi).
            import cv2
            self.cv2 = cv2
            self.cap = cv2.VideoCapture(self.rtsp_url)
            if not self.cap.isOpened():
                raise ValueError(f"Cannot open RTSP stream: {self.rtsp_url}")
            self.person_detector = self.load_detector()

    def load_detector(self):
        """Load person detection model: YOLOv8n (Ultralytics), CPU-friendly.

        Replaces the previous generic Caffe SSD face/person detector (see
        docs/ML_AUDIT.md for why) with a real, actively-maintained
        person-detection model. Still generic/pretrained on COCO, not
        fine-tuned on restaurant CCTV footage - see EVALUATION.md before
        trusting its numbers operationally.

        Looks for yolov8n.pt in this directory first (recommended for
        offline/edge installs - see README for the one-time download step).
        If not present, falls back to ultralytics' own auto-download, which
        requires internet access on first run.
        """
        try:
            from ultralytics import YOLO
        except ImportError as e:
            raise ConfigError(
                "ultralytics is not installed. Run: pip install ultralytics "
                "(see cv_pipeline/requirements.txt)."
            ) from e

        model_dir = os.path.dirname(os.path.abspath(__file__))
        local_weights = os.path.join(model_dir, "yolov8n.pt")
        model_source = local_weights if os.path.exists(local_weights) else "yolov8n.pt"
        try:
            return YOLO(model_source)
        except Exception as e:
            raise ConfigError(
                f"Failed to load YOLOv8 model ({model_source}): {e}. For an "
                "offline/edge install, download yolov8n.pt once (see "
                "cv_pipeline/README.md) and place it in this directory."
            ) from e

    def detect_people(self, frame):
        """Detect people in frame using YOLOv8 (COCO class 0 = person)."""
        results = self.person_detector.predict(frame, classes=[0], conf=0.5, verbose=False)

        people = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                people.append({
                    'x': (x1 + x2) / 2,
                    'y': (y1 + y2) / 2,
                    'confidence': float(box.conf[0]),
                })

        return people

    def generate_simulated_snapshot(self):
        """Fake occupancy shaped like a real lunch/dinner-rush restaurant day,
        used only in --simulate mode. No camera, no frame, no detector."""
        now = datetime.now()
        hour = now.hour + now.minute / 60
        is_weekend = now.weekday() >= 4  # Fri/Sat/Sun

        if hour >= 12 and hour <= 14:
            base = 78 if is_weekend else 62
        elif hour >= 19 and hour <= 22:
            base = 92 if is_weekend else 74
        elif 8 <= hour <= 11:
            base = 18
        elif 15 <= hour <= 18:
            base = 30
        else:
            base = 25

        occupancy_percentage = max(3, min(100, base + random.uniform(-10, 10)))
        total_tables = len(self.table_regions) or 12
        occupied_tables = round((occupancy_percentage / 100) * total_tables)
        occupied_tables = max(0, min(total_tables, occupied_tables))
        available_tables = total_tables - occupied_tables
        people_count = max(0, round(occupied_tables * random.uniform(1.8, 3.2)))
        queue_length = (
            random.randint(1, 9) if occupancy_percentage > 85
            else random.randint(0, 3) if occupancy_percentage > 70
            else 0
        )
        wait_time = queue_length * random.randint(2, 4)

        return {
            'restaurant_id': self.restaurant_id,
            'timestamp': now.isoformat(),
            'occupancy_percentage': round(occupancy_percentage, 2),
            'occupied_tables': occupied_tables,
            'available_tables': available_tables,
            'people_count': people_count,
            'queue_length': queue_length,
            'wait_time': wait_time,
            'total_tables': total_tables,
        }

    def detect_table_occupancy(self, people, frame):
        """Determine which tables are occupied, using this camera's configured regions"""
        h, w = frame.shape[:2]
        occupied_tables = 0
        total_tables = len(self.table_regions)

        for table in self.table_regions:
            x1 = int(table['x1'] * w)
            y1 = int(table['y1'] * h)
            x2 = int(table['x2'] * w)
            y2 = int(table['y2'] * h)

            table_occupied = any(
                x1 <= person['x'] <= x2 and y1 <= person['y'] <= y2
                for person in people
            )
            if table_occupied:
                occupied_tables += 1

        return occupied_tables, total_tables

    def detect_queue(self, people, frame):
        """Detect queue length near entrance, if this camera tracks a queue region"""
        if not self.queue_region:
            return 0

        h, w = frame.shape[:2]
        qx1 = int(self.queue_region['x1'] * w)
        qy1 = int(self.queue_region['y1'] * h)
        qx2 = int(self.queue_region['x2'] * w)
        qy2 = int(self.queue_region['y2'] * h)

        return sum(
            1 for person in people
            if qx1 <= person['x'] <= qx2 and qy1 <= person['y'] <= qy2
        )

    def capture_snapshot(self):
        """Capture and process a single frame (or a fake one, in --simulate mode)"""
        if self.simulate:
            return self.generate_simulated_snapshot()

        ret, frame = self.cap.read()
        if not ret:
            return None

        people = self.detect_people(frame)
        occupied_tables, total_tables = self.detect_table_occupancy(people, frame)
        available_tables = total_tables - occupied_tables
        queue_length = self.detect_queue(people, frame)

        occupancy_percentage = (occupied_tables / total_tables * 100) if total_tables > 0 else 0
        people_count = len(people)
        wait_time = max(0, queue_length * 3)  # ~3 min per person in queue, heuristic

        snapshot = {
            'restaurant_id': self.restaurant_id,
            'timestamp': datetime.now().isoformat(),
            'occupancy_percentage': round(occupancy_percentage, 2),
            'occupied_tables': occupied_tables,
            'available_tables': available_tables,
            'people_count': people_count,
            'queue_length': queue_length,
            'wait_time': wait_time,
            'total_tables': total_tables,
        }

        # IMPORTANT: Frame is discarded immediately after processing.
        # No image is stored or transmitted.
        del frame

        return snapshot

    def send_to_supabase(self, snapshot):
        """Send occupancy data to Supabase"""
        if not snapshot:
            return False

        try:
            response = requests.post(
                f"{self.supabase_url}/rest/v1/occupancy_snapshots",
                headers={
                    'apikey': self.supabase_key,
                    'Authorization': f'Bearer {self.supabase_key}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
                data=json.dumps(snapshot),
                timeout=10
            )

            if response.status_code in (200, 201):
                print(f"[{datetime.now()}] Snapshot sent: {snapshot['occupancy_percentage']}% occupancy, "
                      f"{snapshot['people_count']} people, queue: {snapshot['queue_length']}")
                report_camera_status(
                    self.supabase_url, self.supabase_key, self.camera_id,
                    status='active', last_snapshot_at=snapshot['timestamp'], last_error=None,
                )
                return True

            print(f"Failed to send snapshot: {response.status_code} - {response.text}")
            report_camera_status(
                self.supabase_url, self.supabase_key, self.camera_id,
                status='error', last_error=f"{response.status_code}: {response.text}"[:500],
            )
            return False
        except Exception as e:
            print(f"Error sending snapshot: {e}")
            report_camera_status(
                self.supabase_url, self.supabase_key, self.camera_id,
                status='error', last_error=str(e)[:500],
            )
            return False

    def run(self):
        """Main loop"""
        print("Starting occupancy detection pipeline..."
              + (" [SIMULATE MODE - no camera, synthetic data]" if self.simulate else ""))
        print(f"Camera: {self.config.get('name', self.camera_id)}")
        print(f"Restaurant: {self.restaurant_id}")
        if not self.simulate:
            print(f"RTSP stream: {self.rtsp_url}")
        print(f"Snapshot interval: {self.snapshot_interval}s")
        print(f"Tracking {len(self.table_regions)} table(s)"
              + (", plus queue region" if self.queue_region else ""))
        print("Privacy: frames processed in memory, never stored\n")

        snapshot_count = 0

        while True:
            try:
                snapshot = self.capture_snapshot()
                if snapshot:
                    if self.send_to_supabase(snapshot):
                        snapshot_count += 1

                time.sleep(self.snapshot_interval)

            except KeyboardInterrupt:
                print(f"\nStopped. Total snapshots: {snapshot_count}")
                break
            except Exception as e:
                print(f"Error: {e}")
                report_camera_status(
                    self.supabase_url, self.supabase_key, self.camera_id,
                    status='error', last_error=str(e)[:500],
                )
                time.sleep(10)  # Wait before retrying

        if self.cap is not None:
            self.cap.release()


def main():
    parser = argparse.ArgumentParser(description="MEZA occupancy CV pipeline")
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Post realistic fake occupancy snapshots instead of reading a camera - "
             "no RTSP stream, opencv, or detector model required. Useful for demos, "
             "dev, and exercising the ingestion path without a Pi.",
    )
    args = parser.parse_args()

    camera_id = os.environ.get("CAMERA_ID")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not camera_id or not supabase_url or not supabase_key:
        print(
            "Missing required environment variables. Set CAMERA_ID, "
            "SUPABASE_URL and SUPABASE_SERVICE_KEY (see this file's "
            "module docstring for details).",
            file=sys.stderr,
        )
        sys.exit(1)

    config = load_camera_config(supabase_url, supabase_key, camera_id)
    detector = OccupancyDetector(config, supabase_url, supabase_key, simulate=args.simulate)
    detector.run()


if __name__ == '__main__':
    main()
