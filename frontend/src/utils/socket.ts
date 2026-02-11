import { io, Socket } from 'socket.io-client'

// Singleton socket instance to prevent disconnections from React StrictMode
let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    // Use env, then localStorage, then current page origin (so one build works from Pi or PC by IP)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env as Record<string, string | undefined>
    const backendUrl =
      env.VITE_BACKEND_URL ||
      (typeof window !== 'undefined' && (localStorage.getItem('backendUrl') || window.location.origin)) ||
      'http://localhost:3000'

    console.log(`🔌 Connecting to backend at: ${backendUrl}`)
    
    socketInstance = io(backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Increased max delay
      reconnectionAttempts: Infinity,
      timeout: 45000, // Match backend connectTimeout
      // Use polling first - more stable than websocket for unreliable networks
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      forceNew: false,
      // Don't disconnect on page unload
      closeOnBeforeunload: false,
      // Add exponential backoff for reconnection
      randomizationFactor: 0.5
    })
    
    // Add transport-level error handling
    socketInstance.io.on('reconnect_attempt', () => {
      console.log('🔄 Socket.io attempting to reconnect...')
    })
    
    socketInstance.io.on('reconnect', () => {
      console.log('✅ Socket.io reconnected successfully')
    })
    
    socketInstance.io.on('reconnect_error', (error) => {
      console.error('❌ Socket.io reconnection error:', error)
    })
    
    socketInstance.io.on('reconnect_failed', () => {
      console.error('❌ Socket.io reconnection failed - will keep trying')
    })
  }
  return socketInstance
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
