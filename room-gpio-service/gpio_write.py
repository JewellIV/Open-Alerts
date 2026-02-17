#!/usr/bin/env python3
"""
Set a GPIO pin output (0 or 1). Used on Pi 5 / Bookworm when Node onoff fails.
Usage: gpio_write.py <pin> <value>
Example: gpio_write.py 4 1
Requires: gpiozero (sudo apt install python3-gpiozero)
"""
import sys

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
        from gpiozero import DigitalOutputDevice
        dev = DigitalOutputDevice(pin, initial_value=bool(value))
        dev.value = bool(value)
        dev.close()
    except Exception as e:
        sys.stderr.write(str(e) + "\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
