/**
 * Display Configuration - Manages display type and settings
 * Supports different configurations for room displays vs main station displays
 */

export type DisplayType = 'room' | 'main-station'

interface DisplayConfig {
  type: DisplayType
  lightDuration: number // Duration in milliseconds
  nightModeEnabled: boolean
}

// Default configuration
let displayConfig: DisplayConfig = {
  type: 'main-station', // Default to main station
  lightDuration: 300000, // 5 minutes default
  nightModeEnabled: false
}

/**
 * Initialize display configuration from environment variables or localStorage
 */
export function initializeDisplayConfig(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env as Record<string, string | undefined>
  
  const displayType = env.VITE_DISPLAY_TYPE || localStorage.getItem('displayType')
  const nightMode = env.VITE_NIGHT_MODE_ENABLED || localStorage.getItem('nightModeEnabled')
  
  if (displayType === 'room' || displayType === 'main-station') {
    displayConfig.type = displayType as DisplayType
  }
  
  // Set light duration based on display type
  if (displayConfig.type === 'room') {
    displayConfig.lightDuration = 120000 // 2 minutes for room displays
  } else {
    displayConfig.lightDuration = 300000 // 5 minutes for main station displays
  }
  
  // Night mode is only enabled for room displays
  if (displayConfig.type === 'room') {
    displayConfig.nightModeEnabled = nightMode === 'true' || nightMode === '1'
  } else {
    displayConfig.nightModeEnabled = false
  }
  
  console.log('Display configuration:', displayConfig)
}

/**
 * Get current display configuration
 */
export function getDisplayConfig(): DisplayConfig {
  return { ...displayConfig }
}

/**
 * Get light duration for current display type
 */
export function getLightDuration(): number {
  return displayConfig.lightDuration
}

/**
 * Check if night mode is enabled
 */
export function isNightModeEnabled(): boolean {
  return displayConfig.nightModeEnabled
}

/**
 * Check if current time is within nighttime hours (20:30 to 06:30)
 */
export function isNighttime(): boolean {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentTimeMinutes = hours * 60 + minutes
  
  const nightStart = 20 * 60 + 30 // 20:30 = 1230 minutes
  const nightEnd = 6 * 60 + 30    // 06:30 = 390 minutes
  
  return currentTimeMinutes >= nightStart || currentTimeMinutes < nightEnd
}

/**
 * Check if dashboard should be dimmed (night mode + nighttime)
 */
export function shouldDimDashboard(): boolean {
  return displayConfig.nightModeEnabled && isNighttime()
}
