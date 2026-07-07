# MEZA CV pipeline - one container per camera (CAMERA_ID selects which).
# Built for CPU inference on edge hardware (Raspberry Pi 4 / Jetson Nano
# running a 64-bit OS; for Jetson's GPU-accelerated path see the "Optional"
# deps in requirements.txt and swap the base image for an NVIDIA L4T image
# instead of this generic one).

FROM python:3.11-slim

# libgl1/libglib2.0-0: required by opencv-python's video I/O even though we
# never open a GUI window; ffmpeg: RTSP stream demuxing backend for cv2.VideoCapture.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake in the detector weights at build time (downloads into WORKDIR) so
# the container works fully offline at runtime - avoids depending on
# internet access on every container start/restart on the edge device.
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY occupancy_detector.py .

# Required at runtime: CAMERA_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY (see
# occupancy_detector.py's module docstring). Pass with `docker run -e`.
ENTRYPOINT ["python", "occupancy_detector.py"]
