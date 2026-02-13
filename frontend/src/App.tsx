import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Socket } from 'socket.io-client'
import IdleScreen from './components/IdleScreen'
import ActiveScreen from './components/ActiveScreen'
import { playFireAlert, playEMSAlert, getCallTypeCategory } from './utils/soundAlerts'
const AdminPage = lazy(() => import('./pages/AdminPage'))
import { announceAlert } from './utils/speechManager'
import { getSocket } from './utils/socket'
import { initializeLights, flashAlertLights, stopLights, areLightsAvailable } from './utils/lightController'
import { getLightDuration, getDisplayConfig } from './utils/displayConfig'
import { initializeDisplayConfig, shouldDimDashboard, isNightModeEnabled, isNighttime } from './utils/displayConfig'
import { dimDashboard, brightenDashboard } from './utils/brightnessControl'
import { initializeAmplifier, muteAmplifier, unmuteAmplifier, cleanupAmplifier, isAmplifierAvailable, isAmplifierMuted } from './utils/amplifierController'
import { initializeRoomSpeaker, setUnitMapping, handleRoomAlert, handleRoomAlertComplete, shouldPlayAlertInRoom, resetForDaytime } from './utils/roomSpeakerController'

interface Alert {
  id: number
  timestamp: string
  call_type: string
  address: string
  units: string
  display_units?: string | null
  narrative: string | null
  recording_url?: string | null
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null)
  const [hasError, setHasError] = useState(false)
  const [currentPage, setCurrentPage] = useState<string>('dashboard')
  const [lightsEnabled, setLightsEnabled] = useState(false)
  const [isDimmed, setIsDimmed] = useState(false)
  const previousNighttimeRef = useRef<boolean | null>(null)

  // Initialize display configuration, amplifier, and room speaker
  useEffect(() => {
    initializeDisplayConfig()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env as Record<string, string | undefined>
    // Use env, then localStorage, then current page origin (so one build works from Pi or PC by IP)
    const backendUrl =
      (import.meta as any).env?.VITE_BACKEND_URL ||
      (typeof window !== 'undefined' && (localStorage.getItem('backendUrl') || window.location.origin)) ||
      'http://localhost:3000'
    
    // Initialize amplifier controller if configured
    const amplifierType = env.VITE_AMPLIFIER_TYPE || localStorage.getItem('amplifierType')
    const amplifierHttpUrl = env.VITE_AMPLIFIER_HTTP_URL || localStorage.getItem('amplifierHttpUrl')
    const amplifierApiKey = env.VITE_AMPLIFIER_HTTP_API_KEY || localStorage.getItem('amplifierHttpApiKey')
    
    if (amplifierType && amplifierType !== 'none') {
      const config: {
        type?: 'serial' | 'http' | 'gpio' | 'none'
        httpUrl?: string
        httpApiKey?: string
        backendUrl?: string
      } = {
        type: amplifierType as 'serial' | 'http' | 'gpio'
      }
      
      if (amplifierType === 'http' && amplifierHttpUrl) {
        config.httpUrl = amplifierHttpUrl || undefined
        config.httpApiKey = amplifierApiKey || undefined
      } else if (amplifierType === 'gpio') {
        config.backendUrl = backendUrl
      }
      
      initializeAmplifier(config).catch(console.error)
    }
    
    // Initialize room speaker controller if configured
    const roomId = env.VITE_ROOM_ID || localStorage.getItem('roomId')
    const roomName = env.VITE_ROOM_NAME || localStorage.getItem('roomName') || roomId || 'Room'
    const roomUnits = env.VITE_ROOM_UNITS || localStorage.getItem('roomUnits')
    
    if (roomId) {
      const units = roomUnits ? roomUnits.split(',').map(u => u.trim()) : undefined
      initializeRoomSpeaker({
        roomId,
        roomName,
        units
      }, backendUrl)
      // Load unit mapping for CAD code resolution (ENG2 -> Engine 2)
      fetch(`${backendUrl}/api/station-units`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data?.unit_mapping) setUnitMapping(data.unit_mapping) })
        .catch(() => {})
    }
    
    // Set up night mode dimming for room displays
    if (isNightModeEnabled() && shouldDimDashboard()) {
      dimDashboard()
      setIsDimmed(true)
    }
    
    // Initialize previous nighttime state
    const initialNighttime = isNighttime()
    previousNighttimeRef.current = initialNighttime
    
    // Check brightness and amplifier state periodically (every minute) to handle time changes
    const timeCheckInterval = setInterval(() => {
      const nowIsNighttime = isNighttime()
      
      // Detect transition from nighttime to daytime
      if (previousNighttimeRef.current === true && nowIsNighttime === false) {
        // Daytime just started - reset quiet mode and unit selections
        resetForDaytime().catch(console.error)
        console.log('☀️ Daytime started - resetting quiet mode and unit selections')
      }
      
      // Update previous nighttime state
      previousNighttimeRef.current = nowIsNighttime
      
      // Handle brightness changes
      if (isNightModeEnabled()) {
        const shouldDim = shouldDimDashboard()
        if (shouldDim && !isDimmed && !currentAlert) {
          // Only dim if no alert is active
          dimDashboard()
          setIsDimmed(true)
        } else if (!shouldDim && isDimmed && !currentAlert) {
          // Brighten when nighttime ends
          brightenDashboard()
          setIsDimmed(false)
        }
      }
      
      // Handle radio mute/unmute based on time (via amplifier relay)
      // At night: Mute radio (relay ON = mute)
      // During day: Unmute radio (relay OFF = unmute)
      // Amplifier stays unmuted always so alerts can always play
      if (nowIsNighttime) {
        // Nighttime: Mute radio (relay ON)
        if (isAmplifierAvailable() && !isAmplifierMuted()) {
          muteAmplifier() // This mutes radio at night
          console.log('🌙 Nighttime - radio muted')
        }
      } else {
        // Daytime: Unmute radio (relay OFF)
        if (isAmplifierAvailable() && isAmplifierMuted()) {
          unmuteAmplifier() // This unmutes radio during day
          console.log('☀️ Daytime - radio unmuted')
        }
      }
    }, 60000) // Check every minute
    
    return () => {
      clearInterval(timeCheckInterval)
      cleanupAmplifier()
    }
  }, [isDimmed, currentAlert])

  // Simple hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || 'dashboard'
      // Map hash to page names
      const pageMap: Record<string, string> = {
        'admin': 'admin',
        'notices': 'admin',
        'notices-admin': 'admin',
        'send-alert': 'admin',
        'room-speaker-admin': 'admin',
        'room-speaker': 'admin',
        'station-units-admin': 'admin',
        'station-units': 'admin',
        'reports-admin': 'admin',
        'reports': 'admin',
        'dashboard': 'dashboard',
        'room': 'dashboard',
        'station': 'dashboard'
      }
      const page = pageMap[hash] || 'dashboard'
      setCurrentPage(page)
    }
    
    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Initialize lights on mount
  useEffect(() => {
    const initLights = async () => {
      try {
        // Check for light configuration in environment variables or localStorage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = (import.meta as any).env as Record<string, string | undefined>
        const lightType = env.VITE_LIGHT_TYPE || localStorage.getItem('lightType')
        const lightConfig = {
          type: (lightType === 'serial' || lightType === 'http' || lightType === 'hue') 
            ? lightType as 'serial' | 'http' | 'hue'
            : undefined,
          httpUrl: env.VITE_LIGHT_HTTP_URL || localStorage.getItem('lightHttpUrl') || undefined,
          httpApiKey: env.VITE_LIGHT_HTTP_API_KEY || localStorage.getItem('lightHttpApiKey') || undefined,
          hueBridgeIp: env.VITE_HUE_BRIDGE_IP || localStorage.getItem('hueBridgeIp') || undefined,
          hueUsername: env.VITE_HUE_USERNAME || localStorage.getItem('hueUsername') || undefined,
          hueLightIds: env.VITE_HUE_LIGHT_IDS 
            ? env.VITE_HUE_LIGHT_IDS.split(',').map(Number)
            : localStorage.getItem('hueLightIds')?.split(',').map(Number) || undefined
        }

        // Only initialize if at least one config option is set
        if (lightConfig.type || lightConfig.httpUrl || lightConfig.hueBridgeIp) {
          await initializeLights(lightConfig)
          setLightsEnabled(areLightsAvailable())
        } else {
          console.log('No light configuration found. Lights disabled.')
          setLightsEnabled(false)
        }
      } catch (error) {
        console.warn('Light initialization failed:', error)
        setLightsEnabled(false)
      }
    }

    initLights()
  }, [])

  const handleManualReconnect = () => {
    if (socket) {
      socket.disconnect()
      socket.connect()
    }
  }

  useEffect(() => {
    let newSocket: Socket | null = null
    try {
      // Get singleton socket instance (handles React StrictMode double mounts)
      newSocket = getSocket()
      setSocket(newSocket)
      
      if (!newSocket) {
        throw new Error('Failed to get socket instance')
      }
      
      // Set initial connection state - if not connected, show disconnected immediately
      const initialConnected = newSocket.connected
      setIsConnected(initialConnected)
      
      // If not connected initially, set reconnecting state
      if (!initialConnected) {
        setIsReconnecting(true)
        console.log('⚠️ Socket not connected on mount, will attempt connection...')
      }
    
      newSocket.on('connect', () => {
      console.log('✅ Connected to server')
      setIsConnected(true)
      setIsReconnecting(false)
    })
    
      // Handle heartbeat from server to keep connection alive
      newSocket.on('heartbeat', (timestamp) => {
        // Connection is alive, no action needed
        console.log('💓 Heartbeat received:', timestamp)
      })

      newSocket.on('disconnect', (reason) => {
        if (!newSocket) return
        
        console.log('❌ Disconnected from server:', reason)
        setIsConnected(false)
        
        const socketRef = newSocket // Capture for setTimeout callbacks
        
        // Handle different disconnect reasons
        if (reason === 'io server disconnect') {
          // Server forcefully disconnected - manually reconnect
          console.log('Server disconnected, attempting manual reconnect...')
          setIsReconnecting(true)
          setTimeout(() => {
            if (socketRef) socketRef.connect()
          }, 1000)
        } else if (reason === 'transport close') {
          // Transport closed - force immediate reconnect attempt
          console.log('Transport closed, forcing reconnect...')
          setIsReconnecting(true)
          // Force reconnect immediately for transport close
          setTimeout(() => {
            if (socketRef && !socketRef.connected) {
              console.log('Forcing manual reconnect after transport close...')
              socketRef.connect()
            }
          }, 500)
        } else if (reason === 'transport error') {
          // Transport error - will auto-reconnect
          console.log('Transport error, will auto-reconnect...')
          setIsReconnecting(true)
          // Also try manual reconnect
          setTimeout(() => {
            if (socketRef && !socketRef.connected) {
              console.log('Forcing manual reconnect after transport error...')
              socketRef.connect()
            }
          }, 1000)
        } else {
          // Other reasons - attempt reconnect
          setIsReconnecting(true)
          setTimeout(() => {
            if (socketRef && !socketRef.connected) {
              console.log('Forcing manual reconnect...')
              socketRef.connect()
            }
          }, 1000)
        }
      })

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to server after', attemptNumber, 'attempts')
      setIsConnected(true)
      setIsReconnecting(false)
    })

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber)
        setIsReconnecting(true)
      })

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection error:', error)
      })

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed - server may be down')
        setIsConnected(false)
        setIsReconnecting(false)
        
        // Try one more time after a longer delay
        setTimeout(() => {
          if (newSocket) {
            console.log('Attempting final reconnection...')
            newSocket.connect()
          }
        }, 10000)
      })

      newSocket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message)
        setIsConnected(false)
        setIsReconnecting(true)
        
        // If connection fails, it will automatically retry with exponential backoff
      })

      // Listen for dispatch alerts
      newSocket.on('dispatch_alert', async (alert: Alert) => {
      console.log('Received alert:', alert)
      
      // Check if this room should play the alert (unit-based routing + quiet mode)
      const shouldPlay = shouldPlayAlertInRoom(alert.units)
      
      if (!shouldPlay) {
        console.log(`🔇 Alert muted for this room (quiet mode or no matching units)`)
        // Still show alert on screen, just don't play sounds
        setCurrentAlert(alert)
        return
      }
      
      // Brighten dashboard if dimmed (for night mode)
      if (isDimmed) {
        brightenDashboard()
        setIsDimmed(false)
      }
      
      // Handle room speaker for this alert
      const nowIsNighttime = isNighttime()
      await handleRoomAlert(alert.units, nowIsNighttime)
      
      // For nighttime: Unmute radio so it can play after alerts
      // Amplifier stays unmuted always (alerts always play)
      if (nowIsNighttime && isAmplifierAvailable()) {
        // Unmute radio (via amplifier relay) so it can play after alerts
        await unmuteAmplifier()
      }
      
      // Determine alert category
      const category = getCallTypeCategory(alert.call_type)
      const alertType = category === 'fire' ? 'fire' : 'ems'
      
      // Flash lights with display-specific duration (2 min for rooms, 5 min for main station)
      if (lightsEnabled) {
        try {
          const lightDuration = getLightDuration()
          await flashAlertLights(alertType, lightDuration)
        } catch (error) {
          console.error('Error flashing alert lights:', error)
        }
      }
      
      // Play sound alert based on call type (beeps)
      // Alerts always play - amplifier is always unmuted
      try {
        if (category === 'fire') {
          await playFireAlert()
        } else {
          await playEMSAlert()
        }
      } catch (error) {
        console.error('Error playing alert sound:', error)
      }
      
      // Announce alert using TTS (Phase 4)
      // Alerts always play - amplifier is always unmuted
      try {
        await announceAlert({
          call_type: alert.call_type,
          address: alert.address,
          units: alert.units,
          narrative: alert.narrative
        })
      } catch (error) {
        console.error('Error announcing alert with TTS:', error)
        // Continue even if TTS fails
      }
      
      // Handle room speaker after alert completes
      await handleRoomAlertComplete()
      
      // After alerts complete: Keep radio unmuted at night (radio plays after alerts)
      // Radio stays unmuted - no need to mute again
      
      // Show alert after sounds play
      setCurrentAlert(alert)
    })

    } catch (error) {
      console.error('❌ Error setting up socket:', error)
      setIsConnected(false)
      setIsReconnecting(false)
      setHasError(true)
    }

    // Cleanup: Remove only this component's specific listeners, don't disconnect socket
    // (Socket persists across React StrictMode remounts)
    return () => {
      try {
        // Remove only the listeners we added in this component
        // Keep connection-related listeners so socket can auto-reconnect
        if (newSocket) {
          newSocket.off('connect')
          newSocket.off('disconnect')
          newSocket.off('reconnect')
          newSocket.off('reconnect_attempt')
          newSocket.off('reconnect_error')
          newSocket.off('reconnect_failed')
          newSocket.off('connect_error')
          newSocket.off('heartbeat')
          newSocket.off('dispatch_alert')
        }
      } catch (error) {
        console.error('Error cleaning up socket listeners:', error)
      }
      // Socket stays connected and will be reused on next mount
    }
  }, []) // Empty dependency array - only run once on mount

  // Single admin page with tabs (Notices, Send Alert, Speakers, Units, Reports)
  if (currentPage === 'admin') {
    return <Suspense fallback={<div className="h-screen flex items-center justify-center bg-gray-900 text-gray-400">Loading...</div>}><AdminPage /></Suspense>
  }

  // Always show something, even if there's an error
  if (hasError && !socket) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2 text-red-500">Connection Error</h1>
          <p className="text-gray-400 mb-4">Unable to connect to backend server</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen min-h-dvh w-full min-w-0 overflow-hidden flex flex-col bg-gray-900">
      {/* Admin link - opens tabbed Admin page (Notices, Send Alert, Speakers, Units, Reports) */}
      <div className="absolute bottom-2 left-2 z-50">
        <a 
          href="#admin" 
          className="text-xs text-gray-600 hover:text-gray-400"
          title="Admin: Notices, Send Alert, Speakers, Units, Reports"
        >
          Admin
        </a>
      </div>
      <div className="flex-1 min-h-0 relative">
      {currentAlert ? (
        <ActiveScreen 
          alert={currentAlert} 
          onDismiss={async () => {
            // Stop lights when alert is dismissed
            if (lightsEnabled) {
              try {
                await stopLights()
              } catch (error) {
                console.error('Error stopping lights:', error)
              }
            }
            setCurrentAlert(null)
            
            // Re-dim dashboard if it's nighttime and night mode is enabled
            if (isNightModeEnabled() && shouldDimDashboard()) {
              setTimeout(() => {
                dimDashboard()
                setIsDimmed(true)
              }, 2000) // Wait 2 seconds after alert dismisses
            }
            
            // Re-mute radio only if this is a main-station display (not room displays)
            // At night: Mute radio after alert dismisses
            // During day: Keep radio unmuted
            const displayConfig = getDisplayConfig()
            if (displayConfig.type === 'main-station' && isNighttime() && isAmplifierAvailable()) {
              // Mute radio again after alert dismisses (nighttime)
              muteAmplifier()
              console.log('🌙 Alert dismissed - radio muted again (nighttime)')
            } else if (displayConfig.type === 'main-station' && !isNighttime() && isAmplifierAvailable()) {
              // Keep radio unmuted during daytime
              unmuteAmplifier()
            }
          }} 
        />
      ) : (
        <IdleScreen 
          isConnected={isConnected} 
          isReconnecting={isReconnecting}
          onManualReconnect={handleManualReconnect}
          isDimmed={isDimmed}
        />
      )}
      </div>
    </div>
  )
}

export default App
