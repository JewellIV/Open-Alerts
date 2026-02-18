#!/usr/bin/env python3
"""
GPIO Manager - Keeps gpiozero devices open for persistent relay control.
Reads commands from stdin: "PIN VALUE" (e.g., "4 1" to set pin 4 to high).
"""
import sys
import os
import time

# Get pins from environment (avoid SPI 7,8,9,10,11; use 24 not 22 if GPIO 22 doesn't turn on)
ROOM_PINS = os.environ.get('ROOM_PINS', '4,5,6,12,13,16,21,24').split(',')
ROOM_PINS = [int(p.strip()) for p in ROOM_PINS if p.strip().isdigit()]

RELAY_ACTIVE_HIGH = os.environ.get('RELAY_ACTIVE_HIGH') == '1'

devices = {}

def init_pin(pin, active_high_setting):
    """Try to init one pin; retry once after short delay (helps Pi 5)."""
    try:
        dev = DigitalOutputDevice(pin, initial_value=False, active_high=active_high_setting)
        dev.value = False
        return dev
    except Exception as e:
        print(f"⚠️ GPIO {pin} init error: {e}", flush=True, file=sys.stderr)
        time.sleep(0.25)
        try:
            dev = DigitalOutputDevice(pin, initial_value=False, active_high=active_high_setting)
            dev.value = False
            print(f"✅ GPIO {pin} initialized on retry", flush=True)
            return dev
        except Exception as e2:
            print(f"❌ GPIO {pin} failed again: {e2}", flush=True, file=sys.stderr)
            return None

try:
    from gpiozero import DigitalOutputDevice
    
    # RELAY_ACTIVE_HIGH: "1" = relay ON when GPIO HIGH, "0" (default) = relay ON when GPIO LOW
    active_high_setting = RELAY_ACTIVE_HIGH
    for pin in ROOM_PINS:
        dev = init_pin(pin, active_high_setting)
        if dev is not None:
            devices[pin] = dev
            print(f"✅ GPIO {pin} initialized (active_high={active_high_setting})", flush=True)
    
    # Drive every pin LOW twice with short delay so output is firmly driven (no dim/floating LEDs)
    for _ in range(2):
        for pin, dev in devices.items():
            try:
                dev.value = False
            except Exception as e:
                print(f"⚠️ GPIO {pin} set-off error: {e}", flush=True, file=sys.stderr)
        time.sleep(0.05)
    
    ok_pins = sorted(devices.keys())
    failed = [p for p in ROOM_PINS if p not in devices]
    print(f"🚨 GPIO Manager ready for {len(devices)} pins (all driven LOW): {ok_pins}", flush=True)
    if failed:
        print(f"⚠️ Pins NOT initialized (will stay dim if used): {failed}", flush=True, file=sys.stderr)
    
    # Read commands from stdin: "PIN VALUE"
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            parts = line.split()
            if len(parts) != 2:
                continue
            
            pin = int(parts[0])
            value = int(parts[1])
            
            if pin in devices and value in (0, 1):
                # Server.js already applies RELAY_ACTIVE_HIGH logic, so use value as-is
                try:
                    old_value = devices[pin].value
                    devices[pin].value = bool(value)
                    new_value = devices[pin].value
                    print(f"✅ GPIO {pin}: {old_value} → {new_value} (requested {value})", flush=True)
                except Exception as e:
                    print(f"❌ GPIO {pin} write error: {e}", flush=True, file=sys.stderr)
            else:
                print(f"⚠️ Invalid pin {pin} or value {value}", flush=True, file=sys.stderr)
        except (ValueError, KeyError) as e:
            print(f"⚠️ Command error: {e}", flush=True, file=sys.stderr)
            
except ImportError:
    print("ERROR: gpiozero not installed. Install with: sudo apt install python3-gpiozero", flush=True, file=sys.stderr)
    sys.exit(1)
except KeyboardInterrupt:
    print("Shutting down GPIO Manager", flush=True)
    for dev in devices.values():
        try:
            dev.close()
        except:
            pass
    sys.exit(0)
