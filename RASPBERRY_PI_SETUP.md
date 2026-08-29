# Raspberry Pi Setup Guide

Complete guide for Raspberry Pi **displays**, **GPIO relays**, and (optional) running the full backend on a Pi.

**If the Pi is overloaded:** run the main OpenAlerts server on a **Windows 10 PC** at the firehouse instead. Keep this Pi as a kiosk + `room-gpio-service` only. See **[WINDOWS_SETUP.md](WINDOWS_SETUP.md)**.

## Prerequisites

### Required Hardware (Basic Setup)
- Raspberry Pi 4 (recommended) or Raspberry Pi 3B+
- MicroSD card (32GB+ recommended, Class 10)
- Power supply (official Raspberry Pi power supply recommended)
- Ethernet cable or WiFi connection
- HDMI cable and monitor (for initial setup)
- USB keyboard and mouse (for initial setup)

### Optional Hardware (For Amplifier Control)
If you want to control a physical radio amplifier:

**For GPIO/Relay Amplifier Control:**
- **5V Relay Module** (~$5-10) - Single channel, optocoupler isolated
- **Jumper wires** (~$2-5) - Female-to-female wires
- **Audio cable** (~$5-10) - 3.5mm to RCA or 3.5mm to 3.5mm (to connect Pi audio output to amplifier input)
- **Amplifier** - Any amplifier with mute switch/button (you likely already have this)

**Total additional cost for amplifier control: ~$12-25**

### Audio Setup Options

**Option 1: Direct Computer Speakers (Simplest)**
- External speakers (3.5mm jack or USB) - connects directly to Raspberry Pi
- No amplifier needed
- Alert sounds and TTS play through speakers

**Option 2: Amplifier + Speakers (Recommended for Station-wide Audio)**
- Amplifier with mute switch/button
- Speakers connected to amplifier
- Audio cable from Raspberry Pi to amplifier input
- Relay module for GPIO control (optional, for automatic muting)
- Alert sounds, TTS, and radio all play through amplifier → speakers

## Step 1: Install Raspberry Pi OS

1. **Download Raspberry Pi Imager:**
   - Download from: https://www.raspberrypi.com/software/
   - Install on your computer

2. **Flash Raspberry Pi OS:**
   - Insert microSD card into your computer
   - Open Raspberry Pi Imager
   - Click "Choose OS" → Select "Raspberry Pi OS (64-bit)" (recommended) or "Raspberry Pi OS (32-bit)"
   - Click "Choose Storage" → Select your microSD card
   - Click the gear icon (⚙️) to configure:
     - Enable SSH
     - Set username and password
     - Configure WiFi (optional, if using WiFi)
     - Set locale settings
   - Click "Write" and wait for completion

3. **Boot Raspberry Pi:**
   - Insert microSD card into Raspberry Pi
   - Connect Ethernet cable (or ensure WiFi is configured)
   - Connect HDMI monitor, keyboard, and mouse
   - Power on Raspberry Pi
   - Complete initial setup wizard

## Step 2: Update System

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

## Step 3: Install Node.js

### Option A: Using NodeSource (Recommended - Latest LTS)

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Option B: Using Default Repository (Older version)

```bash
sudo apt install -y nodejs npm
node --version
npm --version
```

## Step 4: Configure Audio Output

### Audio Setup Options

You have two options for audio output:

**Option A: Direct Speakers (Simplest)**
- Connect speakers directly to Raspberry Pi 3.5mm jack or USB
- Alert sounds and TTS play through speakers
- No amplifier needed

**Option B: Amplifier + Speakers (Recommended for Station-wide Audio)**
- Connect Raspberry Pi audio output to amplifier input
- Connect speakers to amplifier output
- Alert sounds, TTS, and radio all play through amplifier → speakers
- Requires audio cable (3.5mm to RCA or 3.5mm to 3.5mm)

### Check Audio Devices

```bash
# List audio devices
aplay -l

# Test audio output
speaker-test -t wav -c 2
```

### Set Default Audio Output

**For 3.5mm Jack (Direct Speakers or Amplifier Input):**
```bash
# Set 3.5mm jack as default
sudo raspi-config
# Navigate to: Advanced Options → Audio → Force 3.5mm ('headphone') jack
```

**For Amplifier Setup:**
- Connect audio cable from Raspberry Pi 3.5mm jack to amplifier input
- Use 3.5mm to RCA cable if amplifier has RCA inputs
- Use 3.5mm to 3.5mm cable if amplifier has 3.5mm input
- Set Raspberry Pi audio to 3.5mm jack (see above)

**For USB Audio:**
```bash
# List USB audio devices
lsusb | grep -i audio

# Set USB audio as default (replace X with your device number)
sudo nano /etc/asound.conf
```

Add this content (adjust card number if needed):
```
pcm.!default {
    type hw
    card 1
}
ctl.!default {
    type hw
    card 1
}
```

**For HDMI Audio:**
```bash
sudo raspi-config
# Navigate to: Advanced Options → Audio → Force HDMI
```

### Test Audio

```bash
# Test with a sound file
aplay /usr/share/sounds/alsa/Front_Left.wav

# Or use speaker-test
speaker-test -t sine -f 1000 -l 1 -c 2
```

Press Ctrl+C to stop the test.

## Step 4.5: GPIO/Relay Amplifier Control Setup (Optional)

If you want to control a physical radio amplifier using GPIO/relay control, follow these steps:

### Hardware Needed (What to Purchase)

**Option A: Single Relay Setup (Simpler)**

**Required:**
- **5V Relay Module** (~$5-10) - Single channel, optocoupler isolated
- **Jumper wires** (~$2-5) - Female-to-female wires (usually included)
- **Audio cable** (~$5-10) - 3.5mm to RCA or 3.5mm to 3.5mm

**Total Cost: ~$12-25**

**Note:** With single relay, both radio and alerts mute/unmute together.

**Option B: Dual Relay Setup (Recommended - Independent Control)**

**Required:**
- **5V Relay Module #1** (~$5-10) - For amplifier (stays OFF, alerts always play)
- **5V Relay Module #2** (~$5-10) - For radio control (GPIO 23)
- **Jumper wires** (~$2-5) - Female-to-female wires (usually included)
- **Audio cable** (~$5-10) - 3.5mm to RCA or 3.5mm to 3.5mm

**Total Cost: ~$20-35**

**Benefits:**
- Alerts always play (amplifier relay stays OFF)
- Radio controlled independently
- Radio muted at night, alerts still play

**Already Have:**
- **Amplifier** with mute switch/button (you likely already have this)
- **Speakers** connected to amplifier (you likely already have this)
- **Physical radio** (you likely already have this)

**Optional:**
- **Breadboard** (~$3-5) - Makes wiring easier, but not required

### Where to Buy

- **Amazon:** Search "5V relay module" and "3.5mm to RCA cable"
- **eBay:** Often cheaper, but longer shipping
- **Local electronics store:** RadioShack, Micro Center, etc.
- **Online:** Adafruit, SparkFun, AliExpress

### Wiring the Relay(s)

**Option A: Single Relay Setup**

1. **Connect Relay to Raspberry Pi GPIO:**
   ```
   Relay VCC → Raspberry Pi Pin 2 (5V)
   Relay GND → Raspberry Pi Pin 6 (GND)
   Relay IN → Raspberry Pi GPIO Pin 18
   ```

2. **Connect Relay to Amplifier Mute Switch:**

**Option B: Dual Relay Setup (Recommended)**

1. **Connect Amplifier Relay (GPIO 18) - Stays OFF:**
   ```
   Relay 1 VCC → Raspberry Pi Pin 2 (5V)
   Relay 1 GND → Raspberry Pi Pin 6 (GND)
   Relay 1 IN → Raspberry Pi GPIO Pin 18
   ```
   - This relay stays OFF (unmuted) so alerts always play
   - Can be left disconnected or connected but kept OFF

2. **Connect Radio Relay (GPIO 23) - Controls Radio:**
   ```
   Relay 2 VCC → Raspberry Pi Pin 2 (5V) [shared with Relay 1]
   Relay 2 GND → Raspberry Pi Pin 6 (GND) [shared with Relay 1]
   Relay 2 IN → Raspberry Pi GPIO Pin 23
   ```

3. **Connect Radio Relay to Radio:**

   **Option 2A: Control Radio Power (Recommended)**
   ```
   Radio Power Supply + → Relay 2 COM
   Radio Power Input + → Relay 2 NO
   When relay closes → Power interrupted → Radio off
   ```

   **Option 2B: Control Radio Audio Signal**
   ```
   Radio Audio Out → Relay 2 COM
   Amplifier AUX 1 Input → Relay 2 NO
   When relay closes → Audio shorted → Radio muted
   ```

   **GPIO Pin Reference:**
   ```
   Pin 2  = 5V Power
   Pin 6  = Ground
   Pin 18 = GPIO 18 (Amplifier relay - stays OFF)
   Pin 23 = GPIO 23 (Radio relay - controls radio)
   ```

**For Single Relay Setup - Connect to Amplifier:**

   **Option A: Parallel with Mute Button (Recommended)**
   - Open amplifier case (if needed) to access mute switch terminals
   - Connect relay COM to one terminal of mute switch
   - Connect relay NO (Normally Open) to other terminal of mute switch
   - When relay closes, it shorts the switch (mutes amplifier)

   **Option B: Series with Mute Switch**
   - Break the mute switch circuit
   - Connect relay COM to one side of break
   - Connect relay NO to other side of break
   - When relay opens, circuit breaks (mutes amplifier)

### Install GPIO Library

```bash
# Navigate to project directory
cd ~/MVFD-Phoenix

# Install GPIO library for Node.js
npm install onoff

# Install TypeScript types (if using TypeScript)
npm install --save-dev @types/node
```

### Configure Backend for GPIO Control

1. **Update backend code** (`src/index.ts`) to add GPIO control:

```bash
nano src/index.ts
```

2. **Add GPIO imports and initialization** (add near the top with other imports):

**For Single Relay Setup:**
```typescript
import { Gpio } from 'onoff';

// GPIO pin for mute relay (adjust pin number as needed)
let muteRelay: Gpio | null = null;

// Initialize GPIO (only on Raspberry Pi)
if (process.platform === 'linux') {
  try {
    muteRelay = new Gpio(18, 'out'); // GPIO pin 18, output mode
    console.log('✅ GPIO amplifier control initialized on pin 18');
  } catch (error) {
    console.warn('⚠️ GPIO initialization failed:', error);
  }
}
```

**For Dual Relay Setup (Recommended):**
```typescript
import { Gpio } from 'onoff';

// Amplifier relay (GPIO 18) - stays OFF (unmuted) so alerts always play
let amplifierRelay: Gpio | null = null;

// Radio relay (GPIO 23) - controls radio muting independently
let radioRelay: Gpio | null = null;

// Initialize GPIO (only on Raspberry Pi)
if (process.platform === 'linux') {
  try {
    amplifierRelay = new Gpio(18, 'out'); // GPIO pin 18
    amplifierRelay.writeSync(0); // Start OFF (unmuted) - alerts always play
    console.log('✅ Amplifier relay initialized on GPIO 18 (stays OFF)');
    
    radioRelay = new Gpio(23, 'out'); // GPIO pin 23
    radioRelay.writeSync(0); // Start OFF (unmuted) - radio plays
    console.log('✅ Radio relay initialized on GPIO 23');
  } catch (error) {
    console.warn('⚠️ GPIO initialization failed:', error);
  }
}
```

3. **Update the amplifier mute endpoint** (find `/api/amplifier/mute` endpoint):

**For Single Relay Setup:**
```typescript
app.post('/api/amplifier/mute', validateApiKey, (req: Request, res: Response) => {
  try {
    const { mute } = req.body;
    
    if (muteRelay) {
      // GPIO control: 1 = mute (relay closed), 0 = unmute (relay open)
      muteRelay.writeSync(mute ? 1 : 0);
      console.log(`🔊 Amplifier ${mute ? 'muted' : 'unmuted'} via GPIO pin 18`);
    }
    
    res.json({ 
      success: true, 
      muted: mute,
      message: `Amplifier ${mute ? 'muted' : 'unmuted'} successfully`
    });
  } catch (error) {
    console.error('Error controlling amplifier:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

**For Dual Relay Setup (Recommended):**
```typescript
app.post('/api/amplifier/mute', validateApiKey, (req: Request, res: Response) => {
  try {
    const { mute } = req.body;
    
    // For dual relay: amplifier relay stays OFF (unmuted), radio relay controls radio
    if (radioRelay) {
      // GPIO control: 1 = mute radio (relay closed), 0 = unmute radio (relay open)
      radioRelay.writeSync(mute ? 1 : 0);
      console.log(`📻 Radio ${mute ? 'muted' : 'unmuted'} via GPIO pin 23`);
    }
    
    // Amplifier relay stays OFF (unmuted) so alerts always play
    // No need to control amplifier relay
    
    res.json({ 
      success: true, 
      muted: mute,
      message: `Radio ${mute ? 'muted' : 'unmuted'} successfully`
    });
  } catch (error) {
    console.error('Error controlling radio relay:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

### Test GPIO Relay(s)

Before integrating with the application, test the relay(s) manually:

**For Single Relay Setup:**
```bash
# Install wiringpi tools (if not already installed)
sudo apt install wiringpi

# Set GPIO pin 18 as output
gpio -g mode 18 out

# Activate relay (should mute amplifier)
gpio -g write 18 1

# Deactivate relay (should unmute amplifier)
gpio -g write 18 0
```

**For Dual Relay Setup:**
```bash
# Test Amplifier Relay (GPIO 18) - Should stay OFF
gpio -g mode 18 out
gpio -g write 18 0  # Should be OFF (unmuted) - alerts always play

# Test Radio Relay (GPIO 23) - Controls radio
gpio -g mode 23 out
gpio -g write 23 1  # Should mute radio
gpio -g write 23 0  # Should unmute radio
```

**Alternative test using Python:**

```bash
# Install RPi.GPIO library
sudo apt install python3-rpi.gpio

# Create test script
nano test_relay.py
```

Add this content:
```python
import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(18, GPIO.OUT)

# Activate relay
GPIO.output(18, GPIO.HIGH)
print("Relay ON (amplifier muted)")
time.sleep(2)

# Deactivate relay
GPIO.output(18, GPIO.LOW)
print("Relay OFF (amplifier unmuted)")

GPIO.cleanup()
```

Run test:
```bash
python3 test_relay.py
```

### Configure Frontend

Add to `frontend/.env`:

```env
VITE_AMPLIFIER_TYPE=gpio
VITE_BACKEND_URL=http://localhost:3000
```

Or if backend is on different IP:

```env
VITE_AMPLIFIER_TYPE=gpio
VITE_BACKEND_URL=http://192.168.1.100:3000
```

### Verify GPIO Permissions

```bash
# Add user to gpio group (if needed)
sudo usermod -a -G gpio $USER

# Log out and log back in for group changes to take effect
# Or reboot:
sudo reboot
```

### Troubleshooting GPIO

**Relay not activating:**
1. Check wiring connections
2. Verify GPIO pin number matches code (default is pin 18)
3. Test relay with manual GPIO commands (see above)
4. Check relay module LED (should light when activated)

**Permission errors:**
```bash
# Check if user is in gpio group
groups

# Add to gpio group if not present
sudo usermod -a -G gpio $USER
```

**GPIO pin already in use:**
- Change GPIO pin number in code (e.g., use pin 23 instead of 18)
- Check what's using the pin: `gpio readall`

**Relay activates but amplifier doesn't mute:**
- Verify relay is connected to correct mute switch terminals
- Try Option B wiring (series) instead of Option A (parallel)
- Check amplifier mute switch operation manually

### Safety Notes

- **Electrical Safety:** Ensure proper isolation between relay and amplifier
- **GPIO Voltage:** Raspberry Pi GPIO is 3.3V - use optocoupler relay module (5V relay modules with optocoupler are safe)
- **Relay Rating:** Ensure relay can handle amplifier's voltage/current
- **Fuses:** Consider adding fuses for protection
- **Power:** Disconnect amplifier power before wiring

### Next Steps

After GPIO setup is complete, continue with:
- Step 5: Install Project Dependencies
- Configure amplifier type in frontend `.env` file
- Test amplifier control by sending a test alert

For more detailed amplifier setup information, see `AMPLIFIER_SETUP.md`.

## Step 5: Install Project Dependencies

### Clone or Copy Project

**Option A: If using Git:**
```bash
cd ~
git clone <your-repo-url> MVFD-Phoenix
cd MVFD-Phoenix
```

**Option B: If copying files:**
```bash
# Use SCP, SFTP, or USB drive to copy project files
cd ~/MVFD-Phoenix
```

### Install Backend Dependencies

```bash
# Install backend dependencies
npm install
```

### Install Frontend Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install
cd ..
```

## Step 6: Configure Environment Variables

### Backend Configuration

Create `.env` file in project root:
```bash
nano .env
```

**For GPIO Amplifier Control:**
```env
# No backend env vars needed for GPIO - it's controlled via API endpoints
# GPIO is initialized automatically when backend starts on Raspberry Pi
```

Add configuration:
```env
PORT=3000
API_KEY=your-secret-api-key-here

# Optional: Discord/Slack webhooks
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Frontend Configuration

Create `.env` file in `frontend/` directory:
```bash
nano frontend/.env
```

Add configuration:
```env
# Display type: 'room' or 'main-station'
VITE_DISPLAY_TYPE=main-station

# GPIO Amplifier Control (if using GPIO/relay)
VITE_AMPLIFIER_TYPE=gpio
VITE_BACKEND_URL=http://localhost:3000

# Night mode (only for room displays)
VITE_NIGHT_MODE_ENABLED=false

# Light configuration (optional)
VITE_LIGHT_TYPE=hue
VITE_HUE_BRIDGE_IP=192.168.1.100
VITE_HUE_USERNAME=your-username
VITE_HUE_LIGHT_IDS=1,2,3
```

## Step 7: Build Frontend for Production

```bash
cd frontend
npm run build
cd ..
```

This creates optimized production files in `frontend/dist/`.

## Step 8: Set Up Backend to Serve Frontend

The backend needs to serve the frontend build files. Update your backend code or use a simple Express static server.

**Option A: Update backend to serve static files**

Edit `src/index.ts` to serve frontend build:

```typescript
import express from 'express';
import path from 'path';

const app = express();

// ... your existing routes ...

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

**Option B: Use PM2 with separate processes**

See Step 9 for PM2 setup.

## Step 9: Install PM2 (Process Manager)

PM2 keeps your application running and auto-restarts on crashes:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start backend
pm2 start npm --name "mvfd-backend" -- start

# Start frontend (if running separately)
cd frontend
pm2 start npm --name "mvfd-frontend" -- run dev
cd ..

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the instructions it prints (usually involves running a sudo command)
```

## Step 10: Configure Auto-Start on Boot

### Using PM2 (Recommended)

```bash
# Generate startup script
pm2 startup

# It will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi

# Run that command, then:
pm2 save
```

### Using systemd (Alternative)

Create systemd service file:

```bash
sudo nano /etc/systemd/system/mvfd-phoenix.service
```

Add this content (adjust paths as needed):
```ini
[Unit]
Description=MVFD Phoenix Fire Station Alert System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/MVFD-Phoenix
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mvfd-phoenix
sudo systemctl start mvfd-phoenix

# Check status
sudo systemctl status mvfd-phoenix
```

## Step 11: Configure Browser Auto-Start (Kiosk Mode)

### Install Chromium

```bash
sudo apt install -y chromium-browser
```

### Set Up Auto-Login and Kiosk Mode

**Option A: Using autostart (Desktop Environment)**

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

Add:
```ini
[Desktop Entry]
Type=Application
Name=MVFD Phoenix Kiosk
Exec=chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000
```

**Option B: Using systemd (No Desktop)**

Create service:
```bash
sudo nano /etc/systemd/system/mvfd-kiosk.service
```

Add:
```ini
[Unit]
Description=MVFD Phoenix Kiosk Browser
After=network.target mvfd-phoenix.service

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
ExecStart=/usr/bin/chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

Enable:
```bash
sudo systemctl enable mvfd-kiosk
sudo systemctl start mvfd-kiosk
```

## Step 12: Audio Configuration for Browser

### Enable Audio Autoplay

Chromium needs special flags for autoplay. Update your kiosk command:

```bash
chromium-browser \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=AudioServiceOutOfProcess \
  --use-fake-ui-for-media-stream \
  http://localhost:3000
```

### Set Default Audio Device

Ensure ALSA is configured correctly (see Step 4).

## Step 13: Network Configuration

### Static IP Address (Recommended)

```bash
sudo nano /etc/dhcpcd.conf
```

Add (adjust for your network):
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

For WiFi:
```
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

Restart networking:
```bash
sudo systemctl restart dhcpcd
```

## Step 14: Firewall Configuration

```bash
# Install UFW (if not installed)
sudo apt install -y ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP (if accessing from network)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

## Step 15: Testing

### Test Backend

```bash
# Check if backend is running
curl http://localhost:3000/health

# Send test alert
curl -X POST http://localhost:3000/api/alert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{
    "call_type": "Structure Fire",
    "address": "123 Test St",
    "units": "Engine 1",
    "narrative": "Test alert"
  }'
```

### Test Audio

1. Open browser on Raspberry Pi
2. Navigate to `http://localhost:3000`
3. Click "Start System" button
4. Send a test alert
5. Verify audio plays through speakers

### Test Frontend

```bash
# If running frontend separately
curl http://localhost:5173
```

## Step 16: Performance Optimization

### Overclock (Optional - Use with caution)

```bash
sudo raspi-config
# Navigate to: Overclock → Select appropriate option
```

### Disable Unnecessary Services

```bash
# Disable Bluetooth (if not needed)
sudo systemctl disable bluetooth

# Disable WiFi power management (if using WiFi)
sudo iwconfig wlan0 power off
```

### Increase GPU Memory Split (for video)

```bash
sudo raspi-config
# Navigate to: Advanced Options → Memory Split → Set to 128 or 256
```

## Troubleshooting

### Audio Not Working

1. **Check audio device:**
   ```bash
   aplay -l
   ```

2. **Test ALSA:**
   ```bash
   speaker-test -t wav -c 2
   ```

3. **Check browser audio:**
   - Open browser console (F12)
   - Check for audio errors
   - Verify "Start System" button was clicked

4. **Check ALSA configuration:**
   ```bash
   cat /etc/asound.conf
   ```

5. **Restart audio service:**
   ```bash
   sudo systemctl restart alsa-state
   ```

### Application Not Starting

1. **Check PM2 logs:**
   ```bash
   pm2 logs mvfd-backend
   ```

2. **Check systemd logs:**
   ```bash
   sudo journalctl -u mvfd-phoenix -f
   ```

3. **Check Node.js version:**
   ```bash
   node --version
   ```

4. **Check dependencies:**
   ```bash
   npm list --depth=0
   ```

### Browser Not Auto-Starting

1. **Check kiosk service:**
   ```bash
   sudo systemctl status mvfd-kiosk
   ```

2. **Check display:**
   ```bash
   echo $DISPLAY
   ```

3. **Test browser manually:**
   ```bash
   chromium-browser --kiosk http://localhost:3000
   ```

### Network Issues

1. **Check network connection:**
   ```bash
   ping 8.8.8.8
   ```

2. **Check IP address:**
   ```bash
   ip addr show
   ```

3. **Check firewall:**
   ```bash
   sudo ufw status
   ```

## Quick Reference Commands

```bash
# Start application
pm2 start mvfd-backend

# Stop application
pm2 stop mvfd-backend

# Restart application
pm2 restart mvfd-backend

# View logs
pm2 logs mvfd-backend

# View status
pm2 status

# Test audio
speaker-test -t sine -f 1000 -l 1

# Check audio devices
aplay -l

# Check system resources
htop

# Check disk space
df -h

# Update system
sudo apt update && sudo apt upgrade -y
```

## Security Considerations

1. **Change default password:**
   ```bash
   passwd
   ```

2. **Enable SSH key authentication:**
   ```bash
   ssh-copy-id pi@raspberrypi
   ```

3. **Disable password authentication (after setting up keys):**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication no
   sudo systemctl restart ssh
   ```

4. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

## Additional Resources

- Raspberry Pi Official Documentation: https://www.raspberrypi.com/documentation/
- Node.js on Raspberry Pi: https://nodejs.org/en/download/package-manager/
- PM2 Documentation: https://pm2.keymetrics.io/
- ALSA Audio Configuration: https://www.alsa-project.org/

## Support

For issues specific to Raspberry Pi deployment:
1. Check PM2/systemd logs
2. Verify audio configuration
3. Test network connectivity
4. Review browser console for errors
