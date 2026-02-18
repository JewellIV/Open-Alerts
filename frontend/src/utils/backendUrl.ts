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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'N/A'
    const stored = typeof window !== 'undefined' ? localStorage.getItem('backendUrl') : null
    console.log('Using API base:', url, note ?? '')
    console.log('  Origin:', origin, '| Stored:', stored, '| Origin is private:', typeof window !== 'undefined' ? isPrivateUrl(origin) : 'N/A')
    _apiBaseLogged = true
  }
}

export function getEffectiveBackendUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  
  const origin = window.location.origin
  if (!origin) {
    const env = (import.meta as any)?.env?.VITE_BACKEND_URL as string | undefined
    const fallback = env || 'http://localhost:3000'
    logApiBaseOnce(fallback, env ? '(no origin, using VITE_BACKEND_URL)' : '(no origin available)')
    return fallback
  }
  
  // Check if origin is dev server
  const isDev = origin.includes('5173') || origin.includes('localhost') || origin.includes('127.0.0.1')
  
  // Check if origin is private IP
  const originIsPrivate = isPrivateUrl(origin)
  
  // CRITICAL: When loaded from a public origin (e.g. alerts.mangohickfire.com), 
  // ALWAYS use it so API calls are same-origin and not blocked by Private Network Access.
  // This must happen BEFORE checking env vars or localStorage.
  if (!isDev && !originIsPrivate) {
    logApiBaseOnce(origin, '(using public origin - forced)')
    return origin
  }
  
  // For dev/localhost, check env var first, then localStorage, then fallback
  const env = (import.meta as any)?.env?.VITE_BACKEND_URL as string | undefined
  if (env) {
    logApiBaseOnce(env, '(from VITE_BACKEND_URL env)')
    return env
  }
  
  const stored = localStorage.getItem('backendUrl')
  const candidate = stored || origin || 'http://localhost:3000'
  
  // Dev server: use candidate (could be stored or localhost)
  if (isDev) {
    logApiBaseOnce(candidate, '(dev mode)')
    return candidate
  }
  
  // If origin is private but we have a stored value, use stored (might be different private IP)
  logApiBaseOnce(candidate, stored ? '(from localStorage)' : '(fallback)')
  return candidate
}
