/**
 * Resolve the backend URL for API calls.
 * When the page is loaded from a public origin (e.g. alerts.mangohickfire.com)
 * but localStorage has a private IP (192.168.x.x), browsers block those requests
 * (Private Network Access). Use the current origin in that case so API calls succeed.
 */
function isPrivateUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'localhost' || host.startsWith('127.')) return true
    if (host.startsWith('192.168.') || host.startsWith('10.')) return true
    if (host.startsWith('172.')) {
      const second = parseInt(host.split('.')[1], 10)
      if (second >= 16 && second <= 31) return true
    }
    return false
  } catch {
    return true
  }
}

let _apiBaseLogged = false
function logApiBaseOnce(url: string, note?: string): void {
  if (!_apiBaseLogged) {
    console.log('Using API base:', url, note ?? '')
    _apiBaseLogged = true
  }
}

export function getEffectiveBackendUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  const env = (import.meta as any)?.env?.VITE_BACKEND_URL as string | undefined
  if (env) {
    logApiBaseOnce(env)
    return env
  }
  const origin = window.location.origin
  // When loaded from a public origin (e.g. alerts.mangohickfire.com), always use it
  // so API calls are same-origin and not blocked by Private Network Access.
  if (origin && !origin.includes('5173') && !isPrivateUrl(origin)) {
    logApiBaseOnce(origin)
    return origin
  }
  const stored = localStorage.getItem('backendUrl')
  const candidate = stored || origin || 'http://localhost:3000'
  if (!origin || origin.includes('5173')) {
    logApiBaseOnce(candidate)
    return candidate
  }
  if (isPrivateUrl(candidate) && !isPrivateUrl(origin)) {
    logApiBaseOnce(origin, '(overrode private stored URL)')
    return origin
  }
  logApiBaseOnce(candidate)
  return candidate
}
