# Multi-Display Setup Guide

Guide for running one backend server with multiple frontend displays connecting to it.

## Architecture Overview

```
┌─────────────────┐
│  Backend Server │  ← Runs on one device (Raspberry Pi, PC, or server)
│   Port 3000     │
└────────┬────────┘
         │
         │ Socket.io + HTTP
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼───┐  ┌───▼───┐  ┌───▼───┐
│Display│ │Display│  │Display│  │Display│  ← Multiple frontend displays
│   1   │ │   2   │  │   3   │  │   N   │     (Raspberry Pis, PCs, etc.)
└───────┘ └───────┘  └───────┘  └───────┘
```

## Hardware Requirements

### Recommended Display Hardware

**For Room Displays (Small Screens):**
- **MAGEX 15.6" Touchscreen Monitor** (HDMI, VGA, DVI, FHD 1080p IPS)
  - 10-point touch display with remote control
  - Built-in speakers
  - VESA mount compatible
  - Price: ~$159.99
  - Perfect for: Office rooms, dorm rooms, kitchen displays

**For Main Station Display (Large Screen):**
- **Amazon Fire TV 40" 2-Series** (HD Smart TV)
  - HD smart TV with Alexa Voice Remote
  - Fast streaming, Dolby Audio
  - Ambient Experience mode
  - Price: ~$159.99 (with discount code)
  - Perfect for: Main station command center, large viewing area

**For Backend Server & Display Controllers:**
- **CanaKit Raspberry Pi 5 Starter Kit PRO** (8GB RAM, 128GB Edition)
  - Includes Raspberry Pi 5, power supply, case, cooling fan, microSD card
  - Price: ~$179.77 per kit
  - Quantity: 6 units (for multiple displays + backend server)
  - Perfect for: Running backend server and frontend displays

### Complete Hardware Setup

**Backend Server:**
- 1x Raspberry Pi 5 Starter Kit (8GB RAM) - Runs backend server

**Display Devices:**
- 1x Amazon Fire TV 40" - Main station display
- 1x MAGEX 15.6" Touchscreen Monitor - Room display (or more as needed)
- 4-5x Raspberry Pi 5 Starter Kits (8GB RAM) - For display controllers

**Total Display Setup:**
- 1 large main station display (Fire TV)
- Multiple room displays (MAGEX touchscreens)
- Each display connects to a Raspberry Pi 5 running the frontend

## Step 1: Set Up Backend Server

### On the Backend Device (Server)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure backend `.env`:**
   ```bash
   nano .env
   ```
   
   ```env
   PORT=3000
   API_KEY=your-secret-api-key-here
   
   # Optional integrations
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

3. **Build frontend (for serving admin interface):**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. **Start backend server:**
   ```bash
   # Development
   npm run dev
   
   # Production (with PM2)
   pm2 start npm --name "mvfd-backend" -- start
   pm2 save
   ```

5. **Configure firewall (if needed):**
   ```bash
   # Allow port 3000
   sudo ufw allow 3000/tcp
   ```

6. **Note the backend IP address:**
   ```bash
   # Linux/Mac
   ip addr show
   
   # Windows
   ipconfig
   ```
   
   Example: `192.168.1.100`

## Step 2: Configure Frontend Displays

### On Each Frontend Display Device

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   nano frontend/.env
   ```

3. **Configure backend URL:**
   ```env
   # Backend server URL (replace with your backend server IP)
   VITE_BACKEND_URL=http://192.168.1.100:3000
   
   # Display configuration
   VITE_DISPLAY_TYPE=room
   VITE_NIGHT_MODE_ENABLED=true
   
   # Optional: Light configuration
   VITE_LIGHT_TYPE=hue
   VITE_HUE_BRIDGE_IP=192.168.1.100
   VITE_HUE_USERNAME=your-username
   VITE_HUE_LIGHT_IDS=1,2,3
   ```

   **Important:** Replace `192.168.1.100` with your actual backend server IP address.

4. **Build frontend:**
   ```bash
   npm run build
   ```

5. **Option A: Serve with backend (if backend serves static files):**
   - The backend already serves frontend files from `frontend/dist/`
   - Just access: `http://192.168.1.100:3000`

6. **Option B: Serve frontend separately:**
   ```bash
   # Development mode
   npm run dev
   
   # Or serve production build
   npm install -g serve
   serve -s dist -l 5173
   ```

## Step 3: Network Configuration

### Backend Server Network Setup

**Static IP Address (Recommended):**

**Linux/Raspberry Pi:**
```bash
sudo nano /etc/dhcpcd.conf
```

Add:
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

**Windows:**
1. Open Network Settings
2. Change adapter options
3. Right-click network adapter → Properties
4. Internet Protocol Version 4 (TCP/IPv4) → Properties
5. Use the following IP address: `192.168.1.100`
6. Subnet mask: `255.255.255.0`
7. Default gateway: `192.168.1.1`

### Frontend Display Network Setup

Each display device should be on the **same network** as the backend server.

**Verify connectivity:**
```bash
# From frontend display, ping backend
ping 192.168.1.100

# Test HTTP connection
curl http://192.168.1.100:3000/health
```

## Step 4: Configuration Examples

### Example 1: Backend on Raspberry Pi, Displays on Multiple Raspberry Pis

**Backend Raspberry Pi:**
```bash
# IP: 192.168.1.100
cd ~/MVFD-Phoenix
npm install
cd frontend && npm install && npm run build && cd ..
pm2 start npm --name "mvfd-backend" -- start
```

**Display Raspberry Pi #1 (Main Station):**
```bash
# frontend/.env
VITE_BACKEND_URL=http://192.168.1.100:3000
VITE_DISPLAY_TYPE=main-station
```

**Display Raspberry Pi #2 (Room Display):**
```bash
# frontend/.env
VITE_BACKEND_URL=http://192.168.1.100:3000
VITE_DISPLAY_TYPE=room
VITE_NIGHT_MODE_ENABLED=true
```

### Example 2: Backend on Windows PC, Displays on Raspberry Pis

**Recommended when the Pi is overloaded.** Full steps (firewall, auto-start, moving `alerts.db`): **[WINDOWS_SETUP.md](WINDOWS_SETUP.md)**.

**Windows PC (Backend):**
```powershell
# Install Node.js 22 LTS, then:
cd C:\OpenAlerts
npm install
cd frontend
npm install
npm run build
cd ..
npm run build
.\start-openalerts.bat
```

**Raspberry Pi Displays:**
```
# Open the kiosk at the Windows PC IP (do not run the full backend on the Pi)
http://192.168.1.50:3000
```

Keep `room-gpio-service` running on each room Pi. On the Windows `.env`:
```env
ROOM_GPIO_URLS=mens_bunk:http://192.168.68.140:4000
AMPLIFIER_GPIO_URL=http://192.168.68.141:4000
```

### Example 3: Backend on Linux Server, Displays Everywhere

**Linux Server:**
```bash
# Install Node.js, PM2
npm install
cd frontend && npm install && npm run build && cd ..
pm2 start npm --name "mvfd-backend" -- start
pm2 save
pm2 startup
```

**Any Display Device:**
```bash
# frontend/.env
VITE_BACKEND_URL=http://192.168.1.200:3000
VITE_DISPLAY_TYPE=main-station

## Step 5: Testing the Connection

### Test from Frontend Display

1. **Test HTTP connection:**
   ```bash
   curl http://192.168.1.100:3000/health
   ```
   
   Should return: `{"status":"ok","message":"OpenAlerts API is running"}`

2. **Test Socket.io connection:**
   - Open browser on display device
   - Navigate to frontend URL
   - Open browser console (F12)
   - Look for: `✅ Connected to server`

3. **Test alert propagation:**
   ```bash
   # From any device on network
   curl -X POST http://192.168.1.100:3000/api/alert \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-secret-api-key-here" \
     -d '{
       "call_type": "Structure Fire",
       "address": "123 Test St",
       "units": "Engine 1",
       "narrative": "Test alert"
     }'
   ```
   
   All connected displays should show the alert simultaneously.

## Step 6: Browser Configuration (Kiosk Mode)

### For Each Display Device

**Raspberry Pi with Desktop:**
```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

```ini
[Desktop Entry]
Type=Application
Name=MVFD Phoenix Kiosk
Exec=chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://192.168.1.100:3000
```

**Windows PC:**
1. Create shortcut to Chrome/Edge
2. Right-click → Properties
3. Target: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --autoplay-policy=no-user-gesture-required http://192.168.1.100:3000`
4. Add to Startup folder

## Step 7: Troubleshooting

### Frontend Can't Connect to Backend

1. **Check network connectivity:**
   ```bash
   ping 192.168.1.100
   ```

2. **Check backend is running:**
   ```bash
   curl http://192.168.1.100:3000/health
   ```

3. **Check firewall on backend:**
   ```bash
   # Linux
   sudo ufw status
   sudo ufw allow 3000/tcp
   
   # Windows
   # Windows Defender Firewall → Allow an app → Node.js
   ```

4. **Check backend URL in frontend:**
   - Verify `.env` file has correct `VITE_BACKEND_URL`
   - Rebuild frontend after changing `.env`: `npm run build`

5. **Check browser console:**
   - Open browser console (F12)
   - Look for connection errors
   - Should see: `🔌 Connecting to backend at: http://192.168.1.100:3000`

### Socket.io Connection Issues

1. **Check CORS configuration:**
   - Backend already allows all origins (`origin: "*"`)
   - Should work out of the box

2. **Check Socket.io transport:**
   - Frontend uses polling first, then websocket
   - Should work on most networks

3. **Check backend logs:**
   ```bash
   pm2 logs mvfd-backend
   ```

### Multiple Displays Not Receiving Alerts

1. **Verify all displays are connected:**
   - Check connection status indicator on each display
   - Should show green "Connected" status

2. **Test alert from backend:**
   ```bash
   curl -X POST http://192.168.1.100:3000/api/alert \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"call_type":"Test","address":"123 Test","units":"Test 1"}'
   ```

3. **Check backend Socket.io connections:**
   - Backend logs should show connections
   - All displays should receive the same alert

## Step 8: Production Deployment

### Backend Server (Production)

```bash
# Install PM2
sudo npm install -g pm2

# Start backend
cd ~/MVFD-Phoenix
pm2 start npm --name "mvfd-backend" -- start
pm2 save
pm2 startup

# Set up auto-start on boot
pm2 startup
# Follow instructions to enable systemd service
```

### Frontend Displays (Production)

**Option A: Backend serves frontend (Recommended)**
- Build frontend once on backend
- All displays access: `http://192.168.1.100:3000`
- No need to build on each display

**Option B: Each display serves its own frontend**
- Build frontend on each display
- Configure `.env` with backend URL
- Serve locally or use backend's static files

## Step 9: Security Considerations

### Backend Server Security

1. **Use API key authentication:**
   ```env
   API_KEY=strong-secret-key-here
   ```

2. **Restrict firewall (if needed):**
   ```bash
   # Only allow local network
   sudo ufw allow from 192.168.1.0/24 to any port 3000
   ```

3. **Use HTTPS (for production):**
   - Set up reverse proxy (nginx, Apache)
   - Use Let's Encrypt for SSL certificate
   - Update `VITE_BACKEND_URL` to use `https://`

### Network Security

- Keep backend on private network
- Don't expose backend to internet unless necessary
- Use VPN for remote access if needed

## Quick Reference

### Backend Server Commands

```bash
# Start backend
pm2 start mvfd-backend

# Stop backend
pm2 stop mvfd-backend

# View logs
pm2 logs mvfd-backend

# Restart backend
pm2 restart mvfd-backend
```

### Frontend Display Configuration

```env
# Required
VITE_BACKEND_URL=http://192.168.1.100:3000

# Optional
VITE_DISPLAY_TYPE=room
VITE_NIGHT_MODE_ENABLED=true
```

### Testing Commands

```bash
# Test backend health
curl http://192.168.1.100:3000/health

# Test alert
curl -X POST http://192.168.1.100:3000/api/alert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"call_type":"Test","address":"123 Test","units":"Test 1"}'

# Test network connectivity
ping 192.168.1.100
```

## Architecture Benefits

✅ **Centralized Management:** One backend controls all displays  
✅ **Consistent Alerts:** All displays receive alerts simultaneously  
✅ **Easy Updates:** Update backend once, affects all displays  
✅ **Scalable:** Add displays without backend changes  
✅ **Resource Efficient:** Backend handles database, displays just render  

## Support

For connection issues:
1. Verify backend is running and accessible
2. Check network connectivity (ping backend IP)
3. Verify firewall allows port 3000
4. Check browser console for errors
5. Verify `.env` file has correct `VITE_BACKEND_URL`
