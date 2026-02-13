import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { geocodeAddress, DEFAULT_STATION_COORDS } from '../utils/geocoding'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in react-leaflet
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = defaultIcon

// Component to update map center when coordinates change
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [map, center])
  
  return null
}

interface MapComponentProps {
  address: string
  callType?: string
  /** If dispatch sends latitude/longitude, map uses these and skips geocoding */
  latitude?: number | null
  longitude?: number | null
}

function MapComponent({ address, callType, latitude, longitude }: MapComponentProps) {
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const fetchCoordinates = async () => {
      setLoading(true)
      setError(null)
      cancelledRef.current = false

      const lat = latitude != null && !isNaN(Number(latitude)) ? Number(latitude) : null
      const lon = longitude != null && !isNaN(Number(longitude)) ? Number(longitude) : null
      if (lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        setCoordinates({ lat, lon })
        setLoading(false)
        return
      }

      // Clean up the address - remove extra whitespace
      const cleanAddress = address.trim()

      if (!cleanAddress) {
        setCoordinates(DEFAULT_STATION_COORDS)
        setLoading(false)
        return
      }

      // Add a timeout wrapper (6 seconds total - geocoding has 5s internal timeout)
      timeoutRef.current = setTimeout(() => {
        if (!cancelledRef.current) {
          console.warn('Geocoding timeout, using station location')
          setCoordinates(DEFAULT_STATION_COORDS)
          setError(`Geocoding timeout for "${cleanAddress}", showing station location`)
          setLoading(false)
          cancelledRef.current = true
        }
      }, 6000)

      try {
        const coords = await geocodeAddress(cleanAddress)
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        // If timeout already fired, don't update state
        if (cancelledRef.current) {
          return
        }
      
        if (coords) {
        setCoordinates(coords)
        setError(null)
      } else {
        // Fallback to default station coordinates
        setCoordinates(DEFAULT_STATION_COORDS)
        setError(`Address "${cleanAddress}" not found, showing station location`)
      }
      } catch (error) {
        console.error('Geocoding error:', error)
        if (!cancelledRef.current) {
          setCoordinates(DEFAULT_STATION_COORDS)
          setError(`Error geocoding "${cleanAddress}", showing station location`)
        }
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        if (!cancelledRef.current) {
          setLoading(false)
        }
      }
    }

    fetchCoordinates()
    
    // Cleanup on unmount or address change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      cancelledRef.current = true
    }
  }, [address, latitude, longitude])

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    )
  }

  if (!coordinates) {
    return (
      <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Map unavailable</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-700">
      <MapContainer
        center={[coordinates.lat, coordinates.lon]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        whenReady={() => {
          // Map is ready - size will be validated automatically
        }}
      >
        <MapUpdater center={[coordinates.lat, coordinates.lon]} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[coordinates.lat, coordinates.lon]}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{callType || 'Alert Location'}</div>
              <div className="text-gray-600">{address}</div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      {error && (
        <div className="absolute bottom-2 left-2 bg-yellow-600 bg-opacity-75 text-white text-xs px-2 py-1 rounded max-w-xs">
          <div className="font-semibold">⚠️ Using Station Location</div>
          <div className="text-xs opacity-90 mt-1">{error}</div>
        </div>
      )}
    </div>
  )
}

export default MapComponent
