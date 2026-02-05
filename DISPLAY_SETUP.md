# Display Setup Guide - How to Show Frontend on Each Device

## Option 1: Backend Serves Frontend (Recommended - Easiest)

**Best for:** Raspberry Pi displays, multiple devices, production setup

### Setup Steps:

1. **Build frontend once on backend server:**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Start backend server:**
   ```bash
   npm start
   # Or with PM2:
   pm2 start npm --name "mvfd-backend" -- start
   ```

3. **On each display device, open browser to:**
   ```
   http://192.168.1.100:3000
   ```
   (Replace `192.168.1.100` with your backend server IP)

4. **Set up kiosk mode** (optional, for auto-start):
   - Raspberry Pi: Create autostart script (see MULTI_DISPLAY_SETUP.md)
   - Windows: Create shortcut with kiosk flags
   - Browser will auto-open to backend URL

**Benefits:**
- ✅ Build once, use everywhere
- ✅ Easy updates (rebuild on backend, all displays update)
- ✅ No need to build on each device
- ✅ Backend handles everything

---

## Option 2: Each Device Serves Its Own Frontend

**Best for:** Development, testing, or if you prefer local serving

### Setup Steps:

**On Each Display Device (Raspberry Pi, PC, etc.):**

1. **Copy project files** to the device (or clone from repo)

2. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Build frontend:**
   ```bash
   npm run build
   ```

4. **Serve the built files:**

   **Option A: Using Vite Preview (Built-in)**
   ```bash
   npm run preview
   ```
   - Serves on `http://localhost:4173` by default
   - Good for testing

   **Option B: Using `serve` package (Simple HTTP Server)**
   ```bash
   # Install serve globally
   npm install -g serve
   
   # Serve the built files
   serve -s dist -l 3001
   ```
   - Serves on `http://localhost:3001` (or specified port)
   - Good for production

   **Option C: Using `http-server` package**
   ```bash
   # Install http-server globally
   npm install -g http-server
   
   # Serve the built files
   cd dist
   http-server -p 3001
   ```

5. **Configure frontend to connect to backend:**
   
   Create `frontend/.env` file:
   ```env
   VITE_BACKEND_URL=http://192.168.1.100:3000
   VITE_DISPLAY_TYPE=room
   VITE_NIGHT_MODE_ENABLED=true
   ```
   
   Then rebuild:
   ```bash
   npm run build
   ```

6. **Set up auto-start** (for kiosk mode):
   - Point browser to `http://localhost:4173` (or your chosen port)
   - Configure kiosk mode to auto-open this URL

**Benefits:**
- ✅ Each device is independent
- ✅ Can customize per device
- ✅ Works offline (if backend is down, at least UI loads)

---

## Option 3: Development Mode (For Testing Only)

**Only use this for development/testing, not production displays!**

```bash
cd frontend
npm run dev
```

- Runs on `http://localhost:5173`
- Hot-reloads on code changes
- **Not recommended for production displays** (uses more resources)

---

## Recommended Setup for Your Hardware

Based on your setup (6 Raspberry Pi 5s + displays):

### Backend Server (1 Raspberry Pi):
```bash
# Build frontend once
cd frontend
npm run build
cd ..

# Start backend (serves frontend automatically)
npm start
# Or with PM2:
pm2 start npm --name "mvfd-backend" -- start
pm2 save
pm2 startup
```

### Display Devices (Other Raspberry Pis):
1. **Install Chromium browser:**
   ```bash
   sudo apt install -y chromium-browser
   ```

2. **Create autostart script:**
   ```bash
   mkdir -p ~/.config/autostart
   nano ~/.config/autostart/kiosk.desktop
   ```
   
   Add:
   ```ini
   [Desktop Entry]
   Type=Application
   Name=OpenAlerts Display
   Exec=chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://192.168.1.100:3000
   ```

3. **Reboot Raspberry Pi:**
   ```bash
   sudo reboot
   ```

4. **Browser will auto-open** to backend URL on boot

---

## Quick Reference

| Method | Command | Port | Use Case |
|--------|---------|------|----------|
| Backend serves | `npm start` (backend) | 3000 | Production (recommended) |
| Vite Preview | `npm run preview` | 4173 | Testing built files |
| Serve package | `serve -s dist` | 3001 | Production local serving |
| Dev mode | `npm run dev` | 5173 | Development only |

---

## Troubleshooting

### Browser Shows Blank Page

1. **Check backend is running:**
   ```bash
   curl http://192.168.1.100:3000/health
   ```

2. **Check frontend was built:**
   ```bash
   ls frontend/dist
   # Should see index.html and assets folder
   ```

3. **Check browser console** (F12) for errors

### Frontend Can't Connect to Backend

1. **Verify backend URL** in browser console
2. **Check network connectivity:**
   ```bash
   ping 192.168.1.100
   ```
3. **Check firewall** allows port 3000

### Kiosk Mode Not Working

1. **Check autostart file** exists and is executable
2. **Verify browser path** is correct
3. **Check desktop environment** is running (not just CLI)

---

**For detailed multi-display setup, see `MULTI_DISPLAY_SETUP.md`**
