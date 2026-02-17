/**
 * Station units to show in unit selectors (IdleScreen, RoomSpeakerAdmin).
 * If non-empty, only these units are shown; otherwise all units from the API are shown.
 * Keeps the dropdown to your station's units even if the backend has others.
 * Matching is case-insensitive and trimmed.
 */
export const STATION_UNITS_WHITELIST: string[] = [
  'Medic 22',
  'Medic 21',
  'Ambulance 21',
  'Ambulance 22',
  'Engine 2',
  'Tanker 2',
  'Tanker 21',
  'Squad 2',
  'Brush 2',
  'Response 2'
]

const whitelistLower = new Set(STATION_UNITS_WHITELIST.map((u) => u.trim().toLowerCase()))

export function filterToStationUnits(unitNames: string[]): string[] {
  if (STATION_UNITS_WHITELIST.length === 0) return unitNames
  const filtered = unitNames.filter((name) => whitelistLower.has(name.trim().toLowerCase()))
  // If filter would hide everything, show all API units (backend may use different names)
  if (filtered.length === 0 && unitNames.length > 0) return unitNames
  return filtered
}
