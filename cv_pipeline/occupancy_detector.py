"""
CV Pipeline for Anonymous Occupancy Detection
Runs on edge device (Raspberry Pi / Jetson Nano)
Processes CCTV RTSP stream - outputs metadata only, no image storage
"""

import cv2
import numpy as np
import requests
import time
import json
from datetime import datetime

# Configuration
RTSP_URL = "rtsp://camera-ip:554/stream"  # Your CCTV RTSP URL
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_KEY = "your-anon-key"
RESTAURANT_ID = "your-restaurant-uuid"
SNAPSHOT_INTERVAL = 300  # Take snapshot every 5 minutes
FPS = 1  # Only need 1 frame per second
TABLE_REGIONS = [
    # Define table ROI coordinates (x1, y1, x2, y2) as percentage of frame
    {"id": 1, "region": [0.1, 0.2, 0.3, 0.5]},
    {"id": 2, "region": [0.4, 0.2, 0.6, 0.5]},
    {"id": 3, "region": [0.7, 0.2, 0.9, 0.5]},
    {"id": 4, "region": [0.1, 0.6, 0.3, 0.9]},
    {"id": 5, "region": [0.4, 0.6, 0.6, 0.9]},
    {"id": 6, "region": [0.7, 0.6, 0.9, 0.9]},
]
QUEUE_REGION = [0.5, 0.9, 0.9, 1.0]  # Queue area (near entrance)

class OccupancyDetector:
    def __init__(self):
        self.cap = cv2.VideoCapture(RTSP_URL)
        if not self.cap.isOpened():
            raise ValueError(f"Cannot open RTSP stream: {RTSP_URL}")
        
        # Person detection model (YOLOv8 or RT-DETR)
        # For edge devices, use ONNX runtime for faster inference
        self.person_detector = self.load_detector()
        
        # Tracking for dwell time (simple centroid tracking)
        self.tracked_ids = {}
        self.track_history = {}
        
    def load_detector(self):
        """Load person detection model"""
        # Option 1: YOLOv8 (requires ultralytics)
        # from ultralytics import YOLO
        # model = YOLO('yolov8n.pt')
        # return model
        
        # Option 2: OpenCV DNN (lighter, no GPU needed)
        # Load pre-trained Caffe model for person detection
        net = cv2.dnn.readNetFromCaffe(
            'deploy.prototxt',
            'res10_300x300_ssd_iter_140000.caffemodel'
        )
        return net
        
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
        """Determine which tables are occupied"""
        h, w = frame.shape[:2]
        occupied_tables = 0
        total_tables = len(TABLE_REGIONS)
        
        for table in TABLE_REGIONS:
            x1, y1, x2, y2 = [int(v * w if i < 2 else v * h) for i, v in enumerate(table['region'])]
            
            # Check if any person is in this table region
            table_occupied = False
            for person in people:
                if x1 <= person['x'] <= x2 and y1 <= person['y'] <= y2:
                    table_occupied = True
                    break
            
            if table_occupied:
                occupied_tables += 1
        
        return occupied_tables, total_tables
    
    def detect_queue(self, people, frame):
        """Detect queue length near entrance"""
        h, w = frame.shape[:2]
        qx1, qy1, qx2, qy2 = [int(v * w if i < 2 else v * h) for i, v in enumerate(QUEUE_REGION)]
        
        queue_people = 0
        for person in people:
            if qx1 <= person['x'] <= qx2 and qy1 <= person['y'] <= qy2:
                queue_people += 1
        
        return queue_people
    
    def capture_snapshot(self):
        """Capture and process a single frame"""
        ret, frame = self.cap.read()
        if not ret:
            return None
        
        # Detect people
        people = self.detect_people(frame)
        
        # Table occupancy
        occupied_tables, total_tables = self.detect_table_occupancy(people, frame)
        available_tables = total_tables - occupied_tables
        
        # Queue detection
        queue_length = self.detect_queue(people, frame)
        
        # Calculate metrics
        occupancy_percentage = (occupied_tables / total_tables * 100) if total_tables > 0 else 0
        people_count = len(people)
        
        # Estimate wait time (simple heuristic)
        wait_time = max(0, queue_length * 3)  # ~3 min per person in queue
        
        # Build snapshot data
        snapshot = {
            'restaurant_id': RESTAURANT_ID,
            'timestamp': datetime.now().isoformat(),
            'occupancy_percentage': round(occupancy_percentage, 2),
            'occupied_tables': occupied_tables,
            'available_tables': available_tables,
            'people_count': people_count,
            'queue_length': queue_length,
            'wait_time': wait_time,
            'total_tables': total_tables,
        }
        
        # IMPORTANT: Frame is discarded immediately after processing
        # No image is stored or transmitted
        del frame
        
        return snapshot
    
    def send_to_supabase(self, snapshot):
        """Send occupancy data to Supabase"""
        if not snapshot:
            return False
        
        try:
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/occupancy_snapshots",
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
                data=json.dumps(snapshot),
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                print(f"[{datetime.now()}] Snapshot sent: {snapshot['occupancy_percentage']}% occupancy, "
                      f"{snapshot['people_count']} people, queue: {snapshot['queue_length']}")
                return True
            else:
                print(f"Failed to send snapshot: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"Error sending snapshot: {e}")
            return False
    
    def run(self):
        """Main loop"""
        print("Starting occupancy detection pipeline...")
        print(f"RTSP Stream: {RTSP_URL}")
        print(f"Snapshot interval: {SNAPSHOT_INTERVAL}s")
        print("Privacy: Frames processed in memory, never stored\n")
        
        snapshot_count = 0
        
        while True:
            try:
                snapshot = self.capture_snapshot()
                if snapshot:
                    success = self.send_to_supabase(snapshot)
                    if success:
                        snapshot_count += 1
                
                time.sleep(SNAPSHOT_INTERVAL)
                
            except KeyboardInterrupt:
                print(f"\nStopped. Total snapshots: {snapshot_count}")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(10)  # Wait before retrying
        
        self.cap.release()

if __name__ == '__main__':
    detector = OccupancyDetector()
    detector.run()
