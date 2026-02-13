import { useState, useEffect } from 'react'
import { loginAdmin, isAdminLoggedIn, getAdminHeaders, initializeAdminAuth, logoutAdmin, clearAdminSession } from '../utils/adminAuth'

const CALL_TYPE_PRESETS = [
  'Admin Announcement',
  'Station Alert',
  'Meeting Notice',
  'General Announcement',
  'Fire Dispatch',
  'EMS Dispatch',
  'Test Alert'
]

function SendAlertAdmin() {
  const [callType, setCallType] = useState('Admin Announcement')
  const [address, setAddress] = useState('Station')
  const [units, setUnits] = useState('All Units')
  const [narrative, setNarrative] = useState('')
  const [sending, setSending] = useState(false)
  const [password, setPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000')

  useEffect(() => {
    const origin = window.location.origin
    const isDevServer = origin.includes('5173') || !origin
    const savedBackendUrl = !isDevServer ? origin : (localStorage.getItem('backendUrl') || 'http://localhost:3000')
    setBackendUrl(savedBackendUrl)
    initializeAdminAuth(savedBackendUrl)
    if (!isAdminLoggedIn()) {
      setShowPasswordInput(true)
    }
  }, [])

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      alert('Please enter a password')
      return
    }
    setSending(true)
    try {
      const result = await loginAdmin(password)
      if (result.success) {
        setShowPasswordInput(false)
      } else {
        alert(result.error || 'Login failed')
      }
    } catch (error) {
      alert(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdminLoggedIn()) {
      alert('Please log in first')
      setShowPasswordInput(true)
      return
    }

    setSending(true)
    try {
      const response = await fetch(`${backendUrl}/api/admin/send-alert`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          call_type: callType,
          address: address.trim() || 'Station',
          units: units.trim() || 'All Units',
          narrative: narrative.trim() || null
        })
      })

      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        alert('Session expired. Please log in again.')
        return
      }

      if (response.ok) {
        alert('Alert sent! It will appear on all displays.')
        setNarrative('')
      } else {
        const err = await response.json()
        alert(`Failed to send: ${err.error || err.message || response.statusText}`)
      }
    } catch (error) {
      console.error('Error sending alert:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to send alert'}`)
    } finally {
      setSending(false)
    }
  }

  if (showPasswordInput) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Admin Login Required</h2>
          <p className="text-gray-400 mb-4">Enter your admin password to send alerts.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white mb-4"
            onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            autoFocus
          />
          <button
            onClick={handlePasswordSubmit}
            disabled={sending}
            className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50"
          >
            Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Send Alert</h1>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await logoutAdmin()
                setShowPasswordInput(true)
                setPassword('')
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Logout
            </button>
            <a
              href="#"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              onClick={(e) => {
                e.preventDefault()
                window.location.hash = ''
              }}
            >
              ← Dashboard
            </a>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 mb-6">
            Send a general alert to all displays. It will appear immediately with TTS, lights, and any configured integrations (Discord, Slack, etc.).
          </p>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold">Alert Type / Subject *</label>
              <select
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                {CALL_TYPE_PRESETS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-semibold">Address / Location *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., Station, Meeting Room, 123 Main St"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">Units *</label>
              <input
                type="text"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g., All Units, Engine 1, Admin"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">Message (optional)</label>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Enter your message here..."
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-lg disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending...' : 'Send Alert'}
            </button>
          </form>
        </div>

        <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <p className="text-sm text-gray-300">
            <strong>Note:</strong> Alerts are sent to all connected displays, room speakers (based on unit matching), and any configured Discord/Slack webhooks.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SendAlertAdmin
