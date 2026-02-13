import { useState, useEffect } from 'react'
import { loginAdmin, isAdminLoggedIn, getAdminHeaders, initializeAdminAuth, logoutAdmin, clearAdminSession } from '../utils/adminAuth'

interface Notice {
  id?: number
  text: string
  priority: 'low' | 'medium' | 'high'
  expires_at?: string | null
  start_time?: string | null
  end_time?: string | null
  days_of_week?: string | null
  is_meeting_night?: number
  meeting_day_of_week?: number | null
  is_first_of_month?: number
  is_active?: number
  created_at?: string
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

function NoticesAdmin() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isMeetingNight, setIsMeetingNight] = useState(false)
  const [password, setPassword] = useState<string>('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000')

  useEffect(() => {
    // Use current origin when viewing from app URL so fetch succeeds (same as socket / Room Speaker Admin).
    const origin = window.location.origin
    const isDevServer = origin.includes('5173') || !origin
    const savedBackendUrl = !isDevServer ? origin : (localStorage.getItem('backendUrl') || 'http://localhost:3000')

    setBackendUrl(savedBackendUrl)
    initializeAdminAuth(savedBackendUrl)
    
    // Check if already logged in (pass savedBackendUrl - state hasn't updated yet on first run)
    if (isAdminLoggedIn()) {
      fetchNotices(savedBackendUrl)
    } else {
      setShowPasswordInput(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initialize meeting night state when editing
    if (editingNotice) {
      setIsMeetingNight(editingNotice.is_meeting_night === 1)
    } else {
      setIsMeetingNight(false)
    }
  }, [editingNotice])

  const fetchNotices = async (baseUrl?: string) => {
    if (!isAdminLoggedIn()) {
      setShowPasswordInput(true)
      setLoading(false)
      return
    }
    const url = baseUrl ?? backendUrl
    try {
      const response = await fetch(`${url}/api/notices/all`, {
        headers: getAdminHeaders()
      })
      
      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        setLoading(false)
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        setNotices(data.notices || [])
        setShowPasswordInput(false)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch notices:', errorData)
        alert(`Failed to fetch notices: ${errorData.error || errorData.message || response.statusText}`)
      }
    } catch (error) {
      console.error('Error fetching notices:', error)
      alert(`Error fetching notices: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
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
        await fetchNotices()
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
    
    const formData = new FormData(e.target as HTMLFormElement)
    
    // Convert datetime-local to ISO format
    let expiresAt = null
    const expiresAtInput = formData.get('expires_at') as string
    if (expiresAtInput) {
      // datetime-local format: "2024-01-15T23:59" -> ISO: "2024-01-15T23:59:00"
      expiresAt = expiresAtInput + ':00'
    }
    
    const notice: Notice = {
      text: formData.get('text') as string,
      priority: (formData.get('priority') as 'low' | 'medium' | 'high') || 'medium',
      expires_at: expiresAt,
      start_time: formData.get('start_time') ? (formData.get('start_time') as string) : null,
      end_time: formData.get('end_time') ? (formData.get('end_time') as string) : null,
      days_of_week: formData.get('days_of_week') ? (formData.get('days_of_week') as string).trim() : null,
      is_meeting_night: formData.get('is_meeting_night') === 'on' ? 1 : 0,
      meeting_day_of_week: formData.get('meeting_day_of_week') && formData.get('meeting_day_of_week') !== '' 
        ? parseInt(formData.get('meeting_day_of_week') as string) 
        : null,
      is_first_of_month: formData.get('is_first_of_month') === 'on' ? 1 : 0,
    }

    try {
      const url = editingNotice
        ? `${backendUrl}/api/notices/${editingNotice.id}`
        : `${backendUrl}/api/notices`
      
      const method = editingNotice ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        body: JSON.stringify(notice),
      })

      if (response.status === 401) {
        clearAdminSession()
        setShowPasswordInput(true)
        alert('Session expired. Please log in again.')
        return
      }

      if (response.ok) {
        const data = await response.json()
        console.log('Notice saved:', data)
        await fetchNotices()
        setShowForm(false)
        setEditingNotice(null)
        alert('Notice saved successfully!')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to save notice:', errorData)
        alert(`Failed to save notice: ${errorData.error || errorData.message || response.statusText}`)
      }
    } catch (error) {
      console.error('Error saving notice:', error)
      alert(`Error saving notice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this notice?')) return
    if (!isAdminLoggedIn()) {
      alert('Please log in first')
      setShowPasswordInput(true)
      return
    }

    try {
      const response = await fetch(`${backendUrl}/api/notices/${id}`, {
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
        await fetchNotices()
        alert('Notice deleted successfully!')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to delete notice:', errorData)
        alert(`Failed to delete notice: ${errorData.error || errorData.message || response.statusText}`)
      }
    } catch (error) {
      console.error('Error deleting notice:', error)
      alert(`Error deleting notice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice)
    setIsMeetingNight(notice.is_meeting_night === 1)
    setShowForm(true)
  }

  if (loading) {
    return <div className="p-8 text-white">Loading...</div>
  }

  if (showPasswordInput && !isAdminLoggedIn()) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Admin Login Required</h2>
            <p className="text-gray-400 mb-4">
              Enter your admin password to manage notices.
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Notices Management</h1>
            <a href="#dashboard" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
              ← Back to Dashboard
            </a>
          </div>
          <div className="flex items-center gap-4">
            {isAdminLoggedIn() && (
              <button
                onClick={async () => {
                  await logoutAdmin()
                  setShowPasswordInput(true)
                  setPassword('')
                }}
                className="text-sm text-gray-400 hover:text-gray-300"
              >
                Logout
              </button>
            )}
            <button
              onClick={() => {
                setEditingNotice(null)
                setIsMeetingNight(false)
                setShowForm(true)
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              + Add Notice
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              {editingNotice ? 'Edit Notice' : 'New Notice'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2">Notice Text *</label>
                <input
                  type="text"
                  name="text"
                  defaultValue={editingNotice?.text || ''}
                  required
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block mb-2">Priority</label>
                <select
                  name="priority"
                  defaultValue={editingNotice?.priority || 'medium'}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2">Start Time (HH:MM)</label>
                  <input
                    type="time"
                    name="start_time"
                    defaultValue={editingNotice?.start_time || ''}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block mb-2">End Time (HH:MM)</label>
                  <input
                    type="time"
                    name="end_time"
                    defaultValue={editingNotice?.end_time || ''}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2">Expires At</label>
                <input
                  type="datetime-local"
                  name="expires_at"
                  defaultValue={editingNotice?.expires_at ? editingNotice.expires_at.substring(0, 16) : ''}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block mb-2">Days of Week (comma-separated: 0=Sun, 1=Mon, etc.)</label>
                <input
                  type="text"
                  name="days_of_week"
                  placeholder="1,3,5 (Mon, Wed, Fri)"
                  defaultValue={editingNotice?.days_of_week || ''}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_meeting_night"
                      defaultChecked={editingNotice?.is_meeting_night === 1}
                      checked={isMeetingNight}
                      onChange={(e) => setIsMeetingNight(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Meeting Night Only</span>
                  </label>
                  <select
                    name="meeting_day_of_week"
                    defaultValue={editingNotice?.meeting_day_of_week?.toString() || ''}
                    disabled={!isMeetingNight && editingNotice?.is_meeting_night !== 1}
                    className="px-4 py-2 bg-gray-700 rounded-lg text-white disabled:opacity-50"
                  >
                    <option value="">Select Day</option>
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_first_of_month"
                      defaultChecked={editingNotice?.is_first_of_month === 1}
                      disabled={!isMeetingNight && editingNotice?.is_meeting_night !== 1}
                      className="w-4 h-4 disabled:opacity-50"
                    />
                    <span>First of Month Only</span>
                  </label>
                  <span className="text-xs text-gray-400">(e.g., First Wednesday of each month)</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingNotice(null)
                  }}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {notices.map(notice => (
            <div key={notice.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      notice.priority === 'high' ? 'bg-red-600' :
                      notice.priority === 'medium' ? 'bg-yellow-600' : 'bg-blue-600'
                    }`}>
                      {notice.priority.toUpperCase()}
                    </span>
                    {notice.is_active === 0 && (
                      <span className="px-2 py-1 rounded text-xs bg-gray-600">INACTIVE</span>
                    )}
                  </div>
                  <p className="text-lg mb-2">{notice.text}</p>
                  <div className="text-sm text-gray-400 space-y-1">
                    {notice.start_time && notice.end_time && (
                      <div>Time: {notice.start_time} - {notice.end_time}</div>
                    )}
                    {notice.days_of_week && (
                      <div>Days: {notice.days_of_week}</div>
                    )}
                    {notice.is_meeting_night === 1 && notice.meeting_day_of_week !== null && (
                      <div>
                        Meeting Night: {DAYS_OF_WEEK.find(d => d.value === notice.meeting_day_of_week)?.label}
                        {notice.is_first_of_month === 1 && ' (First of Month)'}
                      </div>
                    )}
                    {notice.expires_at && (
                      <div>Expires: {new Date(notice.expires_at).toLocaleString()}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(notice)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => notice.id && handleDelete(notice.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {notices.length === 0 && (
            <div className="text-center text-gray-400 py-8">No notices found</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NoticesAdmin
