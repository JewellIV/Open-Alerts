/**
 * Room Speaker Controller - Controls individual room speakers via relays
 * Supports per-room muting for quiet mode and unit-based dispatch routing
 */

import { isNighttime } from './displayConfig'
import { getEffectiveBackendUrl } from './backendUrl'

export interface RoomConfig {
  roomId: string
  roomName: string
  gpioPin?: number // GPIO pin for this room's relay (if backend controls it)
  units?: string[] // Units assigned to this room (e.g., ["Engine 1", "Ladder 2"])
  quietModeEnabled?: boolean // Quiet mode for meetings/events
}

// Global state
let roomConfig: RoomConfig | null = null
let isQuietMode = false
let backendUrl = 'http://localhost:3000'
let unitMapping: Record<string, string> = {} // CAD code -> display name (e.g. ENG2 -> Engine 2)

/** Local room GPIO service (per-room Pi). Frontend tries this first for mute/unmute. */
const LOCAL_GPIO_URL = 'http://localhost:4000'

/**
 * Set unit mapping for CAD code resolution (call when station-units are loaded)
 */
export function setUnitMapping(mapping: Record<string, string>): void {
  unitMapping = mapping || {}
}

/**
 * Initialize room speaker controller
 */
export function initializeRoomSpeaker(config: RoomConfig, apiBackendUrl?: string): void {
  roomConfig = config
  if (apiBackendUrl) {
    backendUrl = apiBackendUrl
  }
  
  // Load quiet mode from localStorage
  const savedQuietMode = localStorage.getItem(`quietMode_${config.roomId}`)
  if (savedQuietMode === 'true') {
    isQuietMode = true
  }
  
  console.log(`✅ Room speaker controller initialized for: ${config.roomName}`)
}

/**
 * Check if quiet mode is enabled for this room
 */
export function isQuietModeEnabled(): boolean {
  return isQuietMode
}

/**
 * Enable quiet mode (mute room speaker)
 */
export async function enableQuietMode(): Promise<void> {
  if (!roomConfig) {
    console.warn('Room speaker not initialized')
    return
  }
  
  isQuietMode = true
  localStorage.setItem(`quietMode_${roomConfig.roomId}`, 'true')
  
  try {
    await muteRoomSpeaker()
    console.log(`🔇 Quiet mode enabled for ${roomConfig.roomName}`)
  } catch (error) {
    console.error('Error enabling quiet mode:', error)
  }
}

/**
 * Disable quiet mode (unmute room speaker)
 */
export async function disableQuietMode(): Promise<void> {
  if (!roomConfig) {
    console.warn('Room speaker not initialized')
    return
  }
  
  isQuietMode = false
  localStorage.removeItem(`quietMode_${roomConfig.roomId}`)
  
  try {
    await unmuteRoomSpeaker()
    console.log(`🔊 Quiet mode disabled for ${roomConfig.roomName}`)
  } catch (error) {
    console.error('Error disabling quiet mode:', error)
  }
}

/**
 * Toggle quiet mode
 */
export async function toggleQuietMode(): Promise<void> {
  if (isQuietMode) {
    await disableQuietMode()
  } else {
    await enableQuietMode()
  }
}

/**
 * Mute room speaker.
 * On a room Pi: tries local GPIO service first (localhost:4000), then central backend.
 * On server Pi: local GPIO may not run; central backend controls amp/relays.
 */
async function muteRoomSpeaker(): Promise<void> {
  if (!roomConfig) return

  try {
    const usedLocal = await tryLocalGpioMute(true)
    if (usedLocal) {
      console.log(`🔇 Room speaker muted (local GPIO): ${roomConfig.roomName}`)
      return
    }

    const response = await fetch(`${getEffectiveBackendUrl()}/api/room-speaker/${roomConfig.roomId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: true })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`Backend mute failed (${response.status}): ${errorText}. Quiet mode still active locally.`)
      return
    }
    console.log(`🔇 Room speaker muted (central): ${roomConfig.roomName}`)
  } catch (error) {
    console.warn('Error muting room speaker (quiet mode still active locally):', error)
  }
}

/**
 * Unmute room speaker.
 * Tries local GPIO service first (room Pi), then central backend (server Pi).
 */
async function unmuteRoomSpeaker(): Promise<void> {
  if (!roomConfig) return

  try {
    const usedLocal = await tryLocalGpioMute(false)
    if (usedLocal) {
      console.log(`🔊 Room speaker unmuted (local GPIO): ${roomConfig.roomName}`)
      return
    }

    const response = await fetch(`${getEffectiveBackendUrl()}/api/room-speaker/${roomConfig.roomId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: false })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`Backend unmute failed (${response.status}): ${errorText}. Quiet mode still disabled locally.`)
      return
    }
    console.log(`🔊 Room speaker unmuted (central): ${roomConfig.roomName}`)
  } catch (error) {
    console.warn('Error unmuting room speaker (quiet mode still disabled locally):', error)
  }
}

/**
 * Try to mute/unmute via local room GPIO service (room Pi).
 * Gets pin list from central backend for this room, then POSTs to localhost:4000.
 * Returns true if local GPIO was used, false to fall back to central backend.
 */
async function tryLocalGpioMute(mute: boolean): Promise<boolean> {
  if (!roomConfig) return false

  try {
    const statusRes = await fetch(`${getEffectiveBackendUrl()}/api/room-speaker/${roomConfig.roomId}/status`)
    if (!statusRes.ok) return false
    const status = await statusRes.json()
    const pins = status.pins as number[] | undefined
    if (!pins || pins.length === 0) return false

    const gpioRes = await fetch(`${LOCAL_GPIO_URL}/gpio/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute, pins })
    })
    if (gpioRes.ok) return true
  } catch (_) {
    // Local GPIO service not running (e.g. on server Pi or dev machine)
  }
  return false
}

/**
 * Check if alert should play in this room based on unit assignments
 * 
 * Rules:
 * - If "Station" is in alert units → Play in all rooms (station-wide alert)
 * - If alert has no specific units → Play in all rooms
 * - If room has no units selected → Play all alerts
 * - Otherwise, only play if alert units match room's selected units
 */
export function shouldPlayAlertInRoom(alertUnits: string): boolean {
  if (!roomConfig) return true // If no config, play all alerts
  
  // If quiet mode is enabled, don't play alerts
  if (isQuietMode) {
    return false
  }
  
  // Parse units from alert - resolve CAD codes to display names for matching
  const rawAlertUnits = alertUnits.split(',').map(u => u.trim()).filter(u => u)
  const alertUnitList = rawAlertUnits.map(u => unitMapping[u] || unitMapping[u.toUpperCase()] || u)
  
  // Check if "Station" is in the alert units (station-wide alert)
  const isStationAlert = alertUnitList.some(unit => 
    unit.toLowerCase() === 'station' || 
    unit.toLowerCase().includes('station')
  )
  
  // If Station is alerted, play in all rooms
  if (isStationAlert) {
    return true
  }
  
  // If alert has no specific units (empty or just whitespace), play in all rooms
  if (alertUnitList.length === 0 || alertUnitList.every(u => !u || u.trim() === '')) {
    return true
  }
  
  // If no units assigned to this room, play all alerts
  if (!roomConfig.units || roomConfig.units.length === 0) {
    return true
  }
  
  // Check if any alert unit matches this room's assigned units
  const hasMatchingUnit = alertUnitList.some(alertUnit => 
    roomConfig!.units!.some(roomUnit => 
      alertUnit.toLowerCase().includes(roomUnit.toLowerCase()) ||
      roomUnit.toLowerCase().includes(alertUnit.toLowerCase())
    )
  )
  
  return hasMatchingUnit
}

/**
 * Handle alert for this room
 * Returns true if alert should play, false if muted/quiet mode
 */
export async function handleRoomAlert(alertUnits: string, _isNighttime: boolean): Promise<boolean> {
  if (!roomConfig) return true
  
  // Check quiet mode
  if (isQuietMode) {
    console.log(`🔇 Quiet mode active - alert muted for ${roomConfig.roomName}`)
    return false
  }
  
  // Check unit assignments
  if (!shouldPlayAlertInRoom(alertUnits)) {
    console.log(`🔇 No matching units - alert muted for ${roomConfig.roomName}`)
    return false
  }
  
  // Unmute speaker for alert
  await unmuteRoomSpeaker()
  
  return true
}

/**
 * Handle alert completion for this room
 */
export async function handleRoomAlertComplete(): Promise<void> {
  if (!roomConfig) return
  
  // If nighttime, mute again after alert
  if (isNighttime()) {
    setTimeout(() => {
      muteRoomSpeaker()
      console.log(`🌙 Alert complete - room speaker muted (nighttime)`)
    }, 2000)
  }
}

/**
 * Reset quiet mode and unit selections (called when daytime starts)
 */
export async function resetForDaytime(): Promise<void> {
  if (!roomConfig) return
  
  // Disable quiet mode if enabled
  if (isQuietMode) {
    await disableQuietMode()
    console.log(`☀️ Daytime reset - quiet mode disabled for ${roomConfig.roomName}`)
  }
  
  // Reset unit selections to empty (play all alerts during daytime)
  localStorage.removeItem('roomUnits')
  console.log(`☀️ Daytime reset - unit selections cleared for ${roomConfig.roomName}`)
  
  // Re-initialize with empty units (plays all alerts)
  initializeRoomSpeaker({
    roomId: roomConfig.roomId,
    roomName: roomConfig.roomName,
    units: undefined // Empty units = play all alerts
  }, getEffectiveBackendUrl())
}

/**
 * Get room configuration
 */
export function getRoomConfig(): RoomConfig | null {
  return roomConfig
}

/**
 * Cleanup room speaker controller
 */
export function cleanupRoomSpeaker(): void {
  roomConfig = null
  isQuietMode = false
}
