/**
 * Discord Service - Sends alerts to Discord via webhooks
 * Phase 5: Free Mobile Alerts (Discord)
 */

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

/**
 * Determines if a call type is Fire or EMS/Medical
 */
function getCallTypeCategory(callType: string): 'fire' | 'ems' {
  const lowerCallType = callType.toLowerCase();
  
  // Check for fire-related keywords
  if (lowerCallType.includes('fire') || 
      lowerCallType.includes('structure') ||
      lowerCallType.includes('brush') ||
      lowerCallType.includes('vehicle fire') ||
      lowerCallType.includes('wildfire') ||
      lowerCallType.includes('smoke')) {
    return 'fire';
  }
  
  // Default to EMS for medical calls
  return 'ems';
}

/**
 * Sends an alert to Discord via webhook
 * @param alert - The alert object
 * @param webhookUrl - Discord webhook URL
 */
export async function sendDiscordAlert(
  alert: {
    call_type: string;
    address: string;
    units: string;
    narrative?: string | null;
    timestamp?: string;
  },
  webhookUrl: string
): Promise<void> {
  try {
    const category = getCallTypeCategory(alert.call_type);
    
    // Color coding: Red for fire, Blue for EMS
    const color = category === 'fire' ? 0xFF0000 : 0x0066FF; // Red: 16711680, Blue: 26367
    
    // Build Discord embed
    const embed: DiscordEmbed = {
      title: `🚨 ${alert.call_type}`,
      description: alert.narrative || 'No additional details',
      color: color,
      fields: [
        {
          name: '📍 Location',
          value: alert.address,
          inline: false
        },
        {
          name: '🚒 Units',
          value: alert.units,
          inline: true
        },
        {
          name: '⏰ Time',
          value: alert.timestamp 
            ? new Date(alert.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
            : new Date().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }),
          inline: true
        }
      ],
      timestamp: alert.timestamp || new Date().toISOString(),
      footer: {
        text: 'Mangohick Volunteer Fire Department'
      }
    };

    const payload: DiscordWebhookPayload = {
      embeds: [embed],
      username: 'Mangohick Alert System',
      avatar_url: category === 'fire' 
        ? 'https://cdn.discordapp.com/emojis/🚨.png' // Fire emoji
        : 'https://cdn.discordapp.com/emojis/🚑.png' // EMS emoji
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✅ Discord alert sent successfully');
  } catch (error) {
    console.error('❌ Error sending Discord alert:', error);
    // Don't throw - we don't want Discord failures to break the alert system
    throw error;
  }
}

/**
 * Checks if Discord webhook URL is configured
 */
export function isDiscordConfigured(): boolean {
  return !!process.env.DISCORD_WEBHOOK_URL;
}
