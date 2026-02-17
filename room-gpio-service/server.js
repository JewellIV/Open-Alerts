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
 */

const express = require('express');
const app = express();
app.use(express.json());

const ROOM_PINS = process.env.ROOM_PINS
  ? process.env.ROOM_PINS.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n))
  : [4, 5, 6, 7, 8, 9, 10, 11];

const PORT = process.env.GPIO_PORT ? parseInt(process.env.GPIO_PORT, 10) : 4000;
const RELAY_ACTIVE_HIGH = process.env.RELAY_ACTIVE_HIGH === '1';

let Gpio;
let relays = new Map();

try {
  Gpio = require('onoff').Gpio;
} catch (err) {
  console.warn('⚠️ onoff not available (not on Pi?). GPIO disabled.');
}

if (Gpio && process.platform === 'linux') {
  ROOM_PINS.forEach((pin) => {
    try {
      const r = new Gpio(pin, 'out');
      r.writeSync(RELAY_ACTIVE_HIGH ? 0 : 0); // start unmuted (relay off)
      relays.set(pin, r);
      console.log(`✅ Relay GPIO ${pin} initialized`);
    } catch (err) {
      console.warn(`⚠️ GPIO ${pin}: ${err.message}`);
    }
  });
} else if (Gpio) {
  console.warn('⚠️ Not Linux - GPIO not initialized');
}

function writePin(pin, mute) {
  const relay = relays.get(pin);
  if (!relay) return false;
  try {
    // mute = relay energized. RELAY_ACTIVE_HIGH=1 means high = on.
    const value = RELAY_ACTIVE_HIGH ? (mute ? 1 : 0) : (mute ? 0 : 1);
    relay.writeSync(value);
    return true;
  } catch (err) {
    console.warn(`GPIO ${pin} write error:`, err.message);
    return false;
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
  for (const [pin, relay] of relays.entries()) {
    let value = -1;
    try {
      value = relay.readSync();
    } catch (_) {}
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
