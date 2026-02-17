import { useState, useEffect, useCallback } from 'react'
import { loginAdmin, isAdminLoggedIn, getAdminHeaders, initializeAdminAuth, logoutAdmin, clearAdminSession } from '../utils/adminAuth'

interface StationUnit {
  id?: number
  unit_name: string
  cad_code?: string | null
  unit_type?: string | null
  description?: string | null
  is_active?: number
  created_at?: string
  updated_at?: string
}

interface UnitPinMapping {
  pin: number
  available: boolean
}

const UNIT_TYPES = [
  'Engine',
  'Ladder',
  'Medic',
  'Rescue',
  'Squad',
  'Tanker',
  'Brush',
  'Chief',
  'Battalion',
  'Deputy',
  'Other'
]

function StationUnitsAdmin() {
  const [units, setUnits] = useState<StationUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState<string>('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [editingUnit, setEditingUnit] = useState<StationUnit | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [unitPins, setUnitPins] = useState<Record<string, UnitPinMapping>>({})
  // Initialize from localStorage or current origin so first request uses correct backend (avoids 401 on #station-units)
  const [backendUrl, setBackendUrl] = useState(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem('backendUrl') || window.location.origin)
      : 'http://localhost:3000'
  )
  const [formData, setFormData] = useState<StationUnit>({
    unit_name: '',
    cad_code: null,
    unit_type: null,
    description: null
  })

  useEffect(() => {
    const savedBackendUrl = localStorage.getItem('backendUrl') || window.location.origin
    setBackendUrl(savedBackendUrl)
    initializeAdminAuth(savedBackendUrl)
    
    if (!isAdminLoggedIn()) {
      setShowPasswordInput(true)
      setLoading(false)
    }
  }, [])

  const fetchUnits = useCallback(async () => {
    if (!isAdminLoggedIn()) {
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/station-units`, {
        headers: getAdminHeaders()
      })
      
      if (response.ok) {
        const data = await response.json()
        setUnits(data.units || [])

        // Also fetch GPIO pin mappings for each unit so admins can see wiring
        try {
          const pinsResponse = await fetch(`${backendUrl}/api/unit-pins`, {
            headers: getAdminHeaders()
          })

          if (pinsResponse.ok) {
            const pinsData = await pinsResponse.json()
            const mapping: Record<string, UnitPinMapping> = {}

            ;(pinsData.mappings || []).forEach((m: { unit: string; pin: number; available: boolean }) => {
              if (m.unit && typeof m.pin === 'number') {
                mapping[m.unit] = {
                  pin: m.pin,
                  available: !!m.available
                }
              }
            })

            setUnitPins(mapping)
          } else if (pinsResponse.status === 401) {
            // If admin session expired between calls, force re-login next time
            clearAdminSession()
            setShowPasswordInput(true)
          }
        } catch (error) {
          console.error('Error fetching unit pin mappings:', error)
        }
      } else if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch units:', errorData)
      }
    } catch (error) {
      console.error('Error fetching units:', error)
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  useEffect(() => {
    // Fetch units when logged in
    if (isAdminLoggedIn() && !showPasswordInput) {
      fetchUnits()
    }
  }, [showPasswordInput, fetchUnits])

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
        await fetchUnits()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdminLoggedIn()) {
      alert('Please log in first')
      setShowPasswordInput(true)
      return
    }

    try {
      const url = editingUnit
        ? `${backendUrl}/api/station-units/${editingUnit.id}`
        : `${backendUrl}/api/station-units`
      
      const method = editingUnit ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        body: JSON.stringify(formData)
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        alert('Session expired. Please log in again.')
        return
      }

      if (response.ok) {
        await fetchUnits()
        setShowForm(false)
        setEditingUnit(null)
        setFormData({ unit_name: '', cad_code: null, unit_type: null, description: null })
      } else {
        const error = await response.json()
        alert(`Error: ${error.message || 'Failed to save unit'}`)
      }
    } catch (error) {
      console.error('Error saving unit:', error)
      alert('Error saving unit. Check console for details.')
    }
  }

  const handleEdit = (unit: StationUnit) => {
    setEditingUnit(unit)
    setFormData({
      unit_name: unit.unit_name,
      cad_code: unit.cad_code || null,
      unit_type: unit.unit_type || null,
      description: unit.description || null
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this unit?')) return
    if (!isAdminLoggedIn()) {
      alert('Please log in first')
      setShowPasswordInput(true)
      return
    }

    try {
      const response = await fetch(`${backendUrl}/api/station-units/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        alert('Session expired. Please log in again.')
        return
      }

      if (response.ok) {
        await fetchUnits()
      } else {
        alert('Error deleting unit')
      }
    } catch (error) {
      console.error('Error deleting unit:', error)
      alert('Error deleting unit. Check console for details.')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingUnit(null)
    setFormData({ unit_name: '', cad_code: null, unit_type: null, description: null })
  }


  if (showPasswordInput) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Admin Login Required</h2>
            <p className="text-gray-400 mb-4">
              Enter your admin password to manage station units.
            </p>
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                autoFocus
              />
              <button
                onClick={handlePasswordSubmit}
                className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-3xl font-bold">Station Units Management</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                setShowForm(true)
                setEditingUnit(null)
                setFormData({ unit_name: '', cad_code: null, unit_type: null, description: null })
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              + Add Unit
            </button>
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

        {/* Form */}
        {showForm && (
          <div className="mb-6 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingUnit ? 'Edit Unit' : 'Add New Unit'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold">Display Name *</label>
                <input
                  type="text"
                  value={formData.unit_name}
                  onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                  placeholder="e.g., Engine 2"
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
                <p className="text-xs text-gray-400 mt-1">Shown on displays and in announcements</p>
              </div>

              <div>
                <label className="block mb-2 font-semibold">CAD Code</label>
                <input
                  type="text"
                  value={formData.cad_code || ''}
                  onChange={(e) => setFormData({ ...formData, cad_code: e.target.value || null })}
                  placeholder="e.g., ENG2"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
                <p className="text-xs text-gray-400 mt-1">Code from CAD/dispatch (e.g., ENG2, LAD1). Leave empty if same as display name.</p>
              </div>

              <div>
                <label className="block mb-2 font-semibold">Unit Type</label>
                <select
                  value={formData.unit_type || ''}
                  onChange={(e) => setFormData({ ...formData, unit_type: e.target.value || null })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select type...</option>
                  {UNIT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-semibold">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
                >
                  {editingUnit ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Units List */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Station Units ({units.length})</h2>
          
          {units.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No units configured</p>
              <p className="text-sm mt-2">Click "Add Unit" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map(unit => (
                <div
                  key={unit.id}
                  className="p-4 bg-gray-700 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{unit.unit_name}</h3>
                      {unit.cad_code && (
                        <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded mt-1 mr-2 inline-block">
                          {unit.cad_code}
                        </span>
                      )}
                      {unit.unit_type && (
                        <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded mt-1 inline-block">
                          {unit.unit_type}
                        </span>
                      )}
                      {unit.unit_name && unitPins[unit.unit_name] && (
                        <div className="mt-2 text-xs text-gray-300">
                          <span className="font-semibold">GPIO Pin:</span>{' '}
                          <span className="mr-1">{unitPins[unit.unit_name].pin}</span>
                          <span className={unitPins[unit.unit_name].available ? 'text-green-400' : 'text-yellow-400'}>
                            {unitPins[unit.unit_name].available ? '(Active on Pi)' : '(Configured, relay not initialized)'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(unit)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id!)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {unit.description && (
                    <p className="text-sm text-gray-400 mt-2">{unit.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-900 border border-blue-700 rounded-lg p-6">
          <h3 className="font-semibold mb-2">📋 Instructions</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
            <li><strong>Display Name</strong> – Shown on alerts (e.g., Engine 2)</li>
            <li><strong>CAD Code</strong> – Code from your dispatch system (e.g., ENG2). Enables mapping: ENG2 → Engine 2</li>
            <li>Assign units to rooms in Room Speaker Admin for unit-based alert routing</li>
            <li>Room matching works with both CAD codes and display names</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default StationUnitsAdmin
