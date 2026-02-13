# Dispatch / CAD – Sending Alerts with the API Key

Dispatch or any CAD system can send alerts to OpenAlerts by sending an HTTP POST with your **API key** in the header.

---

## Endpoint

```
POST http://YOUR_SERVER_IP:3000/api/alert
```

Example for a server at 192.168.68.92:

```
POST http://192.168.68.92:3000/api/alert
```

---

## Required

1. **Header: API key**
   - Name: `X-API-Key`
   - Value: the API key from the server’s `.env` (you get this from the station admin).

2. **Header: content type**
   - `Content-Type: application/json`

3. **Body: JSON with required fields**
   - `call_type` (string) – e.g. "Structure Fire", "EMS", "Hazmat"
   - `address` (string) – incident address
   - `units` (string) – comma-separated units, e.g. "Engine 2, Medic 21"
   - `narrative` (string, optional) – additional details
   - `latitude` (number, optional) – incident latitude (e.g. 37.8015866). If provided with `longitude`, the map uses this instead of geocoding the address.
   - `longitude` (number, optional) – incident longitude (e.g. -77.0932782). Use with `latitude` for accurate map pin.

---

## Example JSON body

```json
{
  "call_type": "Structure Fire",
  "address": "123 Main St, Aylett, VA 23009",
  "units": "Engine 2, Ladder 1, Medic 21",
  "narrative": "Reported structure fire with smoke visible"
}
```

With optional latitude/longitude (recommended when dispatch has coordinates so the map shows the correct location):

```json
{
  "call_type": "Structure Fire",
  "address": "123 Main St, Aylett, VA 23009",
  "units": "Engine 2, Ladder 1",
  "narrative": "Reported structure fire",
  "latitude": 37.8015866,
  "longitude": -77.0932782
}
```

---

## Example requests

### cURL (Linux / Mac / Windows)

```bash
curl -X POST "http://192.168.68.92:3000/api/alert" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{"call_type":"Structure Fire","address":"123 Main St","units":"Engine 2, Medic 21","narrative":"Test"}'
```

### PowerShell (Windows)

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key"   = "YOUR_API_KEY_HERE"
}
$body = @{
    call_type = "Structure Fire"
    address   = "123 Main St, Aylett, VA"
    units     = "Engine 2, Medic 21"
    narrative = "Reported structure fire"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://192.168.68.92:3000/api/alert" -Method POST -Headers $headers -Body $body
```

### Query parameter (alternative)

If the client cannot send custom headers, the API key can be sent as a query parameter:

```
POST http://192.168.68.92:3000/api/alert?api_key=YOUR_API_KEY_HERE
Content-Type: application/json

{"call_type":"Structure Fire","address":"123 Main St","units":"Engine 2","narrative":"..."}
```

---

## Getting the API key

- The key is set in the **backend** `.env` file as `API_KEY=...`.
- A station admin can copy it from the server (e.g. from the Pi or the machine running the backend) and provide it to dispatch.
- Do not commit or share the key in public repos or unsecured channels.

---

## Response

- **Success (201):** JSON with `success: true` and the created alert (id, timestamp, etc.).
- **400:** Missing required fields – body must include `call_type`, `address`, and `units`.
- **401:** Invalid or missing API key – check `X-API-Key` (or `api_key` query) and that it matches the server’s `API_KEY`.

---

## CAD / automation notes

- Many CAD systems can send HTTP POST with a custom URL and headers (webhook / HTTP action).
- Configure the action to:  
  URL = `http://YOUR_SERVER_IP:3000/api/alert`,  
  Method = POST,  
  Header `X-API-Key` = your key,  
  Body = JSON with `call_type`, `address`, `units`, and optional `narrative`.
- If the CAD uses a different JSON shape, you may need a small middleware or the existing webhook endpoints (e.g. ActiveAlerts, Firehouse, IamResponding) – see `INTEGRATION_GUIDE.md`.
