"""
CV Pipeline for Anonymous Occupancy Detection (OPTIONAL hardware add-on)
Runs on edge device (Raspberry Pi / Jetson Nano), one process per camera.
Processes CCTV RTSP stream - outputs metadata only, no image storage.

MEZA works fully without this: occupancy data can also be logged from the
dashboard forms, and this script has a --simulate mode (below) that posts
realistic fake occupancy events without any camera, RTSP feed, or detector
model - useful for demos, dev, and testing the ingestion path end-to-end.

Nothing camera- or restaurant-specific is hardcoded here. All configuration
(RTSP URL, table ROI regions, queue region, zone polygons, snapshot
interval) is fetched from the `cameras`/`zones` tables in Supabase at
startup, keyed by CAMERA_ID. This lets one restaurant register any number
of cameras from the MEZA dashboard (/cameras) and point this same script
at each of them by passing a different CAMERA_ID - no code changes
required per install.

Phase 3 of the phone-sensing pivot (see PIVOT_AUDIT.md) added three
capabilities on top of the original occupancy-percentage detector, all
reusing the same per-cycle detect_people() call - no extra frames, no
extra detection passes:
  - Per-table occupied/empty tracking (detect_table_occupancy used to only
    return a count; session detection needs to know WHICH table changed).
  - Zone-polygon occupancy (point-in-polygon against zones.polygon,
    alongside the existing rectangle table_regions), written through the
    streams/readings model phones use (signal_type='zone_occupancy',
    'occupancy_count') - this script auto-provisions one `devices` row
    per camera (device_type='cctv_bridge') so it has something to key
    streams.device_id against, same pattern as the Phase 2 capture page.
  - A debounced session-detection state machine (SessionTracker) that
    finally gives `table_sessions` a real production writer: sustained
    occupancy starts a session, sustained emptiness ends it. Debounce
    thresholds (SESSION_START_MINUTES/SESSION_END_MINUTES) are
    configurable, not hardcoded - restaurant service pace varies and this
    can't be tuned empirically without labeled pilot data (same honesty
    caveat cv_pipeline/EVALUATION.md already states about the detector
    itself). In-flight debounce state lives in-process and is lost on
    restart - a documented limitation, not fixed this pass.

Required environment variables:
  CAMERA_ID            - id of the row in the `cameras` table to run
  SUPABASE_URL          - e.g. https://your-project.supabase.co
  SUPABASE_SERVICE_KEY  - service role key (edge device only - never ship
                           this to a browser or commit it to source control)

Optional:
  SESSION_START_MINUTES  - minutes a table must stay occupied before a
                            table_sessions row starts (default 3)
  SESSION_END_MINUTES    - minutes a table must stay empty before that
                            session closes (default 10)

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
import secrets
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


def load_zones(supabase_url: str, service_key: str, camera_id: str) -> list:
    """Fetch zone polygons configured for this camera (zones.camera_id).
    Zones themselves are created via direct SQL / a future /zones UI, not
    by this script - an empty list here just means zone occupancy won't
    fire, same "not configured -> skip" pattern as table_regions/queue_region."""
    resp = requests.get(
        f"{supabase_url}/rest/v1/zones",
        params={"camera_id": f"eq.{camera_id}", "select": "*"},
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def get_or_create_device(supabase_url: str, service_key: str, restaurant_id: str, camera_id: str) -> dict:
    """Look up (or auto-provision) the cctv_bridge devices row for this
    camera, so zone/occupancy readings can reference streams.device_id.
    The generated token is unused by this script - the service-role key
    remains the real credential, matching every sibling write in this
    file. It exists only so a device row is indistinguishable in shape
    from a phone's, for anything downstream that lists devices."""
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    resp = requests.get(
        f"{supabase_url}/rest/v1/devices",
        params={"camera_id": f"eq.{camera_id}", "select": "*"},
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    rows = resp.json()
    if rows:
        return rows[0]

    resp = requests.post(
        f"{supabase_url}/rest/v1/devices",
        headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"},
        data=json.dumps({
            "restaurant_id": restaurant_id,
            "device_type": "cctv_bridge",
            "camera_id": camera_id,
            "token": secrets.token_urlsafe(24),
            "status": "active",
        }),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()[0]


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


def point_in_polygon(x: float, y: float, polygon_px: list) -> bool:
    """Ray-casting point-in-polygon test. polygon_px is a list of (x, y)
    tuples in the same coordinate space (pixels) as x, y."""
    if len(polygon_px) < 3:
        return False
    inside = False
    n = len(polygon_px)
    j = n - 1
    for i in range(n):
        xi, yi = polygon_px[i]
        xj, yj = polygon_px[j]
        if (yi > y) != (yj > y):
            x_intersect = (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi
            if x < x_intersect:
                inside = not inside
        j = i
    return inside


class SessionTracker:
    """Debounced per-table occupied/empty state machine that finally gives
    table_sessions a real writer. Sustained occupancy (>= start_seconds)
    opens a session; sustained emptiness (>= end_seconds) closes it. State
    is in-process only - a restart loses in-flight debounce timers and any
    already-open session's tracking (the row itself stays open in the DB
    with no end_time until this process, or a human, closes it)."""

    def __init__(self, supabase_url, service_key, restaurant_id, start_minutes, end_minutes):
        self.supabase_url = supabase_url
        self.service_key = service_key
        self.restaurant_id = restaurant_id
        self.start_seconds = start_minutes * 60
        self.end_seconds = end_minutes * 60
        self.tables = {}  # table_number -> state dict

    def update(self, table_occupancy: dict, now: datetime):
        for table_number, occupied in table_occupancy.items():
            t = self.tables.setdefault(table_number, {
                "confirmed_occupied": False,
                "candidate": occupied,
                "candidate_since": now,
                "session_id": None,
                "session_start": None,
            })
            if occupied != t["candidate"]:
                t["candidate"] = occupied
                t["candidate_since"] = now

            elapsed = (now - t["candidate_since"]).total_seconds()

            if occupied and not t["confirmed_occupied"] and elapsed >= self.start_seconds:
                t["confirmed_occupied"] = True
                t["session_start"] = now
                t["session_id"] = self._start_session(table_number, now)
            elif not occupied and t["confirmed_occupied"] and elapsed >= self.end_seconds:
                t["confirmed_occupied"] = False
                if t["session_id"]:
                    self._end_session(t["session_id"], t["session_start"], now)
                t["session_id"] = None
                t["session_start"] = None

    def _headers(self, prefer):
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }

    def _start_session(self, table_number, start_time):
        try:
            resp = requests.post(
                f"{self.supabase_url}/rest/v1/table_sessions",
                headers=self._headers("return=representation"),
                data=json.dumps({
                    "restaurant_id": self.restaurant_id,
                    "table_number": table_number,
                    "start_time": start_time.isoformat(),
                }),
                timeout=10,
            )
            if resp.status_code in (200, 201):
                row = resp.json()[0]
                print(f"[session] table {table_number} occupied - session {row['id']} started")
                return row["id"]
            print(f"[warn] failed to start session for table {table_number}: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"[warn] error starting session for table {table_number}: {e}")
        return None

    def _end_session(self, session_id, start_time, end_time):
        dwell_minutes = round((end_time - start_time).total_seconds() / 60)
        try:
            resp = requests.patch(
                f"{self.supabase_url}/rest/v1/table_sessions",
                params={"id": f"eq.{session_id}"},
                headers=self._headers("return=minimal"),
                data=json.dumps({"end_time": end_time.isoformat(), "dwell_time": dwell_minutes}),
                timeout=10,
            )
            if resp.status_code not in (200, 204):
                print(f"[warn] failed to end session {session_id}: {resp.status_code} {resp.text}")
            else:
                print(f"[session] session {session_id} ended, dwell {dwell_minutes}m")
        except Exception as e:
            print(f"[warn] error ending session {session_id}: {e}")


class OccupancyDetector:
    def __init__(self, config: dict, supabase_url: str, supabase_key: str, simulate: bool = False,
                 session_start_minutes: float = 3, session_end_minutes: float = 10):
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

        self.zones = load_zones(supabase_url, supabase_key, self.camera_id)
        if not self.zones:
            print("[info] no zones configured for this camera - zone_occupancy readings will not be sent.")

        self.device = get_or_create_device(supabase_url, supabase_key, self.restaurant_id, self.camera_id)
        self.device_id = self.device["id"]
        self._stream_ids = {}

        self.session_tracker = SessionTracker(
            supabase_url, supabase_key, self.restaurant_id,
            session_start_minutes, session_end_minutes,
        )

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
        used only in --simulate mode. No camera, no frame, no detector.
        Also synthesizes per-table occupied/empty booleans and per-zone
        counts (not just the aggregate snapshot) so --simulate exercises
        the exact same session-detection and zone-reading code paths a
        real camera would."""
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

        snapshot = {
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

        table_numbers = (
            [t.get('table_number', i + 1) for i, t in enumerate(self.table_regions)]
            or list(range(1, total_tables + 1))
        )
        occupied_set = set(random.sample(table_numbers, min(occupied_tables, len(table_numbers)))) if table_numbers else set()
        table_occupancy = {tn: (tn in occupied_set) for tn in table_numbers}

        zone_counts = {}
        for zone in self.zones:
            zone_counts[zone['id']] = round(people_count * random.uniform(0.2, 0.6) / max(len(self.zones), 1))

        return snapshot, table_occupancy, zone_counts

    def detect_table_occupancy(self, people, frame):
        """Per-table occupied/empty state, keyed by table_number - not just
        a count. Session detection needs to know WHICH table transitioned."""
        h, w = frame.shape[:2]
        occupancy = {}

        for table in self.table_regions:
            x1 = int(table['x1'] * w)
            y1 = int(table['y1'] * h)
            x2 = int(table['x2'] * w)
            y2 = int(table['y2'] * h)

            occupied = any(
                x1 <= person['x'] <= x2 and y1 <= person['y'] <= y2
                for person in people
            )
            occupancy[table['table_number']] = occupied

        return occupancy

    def detect_zone_occupancy(self, people, frame):
        """Point-in-polygon person count per configured zone. Returns
        {zone_id: count} - empty dict if this camera has no zones."""
        if not self.zones:
            return {}

        h, w = frame.shape[:2]
        counts = {}
        for zone in self.zones:
            polygon_px = [(pt['x'] * w, pt['y'] * h) for pt in zone['polygon']]
            counts[zone['id']] = sum(
                1 for person in people if point_in_polygon(person['x'], person['y'], polygon_px)
            )
        return counts

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
        """Capture and process a single frame (or a fake one, in --simulate
        mode). Returns (snapshot, table_occupancy, zone_counts)."""
        if self.simulate:
            return self.generate_simulated_snapshot()

        ret, frame = self.cap.read()
        if not ret:
            return None, {}, {}

        people = self.detect_people(frame)
        table_occupancy = self.detect_table_occupancy(people, frame)
        occupied_tables = sum(1 for occupied in table_occupancy.values() if occupied)
        total_tables = len(table_occupancy)
        available_tables = total_tables - occupied_tables
        queue_length = self.detect_queue(people, frame)
        zone_counts = self.detect_zone_occupancy(people, frame)

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

        return snapshot, table_occupancy, zone_counts

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

    def ensure_stream(self, signal_type: str):
        """Get-or-create the (device_id, signal_type) stream row, cached
        per process so this is one round-trip on first use, not every cycle."""
        if signal_type in self._stream_ids:
            return self._stream_ids[signal_type]

        headers = {"apikey": self.supabase_key, "Authorization": f"Bearer {self.supabase_key}"}
        try:
            resp = requests.get(
                f"{self.supabase_url}/rest/v1/streams",
                params={"device_id": f"eq.{self.device_id}", "signal_type": f"eq.{signal_type}", "select": "id"},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            rows = resp.json()
            if rows:
                self._stream_ids[signal_type] = rows[0]["id"]
                return self._stream_ids[signal_type]

            resp = requests.post(
                f"{self.supabase_url}/rest/v1/streams",
                headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"},
                data=json.dumps({"device_id": self.device_id, "signal_type": signal_type}),
                timeout=10,
            )
            resp.raise_for_status()
            self._stream_ids[signal_type] = resp.json()[0]["id"]
            return self._stream_ids[signal_type]
        except Exception as e:
            print(f"[warn] failed to ensure stream for {signal_type}: {e}")
            return None

    def send_reading(self, signal_type: str, timestamp: str, value: dict):
        """Insert one readings row. A single 'zone_occupancy' reading
        carries every zone's count in value_json (not one stream per
        zone) - streams.(device_id, signal_type) is unique per device, so
        this is the correct shape for a camera with multiple zones."""
        stream_id = self.ensure_stream(signal_type)
        if not stream_id:
            return
        try:
            requests.post(
                f"{self.supabase_url}/rest/v1/readings",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                data=json.dumps({"stream_id": stream_id, "timestamp": timestamp, "value_json": value}),
                timeout=10,
            )
        except Exception as e:
            print(f"[warn] failed to send {signal_type} reading: {e}")

    def run(self):
        """Main loop"""
        print("Starting occupancy detection pipeline..."
              + (" [SIMULATE MODE - no camera, synthetic data]" if self.simulate else ""))
        print(f"Camera: {self.config.get('name', self.camera_id)}")
        print(f"Restaurant: {self.restaurant_id}")
        print(f"Device: {self.device_id}")
        if not self.simulate:
            print(f"RTSP stream: {self.rtsp_url}")
        print(f"Snapshot interval: {self.snapshot_interval}s")
        print(f"Tracking {len(self.table_regions)} table(s)"
              + (", plus queue region" if self.queue_region else "")
              + (f", {len(self.zones)} zone(s)" if self.zones else ""))
        print(f"Session detection: start after {self.session_tracker.start_seconds / 60:.1f}m occupied, "
              f"end after {self.session_tracker.end_seconds / 60:.1f}m empty")
        print("Privacy: frames processed in memory, never stored\n")

        snapshot_count = 0

        while True:
            try:
                snapshot, table_occupancy, zone_counts = self.capture_snapshot()
                if snapshot:
                    if self.send_to_supabase(snapshot):
                        snapshot_count += 1

                    self.send_reading('occupancy_count', snapshot['timestamp'], {'count': snapshot['people_count']})
                    if zone_counts:
                        self.send_reading('zone_occupancy', snapshot['timestamp'], {'zones': zone_counts})

                    if table_occupancy:
                        self.session_tracker.update(table_occupancy, datetime.now())

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
    session_start_minutes = float(os.environ.get("SESSION_START_MINUTES", "3"))
    session_end_minutes = float(os.environ.get("SESSION_END_MINUTES", "10"))

    if not camera_id or not supabase_url or not supabase_key:
        print(
            "Missing required environment variables. Set CAMERA_ID, "
            "SUPABASE_URL and SUPABASE_SERVICE_KEY (see this file's "
            "module docstring for details).",
            file=sys.stderr,
        )
        sys.exit(1)

    config = load_camera_config(supabase_url, supabase_key, camera_id)
    detector = OccupancyDetector(
        config, supabase_url, supabase_key, simulate=args.simulate,
        session_start_minutes=session_start_minutes, session_end_minutes=session_end_minutes,
    )
    detector.run()


if __name__ == '__main__':
    main()
