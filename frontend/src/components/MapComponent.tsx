import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { geocodeAddress, DEFAULT_STATION_COORDS } from '../utils/geocoding'
import {
  loadHydrantsStations,
  getClosestTwo,
  typeLabel,
  type HydrantsStationsData,
} from '../utils/mapLayers'
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

function createCircleIcon(color: string, size = 12) {
  return L.divIcon({
    className: 'map-layer-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Red Maltese cross with "F" in center (fire department symbol). 8-point star shape.
const MALTESE_CROSS_SVG = (size: number) => {
  const s = size
  const c = s / 2
  const R = c - 1
  const r = R * 0.4
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    pts.push(`${c + rad * Math.cos(angle)},${c + rad * Math.sin(angle)}`)
  }
  const points = pts.join(' ')
  return `<div style="width:${s}px;height:${s}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))"><svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg"><polygon points="${points}" fill="#b91c1c" stroke="#7f1d1d" stroke-width="0.8"/><text x="${c}" y="${c + 4}" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="11">F</text></svg></div>`
}

function createMalteseCrossIcon(size = 32) {
  return L.divIcon({
    className: 'map-layer-icon',
    html: MALTESE_CROSS_SVG(size),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const stationIcon = createMalteseCrossIcon(32)
const dryHydrantIcon = createCircleIcon('#dc2626')
const countyHydrantIcon = createCircleIcon('#2563eb')

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
  const [layerData, setLayerData] = useState<HydrantsStationsData | null>(null)
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

  useEffect(() => {
    loadHydrantsStations().then(setLayerData)
  }, [])

  const closestTwo = coordinates
    ? getClosestTwo(coordinates.lat, coordinates.lon, layerData)
    : []

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
        {layerData?.stations.map((p) => (
          <Marker key={`station-${p.id}`} position={[p.lat, p.lon]} icon={stationIcon}>
            <Popup>
              <div className="text-sm font-medium">Station: {p.name || p.id}</div>
            </Popup>
          </Marker>
        ))}
        {layerData?.dryHydrants.map((p) => (
          <Marker key={`dry-${p.id}`} position={[p.lat, p.lon]} icon={dryHydrantIcon}>
            <Popup>
              <div className="text-sm">Dry Hydrant{p.name ? `: ${p.name}` : ''}</div>
            </Popup>
          </Marker>
        ))}
        {layerData?.countyHydrants.map((p) => (
          <Marker key={`county-${p.id}`} position={[p.lat, p.lon]} icon={countyHydrantIcon}>
            <Popup>
              <div className="text-sm">County Hydrant{p.name ? `: ${p.name}` : ''}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {closestTwo.length > 0 && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-gray-900/90 text-white text-xs rounded p-2 shadow max-w-xs">
          <div className="font-semibold mb-1">Closest 2 hydrants</div>
          {closestTwo.map(({ point, miles }, i) => (
            <div key={`closest-${i}-${point.id}`} className="flex items-center gap-2 py-0.5">
              <span className="text-gray-400">{i + 1}.</span>
              <span>{typeLabel(point.type)}: {point.name || point.id}</span>
              <span className="text-gray-400 ml-auto">{miles.toFixed(2)} mi</span>
            </div>
          ))}
        </div>
      )}
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
