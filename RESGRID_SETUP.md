# Resgrid Integration Setup Guide

This guide explains how to configure OpenAlerts to send alerts to your self-hosted Resgrid instance.

## Overview

OpenAlerts can automatically forward alerts to Resgrid, creating calls/dispatches in your Resgrid system. This allows you to:
- View alerts in Resgrid's web interface
- Use Resgrid's mobile app for notifications
- Track calls in Resgrid's system
- Manage units and personnel through Resgrid

## Prerequisites

1. **Self-hosted Resgrid instance** running and accessible
2. **Resgrid API access** - You'll need an API token
3. **Department ID** - Your Resgrid department identifier

## Setup Instructions

### Step 1: Get Resgrid API Token

1. **Log into your Resgrid instance** (usually `https://your-resgrid-domain.com`)
2. **Go to Settings** → **API** or **Integrations**
3. **Create a new API token**:
   - Give it a name: "OpenAlerts Integration"
   - Set appropriate permissions (at minimum: Create Calls)
   - Copy the API token (you'll need this)

### Step 2: Get Your Department ID

1. **In Resgrid**, go to your department settings
2. **Find your Department ID** (usually a GUID or number)
3. **Copy it** (you'll need this)

Alternatively, you can find it in the URL when viewing your department:
- URL format: `https://your-resgrid-domain.com/Department/{DEPARTMENT_ID}/...`

### Step 3: Configure OpenAlerts

1. **Edit `.env` file** in the project root:
   ```bash
   # PowerShell
   notepad .env
   ```

2. **Add Resgrid configuration:**
   ```
   # Resgrid Configuration
   RESGRID_BASE_URL=https://your-resgrid-domain.com
   RESGRID_API_TOKEN=your-api-token-here
   RESGRID_DEPARTMENT_ID=your-department-id-here
   ```

   **Example:**
   ```
   RESGRID_BASE_URL=https://resgrid.mydepartment.com
   RESGRID_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   RESGRID_DEPARTMENT_ID=12345678-1234-1234-1234-123456789012
   ```

3. **Save the file**

4. **Restart the backend server:**
   ```bash
   npm run dev
   ```

### Step 4: Verify Configuration

When the server starts, you should see:
```
📡 Resgrid integration configured - alerts will be sent to https://your-resgrid-domain.com
```

If you see:
```
ℹ️  Resgrid not configured - set RESGRID_BASE_URL, RESGRID_API_TOKEN, and RESGRID_DEPARTMENT_ID in .env to enable
```

Then check your `.env` file - all three variables must be set.

### Step 5: Test the Integration

Send a test alert:

**PowerShell:**
```powershell
$body = @{
    call_type = "Structure Fire"
    address = "123 Main St, Aylett, VA"
    units = "Engine 1, Ladder 2"
    narrative = "Test alert for Resgrid integration"
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

**Check Resgrid:**
1. Log into your Resgrid instance
2. Go to Calls/Dispatches
3. You should see the test call appear

## How It Works

When an alert is received by OpenAlerts:

1. **Alert is saved** to the local database
2. **Alert is displayed** on the dashboard
3. **Alert is sent to Resgrid** via API:
   - Creates a new call in Resgrid
   - Sets call type (Fire = 1, Medical = 2)
   - Includes address, nature, and narrative
   - Sets priority (default: Normal)

4. **Resgrid processes the call:**
   - Appears in Resgrid's call list
   - Can be dispatched to units
   - Mobile app receives notifications (if configured in Resgrid)

## Call Type Mapping

OpenAlerts automatically maps call types to Resgrid:

- **Fire calls** → Resgrid Type 1 (Fire)
  - Detected by keywords: "fire", "structure", "brush", "smoke", etc.
  
- **EMS/Medical calls** → Resgrid Type 2 (Medical)
  - All other call types default to Medical

## Resgrid API Endpoint

OpenAlerts uses Resgrid's API v4:
- **Endpoint:** `POST /api/v4/Calls/AddCall`
- **Authentication:** Bearer token via `Authorization` header
- **Department:** Specified via `X-DepartmentId` header

## Troubleshooting

### Alerts Not Appearing in Resgrid

1. **Check server logs:**
   - Look for "Resgrid alert sent successfully" message
   - Check for any error messages

2. **Verify API token:**
   - Make sure token is correct in `.env`
   - Check token hasn't expired
   - Verify token has "Create Calls" permission

3. **Check Resgrid URL:**
   - Ensure `RESGRID_BASE_URL` is correct (no trailing slash)
   - Verify Resgrid instance is accessible from your server
   - Check firewall/network settings

4. **Verify Department ID:**
   - Make sure `RESGRID_DEPARTMENT_ID` is correct
   - Check it matches your department in Resgrid

5. **Test API directly:**
   ```powershell
   $headers = @{
       "Authorization" = "Bearer YOUR_API_TOKEN"
       "X-DepartmentId" = "YOUR_DEPARTMENT_ID"
       "Content-Type" = "application/json"
   }
   
   $body = @{
       name = "Test Call"
       nature = "Test"
       address = "123 Test St"
       type = 1
   } | ConvertTo-Json
   
   Invoke-WebRequest -Uri "https://your-resgrid-domain.com/api/v4/Calls/AddCall" -Method POST -Headers $headers -Body $body
   ```

### API Errors

**401 Unauthorized:**
- Check API token is correct
- Verify token hasn't expired
- Ensure token has proper permissions

**404 Not Found:**
- Check `RESGRID_BASE_URL` is correct
- Verify API endpoint path is correct (`/api/v4/Calls/AddCall`)

**400 Bad Request:**
- Check call payload format
- Verify all required fields are present
- Check Department ID is valid

### Network Issues

If your OpenAlerts server can't reach Resgrid:

1. **Check network connectivity:**
   ```powershell
   Test-NetConnection -ComputerName your-resgrid-domain.com -Port 443
   ```

2. **Verify firewall rules** allow outbound HTTPS

3. **Check if Resgrid requires VPN** or internal network access

## Advanced Configuration

### Custom Call Priority

You can modify `resgridService.ts` to set different priorities based on call type:

```typescript
priority: alert.call_type.toLowerCase().includes('emergency') ? 3 : 1
```

### Adding Geolocation

If you want to include coordinates in Resgrid calls, you can geocode the address and add:

```typescript
geolocation: {
  latitude: 37.815,
  longitude: -77.105
}
```

### Multiple Resgrid Instances

To send to multiple Resgrid instances, you can:
1. Create multiple services
2. Modify the code to loop through multiple configurations
3. Or use Resgrid's federation features

## Security Notes

- **Keep API token secret** - Don't commit `.env` to git
- **Use HTTPS** - Always use `https://` for Resgrid URL
- **Rotate tokens** - Periodically rotate API tokens
- **Limit permissions** - Only grant necessary API permissions

## Benefits

✅ **Unified System** - All alerts in one place (Resgrid)  
✅ **Mobile Notifications** - Resgrid app sends push notifications  
✅ **Unit Management** - Track and manage units in Resgrid  
✅ **Call History** - All calls logged in Resgrid  
✅ **Personnel Tracking** - See who's responding  
✅ **Integration** - Works with other Resgrid features  

## Using Both Discord and Resgrid

You can use **both** Discord and Resgrid together:

- **Discord** → Quick mobile notifications, team chat
- **Resgrid** → Full CAD system, unit management, call tracking

Just configure both in your `.env` file:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
RESGRID_BASE_URL=https://your-resgrid-domain.com
RESGRID_API_TOKEN=your-token
RESGRID_DEPARTMENT_ID=your-id
```

---

**Need Help?** Check the main README.md or INTEGRATION_GUIDE.md for more information.
