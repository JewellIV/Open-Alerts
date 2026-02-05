# Discord Mobile Alerts Setup Guide

Phase 5: Free Mobile Alerts using Discord Webhooks

## Overview

OpenAlerts can send alerts to Discord, which allows personnel to receive mobile notifications on their phones through the Discord app. This is completely free and requires no paid services.

## Setup Instructions

### Step 1: Create a Discord Server (if you don't have one)

1. Go to https://discord.com/
2. Create a new server for your fire department
3. Invite your personnel to the server

### Step 2: Create a Discord Webhook

1. **In Discord:**
   - Go to your server
   - Click on the channel where you want alerts to appear (e.g., #alerts or #dispatch)
   - Click the gear icon ⚙️ next to the channel name
   - Go to **Integrations** → **Webhooks**
   - Click **New Webhook**
   - Give it a name: "OpenAlerts Alerts"
   - Optionally upload an avatar image
   - Click **Copy Webhook URL**
   - Click **Save Changes**

2. **The webhook URL will look like:**
   ```
   https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz1234567890
   ```

### Step 3: Configure OpenAlerts

1. **Create or edit `.env` file** in the project root:
   ```bash
   # PowerShell
   notepad .env
   ```

2. **Add your Discord webhook URL:**
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
   ```

3. **Save the file**

4. **Restart the backend server:**
   ```bash
   npm run dev
   ```

### Step 4: Test the Integration

Send a test alert:

**PowerShell:**
```powershell
$body = @{
    call_type = "Structure Fire"
    address = "123 Main St, Aylett, VA"
    units = "Engine 1, Ladder 2"
    narrative = "Test alert for Discord integration"
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

You should see the alert appear in your Discord channel!

## Alert Format

Discord alerts include:

- **Title:** Call type with emoji (🚨)
- **Color Coding:**
  - 🔴 **Red** for Fire calls
  - 🔵 **Blue** for EMS/Medical calls
- **Fields:**
  - 📍 Location (address)
  - 🚒 Units (dispatched units)
  - ⏰ Time (timestamp)
- **Description:** Narrative/details
- **Footer:** Station name

## Mobile Notifications

### For Personnel:

1. **Install Discord app** on your phone:
   - iOS: https://apps.apple.com/app/discord/id985746746
   - Android: https://play.google.com/store/apps/details?id=com.discord

2. **Join your department's Discord server**

3. **Enable notifications:**
   - Go to server settings
   - Enable notifications for the alerts channel
   - Set notification level to "All Messages" or "@mentions"

4. **You'll receive push notifications** on your phone when alerts are sent!

## Multiple Channels (Advanced)

You can create multiple webhooks for different purposes:

- **#alerts** - All alerts
- **#fire-calls** - Fire calls only (filter in Discord)
- **#ems-calls** - EMS calls only (filter in Discord)

To use multiple webhooks, you can:
1. Create multiple webhook URLs
2. Modify `discordService.ts` to send to multiple URLs
3. Or use Discord bots for more advanced filtering

## Troubleshooting

### Alerts Not Appearing in Discord

1. **Check webhook URL:**
   - Verify it's correct in `.env`
   - Make sure there are no extra spaces or quotes

2. **Check server logs:**
   - Look for "Discord alert sent successfully" message
   - Check for any error messages

3. **Test webhook directly:**
   ```powershell
   $body = @{
       content = "Test message"
   } | ConvertTo-Json
   
   Invoke-WebRequest -Uri "YOUR_WEBHOOK_URL" -Method POST -Body $body -ContentType "application/json"
   ```

4. **Verify webhook is still active:**
   - Go back to Discord channel settings
   - Check if webhook still exists
   - Webhooks can be deleted or disabled

### Webhook Rate Limits

Discord has rate limits:
- **30 requests per minute** per webhook
- If you exceed this, alerts may be delayed

For high-volume departments, consider:
- Using multiple webhooks
- Implementing rate limiting in the code
- Using a Discord bot instead (more advanced)

## Security Notes

- **Keep webhook URL secret** - Anyone with the URL can send messages
- **Don't commit `.env` to git** - It's already in `.gitignore`
- **Rotate webhook URLs** periodically for security
- **Use server-specific channels** - Don't use personal Discord servers

## Benefits

✅ **Free** - No cost for Discord webhooks  
✅ **Mobile Notifications** - Push notifications on phones  
✅ **Multi-platform** - Works on iOS, Android, Desktop, Web  
✅ **Reliable** - Discord's infrastructure is very stable  
✅ **Easy Setup** - Just copy/paste webhook URL  
✅ **Color Coded** - Visual distinction between fire and EMS  

---

**Need Help?** Check the main README.md or INTEGRATION_GUIDE.md for more information.
