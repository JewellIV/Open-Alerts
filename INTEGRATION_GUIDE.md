# Integration Guide: Receiving Dispatch Alerts

This guide explains how to receive alerts from dispatch systems and integrate with mobile alerting solutions like Resgrid.

## Current System Architecture

Your OpenAlerts system receives alerts via REST API endpoints:

### Standard Endpoint
**Endpoint:** `POST http://localhost:3000/api/alert`

**Required JSON Format:**
```json
{
  "call_type": "Structure Fire",
  "address": "123 Main St, Aylett, VA 23009",
  "units": "Engine 1, Ladder 2",
  "narrative": "Reported structure fire with smoke visible"
}
```

### ActiveAlerts Webhook Endpoint (Auto-Conversion)
**Endpoint:** `POST http://localhost:3000/api/webhook/activealerts`

This endpoint automatically converts ActiveAlerts/Active911 format to OpenAlerts format. Just point your ActiveAlerts webhook here!

## Methods to Receive Dispatch Alerts

### Option 1: TwoToneDetect Integration (Recommended for Radio Dispatch)

[TwoToneDetect](https://www.twotonedetect.org/) is a free, open-source tool that monitors radio frequencies and detects two-tone paging sequences.

**Setup Steps:**

1. **Install TwoToneDetect** on a computer with a radio scanner
2. **Configure Webhook** in TwoToneDetect settings:
   - Webhook URL: `http://YOUR_SERVER_IP:3000/api/alert`
   - Method: POST
   - Format: JSON
   - Map fields:
     - `call_type` → Alert Type
     - `address` → Address
     - `units` → Units Dispatched
     - `narrative` → Full Message

3. **Test:** Send a test page and verify it appears on your dashboard

**TwoToneDetect Webhook Configuration Example:**
```
URL: http://192.168.1.100:3000/api/alert
Method: POST
Content-Type: application/json
Body Template:
{
  "call_type": "{ALERT_TYPE}",
  "address": "{ADDRESS}",
  "units": "{UNITS}",
  "narrative": "{FULL_MESSAGE}"
}
```

#### Receiving Admin Messages from TwoToneDetect

TwoToneDetect does not have built-in webhook support. To receive **admin pages** (or any tone set) in OpenAlerts, use the `alert_command` in your `tones.cfg` to run a script that POSTs to the API.

**Included scripts:** `scripts/twotonedetect-alert.py` (Python) or `scripts/twotonedetect-alert.ps1` (PowerShell)

**Setup:**

1. **Copy the script** to your TwoToneDetect computer (or a shared location).
2. **Edit the configuration** at the top of the script:
   - **Python:** `SERVER_URL` and `API_KEY`
   - **PowerShell:** `$serverUrl` and `$apiKey`
   - Set to your OpenAlerts server (e.g. `http://192.168.1.100:3000`), leave API key empty if not used
3. **Add an admin tone set** in `tones.cfg`:
   ```ini
   [ToneSet7]
   Tone1 = 1000          # Your admin tone 1 frequency (Hz)
   Tone2 = 800           # Your admin tone 2 frequency (Hz)
   Tone1Length = 2
   Tone2Length = 2
   description = Admin Page
   # Python:
   alert_command = python C:\path\to\scripts\twotonedetect-alert.py admin
   # Or PowerShell:
   # alert_command = C:\path\to\scripts\twotonedetect-alert.ps1 admin
   ```
4. **For regular dispatch** tone sets, use the script without the `admin` parameter:
   ```ini
   alert_command = python C:\path\to\scripts\twotonedetect-alert.py
   ```

**Usage:**
- `twotonedetect-alert.py admin` → Sends as "Admin Page" to OpenAlerts
- `twotonedetect-alert.py` → Sends as generic "Dispatch"
- `twotonedetect-alert.py "EMS Rescue"` → Sends with custom call type

#### Sending Alerts WITH Recording (Record First, Then Send)

To **record the voice dispatch** before sending the alert, use `post_email_command` instead of `alert_command`. TwoToneDetect records the message after the tones, then runs your script with the recording file path.

**tones.cfg setup:**
```ini
[ToneSet1]
Tone1 = 1000
Tone2 = 800
Tone1Length = 2
Tone2Length = 2
description = Structure Fire
# Use post_email_command - runs AFTER recording is saved
post_email_command = python C:\path\to\scripts\twotonedetect-alert.py "Structure Fire" [mp3]
```

TwoToneDetect substitutes `[mp3]` with the path to the recorded file. Use `[wav]` or `[amr]` if your TTD config uses those formats.

**What happens:**
1. TwoToneDetect detects tones
2. TwoToneDetect records the voice message
3. TwoToneDetect runs the script with the recording path
4. Script uploads alert + recording to OpenAlerts
5. Dashboard displays the alert with an audio player to hear the recording

Recordings are stored in the `recordings/` folder and served at `/recordings/filename.mp3`.

### Option 2: ActiveAlerts/Active911 Integration

**Yes! You can forward alerts from ActiveAlerts/Active911 directly to OpenAlerts.**

OpenAlerts includes a dedicated webhook endpoint that automatically converts ActiveAlerts format to OpenAlerts format.

**Setup Steps:**

1. **In ActiveAlerts/Active911:**
   - Go to Settings → Integrations → Webhooks
   - Create a new webhook
   - **Webhook URL:** `http://YOUR_SERVER_IP:3000/api/webhook/activealerts`
   - **Method:** POST
   - **Format:** JSON

2. **That's it!** The system automatically:
   - Receives ActiveAlerts webhook
   - Transforms it to OpenAlerts format
   - Saves to database
   - Displays on dashboard
   - Plays audio/TTS alerts

**Supported ActiveAlerts Fields:**
- `type`, `call_type`, `incident_type`, `nature` → Maps to `call_type`
- `address`, `location`, `full_address`, `street`+`city`+`state`+`zip` → Maps to `address`
- `units`, `unit`, `dispatched_units`, `responding_units`, `units_array` → Maps to `units`
- `message`, `narrative`, `description`, `notes`, `call_notes` → Maps to `narrative`

**Example ActiveAlerts Webhook:**
```json
{
  "type": "Structure Fire",
  "address": "123 Main St",
  "city": "Aylett",
  "state": "VA",
  "zip": "23009",
  "units": "Engine 1, Ladder 2",
  "message": "Reported structure fire"
}
```

### Option 3: Other CAD System Integration

If you have a Computer-Aided Dispatch (CAD) system, you can configure it to send webhooks:

**Common CAD Systems:**
- **Resgrid** (see below for detailed integration)
- **Firehouse Software** (dedicated endpoint - see below)
- **IamResponding** (dedicated endpoint - see below)
- **CentralSquare/TriTech** (dedicated endpoint - see below)
- **Custom CAD Systems** (use generic endpoint)

#### Firehouse Software Integration

**Dedicated Endpoint:** `POST http://YOUR_SERVER_IP:3000/api/webhook/firehouse`

**Setup:**
1. In Firehouse Software, configure webhook to: `http://YOUR_SERVER_IP:3000/api/webhook/firehouse`
2. Method: POST
3. Format: JSON
4. **No field mapping needed** - automatic conversion!

The system automatically converts Firehouse format to OpenAlerts format.

#### IamResponding Integration

**Dedicated Endpoint:** `POST http://YOUR_SERVER_IP:3000/api/webhook/iamresponding`

**Setup:**
1. In IamResponding, configure webhook to: `http://YOUR_SERVER_IP:3000/api/webhook/iamresponding`
2. Method: POST
3. Format: JSON
4. **No field mapping needed** - automatic conversion!

#### CentralSquare/TriTech Integration

**Dedicated Endpoint:** `POST http://YOUR_SERVER_IP:3000/api/webhook/centralsquare`

**Setup:**
1. In CentralSquare/TriTech, configure webhook to: `http://YOUR_SERVER_IP:3000/api/webhook/centralsquare`
2. Method: POST
3. Format: JSON
4. **No field mapping needed** - automatic conversion!

#### Generic CAD Webhook Setup

For other CAD systems:
1. Find webhook/API settings in your CAD system
2. Configure webhook URL: `http://YOUR_SERVER_IP:3000/api/alert`
3. Map CAD fields to OpenAlerts format:
   - CAD Call Type → `call_type`
   - CAD Address → `address`
   - CAD Units → `units`
   - CAD Narrative → `narrative`

### Option 3: Email Parsing (Advanced)

If dispatch sends email alerts, you can use a service like:
- **Zapier** (free tier available)
- **n8n** (self-hosted, free)
- **Node-RED** (self-hosted, free)

These can parse emails and forward to your `/api/alert` endpoint.

### Option 4: Manual Testing/Development

For testing, use curl or PowerShell:

**PowerShell:**
```powershell
$body = @{
    call_type = "Structure Fire"
    address = "123 Main St, Aylett, VA"
    units = "Engine 1, Ladder 2"
    narrative = "Reported structure fire"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/alert -Method POST -Body $body -ContentType "application/json"
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/alert \
  -H "Content-Type: application/json" \
  -d '{
    "call_type": "Structure Fire",
    "address": "123 Main St",
    "units": "Engine 1",
    "narrative": "Test alert"
  }'
```

## Resgrid Integration

**Yes, you can use Resgrid (self-hosted) to send alerts to phones!** Resgrid is a free, open-source CAD/dispatch system that can integrate with OpenAlerts.

### Resgrid Setup

1. **Install Resgrid** (self-hosted):
   - Download from: https://resgrid.com/
   - Follow installation instructions for your platform
   - Set up your department, units, and personnel

2. **Configure Resgrid Webhooks:**
   - Go to Resgrid Admin → Integrations → Webhooks
   - Create a new webhook:
     - **Name:** OpenAlerts Integration
     - **URL:** `http://YOUR_OPENALERTS_SERVER:3000/api/alert`
     - **Method:** POST
     - **Trigger:** On Call Created
     - **Format:** JSON

3. **Map Resgrid Fields to OpenAlerts:**
   ```json
   {
     "call_type": "{{Call.Type}}",
     "address": "{{Call.Address}}",
     "units": "{{Call.Units}}",
     "narrative": "{{Call.Nature}} - {{Call.Notes}}"
   }
   ```

### Resgrid Mobile App

Resgrid includes its own mobile app that:
- Receives push notifications for calls
- Shows call details, map, and unit status
- Allows personnel to respond/acknowledge
- Tracks unit locations

### OpenAlerts → Resgrid Integration

**OpenAlerts can automatically send alerts TO Resgrid!**

Instead of Resgrid sending webhooks to OpenAlerts, you can configure OpenAlerts to forward alerts to Resgrid:

1. **Configure Resgrid API** in OpenAlerts (see `RESGRID_SETUP.md`)
2. **When alerts arrive** at OpenAlerts:
   - Alert is saved locally
   - Alert is displayed on dashboard
   - Alert is automatically sent to Resgrid via API
   - Resgrid creates a call/dispatch
   - Resgrid mobile app receives notification

**Setup:**
- Add Resgrid configuration to `.env`:
  ```
  RESGRID_BASE_URL=https://your-resgrid-domain.com
  RESGRID_API_TOKEN=your-api-token
  RESGRID_DEPARTMENT_ID=your-department-id
  ```

**Benefits:**
- Alerts appear in Resgrid automatically
- Resgrid mobile app receives notifications
- Full call tracking in Resgrid
- Unit management through Resgrid

**You can use BOTH directions:**
- **Resgrid → OpenAlerts:** Resgrid webhook → OpenAlerts → Station dashboard
- **OpenAlerts → Resgrid:** Any alert source → OpenAlerts → Resgrid API → Mobile app

See `RESGRID_SETUP.md` for detailed setup instructions.

### Resgrid Webhook Configuration Example

In Resgrid, configure the webhook to send this format:

```json
{
  "call_type": "{{Call.Type}}",
  "address": "{{Call.Address.Street}} {{Call.Address.City}}, {{Call.Address.State}} {{Call.Address.PostalCode}}",
  "units": "{{#Call.Units}}{{Name}}{{#unless @last}}, {{/unless}}{{/Call.Units}}",
  "narrative": "{{Call.Nature}} - {{Call.Notes}}"
}
```

## Network Configuration

### For Local Network Access

If your dispatch system is on the same network:

1. **Find your server's IP address:**
   ```powershell
   # PowerShell
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. **Update webhook URL:**
   - Use: `http://192.168.1.100:3000/api/alert`
   - Replace `192.168.1.100` with your actual IP

3. **Firewall:** Ensure port 3000 is open on your server

### For Remote Access (Advanced)

If dispatch system is remote:

1. **Use a reverse proxy** (nginx, Caddy) with HTTPS
2. **Use a tunnel service** (ngrok, Cloudflare Tunnel) for testing
3. **Set up VPN** for secure access

## Security Considerations

### Option 1: API Key Authentication (Recommended)

Add API key validation to your endpoint:

1. **Create `.env` file:**
   ```
   API_KEY=your-secret-api-key-here
   ```

2. **Update webhook URL:**
   ```
   http://YOUR_SERVER:3000/api/alert?api_key=your-secret-api-key-here
   ```

3. **Backend validates API key** before processing alerts

### Option 2: IP Whitelist

Only allow requests from known dispatch system IPs.

### Option 3: Basic Auth

Use HTTP Basic Authentication (username/password).

## Testing Your Integration

1. **Test the endpoint:**
   ```powershell
   Invoke-WebRequest -Uri http://localhost:3000/api/alert -Method POST -Body '{"call_type":"Test","address":"123 Test St","units":"Test Unit","narrative":"Test alert"}' -ContentType "application/json"
   ```

2. **Check dashboard:** Alert should appear automatically

3. **Check database:**
   ```powershell
   (Invoke-WebRequest -Uri http://localhost:3000/api/alerts).Content
   ```

## Troubleshooting

### Alerts Not Appearing

1. **Check server logs:** Look for incoming POST requests
2. **Verify JSON format:** Must match exact field names
3. **Check Socket.io connection:** Dashboard must be connected
4. **Test endpoint directly:** Use curl/PowerShell to verify

### Webhook Not Working

1. **Check URL:** Ensure it's accessible from dispatch system
2. **Check firewall:** Port 3000 must be open
3. **Check format:** JSON must be valid
4. **Check logs:** Backend should log all incoming requests

## Next Steps

1. **Choose your dispatch integration method** (TwoToneDetect, Resgrid, CAD, etc.)
2. **Configure webhook** to point to your OpenAlerts server
3. **Test with a real alert** to verify end-to-end flow
4. **Set up Phase 5** (Discord webhooks) for additional mobile notifications

## Additional Resources

- **TwoToneDetect:** https://www.twotonedetect.org/
- **Resgrid:** https://resgrid.com/
- **OpenAlerts GitHub:** (if you have a repo)

---

**Need Help?** Check the main README.md for API documentation and testing examples.
