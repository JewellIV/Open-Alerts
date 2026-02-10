#!/usr/bin/env python3
"""
LED Ring Controller for WS2812B RGB LEDs
Controls RGB LED rings via Raspberry Pi GPIO

Usage:
    python3 led_ring_controller.py fire          # Flash red for fire alerts
    python3 led_ring_controller.py ems            # Flash blue for EMS alerts
    python3 led_ring_controller.py set <r> <g> <b>  # Set solid color
    python3 led_ring_controller.py flash <r> <g> <b> [duration]  # Flash color
    python3 led_ring_controller.py off           # Turn off LEDs
"""

import sys
import time
import os

# Try to import rpi_ws281x library
try:
    import rpi_ws281x
    WS281X_AVAILABLE = True
except ImportError:
    WS281X_AVAILABLE = False
    print("Warning: rpi-ws281x library not installed. Install with: sudo pip3 install rpi-ws281x", file=sys.stderr)

# LED strip configuration
LED_COUNT = int(os.environ.get('LED_RING_COUNT', '24'))        # Number of LED pixels
LED_PIN = int(os.environ.get('LED_RING_PIN', '18'))            # GPIO pin (PWM)
LED_FREQ_HZ = 800000  # LED signal frequency
LED_DMA = 10          # DMA channel
LED_BRIGHTNESS = int(os.environ.get('LED_RING_BRIGHTNESS', '128'))  # Brightness (0-255)
LED_INVERT = False    # Invert signal
LED_CHANNEL = 0       # PWM channel

def set_color(strip, r, g, b):
    """Set all LEDs to a color"""
    if not WS281X_AVAILABLE or not strip:
        return
    color = rpi_ws281x.Color(r, g, b)
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, color)
    strip.show()

def flash_color(strip, r, g, b, duration_seconds):
    """Flash LEDs for specified duration"""
    if not WS281X_AVAILABLE or not strip:
        return
    end_time = time.time() + duration_seconds
    while time.time() < end_time:
        set_color(strip, r, g, b)
        time.sleep(0.5)
        set_color(strip, 0, 0, 0)
        time.sleep(0.5)

if __name__ == '__main__':
    # Create NeoPixel object if library is available
    strip = None
    if WS281X_AVAILABLE:
        try:
            strip = rpi_ws281x.Adafruit_NeoPixel(
                LED_COUNT, LED_PIN, LED_FREQ_HZ, 
                LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL
            )
            strip.begin()
        except Exception as e:
            print(f"Error initializing LED strip: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("LED ring library not available - install rpi-ws281x", file=sys.stderr)
        sys.exit(1)
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python3 led_ring_controller.py <action> [r] [g] [b] [duration]", file=sys.stderr)
        sys.exit(1)
    
    action = sys.argv[1].lower()
    
    try:
        if action == 'fire':
            # Flash red for fire alerts (2 minutes)
            flash_color(strip, 255, 0, 0, 120)
        elif action == 'ems':
            # Flash blue for EMS alerts (2 minutes)
            flash_color(strip, 0, 0, 255, 120)
        elif action == 'set':
            if len(sys.argv) < 5:
                print("Usage: python3 led_ring_controller.py set <r> <g> <b>", file=sys.stderr)
                sys.exit(1)
            r = int(sys.argv[2])
            g = int(sys.argv[3])
            b = int(sys.argv[4])
            set_color(strip, r, g, b)
        elif action == 'flash':
            if len(sys.argv) < 5:
                print("Usage: python3 led_ring_controller.py flash <r> <g> <b> [duration]", file=sys.stderr)
                sys.exit(1)
            r = int(sys.argv[2])
            g = int(sys.argv[3])
            b = int(sys.argv[4])
            duration = int(sys.argv[5]) if len(sys.argv) > 5 else 5
            flash_color(strip, r, g, b, duration)
        elif action == 'off':
            set_color(strip, 0, 0, 0)
        else:
            print(f"Unknown action: {action}", file=sys.stderr)
            sys.exit(1)
    except ValueError as e:
        print(f"Invalid argument: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error controlling LEDs: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Cleanup - turn off LEDs
        if strip:
            set_color(strip, 0, 0, 0)
