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
- **GPIO 22** - Medic 22, Ambulance 22 (shared - same physical unit)

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
- GPIO 22 (Medic 22/Ambulance 22 shared) ✅

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
- 8 pins (GPIO 4, 5, 6, 12, 13, 16, 21, 22) - For your 10 units (7,8,9 not used; SPI)

**Total Used: 10 pins**

**Remaining Available: ~16 GPIO pins** for future expansion (GPIO 10-17, 19-20, 24-27)
