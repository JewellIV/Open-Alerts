/**
 * Radio Manager - Controls radio audio stream
 * Mutes radio during nighttime, plays after alerts
 */

import { isNighttime } from './displayConfig'

let radioAudio: HTMLAudioElement | null = null
let radioUrl: string | null = null
let isRadioEnabled = false
let isRadioMuted = false

/**
 * Initialize radio stream
 * @param url - Radio stream URL (e.g., "http://radio.example.com/stream.mp3")
 */
export function initializeRadio(url: string): void {
  if (!url) {
    console.warn('Radio URL not provided')
    return
  }

  radioUrl = url
  
  // Create audio element if it doesn't exist
  if (!radioAudio) {
    radioAudio = new Audio(url)
    radioAudio.loop = false // Radio streams are continuous
    radioAudio.preload = 'auto'
    
    // Handle errors
    radioAudio.addEventListener('error', (e) => {
      console.error('Radio stream error:', e)
    })
    
    // Handle when radio starts playing
    radioAudio.addEventListener('playing', () => {
      console.log('📻 Radio started playing')
    })
  } else {
    // Update URL if changed
    radioAudio.src = url
  }
}

/**
 * Start radio playback
 */
export async function startRadio(): Promise<void> {
  if (!radioAudio || !radioUrl) {
    console.warn('Radio not initialized')
    return
  }

  try {
    // Check if it's nighttime - mute if so
    if (isNighttime()) {
      console.log('🌙 Nighttime - starting radio muted')
      radioAudio.volume = 0
      isRadioMuted = true
    } else {
      console.log('☀️ Daytime - starting radio at full volume')
      radioAudio.volume = 1.0
      isRadioMuted = false
    }

    await radioAudio.play()
    isRadioEnabled = true
    console.log('📻 Radio started')
  } catch (error) {
    console.error('Error starting radio:', error)
    // Radio might need user interaction - will start when user interacts
  }
}

/**
 * Stop radio playback
 */
export function stopRadio(): void {
  if (radioAudio) {
    radioAudio.pause()
    radioAudio.currentTime = 0
    isRadioEnabled = false
    console.log('📻 Radio stopped')
  }
}

/**
 * Mute radio (set volume to 0)
 */
export function muteRadio(): void {
  if (radioAudio && isRadioEnabled) {
    radioAudio.volume = 0
    isRadioMuted = true
    console.log('🔇 Radio muted')
  }
}

/**
 * Unmute radio (restore volume based on time of day)
 */
export function unmuteRadio(): void {
  if (radioAudio && isRadioEnabled) {
    // If it's nighttime, keep muted; otherwise unmute
    if (isNighttime()) {
      radioAudio.volume = 0
      isRadioMuted = true
      console.log('🌙 Nighttime - radio remains muted')
    } else {
      radioAudio.volume = 1.0
      isRadioMuted = false
      console.log('☀️ Daytime - radio unmuted')
    }
  }
}

/**
 * Set radio volume (0.0 to 1.0)
 */
export function setRadioVolume(volume: number): void {
  if (radioAudio) {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    radioAudio.volume = clampedVolume
    isRadioMuted = clampedVolume === 0
    console.log(`📻 Radio volume set to ${Math.round(clampedVolume * 100)}%`)
  }
}

/**
 * Get current radio volume
 */
export function getRadioVolume(): number {
  return radioAudio?.volume || 0
}

/**
 * Check if radio is currently muted
 */
export function isRadioMutedNow(): boolean {
  return isRadioMuted
}

/**
 * Check if radio is enabled
 */
export function isRadioEnabledNow(): boolean {
  return isRadioEnabled && radioAudio !== null
}

/**
 * Handle nighttime transition - mute radio
 */
export function handleNighttimeStart(): void {
  if (isRadioEnabled && !isRadioMuted) {
    muteRadio()
    console.log('🌙 Nighttime started - radio muted')
  }
}

/**
 * Handle daytime transition - unmute radio
 */
export function handleDaytimeStart(): void {
  if (isRadioEnabled && isRadioMuted) {
    unmuteRadio()
    console.log('☀️ Daytime started - radio unmuted')
  }
}

/**
 * Mute radio before alert (for nighttime)
 * Returns true if radio was muted
 */
export function muteRadioForAlert(): boolean {
  if (isNighttime() && isRadioEnabled && !isRadioMuted) {
    muteRadio()
    return true
  }
  return false
}

/**
 * Unmute radio after alert (for nighttime)
 * Only unmutes if it was muted for the alert
 */
export function unmuteRadioAfterAlert(wasMuted: boolean): void {
  if (wasMuted && isNighttime()) {
    // Wait a moment after alert completes, then unmute
    setTimeout(() => {
      if (isNighttime()) {
        // Still nighttime - keep muted
        muteRadio()
        console.log('🌙 Alert complete - radio remains muted (nighttime)')
      } else {
        // Daytime started - unmute
        unmuteRadio()
        console.log('☀️ Daytime - radio unmuted after alert')
      }
    }, 2000) // 2 second delay after alert
  }
}

/**
 * Cleanup radio resources
 */
export function cleanupRadio(): void {
  if (radioAudio) {
    radioAudio.pause()
    radioAudio.src = ''
    radioAudio = null
  }
  isRadioEnabled = false
  isRadioMuted = false
}
