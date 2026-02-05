/**
 * Brightness Control - Manages screen brightness for night mode
 * Allows dimming dashboard during nighttime and brightening on alerts
 */

let currentBrightness = 100 // 0-100 percentage
let brightnessTransitionTimeout: NodeJS.Timeout | null = null

/**
 * Set screen brightness with smooth transition
 * @param brightness - Brightness percentage (0-100)
 * @param duration - Transition duration in milliseconds (default: 1000ms)
 */
export function setBrightness(brightness: number, duration: number = 1000): void {
  // Clamp brightness between 0 and 100
  const targetBrightness = Math.max(0, Math.min(100, brightness))
  
  // Clear any existing transition
  if (brightnessTransitionTimeout) {
    clearTimeout(brightnessTransitionTimeout)
    brightnessTransitionTimeout = null
  }
  
  const root = document.documentElement
  const startBrightness = currentBrightness
  const steps = 20 // Number of animation steps
  const stepDuration = duration / steps
  const brightnessStep = (targetBrightness - startBrightness) / steps
  
  let step = 0
  
  const animateBrightness = () => {
    if (step <= steps) {
      const newBrightness = startBrightness + (brightnessStep * step)
      currentBrightness = Math.round(newBrightness)
      
      // Apply brightness using CSS filter
      // Brightness filter: 0 = completely black, 1 = normal, >1 = brighter
      const brightnessValue = currentBrightness / 100
      root.style.filter = `brightness(${brightnessValue})`
      root.style.transition = `filter ${stepDuration}ms ease-in-out`
      
      step++
      brightnessTransitionTimeout = setTimeout(animateBrightness, stepDuration)
    } else {
      // Ensure final brightness is set
      currentBrightness = targetBrightness
      const finalBrightnessValue = currentBrightness / 100
      root.style.filter = `brightness(${finalBrightnessValue})`
      brightnessTransitionTimeout = null
    }
  }
  
  animateBrightness()
}

/**
 * Dim dashboard for night mode (20% brightness)
 */
export function dimDashboard(): void {
  console.log('🌙 Dimming dashboard for night mode')
  setBrightness(20, 2000) // Smooth 2-second transition to 20% brightness
}

/**
 * Brighten dashboard to full brightness
 */
export function brightenDashboard(): void {
  console.log('☀️ Brightening dashboard to full brightness')
  setBrightness(100, 1000) // Smooth 1-second transition to 100% brightness
}

/**
 * Get current brightness level
 */
export function getCurrentBrightness(): number {
  return currentBrightness
}

/**
 * Reset brightness to default (100%)
 */
export function resetBrightness(): void {
  currentBrightness = 100
  document.documentElement.style.filter = 'brightness(1)'
  document.documentElement.style.transition = ''
}
