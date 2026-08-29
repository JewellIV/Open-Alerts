# Room GPIO Service

Run this **on each room Pi** so that room’s display can control **local** relays (short speaker runs). The **central backend** (Windows 10 firehouse PC, or a server Pi) keeps the single database for alerts, notices, and room config.

## Quick setup (per room Pi)

```bash
cd /home/mvfdadmin
# Copy or clone the repo, then:
cd room-gpio-service   # or path to this folder
npm install
export ROOM_PINS=4,5,6,7,8,9,21,22   # GPIO BCM pins for this room's 8-channel relay
export GPIO_PORT=4000
npm start
```

## Raspberry Pi 5 / Bookworm

On **Raspberry Pi 5** with **Bookworm**, the Node `onoff` library often fails with `EINVAL` (legacy sysfs GPIO is deprecated). The service **automatically falls back** to Python **gpiozero** when onoff fails. Install it on the Pi:

```bash
sudo apt update
sudo apt install -y python3-gpiozero
```

Or force Python GPIO: `export USE_PYTHON_GPIO=1` before `npm start`.

## Environment

| Variable | Description | Default |
|---------|-------------|---------|
| `ROOM_PINS` | Comma-separated GPIO BCM numbers (e.g. `4,5,6,7,8,9,21,22`) | `4,5,6,7,8,9,21,22` |
| `GPIO_PORT` | HTTP port for this service | `4000` |
| `RELAY_ACTIVE_HIGH` | Set to `1` if relay turns on when pin is high | `0` (active low) |
| `USE_PYTHON_GPIO` | Set to `1` to use Python gpiozero (Pi 5 / Bookworm) | auto when onoff fails |

## API

- **POST /gpio/mute**  
  Body: `{ "mute": true | false, "pins": [4,5,6] }` (optional `pins`; if omitted, all `ROOM_PINS` are used).
- **GET /gpio/status**  
  Returns `{ "success": true, "pins": [...], "status": [{ "pin", "value" }] }`.
- **GET /health**  
  Returns `{ "ok": true, "pins": [...] }` for systemd/health checks.

## Systemd (start at boot)

```bash
sudo cp room-gpio-service.service /etc/systemd/system/
# Edit ROOM_PINS for this room:
sudo nano /etc/systemd/system/room-gpio-service.service
sudo systemctl daemon-reload
sudo systemctl enable room-gpio-service
sudo systemctl start room-gpio-service
sudo systemctl status room-gpio-service
```

## Frontend behavior

The OpenAlerts frontend (IdleScreen, quiet mode, room mute) uses the **central backend** for room config and unit→pin mapping. When you mute or unmute:

1. Frontend gets this room’s pins from central: `GET /api/room-speaker/:roomId/status`
2. Frontend calls this local service: `POST http://localhost:4000/gpio/mute` with `{ mute, pins }`
3. If the local service is not running (e.g. on server Pi), the frontend falls back to the central backend’s `/api/room-speaker/:roomId/mute`

So: **one database on the Windows PC (or server Pi)**, **one small GPIO service per room Pi**.
