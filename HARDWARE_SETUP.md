# Hardware Setup Guide: Speakers & Lights

This guide explains how to add external speakers and physical lights to your fire station alert system.

## Table of Contents
1. [Speakers Setup](#speakers-setup)
2. [Lights Setup](#lights-setup)
   - [Option 1: USB Serial LED Controller (Arduino)](#option-1-usb-serial-led-controller-arduino)
   - [Option 2: Philips Hue Smart Lights](#option-2-philips-hue-smart-lights)
   - [Option 3: HTTP-based Light Controller](#option-3-http-based-light-controller)
   - [Option 4: Commercial Alert Lighting Systems](#option-4-commercial-alert-lighting-systems)
3. [Display Configuration](#display-configuration)
   - [Room Displays vs Main Station Displays](#room-displays-vs-main-station-displays)
   - [Night Mode for Room Displays](#night-mode-for-room-displays)
4. [Nighttime Mode](#nighttime-mode)
5. [Configuration](#configuration)
6. [Testing](#testing)

---

## Speakers Setup

### Option 1: Computer Speakers/Amplifier (Recommended)

**Hardware Needed:**
- External speakers (powered speakers or passive speakers with amplifier)
- Audio cable (3.5mm jack or USB audio interface)
- **Speaker Wire (Optional):** Mygatti 14AWG Speaker Wire (300 FT, 14/2 Gauge)
  - For longer speaker runs or connecting multiple speakers
  - Price: ~$45.99 for 300 feet
  - Includes polarity markers for correct wiring

**Setup Steps:**

1. **Connect Speakers:**
   - Connect speakers to your computer's audio output (headphone jack or USB audio interface)
   - For louder volume, use powered speakers or connect to an amplifier
   - Position speakers strategically throughout the station for maximum coverage

2. **Windows Audio Settings:**
   - Right-click the speaker icon in the system tray
   - Select "Open Sound settings"
   - Set your external speakers as the default playback device
   - Click "Device properties" → "Additional device properties"
   - Go to "Levels" tab and set volume to 100%
   - Go to "Enhancements" tab and disable any audio enhancements that might reduce volume

3. **Browser Audio Settings:**
   - The system automatically sets audio to maximum volume
   - Ensure browser autoplay is enabled (click "Start System" button on dashboard)
   - Check browser volume settings (some browsers have separate volume controls)

4. **Testing:**
   - Send a test alert and verify audio plays through external speakers
   - Adjust speaker placement and volume as needed

### Option 2: Bluetooth Speakers

**Setup Steps:**

1. Pair Bluetooth speakers with your Windows computer
2. Set Bluetooth speakers as default audio output in Windows Sound settings
3. Ensure speakers stay connected (some Bluetooth devices disconnect after inactivity)

**Note:** Bluetooth may introduce slight audio delay. For critical alerts, wired speakers are recommended.

---

## Lights Setup

The system supports three types of light controllers. Choose the option that best fits your hardware.

### Option 1: USB Serial LED Controller (Arduino)

**Best for:** Custom LED setups, DIY projects, cost-effective solutions

**Hardware Needed:**
- Arduino board (Uno, Nano, or similar)
- RGB LED strip or individual RGB LEDs
- USB cable to connect Arduino to computer
- Appropriate resistors and wiring (varies by LED type)

**Arduino Code:**

Upload this code to your Arduino:

```cpp
// Fire Station Alert Light Controller
// Receives commands via Serial (9600 baud)

String command = "";
bool flashing = false;
unsigned long lastFlash = 0;
int flashInterval = 500; // milliseconds
String currentColor = "off";

void setup() {
  Serial.begin(9600);
  
  // Configure pins for RGB LED (adjust pin numbers for your setup)
  // Example: Common anode RGB LED on pins 9, 10, 11
  pinMode(9, OUTPUT);  // Red
  pinMode(10, OUTPUT); // Green
  pinMode(11, OUTPUT); // Blue
  
  // Turn off LED initially
  setColor("off");
  
  Serial.println("Light controller ready");
}

void loop() {
  // Read serial commands
  if (Serial.available() > 0) {
    command = Serial.readStringUntil('\n');
    command.trim();
    processCommand(command);
  }
  
  // Handle flashing
  if (flashing && (millis() - lastFlash >= flashInterval)) {
    toggleFlash();
    lastFlash = millis();
  }
}

void processCommand(String cmd) {
  if (cmd.startsWith("COLOR:")) {
    String color = cmd.substring(6);
    setColor(color);
    flashing = false;
  } else if (cmd.startsWith("FLASH:")) {
    // Format: FLASH:red:500
    int colon1 = cmd.indexOf(':', 6);
    int colon2 = cmd.indexOf(':', colon1 + 1);
    
    if (colon1 > 0 && colon2 > 0) {
      String color = cmd.substring(colon1 + 1, colon2);
      flashInterval = cmd.substring(colon2 + 1).toInt();
      setColor(color);
      flashing = true;
      lastFlash = millis();
    }
  } else if (cmd == "STOP" || cmd == "COLOR:off") {
    setColor("off");
    flashing = false;
  }
}

void setColor(String color) {
  currentColor = color;
  
  // Adjust these values based on your LED type (common anode vs common cathode)
  // This example assumes common cathode RGB LED
  if (color == "red") {
    analogWrite(9, 255);   // Red ON
    analogWrite(10, 0);    // Green OFF
    analogWrite(11, 0);    // Blue OFF
  } else if (color == "blue") {
    analogWrite(9, 0);     // Red OFF
    analogWrite(10, 0);    // Green OFF
    analogWrite(11, 255);  // Blue ON
  } else if (color == "white") {
    analogWrite(9, 255);   // Red ON
    analogWrite(10, 255);  // Green ON
    analogWrite(11, 255);  // Blue ON
  } else {
    // Off
    analogWrite(9, 0);
    analogWrite(10, 0);
    analogWrite(11, 0);
  }
}

void toggleFlash() {
  if (currentColor == "off") {
    // Turn on
    if (currentColor == "red") {
      setColor("red");
    } else if (currentColor == "blue") {
      setColor("blue");
    }
  } else {
    // Turn off
    setColor("off");
  }
}
```

**Configuration:**

1. Upload the Arduino code to your board
2. Connect Arduino to computer via USB
3. Note the COM port (Windows Device Manager → Ports)
4. In the browser, when prompted, select the Arduino's COM port
5. Or configure via environment variable:
   ```env
   VITE_LIGHT_TYPE=serial
   ```

**Note:** Web Serial API requires user interaction (clicking a button) to select the port. The system will prompt you on first use.

---

### Option 2: Philips Hue Smart Lights

**Best for:** Easy setup, wireless, no wiring required

**Hardware Needed:**
- Philips Hue Bridge (required)
- Philips Hue color bulbs or light strips
- Network connection (Hue Bridge must be on same network as computer)

**Setup Steps:**

1. **Set up Hue Bridge:**
   - Connect Hue Bridge to your network via Ethernet
   - Power on the bridge and wait for all LEDs to be solid
   - Note the bridge IP address (check router admin panel or use Hue app)

2. **Create API Username:**
   - Press the button on the Hue Bridge
   - Within 30 seconds, run this command (replace `BRIDGE_IP` with your bridge IP):
   ```powershell
   # PowerShell
   Invoke-WebRequest -Uri "http://BRIDGE_IP/api" -Method POST -Body '{"devicetype":"FireStation#AlertSystem"}' -ContentType "application/json"
   ```
   ```bash
   # Bash/Linux/Mac
   curl -X POST http://BRIDGE_IP/api -d '{"devicetype":"FireStation#AlertSystem"}'
   ```
   - Copy the `username` from the response (looks like: `abc123def456...`)

3. **Find Light IDs:**
   ```powershell
   # PowerShell
   (Invoke-WebRequest -Uri "http://BRIDGE_IP/api/USERNAME/lights" -UseBasicParsing).Content
   ```
   ```bash
   # Bash/Linux/Mac
   curl http://BRIDGE_IP/api/USERNAME/lights
   ```
   - Note the light IDs (usually 1, 2, 3, etc.)

4. **Configuration:**

   Create `.env` file in `frontend/` directory:
   ```env
   VITE_LIGHT_TYPE=hue
   VITE_HUE_BRIDGE_IP=192.168.1.XXX
   VITE_HUE_USERNAME=your-username-here
   VITE_HUE_LIGHT_IDS=1,2,3
   ```

   Or configure via browser localStorage (see Configuration section below).

**Testing:**
- Send a test alert and verify lights flash red (fire) or blue (EMS)
- Lights will automatically turn off when alert is dismissed

**Product Setup:**

**Indoor Lights - Philips Hue Play Light Bar:**
- **Product:** Philips Hue Smart Play Light Bar Base Kit (2-Pack, Black)
- **Price:** ~$138.88 per 2-pack (~$69.44 per light)
- **Quantity:** 2 packs = 4 lights total
- **Use Case:** Indoor alert lighting for rooms, offices, display areas
- **Features:** White & Color Ambiance LED, works with Alexa/Google/HomeKit
- **Installation:** Place behind displays or on walls for ambient alert lighting

**Outdoor Lights - Philips Hue Discover Flood Light:**
- **Product:** Philips Hue Discover Outdoor Smart Flood Light Fixture (2-Pack, Black)
- **Price:** ~$395.99 per 2-pack (~$198.00 per light)
- **Quantity:** 1 pack = 2 lights
- **Use Case:** Outdoor/exterior alert lighting for station building
- **Features:** 15W White and Color Ambiance LED, weatherproof, IP65 rated
- **Installation:** Mount on building exterior for visible outdoor alerts

**Both light types:**
- Require Philips Hue Bridge (sold separately, ~$50-60)
- Support full color spectrum (red for fire, blue for EMS)
- Controlled via Hue API from the alert system
- Can be grouped and controlled individually or together

---

### Option 3: HTTP-based Light Controller

**Best for:** Custom HTTP APIs, home automation systems, ESP8266/ESP32 projects

**Hardware Needed:**
- Any device that accepts HTTP POST requests to control lights
- Examples: ESP8266 with HTTP server, Home Assistant, OpenHAB, etc.

**HTTP API Requirements:**

Your light controller must accept POST requests to these endpoints:

1. **`/status`** (GET) - Health check
   - Returns: `200 OK` if available

2. **`/set-color`** (POST) - Set solid color
   - Body: `{"color": "red"|"blue"|"white"|"off", "alertType": "fire"|"ems"|"none"}`
   - Returns: `200 OK` on success

3. **`/flash`** (POST) - Start flashing
   - Body: `{"color": "red"|"blue", "alertType": "fire"|"ems", "duration": 30000}`
   - Returns: `200 OK` on success

4. **`/stop`** (POST) - Stop flashing/turn off
   - Body: `{}`
   - Returns: `200 OK` on success

**Example ESP8266 Code:**

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

ESP8266WebServer server(80);

void setup() {
  Serial.begin(115200);
  
  // Configure WiFi
  WiFi.begin("YOUR_SSID", "YOUR_PASSWORD");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.println("IP address: " + WiFi.localIP().toString());
  
  // Configure LED pins
  pinMode(5, OUTPUT);  // Red
  pinMode(4, OUTPUT);   // Green
  pinMode(0, OUTPUT);   // Blue
  
  // Setup HTTP endpoints
  server.on("/status", handleStatus);
  server.on("/set-color", handleSetColor);
  server.on("/flash", handleFlash);
  server.on("/stop", handleStop);
  
  server.begin();
}

void loop() {
  server.handleClient();
}

void handleStatus() {
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

void handleSetColor() {
  String body = server.arg("plain");
  // Parse JSON and set color
  // Implementation depends on your JSON library
  server.send(200, "application/json", "{\"success\":true}");
}

void handleFlash() {
  // Start flashing
  server.send(200, "application/json", "{\"success\":true}");
}

void handleStop() {
  // Stop flashing
  digitalWrite(5, LOW);
  digitalWrite(4, LOW);
  digitalWrite(0, LOW);
  server.send(200, "application/json", "{\"success\":true}");
}
```

**Configuration:**

Create `.env` file in `frontend/` directory:
```env
VITE_LIGHT_TYPE=http
VITE_LIGHT_HTTP_URL=http://192.168.1.XXX:80
VITE_LIGHT_HTTP_API_KEY=optional-api-key-if-needed
```

---

## Option 4: Commercial Alert Lighting Systems

### Connecting Commercial Alert Lighting Systems

Many commercial alert lighting systems from Amazon or fire equipment suppliers can be integrated. See `LIGHT_CONTROLLER_INTEGRATION.md` for detailed integration guide.

**Quick Steps:**

1. **Identify your device type:**
   - USB Serial controlled → Use `VITE_LIGHT_TYPE=serial`
   - HTTP API controlled → Use `VITE_LIGHT_TYPE=http`
   - Other protocol → May need bridge service (see integration guide)

2. **For USB Serial devices:**
   ```env
   VITE_LIGHT_TYPE=serial
   ```
   - Connect device via USB
   - Browser will prompt to select port
   - Device must accept: `COLOR:red`, `COLOR:blue`, `FLASH:red:500`, etc.

3. **For HTTP API devices:**
   ```env
   VITE_LIGHT_TYPE=http
   VITE_LIGHT_HTTP_URL=http://192.168.1.XXX:PORT
   ```
   - Device must have HTTP endpoints for color/flash control
   - See `LIGHT_CONTROLLER_INTEGRATION.md` for API requirements

4. **For other protocols:**
   - Create a bridge service to translate protocols
   - See `LIGHT_CONTROLLER_INTEGRATION.md` for examples

**Need Help?**
- Check product documentation for API/control interface
- Share product details (manufacturer, model, connection method)
- See `LIGHT_CONTROLLER_INTEGRATION.md` for detailed integration guide

---

## Display Configuration

### Room Displays vs Main Station Displays

The system supports two types of displays with different behaviors:

**Room Displays:**
- Light duration: **2 minutes** (120 seconds)
- Night mode: Can be enabled to dim dashboard during nighttime
- Use case: Individual rooms, sleeping quarters, offices

**Main Station Displays:**
- Light duration: **5 minutes** (300 seconds)
- Night mode: Disabled (always full brightness)
- Use case: Main station area, dispatch center, common areas

### Night Mode for Room Displays

Room displays can be configured with **night mode** to reduce brightness during nighttime hours (20:30 to 06:30).

**How it works:**
- **During nighttime (20:30 - 06:30):** Dashboard dims to 20% brightness
- **When alert arrives:** Dashboard automatically brightens to 100% brightness
- **After alert dismisses:** Dashboard dims back to 20% if still nighttime
- **During daytime:** Dashboard remains at full brightness

**Benefits:**
- Reduces light pollution in sleeping areas
- Less disruptive to sleeping personnel
- Automatically brightens when alerts arrive
- Smooth transitions (2-second fade)

**Configuration:**

Create `.env` file in `frontend/` directory:
```env
# For room displays
VITE_DISPLAY_TYPE=room
VITE_NIGHT_MODE_ENABLED=true

# For main station displays
VITE_DISPLAY_TYPE=main-station
# Night mode is automatically disabled for main station displays
```

Or configure via browser localStorage:
```javascript
// For room displays with night mode
localStorage.setItem('displayType', 'room')
localStorage.setItem('nightModeEnabled', 'true')

// For main station displays
localStorage.setItem('displayType', 'main-station')

// Then reload the page
location.reload()
```

---

## Nighttime Mode

### Automatic Gradual Fade-In (20:30 - 06:30)

To avoid startling sleeping personnel, the system automatically uses a **gradual fade-in** for lights during nighttime hours (20:30 to 06:30).

**How it works:**
- **Nighttime (20:30 - 06:30):** Lights fade in from 0% to 100% brightness over 5 seconds, then remain solid (not flashing)
- **Daytime (06:30 - 20:30):** Lights flash immediately as normal

**Benefits:**
- Prevents sudden bright flashes that could wake sleeping firefighters
- Provides gentle visual alert that gradually increases in intensity
- Lights remain solid (not flashing) during nighttime to avoid disturbance
- Automatic - no configuration needed

**Technical Details:**
- Fade duration: 5 seconds (5000ms)
- Brightness steps: 20 increments for smooth transition
- Time range: 20:30 (8:30 PM) to 06:30 (6:30 AM)
- Works with all light controller types (Serial, HTTP, Philips Hue)

**Note:** The system automatically detects nighttime based on the computer's system clock. Ensure your computer's time is set correctly.

---

## Configuration

### Method 1: Environment Variables (Recommended)

Create a `.env` file in the `frontend/` directory:

**For Philips Hue:**
```env
VITE_LIGHT_TYPE=hue
VITE_HUE_BRIDGE_IP=192.168.1.100
VITE_HUE_USERNAME=abc123def456...
VITE_HUE_LIGHT_IDS=1,2,3
```

**For HTTP Controller:**
```env
VITE_LIGHT_TYPE=http
VITE_LIGHT_HTTP_URL=http://192.168.1.100:8080
VITE_LIGHT_HTTP_API_KEY=your-api-key
```

**For Serial (Arduino):**
```env
VITE_LIGHT_TYPE=serial
```

After creating `.env`, restart the frontend dev server.

### Method 2: Browser localStorage

You can also configure lights via browser console:

```javascript
// For Philips Hue
localStorage.setItem('lightType', 'hue')
localStorage.setItem('hueBridgeIp', '192.168.1.100')
localStorage.setItem('hueUsername', 'abc123def456...')
localStorage.setItem('hueLightIds', '1,2,3')

// For HTTP Controller
localStorage.setItem('lightType', 'http')
localStorage.setItem('lightHttpUrl', 'http://192.168.1.100:8080')
localStorage.setItem('lightHttpApiKey', 'your-api-key')

// For Serial
localStorage.setItem('lightType', 'serial')

// Then reload the page
location.reload()
```

---

## Testing

### Test Speakers

1. Ensure speakers are connected and set as default audio device
2. Open the dashboard and click "Start System" (if prompted)
3. Send a test alert:
   ```powershell
   # PowerShell
   Invoke-WebRequest -Uri http://localhost:3000/api/alert -Method POST -Body '{"call_type":"Structure Fire","address":"123 Test St","units":"Engine 1"}' -ContentType "application/json"
   ```
4. Verify:
   - Beep sounds play through speakers
   - TTS announcement plays through speakers
   - Volume is audible throughout the station

### Test Lights

1. Ensure lights are configured (see Configuration section)
2. Send a test fire alert:
   ```powershell
   Invoke-WebRequest -Uri http://localhost:3000/api/alert -Method POST -Body '{"call_type":"Structure Fire","address":"123 Test St","units":"Engine 1"}' -ContentType "application/json"
   ```
3. Verify:
   - **Daytime (06:30 - 20:30):** Lights flash RED for fire alerts, BLUE for EMS alerts
   - **Nighttime (20:30 - 06:30):** Lights fade in from 0% to 100% over 5 seconds, then remain solid
   - Lights turn off when alert is dismissed

### Test EMS Alert

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/alert -Method POST -Body '{"call_type":"Medical Emergency","address":"456 Test Ave","units":"Ambulance 1"}' -ContentType "application/json"
```

Verify lights flash BLUE (daytime) or fade in BLUE (nighttime).

### Test Nighttime Mode

To test nighttime fade-in behavior:
1. Change your computer's system time to between 20:30 and 06:30
2. Send a test alert
3. Verify lights gradually fade in over 5 seconds (not instant flash)
4. Verify lights remain solid (not flashing) after fade-in completes
5. Reset system time when done testing

### Test Display Configuration

**Test Room Display (2-minute lights):**
1. Configure display as room:
   ```javascript
   localStorage.setItem('displayType', 'room')
   location.reload()
   ```
2. Send a test alert
3. Verify lights stay on for 2 minutes (not 5 minutes)
4. Verify alert auto-dismisses after 2 minutes

**Test Main Station Display (5-minute lights):**
1. Configure display as main station:
   ```javascript
   localStorage.setItem('displayType', 'main-station')
   location.reload()
   ```
2. Send a test alert
3. Verify lights stay on for 5 minutes
4. Verify alert auto-dismisses after 5 minutes

**Test Room Display Night Mode:**
1. Configure room display with night mode:
   ```javascript
   localStorage.setItem('displayType', 'room')
   localStorage.setItem('nightModeEnabled', 'true')
   location.reload()
   ```
2. Set system time to nighttime (20:30 - 06:30)
3. Verify dashboard dims to 20% brightness
4. Send a test alert
5. Verify dashboard brightens to 100% when alert arrives
6. Dismiss alert
7. Verify dashboard dims back to 20% after 2 seconds
8. Reset system time when done testing

---

## Troubleshooting

### Speakers Not Working

1. **Check Windows audio settings:**
   - Right-click speaker icon → Sound settings
   - Verify correct device is selected
   - Check volume levels

2. **Check browser permissions:**
   - Ensure autoplay is enabled
   - Click "Start System" button on dashboard
   - Check browser console for audio errors

3. **Check audio cable connections:**
   - Verify speakers are powered on
   - Check cable connections
   - Try different audio output port

### Lights Not Working

1. **Check configuration:**
   - Verify `.env` file exists and is correct
   - Check browser console for errors
   - Ensure lights are initialized (check console logs)

2. **For Serial (Arduino):**
   - Verify Arduino is connected via USB
   - Check COM port in Device Manager
   - Ensure Arduino code is uploaded correctly
   - Browser will prompt to select port on first use

3. **For Philips Hue:**
   - Verify bridge IP address is correct
   - Ensure bridge and computer are on same network
   - Check username is valid (press bridge button and recreate if needed)
   - Verify light IDs are correct

4. **For HTTP Controller:**
   - Verify controller URL is accessible from browser
   - Test endpoints manually with curl/Postman
   - Check controller logs for errors
   - Verify CORS is enabled if needed

### Lights Flash But Don't Stop

- Lights automatically stop when alert is dismissed
- If lights stay on, check browser console for errors
- Manually stop via browser console: `localStorage.clear()` then reload

---

## Safety Notes

- **Electrical Safety:** When wiring LEDs, ensure proper voltage/current ratings and use appropriate resistors
- **Fire Safety:** Use UL-listed LED strips and proper enclosures for fire station environments
- **Network Security:** If using network-connected lights, ensure proper firewall rules
- **Backup:** System will continue to function even if lights fail - lights are optional enhancement

---

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify hardware connections
3. Test individual components (speakers/lights) separately
4. Review configuration settings

The alert system will continue to function normally even if speakers or lights are not configured - these are optional enhancements.
