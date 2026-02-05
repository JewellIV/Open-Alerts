/**
 * Light Controller - Controls physical lights for alert system
 * Supports multiple hardware options:
 * 1. USB Serial devices (Arduino-based LED controllers)
 * 2. Smart home devices (Philips Hue, etc.)
 * 3. HTTP-based light controllers
 */

export type LightColor = 'red' | 'blue' | 'off' | 'white'
export type AlertType = 'fire' | 'ems' | 'none'

interface LightController {
  initialize(): Promise<void>
  setColor(color: LightColor, alertType: AlertType): Promise<void>
  flash(color: LightColor, alertType: AlertType, duration?: number): Promise<void>
  fadeIn(color: LightColor, alertType: AlertType, fadeDuration?: number): Promise<void>
  stop(): Promise<void>
}

// Global state
let currentController: LightController | null = null
let isInitialized = false
let flashInterval: NodeJS.Timeout | null = null

/**
 * USB Serial Light Controller (for Arduino-based LED controllers)
 * Sends simple commands over serial port
 */
class SerialLightController implements LightController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // @ts-ignore - port is assigned but TypeScript doesn't recognize SerialPort type
  private port: any = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private isConnected = false

  async initialize(): Promise<void> {
    try {
      // Check if Serial API is available
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser')
      }

      // Request port access
      const port = await (navigator as any).serial.requestPort({
        filters: [] // Accept any serial device
      })

      await port.open({ baudRate: 9600 })
      this.port = port
      this.writer = port.writable.getWriter()
      this.isConnected = true

      console.log('✅ Serial light controller connected')
    } catch (error) {
      console.error('Failed to initialize serial light controller:', error)
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

  async setColor(color: LightColor, _alertType: AlertType): Promise<void> {
    if (!this.isConnected) return

    try {
      // Send color command (format: "COLOR:red" or "COLOR:blue" or "COLOR:off")
      await this.sendCommand(`COLOR:${color}`)
    } catch (error) {
      console.error('Error setting light color:', error)
    }
  }

  async flash(color: LightColor, _alertType: AlertType, duration: number = 30000): Promise<void> {
    if (!this.isConnected) return

    try {
      // Start flashing (format: "FLASH:red:500" = flash red every 500ms)
      const flashRate = 500 // milliseconds between flashes
      await this.sendCommand(`FLASH:${color}:${flashRate}`)

      // Stop flashing after duration
      setTimeout(async () => {
        await this.stop()
      }, duration)
    } catch (error) {
      console.error('Error flashing lights:', error)
    }
  }

  async fadeIn(color: LightColor, _alertType: AlertType, fadeDuration: number = 5000): Promise<void> {
    if (!this.isConnected) return

    try {
      // Send fade-in command (format: "FADEIN:red:5000" = fade in red over 5000ms)
      await this.sendCommand(`FADEIN:${color}:${fadeDuration}`)
    } catch (error) {
      console.error('Error fading in lights:', error)
    }
  }

  async stop(): Promise<void> {
    if (!this.isConnected) return

    try {
      await this.sendCommand('COLOR:off')
    } catch (error) {
      console.error('Error stopping lights:', error)
    }
  }
}

/**
 * HTTP-based Light Controller (for smart home devices like Philips Hue)
 */
class HttpLightController implements LightController {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  async initialize(): Promise<void> {
    // Test connection
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      console.log('✅ HTTP light controller connected')
    } catch (error) {
      console.error('Failed to initialize HTTP light controller:', error)
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

  async setColor(color: LightColor, _alertType: AlertType): Promise<void> {
    try {
      await this.sendCommand('/set-color', { color, alertType: _alertType })
    } catch (error) {
      console.error('Error setting light color:', error)
    }
  }

  async flash(color: LightColor, _alertType: AlertType, duration: number = 30000): Promise<void> {
    try {
      await this.sendCommand('/flash', { color, alertType: _alertType, duration })
    } catch (error) {
      console.error('Error flashing lights:', error)
    }
  }

  async fadeIn(color: LightColor, _alertType: AlertType, fadeDuration: number = 5000): Promise<void> {
    try {
      await this.sendCommand('/fade-in', { color, alertType: _alertType, fadeDuration })
    } catch (error) {
      console.error('Error fading in lights:', error)
    }
  }

  async stop(): Promise<void> {
    try {
      await this.sendCommand('/stop', {})
    } catch (error) {
      console.error('Error stopping lights:', error)
    }
  }
}

/**
 * Philips Hue Light Controller (specific implementation)
 */
class PhilipsHueController implements LightController {
  private bridgeIp: string
  private username: string
  private lightIds: number[]

  constructor(bridgeIp: string, username: string, lightIds: number[] = [1]) {
    this.bridgeIp = bridgeIp
    this.username = username
    this.lightIds = lightIds
  }

  async initialize(): Promise<void> {
    // Test connection by getting light state
    try {
      const response = await fetch(`http://${this.bridgeIp}/api/${this.username}/lights`)
      if (!response.ok) {
        throw new Error(`Failed to connect to Hue bridge: ${response.status}`)
      }
      console.log('✅ Philips Hue controller connected')
    } catch (error) {
      console.error('Failed to initialize Philips Hue controller:', error)
      throw error
    }
  }

  private async setLightState(lightId: number, state: any): Promise<void> {
    const response = await fetch(
      `http://${this.bridgeIp}/api/${this.username}/lights/${lightId}/state`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to set light state: ${response.status}`)
    }
  }

  private colorToHue(color: LightColor): { hue: number; sat: number; bri: number } | null {
    switch (color) {
      case 'red':
        return { hue: 0, sat: 254, bri: 254 } // Red
      case 'blue':
        return { hue: 46920, sat: 254, bri: 254 } // Blue
      case 'white':
        return { hue: 0, sat: 0, bri: 254 } // White
      case 'off':
        return { bri: 0, sat: 0, hue: 0 } // Off
      default:
        return null
    }
  }

  async setColor(color: LightColor, _alertType: AlertType): Promise<void> {
    const hueColor = this.colorToHue(color)
    if (!hueColor) return

    try {
      const promises = this.lightIds.map(lightId => this.setLightState(lightId, hueColor))
      await Promise.all(promises)
    } catch (error) {
      console.error('Error setting Hue light color:', error)
    }
  }

  async flash(color: LightColor, _alertType: AlertType, duration: number = 30000): Promise<void> {
    const hueColor = this.colorToHue(color)
    if (!hueColor) return

    try {
      // Start flashing
      const promises = this.lightIds.map(lightId =>
        this.setLightState(lightId, { ...hueColor, alert: 'select' })
      )
      await Promise.all(promises)

      // Stop after duration
      setTimeout(async () => {
        await this.stop()
      }, duration)
    } catch (error) {
      console.error('Error flashing Hue lights:', error)
    }
  }

  async fadeIn(color: LightColor, _alertType: AlertType, fadeDuration: number = 5000): Promise<void> {
    const hueColor = this.colorToHue(color)
    if (!hueColor) return

    try {
      const steps = 20 // Number of brightness steps for smooth fade
      const stepDuration = fadeDuration / steps
      const brightnessStep = 254 / steps

      // Start with color at 0 brightness
      const startColor = { ...hueColor, bri: 0 }
      const promises = this.lightIds.map(lightId => this.setLightState(lightId, startColor))
      await Promise.all(promises)

      // Gradually increase brightness
      for (let i = 1; i <= steps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepDuration))
        const currentBrightness = Math.round(brightnessStep * i)
        const currentColor = { ...hueColor, bri: currentBrightness }
        const updatePromises = this.lightIds.map(lightId => this.setLightState(lightId, currentColor))
        await Promise.all(updatePromises)
      }

      // Ensure final brightness is 254 (100%)
      const finalColor = { ...hueColor, bri: 254 }
      const finalPromises = this.lightIds.map(lightId => this.setLightState(lightId, finalColor))
      await Promise.all(finalPromises)
    } catch (error) {
      console.error('Error fading in Hue lights:', error)
    }
  }

  async stop(): Promise<void> {
    try {
      const promises = this.lightIds.map(lightId =>
        this.setLightState(lightId, { bri: 0 })
      )
      await Promise.all(promises)
    } catch (error) {
      console.error('Error stopping Hue lights:', error)
    }
  }
}

/**
 * Initialize the light controller based on configuration
 */
export async function initializeLights(config?: {
  type?: 'serial' | 'http' | 'hue'
  httpUrl?: string
  httpApiKey?: string
  hueBridgeIp?: string
  hueUsername?: string
  hueLightIds?: number[]
}): Promise<void> {
  if (isInitialized && currentController) {
    console.log('Lights already initialized')
    return
  }

  try {
    if (config?.type === 'hue' && config.hueBridgeIp && config.hueUsername) {
      currentController = new PhilipsHueController(
        config.hueBridgeIp,
        config.hueUsername,
        config.hueLightIds || [1]
      )
    } else if (config?.type === 'http' && config.httpUrl) {
      currentController = new HttpLightController(config.httpUrl, config.httpApiKey)
    } else if (config?.type === 'serial') {
      currentController = new SerialLightController()
    } else {
      // Try serial by default (user will be prompted)
      console.log('No light config specified, attempting serial connection...')
      currentController = new SerialLightController()
    }

    await currentController.initialize()
    isInitialized = true
    console.log('✅ Light controller initialized')
  } catch (error) {
    console.warn('⚠️ Light controller initialization failed:', error)
    console.warn('Lights will not be available, but system will continue to function')
    currentController = null
    isInitialized = false
  }
}

/**
 * Set light color for alert type
 */
export async function setAlertLights(alertType: AlertType): Promise<void> {
  if (!currentController || !isInitialized) {
    return
  }

  try {
    const color: LightColor = alertType === 'fire' ? 'red' : alertType === 'ems' ? 'blue' : 'off'
    await currentController.setColor(color, alertType)
  } catch (error) {
    console.error('Error setting alert lights:', error)
  }
}

/**
 * Check if current time is within nighttime hours (20:30 to 06:30)
 */
function isNighttime(): boolean {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentTimeMinutes = hours * 60 + minutes
  
  // Nighttime is from 20:30 (1230 minutes) to 06:30 (390 minutes next day)
  const nightStart = 20 * 60 + 30 // 20:30 = 1230 minutes
  const nightEnd = 6 * 60 + 30    // 06:30 = 390 minutes
  
  // If current time is after 20:30 (same day) or before 06:30 (next day), it's nighttime
  return currentTimeMinutes >= nightStart || currentTimeMinutes < nightEnd
}

/**
 * Flash lights for alert with gradual fade-in during nighttime
 */
export async function flashAlertLights(alertType: AlertType, duration: number = 30000): Promise<void> {
  if (!currentController || !isInitialized) {
    return
  }

  // Clear any existing flash interval
  if (flashInterval) {
    clearInterval(flashInterval)
    flashInterval = null
  }

  try {
    const color: LightColor = alertType === 'fire' ? 'red' : alertType === 'ems' ? 'blue' : 'off'
    
    // During nighttime (20:30 to 06:30), use gradual fade-in over 5 seconds, then keep solid
    if (isNighttime()) {
      console.log('🌙 Nighttime detected - using gradual fade-in for lights (solid after fade)')
      await currentController.fadeIn(color, alertType, 5000)
      
      // After fade-in completes, keep lights solid (not flashing) for the duration
      // Lights will remain at 100% brightness until alert is dismissed
      // No need to flash during nighttime to avoid disturbing sleepers
    } else {
      // During daytime, flash immediately
      await currentController.flash(color, alertType, duration)
    }
  } catch (error) {
    console.error('Error flashing alert lights:', error)
  }
}

/**
 * Stop all lights
 */
export async function stopLights(): Promise<void> {
  if (!currentController || !isInitialized) {
    return
  }

  // Clear flash interval
  if (flashInterval) {
    clearInterval(flashInterval)
    flashInterval = null
  }

  try {
    await currentController.stop()
  } catch (error) {
    console.error('Error stopping lights:', error)
  }
}

/**
 * Check if lights are available
 */
export function areLightsAvailable(): boolean {
  return isInitialized && currentController !== null
}

