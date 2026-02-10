import db from '../database';

/**
 * Get mapping from CAD codes to display names (e.g. ENG2 -> Engine 2)
 */
export function getUnitDisplayMapping(): Record<string, string> {
  const stmt = db.prepare('SELECT unit_name, cad_code FROM station_units WHERE is_active = 1');
  const rows = stmt.all() as Array<{ unit_name: string; cad_code: string | null }>;
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.unit_name] = row.unit_name; // display name maps to itself
    if (row.cad_code && row.cad_code.trim()) {
      map[row.cad_code.trim()] = row.unit_name;
      map[row.cad_code.trim().toUpperCase()] = row.unit_name;
    }
  }
  return map;
}

/**
 * Resolve CAD unit codes to client-defined display names
 * e.g. "ENG2, LAD1" -> "Engine 2, Ladder 1"
 */
export function resolveUnitsForDisplay(rawUnits: string): string {
  if (!rawUnits || !rawUnits.trim()) return rawUnits || '';
  const mapping = getUnitDisplayMapping();
  const parts = rawUnits.split(',').map(u => u.trim()).filter(u => u);
  if (Object.keys(mapping).length === 0) return rawUnits;
  return parts.map(p => mapping[p] || mapping[p.toUpperCase()] || p).join(', ');
}
