/**
 * Resgrid Service - Sends alerts to self-hosted Resgrid instance
 * Integrates with Resgrid API to create calls/dispatches
 */

interface ResgridCall {
  name: string;
  nature: string;
  address: string;
  note?: string;
  priority?: number;
  type?: number;
  what?: string;
  geolocation?: {
    latitude: number;
    longitude: number;
  };
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
 * Sends an alert to Resgrid via API
 * @param alert - The alert object
 * @param resgridConfig - Resgrid configuration (baseUrl, apiToken, departmentId)
 */
export async function sendResgridAlert(
  alert: {
    call_type: string;
    address: string;
    units: string;
    narrative?: string | null;
    timestamp?: string;
  },
  resgridConfig: {
    baseUrl: string;
    apiToken: string;
    departmentId: string;
  }
): Promise<void> {
  try {
    const category = getCallTypeCategory(alert.call_type);
    
    // Resgrid call type mapping
    // Type 0 = General, 1 = Fire, 2 = Medical, 3 = Hazmat, etc.
    const callType = category === 'fire' ? 1 : 2; // 1 = Fire, 2 = Medical
    
    // Build Resgrid call payload
    const resgridCall: ResgridCall = {
      name: alert.call_type,
      nature: alert.call_type,
      address: alert.address,
      note: alert.narrative || `Units: ${alert.units}`,
      priority: 1, // Default priority (1 = Normal, 2 = High, 3 = Emergency)
      type: callType,
      what: alert.narrative || undefined
    };

    // Resgrid API endpoint: POST /api/v4/Calls/AddCall
    const apiUrl = `${resgridConfig.baseUrl}/api/v4/Calls/AddCall`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resgridConfig.apiToken}`,
        'X-DepartmentId': resgridConfig.departmentId
      },
      body: JSON.stringify(resgridCall),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resgrid API failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Resgrid alert sent successfully:', result);
  } catch (error) {
    console.error('❌ Error sending Resgrid alert:', error);
    // Don't throw - we don't want Resgrid failures to break the alert system
    throw error;
  }
}

/**
 * Checks if Resgrid is configured
 */
export function isResgridConfigured(): boolean {
  return !!(
    process.env.RESGRID_BASE_URL &&
    process.env.RESGRID_API_TOKEN &&
    process.env.RESGRID_DEPARTMENT_ID
  );
}

/**
 * Gets Resgrid configuration from environment variables
 */
export function getResgridConfig(): {
  baseUrl: string;
  apiToken: string;
  departmentId: string;
} | null {
  if (!isResgridConfigured()) {
    return null;
  }

  return {
    baseUrl: process.env.RESGRID_BASE_URL!.replace(/\/$/, ''), // Remove trailing slash
    apiToken: process.env.RESGRID_API_TOKEN!,
    departmentId: process.env.RESGRID_DEPARTMENT_ID!
  };
}
