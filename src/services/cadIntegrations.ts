/**
 * CAD System Integration Service
 * Handles integration with various Computer-Aided Dispatch (CAD) systems
 */

import db from '../database';
import { resolveUnitsForDisplay } from '../utils/unitResolution';

export interface CADAlert {
  call_type: string;
  address: string;
  units: string;
  narrative?: string | null;
}

export interface CADTransformer {
  transform(cadData: any): CADAlert | null;
  validate(cadData: any): boolean;
}

/**
 * Base CAD transformer with common field mappings
 */
export class BaseCADTransformer implements CADTransformer {
  transform(cadData: any): CADAlert | null {
    // Common field mappings across CAD systems
    const callType = cadData.call_type || 
                     cadData.callType ||
                     cadData.type || 
                     cadData.incident_type || 
                     cadData.nature || 
                     cadData.incidentType ||
                     'Dispatch';

    const address = cadData.address || 
                    cadData.location || 
                    cadData.full_address ||
                    cadData.fullAddress ||
                    this.buildAddress(cadData) ||
                    'Unknown Location';

    const units = cadData.units || 
                  cadData.unit || 
                  cadData.dispatched_units ||
                  cadData.dispatchedUnits ||
                  cadData.responding_units ||
                  cadData.respondingUnits ||
                  this.parseUnitsArray(cadData) ||
                  'Unknown Units';

    const narrative = cadData.narrative || 
                      cadData.message || 
                      cadData.description || 
                      cadData.notes || 
                      cadData.call_notes ||
                      cadData.callNotes ||
                      null;

    return {
      call_type: callType,
      address: address.trim(),
      units: units.trim(),
      narrative: narrative ? narrative.trim() : null
    };
  }

  validate(cadData: any): boolean {
    const transformed = this.transform(cadData);
    return !!(transformed && transformed.call_type && transformed.address && transformed.units);
  }

  protected buildAddress(cadData: any): string | null {
    if (cadData.street || cadData.city) {
      const parts = [
        cadData.street,
        cadData.city,
        cadData.state,
        cadData.zip || cadData.postalCode
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    return null;
  }

  protected parseUnitsArray(cadData: any): string | null {
    if (Array.isArray(cadData.units_array)) {
      return cadData.units_array.join(', ');
    }
    if (Array.isArray(cadData.unitsArray)) {
      return cadData.unitsArray.join(', ');
    }
    if (Array.isArray(cadData.dispatchedUnits)) {
      return cadData.dispatchedUnits.map((u: any) => u.name || u.unit || u).join(', ');
    }
    return null;
  }
}

/**
 * Firehouse Software CAD transformer
 */
export class FirehouseTransformer extends BaseCADTransformer {
  transform(cadData: any): CADAlert | null {
    // Firehouse Software specific format
    const callType = cadData.CallType || 
                     cadData.callType ||
                     cadData.Type ||
                     cadData.nature ||
                     'Dispatch';

    const address = cadData.Address ||
                    cadData.address ||
                    cadData.Location ||
                    this.buildAddress(cadData) ||
                    'Unknown Location';

    const units = cadData.Units ||
                  cadData.units ||
                  cadData.DispatchedUnits ||
                  this.parseFirehouseUnits(cadData) ||
                  'Unknown Units';

    const narrative = cadData.Narrative ||
                      cadData.narrative ||
                      cadData.Notes ||
                      cadData.notes ||
                      cadData.Description ||
                      null;

    return {
      call_type: callType.trim(),
      address: address.trim(),
      units: units.trim(),
      narrative: narrative ? narrative.trim() : null
    };
  }

  private parseFirehouseUnits(cadData: any): string | null {
    if (Array.isArray(cadData.Units)) {
      return cadData.Units.map((u: any) => u.UnitName || u.Name || u).join(', ');
    }
    if (cadData.Units && typeof cadData.Units === 'string') {
      return cadData.Units;
    }
    return null;
  }
}

/**
 * IamResponding CAD transformer
 */
export class IamRespondingTransformer extends BaseCADTransformer {
  transform(cadData: any): CADAlert | null {
    // IamResponding specific format
    const callType = cadData.callType ||
                     cadData.type ||
                     cadData.nature ||
                     'Dispatch';

    const address = cadData.address ||
                    cadData.location ||
                    cadData.fullAddress ||
                    `${cadData.street || ''}, ${cadData.city || ''}, ${cadData.state || ''} ${cadData.zip || ''}`.trim() ||
                    'Unknown Location';

    const units = cadData.units ||
                  cadData.dispatchedUnits ||
                  cadData.respondingUnits ||
                  (Array.isArray(cadData.units) ? cadData.units.join(', ') : '') ||
                  'Unknown Units';

    const narrative = cadData.narrative ||
                      cadData.message ||
                      cadData.description ||
                      cadData.notes ||
                      null;

    return {
      call_type: callType.trim(),
      address: address.trim(),
      units: units.trim(),
      narrative: narrative ? narrative.trim() : null
    };
  }
}

/**
 * CentralSquare/TriTech CAD transformer
 */
export class CentralSquareTransformer extends BaseCADTransformer {
  transform(cadData: any): CADAlert | null {
    // CentralSquare/TriTech specific format
    const callType = cadData.incidentType ||
                     cadData.IncidentType ||
                     cadData.callType ||
                     cadData.nature ||
                     'Dispatch';

    const address = cadData.address ||
                    cadData.Address ||
                    cadData.location ||
                    cadData.Location ||
                    this.buildCentralSquareAddress(cadData) ||
                    'Unknown Location';

    const units = cadData.units ||
                  cadData.Units ||
                  cadData.dispatchedUnits ||
                  cadData.DispatchedUnits ||
                  this.parseCentralSquareUnits(cadData) ||
                  'Unknown Units';

    const narrative = cadData.narrative ||
                      cadData.Narrative ||
                      cadData.description ||
                      cadData.Description ||
                      cadData.notes ||
                      cadData.Notes ||
                      null;

    return {
      call_type: callType.trim(),
      address: address.trim(),
      units: units.trim(),
      narrative: narrative ? narrative.trim() : null
    };
  }

  private buildCentralSquareAddress(cadData: any): string | null {
    if (cadData.streetAddress || cadData.city) {
      const parts = [
        cadData.streetAddress || cadData.street,
        cadData.city || cadData.City,
        cadData.state || cadData.State,
        cadData.zipCode || cadData.zip || cadData.ZipCode
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    return null;
  }

  private parseCentralSquareUnits(cadData: any): string | null {
    if (Array.isArray(cadData.units)) {
      return cadData.units.map((u: any) => u.unitName || u.name || u.unitId || u).join(', ');
    }
    if (cadData.DispatchedUnits && Array.isArray(cadData.DispatchedUnits)) {
      return cadData.DispatchedUnits.map((u: any) => u.UnitName || u.Name || u).join(', ');
    }
    return null;
  }
}

/**
 * Process CAD alert and save to database
 */
export function processCADAlert(transformedAlert: CADAlert, source: string): any {
  try {
    // Insert alert into database (with source tracking)
    const stmt = db.prepare(`
      INSERT INTO alerts (call_type, address, units, narrative, source)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      transformedAlert.call_type,
      transformedAlert.address,
      transformedAlert.units,
      transformedAlert.narrative || null,
      source
    );

    const alert = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      call_type: transformedAlert.call_type,
      address: transformedAlert.address,
      units: transformedAlert.units,
      display_units: resolveUnitsForDisplay(transformedAlert.units),
      narrative: transformedAlert.narrative || null,
      source: source
    };

    console.log(`✅ ${source} alert processed:`, alert);
    return alert;
  } catch (error) {
    console.error(`Error processing ${source} alert:`, error);
    throw error;
  }
}
