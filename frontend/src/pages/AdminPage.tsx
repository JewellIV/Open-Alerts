import { useState, useEffect } from 'react'
import { lazy, Suspense } from 'react'

const NoticesAdmin = lazy(() => import('./NoticesAdmin'))
const SendAlertAdmin = lazy(() => import('./SendAlertAdmin'))
const RoomSpeakerAdmin = lazy(() => import('./RoomSpeakerAdmin'))
const StationUnitsAdmin = lazy(() => import('./StationUnitsAdmin'))
const ReportsAdmin = lazy(() => import('./ReportsAdmin'))

const TABS = [
  { id: 'notices', label: 'Notices' },
  { id: 'send-alert', label: 'Send Alert' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'units', label: 'Units' },
  { id: 'reports', label: 'Reports' },
] as const

type TabId = (typeof TABS)[number]['id']

const HASH_TO_TAB: Record<string, TabId> = {
  'notices': 'notices',
  'send-alert': 'send-alert',
  'room-speaker': 'speakers',
  'station-units': 'units',
  'reports': 'reports',
}

function AdminPage() {
  const hashTab = typeof window !== 'undefined' ? HASH_TO_TAB[window.location.hash.slice(1)] : undefined
  const [activeTab, setActiveTab] = useState<TabId>(hashTab || 'notices')

  useEffect(() => {
    const tabFromHash = HASH_TO_TAB[window.location.hash.slice(1)]
    if (tabFromHash) setActiveTab(tabFromHash)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header with back link and tab bar */}
      <header className="flex-shrink-0 border-b border-gray-700 bg-gray-800/80">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <a
            href="#dashboard"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </a>
          <h1 className="text-lg font-semibold text-gray-200">Admin</h1>
        </div>
        <nav className="flex gap-0 overflow-x-auto px-2 pb-0 scrollbar-thin">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Tab content */}
      <main className="flex-1 min-h-0 overflow-auto">
        <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
          {activeTab === 'notices' && <NoticesAdmin />}
          {activeTab === 'send-alert' && <SendAlertAdmin />}
          {activeTab === 'speakers' && <RoomSpeakerAdmin />}
          {activeTab === 'units' && <StationUnitsAdmin />}
          {activeTab === 'reports' && <ReportsAdmin />}
        </Suspense>
      </main>
    </div>
  )
}

export default AdminPage
