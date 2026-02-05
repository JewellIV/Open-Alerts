/**
 * Speech Manager - Browser TTS for alert announcements
 * Uses Web Speech API (window.speechSynthesis) for free, client-side audio
 */

let synth: SpeechSynthesis | null = null
let isInitialized = false

/**
 * Initialize the speech synthesis system
 * Must be called after user interaction due to browser autoplay policies
 */
export function initializeSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    synth = window.speechSynthesis
    
    // Load voices (they may not be available immediately)
    // Some browsers need voices to be loaded after user interaction
    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', () => {
        console.log('Speech voices loaded:', synth?.getVoices().length)
      }, { once: true })
    }
    
    isInitialized = true
    console.log('Speech synthesis initialized')
  } else {
    console.warn('Speech synthesis not supported in this browser')
  }
}

/**
 * Stop any currently speaking utterance
 */
export function stopSpeech(): void {
  if (synth && isInitialized) {
    synth.cancel()
  }
}

/**
 * Speak text using browser TTS
 * @param text - The text to speak
 * @param options - Optional speech options
 */
export function speak(
  text: string,
  options: {
    volume?: number
    rate?: number
    pitch?: number
    voice?: SpeechSynthesisVoice | null
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!synth || !isInitialized) {
      console.warn('Speech synthesis not initialized. Call initializeSpeech() first.')
      reject(new Error('Speech synthesis not initialized'))
      return
    }

    // Stop any current speech
    stopSpeech()

    const utterance = new SpeechSynthesisUtterance(text)
    
    // Set speech options
    utterance.volume = options.volume ?? 1.0 // Full volume
    utterance.rate = options.rate ?? 0.9 // Slightly slower for clarity
    utterance.pitch = options.pitch ?? 1.0 // Normal pitch
    
    // Try to use a more natural voice if available
    if (options.voice) {
      utterance.voice = options.voice
    } else {
      // Prefer a male voice for station announcements (if available)
      const voices = synth.getVoices()
      
      // Try to find a good English voice
      let preferredVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('male') || 
        voice.name.toLowerCase().includes('david') ||
        voice.name.toLowerCase().includes('mark') ||
        voice.name.toLowerCase().includes('zira') // Windows default female
      )
      
      // Fallback to any English voice
      if (!preferredVoice) {
        preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.localService
        ) || voices.find(voice => voice.lang.startsWith('en'))
      }
      
      if (preferredVoice) {
        utterance.voice = preferredVoice
        utterance.lang = preferredVoice.lang
      } else {
        // Default to US English
        utterance.lang = 'en-US'
      }
    }

    utterance.onend = () => {
      resolve()
    }

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event)
      reject(event)
    }

    synth.speak(utterance)
  })
}

/**
 * Announce a dispatch alert using TTS
 * Format: "Attention Station. [Call Type]. [Address]. [Units]."
 * 
 * @param alert - The alert object containing call details
 */
export async function announceAlert(alert: {
  call_type: string
  address: string
  units: string
  narrative?: string | null
}): Promise<void> {
  // Construct the announcement text
  let text = `Attention Station. ${alert.call_type}. ${alert.address}. Units ${alert.units}.`
  
  // Add narrative if available (truncate if too long)
  if (alert.narrative) {
    const maxNarrativeLength = 100
    const narrative = alert.narrative.length > maxNarrativeLength
      ? alert.narrative.substring(0, maxNarrativeLength) + '...'
      : alert.narrative
    text += ` ${narrative}.`
  }

  try {
    await speak(text)
  } catch (error) {
    console.error('Failed to announce alert:', error)
    throw error
  }
}

/**
 * Get available voices for speech synthesis
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!synth || !isInitialized) {
    return []
  }
  return synth.getVoices()
}

/**
 * Check if speech synthesis is supported
 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
