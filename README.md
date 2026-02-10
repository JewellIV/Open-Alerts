# OpenAlerts

A free, self-hosted fire station alerting system designed for volunteer fire departments. OpenAlerts provides real-time dispatch alerts, multi-display support, room speaker control, and hardware integration - all without subscription fees or cloud dependencies.

## 🚨 Features

### Core Functionality
- **Real-Time Alert Display** - Instant alert notifications on multiple displays
- **Multi-Display Support** - One backend server, unlimited display devices
- **Room Speaker Control** - Unit-based alert routing with per-room GPIO relay control
- **Interactive Maps** - Automatic geocoding and map display for alert locations
- **Weather Integration** - Live weather and radar display
- **Text-to-Speech** - Browser-based TTS announcements
- **Mobile Notifications** - Discord and Slack webhook integration
- **Hardware Integration** - GPIO relay control, smart lights, amplifier control

### Display Types
- **Main Station Display** - Large command center display with full alert details
- **Room Displays** - Compact displays for individual rooms with unit filtering
- **Night Mode** - Automatic dimming and quiet mode for nighttime hours

### Hardware Support
- **Raspberry Pi** - Full GPIO support for relay control
- **Philips Hue** - Smart light integration
- **USB Serial** - Amplifier and device control
- **GPIO Relays** - Per-room speaker control
- **RGB LED Rings** - WS2812B/NeoPixel LED rings for visual alert indication

## 📋 Requirements

- **Node.js** v18 or higher
- **npm** or **yarn**
- **SQLite** (included with better-sqlite3)
- **Network** - For multi-display setup

### Optional Hardware
- Raspberry Pi 5 (recommended for GPIO control)
- GPIO relay modules (for room speaker control)
- External speakers/amplifiers
- Smart lights (Philips Hue, etc.)
- RGB LED rings (WS2812B/NeoPixel) for visual alert indication

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or download the repository
cd openalerts

# Install backend dependencies
npm install

# On Raspberry Pi: npm install above also installs the onoff package for GPIO.
# Run this in the project root on the Pi after clone/pull—do not copy node_modules from Windows.

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
API_KEY=your-secret-api-key-here

# Admin Authentication (optional)
ADMIN_PASSWORD=your-admin-password

# Optional Integrations
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Room Speaker Configuration (optional)
ROOM_SPEAKERS=room1:Engine 1|Ladder 2,room2:Medic 1|Medic 2

# LED Ring Configuration (optional)
LED_RING_ENABLED=true
LED_RING_PIN=18
LED_RING_COUNT=24
LED_RING_BRIGHTNESS=128
```

### 3. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### 4. Start Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000`

### 5. Access Dashboard

- **Main Dashboard:** `http://localhost:3000`
- **Room Display:** `http://localhost:3000/#room`
- **Station Display:** `http://localhost:3000/#station`

## 📡 Receiving Alerts

### Standard API Endpoint

Send alerts via HTTP POST:

```bash
POST http://YOUR_SERVER_IP:3000/api/alert
Content-Type: application/json
X-API-Key: your-api-key-here

{
  "call_type": "Structure Fire",
  "address": "123 Main St, Aylett, VA 23009",
  "units": "Engine 1, Ladder 2",
  "narrative": "Reported structure fire with smoke visible"
}
```

### ActiveAlerts/Active911 Webhook

Use the dedicated webhook endpoint for automatic format conversion:

```
POST http://YOUR_SERVER_IP:3000/api/webhook/activealerts
```

### Integration Examples

- **TwoToneDetect** - Radio dispatch integration
- **Resgrid** - CAD system integration
- **ActiveAlerts/Active911** - Mobile alert forwarding
- **Custom CAD Systems** - Any system that can send HTTP POST requests

See `INTEGRATION_GUIDE.md` for detailed setup instructions.

## 🏗️ Architecture

```
┌─────────────────┐
│  Backend Server │  ← Runs on one device (Raspberry Pi, PC, or server)
│   Port 3000     │     - Handles alerts, database, GPIO control
└────────┬────────┘     - Serves frontend to all displays
         │
         │ Socket.io + HTTP
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼───┐  ┌───▼───┐  ┌───▼───┐
│Display│ │Display│  │Display│  │Display│  ← Multiple frontend displays
│   1   │ │   2   │  │   3   │  │   N   │     (Raspberry Pis, PCs, etc.)
└───────┘ └───────┘  └───────┘  └───────┘     - Connect via network
                                                 - Receive alerts in real-time
```

## 📚 Documentation

- **[Installation Guide](INSTALLATION_GUIDE.md)** - Complete setup instructions
- **[Integration Guide](INTEGRATION_GUIDE.md)** - External system integration
- **[Multi-Display Setup](MULTI_DISPLAY_SETUP.md)** - Multiple display configuration
- **[Room Speaker Setup](ROOM_SPEAKER_SETUP.md)** - Per-room speaker control
- **[Hardware Setup](HARDWARE_SETUP.md)** - GPIO, lights, amplifiers
- **[Display Setup](DISPLAY_SETUP.md)** - Frontend deployment options
- **[Raspberry Pi Setup](RASPBERRY_PI_SETUP.md)** - Raspberry Pi deployment

## 🔧 API Documentation

### Endpoints

#### Health Check
```
GET /health
```

#### Send Alert
```
POST /api/alert
Headers: X-API-Key: your-api-key
Body: {
  "call_type": "string (required)",
  "address": "string (required)",
  "units": "string (required)",
  "narrative": "string (optional)"
}
```

#### Get Alerts
```
GET /api/alerts
```

#### ActiveAlerts Webhook
```
POST /api/webhook/activealerts
Body: ActiveAlerts format (auto-converted)
```

#### Room Speaker Control
```
POST /api/room-speaker/:roomId/mute
Body: { "mute": true/false }
```

#### Station Units Management
```
GET /api/station-units
POST /api/station-units (admin)
```

See API documentation in code comments for complete endpoint details.

## 🎛️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `API_KEY` | API authentication key | No (optional) |
| `ADMIN_PASSWORD` | Admin page password | No (optional) |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL | No |
| `SLACK_WEBHOOK_URL` | Slack webhook URL | No |
| `ROOM_SPEAKERS` | Room speaker configuration | No |

### Frontend Configuration

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://192.168.1.100:3000
VITE_DISPLAY_TYPE=room
VITE_NIGHT_MODE_ENABLED=true
```

## 🧪 Testing

### Test Alert Script

Use the included test script:

```powershell
powershell -ExecutionPolicy Bypass -File test-alert.ps1
```

### Manual Testing

```bash
# PowerShell
$body = @{
    call_type = "Test Alert"
    address = "123 Test St"
    units = "Engine 1"
    narrative = "Testing system"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/alert `
  -Method POST -Body $body -ContentType "application/json" `
  -Headers @{"X-API-Key"="your-api-key"}
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F
```

### Frontend Can't Connect to Backend
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check `VITE_BACKEND_URL` in `frontend/.env`
3. Check firewall allows port 3000
4. Verify network connectivity

### GPIO Not Working
1. **Run `npm install` in the project root on the Raspberry Pi** – The `onoff` package (for GPIO) is a dependency; it must be installed on the Pi. Do not copy `node_modules` from Windows; run `npm install` on the Pi after clone or pull.
2. If you see "GPIO not available - onoff library may not be installed", run `npm install` in the project root, then restart the backend.
3. If you see "Loaded 0 unit-to-pin mappings", add active units in the Station Units admin (e.g. Engine 1, Medic 2) so the backend can assign GPIO pins.
4. Ensure running on Raspberry Pi (Linux); GPIO is not available on Windows.
5. Verify GPIO pin numbers and relay wiring (see setup guides).

See individual setup guides for detailed troubleshooting.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Node.js, Express, React, and TypeScript
- Uses Leaflet for mapping (OpenStreetMap)
- Socket.io for real-time communication
- better-sqlite3 for database
- Tailwind CSS for styling

## 📞 Support

For issues, questions, or contributions:
- Check the documentation files in the repository
- Review troubleshooting sections in setup guides
- Open an issue on the repository

## 🎯 Roadmap

- [x] Additional CAD system integrations ✅
- [ ] Enhanced mobile app support
- [x] Advanced reporting and analytics ✅
- [x] Multi-language support ✅
- [x] Additional hardware integrations ✅ (Custom hardware support available)

---

**OpenAlerts** - Free, Open-Source Fire Station Alerting System

Made for volunteer fire departments who need reliable alerting without subscription fees.
# OpenAlert
