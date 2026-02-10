/**
 * Reports and Analytics Admin Page
 * Provides reporting and analytics functionality
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { loginAdmin, isAdminLoggedIn, getAdminHeaders, initializeAdminAuth, logoutAdmin } from '../utils/adminAuth'
import LanguageSwitcher from '../components/LanguageSwitcher'

interface AlertStatistics {
  totalAlerts: number
  alertsByType: Record<string, number>
  alertsByHour: Record<number, number>
  alertsByDay: Record<string, number>
  alertsByMonth: Record<string, number>
  averageAlertsPerDay: number
  mostCommonCallType: string
  busiestHour: number
  busiestDay: string
}

interface UnitStatistics {
  unitName: string
  totalCalls: number
  percentageOfTotal: number
}

function ReportsAdmin() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState<string>('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000')
  
  const [statistics, setStatistics] = useState<AlertStatistics | null>(null)
  const [unitStats, setUnitStats] = useState<UnitStatistics[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    const savedBackendUrl = localStorage.getItem('backendUrl') || 'http://localhost:3000'
    setBackendUrl(savedBackendUrl)
    initializeAdminAuth(savedBackendUrl)
    
    if (isAdminLoggedIn()) {
      fetchReports()
    } else {
      setShowPasswordInput(true)
    }
    
    setLoading(false)
  }, [])

  const fetchReports = async () => {
    if (!isAdminLoggedIn()) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      
      const queryString = params.toString()
      const baseUrl = `${backendUrl}/api/reports`
      
      const [statsRes, unitsRes] = await Promise.all([
        fetch(`${baseUrl}/statistics${queryString ? '?' + queryString : ''}`, {
          headers: getAdminHeaders()
        }),
        fetch(`${baseUrl}/units${queryString ? '?' + queryString : ''}`, {
          headers: getAdminHeaders()
        })
      ])
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStatistics(statsData.statistics)
      }
      
      if (unitsRes.ok) {
        const unitsData = await unitsRes.json()
        setUnitStats(unitsData.units || [])
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      alert(t('admin.enterPassword'))
      return
    }
    setLoading(true)
    try {
      const result = await loginAdmin(password)
      if (result.success) {
        setShowPasswordInput(false)
        await fetchReports()
      } else {
        alert(result.error || t('admin.invalidPassword'))
      }
    } catch (error) {
      console.error('Error during login:', error)
      alert(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    if (!isAdminLoggedIn()) {
      alert(t('admin.loginRequired'))
      return
    }
    
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('format', format)
      
      const response = await fetch(`${backendUrl}/api/reports/export?${params.toString()}`, {
        headers: getAdminHeaders()
      })
      
      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `alerts_${Date.now()}.csv`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } else {
          const data = await response.json()
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `alerts_${Date.now()}.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Error exporting data')
    }
  }

  if (loading && !statistics) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">{t('common.loading')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('reports.title')}</h1>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
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
                {t('admin.logout')}
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
              ← {t('common.back')} {t('dashboard.title')}
            </a>
            </div>
          </div>
        </div>

        {/* Password Login */}
        {showPasswordInput && !isAdminLoggedIn() && (
          <div className="mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
            <label className="block mb-2 font-semibold">{t('admin.loginRequired')}</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('admin.enterPassword')}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {t('admin.login')}
              </button>
            </div>
          </div>
        )}

        {isAdminLoggedIn() && (
          <>
            {/* Date Range Filter */}
            <div className="mb-6 p-4 bg-gray-800 rounded-lg">
              <h2 className="text-xl font-bold mb-4">{t('reports.dateRange')}</h2>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block mb-2 text-sm">{t('reports.startDate')}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-2 text-sm">{t('reports.endDate')}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchReports}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics */}
            {statistics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4">{t('reports.statistics')}</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('reports.totalAlerts')}:</span>
                      <span className="font-semibold text-2xl">{statistics.totalAlerts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('reports.averagePerDay')}:</span>
                      <span className="font-semibold">{statistics.averageAlertsPerDay.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('reports.mostCommonCallType')}:</span>
                      <span className="font-semibold">{statistics.mostCommonCallType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('reports.busiestHour')}:</span>
                      <span className="font-semibold">{statistics.busiestHour}:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('reports.busiestDay')}:</span>
                      <span className="font-semibold">{statistics.busiestDay}</span>
                    </div>
                  </div>
                </div>

                {/* Alerts by Type */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4">{t('reports.alertsByType')}</h2>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(statistics.alertsByType)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="text-gray-300">{type}</span>
                          <span className="font-semibold">{count as number}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unit Statistics */}
            {unitStats.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">{t('reports.unitStatistics')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unitStats.slice(0, 12).map((unit) => (
                    <div key={unit.unitName} className="bg-gray-700 rounded-lg p-4">
                      <div className="font-semibold">{unit.unitName}</div>
                      <div className="text-sm text-gray-400">
                        {unit.totalCalls} {t('reports.totalAlerts').toLowerCase()} ({unit.percentageOfTotal.toFixed(1)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Options */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">{t('reports.export')}</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => handleExport('csv')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  {t('reports.exportCSV')}
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  {t('reports.exportJSON')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ReportsAdmin
