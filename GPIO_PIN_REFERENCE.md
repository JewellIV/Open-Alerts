# Raspberry Pi GPIO Pin Availability Reference

## Total GPIO Pins Available

The Raspberry Pi has a **40-pin GPIO header**, but not all pins are usable GPIO pins.

### Pin Breakdown:

**40 Total Pins:**
- **26 GPIO Pins** (usable for digital I/O)
- **2 Power Pins** (5V)
- **2 Power Pins** (3.3V)
- **8 Ground Pins** (GND)
- **2 Reserved** (ID EEPROM)

### Currently Reserved in Your System:

- **GPIO 18** - Amplifier relay (always unmuted for alerts)
- **GPIO 23** - Radio relay (controls radio muting)

### Pins to Avoid:

- **GPIO 2, 3** - I2C (SDA/SCL) - Used for I2C devices
- **GPIO 7, 8, 9, 10, 11** - SPI (CE1, CE0, MISO, MOSI, SCLK) - Do **not** use for relays when SPI is enabled
- **GPIO 14, 15** - UART (TX/RX) - Used for serial communication

### Your Unit Pin Assignments:

Based on your units (SPI pins 7,8,9 avoided):
- **GPIO 4** - Engine 2 (unique)
- **GPIO 5** - Tanker 2 (unique)
- **GPIO 6** - Tanker 21 (unique)
- **GPIO 12** - Squad 2 (unique)
- **GPIO 13** - Brush 2 (unique)
- **GPIO 16** - Response 2 (unique)
- **GPIO 21** - Medic 21, Ambulance 21 (shared - same physical unit)
- **GPIO 24** - Medic 22, Ambulance 22 (shared; GPIO 22 can be unreliable on some Pi 5)

✅ **Note:** Each unit gets a unique pin (except Medic/Ambulance pairs which share pins).

## Available GPIO Pins (26 total):

**Safe to Use (avoid SPI if enabled):**
- GPIO 4, 5, 6, 12, 13, 16, 17, 19, 20, 21, 22, 24, 25, 26, 27
- Avoid 7, 8, 9, 10, 11 when SPI is on
- GPIO (BCM) numbering continues...

**Already Used:**
- GPIO 18 (Amplifier)
- GPIO 23 (Radio)

**Your Units Will Use:**
- GPIO 4, 5, 6, 12, 13, 16 (unique pins; 7,8,9 avoided for SPI) ✅
- GPIO 21 (Medic 21/Ambulance 21 shared) ✅
- GPIO 24 (Medic 22/Ambulance 22 shared; 22 can be unreliable on Pi 5) ✅

## Recommendations:

1. **If you need I2C:** Avoid GPIO 2 and 3
2. **For your units:** Consider remapping units to avoid GPIO 2, or disable I2C if not needed
3. **Available pins for future expansion:** GPIO 4, 5, 6, 12, 13, 16, 17, 19, 20, 24, 25, 26, 27 (avoid 7–11 if SPI enabled)

## Physical Pin Numbers vs GPIO Numbers:

The 40-pin header uses **physical pin numbers** (1-40), but software uses **GPIO (BCM) numbers**. 

Example:
- Physical Pin 3 = GPIO 2 (I2C SDA)
- Physical Pin 5 = GPIO 3 (I2C SCL)
- Physical Pin 12 = GPIO 18 (your amplifier)
- Physical Pin 16 = GPIO 23 (your radio)

## For Your Setup:

**Currently Needed:**
- 2 pins (GPIO 18, 23) - Already reserved
- 8 pins (GPIO 4, 5, 6, 12, 13, 16, 21, 24) - For your 10 units (22→24 if GPIO 22 won’t turn on)

**Total Used: 10 pins**

**Remaining Available: ~16 GPIO pins** for future expansion (GPIO 10-17, 19-20, 24-27)

### Why some relay LEDs are bright and some dim

- **Bright** = that channel’s GPIO is being **driven** (HIGH or LOW) by the Pi. The relay/LED is in a defined state.
- **Dim** = that GPIO is **floating** (not driven). The pin was never set to output, or init failed for that pin, so the LED gets a weak voltage and glows dim.

**Fix:** Ensure every relay pin is initialized and driven. The room GPIO service now retries each pin once and drives all pins LOW twice at startup so none are left floating. If a pin still stays dim, check `journalctl -u room-gpio-service` for init errors for that GPIO number.

---

## Single source → single speaker (one relay)

Use this when you have **one audio source** (e.g. amplifier output or line out) and **one speaker**, and you want the Pi to mute/unmute that path with **one relay**.

### What you need

- 1× relay module (one channel; or one channel of an 8‑channel board)
- Audio source (amp output or line-level)
- One speaker
- Raspberry Pi (room Pi or main station)
- Jumper wires (Pi GPIO → relay IN, GND → GND; relay VCC if needed)

### Wiring (audio)

- **Audio path:**  
  **Source (L)** → relay **COM** → relay **NO** (or **NC**) → **Speaker (L)**  
  **Source (R)** → (optional second relay or pass-through) → **Speaker (R)**  

  Use **NO** (normally open) if you want: relay **off** = no sound, relay **on** = sound.  
  Use **NC** (normally closed) if you want: relay **off** = sound, relay **on** = mute.

- **Ground:** Connect **source ground**, **relay GND**, and **Pi GND** together (common ground).

### Wiring (relay control to Pi)

| Relay module | Pi (BCM)        |
|-------------|------------------|
| IN (or IN1) | GPIO pin (e.g. 4) |
| GND         | GND (e.g. Pin 6, 9, 14, 20, 25, 30, 34, 39) |
| VCC         | 3.3V or 5V (per your relay board; many use 3.3V) |

Use one of your free GPIO pins (e.g. 4, 5, 6, 12, 13, 16, 21, 24). Do **not** use 7, 8, 9 if SPI is enabled.

### How Open-Alerts uses it

- **Mute** = Pi sets that GPIO so the relay opens (or closes) the audio path → no sound to the speaker.
- **Unmute** = Pi sets GPIO the other way → sound flows to the speaker.

If the relay is “backwards” (mute/unmute swapped), set `RELAY_ACTIVE_HIGH=1` in the room-gpio-service (or adjust your COM/NO/NC wiring).

### One room, one relay

- On the **room Pi**: run the room-gpio-service with `ROOM_PINS` containing only that one GPIO (e.g. `ROOM_PINS=4`).
- Quiet mode on that display will mute/unmute that one relay (and thus that one speaker) on that device only.
