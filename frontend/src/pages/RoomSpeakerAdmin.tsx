import { useState, useEffect } from 'react'
import { 
  initializeRoomSpeaker, 
  enableQuietMode, 
  disableQuietMode, 
  isQuietModeEnabled, 
  RoomConfig,
  setUnitMapping
} from '../utils/roomSpeakerController'
import { loginAdmin, isAdminLoggedIn, getAdminHeaders, initializeAdminAuth, logoutAdmin, clearAdminSession } from '../utils/adminAuth'

interface RoomSpeakerStatus {
  roomId: string
  roomName: string
  gpioPin: number
  units: string[]
  available: boolean
}

function RoomSpeakerAdmin() {
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null)
  const [roomStatus, setRoomStatus] = useState<RoomSpeakerStatus | null>(null)
  const [availableRooms, setAvailableRooms] = useState<RoomSpeakerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [quietMode, setQuietMode] = useState(false)
  const [password, setPassword] = useState<string>('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  
  // Form state
  const [roomId, setRoomId] = useState('')
  const [roomName, setRoomName] = useState('')
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [customUnit, setCustomUnit] = useState('')
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000')
  const [availableUnits, setAvailableUnits] = useState<string[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  const fetchAvailableUnits = async (baseUrl?: string) => {
    const url = baseUrl ?? backendUrl
    setLoadingUnits(true)
    try {
      const apiUrl = `${url}/api/station-units`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((import.meta as any).env?.DEV) {
        console.log('Fetching available units from:', apiUrl)
      }
      const response = await fetch(apiUrl)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((import.meta as any).env?.DEV) {
        console.log('Response status:', response.status)
      }
      if (response.ok) {
        const data = await response.json()
        if (data.unit_mapping) {
          setUnitMapping(data.unit_mapping)
        }
        const unitNames = (data.units || []).map((u: { unit_name: string }) => u.unit_name)
        setAvailableUnits(unitNames)
      } else {
        const errorText = await response.text()
        console.error('Failed to fetch units:', response.status, errorText)
        setAvailableUnits([])
      }
    } catch (error) {
      console.error('Error fetching units:', error)
      setAvailableUnits([])
    } finally {
      setLoadingUnits(false)
    }
  }

  useEffect(() => {
    // Load existing config. Use current origin when viewing from app URL so units fetch succeeds
    // (otherwise localStorage may point to 192.168.68.92 which can be unreachable when remote).
    const savedRoomId = localStorage.getItem('roomId')
    const savedRoomName = localStorage.getItem('roomName')
    const origin = window.location.origin
    const isDevServer = origin.includes('5173') || !origin
    const savedBackendUrl = !isDevServer ? origin : (localStorage.getItem('backendUrl') || 'http://localhost:3000')

    setBackendUrl(savedBackendUrl)
    initializeAdminAuth(savedBackendUrl)

    if (savedRoomId) {
      setRoomId(savedRoomId)
      setRoomName(savedRoomName || savedRoomId)
    }

    // Always fetch available units (public endpoint, no auth required)
    fetchAvailableUnits(savedBackendUrl)
    
    // Check if already logged in
    if (isAdminLoggedIn()) {
      // Fetch room assignment from database
      fetchRoomAssignment()
      fetchRoomStatus()
      fetchAvailableRooms()
    } else {
      setShowPasswordInput(true)
    }
    
    setLoading(false)
  }, [])

  const fetchRoomAssignment = async () => {
    const currentRoomId = localStorage.getItem('roomId')
    if (!currentRoomId) return
    
    try {
      const response = await fetch(`${backendUrl}/api/room-speaker/${currentRoomId}/assign`)
      
      if (response.ok) {
        const data = await response.json()
        // Update state with units from database
        setSelectedUnits(data.units || [])
        
        // Initialize room speaker with database config
        const config: RoomConfig = {
          roomId: data.roomId,
          roomName: data.roomName,
          units: data.units && data.units.length > 0 ? data.units : undefined
        }
        initializeRoomSpeaker(config, backendUrl)
        setRoomConfig(config)
        setQuietMode(isQuietModeEnabled())
      } else if (response.status === 404) {
        // Room not in database yet, use localStorage as fallback
        const savedRoomUnits = localStorage.getItem('roomUnits')
        const units = savedRoomUnits ? savedRoomUnits.split(',').filter(u => u.trim()) : []
        setSelectedUnits(units)
        
        const config: RoomConfig = {
          roomId: currentRoomId,
          roomName: localStorage.getItem('roomName') || currentRoomId,
          units: units.length > 0 ? units : undefined
        }
        initializeRoomSpeaker(config, backendUrl)
        setRoomConfig(config)
        setQuietMode(isQuietModeEnabled())
      }
    } catch (error) {
      console.error('Error fetching room assignment:', error)
      // Fallback to localStorage
      const savedRoomUnits = localStorage.getItem('roomUnits')
      const units = savedRoomUnits ? savedRoomUnits.split(',').filter(u => u.trim()) : []
      setSelectedUnits(units)
    }
  }

  const fetchRoomStatus = async () => {
    const currentRoomId = localStorage.getItem('roomId')
    if (!currentRoomId || !isAdminLoggedIn()) return
    
    try {
      const response = await fetch(`${backendUrl}/api/room-speaker/${currentRoomId}/status`, {
        headers: getAdminHeaders()
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        setRoomStatus(data)
      }
    } catch (error) {
      console.error('Error fetching room status:', error)
    }
  }

  const fetchAvailableRooms = async () => {
    if (!isAdminLoggedIn()) return
    
    try {
      const response = await fetch(`${backendUrl}/api/room-speakers`, {
        headers: getAdminHeaders()
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        setAvailableRooms(data.rooms || [])
      }
    } catch (error) {
      console.error('Error fetching available rooms:', error)
    }
  }

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      alert('Please enter a password')
      return
    }
    setLoading(true)
    try {
      const result = await loginAdmin(password)
      if (result.success) {
        setShowPasswordInput(false)
        await fetchRoomAssignment()
        await fetchRoomStatus()
        await fetchAvailableRooms()
        await fetchAvailableUnits()
      } else {
        alert(result.error || 'Login failed')
      }
    } catch (error) {
      console.error('Error during login:', error)
      alert(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!roomId || !roomName) {
      alert('Please enter Room ID and Room Name')
      return
    }
    
    if (!isAdminLoggedIn()) {
      alert('Please log in first')
      setShowPasswordInput(true)
      return
    }
    
    try {
      // Save to database
      const response = await fetch(`${backendUrl}/api/room-speaker/${roomId}/assign`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          roomName,
          units: selectedUnits
        })
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        alert('Session expired. Please log in again.')
        return
      }
      
      if (response.ok) {
        await response.json() // Response handled, data not needed
        
        // Also save to localStorage as backup
        localStorage.setItem('roomId', roomId)
        localStorage.setItem('roomName', roomName)
        localStorage.setItem('roomUnits', selectedUnits.join(','))
        localStorage.setItem('backendUrl', backendUrl)
        
        // Initialize room speaker
        const config: RoomConfig = {
          roomId,
          roomName,
          units: selectedUnits.length > 0 ? selectedUnits : undefined
        }
        initializeRoomSpeaker(config, backendUrl)
        setRoomConfig(config)
        setQuietMode(isQuietModeEnabled())
        
        // Refresh status
        await fetchRoomStatus()
        await fetchAvailableRooms()
        
        alert('Room configuration saved to database!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.message || 'Failed to save room configuration'}`)
      }
    } catch (error) {
      console.error('Error saving room configuration:', error)
      alert('Error saving room configuration. Check console for details.')
    }
  }

  const handleToggleQuietMode = async () => {
    if (quietMode) {
      await disableQuietMode()
      setQuietMode(false)
    } else {
      await enableQuietMode()
      setQuietMode(true)
    }
  }

  const handleAddUnit = () => {
    if (customUnit.trim() && !selectedUnits.includes(customUnit.trim())) {
      setSelectedUnits([...selectedUnits, customUnit.trim()])
      setCustomUnit('')
    }
  }

  const handleRemoveUnit = (unit: string) => {
    setSelectedUnits(selectedUnits.filter(u => u !== unit))
  }

  const handleMuteRoom = async (targetRoomId: string, mute: boolean) => {
    if (!isAdminLoggedIn()) {
      alert('Please log in first')
      setShowPasswordInput(true)
      return
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/room-speaker/${targetRoomId}/mute`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ mute })
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        alert('Session expired. Please log in again.')
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        alert(data.message || `Room speaker ${mute ? 'muted' : 'unmuted'} successfully`)
        fetchRoomStatus()
        fetchAvailableRooms()
      } else {
        const error = await response.json()
        alert(`Error: ${error.message || 'Failed to control room speaker'}`)
      }
    } catch (error) {
      console.error('Error controlling room speaker:', error)
      alert('Error controlling room speaker. Check console for details.')
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Room Speaker Control</h1>
          <div className="flex gap-2">
            {isAdminLoggedIn() && (
              <button
                onClick={async () => {
                  await logoutAdmin()
                  setShowPasswordInput(true)
                  setPassword('')
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Logout
              </button>
            )}
            <a 
              href="#" 
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              onClick={(e) => {
                e.preventDefault()
                window.location.hash = ''
              }}
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>

        {/* Password Login */}
        {showPasswordInput && !isAdminLoggedIn() && (
          <div className="mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
            <label className="block mb-2 font-semibold">Admin Login Required</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Room Configuration */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Room Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-semibold">Room ID</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="e.g., engine_bay"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Must match backend room ID</p>
                </div>

                <div>
                  <label className="block mb-2 font-semibold">Room Name</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g., Engine Bay"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-semibold">Backend URL</label>
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-semibold">Assigned Units</label>
                  <p className="text-xs text-gray-400 mb-2">Only alerts for these units will play in this room</p>
                  
                  {/* Quick Select Units from Database */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-2">
                      Quick Select {loadingUnits ? '(Loading...)' : `(${availableUnits.length} units available):`}
                    </p>
                    {loadingUnits ? (
                      <div className="text-xs text-gray-500">Loading units from database...</div>
                    ) : availableUnits.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {availableUnits.map(unit => (
                          <button
                            key={unit}
                            onClick={() => {
                              if (!selectedUnits.includes(unit)) {
                                setSelectedUnits([...selectedUnits, unit])
                              }
                            }}
                            disabled={selectedUnits.includes(unit)}
                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                              selectedUnits.includes(unit)
                                ? 'bg-green-600 cursor-not-allowed'
                                : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-400">
                        ⚠️ No units found in database. Add units via Station Units Admin page, or use custom unit input below.
                      </div>
                    )}
                  </div>

                  {/* Custom Unit Input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddUnit()}
                      placeholder="Enter custom unit name"
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                    <button
                      onClick={handleAddUnit}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {/* Selected Units List */}
                  {selectedUnits.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">Selected Units:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedUnits.map(unit => (
                          <div
                            key={unit}
                            className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-lg"
                          >
                            <span className="text-sm">{unit}</span>
                            <button
                              onClick={() => handleRemoveUnit(unit)}
                              className="text-red-400 hover:text-red-300"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedUnits.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-2">
                      ⚠️ No units selected - this room will play ALL alerts
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSaveConfig}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </div>

            {/* Current Room Status */}
            {roomConfig && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Current Room Status</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Room ID:</span>
                    <span className="font-semibold">{roomConfig.roomId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Room Name:</span>
                    <span className="font-semibold">{roomConfig.roomName}</span>
                  </div>
                  {roomStatus && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">GPIO Pin:</span>
                      <span className="font-semibold">{roomStatus.gpioPin}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Assigned Units:</span>
                    <span className="font-semibold">
                      {roomConfig.units && roomConfig.units.length > 0
                        ? roomConfig.units.join(', ')
                        : 'All alerts'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Relay Available:</span>
                    <span className={`font-semibold ${roomStatus?.available ? 'text-green-400' : 'text-red-400'}`}>
                      {roomStatus?.available ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                {/* Quiet Mode Toggle */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Quiet Mode:</span>
                    <button
                      onClick={handleToggleQuietMode}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        quietMode
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {quietMode ? '🔇 ON' : '🔊 OFF'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    When enabled, all alerts are muted (no audio)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: All Rooms Control */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">All Rooms Control</h2>
              
              {availableRooms.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No rooms configured on backend</p>
                  <p className="text-xs mt-2">Configure rooms in backend .env file</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableRooms.map(room => (
                    <div
                      key={room.roomId}
                      className="p-4 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{room.roomName}</h3>
                          <p className="text-xs text-gray-400">
                            ID: {room.roomId} | GPIO: {room.gpioPin}
                          </p>
                          {room.units.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              Units: {room.units.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs ${
                          room.available ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                          {room.available ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMuteRoom(room.roomId, true)}
                          disabled={!room.available || !isAdminLoggedIn()}
                          className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                          Mute
                        </button>
                        <button
                          onClick={() => handleMuteRoom(room.roomId, false)}
                          disabled={!room.available || !isAdminLoggedIn()}
                          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                          Unmute
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-6">
              <h3 className="font-semibold mb-2">📋 Setup Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                <li>Configure rooms in backend <code className="bg-gray-800 px-1 rounded">.env</code> file</li>
                <li>Set <code className="bg-gray-800 px-1 rounded">ROOM_SPEAKERS</code> environment variable</li>
                <li>Log in with your admin password above</li>
                <li>Configure this room's ID, name, and assigned units</li>
                <li>Save configuration and reload page</li>
                <li>Use quiet mode toggle to mute/unmute this room</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoomSpeakerAdmin
