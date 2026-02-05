# Product Inventory & Setup Reference

Complete list of purchased hardware components for the MVFD Phoenix Fire Station Alert System.

## Display Hardware

### Main Station Display
- **Amazon Fire TV 40" 2-Series** (HD Smart TV)
  - Quantity: 1
  - Price: ~$159.99 (with discount code SAVEFTV)
  - Features: Alexa Voice Remote, Dolby Audio, Ambient Experience
  - Use: Main station command center display
  - Connection: HDMI to Raspberry Pi 5

### Room Displays
- **MAGEX 15.6" Touchscreen Monitor**
  - Quantity: 1 (can purchase more as needed)
  - Price: ~$159.99
  - Features: 10-point touch, HDMI/VGA/DVI, built-in speakers, VESA mount
  - Use: Room displays (office, dorm, kitchen, etc.)
  - Connection: HDMI to Raspberry Pi 5

### Display Controllers
- **CanaKit Raspberry Pi 5 Starter Kit PRO** (8GB RAM, 128GB Edition)
  - Quantity: 6
  - Price: ~$179.77 each (~$1,078.62 total)
  - Includes: Raspberry Pi 5, power supply, case, cooling fan, microSD card
  - Use: 
    - 1x for backend server
    - 1x for main station display (Fire TV)
    - 1x for room display (MAGEX touchscreen)
    - 3x spare/for additional displays

## Audio Hardware

### Speaker Wire
- **Mygatti 14AWG Speaker Wire** (300 FT, 14/2 Gauge)
  - Quantity: 1 roll (300 feet)
  - Price: ~$45.99
  - Features: White jacket with yellow polarity marker, CCA (Copper Clad Aluminum)
  - Use: Connecting speakers to amplifiers across multiple rooms
  - Note: 300 feet is enough for multiple room speaker installations

## Relay Modules (Room Speaker Control)

### Single Channel Relays
- **HUABAN 1 Channel DC 5V Relay Module** (with Optocoupler, Low Level Trigger)
  - Quantity: 2 modules
  - Price: ~$13.00 for 2-pack (~$6.50 each)
  - Features: Low level trigger, optocoupler protection, LED indicator
  - Use: One relay per room for speaker mute control
  - Connection: GPIO pins on Raspberry Pi

### Two Channel Relay
- **SunFounder 2 Channel DC 5V Relay Module** (Low Level Trigger)
  - Quantity: 1 module
  - Price: ~$6.79
  - Features: 2 channels, low level trigger, optocoupler protection
  - Use: Can control 2 rooms with one module, or use for amplifier/radio control
  - Connection: GPIO pins on Raspberry Pi

### Jumper Wires
- **40pcs Female to Female Dupont Wire** (20cm/8 inch, Multicolored)
  - Quantity: 1 pack (40 pieces)
  - Price: ~$3.99
  - Features: Female-to-female connectors, multicolored for easy identification
  - Use: Connecting relay modules to Raspberry Pi GPIO pins
  - Note: 40 pieces is enough for multiple relay installations

## Lighting Hardware

### Indoor Lights
- **Philips Hue Smart Play Light Bar Base Kit** (2-Pack, Black)
  - Quantity: 2 packs (4 lights total)
  - Price: ~$138.88 per 2-pack (~$277.76 total)
  - Features: White & Color Ambiance LED, requires Hue Bridge
  - Use: Indoor alert lighting for rooms, offices, display areas
  - Control: Via Philips Hue Bridge API

### Outdoor Lights
- **Philips Hue Discover Outdoor Smart Flood Light Fixture** (2-Pack, Black)
  - Quantity: 1 pack (2 lights)
  - Price: ~$395.99
  - Features: 15W White and Color Ambiance LED, weatherproof
  - Use: Outdoor/exterior alert lighting for station building
  - Control: Via Philips Hue Bridge API

### Hue Bridge (Required)
- **Philips Hue Bridge** (sold separately)
  - Quantity: 1 (not in current order - purchase separately)
  - Price: ~$50-60
  - Required for: Controlling all Philips Hue lights
  - Connection: Ethernet to network

## Total Cost Summary

| Category | Items | Estimated Cost |
|----------|-------|----------------|
| Display Hardware | Fire TV + MAGEX Monitor | ~$320 |
| Raspberry Pi Kits | 6x Starter Kits | ~$1,079 |
| Audio Hardware | Speaker Wire | ~$46 |
| Relay Modules | 2x Single + 1x Dual Channel | ~$20 |
| Jumper Wires | 40-piece pack | ~$4 |
| Indoor Lights | 2x Hue Play Light Bar packs | ~$278 |
| Outdoor Lights | 1x Hue Discover Flood pack | ~$396 |
| Hue Bridge | 1x (purchase separately) | ~$55 |
| **TOTAL** | | **~$2,198** |

## Setup Notes

### Display Setup
- Each display (Fire TV or MAGEX) connects to a Raspberry Pi 5
- Raspberry Pi runs the frontend application
- All displays connect to one backend server (Raspberry Pi 5)

### Room Speaker Setup
- Each room needs: 1 relay module + speaker wire + speakers
- Relay modules connect to Raspberry Pi GPIO pins
- GPIO pins are auto-assigned based on unit names
- Use Female-to-Female Dupont wires for GPIO connections

### Lighting Setup
- All Philips Hue lights require a Hue Bridge
- Bridge connects to network via Ethernet
- System controls lights via Hue API
- Indoor lights for rooms, outdoor lights for building exterior

## Next Steps

1. **Set up Hue Bridge** (if not already owned)
2. **Configure Raspberry Pi displays** - Install OS, connect displays
3. **Wire relay modules** - Connect to Raspberry Pi GPIO pins
4. **Run speaker wire** - Connect speakers to amplifiers
5. **Configure software** - Set up backend and frontend
6. **Test system** - Verify all components work together

## Product Links Reference

- **Amazon Fire TV:** Search "Amazon Fire TV 40 inch 2-Series"
- **MAGEX Monitor:** Search "MAGEX 15.6 Touchscreen Monitor"
- **Raspberry Pi Kit:** Search "CanaKit Raspberry Pi 5 Starter Kit PRO"
- **Speaker Wire:** Mygatti 14AWG Speaker Wire 300 FT
- **Relay Modules:** HUABAN 1 Channel DC 5V Relay Module
- **Jumper Wires:** 40pcs Female to Female Dupont Wire
- **Hue Lights:** Philips Hue Smart Play Light Bar / Discover Flood Light
