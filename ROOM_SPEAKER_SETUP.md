# Room Speaker Control Setup Guide

Guide for setting up individual room speaker control with unit-based dispatch routing and quiet mode.

## Frontend Control Panel

**Access the Room Speaker Admin Panel:**
- Navigate to `#room-speaker` in your browser (e.g., `http://localhost:5173/#room-speaker`)
- Or click the "Speakers" link in the bottom-left corner of the dashboard

**Features:**
- ✅ **Select Units:** Choose which units trigger alerts in this room (via admin panel or main screen popup)
- ✅ **Configure Room:** Set room ID, name, and backend URL
- ✅ **Quiet Mode Toggle:** Mute/unmute this room with one click (button on main screen)
- ✅ **Control All Rooms:** Mute/unmute any room from the frontend
- ✅ **View Status:** See GPIO pin, assigned units, and relay status

**Main Screen Controls (Room Displays):**
- **Unit Selector Button:** Bottom-left corner, below radar - Opens popup to select units for this room
- **Quiet Mode Button:** Bottom-left corner, below unit selector - Toggle quiet mode on/off
- Both buttons only appear when room speaker is configured

## Overview

This feature allows each room to have its own relay-controlled speaker system with:
- **Unit-Based Routing:** Each room only plays alerts for assigned units
- **Quiet Mode:** Mute individual rooms for meetings/events
- **Independent Control:** Each room speaker controlled separately via GPIO relay

## Use Cases

1. **Unit-Based Dispatches:**
   - Room 1 (Engine Bay): Only plays alerts for "Engine 1", "Engine 2"
   - Room 2 (Office): Only plays alerts for "Medic 1", "Medic 2"
   - Room 3 (Dorm): Only plays alerts for "Ladder 1", "Ladder 2"

2. **Quiet Mode for Meetings:**
   - Mute office room during meetings
   - Mute conference room during events
   - Keep other rooms active

## Hardware Setup

### Components Needed Per Room

- **5V Relay Module** - One per room
  - **HUABAN 1 Channel DC 5V Relay Module** (recommended)
  - Low level trigger with optocoupler protection
  - Includes LED indicator for relay status
- **Jumper Wires** - Female to Female Dupont wires for GPIO connections
  - **40pcs Female to Female Dupont Wire** (20cm/8 inch)
  - Multicolored for easy identification
- **Speaker Wire** - 14AWG speaker wire for audio connections
  - **Mygatti 14AWG Speaker Wire** (300 FT roll, shared across rooms)
  - 14/2 Gauge with polarity markers
- **Room Speaker/Amplifier** - Each room's speaker system

### Wiring Per Room

**For Each Room:**

1. **Connect Relay to Raspberry Pi GPIO:**
   ```
   Relay VCC → Raspberry Pi Pin 2 (5V) [shared]
   Relay GND → Raspberry Pi Pin 6 (GND) [shared]
   Relay IN → Raspberry Pi GPIO Pin (unique per room)
   ```
   
   **Using HUABAN Relay Module:**
   - Connect VCC to Raspberry Pi 5V (Pin 2)
   - Connect GND to Raspberry Pi GND (Pin 6)
   - Connect IN (signal pin) to your assigned GPIO pin (e.g., GPIO 4 for Engine 2)
   - Use Female-to-Female Dupont wires for connections
   - **Note:** HUABAN modules use LOW level trigger (GPIO LOW = relay ON)

2. **Connect Relay to Room Speaker:**
   
   **Option A: Control Speaker Power (Recommended)**
   ```
   Speaker Power Supply + → Relay COM
   Speaker Power Input + → Relay NO
   When relay closes → Power interrupted → Speaker muted
   ```
   
   **Option B: Control Speaker Audio Signal**
   ```
   Audio Source → Relay COM
   Speaker Input → Relay NO
   When relay closes → Audio shorted → Speaker muted
   ```

### GPIO Pin Assignment (Unique Pins Per Unit)

**GPIO pins are automatically assigned with unique pins for each unit:**

**Custom Pin Mapping:**
- Each unit gets a unique GPIO pin
- Medic/Ambulance pairs share pins (same physical unit)

**Example Pin Assignments:**
- **Medic 21** / **Ambulance 21** → GPIO Pin **21** (shared)
- **Medic 22** / **Ambulance 22** → GPIO Pin **22** (shared)
- **Engine 2** → GPIO Pin **4** (unique)
- **Tanker 2** → GPIO Pin **5** (unique)
- **Tanker 21** → GPIO Pin **6** (unique)
- **Squad 2** → GPIO Pin **7** (unique)
- **Brush 2** → GPIO Pin **8** (unique)
- **Response 2** → GPIO Pin **9** (unique)

**Key Points:**
- Medic/Ambulance pairs share pins (e.g., "Medic 21" and "Ambulance 21" both use pin 21)
- All other units get unique pins
- Pins are assigned automatically when units are added to the system
- Reserved pins: GPIO 18 (amplifier), GPIO 23 (radio)
- Avoid pins: GPIO 2, 3 (I2C), GPIO 14, 15 (UART)

## Backend Configuration

### Step 1: Configure Room Speakers in Backend

Add to backend `.env` file:

```env
# Room Speaker Configuration
# Format: roomId:unit1|unit2|unit3
# GPIO pins are automatically assigned based on unit numbers
# Example: engine_bay:Engine 1|Engine 2|Ladder 1
ROOM_SPEAKERS=engine_bay:Engine 1|Engine 2|Ladder 1,office:Medic 1|Medic 2,dorm:Ladder 2|Engine 3,kitchen:
```

**Format Explanation:**
- `roomId`: Unique identifier (e.g., "engine_bay", "office")
- `units`: Pipe-separated list of units (optional - if empty, plays all alerts)
- **GPIO pins are automatically extracted from unit names** (see Pin Assignment below)

**Examples:**

**Room with specific units:**
```
engine_bay:Engine 1|Engine 2|Ladder 1
```
- Room ID: `engine_bay`
- Units: Only plays alerts for "Engine 1", "Engine 2", or "Ladder 1"
- GPIO Pins: Auto-assigned (Engine 1 → Pin 1, Engine 2 → Pin 2, Ladder 1 → Pin 1)

**Room that plays all alerts:**
```
kitchen:
```
- Room ID: `kitchen`
- Units: Empty (plays all alerts)

### Step 2: GPIO Pin Assignment (Automatic - Unique Pins)

**GPIO pins are automatically assigned with unique pins for each unit:**

**Pin Assignment Rules:**
- Each unit gets a unique GPIO pin
- Medic/Ambulance pairs share pins (same physical unit)
- Pins are assigned when units are added to the `station_units` database

**Example Pin Assignments:**
- **Medic 21** / **Ambulance 21** → GPIO Pin **21** (shared)
- **Medic 22** / **Ambulance 22** → GPIO Pin **22** (shared)
- **Engine 2** → GPIO Pin **4** (unique)
- **Tanker 2** → GPIO Pin **5** (unique)
- **Tanker 21** → GPIO Pin **6** (unique)
- **Squad 2** → GPIO Pin **7** (unique)
- **Brush 2** → GPIO Pin **8** (unique)
- **Response 2** → GPIO Pin **9** (unique)

**Key Points:**
- Medic/Ambulance pairs share pins (e.g., "Medic 21" and "Ambulance 21" both use pin 21)
- All other units get unique pins
- Reserved pins: GPIO 18 (amplifier), GPIO 23 (radio)
- Avoid pins: GPIO 2, 3 (I2C), GPIO 14, 15 (UART)
- Units are loaded from both `ROOM_SPEAKERS` env var and `station_units` database table

### Step 2: Install GPIO Library

On Raspberry Pi backend:

```bash
npm install onoff
npm install --save-dev @types/node
```

### Step 3: Restart Backend

```bash
pm2 restart mvfd-backend
# Or if using systemd:
sudo systemctl restart mvfd-phoenix
```

## Frontend Configuration

### Step 1: Configure Room Settings

**Option A: Via Environment Variables**

Add to `frontend/.env`:

```env
# Room Configuration
VITE_ROOM_ID=engine_bay
VITE_ROOM_NAME=Engine Bay
VITE_ROOM_UNITS=Engine 1,Engine 2,Ladder 1
VITE_BACKEND_URL=http://192.168.1.100:3000
```

**Option B: Via Main Screen (Recommended)**

1. Open the room display in a browser
2. Click the **"Select Units"** button (bottom-left, below radar)
3. Select units from the popup
4. Click **"Save"** - units are saved automatically

**Option C: Via Admin Panel**

1. Navigate to `#room-speaker` admin page
2. Configure room ID, name, and select units
3. Save configuration

**Option D: Via localStorage:**

```javascript
localStorage.setItem('roomId', 'engine_bay')
localStorage.setItem('roomName', 'Engine Bay')
localStorage.setItem('roomUnits', 'Engine 1,Engine 2,Ladder 1')
location.reload()
```

### Step 2: Rebuild Frontend (if using env vars)

```bash
cd frontend
npm run build
```

## How It Works

### Unit-Based Routing

When an alert arrives:
1. System checks alert units (e.g., "Engine 1, Ladder 2" or "Station")
2. **If "Station" is alerted or no specific units → Play in ALL rooms** ✅
3. **If room has no units selected → Play all alerts** ✅
4. Otherwise, compares with room's selected units
5. If match found → Unmute room speaker → Play alert
6. If no match → Keep room speaker muted → Skip alert

**Alert Routing Rules:**
- **Station Alert:** If alert contains "Station" → Plays in ALL rooms
- **No Units:** If alert has no specific units → Plays in ALL rooms
- **Room with No Units Selected:** If room has no units selected → Plays ALL alerts
- **Unit Match:** Alert only plays if units match room's selected units

**Examples:**

**Example 1: Station Alert**
- Alert: Units = "Station"
- Room 1 (Engine Bay): **Plays alert** ✅ (Station alert plays everywhere)
- Room 2 (Office): **Plays alert** ✅ (Station alert plays everywhere)
- Room 3 (Dorm): **Plays alert** ✅ (Station alert plays everywhere)

**Example 2: Specific Unit Alert**
- Alert: Units = "Engine 1, Medic 1"
- Room 1 (Engine Bay): Has "Engine 1" → **Plays alert** ✅
- Room 2 (Office): Has "Medic 1" → **Plays alert** ✅
- Room 3 (Dorm): Has "Ladder 2" → **Muted** 🔇

**Example 3: Room with No Units Selected**
- Alert: Units = "Engine 1, Medic 1"
- Room 1 (Engine Bay): No units selected → **Plays alert** ✅ (plays all alerts)
- Room 2 (Office): Has "Medic 1" → **Plays alert** ✅
- Room 3 (Dorm): Has "Ladder 2" → **Muted** 🔇

### Quiet Mode

**Enable Quiet Mode:**
- Mutes room speaker for meetings/events
- Alerts still show on screen, but no audio
- Can be toggled via UI or API

**Quiet Mode Behavior:**
- When enabled: All alerts muted (even matching units)
- When disabled: Normal unit-based routing resumes
- Persists across page reloads (stored in localStorage)

## API Endpoints

### Mute/Unmute Room Speaker

```bash
# Mute room speaker
curl -X POST http://localhost:3000/api/room-speaker/engine_bay/mute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"mute": true}'

# Unmute room speaker
curl -X POST http://localhost:3000/api/room-speaker/engine_bay/mute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"mute": false}'
```

### Get Room Status

```bash
curl http://localhost:3000/api/room-speaker/engine_bay/status \
  -H "X-API-Key: your-api-key"
```

### List All Rooms

```bash
curl http://localhost:3000/api/room-speakers \
  -H "X-API-Key: your-api-key"
```

## Frontend Controls

### Main Screen Unit Selection

**On Room Displays:**
- **Unit Selector Button:** Located bottom-left, below radar
- Click to open popup with all available units
- Select/deselect units with checkboxes
- Shows count of selected units on button
- Empty selection = plays all alerts

### Main Screen Quiet Mode

**On Room Displays:**
- **Quiet Mode Button:** Located bottom-left, below unit selector
- Toggle button with visual feedback
- Red when ON, gray when OFF
- Persists across page reloads

### Admin Panel Controls

Access via `#room-speaker`:
- Configure room ID, name, backend URL
- Select units for this room
- Toggle quiet mode
- Control all rooms from one place

## Testing

### Test Unit-Based Routing

1. **Configure room with specific units:**
   - Use main screen unit selector, or
   - Set `VITE_ROOM_UNITS=Engine 1,Engine 2` in `.env`

2. **Send test alert with matching unit:**
   ```bash
   curl -X POST http://localhost:3000/api/alert \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"call_type": "Structure Fire", "address": "123 Test St", "units": "Engine 1, Ladder 2"}'
   ```
   - Should play alert (Engine 1 matches)

3. **Send test alert with non-matching unit:**
   ```bash
   curl -X POST http://localhost:3000/api/alert \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"call_type": "Medical", "address": "456 Test St", "units": "Medic 1"}'
   ```
   - Should NOT play alert (no matching units)

4. **Send test Station alert (plays everywhere):**
   ```bash
   curl -X POST http://localhost:3000/api/alert \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"call_type": "Station Alert", "address": "789 Test St", "units": "Station"}'
   ```
   - Should play alert in ALL rooms (Station alert)

5. **Send test alert with no units (plays everywhere):**
   ```bash
   curl -X POST http://localhost:3000/api/alert \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"call_type": "General", "address": "999 Test St", "units": ""}'
   ```
   - Should play alert in ALL rooms (no specific units)

### Test Quiet Mode

1. **Enable quiet mode:**
   ```javascript
   // In browser console
   localStorage.setItem('quietMode_engine_bay', 'true')
   location.reload()
   ```

2. **Send test alert:**
   - Alert should show on screen
   - No audio should play

3. **Disable quiet mode:**
   ```javascript
   localStorage.removeItem('quietMode_engine_bay')
   location.reload()
   ```

### Test Relay Control

```bash
# Test room speaker relay manually
gpio -g mode 24 out  # Replace 24 with your room's GPIO pin
gpio -g write 24 1   # Should mute speaker
gpio -g write 24 0   # Should unmute speaker
```

## Configuration Examples

### Example 1: Fire Station with Multiple Rooms

**Backend `.env`:**
```env
# Room Speaker Configuration
# Format: roomId:unit1|unit2|unit3
# GPIO pins are auto-assigned based on unit names
ROOM_SPEAKERS=engine_bay:Engine 2|Tanker 2,office:Medic 21|Medic 22,dorm:Tanker 21|Squad 2,kitchen:,conference:
```

**Room Configurations:**

**Engine Bay (Room 1):**
- Room ID: `engine_bay`
- Units: Engine 2, Tanker 2 (selected via main screen or admin panel)
- GPIO Pins: 4 (Engine 2), 5 (Tanker 2)

**Office (Room 2):**
- Room ID: `office`
- Units: Medic 21, Medic 22 (selected via main screen or admin panel)
- GPIO Pins: 21 (Medic 21/Ambulance 21), 22 (Medic 22/Ambulance 22)

**Dorm (Room 3):**
- Room ID: `dorm`
- Units: Tanker 21, Squad 2 (selected via main screen or admin panel)
- GPIO Pins: 6 (Tanker 21), 7 (Squad 2)

**Kitchen (Room 4):**
- Room ID: `kitchen`
- Units: None selected (empty)
- Behavior: Plays ALL alerts (no unit filter)

**Conference Room (Room 5):**
- Room ID: `conference`
- Units: None selected (empty)
- Behavior: Plays ALL alerts (no unit filter)
- Can use quiet mode during meetings

**Alert Behavior Examples:**

**Alert 1:** Units = "Station"
- All rooms play alert ✅ (Station alert)

**Alert 2:** Units = "Engine 2"
- Engine Bay: Plays ✅ (matches Engine 2)
- Office: Muted 🔇 (no match)
- Dorm: Muted 🔇 (no match)
- Kitchen: Plays ✅ (no units selected = plays all)
- Conference: Plays ✅ (no units selected = plays all)

**Alert 3:** Units = "Medic 21"
- Engine Bay: Muted 🔇 (no match)
- Office: Plays ✅ (matches Medic 21)
- Dorm: Muted 🔇 (no match)
- Kitchen: Plays ✅ (no units selected = plays all)
- Conference: Plays ✅ (no units selected = plays all)

## Troubleshooting

### Room Speaker Not Muting

1. **Check GPIO pin:**
   ```bash
   gpio -g read 24  # Replace with your GPIO pin
   ```

2. **Check relay wiring:**
   - Verify relay connections
   - Check relay LED (should light when activated)

3. **Check room configuration:**
   ```bash
   curl http://localhost:3000/api/room-speakers -H "X-API-Key: your-api-key"
   ```

### Alerts Not Playing in Room

1. **Check unit assignments:**
   - Verify room units match alert units
   - Check unit matching logic (case-insensitive, partial match)

2. **Check quiet mode:**
   ```javascript
   // In browser console
   console.log(localStorage.getItem('quietMode_engine_bay'))
   ```

3. **Check room configuration:**
   ```javascript
   // In browser console
   import { getRoomConfig } from './utils/roomSpeakerController'
   console.log(getRoomConfig())
   ```

### Multiple Rooms Playing Same Alert

- This is normal if multiple rooms have matching units
- Each room independently decides whether to play
- To prevent, assign unique units to each room

## Parts List Per Room

**What to Purchase Per Room:**

1. **5V Relay Module** - One per room
   - **Recommended:** HUABAN 1 Channel DC 5V Relay Module with Optocoupler Low Level Trigger
   - **Alternative:** SunFounder 2 Channel DC 5V Relay Module (if you need 2 rooms per module)
   - **Price:** ~$6.50 per single-channel module, ~$6.79 per 2-channel module

2. **Jumper Wires** - For connecting relay to Raspberry Pi GPIO
   - **Recommended:** 40pcs Female to Female Dupont Wire Breadboard Jumper Ribbon Cables (20cm/8 inch)
   - **Price:** ~$3.99 for 40 pieces (enough for multiple rooms)

3. **Speaker Wire** - For connecting speakers to amplifiers
   - **Recommended:** Mygatti 14AWG Speaker Wire (14/2 Gauge, 300 FT)
   - **Price:** ~$45.99 for 300 feet (enough for multiple rooms)
   - **Note:** 14 gauge is suitable for longer runs and higher power speakers

4. **Speaker/Amplifier** - Room's audio system
   - Use existing speakers or purchase separately
   - Ensure speakers are compatible with your amplifier

**Total Cost Per Room: ~$6-8** (relay + wires, excluding speakers and speaker wire which are shared across rooms)

**Shared Components (One-Time Purchase):**
- **Speaker Wire:** 300 FT roll (~$45.99) - Shared across all rooms
- **Jumper Wires:** 40-piece pack (~$3.99) - Shared across all rooms

## Integration with Existing Features

Room speaker control integrates with:
- ✅ **Amplifier Control** - Works alongside main amplifier
- ✅ **Radio Control** - Independent from radio muting
- ✅ **Light Control** - Lights still flash regardless of speaker mute
- ✅ **Display Configuration** - Works with room and main-station displays
- ✅ **Night Mode** - Respects nighttime muting

## Support

For room speaker issues:
1. Check GPIO pin assignments
2. Verify relay wiring
3. Test relay manually with GPIO commands
4. Check room configuration in backend `.env`
5. Verify frontend room settings
6. Check browser console for errors
