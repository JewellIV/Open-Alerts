import { useEffect, useState } from 'react'
import { getSocket } from '../utils/socket'
import { getEffectiveBackendUrl } from '../utils/backendUrl'

interface Notice {
  id: number
  text: string
  priority: 'low' | 'medium' | 'high'
  expires_at?: string | null
  start_time?: string | null
  end_time?: string | null
  days_of_week?: string | null
  is_meeting_night?: number
  meeting_day_of_week?: number | null
}

interface ScrollingNoticesProps {
  notices?: Notice[]
}

function ScrollingNotices({ notices: propNotices }: ScrollingNoticesProps) {
  const [notices, setNotices] = useState<Notice[]>(propNotices || [])

  useEffect(() => {
    // Get backend URL from environment or localStorage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backendUrl = getEffectiveBackendUrl()
    
    // Fetch notices from API
    const fetchNotices = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/notices`)
        if (response.ok) {
          const data = await response.json()
          setNotices(data.notices || [])
        } else {
          console.warn('Failed to fetch notices:', response.status)
          // Use empty array if API fails (don't show default notices)
          if (!propNotices) {
            setNotices([])
          }
        }
      } catch (error) {
        console.error('Error fetching notices:', error)
        // Use empty array if API fails (don't show default notices)
        if (!propNotices) {
          setNotices([])
        }
      }
    }

    fetchNotices()

    // Listen for notices updates via socket
    const socket = getSocket()
    socket.on('notices_updated', () => {
      console.log('Notices updated event received, refreshing...')
      fetchNotices()
    })

    // Refresh notices every minute to check for expired/time-based changes
    const interval = setInterval(fetchNotices, 60000)

    return () => {
      socket.off('notices_updated')
      clearInterval(interval)
    }
  }, [propNotices])

  useEffect(() => {
    // Ensure smooth scrolling on mount
    const element = document.querySelector('.scrolling-text')
    if (element) {
      element.classList.add('animate-scroll')
    }
  }, [notices])

  if (notices.length === 0) {
    return null
  }

  // Combine all notices into one scrolling text with spacing
  const allNoticesText = notices.map(n => n.text).join('     •     ')

  return (
    <div className="w-full bg-gray-800 border-t border-b border-gray-700 py-3 overflow-hidden relative">
      <div className="flex items-center">
        <div className="flex-shrink-0 px-4 z-10 bg-gray-800">
          <span className="text-sm font-semibold text-blue-400">
            NOTICES:
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="scrolling-text text-white text-lg whitespace-nowrap">
            {allNoticesText}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScrollingNotices
