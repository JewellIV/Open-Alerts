// Geocoding utility using Nominatim (OpenStreetMap) - Free geocoding service

interface GeocodeResult {
  lat: string | number
  lon: string | number
  display_name: string
}

// Default station coordinates (Mangohick Volunteer Fire Department)
// Address: 3493 King William Rd, Aylett, VA 23009
// Verified coordinates for Aylett, VA area
export const DEFAULT_STATION_COORDS = {
  lat: 37.8015866,
  lon: -77.2585322
}

export const STATION_ADDRESS = "3493 King William Rd, Aylett, VA 23009"

/**
 * Geocode an address to coordinates using Nominatim API
 * @param address - The address to geocode
 * @returns Promise with coordinates or null if geocoding fails
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address || address.trim() === '') {
    return null
  }

  // Normalize the address first
  const normalizedAddress = address.trim().replace(/\s+/g, ' ')
  
  // Parse address components - extract city, state, and zip
  const zipMatch = normalizedAddress.match(/\b(\d{5})\b/)
  const zip = zipMatch ? zipMatch[1] : null

  // Prefer comma-based split so "205 Meadow Ln. Aylett, VA 23009" keeps "205 Meadow Ln." as street
  const parts = normalizedAddress.split(/\s*,\s*/).map(p => p.trim())
  let streetNumber: string | null = null
  let streetName: string | null = null
  let city: string | null = null
  if (parts.length >= 2) {
    const streetPart = parts[0] // e.g. "205 Meadow Ln."
    const cityPart = parts.length >= 3 ? parts[1] : null // e.g. "Aylett"
    const numMatch = streetPart.match(/^(\d+)\s+(.+)$/)
    if (numMatch) {
      streetNumber = numMatch[1]
      streetName = numMatch[2].trim() // "Meadow Ln." preserved
    }
    if (cityPart && /^[A-Za-z\s]+$/.test(cityPart)) city = cityPart
  }
  if (!city) {
    const cityMatch = normalizedAddress.match(/\b(?:Aylett|Hanover|Richmond|Mechanicsville|Ashland|Glen Allen|Short Pump|King William|West Point|New Kent|Williamsburg|Yorktown|Newport News|Hampton|Norfolk|Virginia Beach|Portsmouth|Suffolk|Chesapeake|Fredericksburg|Spotsylvania|Stafford|Caroline|Louisa|Goochland|Powhatan|Chesterfield|Henrico|Hanover|Charles City|New Kent|King and Queen|Essex|Middlesex|Lancaster|Northumberland|Westmoreland|Richmond County|Northampton|Accomack)\b/i)
    city = cityMatch ? cityMatch[1] : null
  }
  // Fallback: no commas - use regex to get number + rest of street (e.g. "205 Meadow Ln")
  if ((!streetNumber || !streetName) && /^\d+/.test(normalizedAddress)) {
    const fallbackMatch = normalizedAddress.match(/^(\d+)\s+(.+?)(?:\s+(?:VA|Virginia)\s+\d{5}|$)/i)
    if (fallbackMatch) {
      streetNumber = streetNumber ?? fallbackMatch[1]
      streetName = streetName ?? fallbackMatch[2].trim().replace(/\s+(?:VA|Virginia)\s+\d{5}$/i, '').trim()
    }
  }
  
  // Try multiple address variations to improve success rate
  const addressVariations: string[] = []

  // Strip trailing period after street type (e.g. "Meadow Ln." -> "Meadow Ln") so Nominatim can match
  const streetNameNoPeriod = streetName ? streetName.replace(/\.\s*$/, '').trim() : null

  // 0. Try without period first (Nominatim often doesn't match "Ln." literally)
  if (streetNumber && streetNameNoPeriod && (streetNameNoPeriod !== streetName || streetName?.endsWith('.'))) {
    if (city && zip) {
      addressVariations.push(`${streetNumber} ${streetNameNoPeriod}, ${city}, VA ${zip}`)
    } else if (zip) {
      addressVariations.push(`${streetNumber} ${streetNameNoPeriod}, VA ${zip}`)
    }
  }

  // 1. Original address (highest priority)
  addressVariations.push(normalizedAddress)

  // 2. With proper formatting and commas
  let formattedAddress = normalizedAddress
    .replace(/\s+(VA|Virginia)\s+(\d{5})/i, ', $1 $2')
    // Add commas around city names
    .replace(/\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*(?:VA|Virginia)/i, ', $1, $2')
  if (formattedAddress !== normalizedAddress) {
    addressVariations.push(formattedAddress)
  }
  
  // 3. Full format: Street, City, State ZIP (use extracted city or try common cities)
  if (streetNumber && streetName) {
    if (city && zip) {
      addressVariations.push(`${streetNumber} ${streetName}, ${city}, VA ${zip}`)
      addressVariations.push(`${streetNumber} ${streetName}, ${city}, Virginia ${zip}`)
    }
    if (zip) {
      // Try with zip code even without city
      addressVariations.push(`${streetNumber} ${streetName}, VA ${zip}`)
    }
  }
  
  // 5. Try abbreviated street types
  if (streetName) {
    const abbrevMap: { [key: string]: string } = {
      'Lane': 'Ln',
      'Street': 'St',
      'Road': 'Rd',
      'Drive': 'Dr',
      'Avenue': 'Ave',
      'Court': 'Ct',
      'Circle': 'Cir',
      'Highway': 'Hwy',
      'Parkway': 'Pkwy',
      'Boulevard': 'Blvd',
      'Place': 'Pl',
      'Terrace': 'Trc',
      'Trail': 'Trl',
      'Way': 'Wy',
      'Expressway': 'Expy',
      'Park': 'Pk',
      'Turnpike': 'Tpk',
      'Turn': 'Tr',
      'Loop': 'Lp',
      'Plaza': 'Plz',
      'Square': 'Sq',
    }
    let abbrevStreet = streetName
    Object.entries(abbrevMap).forEach(([full, abbrev]) => {
      abbrevStreet = abbrevStreet.replace(new RegExp(`\\b${full}\\b`, 'i'), abbrev)
    })
    if (abbrevStreet !== streetName && streetNumber) {
      if (city && zip) {
        addressVariations.push(`${streetNumber} ${abbrevStreet}, ${city}, VA ${zip}`)
      } else if (zip) {
        addressVariations.push(`${streetNumber} ${abbrevStreet}, VA ${zip}`)
      }
    }
  }
  
  // 6. Try expanding abbreviations
  if (streetName) {
    const expandMap: { [key: string]: string } = {
      'Ln': 'Lane',
      'St': 'Street',
      'Rd': 'Road',
      'Dr': 'Drive',
      'Ave': 'Avenue',
      'Ct': 'Court',
      'Cir': 'Circle',
      'Hwy': 'Highway',
      'Pkwy': 'Parkway',
      'Blvd': 'Boulevard',
      'Pl': 'Place',
      'Trc': 'Terrace',
      'Trl': 'Trail',
      'Wy': 'Way',
      'Expy': 'Expressway',
      'Pk': 'Park',
      'Tpk': 'Turnpike',
      'Tr': 'Turn',
      'Lp': 'Loop',
      'Plz': 'Plaza',
      'Sq': 'Square',
    }
    let expandedStreet = streetName
    Object.entries(expandMap).forEach(([abbrev, full]) => {
      expandedStreet = expandedStreet.replace(new RegExp(`\\b${abbrev}\\b`, 'i'), full)
    })
    expandedStreet = expandedStreet.replace(/\.\s*$/, '').trim() // "Meadow Lane." -> "Meadow Lane"
    if (expandedStreet !== streetName && streetNumber) {
      if (city && zip) {
        addressVariations.push(`${streetNumber} ${expandedStreet}, ${city}, VA ${zip}`)
      } else if (zip) {
        addressVariations.push(`${streetNumber} ${expandedStreet}, VA ${zip}`)
      }
    }
  }

  // 6b. "Meadow Lane" (expanded, no period) as first-class variation so it's tried early
  if (streetNumber && streetNameNoPeriod) {
    const expandedNoPeriod = streetNameNoPeriod.replace(/\bLn\b/i, 'Lane').replace(/\bSt\b/i, 'Street').replace(/\bRd\b/i, 'Road').replace(/\bDr\b/i, 'Drive')
    if (expandedNoPeriod !== streetNameNoPeriod && city && zip) {
      addressVariations.push(`${streetNumber} ${expandedNoPeriod}, ${city}, VA ${zip}`)
    }
  }
  
  // 7. Try without house number (for rural areas) - road name only often exists in OSM
  if (streetName) {
    const roadOnly = (streetNameNoPeriod || streetName).replace(/\.\s*$/, '')
    if (city && zip) {
      addressVariations.push(`${roadOnly}, ${city}, VA ${zip}`)
    } else if (zip) {
      addressVariations.push(`${roadOnly}, VA ${zip}`)
    }
  }
  
  // Remove duplicates (keeps insertion order)
  const uniqueVariations = [...new Set(addressVariations)]
  
  // Try more variations (8) so "no period" and "Lane" and "road only" get a chance
  const variationsToTry = uniqueVariations.slice(0, 8)
  
  // Set a timeout for the entire geocoding operation (5 seconds max)
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 5000)
  })

  const geocodePromise = (async () => {
    for (let i = 0; i < variationsToTry.length; i++) {
      const addressToTry = variationsToTry[i]
      try {
        // Only add delay after first request (to respect rate limits)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)) // Reduced from 1000ms to 500ms
        }

      // Nominatim requires a User-Agent header per their terms of use
      // Use countrycodes to limit to US for better results
      // Add viewbox to prioritize results near Virginia (but don't bound - allow wider search)
      const viewbox = '-84.0,36.0,-75.0,40.0' // Larger Virginia/region bounding box
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressToTry)}&format=json&limit=10&addressdetails=1&countrycodes=us&viewbox=${viewbox}&bounded=0`,
        {
          headers: {
            'User-Agent': 'Mangohick Fire Station Status Board ',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait longer and try again
          console.warn('Nominatim rate limited, waiting...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        console.error('Geocoding API error:', response.status)
        continue
      }

      const data: GeocodeResult[] = await response.json()

      if (!data || data.length === 0) {
        continue // Try next variation
      }

      // Try to find the best match - prefer results in Virginia
      let result = data[0]
      
      // Prefer results with street name match
      if (streetName) {
        const streetMatch = data.find(r => {
          const streetLower = streetName.toLowerCase().split(' ')[0]
          return r.display_name.toLowerCase().includes(streetLower)
        })
        if (streetMatch) {
          result = streetMatch
        }
      }
      
      // Prefer results matching the extracted city
      if (city) {
        const cityMatch = data.find(r => 
          r.display_name.toLowerCase().includes(city.toLowerCase())
        )
        if (cityMatch) {
          result = cityMatch
        }
      }
      
      // Prefer results matching the zip code
      if (zip) {
        const zipMatch = data.find(r => 
          r.display_name.includes(zip)
        )
        if (zipMatch) {
          result = zipMatch
        }
      }
      
      // Prefer Virginia results
      const vaResult = data.find(r => 
        r.display_name.toLowerCase().includes('virginia') || 
        r.display_name.toLowerCase().includes(', va')
      )
      if (vaResult) {
        result = vaResult
      }

      const coords = {
        lat: parseFloat(String(result.lat)),
        lon: parseFloat(String(result.lon))
      }

      // Validate coordinates
      if (isNaN(coords.lat) || isNaN(coords.lon)) {
        continue
      }

      // Validate coordinates are reasonable (within US bounds)
      if (coords.lat < 24 || coords.lat > 50 || coords.lon < -125 || coords.lon > -66) {
        console.warn('Coordinates out of US bounds:', coords)
        continue
      }

      console.log('Successfully geocoded:', addressToTry, 'to', coords, 'result:', result.display_name)
      return coords
    } catch (error) {
      console.error('Error geocoding address variation:', addressToTry, error)
      continue // Try next variation
    }
  }
  
  // Try structured query approach for better exact matching (only if we haven't found anything yet)
  const streetForStructured = (streetNameNoPeriod || streetName || '').replace(/\.\s*$/, '').trim()
  if (streetNumber && streetForStructured) {
    try {
      console.log('Trying structured query approach...')
      const streetValue = `${streetNumber} ${streetForStructured}`
      let structuredQuery = `street=${encodeURIComponent(streetValue)}&state=VA&country=US&format=json&limit=5`
      if (city && zip) {
        structuredQuery = `street=${encodeURIComponent(streetValue)}&city=${encodeURIComponent(city)}&state=VA&postalcode=${zip}&country=US&format=json&limit=5`
      } else if (zip) {
        structuredQuery = `street=${encodeURIComponent(streetValue)}&state=VA&postalcode=${zip}&country=US&format=json&limit=5`
      } else if (city) {
        structuredQuery = `street=${encodeURIComponent(streetValue)}&city=${encodeURIComponent(city)}&state=VA&country=US&format=json&limit=5`
      }
      const structuredResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?${structuredQuery}`,
        {
          headers: {
            'User-Agent': 'Mangohick Fire Station Status Board - OpenAlerts',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }
      )
      
      if (structuredResponse.ok) {
        const structuredData: GeocodeResult[] = await structuredResponse.json()
        if (structuredData && structuredData.length > 0) {
          const structResult = structuredData[0]
          const structCoords = {
            lat: parseFloat(String(structResult.lat)),
            lon: parseFloat(String(structResult.lon))
          }
          if (!isNaN(structCoords.lat) && !isNaN(structCoords.lon)) {
            console.log('Structured query succeeded:', structCoords, structResult.display_name)
            return structCoords
          }
        }
      }
    } catch (error) {
      console.error('Structured query failed:', error)
    }
  }
  
  console.warn('All geocoding attempts failed for address:', address)
  return null
  })()
  
  // Race between geocoding and timeout
  return Promise.race([geocodePromise, timeoutPromise])
}
