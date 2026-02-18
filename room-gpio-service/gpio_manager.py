#!/usr/bin/env python3
"""
GPIO Manager - Keeps gpiozero devices open for persistent relay control.
Reads commands from stdin: "PIN VALUE" (e.g., "4 1" to set pin 4 to high).
"""
import sys
import os

# Get pins from environment
ROOM_PINS = os.environ.get('ROOM_PINS', '4,5,6,7,8,9,21,22').split(',')
ROOM_PINS = [int(p.strip()) for p in ROOM_PINS if p.strip().isdigit()]

RELAY_ACTIVE_HIGH = os.environ.get('RELAY_ACTIVE_HIGH') == '1'

devices = {}

try:
    from gpiozero import DigitalOutputDevice
    
    # Initialize all devices and keep them open
    for pin in ROOM_PINS:
        try:
            dev = DigitalOutputDevice(pin, initial_value=False, active_high=True)
            devices[pin] = dev
            print(f"✅ GPIO {pin} initialized", flush=True)
        except Exception as e:
            print(f"⚠️ GPIO {pin} init error: {e}", flush=True, file=sys.stderr)
    
    print(f"🚨 GPIO Manager ready for {len(devices)} pins", flush=True)
    
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
                devices[pin].value = bool(value)
                print(f"✅ GPIO {pin} = {value}", flush=True)
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
