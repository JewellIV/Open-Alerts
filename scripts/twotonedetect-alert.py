#!/usr/bin/env python3
"""
TwoToneDetect Alert Script for MVFD Phoenix
Use with alert_command or post_email_command in TwoToneDetect tones.cfg

Usage (without recording - runs on tone detection):
  alert_command = python C:\\path\\to\\scripts\\twotonedetect-alert.py admin

Usage (with recording - runs AFTER TwoToneDetect records the voice message):
  post_email_command = python C:\\path\\to\\scripts\\twotonedetect-alert.py admin [mp3]

  TwoToneDetect substitutes [mp3] with the path to the recorded file.
  Use [wav] or [amr] if your TTD config uses those formats instead.
"""

import json
import mimetypes
import os
import random
import string
import sys
import urllib.error
import urllib.request
from typing import Tuple

# ============ CONFIGURATION - Edit these for your setup ============
SERVER_URL = "http://localhost:3000"   # Your OpenAlerts server (e.g. http://192.168.1.100:3000)
API_KEY = "5c6b9987376f3823c5c171e4deefccce22c94ae3271a9c494ec3cee43f945400"                           # Leave empty if API_KEY not set in .env
# ===================================================================


def get_alert_config(page_type: str) -> dict:
    """Build alert payload based on page type."""
    pt = page_type.lower()
    if pt == "admin":
        return {
            "call_type": "Admin Page",
            "address": "Admin Dispatch",
            "units": "Admin",
            "narrative": "Admin message received from TwoToneDetect",
            "source": "twotonedetect_admin",
        }
    if pt == "dispatch":
        return {
            "call_type": "Dispatch",
            "address": "See narrative",
            "units": "See narrative",
            "narrative": "Two-tone page detected",
            "source": "twotonedetect",
        }
    return {
        "call_type": page_type,
        "address": "See narrative",
        "units": "See narrative",
        "narrative": "Two-tone page detected",
        "source": "twotonedetect",
    }


def _make_multipart_boundary() -> str:
    return "----TTD_" + "".join(random.choices(string.ascii_letters + string.digits, k=24))


def _encode_multipart(fields: dict, file_path: str) -> Tuple[bytes, str]:
    """Encode form fields and file as multipart/form-data. Returns (body, boundary)."""
    boundary = _make_multipart_boundary()
    lines = []

    for name, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        lines.append(str(value).encode("utf-8"))
        lines.append(b"\r\n")

    filename = os.path.basename(file_path)
    mime_type, _ = mimetypes.guess_type(filename)
    mime_type = mime_type or "application/octet-stream"

    lines.append(f"--{boundary}\r\n".encode())
    lines.append(
        f'Content-Disposition: form-data; name="recording"; filename="{filename}"\r\n'.encode()
    )
    lines.append(f"Content-Type: {mime_type}\r\n\r\n".encode())

    with open(file_path, "rb") as f:
        lines.append(f.read())

    lines.append(f"\r\n--{boundary}--\r\n".encode())

    return b"".join(lines), boundary


def send_alert_with_recording(page_type: str, recording_path: str) -> None:
    """Upload alert with recording file to /api/alert/with-recording."""
    config = get_alert_config(page_type)
    fields = {
        "call_type": config["call_type"],
        "address": config["address"],
        "units": config["units"],
        "narrative": config["narrative"],
        "source": config["source"],
    }

    body, boundary = _encode_multipart(fields, recording_path)
    url = f"{SERVER_URL.rstrip('/')}/api/alert/with-recording"

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
    if API_KEY:
        headers["X-API-Key"] = API_KEY

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[TTD] Alert with recording sent: {page_type} - {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"[TTD] Error: {e.code} {e.reason}", file=sys.stderr)
        if e.fp:
            body_resp = e.fp.read().decode("utf-8", errors="replace")
            print(body_resp, file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[TTD] Error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def send_alert_only(page_type: str) -> None:
    """Send alert (no recording) to /api/alert."""
    config = get_alert_config(page_type)
    url = f"{SERVER_URL.rstrip('/')}/api/alert"
    data = json.dumps(config).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[TTD] Alert sent: {page_type} - {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"[TTD] Error: {e.code} {e.reason}", file=sys.stderr)
        if e.fp:
            print(e.fp.read().decode("utf-8", errors="replace"), file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[TTD] Error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def main():
    page_type = sys.argv[1] if len(sys.argv) > 1 else "dispatch"
    recording_path = sys.argv[2].strip('"') if len(sys.argv) > 2 else None

    if recording_path and os.path.isfile(recording_path):
        send_alert_with_recording(page_type, recording_path)
    else:
        if recording_path:
            print(f"[TTD] Recording file not found: {recording_path}", file=sys.stderr)
            print("[TTD] Sending alert without recording.", file=sys.stderr)
        send_alert_only(page_type)


if __name__ == "__main__":
    main()
