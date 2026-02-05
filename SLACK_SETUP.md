# Slack Integration Setup Guide

## Overview

OpenAlerts can send alerts to Slack, which allows personnel to receive mobile notifications on their phones through the Slack app. This is completely free and works similarly to Discord integration.

## Setup Instructions

### Step 1: Create a Slack Workspace (if you don't have one)

1. Go to https://slack.com/
2. Create a new workspace for your fire department
3. Invite your personnel to the workspace

### Step 2: Create a Slack Incoming Webhook

1. **In Slack:**
   - Go to your workspace
   - Click on the channel where you want alerts to appear (e.g., #alerts or #dispatch)
   - Click the channel name at the top
   - Go to **Integrations** tab
   - Search for "Incoming Webhooks"
   - Click **Add to Slack** or **Configure**
   - Click **Add Incoming Webhooks integration**
   - Select your channel
   - Click **Add Incoming Webhooks integration**
   - **Copy the Webhook URL**
   - Optionally customize the name and icon
   - Click **Save Settings**

2. **The webhook URL will look like:**
   ```
   https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
   ```

### Step 3: Configure OpenAlerts

1. **Edit `.env` file** in the project root:
   ```bash
   # PowerShell
   notepad .env
   ```

2. **Add your Slack webhook URL:**
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
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
    narrative = "Test alert for Slack integration"
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

You should see the alert appear in your Slack channel!

## Alert Format

Slack alerts include:

- **Title:** Call type with emoji (🚨)
- **Color Coding:**
  - 🔴 **Red** (danger) for Fire calls
  - 🔵 **Green/Blue** (good) for EMS/Medical calls
- **Fields:**
  - 📍 Location (address)
  - 🚒 Units (dispatched units)
  - ⏰ Time (timestamp)
- **Description:** Narrative/details
- **Footer:** Station name
- **Icon:** Fire emoji for fire calls, ambulance emoji for EMS

## Mobile Notifications

### For Personnel:

1. **Install Slack app** on your phone:
   - iOS: https://apps.apple.com/app/slack/id618783545
   - Android: https://play.google.com/store/apps/details?id=com.Slack

2. **Join your department's Slack workspace**

3. **Enable notifications:**
   - Go to channel settings
   - Enable notifications for the alerts channel
   - Set notification preferences

4. **You'll receive push notifications** on your phone when alerts are sent!

## Multiple Channels (Advanced)

You can create multiple webhooks for different purposes:

- **#alerts** - All alerts
- **#fire-calls** - Fire calls only (filter in Slack)
- **#ems-calls** - EMS calls only (filter in Slack)

To use multiple webhooks, you can:
1. Create multiple webhook URLs
2. Modify `slackService.ts` to send to multiple URLs
3. Or use Slack apps/bots for more advanced filtering

## Using Both Discord and Slack

You can use **both** Discord and Slack together:

- **Discord** → Quick mobile notifications, team chat
- **Slack** → Professional team communication, integrations
- **Resgrid** → Full CAD system, unit management

Just configure both in your `.env` file:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
RESGRID_BASE_URL=https://your-resgrid-domain.com
RESGRID_API_TOKEN=your-token
RESGRID_DEPARTMENT_ID=your-id
```

## Troubleshooting

### Alerts Not Appearing in Slack

1. **Check webhook URL:**
   - Verify it's correct in `.env`
   - Make sure there are no extra spaces or quotes

2. **Check server logs:**
   - Look for "Slack alert sent successfully" message
   - Check for any error messages

3. **Test webhook directly:**
   ```powershell
   $body = @{
       text = "Test message"
   } | ConvertTo-Json
   
   Invoke-WebRequest -Uri "YOUR_WEBHOOK_URL" -Method POST -Body $body -ContentType "application/json"
   ```

4. **Verify webhook is still active:**
   - Go back to Slack channel settings
   - Check if webhook still exists
   - Webhooks can be deleted or disabled

### Webhook Rate Limits

Slack has rate limits:
- **1 request per second** per webhook
- If you exceed this, alerts may be delayed

For high-volume departments, consider:
- Using multiple webhooks
- Implementing rate limiting in the code
- Using a Slack app instead (more advanced)

## Security Notes

- **Keep webhook URL secret** - Anyone with the URL can send messages
- **Don't commit `.env` to git** - It's already in `.gitignore`
- **Rotate webhook URLs** periodically for security
- **Use workspace-specific channels** - Don't use personal Slack workspaces

## Benefits

✅ **Free** - No cost for Slack webhooks  
✅ **Mobile Notifications** - Push notifications on phones  
✅ **Multi-platform** - Works on iOS, Android, Desktop, Web  
✅ **Professional** - Great for team communication  
✅ **Integrations** - Can integrate with other tools  
✅ **Color Coded** - Visual distinction between fire and EMS  
✅ **Rich Formatting** - Attachments with fields and colors  

## Comparison: Discord vs Slack

| Feature | Discord | Slack |
|---------|---------|-------|
| Free Tier | ✅ Yes | ✅ Yes |
| Mobile App | ✅ Yes | ✅ Yes |
| Webhooks | ✅ Yes | ✅ Yes |
| Team Chat | ✅ Yes | ✅ Yes |
| Integrations | Limited | Extensive |
| Best For | Quick alerts, gaming | Professional teams |

**Recommendation:** Use both! Discord for quick alerts, Slack for professional communication.

---

**Need Help?** Check the main README.md or INTEGRATION_GUIDE.md for more information.
