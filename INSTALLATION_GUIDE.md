# MVFD Phoenix Fire Station Alert System
## Complete Installation & Setup Guide

**Version:** 1.0  
**Date:** 2026  
**For:** Contractors & Installers

---

## Table of Contents

1. [Pre-Installation Checklist](#pre-installation-checklist)
2. [Hardware Installation](#hardware-installation)
3. [Software Installation](#software-installation)
4. [Network Configuration](#network-configuration)
5. [System Configuration](#system-configuration)
6. [Testing & Verification](#testing--verification)
7. [Final Setup & Handoff](#final-setup--handoff)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Installation Checklist

### Required Materials & Tools

**Hardware (Verify All Items Received):**
- [ ] 6x CanaKit Raspberry Pi 5 Starter Kit PRO (8GB RAM)
- [ ] 1x Amazon Fire TV 40" 2-Series
- [ ] 1x MAGEX 15.6" Touchscreen Monitor
- [ ] 2x HUABAN 1 Channel DC 5V Relay Module
- [ ] 1x SunFounder 2 Channel DC 5V Relay Module
- [ ] 1x 40pcs Female-to-Female Dupont Wire pack
- [ ] 1x Mygatti 14AWG Speaker Wire (300 FT)
- [ ] 2x Philips Hue Smart Play Light Bar Base Kit (2-Pack)
- [ ] 1x Philips Hue Discover Outdoor Smart Flood Light (2-Pack)
- [ ] 1x Philips Hue Bridge (if not already owned)

**Tools Required:**
- [ ] Phillips screwdriver set
- [ ] Wire strippers
- [ ] Wire cutters
- [ ] Electrical tape
- [ ] Cable ties/zip ties
- [ ] Drill & bits (for mounting)
- [ ] Level
- [ ] Measuring tape
- [ ] Network cable tester
- [ ] Multimeter (for testing relays)

**Software & Access:**
- [ ] Computer/laptop with internet access
- [ ] MicroSD card reader (if not included with Raspberry Pi kits)
- [ ] USB keyboard and mouse (for initial Raspberry Pi setup)
- [ ] HDMI cable (for initial Raspberry Pi setup)
- [ ] Network access to station's router/switch
- [ ] Admin access to network router (for static IP configuration)

### Site Survey

**Before Starting Installation:**

1. **Display Locations:**
   - [ ] Identify main station display location (Fire TV 40")
   - [ ] Identify room display locations (MAGEX touchscreens)
   - [ ] Verify power outlets available at each location
   - [ ] Verify network connectivity (Ethernet or WiFi) at each location
   - [ ] Measure distances for cable runs

2. **Speaker Locations:**
   - [ ] Identify room speaker locations
   - [ ] Verify power for speakers/amplifiers
   - [ ] Plan speaker wire routing paths
   - [ ] Measure speaker wire distances

3. **Relay Installation:**
   - [ ] Identify Raspberry Pi location (central location preferred)
   - [ ] Verify GPIO pin access for relay connections
   - [ ] Plan relay module mounting locations
   - [ ] Verify 5V power availability for relays

4. **Lighting Locations:**
   - [ ] Identify indoor light locations (Hue Play Light Bars)
   - [ ] Identify outdoor light locations (Hue Discover Flood Lights)
   - [ ] Verify power outlets for lights
   - [ ] Verify Hue Bridge location (needs Ethernet connection)

5. **Network Infrastructure:**
   - [ ] Verify router/switch capacity
   - [ ] Identify available network ports
   - [ ] Plan IP address scheme
   - [ ] Verify WiFi coverage (if using WiFi)

---

## Hardware Installation

### Phase 1: Display Installation

#### Step 1.1: Install Main Station Display (Fire TV)

1. **Mount Fire TV:**
   - Choose location with good visibility
   - Use TV wall mount (if provided) or place on stand
   - Ensure power outlet nearby
   - Ensure HDMI port accessible

2. **Connect Raspberry Pi 5:**
   - Connect HDMI cable from Raspberry Pi 5 to Fire TV HDMI input
   - Connect Raspberry Pi power supply
   - Connect Ethernet cable (if using wired network)
   - Power on Raspberry Pi

3. **Label Connections:**
   - Label HDMI cable: "Main Station Display"
   - Label Ethernet cable: "Main Station Pi"
   - Note which HDMI input on TV (e.g., HDMI 1)

**Checkpoint:** Fire TV displays Raspberry Pi desktop when powered on.

#### Step 1.2: Install Room Displays (MAGEX Touchscreen)

**For Each Room Display:**

1. **Mount Monitor:**
   - Use VESA mount or provided stand
   - Position for easy viewing and touch access
   - Ensure power outlet nearby
   - Ensure HDMI port accessible

2. **Connect Raspberry Pi 5:**
   - Connect HDMI cable from Raspberry Pi 5 to monitor HDMI input
   - Connect Raspberry Pi power supply
   - Connect Ethernet cable (if using wired network)
   - Power on Raspberry Pi

3. **Label Connections:**
   - Label HDMI cable: "Room Display - [Room Name]"
   - Label Ethernet cable: "Room Pi - [Room Name]"
   - Create room identification label on monitor

**Checkpoint:** Each MAGEX monitor displays Raspberry Pi desktop when powered on.

### Phase 2: Raspberry Pi Initial Setup

**For Each Raspberry Pi (Backend + All Displays):**

#### Step 2.1: Install Operating System

1. **Download Raspberry Pi OS:**
   - Go to: https://www.raspberrypi.com/software/
   - Download Raspberry Pi Imager
   - Install Raspberry Pi Imager on your computer

2. **Flash microSD Card:**
   - Insert microSD card into computer
   - Open Raspberry Pi Imager
   - Select "Raspberry Pi OS (64-bit)" with desktop
   - Select your microSD card
   - Click "Write" and wait for completion

3. **Configure Before First Boot:**
   - Click gear icon in Raspberry Pi Imager
   - Enable SSH
   - Set username: `pi` (or custom)
   - Set password: `[Secure Password]`
   - Set WiFi credentials (if using WiFi)
   - Set locale settings
   - Click "Save" and write to card

4. **Insert Card and Boot:**
   - Insert microSD card into Raspberry Pi
   - Connect keyboard, mouse, and monitor (for first boot)
   - Power on Raspberry Pi
   - Complete initial setup wizard

#### Step 2.2: Update System

```bash
# Connect via SSH or use desktop terminal
sudo apt update
sudo apt upgrade -y
sudo reboot
```

#### Step 2.3: Install Required Software

```bash
# Install Node.js (LTS version)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x or higher
npm --version   # Should show 10.x or higher

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git (if not already installed)
sudo apt install -y git
```

**Checkpoint:** All Raspberry Pis have Node.js and PM2 installed.

### Phase 3: Relay Module Installation

#### Step 3.1: Identify GPIO Pin Assignments

**System Reserved Pins:**
- GPIO 18: Amplifier relay (if used)
- GPIO 23: Radio relay (if used)

**Unit Pin Assignments (Auto-assigned):**
- GPIO 4: Engine 2
- GPIO 5: Tanker 2
- GPIO 6: Tanker 21
- GPIO 7: Squad 2
- GPIO 8: Brush 2
- GPIO 9: Response 2
- GPIO 21: Medic 21 / Ambulance 21 (shared)
- GPIO 22: Medic 22 / Ambulance 22 (shared)

#### Step 3.2: Wire Relay Modules

**For Each Room Speaker Relay:**

1. **Connect Power:**
   ```
   Relay VCC → Raspberry Pi Pin 2 (5V)
   Relay GND → Raspberry Pi Pin 6 (GND)
   ```

2. **Connect Signal:**
   ```
   Relay IN → Raspberry Pi GPIO Pin (assigned to unit)
   ```
   - Use Female-to-Female Dupont wires
   - Use different colors for easy identification
   - Label each wire with unit name

3. **Mount Relay Module:**
   - Secure relay module near Raspberry Pi
   - Use double-sided tape or screws
   - Ensure good ventilation
   - Keep wires organized with cable ties

4. **Test Relay:**
   ```bash
   # Install GPIO testing tool
   sudo apt install -y gpiod
   
   # Test relay (replace PIN with actual GPIO number)
   gpioset gpiochip0 PIN=1  # Should activate relay (LED lights)
   gpioset gpiochip0 PIN=0  # Should deactivate relay
   ```

**Checkpoint:** All relays activate/deactivate when GPIO pins are toggled.

#### Step 3.3: Connect Speakers to Relays

**For Each Room:**

1. **Identify Speaker Wiring:**
   - Determine if controlling power or audio signal
   - Most common: Control speaker power supply

2. **Wire Relay to Speaker:**
   ```
   Speaker Power Supply + → Relay COM
   Speaker Input + → Relay NO (Normally Open)
   ```
   - When relay activates (GPIO LOW), power is interrupted (speaker muted)
   - When relay deactivates (GPIO HIGH), power flows (speaker active)

3. **Run Speaker Wire:**
   - Use 14AWG speaker wire for runs
   - Keep wire runs as short as possible
   - Avoid running near power lines
   - Use cable ties to secure wire
   - Label wire ends with room name

**Checkpoint:** Speakers mute/unmute when relays are activated.

### Phase 4: Lighting Installation

#### Step 4.1: Set Up Philips Hue Bridge

1. **Connect Hue Bridge:**
   - Connect Ethernet cable from router to Hue Bridge
   - Connect power adapter to Hue Bridge
   - Wait for all LEDs to be solid (indicates ready)

2. **Find Bridge IP Address:**
   - Check router admin panel for connected devices
   - Or use Hue app to discover bridge
   - Note IP address (e.g., 192.168.1.50)

3. **Create API Username:**
   ```bash
   # Press button on Hue Bridge, then within 30 seconds:
   curl -X POST http://[BRIDGE_IP]/api \
     -H "Content-Type: application/json" \
     -d '{"devicetype":"FireStation#AlertSystem"}'
   ```
   - Copy the `username` from response
   - Save for later configuration

**Checkpoint:** Hue Bridge responds to API requests.

#### Step 4.2: Install Indoor Lights (Hue Play Light Bars)

**For Each Light Bar:**

1. **Mount Light Bar:**
   - Position behind displays or on walls
   - Use included mounting hardware
   - Ensure power outlet nearby
   - Connect power adapter

2. **Add to Hue System:**
   - Open Hue app on phone
   - Go to Settings → Lights
   - Press "Add light"
   - Follow app instructions to pair light
   - Note light ID (usually 1, 2, 3, etc.)

3. **Test Light:**
   ```bash
   # Test light control (replace USERNAME and LIGHT_ID)
   curl -X PUT http://[BRIDGE_IP]/api/[USERNAME]/lights/[LIGHT_ID]/state \
     -H "Content-Type: application/json" \
     -d '{"on":true,"bri":254,"hue":0,"sat":254}'
   ```
   - Light should turn red
   - Change hue to 46920 for blue

**Checkpoint:** All indoor lights respond to API commands.

#### Step 4.3: Install Outdoor Lights (Hue Discover Flood Lights)

**For Each Flood Light:**

1. **Mount Flood Light:**
   - Choose exterior location with good visibility
   - Use weatherproof mounting hardware
   - Ensure power outlet nearby (weatherproof outlet recommended)
   - Connect power adapter

2. **Add to Hue System:**
   - Open Hue app
   - Add light following same process as indoor lights
   - Note light ID

3. **Test Light:**
   - Use same API test as indoor lights
   - Verify weatherproofing is secure

**Checkpoint:** All outdoor lights respond to API commands.

---

## Software Installation

### Phase 5: Backend Server Setup

#### Step 5.1: Install Backend Software

**On Backend Raspberry Pi:**

1. **Clone or Copy Project:**
   ```bash
   cd ~
   git clone [PROJECT_REPO_URL]
   # OR copy project files via USB/SFTP
   cd MVFD-Phoenix
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```
   This installs the `onoff` package for GPIO relay control. **Always run `npm install` in the project root on the Pi** after clone or pull—do not copy `node_modules` from another machine. If you see "GPIO not available" or "Loaded 0 unit-to-pin mappings" at startup, run `npm install` here and add units in the Station Units admin, then restart the backend.

3. **Configure Environment:**
   ```bash
   nano .env
   ```
   
   Add configuration:
   ```env
   PORT=3000
   API_KEY=[Generate secure random key]
   NODE_ENV=production
   
   # Room Speaker Configuration
   ROOM_SPEAKERS=engine_bay:Engine 2|Tanker 2,office:Medic 21|Medic 22,dorm:Tanker 21|Squad 2,kitchen:,conference:
   
   # Optional: Discord/Slack webhooks
   DISCORD_WEBHOOK_URL=
   SLACK_WEBHOOK_URL=
   ```

4. **Build Frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

5. **Set Static IP Address:**
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
   
   Replace IP addresses with your network settings.

6. **Install PM2 (if not already installed):**
   ```bash
   sudo npm install -g pm2
   ```
   If you get `pm2: command not found` after installing, either log out and back in, or run: `sudo env PATH=$PATH npm install -g pm2` and ensure `/usr/local/bin` (or the path npm reports) is in your PATH.

7. **Start Backend Service:**

   Ensure the backend is built first (from project root):
   ```bash
   npm run build
   ```

   From the **project root** (e.g. `~/Open-Alerts` or `~/MVFD-Phoenix`), start with PM2:
   ```bash
   cd ~/Open-Alerts
   # Or: cd ~/MVFD-Phoenix  (if that's your project folder name)

   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   # Follow the printed instructions to enable the systemd service
   ```

   If you prefer not to use the config file:
   ```bash
   cd ~/Open-Alerts
   pm2 start npm --name "mvfd-backend" -- run start
   pm2 save
   pm2 startup
   ```

**Checkpoint:** Backend server responds to `http://[BACKEND_IP]:3000/health`

#### Step 5.2: Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Phase 6: Frontend Display Setup

**For Each Display Raspberry Pi:**

#### Step 6.1: Install Frontend Software

1. **Copy Project Files:**
   ```bash
   cd ~
   # Copy project files (same as backend)
   cd MVFD-Phoenix/frontend
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   nano .env
   ```
   
   **For Main Station Display:**
   ```env
   VITE_BACKEND_URL=http://192.168.1.100:3000
   VITE_DISPLAY_TYPE=main-station
   VITE_NIGHT_MODE_ENABLED=false
   ```

   **For Room Displays:**
   ```env
   VITE_BACKEND_URL=http://192.168.1.100:3000
   VITE_DISPLAY_TYPE=room
   VITE_NIGHT_MODE_ENABLED=true
   VITE_ROOM_ID=[room_name]
   VITE_ROOM_NAME=[Room Display Name]
   ```

4. **Build Frontend:**
   ```bash
   npm run build
   ```

#### Step 6.2: Set Up Kiosk Mode

1. **Install Chromium:**
   ```bash
   sudo apt install -y chromium-browser
   ```

2. **Create Autostart Script:**
   ```bash
   mkdir -p ~/.config/autostart
   nano ~/.config/autostart/kiosk.desktop
   ```
   
   Add:
   ```ini
   [Desktop Entry]
   Type=Application
   Name=MVFD Phoenix Kiosk
   Exec=chromium-browser --kiosk --autoplay-policy=no-user-gesture-required --disable-infobars http://192.168.1.100:3000
   ```

3. **Disable Screen Saver:**
   ```bash
   sudo apt install -y xscreensaver
   # Disable screensaver in desktop settings
   ```

**Checkpoint:** Display automatically opens browser in kiosk mode on boot.

---

## Network Configuration

### Phase 7: Network Setup

#### Step 7.1: Configure Static IPs

**For Each Raspberry Pi:**

1. **Set Static IP:**
   ```bash
   sudo nano /etc/dhcpcd.conf
   ```
   
   Add (adjust for each device):
   ```
   interface eth0
   static ip_address=192.168.1.101/24  # Backend: .100, Displays: .101, .102, etc.
   static routers=192.168.1.1
   static domain_name_servers=192.168.1.1 8.8.8.8
   ```

2. **Reboot:**
   ```bash
   sudo reboot
   ```

#### Step 7.2: Verify Network Connectivity

**From Each Display, Test Backend:**
```bash
ping 192.168.1.100
curl http://192.168.1.100:3000/health
```

**Checkpoint:** All devices can ping and access backend server.

---

## System Configuration

### Phase 8: Configure Station Units

1. **Access Admin Panel:**
   - Open browser: `http://192.168.1.100:3000/#station-units`
   - Login with admin password (set in backend `.env`)

2. **Add Station Units:**
   - Click "Add Unit"
   - Enter unit names:
     - Medic 22
     - Medic 21
     - Ambulance 21
     - Ambulance 22
     - Engine 2
     - Tanker 2
     - Tanker 21
     - Squad 2
     - Brush 2
     - Response 2
   - Save each unit

3. **Verify GPIO Pin Assignments:**
   - Access: `http://192.168.1.100:3000/api/unit-pins`
   - Verify pins are assigned correctly

### Phase 9: Configure Room Speakers

**For Each Room:**

1. **Access Room Speaker Admin:**
   - Open: `http://192.168.1.100:3000/#room-speaker`
   - Login with admin password

2. **Configure Room:**
   - Set Room ID (e.g., `engine_bay`)
   - Set Room Name (e.g., `Engine Bay`)
   - Select units for this room
   - Save configuration

3. **Or Configure via Main Screen:**
   - On room display, click "Select Units" button
   - Select units from popup
   - Click "Save"

### Phase 10: Configure Lighting

1. **Get Hue Light IDs:**
   ```bash
   curl http://[BRIDGE_IP]/api/[USERNAME]/lights
   ```
   - Note all light IDs

2. **Configure Frontend:**
   - On each display, configure via browser localStorage or `.env`:
   ```javascript
   localStorage.setItem('lightType', 'hue')
   localStorage.setItem('hueBridgeIP', '[BRIDGE_IP]')
   localStorage.setItem('hueUsername', '[USERNAME]')
   localStorage.setItem('hueLightIds', '1,2,3,4,5,6')  // All light IDs
   ```

---

## Testing & Verification

### Phase 11: System Testing

#### Test 1: Backend Health

```bash
curl http://192.168.1.100:3000/health
```
**Expected:** `{"status":"ok","message":"OpenAlerts API is running"}`

#### Test 2: Socket.io Connection

1. Open browser on any display
2. Open browser console (F12)
3. Look for: `✅ Connected to server`

#### Test 3: Relay Control

```bash
# Test each relay
curl -X POST http://192.168.1.100:3000/api/unit-speaker/mute \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: [TOKEN]" \
  -d '{"units":["Engine 2"],"mute":false}'
```
**Expected:** Speaker unmutes for Engine 2

#### Test 4: Alert Propagation

```bash
curl -X POST http://192.168.1.100:3000/api/alert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: [API_KEY]" \
  -d '{
    "call_type": "Structure Fire",
    "address": "123 Test St",
    "units": "Engine 2",
    "narrative": "Test alert"
  }'
```
**Expected:** 
- Alert appears on all displays
- Lights flash red
- Sound plays
- Room speakers activate for matching units

#### Test 5: Station Alert

```bash
curl -X POST http://192.168.1.100:3000/api/alert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: [API_KEY]" \
  -d '{
    "call_type": "Station Alert",
    "address": "Station",
    "units": "Station",
    "narrative": "Test station alert"
  }'
```
**Expected:** Alert plays in ALL rooms (all speakers activate)

#### Test 6: Quiet Mode

1. On room display, click "Quiet Mode" button
2. Send test alert
3. **Expected:** Alert shows on screen but no audio plays
4. Disable quiet mode
5. **Expected:** Audio plays normally

#### Test 7: Unit Selection

1. On room display, click "Select Units"
2. Select specific units (e.g., Engine 2, Tanker 2)
3. Save
4. Send alert with Engine 2
5. **Expected:** Alert plays in this room
6. Send alert with Medic 21
7. **Expected:** Alert does NOT play in this room

---

## Final Setup & Handoff

### Phase 12: Documentation & Training

1. **Create System Documentation:**
   - Document all IP addresses
   - Document all GPIO pin assignments
   - Document room configurations
   - Document admin passwords (store securely)

2. **Create Quick Reference Card:**
   - Backend IP: `192.168.1.100`
   - Admin URL: `http://192.168.1.100:3000/#station-units`
   - API Key: `[Store securely]`
   - Admin Password: `[Store securely]`

3. **Train Station Personnel:**
   - How to access admin panels
   - How to configure room units
   - How to enable/disable quiet mode
   - How to test system
   - How to restart services

4. **Provide Maintenance Information:**
   - How to restart backend: `pm2 restart mvfd-backend`
   - How to view logs: `pm2 logs mvfd-backend`
   - How to update software
   - Contact information for support

### Phase 13: Final Checklist

- [ ] All displays show dashboard correctly
- [ ] All displays connect to backend
- [ ] Alerts appear on all displays simultaneously
- [ ] Room speakers activate for assigned units
- [ ] Station alerts play in all rooms
- [ ] Quiet mode works on all room displays
- [ ] Unit selection works on all room displays
- [ ] Lights flash correctly (red for fire, blue for EMS)
- [ ] Sound alerts play correctly
- [ ] All relays respond to GPIO commands
- [ ] Network connectivity verified
- [ ] Static IPs configured
- [ ] Firewall rules configured
- [ ] Kiosk mode enabled on all displays
- [ ] Auto-start configured on all Raspberry Pis
- [ ] Documentation completed
- [ ] Personnel trained

---

## Troubleshooting

### Common Issues

#### "pm2: command not found"

**Solutions:**
1. Install PM2 globally: `sudo npm install -g pm2`
2. If it still doesn't work, open a **new terminal** or log out and back in (PATH may not include npm global bin).
3. Find where npm installs globals: `npm config get prefix` (often `/usr/local`). Ensure that path/bin (e.g. `/usr/local/bin`) is in your PATH.
4. As a workaround you can run: `npx pm2 start ecosystem.config.cjs` (from project root; npx uses the local or global pm2).

#### Display Not Showing Dashboard

**Symptoms:** Blank screen or error message

**Solutions:**
1. Check backend is running: `curl http://192.168.1.100:3000/health`
2. Check network connectivity: `ping 192.168.1.100`
3. Check browser console for errors (F12)
4. Verify `.env` file has correct `VITE_BACKEND_URL`
5. Rebuild frontend: `npm run build`

#### Room Speakers Not Activating

**Symptoms:** Alerts play but room speakers don't activate

**Solutions:**
1. Check relay wiring (VCC, GND, IN connections)
2. Test relay manually: `gpioset gpiochip0 PIN=0`
3. Check GPIO pin assignment: `curl http://192.168.1.100:3000/api/unit-pins`
4. Verify room unit configuration
5. Check relay LED (should light when activated)

#### Lights Not Flashing

**Symptoms:** Alerts play but lights don't flash

**Solutions:**
1. Check Hue Bridge connection (Ethernet)
2. Verify Hue Bridge IP address
3. Test Hue API: `curl http://[BRIDGE_IP]/api/[USERNAME]/lights`
4. Verify light IDs in configuration
5. Check browser console for Hue API errors

#### Alerts Not Appearing on All Displays

**Symptoms:** Alert appears on some displays but not others

**Solutions:**
1. Check Socket.io connection on each display (browser console)
2. Verify all displays have correct `VITE_BACKEND_URL`
3. Check backend logs: `pm2 logs mvfd-backend`
4. Verify network connectivity from each display
5. Check firewall rules allow port 3000

#### Raspberry Pi Won't Boot

**Symptoms:** No display, no network activity

**Solutions:**
1. Check power supply (use official Raspberry Pi power supply)
2. Check microSD card (try re-flashing)
3. Check HDMI connection
4. Try different microSD card
5. Check for physical damage

### Getting Help

**Logs to Collect:**
```bash
# Backend logs
pm2 logs mvfd-backend --lines 100

# System logs
journalctl -u pm2-mvfd-backend -n 100

# Network status
ip addr show
ping 192.168.1.100
```

**Information to Provide:**
- Error messages from browser console
- Backend log output
- Network configuration
- GPIO pin assignments
- Room configurations

---

## Appendix

### GPIO Pin Reference

**Physical Pin Layout (40-pin header):**
```
    3.3V  [1]  [2]  5V
   GPIO2  [3]  [4]  5V
   GPIO3  [5]  [6]  GND
   GPIO4  [7]  [8]  GPIO14
    GND  [9] [10]  GPIO15
  GPIO17 [11] [12] GPIO18  ← Amplifier
  GPIO27 [13] [14] GND
  GPIO22 [15] [16] GPIO23  ← Radio
    3.3V [17] [18] GPIO24
  GPIO10 [19] [20] GND
   GPIO9 [21] [22] GPIO25
  GPIO11 [23] [24] GPIO8
    GND [25] [26] GPIO7
   GPIO0 [27] [28] GPIO1
   GPIO5 [29] [30] GND
   GPIO6 [31] [32] GPIO12
  GPIO13 [33] [34] GND
  GPIO19 [35] [36] GPIO16
  GPIO26 [37] [38] GPIO20
    GND [39] [40] GPIO21
```

### Network Configuration Reference

**Default IP Scheme:**
- Backend Server: `192.168.1.100`
- Display 1 (Main Station): `192.168.1.101`
- Display 2 (Room 1): `192.168.1.102`
- Display 3 (Room 2): `192.168.1.103`
- Hue Bridge: `192.168.1.50` (or DHCP assigned)

**Ports Used:**
- `3000`: Backend HTTP/Socket.io server
- `80`: Hue Bridge HTTP API (if configured)

### Quick Command Reference

```bash
# Backend management
pm2 start mvfd-backend
pm2 stop mvfd-backend
pm2 restart mvfd-backend
pm2 logs mvfd-backend

# Test backend
curl http://192.168.1.100:3000/health

# Test alert
curl -X POST http://192.168.1.100:3000/api/alert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: [KEY]" \
  -d '{"call_type":"Test","address":"123 Test","units":"Engine 2"}'

# Test GPIO
gpioset gpiochip0 PIN=0  # Activate relay
gpioset gpiochip0 PIN=1  # Deactivate relay

# Test Hue
curl http://[BRIDGE_IP]/api/[USERNAME]/lights
```

---

**End of Installation Guide**

For additional support, refer to:
- `ROOM_SPEAKER_SETUP.md` - Room speaker configuration details
- `MULTI_DISPLAY_SETUP.md` - Multi-display architecture details
- `HARDWARE_SETUP.md` - Hardware setup details
- `PRODUCT_INVENTORY.md` - Complete product list
