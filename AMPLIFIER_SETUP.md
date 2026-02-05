# Physical Radio & Amplifier Setup Guide

Guide for connecting a physical radio to an amplifier with automatic nighttime muting.

**For Bogen C-35 Amplifier:** See `BOGEN_C35_SETUP.md` for specific setup instructions.

## Overview

This setup controls a **physical radio connected to an amplifier** (not an internet radio stream). The system automatically:
- **Mutes amplifier during nighttime** (20:30 - 06:30) to avoid disturbing sleepers
- **Mutes amplifier before alerts** during nighttime, then **unmutes after alert sounds complete**
- **Amplifier plays normally during daytime** (06:30 - 20:30)

## Hardware Setup

### Physical Connections

```
Physical Radio → Amplifier Input 1
Raspberry Pi Audio → Amplifier Input 2
     ↓
Amplifier → Speakers
     ↓
Raspberry Pi GPIO (controls amplifier mute via relay)
```

**Components:**
- **Physical Radio:** AM/FM radio or scanner radio (connects to amplifier input)
- **Raspberry Pi:** Computer running the alert system (audio output connects to amplifier input)
- **Amplifier:** Audio amplifier with mute control capability
- **Speakers:** Connected to amplifier output
- **Audio Cable:** Connects Raspberry Pi 3.5mm jack to amplifier input (~$5-10)
- **Relay Module:** Controls amplifier mute switch (~$5-10)
- **Jumper Wires:** Connect relay to Raspberry Pi GPIO (~$2-5)

**What You Need to Purchase:**
1. **5V Relay Module** (~$5-10) - For GPIO control
2. **Jumper Wires** (~$2-5) - Usually included with relay
3. **Audio Cable** (~$5-10) - 3.5mm to RCA or 3.5mm to 3.5mm

**Total Cost: ~$12-25** (if you already have amplifier and speakers)

## What Amplifier Do I Need?

**Good news:** You can use almost ANY amplifier! Here are your options:

### ✅ Easiest Option: Any Amplifier with Mute Switch/Button (Recommended)

**Works with:** ANY amplifier that has a mute switch, mute button, or mute function

**Examples:**
- Home stereo amplifiers
- PA system amplifiers
- Car audio amplifiers
- Professional audio amplifiers
- Most amplifiers with a mute button or switch

**What you need:**
- Amplifier with mute switch/button
- Raspberry Pi (for backend)
- 5V relay module (~$5-10)
- Jumper wires

**Why this is easiest:** Works with 99% of amplifiers - no special features required!

### Option 2: Amplifier with USB/Serial Control

**Works with:** Amplifiers that have USB or serial control ports

**Examples:**
- Some professional audio amplifiers (Crown, QSC, etc.)
- Amplifiers designed for automation/control systems
- Custom-built amplifiers with Arduino/ESP8266 controllers

**What you need:**
- Amplifier with USB/Serial port
- USB cable

**Note:** Less common - most consumer amplifiers don't have this.

### Option 3: Network-Enabled Amplifier

**Works with:** Amplifiers with Ethernet/WiFi and HTTP API

**Examples:**
- Some smart amplifiers
- Network-enabled PA systems
- Amplifiers with web interfaces

**What you need:**
- Amplifier with network interface
- Network connection
- API documentation from manufacturer

**Note:** Rare - most amplifiers don't have HTTP APIs.

## Recommended Setup (Easiest)

**For most users, we recommend GPIO/Relay control** because:
- ✅ Works with ANY amplifier (just needs a mute switch)
- ✅ Simple wiring (relay connects to mute switch)
- ✅ Inexpensive (~$5-10 for relay module)
- ✅ Reliable (physical switch control)
- ✅ No special amplifier features needed

**What to buy:**
1. **Any amplifier** with a mute switch/button (most have this)
2. **5V Relay Module** (search "5V relay module" on Amazon/eBay)
3. **Jumper wires** (if not included with relay)
4. **Raspberry Pi** (if you don't already have one)

**Total cost:** ~$15-30 (if you need to buy relay + Raspberry Pi)

## Control Methods

The system supports three methods to control amplifier mute:

### Option 1: USB Serial Control (Recommended for Simple Amplifiers)

**Best for:** Amplifiers with serial/USB control interface

**Hardware Needed:**
- Amplifier with USB/Serial control port
- USB cable to connect amplifier to computer

**How it works:**
- System sends serial commands: `MUTE:ON` and `MUTE:OFF`
- Amplifier must accept these commands via serial port

**Configuration:**
```env
VITE_AMPLIFIER_TYPE=serial
```

**Setup:**
1. Connect amplifier to computer via USB
2. Browser will prompt to select serial port
3. System sends mute/unmute commands automatically

### Option 2: HTTP API Control

**Best for:** Network-enabled amplifiers or smart amplifiers

**Hardware Needed:**
- Amplifier with HTTP API or network interface
- Network connection (Ethernet/WiFi)

**How it works:**
- System sends HTTP POST requests to amplifier API
- Amplifier must have HTTP endpoints for mute control

**Required API Endpoints:**
- `GET /status` - Health check
- `POST /mute` - Control mute: `{"mute": true}` or `{"mute": false}`
- `POST /volume` - Set volume: `{"volume": 0-100}` (optional)

**Configuration:**
```env
VITE_AMPLIFIER_TYPE=http
VITE_AMPLIFIER_HTTP_URL=http://192.168.1.XXX:PORT
VITE_AMPLIFIER_HTTP_API_KEY=your-api-key-if-needed
```

### Option 3: GPIO/Relay Control (Raspberry Pi)

**Best for:** Standard amplifiers without built-in control

**Hardware Needed:**
- Raspberry Pi (running backend)
- Relay module (e.g., 5V relay board)
- Amplifier with mute switch/button
- Jumper wires

**How it works:**
- Relay connects to amplifier's mute switch/button
- Backend controls relay via GPIO pins
- Relay physically mutes/unmutes amplifier

**Wiring Example:**
```
Raspberry Pi GPIO Pin 18 → Relay IN
Relay COM → Amplifier Mute Switch Terminal 1
Relay NO → Amplifier Mute Switch Terminal 2
```

**Backend Setup (Raspberry Pi):**

1. **Install GPIO library:**
   ```bash
   npm install onoff
   ```

2. **Update backend code** (`src/index.ts`) to implement GPIO control:
   ```typescript
   // Add to src/index.ts
   import { Gpio } from 'onoff';
   
   // GPIO pin for mute relay (adjust pin number as needed)
   let muteRelay: Gpio | null = null;
   
   // Initialize GPIO on backend startup
   try {
     muteRelay = new Gpio(18, 'out'); // GPIO pin 18, output mode
     console.log('✅ GPIO amplifier control initialized');
   } catch (error) {
     console.warn('⚠️ GPIO not available (may not be on Raspberry Pi)');
   }
   
   // In /api/amplifier/mute endpoint:
   if (muteRelay) {
     muteRelay.writeSync(mute ? 1 : 0); // 1 = mute (relay closed), 0 = unmute
   }
   ```

3. **Configuration:**
   ```env
   VITE_AMPLIFIER_TYPE=gpio
   ```

**Note:** GPIO control requires backend to run on Raspberry Pi. Frontend displays can connect to backend and control amplifier remotely.

## Configuration

### Method 1: Environment Variables (Recommended)

Create or edit `frontend/.env`:

**For Serial Control:**
```env
VITE_AMPLIFIER_TYPE=serial
```

**For HTTP API Control:**
```env
VITE_AMPLIFIER_TYPE=http
VITE_AMPLIFIER_HTTP_URL=http://192.168.1.XXX:PORT
VITE_AMPLIFIER_HTTP_API_KEY=your-api-key
```

**For GPIO/Relay Control:**
```env
VITE_AMPLIFIER_TYPE=gpio
VITE_BACKEND_URL=http://192.168.1.100:3000
```

### Method 2: Browser localStorage

```javascript
// Serial control
localStorage.setItem('amplifierType', 'serial')

// HTTP control
localStorage.setItem('amplifierType', 'http')
localStorage.setItem('amplifierHttpUrl', 'http://192.168.1.XXX:PORT')

// GPIO control
localStorage.setItem('amplifierType', 'gpio')
localStorage.setItem('backendUrl', 'http://192.168.1.100:3000')

location.reload()
```

## How It Works

### Daytime Behavior (06:30 - 20:30)

- **Amplifier is always unmuted** (alerts can always play)
- Radio is **unmuted** (relay OFF)
- Radio plays through amplifier at normal volume
- Alerts play through amplifier (mixed with radio)
- Both radio and alerts play simultaneously

### Nighttime Behavior (20:30 - 06:30)

**Single Relay Setup:**
- Amplifier starts **muted** (both radio and alerts muted)
- When alert arrives:
  1. Amplifier unmutes (to play alert sounds)
  2. Alert beeps and TTS play through amplifier → speakers
  3. Radio also plays simultaneously (mixed with alerts)
  4. Amplifier mutes 2 seconds after alert sounds complete
  5. Amplifier remains muted (still nighttime)

**Dual Relay Setup (Recommended):**
- **Amplifier is always unmuted** (alerts can always play)
- Radio starts **muted** (radio relay ON)
- Alerts can play anytime (amplifier unmuted)
- When alert arrives:
  1. Radio unmutes (radio relay turns OFF)
  2. Alert beeps play through amplifier → speakers
  3. TTS announcement plays through amplifier → speakers
  4. Radio also plays (mixed with alerts)
  5. **After alerts complete, radio stays unmuted** (radio relay stays OFF)
  6. Radio continues playing until next nighttime cycle

### Alert Sequence

**Daytime:**
```
1. Alert arrives → Radio already unmuted
2. Alert beeps play (through amplifier → speakers)
3. TTS announcement plays (through amplifier → speakers)
4. Radio continues playing (mixed with alerts)
```

**Nighttime:**
```
1. Alert arrives → Radio unmutes (relay turns OFF)
2. Alert beeps play (through amplifier → speakers)
3. TTS announcement plays (through amplifier → speakers)
4. Radio also plays (mixed with alerts)
5. After alerts complete → Radio stays unmuted
6. Radio continues playing until next nighttime cycle
```

**Important:** The relay controls radio muting via the amplifier's mute terminals. Since most amplifiers (like Bogen C-35) mute the entire output, both radio and alerts will play when unmuted. Alerts are designed to be clearly audible over the radio.

## GPIO/Relay Wiring Guide (Raspberry Pi)

### Components Needed

- **Raspberry Pi** (any model with GPIO)
- **5V Relay Module** (single channel, optocoupler isolated)
- **Jumper wires** (female-to-female)
- **Amplifier** with mute switch/button or mute control terminals

### Wiring Steps

1. **Connect Relay to Raspberry Pi:**
   ```
   Relay VCC → Raspberry Pi Pin 2 (5V)
   Relay GND → Raspberry Pi Pin 6 (GND)
   Relay IN → Raspberry Pi GPIO Pin 18 (or your chosen pin)
   ```

2. **Connect Relay to Amplifier Mute Control:**

   **For Bogen C-35 Amplifier (Recommended Setup):**
   - The Bogen C-35 has dedicated **"AUX2 MUTE"** terminals on the rear panel
   - Connect relay COM to one "AUX2 MUTE" terminal
   - Connect relay NO to the other "AUX2 MUTE" terminal
   - When relay closes (activates), it shorts the terminals (mutes amplifier)
   - **Note:** You may see existing wires on AUX2 MUTE terminals - you can connect your relay in parallel with these, or replace them if your relay is the sole control

   **For Other Amplifiers:**
   - **Option A:** Parallel with mute button
     - Relay COM → One terminal of mute switch
     - Relay NO → Other terminal of mute switch
     - When relay closes, it shorts the switch (mutes amplifier)
   
   - **Option B:** Series with mute switch
     - Break mute switch circuit
     - Relay COM → One side of break
     - Relay NO → Other side of break
     - When relay opens, circuit breaks (mutes amplifier)

3. **Test Relay:**
   ```bash
   # On Raspberry Pi, test GPIO
   gpio -g write 18 1  # Should mute amplifier
   gpio -g write 18 0  # Should unmute amplifier
   ```

### Backend GPIO Implementation

Add to `src/index.ts`:

```typescript
import { Gpio } from 'onoff';

let muteRelay: Gpio | null = null;

// Initialize GPIO (only on Raspberry Pi)
if (process.platform === 'linux') {
  try {
    muteRelay = new Gpio(18, 'out'); // GPIO pin 18
    console.log('✅ GPIO amplifier control initialized on pin 18');
  } catch (error) {
    console.warn('⚠️ GPIO initialization failed:', error);
  }
}

// In /api/amplifier/mute endpoint:
app.post('/api/amplifier/mute', validateApiKey, (req: Request, res: Response) => {
  try {
    const { mute } = req.body;
    
    if (muteRelay) {
      // GPIO control: 1 = mute (relay closed), 0 = unmute (relay open)
      muteRelay.writeSync(mute ? 1 : 0);
      console.log(`🔊 Amplifier ${mute ? 'muted' : 'unmuted'} via GPIO pin 18`);
    } else {
      console.log(`🔊 Amplifier ${mute ? 'muted' : 'unmuted'} (GPIO not available)`);
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

**Install GPIO library:**
```bash
npm install onoff
npm install --save-dev @types/node
```

## Testing

### Test Serial Control

1. Connect amplifier via USB
2. Configure: `VITE_AMPLIFIER_TYPE=serial`
3. Browser will prompt to select serial port
4. Send test alert
5. Verify amplifier mutes/unmutes

### Test HTTP API Control

1. Configure amplifier API URL
2. Test endpoint: `curl http://AMPLIFIER_IP/status`
3. Send test mute: `curl -X POST http://AMPLIFIER_IP/mute -d '{"mute":true}'`
4. Verify amplifier responds

### Test GPIO Control

1. Wire relay to amplifier mute switch
2. Configure: `VITE_AMPLIFIER_TYPE=gpio`
3. Send test alert
4. Verify relay activates and amplifier mutes

## Troubleshooting

### Amplifier Not Muting

1. **Check connection:**
   - Serial: Verify USB cable and port selection
   - HTTP: Verify amplifier IP and API endpoints
   - GPIO: Verify wiring and relay operation

2. **Check console logs:**
   - Should see: `✅ Amplifier controller initialized`
   - Should see: `🔇 Amplifier muted` or `🔊 Amplifier unmuted`

3. **Test manually:**
   - Serial: Send commands directly via serial monitor
   - HTTP: Test API endpoints with curl/Postman
   - GPIO: Test relay with `gpio` command

### GPIO Relay Not Working

1. **Check wiring:**
   - Verify relay connections
   - Check GPIO pin number matches code
   - Test relay with manual GPIO commands

2. **Check permissions:**
   ```bash
   # Add user to gpio group
   sudo usermod -a -G gpio $USER
   ```

3. **Test relay:**
   ```bash
   gpio -g mode 18 out
   gpio -g write 18 1  # Should activate relay
   gpio -g write 18 0  # Should deactivate relay
   ```

## Safety Notes

- **Electrical Safety:** Ensure proper isolation between relay and amplifier
- **GPIO Voltage:** Raspberry Pi GPIO is 3.3V - use optocoupler relay module
- **Relay Rating:** Ensure relay can handle amplifier's voltage/current
- **Fuses:** Consider adding fuses for protection

## Alternative: Audio Mixer Control

If using an audio mixer instead of direct amplifier control:

1. **Connect radio to mixer input**
2. **Connect mixer to amplifier**
3. **Control mixer mute/volume** instead of amplifier
4. **Use same control methods** (Serial, HTTP, or GPIO)

Many audio mixers have USB/Serial control interfaces that work the same way.

## Support

For amplifier integration issues:
1. Check amplifier documentation for control interface
2. Verify connections (USB, network, or GPIO)
3. Test control method independently
4. Check browser/backend console for errors
5. Verify time settings for nighttime detection
