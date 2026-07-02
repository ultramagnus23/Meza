"""
CV Pipeline for Anonymous Occupancy Detection
Runs on edge device (Raspberry Pi / Jetson Nano), one process per camera.
Processes CCTV RTSP stream - outputs metadata only, no image storage.

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

Run:
  CAMERA_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    python occupancy_detector.py
"""

import os
import sys
import time
import json
from datetime import datetime

import cv2
import numpy as np
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
    def __init__(self, config: dict, supabase_url: str, supabase_key: str):
        self.config = config
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key

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

        self.cap = cv2.VideoCapture(self.rtsp_url)
        if not self.cap.isOpened():
            raise ValueError(f"Cannot open RTSP stream: {self.rtsp_url}")

        self.person_detector = self.load_detector()

    def load_detector(self):
        """Load person detection model (OpenCV DNN, CPU-friendly).

        Requires deploy.prototxt + res10_300x300_ssd_iter_140000.caffemodel
        in this directory - download separately, not bundled in-repo. See
        cv_pipeline README for the download step.
        """
        model_dir = os.path.dirname(os.path.abspath(__file__))
        prototxt = os.path.join(model_dir, "deploy.prototxt")
        weights = os.path.join(model_dir, "res10_300x300_ssd_iter_140000.caffemodel")
        if not (os.path.exists(prototxt) and os.path.exists(weights)):
            raise ConfigError(
                "Missing detector model files. Download deploy.prototxt and "
                "res10_300x300_ssd_iter_140000.caffemodel into cv_pipeline/ "
                "before running - see cv_pipeline/README.md."
            )
        return cv2.dnn.readNetFromCaffe(prototxt, weights)

    def detect_people(self, frame):
        """Detect people in frame using OpenCV DNN"""
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)),
            1.0,
            (300, 300),
            (104.0, 177.0, 123.0)
        )
        self.person_detector.setInput(blob)
        detections = self.person_detector.forward()

        people = []
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > 0.5:  # Confidence threshold
                box = detections[0, 0, i, 3:7] * np.array(frame.shape[1::-1])
                x1, y1, x2, y2 = box.astype(int)
                people.append({
                    'x': (x1 + x2) // 2,
                    'y': (y1 + y2) // 2,
                    'confidence': float(confidence)
                })

        return people

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
        """Capture and process a single frame"""
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
        print("Starting occupancy detection pipeline...")
        print(f"Camera: {self.config.get('name', self.camera_id)}")
        print(f"Restaurant: {self.restaurant_id}")
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

        self.cap.release()


def main():
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
    detector = OccupancyDetector(config, supabase_url, supabase_key)
    detector.run()


if __name__ == '__main__':
    main()
