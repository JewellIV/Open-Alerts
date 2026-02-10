import { useState, useEffect } from 'react'
import { DEFAULT_STATION_COORDS } from '../utils/geocoding'

interface WeatherData {
  temp: number
  condition: string
  humidity: number
  windSpeed: number
  location: string
  lat?: number
  lon?: number
}

interface WeatherMapProps {
  // Default location - can be configured
  location?: string
}

function WeatherMap({ location = "Aylett, VA" }: WeatherMapProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [radarError, setRadarError] = useState<string | null>(null)
  const [useRadarIframe, setUseRadarIframe] = useState(true) // Default to iframe (more reliable)
  const [, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  // Re-render on resize so viewport units (vw/vh) recalculate fluidly
  useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Default coordinates for Mangohick Volunteer Fire Department
  // Address: 3493 King William Rd, Aylett, VA 23009
  // Verified coordinates for Aylett, VA area
  const defaultLat = DEFAULT_STATION_COORDS.lat
  const defaultLon = DEFAULT_STATION_COORDS.lon

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Using OpenWeatherMap free API
        // Note: You'll need to add VITE_OPENWEATHER_API_KEY to your .env file
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiKey = (import.meta as any).env?.VITE_OPENWEATHER_API_KEY || ''
        
        if (!apiKey) {
          // Try using coordinates-based lookup with wttr.in (free, no API key needed)
          console.log('No OpenWeatherMap API key, trying wttr.in...')
          try {
            const wttrResponse = await fetch(
              `https://wttr.in/${defaultLat},${defaultLon}?format=j1`,
              {
                headers: {
                  'User-Agent': 'Mangohick Fire Station Status Board'
                }
              }
            )
            
            if (wttrResponse.ok) {
              const wttrData = await wttrResponse.json()
              const current = wttrData.current_condition[0]
              
              const weatherData: WeatherData = {
                temp: parseInt(current.temp_F),
                condition: current.weatherDesc[0].value,
                humidity: parseInt(current.humidity),
                windSpeed: parseInt(current.windspeedMiles),
                location: location,
                lat: defaultLat,
                lon: defaultLon
              }
              
              setWeather(weatherData)
              fetchRadarImage(defaultLat, defaultLon)
              setLoading(false)
              setError(null)
              return
            }
          } catch (wttrErr) {
            console.error('wttr.in failed, using coordinates with OpenWeatherMap:', wttrErr)
          }
          
          // Final fallback: Show error message
          setError('Weather API key not configured. Please add VITE_OPENWEATHER_API_KEY to .env file')
          const mockWeather: WeatherData = {
            temp: 0,
            condition: 'Unknown',
            humidity: 0,
            windSpeed: 0,
            location: location,
            lat: defaultLat,
            lon: defaultLon
          }
          setWeather(mockWeather)
          fetchRadarImage(defaultLat, defaultLon)
          setLoading(false)
          return
        }

        // Fetch weather data using coordinates (more accurate than city name)
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${defaultLat}&lon=${defaultLon}&units=imperial&appid=${apiKey}`
        )

        if (!response.ok) {
          // If coordinates fail (401 = invalid API key), skip to fallback
          if (response.status === 401) {
            throw new Error('Invalid API key - using fallback')
          }
          
          // If coordinates fail, try city name
          const cityResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=imperial&appid=${apiKey}`
          )
          
          if (!cityResponse.ok) {
            if (cityResponse.status === 401) {
              throw new Error('Invalid API key - using fallback')
            }
            throw new Error(`Weather API returned ${cityResponse.status}`)
          }
          
          const cityData = await cityResponse.json()
          const weatherData: WeatherData = {
            temp: Math.round(cityData.main.temp),
            condition: cityData.weather[0].main,
            humidity: cityData.main.humidity,
            windSpeed: Math.round(cityData.wind?.speed || 0),
            location: cityData.name,
            lat: cityData.coord.lat,
            lon: cityData.coord.lon
          }
          
          setWeather(weatherData)
          fetchRadarImage(weatherData.lat || defaultLat, weatherData.lon || defaultLon)
          setLoading(false)
          return
        }

        const data = await response.json()
        
        const weatherData: WeatherData = {
          temp: Math.round(data.main.temp),
          condition: data.weather[0].main,
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind?.speed || 0),
          location: data.name || location,
          lat: data.coord.lat,
          lon: data.coord.lon
        }
        
        setWeather(weatherData)
        
        // Fetch radar data
        fetchRadarImage(weatherData.lat || defaultLat, weatherData.lon || defaultLon)
        
        setLoading(false)
        setError(null)
      } catch (err) {
        console.error('Error fetching weather:', err)
        // Try wttr.in as fallback
        try {
          const wttrResponse = await fetch(
            `https://wttr.in/${defaultLat},${defaultLon}?format=j1`,
            {
              headers: {
                'User-Agent': 'Mangohick Fire Station Status Board'
              }
            }
          )
          
          if (wttrResponse.ok) {
            const wttrData = await wttrResponse.json()
            const current = wttrData.current_condition[0]
            
            const weatherData: WeatherData = {
              temp: parseInt(current.temp_F),
              condition: current.weatherDesc[0].value,
              humidity: parseInt(current.humidity),
              windSpeed: parseInt(current.windspeedMiles),
              location: location,
              lat: defaultLat,
              lon: defaultLon
            }
            
            setWeather(weatherData)
            fetchRadarImage(defaultLat, defaultLon)
            setLoading(false)
            setError(null)
            return
          }
        } catch (wttrErr) {
          console.error('wttr.in fallback also failed:', wttrErr)
        }
        
        // Final fallback: Show error
        setError('Weather data unavailable - check API key or network connection')
        const mockWeather: WeatherData = {
          temp: 0,
          condition: 'Error',
          humidity: 0,
          windSpeed: 0,
          location: location,
          lat: defaultLat,
          lon: defaultLon
        }
        setWeather(mockWeather)
        fetchRadarImage(defaultLat, defaultLon)
        setLoading(false)
      }
    }

    fetchWeather()
    
    // Refresh weather every 10 minutes
    const interval = setInterval(fetchWeather, 600000)
    
    return () => clearInterval(interval)
  }, [location])

  // Fetch radar image using RainViewer API (free, no API key needed)
  // Note: We default to iframe embed as it's more reliable than static images (which may have CORS issues)
  const fetchRadarImage = async (lat: number, lon: number) => {
    setRadarError(null)
    // Default to iframe since static images often fail due to CORS
    // We'll still try static image for better performance, but expect it to fail
    setUseRadarIframe(true) // Default to iframe for reliability
    
    try {
      // Get available radar coverage
      const coverageResponse = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (!coverageResponse.ok) {
        throw new Error(`Radar API returned ${coverageResponse.status}`)
      }
      
      const coverageData = await coverageResponse.json()
      
      // Check if radar data exists
      if (!coverageData.radar) {
        throw new Error('No radar data in API response')
      }
      
      // Get the host URL from API response
      const host = coverageData.host || 'https://tilecache.rainviewer.com'
      
      // Get the most recent frame
      let latestFrame = null
      if (coverageData.radar.past && coverageData.radar.past.length > 0) {
        latestFrame = coverageData.radar.past[coverageData.radar.past.length - 1]
      } else if (coverageData.radar.nowcast && coverageData.radar.nowcast.length > 0) {
        latestFrame = coverageData.radar.nowcast[coverageData.radar.nowcast.length - 1]
      }
      
      if (!latestFrame || !latestFrame.time) {
        throw new Error('No radar frames available')
      }
      
      // Use RainViewer's static image API
      const zoom = 7 // Zoom level (7 is good for regional view)
      const width = 400
      const height = 300
      const options = 0 // No options
      
      // Construct the radar URL using the timestamp from the frame
      // Note: RainViewer static images may have CORS restrictions, so we'll try it
      // but gracefully fall back to iframe embed if it fails
      const radarUrl = `${host}/v2/radar/${latestFrame.time}/${zoom}/${lat.toFixed(4)}/${lon.toFixed(4)}/${width}/${height}/${options}/1_1.png`
      
      // Set the URL - images don't need CORS preflight, but may still fail due to CORS policy
      setRadarUrl(radarUrl)
      
      // Only log in development mode to reduce console noise
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((import.meta as any).env?.DEV) {
        console.log('Radar URL generated:', radarUrl, 'Frame time:', latestFrame.time, 'Host:', host)
      }
    } catch (err) {
      console.error('Error fetching radar:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      // Try alternative: Use NOAA radar as fallback
      try {
        // Use NOAA radar image for Virginia area as fallback
        const noaaRadarUrl = `https://radar.weather.gov/ridge/lite/N0R/DMX_0.png`
        console.log('Trying NOAA radar fallback...')
        setRadarUrl(noaaRadarUrl)
        setRadarError(null)
      } catch (fallbackErr) {
        setRadarError(`Radar unavailable: ${errorMessage}`)
        setRadarUrl(null)
      }
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-2 sm:p-4 border border-gray-700">
        <div className="text-gray-400 text-xs sm:text-sm">Loading weather...</div>
      </div>
    )
  }

  if (!weather) {
    return null
  }

  const getWeatherIcon = (condition: string) => {
    const cond = condition.toLowerCase()
    if (cond.includes('clear')) return '☀️'
    if (cond.includes('cloud')) return '☁️'
    if (cond.includes('rain')) return '🌧️'
    if (cond.includes('snow')) return '❄️'
    if (cond.includes('storm')) return '⛈️'
    if (cond.includes('fog') || cond.includes('mist')) return '🌫️'
    return '🌤️'
  }

  return (
    <div className="space-y-0.5 sm:space-y-1 lg:space-y-4 w-full max-w-full flex flex-col">
      {/* Weather Widget - square box */}
      <div className="bg-gray-800 rounded-lg p-1 sm:p-2 lg:p-6 border border-gray-700 shrink-0 aspect-square w-full">
        <div className="flex items-center justify-between gap-1 mb-0 sm:mb-1 lg:mb-2">
          <h3 className="text-[9px] sm:text-sm lg:text-xl font-semibold text-white truncate">Weather</h3>
          <span className="text-xs sm:text-xl lg:text-3xl shrink-0">{getWeatherIcon(weather.condition)}</span>
        </div>
        
        <div className="flex flex-wrap items-baseline gap-x-1.5 sm:gap-x-2 gap-y-0 sm:gap-y-1">
          <span className="text-sm sm:text-2xl lg:text-4xl font-bold text-white">{weather.temp}°F</span>
          <span className="text-[9px] sm:text-sm lg:text-lg text-gray-300">{weather.condition}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 sm:mt-1 lg:mt-2 pt-0.5 sm:pt-1 lg:pt-2 border-t border-gray-700">
          <span className="text-[8px] sm:text-xs text-gray-400 truncate">{weather.location}</span>
          <span className="text-[8px] sm:text-xs text-gray-500 shrink-0">H:{weather.humidity}% W:{weather.windSpeed}</span>
        </div>
        
        {error && (
          <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-yellow-500">{error}</div>
        )}
      </div>

      {/* Radar View - square box */}
      <div className="bg-gray-800 rounded-lg p-1 sm:p-2 lg:p-4 border border-gray-700 shrink-0 aspect-square w-full flex flex-col">
        <h3 className="text-[9px] sm:text-sm lg:text-lg font-semibold text-white mb-0 sm:mb-1 lg:mb-2 shrink-0">Radar</h3>
        {radarError ? (
          <div className="w-full flex-1 min-h-0 bg-gray-900 rounded flex flex-col items-center justify-center p-1 sm:p-2">
            <div className="text-yellow-500 text-[10px] sm:text-xs text-center">⚠️</div>
            <div className="text-gray-400 text-[8px] sm:text-xs text-center truncate">{radarError}</div>
          </div>
        ) : radarUrl ? (
          <div className="relative w-full flex-1 min-h-0 bg-gray-900 rounded overflow-hidden">
            {useRadarIframe ? (
              <iframe 
                src={`https://www.rainviewer.com/map.html?loc=${(weather?.lat || defaultLat).toFixed(4)},${(weather?.lon || defaultLon).toFixed(4)},7&oCS=1&c=1&o=83&lm=1&layer=radar&sm=1&sn=1&ts=2`}
                width="100%"
                frameBorder="0"
                style={{ border: 0, height: '100%' }}
                allowFullScreen
                title="Weather Radar"
              />
            ) : (
              <img 
                src={radarUrl} 
                alt="Weather Radar" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={() => {
                  // Fallback if image fails to load - switch to iframe
                  // This is expected behavior - RainViewer static images may have CORS issues
                  // The iframe embed is more reliable
                  if (!useRadarIframe) {
                    console.log('Radar static image unavailable, using RainViewer embed (this is normal)')
                    setUseRadarIframe(true)
                    setRadarError(null)
                  }
                }}
                onLoad={() => {
                  // Clear any previous errors when image loads successfully
                  setRadarError(null)
                  setUseRadarIframe(false)
                }}
              />
            )}
            <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 bg-black bg-opacity-70 px-1 py-0.5 rounded text-[8px] sm:text-xs text-white">
              Live
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-0 bg-gray-900 rounded flex items-center justify-center">
            <div className="text-gray-500 text-sm">Loading radar...</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WeatherMap
