/**
 * Admin Authentication Utility
 * Handles password-based authentication for admin pages
 */

let adminToken: string | null = null
let backendUrl = 'http://localhost:3000'

/**
 * Initialize admin auth with backend URL
 */
export function initializeAdminAuth(apiBackendUrl?: string): void {
  if (apiBackendUrl) {
    backendUrl = apiBackendUrl
  }
  
  // Load saved token from localStorage
  const savedToken = localStorage.getItem('adminToken')
  if (savedToken) {
    adminToken = savedToken
  }
}

/**
 * Login with password
 */
export async function loginAdmin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch(`${backendUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    })
    
    if (response.ok) {
      const data = await response.json()
      adminToken = data.token
      localStorage.setItem('adminToken', data.token)
      return { success: true, token: data.token }
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Login failed' }))
      return { success: false, error: errorData.message || 'Invalid password' }
    }
  } catch (error) {
    console.error('Error during admin login:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Login failed' }
  }
}

/**
 * Clear local admin session (e.g. after 401). Does not call backend.
 * Use this when the server returns session expired so the user can log in again.
 */
export function clearAdminSession(): void {
  adminToken = null
  localStorage.removeItem('adminToken')
}

/**
 * Logout admin
 */
export async function logoutAdmin(): Promise<void> {
  if (adminToken) {
    try {
      await fetch(`${backendUrl}/api/admin/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        }
      })
    } catch (error) {
      console.error('Error during logout:', error)
    }
  }
  clearAdminSession()
}

/**
 * Check if admin is logged in
 */
export function isAdminLoggedIn(): boolean {
  return adminToken !== null
}

/**
 * Get admin token (for API requests)
 */
export function getAdminToken(): string | null {
  return adminToken
}

/**
 * Get headers for authenticated admin requests
 */
export function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (adminToken) {
    headers['X-Admin-Token'] = adminToken
  }
  
  return headers
}
