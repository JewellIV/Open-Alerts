import { useEffect, useRef } from 'react'
import { getCallTypeCategory } from '../utils/soundAlerts'
import { flashAlertLights, stopLights, areLightsAvailable, setAlertLights } from '../utils/lightController'
import { getLightDuration } from '../utils/displayConfig'
import MapComponent from './MapComponent'

interface Alert {
  id: number
  timestamp: string
  call_type: string
  address: string
  units: string
  display_units?: string | null
  narrative: string | null
  recording_url?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface ActiveScreenProps {
  alert: Alert
  onDismiss: () => void
}

function ActiveScreen({ alert, onDismiss }: ActiveScreenProps) {
  const callCategory = getCallTypeCategory(alert.call_type)
  const isFire = callCategory === 'fire'
  const borderColor = isFire ? 'border-red-600' : 'border-blue-600'
  const alertColor = isFire ? 'text-red-500' : 'text-blue-500'
  const hasInitializedLights = useRef(false)

  useEffect(() => {
    // Keep lights active while alert is active
    const alertType = isFire ? 'fire' : 'ems'
    let lightInterval: NodeJS.Timeout | null = null

    if (areLightsAvailable()) {
      // Get light duration based on display type (2 min for rooms, 5 min for main station)
      const lightDuration = getLightDuration()
      
      // Initialize lights only once (will fade-in during nighttime, flash during daytime)
      if (!hasInitializedLights.current) {
        flashAlertLights(alertType, lightDuration).catch(console.error)
        hasInitializedLights.current = true
      }
      
      // Check if it's nighttime (20:30 to 06:30)
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const currentTimeMinutes = hours * 60 + minutes
      const nightStart = 20 * 60 + 30 // 20:30
      const nightEnd = 6 * 60 + 30   // 06:30
      const isNighttime = currentTimeMinutes >= nightStart || currentTimeMinutes < nightEnd
      
      // Only refresh lights during daytime (to maintain flashing)
      // During nighttime, lights stay solid after initial fade-in
      if (!isNighttime) {
        // Refresh flashing every 30 seconds to ensure it continues (daytime only)
        lightInterval = setInterval(() => {
          if (areLightsAvailable()) {
            flashAlertLights(alertType, lightDuration).catch(console.error)
          }
        }, 30000)
      } else {
        // During nighttime, ensure lights stay solid after fade-in completes
        // Set solid color after initial fade-in completes (5 seconds)
        setTimeout(() => {
          if (areLightsAvailable()) {
            setAlertLights(alertType).catch(console.error)
          }
        }, 5000)
      }
    }

    // Auto-dismiss based on display type (2 min for rooms, 5 min for main station)
    const lightDuration = getLightDuration()
    const timer = setTimeout(() => {
      onDismiss()
    }, lightDuration)

    return () => {
      clearTimeout(timer)
      if (lightInterval) {
        clearInterval(lightInterval)
      }
      // Stop lights when component unmounts
      if (areLightsAvailable()) {
        stopLights().catch(console.error)
      }
      hasInitializedLights.current = false
    }
  }, [onDismiss, isFire])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="h-full w-full bg-gray-900 text-white relative overflow-auto min-h-0">
      {/* Flashing Border - Red for Fire, Blue for EMS */}
      <div className={`absolute inset-0 border-4 sm:border-8 ${borderColor} animate-pulse pointer-events-none`}></div>
      
      {/* Alert Content - Responsive Split Layout */}
      <div className="min-h-full w-full flex flex-col lg:flex-row relative z-10">
        {/* Alert Details - scrollable on small screens */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 min-h-0 overflow-y-auto">
          {/* Header - scales up on xl/2xl for distant viewing */}
          <div className={`text-4xl sm:text-5xl lg:text-7xl xl:text-8xl 2xl:text-9xl font-bold ${alertColor} mb-4 sm:mb-6 animate-pulse`}>
            ALERT
          </div>

          {/* Call Type */}
          <div className={`text-2xl sm:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold ${alertColor} mb-4 sm:mb-8 text-center`}>
            {alert.call_type}
          </div>

          {/* Address */}
          <div className="text-xl sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-semibold text-yellow-400 mb-4 sm:mb-6 text-center">
            {alert.address}
          </div>

          {/* Units (display names from CAD code mapping) */}
          <div className="text-lg sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-medium text-blue-400 mb-4 sm:mb-6 text-center">
            {alert.display_units || alert.units}
          </div>

          {/* Narrative */}
          {alert.narrative && (
            <div className="text-base sm:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl text-gray-300 mb-4 sm:mb-6 text-center max-w-3xl w-full px-2">
              {alert.narrative}
            </div>
          )}

          {/* Recording playback (TwoToneDetect) */}
          {alert.recording_url && (
            <div className="mb-4 sm:mb-6 w-full max-w-xl px-2">
              <p className="text-xs sm:text-sm xl:text-base 2xl:text-lg text-gray-400 mb-2">Recorded dispatch</p>
              <audio
                controls
                className="w-full h-10 sm:h-12"
                src={`${(import.meta as any).env?.VITE_BACKEND_URL || (typeof window !== 'undefined' && (localStorage.getItem('backendUrl') || window.location.origin)) || 'http://localhost:3000'}${alert.recording_url}`}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl text-gray-500 mt-2 sm:mt-4">
            {formatTimestamp(alert.timestamp)}
          </div>

          {/* Dismiss Button */}
          <button
            onClick={onDismiss}
            className="mt-4 sm:mt-8 px-4 sm:px-8 py-3 sm:py-4 xl:py-5 bg-gray-700 hover:bg-gray-600 rounded-lg text-base sm:text-xl xl:text-2xl 2xl:text-3xl font-semibold transition-colors"
          >
            Dismiss Alert
          </button>
        </div>

        {/* Map - fills right column on large screens, square, uses full column width */}
        <div className="w-full lg:w-1/2 lg:min-h-full p-2 sm:p-4 lg:p-2 flex items-center justify-center min-h-[200px] lg:min-h-0 shrink-0">
          <div className="w-full min-h-[180px] lg:min-h-0 aspect-square overflow-hidden">
            <MapComponent address={alert.address} callType={alert.call_type} latitude={alert.latitude} longitude={alert.longitude} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActiveScreen
