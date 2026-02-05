# Bogen C-35 Amplifier Setup Guide

Specific setup instructions for the Bogen Classic Series C-35 amplifier.

## Will This Amplifier Work?

**YES!** The Bogen C-35 is perfect for this setup because:
- ✅ Has dedicated **"AUX2 MUTE"** terminals on rear panel (perfect for relay control)
- ✅ Multiple RCA audio inputs (TAPE/BOOSTER, AUX inputs)
- ✅ Can handle both radio and Raspberry Pi audio simultaneously
- ✅ Professional PA amplifier designed for continuous operation

## Hardware Connections

### Audio Connections

1. **Physical Radio → Amplifier:**
   - Your radio is already connected to **AUX 1** (as indicated by "RADIO" label)
   - Keep this connection as-is

2. **Raspberry Pi Audio → Amplifier:**
   - Connect Raspberry Pi 3.5mm audio jack to amplifier input
   - **Recommended:** Connect to **AUX 2** RCA inputs (or TAPE/BOOSTER inputs)
   - **Cable needed:** 3.5mm stereo to dual RCA cable (~$5-10)
   - This allows alert sounds and TTS to play through amplifier → speakers

### Relay Control Connection

**Connect Relay to "AUX2 MUTE" Terminals:**

1. **Locate "AUX2 MUTE" terminals** on rear panel of amplifier
   - Two screw terminals labeled "AUX2 MUTE"
   - You may see existing wires connected (white/grey wires)

2. **Wire Relay Module:**
   ```
   Relay COM → One "AUX2 MUTE" terminal
   Relay NO → Other "AUX2 MUTE" terminal
   ```
   
   **Important Notes:**
   - If there are existing wires on AUX2 MUTE terminals, you can connect your relay in parallel
   - The relay acts as a contact closure - when it closes, it mutes the amplifier
   - Only connect the relay's switching contacts (COM/NO), NOT the relay power (VCC/GND)

3. **Connect Relay to Raspberry Pi:**
   ```
   Relay VCC → Raspberry Pi Pin 2 (5V)
   Relay GND → Raspberry Pi Pin 6 (GND)
   Relay IN → Raspberry Pi GPIO Pin 18
   ```

## Amplifier Settings

### Front Panel Controls

1. **Input Selection:**
   - Ensure **AUX 1** volume is set appropriately for radio
   - Ensure **AUX 2** (or TAPE/BOOSTER) volume is set for Raspberry Pi audio
   - Adjust volumes so both inputs are audible

2. **Power:**
   - Turn amplifier **ON** using the red power switch
   - Amplifier should remain powered on for continuous operation

3. **Tone Controls:**
   - Adjust TREBLE and BASS as needed for your station
   - These affect all inputs

## How It Works

### Dual Relay Setup (Recommended)

**Relay 1 (Amplifier - GPIO 18):** Stays OFF (unmuted) at all times
**Relay 2 (Radio - GPIO 23):** Controls radio muting independently

#### Daytime (06:30 - 20:30)
- **Amplifier Relay:** OFF (unmuted) → Alerts can always play
- **Radio Relay:** OFF (unmuted) → Radio plays
- Radio plays through AUX 1 → Amplifier → Speakers
- Raspberry Pi audio (alerts/TTS) plays through AUX 2 → Amplifier → Speakers
- **Both radio and alerts play simultaneously**

#### Nighttime (20:30 - 06:30)
- **Amplifier Relay:** OFF (unmuted) → Alerts can always play
- **Radio Relay:** ON (muted) → Radio is muted
- Radio audio is cut off (muted via radio relay)
- Alerts/TTS can play anytime (amplifier unmuted)
- When alert arrives:
  1. Radio Relay turns **OFF** (opens circuit) → Radio **unmutes**
  2. Alert beeps play through Raspberry Pi → AUX 2 → Amplifier → Speakers
  3. TTS announcement plays through Raspberry Pi → AUX 2 → Amplifier → Speakers
  4. Radio also plays through AUX 1 → Amplifier → Speakers (mixed with alerts)
  5. **After alerts complete, radio stays unmuted** (Radio Relay stays OFF)
  6. Radio continues playing until next nighttime cycle

### Single Relay Setup (Simpler Alternative)

**Relay (GPIO 18):** Controls amplifier mute via AUX2 MUTE terminals

#### Daytime (06:30 - 20:30)
- Relay is **OFF** (open circuit) → Amplifier is **unmuted**
- Radio plays through AUX 1 → Amplifier → Speakers
- Alerts play through AUX 2 → Amplifier → Speakers
- **Both play simultaneously**

#### Nighttime (20:30 - 06:30)
- Relay is **ON** (closed circuit) → Amplifier is **muted** (both radio and alerts muted)
- When alert arrives:
  1. Relay turns **OFF** → Amplifier **unmutes**
  2. Both radio and alerts play together
  3. After alerts, relay turns **ON** → Amplifier **mutes** again

**Note:** With single relay, alerts are muted when amplifier is muted. Dual relay setup is recommended for independent control.

## Testing

### Test Audio Connections

1. **Test Radio:**
   - Turn on radio
   - Adjust AUX 1 volume on amplifier
   - Verify radio audio plays through speakers

2. **Test Raspberry Pi Audio:**
   - Connect Raspberry Pi 3.5mm jack to AUX 2 RCA inputs
   - Play test audio from Raspberry Pi
   - Adjust AUX 2 volume on amplifier
   - Verify Raspberry Pi audio plays through speakers

### Test Relay Control

**For Single Relay Setup:**
```bash
# On Raspberry Pi
gpio -g mode 18 out
gpio -g write 18 1  # Relay ON → Should mute amplifier (both radio and alerts)
gpio -g write 18 0  # Relay OFF → Should unmute amplifier (both play)
```

**For Dual Relay Setup:**
```bash
# Test Amplifier Relay (GPIO 18) - Should stay OFF
gpio -g mode 18 out
gpio -g write 18 0  # Should be OFF (unmuted) - alerts always play

# Test Radio Relay (GPIO 23) - Controls radio independently
gpio -g mode 23 out
gpio -g write 23 1  # Should mute radio (alerts still play)
gpio -g write 23 0  # Should unmute radio
```

2. **Test via API:**
   ```bash
   # Mute amplifier
   curl -X POST http://localhost:3000/api/amplifier/mute \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"mute": true}'
   
   # Unmute amplifier
   curl -X POST http://localhost:3000/api/amplifier/mute \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"mute": false}'
   ```

## Troubleshooting

### No Audio from Raspberry Pi

1. **Check audio cable:**
   - Verify 3.5mm to RCA cable is connected properly
   - Test cable with another device if possible

2. **Check amplifier input:**
   - Verify AUX 2 (or TAPE/BOOSTER) volume is turned up
   - Check that input is selected/enabled on amplifier

3. **Check Raspberry Pi audio:**
   ```bash
   # Test audio output
   speaker-test -t sine -f 1000 -l 1 -c 2
   ```

### Relay Not Muting Amplifier

1. **Check relay wiring:**
   - Verify relay COM and NO are connected to AUX2 MUTE terminals
   - Check that relay is activating (LED on relay module should light)

2. **Test relay manually:**
   ```bash
   gpio -g write 18 1  # Should mute
   gpio -g write 18 0  # Should unmute
   ```

3. **Check existing wires:**
   - If there are existing wires on AUX2 MUTE terminals, they may interfere
   - Try disconnecting existing wires temporarily to test

### Both Audio Sources Playing Simultaneously

- This is normal! The amplifier can mix multiple inputs
- Adjust individual input volumes (AUX 1, AUX 2) to balance radio vs. alerts
- During alerts, both may play briefly - this is expected

## Parts List for Bogen C-35 Setup

### Option A: Single Relay Setup (Simpler)

**What to Purchase:**
1. **5V Relay Module** (~$5-10) - Single channel, optocoupler isolated
2. **Jumper Wires** (~$2-5) - Female-to-female (usually included with relay)
3. **Audio Cable** (~$5-10) - 3.5mm stereo to dual RCA cable

**Total Cost: ~$12-25**

**Note:** With single relay, both radio and alerts mute/unmute together.

### Option B: Dual Relay Setup (Recommended - Independent Control)

**What to Purchase:**
1. **5V Relay Module #1** (~$5-10) - For amplifier (stays OFF)
2. **5V Relay Module #2** (~$5-10) - For radio control
3. **Jumper Wires** (~$2-5) - Female-to-female (usually included with relays)
4. **Audio Cable** (~$5-10) - 3.5mm stereo to dual RCA cable

**Total Cost: ~$20-35**

**Benefits:**
- Alerts always play (amplifier relay stays OFF)
- Radio controlled independently
- Radio can be muted at night while alerts still play

**What You Already Have:**
- Bogen C-35 amplifier ✅
- Physical radio ✅
- Speakers connected to amplifier ✅

## Additional Notes

- The Bogen C-35 is a professional PA amplifier designed for continuous operation
- It can handle multiple audio inputs simultaneously
- The AUX2 MUTE terminals provide clean, reliable mute control
- Speaker outputs support 70V, 25V, 4Ω, 8Ω, and 16Ω speakers
- Ensure amplifier is properly grounded for safety

## Support

For Bogen C-35 specific issues:
1. Check amplifier manual for AUX2 MUTE terminal specifications
2. Verify relay is optocoupler isolated (safe for amplifier)
3. Test relay operation independently before connecting to amplifier
4. Ensure proper grounding of all equipment
