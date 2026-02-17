import { useState, useEffect } from 'react'
import WeatherMap from './WeatherMap'
import ScrollingNotices from './ScrollingNotices'
import { initializeAudio } from '../utils/soundAlerts'
import { initializeSpeech, isSpeechSupported } from '../utils/speechManager'
import { isQuietModeEnabled, enableQuietMode, disableQuietMode, getRoomConfig, initializeRoomSpeaker, setUnitMapping } from '../utils/roomSpeakerController'
import { filterToStationUnits } from '../config/stationUnitsFilter'
import { getEffectiveBackendUrl } from '../utils/backendUrl'

interface IdleScreenProps {
  isConnected: boolean
  isReconnecting?: boolean
  onManualReconnect?: () => void
  isDimmed?: boolean
}

function IdleScreen({ isConnected, isReconnecting = false, onManualReconnect }: IdleScreenProps) {
  const [time, setTime] = useState(new Date())
  const [date, setDate] = useState(new Date())
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [speechEnabled, setSpeechEnabled] = useState(false)
  const [quietMode, setQuietMode] = useState(isQuietModeEnabled())
  const [showUnitSelector, setShowUnitSelector] = useState(false)
  const [availableUnits, setAvailableUnits] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const roomConfig = getRoomConfig()

  // Force re-render on resize so viewport units (vw/vh) recalculate
  useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleEnableAudio = async () => {
    try {
      // Initialize both beep sounds and TTS
      await initializeAudio()
      setAudioEnabled(true)
      
      // Initialize speech synthesis (Phase 4)
      if (isSpeechSupported()) {
        initializeSpeech()
        setSpeechEnabled(true)
      }
    } catch (error) {
      console.error('Failed to enable audio:', error)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setTime(now)
      setDate(now)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Load current selected units from database
  useEffect(() => {
    if (roomConfig) {
      const fetchRoomAssignment = async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const backendUrl = getEffectiveBackendUrl()
          const response = await fetch(`${backendUrl}/api/room-speaker/${roomConfig.roomId}/assign`)
          
          if (response.ok) {
            const data = await response.json()
            setSelectedUnits(data.units || [])
          } else if (response.status === 404) {
            // Room not configured in database yet - this is normal, use localStorage fallback
            const savedUnits = localStorage.getItem('roomUnits')
            if (savedUnits) {
              setSelectedUnits(savedUnits.split(',').filter(u => u.trim()))
            } else if (roomConfig.units) {
              setSelectedUnits(roomConfig.units)
            }
          } else {
            // Other error - log but still fallback
            console.warn('Error fetching room assignment:', response.status)
            const savedUnits = localStorage.getItem('roomUnits')
            if (savedUnits) {
              setSelectedUnits(savedUnits.split(',').filter(u => u.trim()))
            } else if (roomConfig.units) {
              setSelectedUnits(roomConfig.units)
            }
          }
        } catch (error) {
          // Network error or other issue - silently fallback to localStorage
          const savedUnits = localStorage.getItem('roomUnits')
          if (savedUnits) {
            setSelectedUnits(savedUnits.split(',').filter(u => u.trim()))
          } else if (roomConfig.units) {
            setSelectedUnits(roomConfig.units)
          }
        }
      }
      
      fetchRoomAssignment()
    }
  }, [roomConfig])

  // Fetch available units when unit selector opens
  useEffect(() => {
    if (showUnitSelector) {
      fetchAvailableUnits()
    }
  }, [showUnitSelector])

  const fetchAvailableUnits = async () => {
    if (!roomConfig) return
    
    setLoadingUnits(true)
    try {
      const backendUrl = getEffectiveBackendUrl()
      console.log('Fetching units from:', `${backendUrl}/api/station-units`)
      const response = await fetch(`${backendUrl}/api/station-units`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Units response:', data)
        if (data.unit_mapping) {
          setUnitMapping(data.unit_mapping)
        }
        const unitNames = (data.units || []).map((u: { unit_name: string }) => u.unit_name)
        const filtered = filterToStationUnits(unitNames)
        console.log('Parsed unit names:', unitNames, 'filtered to station units:', filtered)
        setAvailableUnits(filtered)
      } else {
        const errorText = await response.text()
        console.error('Failed to fetch units from backend:', response.status, errorText)
        setAvailableUnits([])
      }
    } catch (error) {
      console.error('Error fetching units:', error)
      setAvailableUnits([])
    } finally {
      setLoadingUnits(false)
    }
  }

  const handleUnitToggle = (unitName: string) => {
    if (selectedUnits.includes(unitName)) {
      setSelectedUnits(selectedUnits.filter(u => u !== unitName))
    } else {
      setSelectedUnits([...selectedUnits, unitName])
    }
  }

  const handleSaveUnits = async () => {
    if (!roomConfig) return
    
    const backendUrl = getEffectiveBackendUrl()
    try {
      // Save to database
      const response = await fetch(`${backendUrl}/api/room-speaker/${roomConfig.roomId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomName: roomConfig.roomName,
          units: selectedUnits
        })
      })
      
      if (response.ok) {
        // Also save to localStorage as backup
        if (selectedUnits.length > 0) {
          localStorage.setItem('roomUnits', selectedUnits.join(','))
        } else {
          localStorage.removeItem('roomUnits')
        }
        
        // Update room speaker configuration
        initializeRoomSpeaker({
          roomId: roomConfig.roomId,
          roomName: roomConfig.roomName,
          units: selectedUnits.length > 0 ? selectedUnits : undefined
        }, backendUrl)
        
        setShowUnitSelector(false)
      } else {
        console.error('Failed to save room assignment:', await response.text())
        // Still save to localStorage as fallback
        if (selectedUnits.length > 0) {
          localStorage.setItem('roomUnits', selectedUnits.join(','))
        } else {
          localStorage.removeItem('roomUnits')
        }
        
        initializeRoomSpeaker({
          roomId: roomConfig.roomId,
          roomName: roomConfig.roomName,
          units: selectedUnits.length > 0 ? selectedUnits : undefined
        }, backendUrl)
        
        setShowUnitSelector(false)
      }
    } catch (error) {
      console.error('Error saving room assignment:', error)
      // Fallback to localStorage
      if (selectedUnits.length > 0) {
        localStorage.setItem('roomUnits', selectedUnits.join(','))
      } else {
        localStorage.removeItem('roomUnits')
      }
      
      initializeRoomSpeaker({
        roomId: roomConfig.roomId,
        roomName: roomConfig.roomName,
        units: selectedUnits.length > 0 ? selectedUnits : undefined
      }, backendUrl)
      
      setShowUnitSelector(false)
    }
  }

  // Auto-click "Start System" button on mount
  useEffect(() => {
    // Small delay to ensure component is fully mounted
    const autoStartTimer = setTimeout(() => {
      if (!audioEnabled && !speechEnabled) {
        console.log('Auto-starting system...')
        handleEnableAudio()
      }
    }, 500) // 500ms delay

    return () => clearTimeout(autoStartTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount - intentionally not including handleEnableAudio

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-white min-h-0">
      {/* Scrolling Notices Bar at Top */}
      <ScrollingNotices />

      {/* Main Content Area - fills remaining space, flex row so weather doesn't overlap clock */}
      <div className="flex-1 flex flex-row items-center justify-center gap-2 sm:gap-4 min-h-0 p-4 sm:p-6 relative">
      {/* Connection Status - Always visible */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 flex flex-col items-end gap-1 sm:gap-2">
        
        {isReconnecting ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-600 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse"></div>
            <span className="text-sm font-medium">Reconnecting...</span>
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-300' : 'bg-red-300'} animate-pulse`}></div>
            <span className="text-sm font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        )}
          {!isConnected && !isReconnecting && onManualReconnect && (
            <button
              onClick={onManualReconnect}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors shadow-md"
            >
              Reconnect
            </button>
          )}
          {/* Always show connection status, even when disconnected */}
          {!isConnected && !isReconnecting && (
            <div className="text-xs text-gray-400 mt-1 text-right max-w-xs">
              Backend server may be offline
            </div>
          )}
        </div>

        {/* Left Side - Weather Map - fluid width scales with viewport on resize */}
        <div className="hidden sm:flex shrink-0 w-[clamp(80px,20vw,560px)] min-w-0 items-center">
          <WeatherMap location="Aylett, VA" />
        </div>

        {/* Center - Digital Clock - responsive sizing, takes remaining space */}
        <div className="text-center flex-1 min-w-0 px-2">
          <div className="text-5xl sm:text-7xl lg:text-9xl font-mono font-bold mb-4 sm:mb-8 tracking-wider">
            {formatTime(time)}
          </div>
          <div className="text-xl sm:text-3xl lg:text-4xl font-light text-gray-400">
            {formatDate(date)}
          </div>
        </div>

        {/* Station Name with Controls - responsive layout */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 sm:gap-6 max-w-full px-2">
          {/* Select Units Button - Left Side */}
          {roomConfig && (
            <button
              onClick={() => setShowUnitSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors"
              title="Select units for this room"
            >
              <span className="text-lg">📋</span>
              <span className="text-sm font-medium">
                {selectedUnits.length > 0 ? `${selectedUnits.length} Units` : 'Select Units'}
              </span>
            </button>
          )}

          {/* Station Name */}
          <div className="text-base sm:text-xl lg:text-2xl text-gray-500">
            Mangohick Alerts Board
          </div>

          {/* Quiet Mode Toggle - Right Side */}
          {roomConfig && (
            <button
              onClick={async () => {
                if (quietMode) {
                  await disableQuietMode()
                  setQuietMode(false)
                } else {
                  await enableQuietMode()
                  setQuietMode(true)
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-colors ${
                quietMode ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={quietMode ? 'Click to disable quiet mode' : 'Click to enable quiet mode for meetings/events'}
            >
              <span className="text-lg">{quietMode ? '🔇' : '🔊'}</span>
              <span className="text-sm font-medium">
                {quietMode ? 'Quiet Mode ON' : 'Quiet Mode OFF'}
              </span>
            </button>
          )}
        </div>

        {/* System Start Button (Phase 4) */}
        {(!audioEnabled || !speechEnabled) && (
          <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8">
            <button
              onClick={handleEnableAudio}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors shadow-lg"
            >
              {audioEnabled && !speechEnabled 
                ? 'Enable Speech Alerts' 
                : 'Start System'}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">
              Click to enable audio alerts and text-to-speech announcements
            </p>
          </div>
        )}
        {audioEnabled && speechEnabled && (
          <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8">
            <div className="px-4 py-2 bg-green-600 rounded-lg text-sm font-medium">
              ✓ System Ready
            </div>
          </div>
        )}
      </div>

      {/* Unit Selection Modal */}
      {showUnitSelector && roomConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Select Units for {roomConfig.roomName}</h2>
              <button
                onClick={() => setShowUnitSelector(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <p className="text-gray-400 mb-4 text-sm">
              Select which units should trigger alerts in this room. Leave empty to play all alerts.
            </p>

            {loadingUnits ? (
              <div className="text-center py-8 text-gray-400">Loading units...</div>
            ) : (
              <>
                {availableUnits.length === 0 && (
                  <div className="mb-4 p-4 bg-amber-900/50 border border-amber-700 rounded-lg text-amber-200 text-sm">
                    <p className="font-semibold">No units loaded</p>
                    <p className="mt-1">Set <strong>Backend URL</strong> to your central server (e.g. <code className="bg-black/30 px-1 rounded">http://alerts.mangohickfire.com:3000</code>) in Admin → Speakers, then reload this page.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-96 overflow-y-auto">
                  {availableUnits.map((unit) => (
                    <label
                      key={unit}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedUnits.includes(unit)
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUnits.includes(unit)}
                        onChange={() => handleUnitToggle(unit)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{unit}</span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    {selectedUnits.length > 0 
                      ? `${selectedUnits.length} unit(s) selected`
                      : 'No units selected (will play all alerts)'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUnits([])
                        handleSaveUnits()
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleSaveUnits}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default IdleScreen
