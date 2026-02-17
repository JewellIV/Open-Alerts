#!/usr/bin/env node
/**
 * Room GPIO Service - Run on EACH room Pi.
 * Controls local relays only. Does NOT use a database.
 * Central OpenAlerts backend (engine bay Pi) owns the single .db for alerts/notices/units.
 *
 * Env:
 *   ROOM_PINS   - Comma-separated GPIO BCM numbers (e.g. "4,5,6,7,8,9,10,11")
 *   GPIO_PORT   - Port to listen on (default 4000)
 *   RELAY_ACTIVE_HIGH - Set to "1" if relay is on when pin is high (default 0 = low = relay on)
 *   USE_PYTHON_GPIO - Set to "1" to use Python gpiozero (for Pi 5 / Bookworm when onoff fails)
 */

const express = require('express');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const ROOM_PINS = process.env.ROOM_PINS
  ? process.env.ROOM_PINS.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n))
  : [4, 5, 6, 7, 8, 9, 10, 11];

const PORT = process.env.GPIO_PORT ? parseInt(process.env.GPIO_PORT, 10) : 4000;
const RELAY_ACTIVE_HIGH = process.env.RELAY_ACTIVE_HIGH === '1';

let Gpio;
let relays = new Map();
let usePythonGpio = process.env.USE_PYTHON_GPIO === '1';
const gpioWriteScript = path.join(__dirname, 'gpio_write.py');

try {
  Gpio = require('onoff').Gpio;
} catch (err) {
  console.warn('⚠️ onoff not available (not on Pi?). GPIO disabled.');
}

if (Gpio && process.platform === 'linux' && !usePythonGpio) {
  ROOM_PINS.forEach((pin) => {
    try {
      const r = new Gpio(pin, 'out');
      relays.set(pin, r);
      console.log(`✅ Relay GPIO ${pin} opened (onoff)`);
    } catch (err) {
      console.warn(`⚠️ GPIO ${pin}: ${err.message}`);
    }
  });
  if (relays.size === 0 && ROOM_PINS.length > 0) {
    console.warn('⚠️ onoff failed for all pins; falling back to Python gpiozero (Pi 5 / Bookworm).');
    usePythonGpio = true;
  }
} else if (Gpio && !usePythonGpio) {
  console.warn('⚠️ Not Linux - GPIO not initialized');
}

if (usePythonGpio && process.platform === 'linux') {
  console.log('📌 Using Python gpiozero for GPIO (set USE_PYTHON_GPIO=1 or auto fallback).');
}

function writePin(pin, mute) {
  const value = RELAY_ACTIVE_HIGH ? (mute ? 1 : 0) : (mute ? 0 : 1);
  if (usePythonGpio) {
    try {
      execSync(`python3 "${gpioWriteScript}" ${pin} ${value}`, { stdio: 'pipe', timeout: 2000 });
      return true;
    } catch (err) {
      console.warn(`GPIO ${pin} write error (python):`, err.message);
      return false;
    }
  }
  const relay = relays.get(pin);
  if (!relay) return false;
  try {
    relay.writeSync(value);
    return true;
  } catch (err) {
    console.warn(`GPIO ${pin} write error (onoff):`, err.message);
    usePythonGpio = true;
    console.warn('⚠️ Switching to Python gpiozero for GPIO.');
    return writePin(pin, mute);
  }
}

// POST /gpio/mute   { pins?: number[], mute: boolean }
app.post('/gpio/mute', (req, res) => {
  const { pins, mute } = req.body || {};
  if (typeof mute !== 'boolean') {
    return res.status(400).json({ error: 'mute (boolean) is required' });
  }

  const targetPins = Array.isArray(pins) && pins.length > 0 ? pins : ROOM_PINS;
  const changed = [];
  for (const pin of targetPins) {
    if (writePin(pin, mute)) changed.push(pin);
  }

  return res.json({ success: true, mute, pins: changed });
});

// GET /gpio/status
app.get('/gpio/status', (_req, res) => {
  const status = [];
  const pinList = usePythonGpio ? ROOM_PINS : Array.from(relays.keys());
  for (const pin of pinList) {
    let value = -1;
    if (!usePythonGpio) {
      const relay = relays.get(pin);
      if (relay) {
        try {
          value = relay.readSync();
        } catch (_) {}
      }
    }
    status.push({ pin, value });
  }
  res.json({ success: true, pins: ROOM_PINS, status });
});

// Health for systemd
app.get('/health', (_req, res) => {
  res.json({ ok: true, pins: ROOM_PINS });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚨 Room GPIO service on http://0.0.0.0:${PORT}  pins: [${ROOM_PINS.join(', ')}]`);
});
