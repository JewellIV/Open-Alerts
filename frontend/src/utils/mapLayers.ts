/**
 * Types and loader for stations and hydrants map layer.
 * Data file: public/hydrants-stations.json
 */

export interface MapPoint {
  id: string
  name?: string
  lat: number
  lon: number
}

export interface HydrantsStationsData {
  stations: MapPoint[]
  dryHydrants: MapPoint[]
  countyHydrants: MapPoint[]
}

export type MapPointType = 'station' | 'dryHydrant' | 'countyHydrant'

export interface MapPointWithType extends MapPoint {
  type: MapPointType
}

/** Haversine distance in miles */
export function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959 // Earth radius miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function loadHydrantsStations(): Promise<HydrantsStationsData | null> {
  return fetch('/hydrants-stations.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
}

/** Closest 2 hydrants only (dry + county), not stations */
export function getClosestTwo(
  alertLat: number,
  alertLon: number,
  data: HydrantsStationsData | null
): Array<{ point: MapPointWithType; miles: number }> {
  if (!data) return []
  const hydrantsOnly: MapPointWithType[] = [
    ...data.dryHydrants.map((p) => ({ ...p, type: 'dryHydrant' as MapPointType })),
    ...data.countyHydrants.map((p) => ({ ...p, type: 'countyHydrant' as MapPointType })),
  ]
  const withDist = hydrantsOnly.map((point) => ({
    point,
    miles: distanceMiles(alertLat, alertLon, point.lat, point.lon),
  }))
  withDist.sort((a, b) => a.miles - b.miles)
  return withDist.slice(0, 2)
}

export function typeLabel(type: MapPointType): string {
  switch (type) {
    case 'station':
      return 'Station'
    case 'dryHydrant':
      return 'Dry Hydrant'
    case 'countyHydrant':
      return 'County Hydrant'
    default:
      return 'Location'
  }
}
