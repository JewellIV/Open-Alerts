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
  narrative: string | null
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
    <div className="h-full w-full bg-gray-900 text-white relative overflow-hidden">
      {/* Flashing Border - Red for Fire, Blue for EMS */}
      <div className={`absolute inset-0 border-8 ${borderColor} animate-pulse`}></div>
      
      {/* Alert Content - Split Layout */}
      <div className="h-full w-full flex relative z-10">
        {/* Left Side - Alert Details */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Header */}
          <div className={`text-7xl font-bold ${alertColor} mb-6 animate-pulse`}>
            ALERT
          </div>

          {/* Call Type */}
          <div className={`text-5xl font-bold ${alertColor} mb-8 text-center`}>
            {alert.call_type}
          </div>

          {/* Address */}
          <div className="text-4xl font-semibold text-yellow-400 mb-6 text-center">
            {alert.address}
          </div>

          {/* Units */}
          <div className="text-3xl font-medium text-blue-400 mb-6 text-center">
            {alert.units}
          </div>

          {/* Narrative */}
          {alert.narrative && (
            <div className="text-2xl text-gray-300 mb-6 text-center max-w-3xl">
              {alert.narrative}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xl text-gray-500 mt-4">
            {formatTimestamp(alert.timestamp)}
          </div>

          {/* Dismiss Button */}
          <button
            onClick={onDismiss}
            className="mt-8 px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-semibold transition-colors"
          >
            Dismiss Alert
          </button>
        </div>

        {/* Right Side - Map */}
        <div className="w-1/2 p-4 flex items-center justify-center">
          <div className="w-full h-full max-w-4xl">
            <MapComponent address={alert.address} callType={alert.call_type} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActiveScreen
