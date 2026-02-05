# Light Controller Integration Guide

Guide for connecting various alert lighting systems to the Fire Station Alert System.

## Currently Supported Interfaces

The system supports three types of light controllers:

1. **USB Serial** - Arduino-based or serial-controlled lights
2. **HTTP/REST API** - Network-enabled devices with HTTP endpoints
3. **Philips Hue** - Smart home lighting via Hue Bridge

## How to Determine Your Device Type

To connect your Amazon alert lighting system, please check:

### 1. Check Product Documentation

Look for:
- **Connection method:** USB, Ethernet, WiFi, Serial Port
- **Control protocol:** HTTP API, Serial commands, TCP/IP, Proprietary
- **Software/App:** Does it come with control software or an app?
- **API Documentation:** Check manufacturer's website for API docs

### 2. Common Alert Lighting System Types

**Type A: USB Serial Controlled**
- Connects via USB cable
- Uses serial commands (like Arduino)
- Usually controlled by simple text commands
- ✅ **Already Supported** - Use `VITE_LIGHT_TYPE=serial`

**Type B: HTTP API Controlled**
- Connects via network (Ethernet/WiFi)
- Has an IP address
- Controlled via HTTP POST/GET requests
- ✅ **Already Supported** - Use `VITE_LIGHT_TYPE=http`

**Type C: TCP/IP Socket Controlled**
- Connects via network
- Uses raw TCP/IP sockets
- May need custom integration
- ⚠️ **May need custom code** - See below

**Type D: Proprietary Protocol**
- Uses manufacturer-specific protocol
- May require SDK or special drivers
- ⚠️ **Needs custom integration** - See below

## Integration Steps

### Step 1: Identify Your Device

Please provide:
1. **Product name/model number**
2. **Connection method** (USB, Ethernet, WiFi)
3. **Control interface** (Serial, HTTP API, TCP/IP, Proprietary)
4. **API documentation** (if available)

### Step 2: Choose Integration Method

#### Method 1: USB Serial (If Supported)

If your device accepts serial commands:

1. **Configure:**
   ```env
   VITE_LIGHT_TYPE=serial
   ```

2. **Connect device via USB**

3. **Browser will prompt to select serial port**

4. **Device must accept these commands:**
   - `COLOR:red` - Set red color
   - `COLOR:blue` - Set blue color
   - `COLOR:off` - Turn off
   - `FLASH:red:500` - Flash red every 500ms
   - `FADEIN:red:5000` - Fade in red over 5 seconds

**Note:** If your device uses different commands, you may need to create an Arduino intermediary or modify the serial controller code.

#### Method 2: HTTP API (If Supported)

If your device has an HTTP API:

1. **Configure:**
   ```env
   VITE_LIGHT_TYPE=http
   VITE_LIGHT_HTTP_URL=http://192.168.1.XXX:PORT
   VITE_LIGHT_HTTP_API_KEY=your-api-key-if-needed
   ```

2. **Your device must accept HTTP POST requests to:**
   - `/status` (GET) - Health check
   - `/set-color` (POST) - Set color: `{"color": "red", "alertType": "fire"}`
   - `/flash` (POST) - Flash: `{"color": "red", "alertType": "fire", "duration": 30000}`
   - `/fade-in` (POST) - Fade in: `{"color": "red", "alertType": "fire", "fadeDuration": 5000}`
   - `/stop` (POST) - Stop: `{}`

**Note:** If your device uses different endpoints or request format, you may need to create a bridge service or modify the HTTP controller code.

#### Method 3: Custom Integration

If your device uses a different protocol, you can:

1. **Create a bridge service** (recommended)
2. **Add custom controller class** to the codebase
3. **Use existing HTTP controller** with a bridge

## Creating a Bridge Service

If your device doesn't match existing interfaces, create a simple bridge:

### Example: Bridge Service (Node.js)

Create a bridge that translates our HTTP API to your device's protocol:

```javascript
// bridge-service.js
const express = require('express');
const app = express();

app.use(express.json());

// Translate our API to your device's protocol
app.post('/set-color', async (req, res) => {
  const { color, alertType } = req.body;
  
  // Call your device's API here
  // Example: await yourDevice.setColor(color);
  
  res.json({ success: true });
});

app.post('/flash', async (req, res) => {
  const { color, alertType, duration } = req.body;
  
  // Implement flashing logic for your device
  // Example: await yourDevice.flash(color, duration);
  
  res.json({ success: true });
});

app.listen(8080, () => {
  console.log('Bridge service running on port 8080');
});
```

Then configure frontend to use the bridge:
```env
VITE_LIGHT_TYPE=http
VITE_LIGHT_HTTP_URL=http://localhost:8080
```

## Common Alert Lighting Systems

### Whelen Engineering Systems
- Usually use serial or proprietary protocols
- May need bridge service
- Check manufacturer documentation

### Federal Signal Systems
- Often use serial or network protocols
- May have HTTP API available
- Check product documentation

### Code 3 Systems
- Various interfaces depending on model
- Check specific product documentation

### Generic LED Controllers
- Many use USB serial (Arduino-compatible)
- Usually work with serial controller
- May need command translation

## Getting Help

To add support for your specific device, please provide:

1. **Product Information:**
   - Manufacturer name
   - Model number
   - Product link or documentation

2. **Technical Details:**
   - Connection method (USB, Ethernet, WiFi)
   - Control protocol (Serial, HTTP, TCP/IP, Proprietary)
   - API documentation or command reference
   - Example commands/code (if available)

3. **Current Setup:**
   - How do you currently control it?
   - What software/app does it use?
   - Any existing integration examples?

## Quick Test

To test if your device might work:

1. **For USB Serial devices:**
   - Connect via USB
   - Try configuring: `VITE_LIGHT_TYPE=serial`
   - Browser will prompt for port selection
   - Check browser console for connection status

2. **For Network devices:**
   - Find device IP address
   - Try accessing: `http://DEVICE_IP/status` or similar
   - Check device documentation for API endpoints
   - Configure: `VITE_LIGHT_TYPE=http`

3. **Check device documentation:**
   - Look for "API", "Integration", "Developer", or "SDK" sections
   - Check for HTTP endpoints or serial command references
   - Look for example code or integration guides

## Next Steps

1. **Share product details** - Manufacturer, model, connection method
2. **Check documentation** - Look for API or control interface info
3. **Test existing interfaces** - Try serial or HTTP if applicable
4. **Create bridge if needed** - Simple service to translate protocols

Once you provide the product details, I can help create a custom integration or guide you through the setup process!
