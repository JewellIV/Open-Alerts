// Sound alert utility for fire and EMS calls

let audioContext: AudioContext | null = null

/**
 * Initialize audio context (must be called after user interaction)
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Ensures audio context is ready (resumes if suspended)
 */
async function ensureAudioReady(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  
  // Set master volume to maximum (if supported)
  try {
    // Try to set system volume via Web Audio API
    // Note: Browser security prevents direct volume control, but we can ensure our gain is max
    const masterGain = ctx.createGain()
    masterGain.gain.value = 1.0 // Maximum gain
  } catch (error) {
    // Volume control not available, continue anyway
    console.debug('System volume control not available:', error)
  }
}

/**
 * Plays a beep sound
 * @param frequency - Frequency in Hz (default: 800)
 * @param duration - Duration in milliseconds (default: 200)
 */
async function playBeep(frequency: number = 800, duration: number = 200): Promise<void> {
  await ensureAudioReady()
  const ctx = getAudioContext()
  
  return new Promise((resolve) => {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    // Use higher volume for alerts (0.8 instead of 0.3)
    gainNode.gain.setValueAtTime(0.8, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration / 1000)

    oscillator.onended = () => resolve()
  })
}

/**
 * Initialize audio system (call on user interaction)
 */
export async function initializeAudio(): Promise<void> {
  try {
    await ensureAudioReady()
    // Play a silent beep to ensure audio is enabled
    await playBeep(200, 1)
  } catch (error) {
    console.error('Error initializing audio:', error)
  }
}

/**
 * Plays 4 beeps for fire calls
 */
export async function playFireAlert(): Promise<void> {
  await ensureAudioReady()

  // Play 4 beeps with short pauses between
  for (let i = 0; i < 4; i++) {
    await playBeep(800, 200) // 800Hz, 200ms
    if (i < 3) {
      await new Promise(resolve => setTimeout(resolve, 100)) // 100ms pause between beeps
    }
  }
}

/**
 * Plays 1 long beep for EMS calls
 */
export async function playEMSAlert(): Promise<void> {
  await ensureAudioReady()

  // Play 1 long beep (800ms)
  await playBeep(600, 800) // 600Hz, 800ms (longer and slightly lower pitch)
}

/**
 * Determines if a call type is Fire or EMS/Medical
 */
export function getCallTypeCategory(callType: string): 'fire' | 'ems' {
  const lowerCallType = callType.toLowerCase()
  
  // Check for fire-related keywords
  if (lowerCallType.includes('fire') || 
      lowerCallType.includes('structure') ||
      lowerCallType.includes('brush') ||
      lowerCallType.includes('vehicle fire')) {
    return 'fire'
  }
  
  // Default to EMS for medical calls
  return 'ems'
}
