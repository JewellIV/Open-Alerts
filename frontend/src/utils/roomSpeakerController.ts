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
let unitMapping: Record<string, string> = {} // CAD code -> display name (e.g. ENG2 -> Engine 2)
let currentAlertPins: number[] = [] // Pins currently unmuted for active alert

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
export function initializeRoomSpeaker(config: RoomConfig, _apiBackendUrl?: string): void {
  roomConfig = config
  // API URL is resolved at request time via getEffectiveBackendUrl()

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
    console.log(`🔇 Room speaker: attempting local GPIO mute at ${LOCAL_GPIO_URL}...`)
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
    console.log(`🔊 Room speaker: attempting local GPIO unmute at ${LOCAL_GPIO_URL}...`)
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
 * Get pins for specific units from backend status
 */
async function getPinsForUnits(units: string[]): Promise<number[]> {
  if (!roomConfig || !units || units.length === 0) return []
  
  try {
    const statusRes = await fetch(`${getEffectiveBackendUrl()}/api/room-speaker/${roomConfig.roomId}/status`)
    if (!statusRes.ok) return []
    const status = await statusRes.json()
    const unitPins = status.unitPins as Array<{ unit: string; pin: number; available: boolean }> | undefined
    if (!unitPins) return []
    
    // Map alert units to pins (resolve CAD codes first)
    const resolvedUnits = units.map(u => unitMapping[u] || unitMapping[u.toUpperCase()] || u)
    const pins: number[] = []
    
    for (const unitPin of unitPins) {
      // Check if this unit matches any alert unit
      const matches = resolvedUnits.some(alertUnit => 
        unitPin.unit.toLowerCase().includes(alertUnit.toLowerCase()) ||
        alertUnit.toLowerCase().includes(unitPin.unit.toLowerCase())
      )
      if (matches && unitPin.available && !pins.includes(unitPin.pin)) {
        pins.push(unitPin.pin)
      }
    }
    
    return pins
  } catch (error) {
    console.warn('Error getting pins for units:', error)
    return []
  }
}

/**
 * Try to mute/unmute via local room GPIO service (room Pi).
 * For quiet mode (no pins given): POST with just { mute } so the local service uses
 * all ROOM_PINS on this device only. For unit-specific control, pass pins from backend status.
 */
async function tryLocalGpioMute(mute: boolean, pins?: number[]): Promise<boolean> {
  if (!roomConfig) return false

  const body: { mute: boolean; pins?: number[] } =
    pins && pins.length > 0 ? { mute, pins } : { mute }

  try {
    const url = `${LOCAL_GPIO_URL}/gpio/mute`
    const gpioRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (gpioRes.ok) {
      return true
    }
    const errText = await gpioRes.text()
    console.warn(`Room GPIO local mute failed (${gpioRes.status}): ${errText}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(
      `Room GPIO: request to ${LOCAL_GPIO_URL} failed. ` +
        `Ensure room-gpio-service is running on THIS device (port 4000) and browser is on the room Pi. ` +
        `Error: ${msg}`
    )
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
  
  // Quiet mode does NOT block alerts here – handleRoomAlert still unmutes the right channels so dispatched units hear the alert

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
 * Unmute room speaker for specific units only
 */
async function unmuteRoomSpeakerForUnits(units: string[]): Promise<void> {
  if (!roomConfig || !units || units.length === 0) return

  try {
    const pins = await getPinsForUnits(units)
    if (pins.length === 0) {
      console.warn(`No pins found for units: ${units.join(', ')}`)
      return
    }
    
    // Store pins for this alert
    currentAlertPins = pins
    
    const usedLocal = await tryLocalGpioMute(false, pins)
    if (usedLocal) {
      console.log(`🔊 Room speaker unmuted (local GPIO) for units ${units.join(', ')}: pins [${pins.join(', ')}]`)
      return
    }

    // Fallback to central backend (e.g. when local GPIO blocked by PNA) - send pins so backend proxy can forward unit-specific unmute
    const response = await fetch(`${getEffectiveBackendUrl()}/api/room-speaker/${roomConfig.roomId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: false, pins })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`Backend unmute failed (${response.status}): ${errorText}`)
      return
    }
    console.log(`🔊 Room speaker unmuted (central) for units ${units.join(', ')}: pins [${pins.join(', ')}]`)
  } catch (error) {
    console.warn('Error unmuting room speaker for units:', error)
  }
}

/**
 * Handle alert for this room
 * Returns true if alert should play, false if muted/quiet mode
 */
export async function handleRoomAlert(alertUnits: string, _isNighttime: boolean): Promise<boolean> {
  if (!roomConfig) return true
  
  // Quiet mode: baseline is muted, but we still unmute for incoming alerts (station-wide = all channels, unit = that unit's pins)
  // So we do NOT return here; we continue and unmute the appropriate channels so the alert is heard.

  // Check unit assignments
  if (!shouldPlayAlertInRoom(alertUnits)) {
    console.log(`🔇 No matching units - alert muted for ${roomConfig.roomName}`)
    return false
  }
  
  // Parse alert units: station-wide (no unit or "Station") = open ALL channels; else open only those units' GPIOs
  const rawAlertUnits = alertUnits.split(',').map(u => u.trim()).filter(u => u)
  const alertUnitList = rawAlertUnits.map(u => unitMapping[u] || unitMapping[u.toUpperCase()] || u)
  const isStationWide =
    rawAlertUnits.length === 0 ||
    alertUnitList.some(
      (u) => u.toLowerCase() === 'station' || (u && u.toLowerCase().includes('station'))
    )

  if (isStationWide) {
    // Station / no unit assigned: open all 8 channels on this device (mens_bunk 8‑channel relay)
    await unmuteRoomSpeaker()
    currentAlertPins = [] // so handleRoomAlertComplete will mute all (nighttime)
  } else {
    // Specific unit(s) assigned: open only those units' GPIO channels
    await unmuteRoomSpeakerForUnits(alertUnitList)
  }

  return true
}

/**
 * Handle alert completion for this room
 */
export async function handleRoomAlertComplete(): Promise<void> {
  if (!roomConfig) return
  
  // If we have pins from the current alert, mute only those
  if (currentAlertPins.length > 0) {
    setTimeout(() => {
      // Mute the pins that were unmuted for this alert
      tryLocalGpioMute(true, currentAlertPins).then(usedLocal => {
        if (usedLocal) {
          console.log(`🌙 Alert complete - muted pins [${currentAlertPins.join(', ')}] (local GPIO)`)
        } else {
          // Fallback to muting all
          muteRoomSpeaker()
          console.log(`🌙 Alert complete - room speaker muted (central)`)
        }
        currentAlertPins = []
      })
    }, 2000)
  } else if (isNighttime() || isQuietMode) {
    // No specific pins tracked - mute all (nighttime or quiet mode: return to muted state)
    setTimeout(() => {
      muteRoomSpeaker()
      console.log(isQuietMode ? `🔇 Alert complete - room speaker muted (quiet mode)` : `🌙 Alert complete - room speaker muted (nighttime)`)
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
