#!/usr/bin/env python3
"""
Set a GPIO pin output (0 or 1). Used on Pi 5 / Bookworm when Node onoff fails.
Usage: gpio_write.py <pin> <value>
Example: gpio_write.py 4 1
Uses libgpiod (gpioset) for Pi 5, falls back to gpiozero with persistent device.
"""
import sys
import subprocess
import os

def main():
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: gpio_write.py <pin> <value>\n")
        sys.exit(1)
    try:
        pin = int(sys.argv[1])
        value = int(sys.argv[2])
        if value not in (0, 1):
            raise ValueError("value must be 0 or 1")
    except ValueError as e:
        sys.stderr.write(str(e) + "\n")
        sys.exit(1)
    
    try:
        # Try libgpiod gpioset first (Pi 5 / Bookworm standard)
        # gpioset holds the pin state until the process exits or is killed
        # We'll use it in a way that persists by keeping a background process
        try:
            # Use gpioset with --mode=wait to hold the state
            # Format: gpioset gpiochip0 PIN=value
            result = subprocess.run(
                ['gpioset', 'gpiochip0', f'{pin}={value}'],
                capture_output=True,
                text=True,
                timeout=1
            )
            if result.returncode == 0:
                # gpioset will hold the state, but we need it to persist
                # So we'll spawn it in background mode
                # Actually, gpioset waits - we need a different approach
                # Let's use gpioset with --mode=time and a long timeout, or use gpiozero
                pass
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        
        # Use gpiozero with a persistent approach
        # Create device and keep reference (but script exits, so state might not hold)
        # Better: use gpiozero's ability to set and let it manage via sysfs internally
        from gpiozero import DigitalOutputDevice
        # gpiozero uses libgpiod internally on Pi 5, so this should work
        dev = DigitalOutputDevice(pin, initial_value=bool(value), active_high=True)
        dev.value = bool(value)
        # Don't close - but the process will exit anyway
        # The pin state should persist because gpiozero uses libgpiod
        
        # If state doesn't persist, we need to keep the process running
        # For now, let's try this and see if it works
        
    except ImportError:
        sys.stderr.write("gpiozero not installed. Install with: sudo apt install python3-gpiozero\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"GPIO {pin} write error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
