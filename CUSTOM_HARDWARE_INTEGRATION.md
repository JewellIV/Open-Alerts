# Custom Hardware Integration Guide

This guide explains how to integrate custom hardware with OpenAlerts. The system supports multiple hardware interfaces, making it easy to connect custom-built devices.

## Supported Hardware Interfaces

OpenAlerts supports three main hardware interfaces:

1. **GPIO/Relay Control** - Raspberry Pi GPIO pins (digital I/O)
2. **USB Serial** - Serial communication over USB
3. **HTTP/REST API** - Network-based control via HTTP requests

---

## Interface 1: GPIO/Relay Control (Raspberry Pi)

**Best for:** Custom relay boards, LED controllers, motor controllers, sensors

### How It Works

- Backend runs on Raspberry Pi
- Uses `onoff` library for GPIO control
- Direct pin control (digital high/low)
- Supports relays, LEDs, motors, sensors

### Current GPIO Usage

- **GPIO 18** - Amplifier relay (reserved)
- **GPIO 23** - Radio relay (reserved)
- **GPIO 4-9, 21-22** - Unit speaker relays (dynamic assignment)
- **GPIO 10-17, 19-20, 24-27** - Available for custom hardware

### Example: Custom LED Controller

**Hardware:**
- Raspberry Pi 5
- Custom LED controller board
- LEDs connected to GPIO pins

**Backend Code:**

Add to `src/index.ts`:

```typescript
// Custom LED Controller
let customLEDRelay: any = null;

// Initialize custom LED on GPIO 10
if (process.platform === 'linux') {
  try {
    const { Gpio } = require('onoff');
    customLEDRelay = new Gpio(10, 'out');
    customLEDRelay.writeSync(0); // Start OFF
    console.log('✅ Custom LED controller initialized on GPIO 10');
  } catch (error) {
    console.warn('⚠️ Custom LED controller not available:', error);
  }
}

// Control custom LED during alerts
app.post('/api/custom-led/:state', validateApiKey, (req: Request, res: Response) => {
  try {
    const { state } = req.params; // 'on' or 'off'
    if (customLEDRelay) {
      customLEDRelay.writeSync(state === 'on' ? 1 : 0);
      res.json({ success: true, state });
    } else {
      res.status(503).json({ error: 'Custom LED controller not available' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to control LED' });
  }
});
```

**Frontend Integration:**

Add to `frontend/src/utils/lightController.ts` or create new controller:

```typescript
export async function controlCustomLED(state: 'on' | 'off'): Promise<void> {
  const backendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000';
  const apiKey = localStorage.getItem('apiKey');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  await fetch(`${backendUrl}/api/custom-led/${state}`, {
    method: 'POST',
    headers
  });
}
```

### Example: Custom Motor Controller

**Hardware:**
- Raspberry Pi 5
- Motor driver board (L298N, DRV8825, etc.)
- Stepper/servo motor

**Backend Code:**

```typescript
// Custom Motor Controller
let motorDirectionPin: any = null;
let motorStepPin: any = null;

if (process.platform === 'linux') {
  try {
    const { Gpio } = require('onoff');
    motorDirectionPin = new Gpio(11, 'out'); // Direction pin
    motorStepPin = new Gpio(12, 'out'); // Step pin
    console.log('✅ Custom motor controller initialized');
  } catch (error) {
    console.warn('⚠️ Motor controller not available:', error);
  }
}

// Control motor
app.post('/api/custom-motor/rotate', validateApiKey, (req: Request, res: Response) => {
  try {
    const { direction, steps } = req.body; // 'forward'/'reverse', number of steps
    if (motorDirectionPin && motorStepPin) {
      motorDirectionPin.writeSync(direction === 'forward' ? 1 : 0);
      // Step motor
      for (let i = 0; i < steps; i++) {
        motorStepPin.writeSync(1);
        setTimeout(() => motorStepPin.writeSync(0), 1);
      }
      res.json({ success: true, direction, steps });
    } else {
      res.status(503).json({ error: 'Motor controller not available' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to control motor' });
  }
});
```

---

## Interface 2: USB Serial Communication

**Best for:** Arduino-based devices, custom microcontrollers, serial devices

### How It Works

- Frontend uses Web Serial API (browser-based)
- Sends/receives text commands over USB serial
- Works with Arduino, ESP32, Raspberry Pi Pico, etc.

### Example: Custom Arduino Device

**Hardware:**
- Arduino Uno/Nano/ESP32
- Custom sensors or actuators
- USB connection to computer

**Arduino Code:**

```cpp
// Custom Hardware Controller for OpenAlerts
// Receives commands via Serial (9600 baud)

String command = "";
bool alertActive = false;

void setup() {
  Serial.begin(9600);
  
  // Initialize your custom hardware here
  pinMode(13, OUTPUT); // Example: LED on pin 13
  pinMode(9, OUTPUT);  // Example: Buzzer on pin 9
  
  Serial.println("READY"); // Signal ready to receive commands
}

void loop() {
  if (Serial.available() > 0) {
    command = Serial.readStringUntil('\n');
    command.trim();
    
    // Parse commands
    if (command == "ALERT:FIRE") {
      alertActive = true;
      digitalWrite(13, HIGH); // LED on
      tone(9, 1000); // Buzzer on
      Serial.println("OK:ALERT_ACTIVE");
    }
    else if (command == "ALERT:EMS") {
      alertActive = true;
      digitalWrite(13, HIGH);
      tone(9, 800);
      Serial.println("OK:ALERT_ACTIVE");
    }
    else if (command == "ALERT:CLEAR") {
      alertActive = false;
      digitalWrite(13, LOW); // LED off
      noTone(9); // Buzzer off
      Serial.println("OK:ALERT_CLEARED");
    }
    else if (command.startsWith("CUSTOM:")) {
      // Handle custom commands
      String customCmd = command.substring(7);
      // Process custom command
      Serial.println("OK:CUSTOM_PROCESSED");
    }
  }
}
```

**Frontend Integration:**

Create `frontend/src/utils/customHardwareController.ts`:

```typescript
/**
 * Custom Hardware Controller via Serial
 */

let serialPort: SerialPort | null = null;
let reader: ReadableStreamDefaultReader | null = null;

export async function initializeCustomHardware(): Promise<void> {
  try {
    // Request serial port access
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    
    // Set up reader for responses
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();
    
    console.log('✅ Custom hardware connected via Serial');
    
    // Read responses in background
    readSerialResponses();
  } catch (error) {
    console.error('Failed to connect to custom hardware:', error);
    throw error;
  }
}

async function readSerialResponses(): Promise<void> {
  if (!reader) return;
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const response = value.trim();
      console.log('Custom hardware response:', response);
      
      // Handle responses
      if (response.startsWith('OK:')) {
        console.log('✅ Custom hardware:', response);
      } else if (response.startsWith('ERROR:')) {
        console.error('❌ Custom hardware error:', response);
      }
    }
  } catch (error) {
    console.error('Error reading serial:', error);
  }
}

export async function sendCustomCommand(command: string): Promise<void> {
  if (!serialPort || !serialPort.writable) {
    throw new Error('Serial port not connected');
  }
  
  const writer = serialPort.writable.getWriter();
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(command + '\n'));
  writer.releaseLock();
}

export async function sendAlertToCustomHardware(alertType: 'fire' | 'ems'): Promise<void> {
  try {
    const command = alertType === 'fire' ? 'ALERT:FIRE' : 'ALERT:EMS';
    await sendCustomCommand(command);
  } catch (error) {
    console.error('Failed to send alert to custom hardware:', error);
  }
}

export async function clearCustomHardwareAlert(): Promise<void> {
  try {
    await sendCustomCommand('ALERT:CLEAR');
  } catch (error) {
    console.error('Failed to clear custom hardware alert:', error);
  }
}
```

**Integration in App.tsx:**

```typescript
import { sendAlertToCustomHardware, clearCustomHardwareAlert } from './utils/customHardwareController'

// In alert handler:
if (currentAlert) {
  const alertType = getCallTypeCategory(currentAlert.call_type) === 'fire' ? 'fire' : 'ems';
  await sendAlertToCustomHardware(alertType);
}

// When alert dismisses:
await clearCustomHardwareAlert();
```

---

## Interface 3: HTTP/REST API

**Best for:** Network-enabled devices, ESP32/ESP8266 with WiFi, Raspberry Pi devices, IoT devices

### How It Works

- Device connects to network (WiFi/Ethernet)
- Device runs HTTP server
- OpenAlerts sends HTTP requests to device
- Device responds with status

### Example: Custom ESP32 WiFi Device

**Hardware:**
- ESP32 development board
- WiFi connectivity
- Custom sensors/actuators

**ESP32 Code (Arduino IDE):**

```cpp
#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);

bool alertActive = false;
String alertType = "";

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to WiFi. IP: ");
  Serial.println(WiFi.localIP());
  
  // Initialize hardware
  pinMode(2, OUTPUT); // Built-in LED
  pinMode(4, OUTPUT); // Custom output pin
  
  // HTTP endpoints
  server.on("/status", handleStatus);
  server.on("/alert", HTTP_POST, handleAlert);
  server.on("/clear", HTTP_POST, handleClear);
  server.on("/custom", HTTP_POST, handleCustom);
  
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
}

void handleStatus() {
  server.send(200, "application/json", 
    "{\"status\":\"ok\",\"alertActive\":" + String(alertActive) + "}");
}

void handleAlert() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    
    // Parse JSON (simple parsing)
    if (body.indexOf("\"type\":\"fire\"") >= 0) {
      alertType = "fire";
      digitalWrite(2, HIGH); // LED on
      digitalWrite(4, HIGH); // Custom output
      alertActive = true;
    } else if (body.indexOf("\"type\":\"ems\"") >= 0) {
      alertType = "ems";
      digitalWrite(2, HIGH);
      digitalWrite(4, LOW); // Different pattern for EMS
      alertActive = true;
    }
    
    server.send(200, "application/json", "{\"success\":true}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
  }
}

void handleClear() {
  alertActive = false;
  alertType = "";
  digitalWrite(2, LOW);
  digitalWrite(4, LOW);
  server.send(200, "application/json", "{\"success\":true}");
}

void handleCustom() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    // Process custom command
    server.send(200, "application/json", "{\"success\":true}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
  }
}
```

**Backend Integration:**

Add to `src/index.ts`:

```typescript
// Custom Hardware HTTP Controller
const CUSTOM_HARDWARE_URL = process.env.CUSTOM_HARDWARE_URL; // e.g., http://192.168.1.100

app.post('/api/custom-hardware/alert', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { alertType } = req.body; // 'fire' or 'ems'
    
    if (!CUSTOM_HARDWARE_URL) {
      return res.status(503).json({ error: 'Custom hardware not configured' });
    }
    
    const response = await fetch(`${CUSTOM_HARDWARE_URL}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: alertType })
    });
    
    if (response.ok) {
      res.json({ success: true, message: 'Alert sent to custom hardware' });
    } else {
      res.status(502).json({ error: 'Custom hardware not responding' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to communicate with custom hardware' });
  }
});

app.post('/api/custom-hardware/clear', validateApiKey, async (req: Request, res: Response) => {
  try {
    if (!CUSTOM_HARDWARE_URL) {
      return res.status(503).json({ error: 'Custom hardware not configured' });
    }
    
    await fetch(`${CUSTOM_HARDWARE_URL}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to communicate with custom hardware' });
  }
});
```

**Frontend Integration:**

```typescript
// In App.tsx or custom controller
async function sendAlertToCustomHardware(alertType: 'fire' | 'ems') {
  const backendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000';
  const apiKey = localStorage.getItem('apiKey');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  await fetch(`${backendUrl}/api/custom-hardware/alert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ alertType })
  });
}
```

---

## Custom Hardware Examples

### Example 1: Custom Siren Controller

**Hardware:**
- Raspberry Pi GPIO → Relay → Siren
- Or ESP32 with relay module

**Integration:**
- GPIO: Use GPIO endpoint (like LED example above)
- HTTP: Use HTTP API endpoint (like ESP32 example)

### Example 2: Custom Display Board

**Hardware:**
- LED matrix display
- Controlled via serial or HTTP

**Integration:**
- Serial: Send display commands via serial
- HTTP: POST display data to device API

### Example 3: Custom Sensor Integration

**Hardware:**
- Temperature sensors
- Motion detectors
- Door sensors

**Integration:**
- GPIO: Read sensor values from GPIO pins
- HTTP: Device sends sensor data to OpenAlerts API
- Serial: Device sends sensor readings via serial

### Example 4: Custom Actuator Control

**Hardware:**
- Motorized doors/gates
- Automated equipment
- Pneumatic systems

**Integration:**
- GPIO: Control via relay on GPIO pin
- HTTP: Send control commands to device API
- Serial: Send control commands via serial

---

## Integration Checklist

### For GPIO-Based Hardware:

- [ ] Hardware connects to Raspberry Pi GPIO pins
- [ ] Add GPIO initialization code to `src/index.ts`
- [ ] Create API endpoint for hardware control
- [ ] Add frontend controller (if needed)
- [ ] Test GPIO pin assignment (check conflicts)
- [ ] Document pin assignments

### For Serial-Based Hardware:

- [ ] Hardware supports USB Serial communication
- [ ] Create serial controller in `frontend/src/utils/`
- [ ] Implement command protocol
- [ ] Add initialization in App.tsx
- [ ] Handle browser serial port permissions
- [ ] Test serial communication

### For HTTP-Based Hardware:

- [ ] Hardware has network connectivity
- [ ] Hardware runs HTTP server
- [ ] Define API endpoints on hardware
- [ ] Add backend proxy endpoints (optional)
- [ ] Configure hardware URL in `.env`
- [ ] Test HTTP communication

---

## API Endpoint Patterns

### GPIO Control Pattern

```typescript
app.post('/api/custom-device/:action', validateApiKey, (req: Request, res: Response) => {
  try {
    const { action } = req.params;
    const pin = 10; // Your GPIO pin
    
    if (customDeviceRelay) {
      customDeviceRelay.writeSync(action === 'on' ? 1 : 0);
      res.json({ success: true, action });
    } else {
      res.status(503).json({ error: 'Device not available' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to control device' });
  }
});
```

### HTTP Proxy Pattern

```typescript
app.post('/api/custom-device/:endpoint', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.params;
    const deviceUrl = process.env.CUSTOM_DEVICE_URL;
    
    const response = await fetch(`${deviceUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Device communication failed' });
  }
});
```

---

## Configuration

### Environment Variables

Add to `.env`:

```env
# Custom Hardware Configuration
CUSTOM_HARDWARE_URL=http://192.168.1.100
CUSTOM_HARDWARE_API_KEY=your-api-key-if-needed
CUSTOM_HARDWARE_GPIO_PIN=10
```

### Frontend Configuration

Add to `frontend/.env`:

```env
VITE_CUSTOM_HARDWARE_ENABLED=true
VITE_CUSTOM_HARDWARE_TYPE=gpio|serial|http
VITE_CUSTOM_HARDWARE_URL=http://192.168.1.100
```

---

## Testing Custom Hardware

### GPIO Testing

```bash
# Test GPIO pin directly (Raspberry Pi)
gpio -g mode 10 out
gpio -g write 10 1  # Turn on
gpio -g write 10 0  # Turn off
```

### Serial Testing

```bash
# Test serial communication
screen /dev/ttyUSB0 9600
# Or use Arduino Serial Monitor
```

### HTTP Testing

```bash
# Test HTTP endpoint
curl -X POST http://192.168.1.100/alert \
  -H "Content-Type: application/json" \
  -d '{"type":"fire"}'
```

---

## Best Practices

1. **Error Handling:** Always handle hardware failures gracefully
2. **Logging:** Log all hardware interactions for debugging
3. **Fallback:** System should work even if custom hardware fails
4. **Documentation:** Document pin assignments and protocols
5. **Testing:** Test hardware integration thoroughly before deployment
6. **Security:** Use API keys for HTTP-based hardware
7. **Isolation:** Don't let hardware failures crash the main system

---

## Getting Help

If you need help integrating custom hardware:

1. **Identify your hardware:**
   - Connection method (GPIO, Serial, HTTP)
   - Control protocol
   - Available documentation

2. **Choose integration method:**
   - GPIO for Raspberry Pi direct control
   - Serial for USB-connected devices
   - HTTP for network-enabled devices

3. **Implement following examples above**

4. **Test thoroughly**

5. **Document your integration**

---

## Examples of Custom Hardware You Can Build

- **Custom LED arrays** - Multi-color LED displays
- **Siren controllers** - Physical sirens with different tones
- **Motorized equipment** - Automated doors, gates, equipment
- **Sensor arrays** - Temperature, motion, door sensors
- **Display boards** - LED matrix, LCD displays
- **Haptic feedback** - Vibration motors for alerts
- **Custom switches** - Physical buttons/controls
- **Environmental controls** - HVAC, lighting systems

**The sky's the limit!** Any device that can be controlled via GPIO, Serial, or HTTP can be integrated with OpenAlerts.
