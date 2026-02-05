/**
 * Slack Service - Sends alerts to Slack via webhooks
 * Similar to Discord integration but for Slack
 */

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  ts?: number;
}

interface SlackWebhookPayload {
  text?: string;
  username?: string;
  icon_emoji?: string;
  attachments?: SlackAttachment[];
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
 * Sends an alert to Slack via webhook
 * @param alert - The alert object
 * @param webhookUrl - Slack webhook URL
 */
export async function sendSlackAlert(
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
    const color = category === 'fire' ? 'danger' : 'good'; // Slack uses 'danger' (red) and 'good' (green/blue)
    
    // Format timestamp
    const timestamp = alert.timestamp 
      ? Math.floor(new Date(alert.timestamp).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    
    // Build Slack attachment
    const attachment: SlackAttachment = {
      color: color,
      title: `🚨 ${alert.call_type}`,
      text: alert.narrative || 'No additional details',
      fields: [
        {
          title: '📍 Location',
          value: alert.address,
          short: false
        },
        {
          title: '🚒 Units',
          value: alert.units,
          short: true
        },
        {
          title: '⏰ Time',
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
          short: true
        }
      ],
      footer: 'Mangohick Volunteer Fire Department',
      ts: timestamp
    };

    const payload: SlackWebhookPayload = {
      text: `New ${category === 'fire' ? 'Fire' : 'EMS'} Alert: ${alert.call_type}`,
      username: 'Mangohick Alert System',
      icon_emoji: category === 'fire' ? ':fire:' : ':ambulance:',
      attachments: [attachment]
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
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✅ Slack alert sent successfully');
  } catch (error) {
    console.error('❌ Error sending Slack alert:', error);
    // Don't throw - we don't want Slack failures to break the alert system
    throw error;
  }
}

/**
 * Checks if Slack webhook URL is configured
 */
export function isSlackConfigured(): boolean {
  return !!process.env.SLACK_WEBHOOK_URL;
}
