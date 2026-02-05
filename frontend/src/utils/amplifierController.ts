/**
 * Amplifier Controller - Controls physical amplifier for radio muting
 * Supports multiple control methods:
 * 1. USB Serial control (for amplifiers with serial interface)
 * 2. HTTP API control (for network-enabled amplifiers)
 * 3. GPIO/Relay control (for Raspberry Pi with relay board)
 */

import { isNighttime } from './displayConfig'

export type AmplifierControlType = 'serial' | 'http' | 'gpio' | 'none'

interface AmplifierController {
  initialize(): Promise<void>
  mute(): Promise<void>
  unmute(): Promise<void>
  setVolume(volume: number): Promise<void> // 0.0 to 1.0
  isMuted(): boolean
}

// Global state
let currentController: AmplifierController | null = null
let isInitialized = false
let isMuted = false

/**
 * USB Serial Amplifier Controller
 * Sends serial commands to control amplifier mute/volume
 */
class SerialAmplifierController implements AmplifierController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // @ts-ignore - port is assigned but TypeScript doesn't recognize SerialPort type
  private port: any = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private isConnected = false

  async initialize(): Promise<void> {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser')
      }

      const port = await (navigator as any).serial.requestPort({
        filters: [] // Accept any serial device
      })

      await port.open({ baudRate: 9600 })
      this.port = port
      this.writer = port.writable.getWriter()
      this.isConnected = true

      console.log('✅ Serial amplifier controller connected')
    } catch (error) {
      console.error('Failed to initialize serial amplifier controller:', error)
      throw error
    }
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.writer || !this.isConnected) {
      throw new Error('Serial port not connected')
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(command + '\n')
    await this.writer.write(data)
  }

  async mute(): Promise<void> {
    if (!this.isConnected) return
    try {
      await this.sendCommand('MUTE:ON')
      isMuted = true
      console.log('🔇 Amplifier muted via serial')
    } catch (error) {
      console.error('Error muting amplifier:', error)
    }
  }

  async unmute(): Promise<void> {
    if (!this.isConnected) return
    try {
      await this.sendCommand('MUTE:OFF')
      isMuted = false
      console.log('🔊 Amplifier unmuted via serial')
    } catch (error) {
      console.error('Error unmuting amplifier:', error)
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.isConnected) return
    try {
      const volumePercent = Math.round(Math.max(0, Math.min(100, volume * 100)))
      await this.sendCommand(`VOLUME:${volumePercent}`)
      console.log(`🔊 Amplifier volume set to ${volumePercent}% via serial`)
    } catch (error) {
      console.error('Error setting amplifier volume:', error)
    }
  }

  isMuted(): boolean {
    return isMuted
  }
}

/**
 * HTTP API Amplifier Controller
 * Controls amplifier via HTTP endpoints
 */
class HttpAmplifierController implements AmplifierController {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      console.log('✅ HTTP amplifier controller connected')
    } catch (error) {
      console.error('Failed to initialize HTTP amplifier controller:', error)
      throw error
    }
  }

  private async sendCommand(endpoint: string, data: any): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }

  async mute(): Promise<void> {
    try {
      await this.sendCommand('/mute', { mute: true })
      isMuted = true
      console.log('🔇 Amplifier muted via HTTP')
    } catch (error) {
      console.error('Error muting amplifier:', error)
    }
  }

  async unmute(): Promise<void> {
    try {
      await this.sendCommand('/mute', { mute: false })
      isMuted = false
      console.log('🔊 Amplifier unmuted via HTTP')
    } catch (error) {
      console.error('Error unmuting amplifier:', error)
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      const volumePercent = Math.round(Math.max(0, Math.min(100, volume * 100)))
      await this.sendCommand('/volume', { volume: volumePercent })
      console.log(`🔊 Amplifier volume set to ${volumePercent}% via HTTP`)
    } catch (error) {
      console.error('Error setting amplifier volume:', error)
    }
  }

  isMuted(): boolean {
    return isMuted
  }
}

/**
 * GPIO/Relay Amplifier Controller (for Raspberry Pi)
 * Controls amplifier via GPIO pins/relay
 * Note: This requires backend API endpoint since browser can't access GPIO directly
 */
class GpioAmplifierController implements AmplifierController {
  private backendUrl: string

  constructor(backendUrl: string = 'http://localhost:3000') {
    this.backendUrl = backendUrl
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${this.backendUrl}/api/amplifier/status`)
      if (!response.ok) {
        throw new Error(`Backend amplifier API not available: ${response.status}`)
      }
      console.log('✅ GPIO amplifier controller connected (via backend)')
    } catch (error) {
      console.error('Failed to initialize GPIO amplifier controller:', error)
      throw error
    }
  }

  private async sendCommand(endpoint: string, data: any): Promise<void> {
    const response = await fetch(`${this.backendUrl}/api/amplifier${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }

  async mute(): Promise<void> {
    try {
      await this.sendCommand('/mute', { mute: true })
      isMuted = true
      console.log('🔇 Amplifier muted via GPIO')
    } catch (error) {
      console.error('Error muting amplifier:', error)
    }
  }

  async unmute(): Promise<void> {
    try {
      await this.sendCommand('/mute', { mute: false })
      isMuted = false
      console.log('🔊 Amplifier unmuted via GPIO')
    } catch (error) {
      console.error('Error unmuting amplifier:', error)
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      const volumePercent = Math.round(Math.max(0, Math.min(100, volume * 100)))
      await this.sendCommand('/volume', { volume: volumePercent })
      console.log(`🔊 Amplifier volume set to ${volumePercent}% via GPIO`)
    } catch (error) {
      console.error('Error setting amplifier volume:', error)
    }
  }

  isMuted(): boolean {
    return isMuted
  }
}

/**
 * Initialize amplifier controller based on configuration
 */
export async function initializeAmplifier(config?: {
  type?: 'serial' | 'http' | 'gpio' | 'none'
  httpUrl?: string
  httpApiKey?: string
  backendUrl?: string
}): Promise<void> {
  if (isInitialized && currentController) {
    console.log('Amplifier already initialized')
    return
  }

  try {
    if (config?.type === 'serial') {
      currentController = new SerialAmplifierController()
    } else if (config?.type === 'http' && config.httpUrl) {
      currentController = new HttpAmplifierController(config.httpUrl, config.httpApiKey)
    } else if (config?.type === 'gpio') {
      currentController = new GpioAmplifierController(config.backendUrl)
    } else {
      console.log('No amplifier config specified - amplifier control disabled')
      currentController = null
      isInitialized = false
      return
    }

    await currentController.initialize()
    isInitialized = true
    console.log('✅ Amplifier controller initialized')
  } catch (error) {
    console.warn('⚠️ Amplifier controller initialization failed:', error)
    console.warn('Amplifier control will not be available, but system will continue to function')
    currentController = null
    isInitialized = false
  }
}

/**
 * Mute amplifier (for nighttime or alerts)
 */
export async function muteAmplifier(): Promise<void> {
  if (!currentController || !isInitialized) {
    return
  }

  try {
    await currentController.mute()
  } catch (error) {
    console.error('Error muting amplifier:', error)
  }
}

/**
 * Unmute amplifier
 */
export async function unmuteAmplifier(): Promise<void> {
  if (!currentController || !isInitialized) {
    return
  }

  try {
    await currentController.unmute()
  } catch (error) {
    console.error('Error unmuting amplifier:', error)
  }
}

/**
 * Set amplifier volume (0.0 to 1.0)
 */
export async function setAmplifierVolume(volume: number): Promise<void> {
  if (!currentController || !isInitialized) {
    return
  }

  try {
    await currentController.setVolume(volume)
  } catch (error) {
    console.error('Error setting amplifier volume:', error)
  }
}

/**
 * Check if amplifier is muted
 */
export function isAmplifierMuted(): boolean {
  return currentController?.isMuted() || false
}

/**
 * Check if amplifier controller is available
 */
export function isAmplifierAvailable(): boolean {
  return isInitialized && currentController !== null
}

/**
 * Handle nighttime transition - mute amplifier
 */
export function handleAmplifierNighttimeStart(): void {
  if (isAmplifierAvailable() && !isAmplifierMuted()) {
    muteAmplifier()
    console.log('🌙 Nighttime started - amplifier muted')
  }
}

/**
 * Handle daytime transition - unmute amplifier
 */
export function handleAmplifierDaytimeStart(): void {
  if (isAmplifierAvailable() && isAmplifierMuted()) {
    unmuteAmplifier()
    console.log('☀️ Daytime started - amplifier unmuted')
  }
}

/**
 * Mute amplifier before alert (for nighttime)
 * Returns true if amplifier was muted
 */
export function muteAmplifierForAlert(): boolean {
  if (isNighttime() && isAmplifierAvailable() && !isAmplifierMuted()) {
    muteAmplifier()
    return true
  }
  return false
}

/**
 * Unmute amplifier after alert (for nighttime)
 * Only unmutes if it was muted for the alert
 */
export function unmuteAmplifierAfterAlert(wasMuted: boolean): void {
  if (wasMuted && isNighttime()) {
    setTimeout(() => {
      if (isNighttime()) {
        // Still nighttime - keep muted
        muteAmplifier()
        console.log('🌙 Alert complete - amplifier remains muted (nighttime)')
      } else {
        // Daytime started - unmute
        unmuteAmplifier()
        console.log('☀️ Daytime - amplifier unmuted after alert')
      }
    }, 2000) // 2 second delay after alert
  }
}

/**
 * Cleanup amplifier controller
 */
export function cleanupAmplifier(): void {
  currentController = null
  isInitialized = false
  isMuted = false
}
