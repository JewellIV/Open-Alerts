# RGB LED Ring Integration Guide

Guide for adding RGB LED rings to ceiling speakers for visual alert indication.

## Hardware Needed

### Required Components

1. **RGB LED Ring** (Recommended: WS2812B/NeoPixel)
   - **16-LED Ring:** ~$8-12 (good for single speaker)
   - **24-LED Ring:** ~$12-18 (better visibility)
   - **32-LED Ring:** ~$18-25 (maximum visibility)
   - **60-LED Ring:** ~$25-35 (very bright, large coverage)
   - Common brands: Adafruit NeoPixel, BTF-Lighting, Gikfun

2. **Power Supply**
   - 5V power supply (2A minimum for 16 LEDs, 5A for 60 LEDs)
   - USB power bank (portable option)
   - Or use Raspberry Pi 5V pin (limited current, max ~16 LEDs)

3. **Wiring**
   - Jumper wires (Dupont wires)
   - Optional: Level shifter (3.3V to 5V) for data line

4. **Mounting**
   - Double-sided tape or mounting ring
   - Mount around speaker grille or behind it

### Recommended Products

**WS2812B RGB LED Ring Options:**
- **16-LED Ring:** Perfect for single speaker, low power
- **24-LED Ring:** Good balance of visibility and power
- **32-LED Ring:** Excellent visibility, still manageable power
- **60-LED Ring:** Maximum visibility, requires external power

**Power Supply Options:**
- 5V 2A USB power adapter (for 16-24 LEDs)
- 5V 5A power supply (for 32-60 LEDs)
- Raspberry Pi 5V pin (only for 16 LEDs max, not recommended)

---

## Wiring Setup

### Option 1: Direct GPIO Control (Raspberry Pi)

**Wiring Diagram:**
```
Raspberry Pi          LED Ring
-----------          ---------
GPIO 18 (PWM)   →    DIN (Data In)
5V              →    VCC (Power)
GND             →    GND (Ground)
```

**Important Notes:**
- WS2812B LEDs require 5V power
- Data line is 5V logic, but Raspberry Pi GPIO is 3.3V
- For short runs (< 6 inches), may work without level shifter
- For longer runs, use a level shifter (74AHCT125 or similar)

### Option 2: With Level Shifter (Recommended)

**Wiring:**
```
Raspberry Pi    Level Shifter    LED Ring
-----------     -------------    ---------
GPIO 18    →   Input A      →   DIN
3.3V       →   VCC (low)    
5V         →   VCC (high)   →   VCC
GND        →   GND          →   GND
                          →   GND
```

### Option 3: External Power Supply

**Wiring:**
```
External 5V Power Supply
    |
    +-- VCC → LED Ring VCC
    |
    +-- GND → LED Ring GND
              LED Ring GND → Raspberry Pi GND (common ground!)

Raspberry Pi GPIO 18 → Level Shifter → LED Ring DIN
```

**⚠️ CRITICAL:** Always connect grounds together when using external power!

---

## Software Setup

### Step 1: Install Required Library

On Raspberry Pi:

```bash
# Install Python library for WS2812B LEDs
sudo pip3 install rpi-ws281x

# Or if using Node.js (for direct integration with backend)
npm install rpi-ws281x
```

### Step 2: Enable SPI/PWM on Raspberry Pi

```bash
sudo raspi-config
# Navigate to: Interface Options → SPI → Enable
# Navigate to: Interface Options → PWM → Enable
```

### Step 3: Backend Integration

Add LED ring control to `src/index.ts`:

```typescript
// LED Ring Controller for WS2812B RGB LEDs
let ledRingController: any = null;
const LED_RING_PIN = 18; // GPIO pin for LED data
const LED_RING_COUNT = 24; // Number of LEDs in ring

// Initialize LED ring (only on Raspberry Pi)
if (process.platform === 'linux') {
  try {
    // Try to import rpi-ws281x (Node.js wrapper)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws281x = require('rpi-ws281x-native');
    
    ws281x.init(LED_RING_COUNT, {
      gpio: LED_RING_PIN,
      brightness: 128, // 0-255
      stripType: ws281x.stripType.WS2812B
    });
    
    ledRingController = ws281x;
    console.log(`✅ LED ring initialized: ${LED_RING_COUNT} LEDs on GPIO ${LED_RING_PIN}`);
  } catch (error) {
    console.warn('⚠️ LED ring not available - rpi-ws281x may not be installed');
    console.warn('Install with: npm install rpi-ws281x');
  }
}

// Helper function to set all LEDs to a color
function setLEDRingColor(r: number, g: number, b: number): void {
  if (!ledRingController) return;
  
  const colors = new Uint32Array(LED_RING_COUNT);
  const color = (r << 16) | (g << 8) | b;
  
  for (let i = 0; i < LED_RING_COUNT; i++) {
    colors[i] = color;
  }
  
  ledRingController.render(colors);
}

// Helper function for flashing animation
function flashLEDRing(r: number, g: number, b: number, duration: number): void {
  if (!ledRingController) return;
  
  const interval = 500; // Flash every 500ms
  const iterations = Math.floor(duration / interval);
  let count = 0;
  
  const flashInterval = setInterval(() => {
    if (count % 2 === 0) {
      setLEDRingColor(r, g, b); // On
    } else {
      setLEDRingColor(0, 0, 0); // Off
    }
    count++;
    
    if (count >= iterations * 2) {
      clearInterval(flashInterval);
      setLEDRingColor(0, 0, 0); // Turn off
    }
  }, interval / 2);
}

// LED Ring Control Endpoint
app.post('/api/led-ring/:action', validateApiKey, (req: Request, res: Response) => {
  try {
    const { action } = req.params;
    const { r, g, b, duration } = req.body;
    
    if (!ledRingController) {
      return res.status(503).json({ error: 'LED ring not available' });
    }
    
    switch (action) {
      case 'set':
        setLEDRingColor(r || 0, g || 0, b || 0);
        res.json({ success: true, action: 'set', color: { r, g, b } });
        break;
        
      case 'flash':
        flashLEDRing(r || 255, g || 0, b || 0, duration || 5000);
        res.json({ success: true, action: 'flash', duration });
        break;
        
      case 'off':
        setLEDRingColor(0, 0, 0);
        res.json({ success: true, action: 'off' });
        break;
        
      case 'fire':
        flashLEDRing(255, 0, 0, 120000); // Red flash for 2 minutes
        res.json({ success: true, action: 'fire' });
        break;
        
      case 'ems':
        flashLEDRing(0, 0, 255, 120000); // Blue flash for 2 minutes
        res.json({ success: true, action: 'ems' });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error controlling LED ring:', error);
    res.status(500).json({ error: 'Failed to control LED ring' });
  }
});
```

### Step 4: Integrate with Alert System

Update alert handler in `src/index.ts`:

```typescript
// In the alert endpoint, after emitting socket event:
io.emit('dispatch_alert', alert);

// Control LED ring based on alert type
if (ledRingController) {
  const callCategory = getCallTypeCategory(call_type);
  if (callCategory === 'fire') {
    // Flash red for fire alerts
    flashLEDRing(255, 0, 0, 120000); // Red, 2 minutes
  } else {
    // Flash blue for EMS alerts
    flashLEDRing(0, 0, 255, 120000); // Blue, 2 minutes
  }
}
```

---

## Alternative: Python Script Approach

If Node.js library doesn't work, use a Python script:

**Create `led_ring_controller.py`:**

```python
#!/usr/bin/env python3
import rpi_ws281x
import sys
import time

# LED strip configuration
LED_COUNT = 24        # Number of LED pixels
LED_PIN = 18          # GPIO pin (PWM)
LED_FREQ_HZ = 800000  # LED signal frequency
LED_DMA = 10          # DMA channel
LED_BRIGHTNESS = 128  # Brightness (0-255)
LED_INVERT = False    # Invert signal
LED_CHANNEL = 0       # PWM channel

def set_color(strip, r, g, b):
    """Set all LEDs to a color"""
    color = rpi_ws281x.Color(r, g, b)
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, color)
    strip.show()

def flash_color(strip, r, g, b, duration_seconds):
    """Flash LEDs for specified duration"""
    end_time = time.time() + duration_seconds
    while time.time() < end_time:
        set_color(strip, r, g, b)
        time.sleep(0.5)
        set_color(strip, 0, 0, 0)
        time.sleep(0.5)

if __name__ == '__main__':
    # Create NeoPixel object
    strip = rpi_ws281x.Adafruit_NeoPixel(
        LED_COUNT, LED_PIN, LED_FREQ_HZ, 
        LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL
    )
    strip.begin()
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python3 led_ring_controller.py <action> [r] [g] [b] [duration]")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == 'fire':
        flash_color(strip, 255, 0, 0, 120)  # Red flash, 2 minutes
    elif action == 'ems':
        flash_color(strip, 0, 0, 255, 120)   # Blue flash, 2 minutes
    elif action == 'set':
        r = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        g = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        b = int(sys.argv[4]) if len(sys.argv) > 4 else 0
        set_color(strip, r, g, b)
    elif action == 'off':
        set_color(strip, 0, 0, 0)
    
    # Cleanup
    set_color(strip, 0, 0, 0)
```

**Call from Node.js backend:**

```typescript
import { exec } from 'child_process';

function controlLEDRing(action: string, r?: number, g?: number, b?: number): void {
  const scriptPath = path.join(__dirname, 'led_ring_controller.py');
  let command = `python3 ${scriptPath} ${action}`;
  
  if (r !== undefined && g !== undefined && b !== undefined) {
    command += ` ${r} ${g} ${b}`;
  }
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('LED ring control error:', error);
    }
  });
}
```

---

## Frontend Integration

Create LED ring controller utility:

**`frontend/src/utils/ledRingController.ts`:**

```typescript
/**
 * LED Ring Controller
 * Controls RGB LED rings via backend API
 */

let ledRingEnabled = false;

export async function initializeLEDRing(): Promise<void> {
  const backendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${backendUrl}/api/led-ring/status`);
    if (response.ok) {
      ledRingEnabled = true;
      console.log('✅ LED ring controller available');
    }
  } catch (error) {
    console.warn('⚠️ LED ring not available:', error);
    ledRingEnabled = false;
  }
}

export async function flashLEDRingFire(): Promise<void> {
  if (!ledRingEnabled) return;
  
  const backendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000';
  const apiKey = localStorage.getItem('apiKey');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  try {
    await fetch(`${backendUrl}/api/led-ring/fire`, {
      method: 'POST',
      headers
    });
  } catch (error) {
    console.error('Failed to control LED ring:', error);
  }
}

export async function flashLEDRingEMS(): Promise<void> {
  if (!ledRingEnabled) return;
  
  const backendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000';
  const apiKey = localStorage.getItem('apiKey');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  try {
    await fetch(`${backendUrl}/api/led-ring/ems`, {
      method: 'POST',
      headers
    });
  } catch (error) {
    console.error('Failed to control LED ring:', error);
  }
}

export async function turnOffLEDRing(): Promise<void> {
  if (!ledRingEnabled) return;
  
  const backendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000';
  const apiKey = localStorage.getItem('apiKey');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  try {
    await fetch(`${backendUrl}/api/led-ring/off`, {
      method: 'POST',
      headers
    });
  } catch (error) {
    console.error('Failed to turn off LED ring:', error);
  }
}

export function isLEDRingAvailable(): boolean {
  return ledRingEnabled;
}
```

**Integrate in App.tsx:**

```typescript
import { flashLEDRingFire, flashLEDRingEMS, turnOffLEDRing, initializeLEDRing } from './utils/ledRingController'

// In useEffect on mount:
initializeLEDRing()

// In alert handler:
if (currentAlert) {
  const alertType = getCallTypeCategory(currentAlert.call_type);
  if (alertType === 'fire') {
    await flashLEDRingFire();
  } else {
    await flashLEDRingEMS();
  }
}

// When alert dismisses:
await turnOffLEDRing();
```

---

## Installation Steps

### 1. Hardware Installation

1. **Mount LED Ring:**
   - Remove speaker grille (if possible)
   - Mount LED ring around speaker opening
   - Or mount behind grille (light will shine through)

2. **Wire LED Ring:**
   - Connect VCC to 5V power supply
   - Connect GND to ground (common with Raspberry Pi)
   - Connect DIN to GPIO 18 (via level shifter if needed)

3. **Power:**
   - For 16 LEDs: Can use Raspberry Pi 5V pin (not recommended)
   - For 24+ LEDs: Use external 5V power supply
   - **Always connect grounds together!**

### 2. Software Installation

**On Raspberry Pi:**

```bash
# Install Python library
sudo pip3 install rpi-ws281x

# Or install Node.js library
npm install rpi-ws281x

# Enable SPI
sudo raspi-config
# Interface Options → SPI → Enable
```

### 3. Test LED Ring

```bash
# Test with Python script
python3 led_ring_controller.py set 255 0 0  # Red
python3 led_ring_controller.py set 0 255 0  # Green
python3 led_ring_controller.py set 0 0 255  # Blue
python3 led_ring_controller.py off          # Off
```

---

## Configuration

### Environment Variables

Add to `.env`:

```env
LED_RING_ENABLED=true
LED_RING_PIN=18
LED_RING_COUNT=24
LED_RING_BRIGHTNESS=128
```

### Multiple LED Rings

If you have multiple speakers with LED rings:

```typescript
// Use different GPIO pins for each ring
const LED_RINGS = [
  { pin: 18, count: 24, name: 'Speaker 1' },
  { pin: 19, count: 24, name: 'Speaker 2' },
  { pin: 20, count: 24, name: 'Speaker 3' }
];
```

---

## Visual Effects

### Fire Alert Pattern
- **Color:** Red (255, 0, 0)
- **Pattern:** Fast flash (500ms on/off)
- **Duration:** 2 minutes

### EMS Alert Pattern
- **Color:** Blue (0, 0, 255)
- **Pattern:** Fast flash (500ms on/off)
- **Duration:** 2 minutes

### Custom Patterns

You can create custom patterns:

```typescript
// Chasing pattern
function chasePattern(color: { r: number, g: number, b: number }): void {
  const colors = new Uint32Array(LED_RING_COUNT);
  for (let i = 0; i < LED_RING_COUNT; i++) {
    colors[i] = (color.r << 16) | (color.g << 8) | color.b;
  }
  // Rotate colors for chasing effect
  // ... implementation
}

// Fade pattern
function fadePattern(color: { r: number, g: number, b: number }): void {
  // Gradually increase brightness
  // ... implementation
}
```

---

## Troubleshooting

### LEDs Not Lighting Up

1. **Check power:** Ensure 5V power supply is connected
2. **Check ground:** Common ground between Pi and LED ring
3. **Check data line:** Verify GPIO pin connection
4. **Check library:** Ensure rpi-ws281x is installed
5. **Check permissions:** May need sudo for GPIO access

### Colors Wrong

- Check RGB order (some LEDs use GRB or BRG)
- Verify color values (0-255 range)
- Check wiring (data line may be reversed)

### Flickering/Unstable

- Add capacitor (1000µF) across power supply
- Use level shifter for data line
- Check power supply current rating
- Add resistor (330-470Ω) on data line

---

## Product Recommendations

### LED Rings

- **Adafruit NeoPixel Ring 16:** ~$12 (high quality)
- **BTF-Lighting WS2812B 24-LED:** ~$10 (good value)
- **Gikfun WS2812B 32-LED:** ~$15 (excellent visibility)

### Power Supplies

- **5V 2A USB Adapter:** For 16-24 LEDs
- **5V 5A Power Supply:** For 32-60 LEDs
- **Mean Well 5V 10A:** For multiple rings

### Level Shifters

- **74AHCT125:** 4-channel level shifter
- **Adafruit Level Shifter:** Pre-built board

---

## Next Steps

1. **Purchase hardware** (LED ring, power supply, wires)
2. **Install library** on Raspberry Pi
3. **Wire up LED ring** following diagram
4. **Add backend code** to `src/index.ts`
5. **Test with curl** or test script
6. **Integrate with alerts** in App.tsx
7. **Mount on speakers** and enjoy!

**Need help?** Check `CUSTOM_HARDWARE_INTEGRATION.md` for general custom hardware guidance.
