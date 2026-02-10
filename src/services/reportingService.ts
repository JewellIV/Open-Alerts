/**
 * Reporting and Analytics Service
 * Provides reporting and analytics functionality for alerts
 */

import db from '../database';

export interface AlertStatistics {
  totalAlerts: number;
  alertsByType: Record<string, number>;
  alertsByHour: Record<number, number>;
  alertsByDay: Record<string, number>;
  alertsByMonth: Record<string, number>;
  averageAlertsPerDay: number;
  mostCommonCallType: string;
  busiestHour: number;
  busiestDay: string;
}

export interface UnitStatistics {
  unitName: string;
  totalCalls: number;
  percentageOfTotal: number;
}

export interface TimeRange {
  startDate: string;
  endDate: string;
}

/**
 * Get alert statistics for a time range
 */
export function getAlertStatistics(timeRange?: TimeRange): AlertStatistics {
  let query = `
    SELECT 
      call_type,
      datetime(timestamp) as alert_time,
      DATE(timestamp) as alert_date,
      strftime('%H', timestamp) as alert_hour,
      strftime('%m', timestamp) as alert_month,
      strftime('%w', timestamp) as day_of_week
    FROM alerts
  `;

  const params: any[] = [];

  if (timeRange) {
    query += ` WHERE timestamp >= ? AND timestamp <= ?`;
    params.push(timeRange.startDate, timeRange.endDate);
  }

  query += ` ORDER BY timestamp DESC`;

  const stmt = db.prepare(query);
  const alerts = stmt.all(...params) as any[];

  const stats: AlertStatistics = {
    totalAlerts: alerts.length,
    alertsByType: {},
    alertsByHour: {},
    alertsByDay: {},
    alertsByMonth: {},
    averageAlertsPerDay: 0,
    mostCommonCallType: '',
    busiestHour: 0,
    busiestDay: ''
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames: Record<string, string> = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
  };

  // Count by type, hour, day, month
  alerts.forEach(alert => {
    // By type
    stats.alertsByType[alert.call_type] = (stats.alertsByType[alert.call_type] || 0) + 1;

    // By hour
    const hour = parseInt(alert.alert_hour);
    stats.alertsByHour[hour] = (stats.alertsByHour[hour] || 0) + 1;

    // By day
    const dayName = dayNames[parseInt(alert.day_of_week)];
    stats.alertsByDay[dayName] = (stats.alertsByDay[dayName] || 0) + 1;

    // By month
    const monthName = monthNames[alert.alert_month] || alert.alert_month;
    stats.alertsByMonth[monthName] = (stats.alertsByMonth[monthName] || 0) + 1;
  });

  // Calculate averages
  const uniqueDays = new Set(alerts.map(a => a.alert_date)).size;
  stats.averageAlertsPerDay = uniqueDays > 0 ? stats.totalAlerts / uniqueDays : 0;

  // Find most common call type
  let maxCount = 0;
  for (const [type, count] of Object.entries(stats.alertsByType)) {
    if (count > maxCount) {
      maxCount = count;
      stats.mostCommonCallType = type;
    }
  }

  // Find busiest hour
  let maxHourCount = 0;
  for (const [hour, count] of Object.entries(stats.alertsByHour)) {
    if (count > maxHourCount) {
      maxHourCount = count;
      stats.busiestHour = parseInt(hour);
    }
  }

  // Find busiest day
  let maxDayCount = 0;
  for (const [day, count] of Object.entries(stats.alertsByDay)) {
    if (count > maxDayCount) {
      maxDayCount = count;
      stats.busiestDay = day;
    }
  }

  return stats;
}

/**
 * Get unit statistics
 */
export function getUnitStatistics(timeRange?: TimeRange): UnitStatistics[] {
  let query = `
    SELECT units, COUNT(*) as call_count
    FROM alerts
  `;

  const params: any[] = [];

  if (timeRange) {
    query += ` WHERE timestamp >= ? AND timestamp <= ?`;
    params.push(timeRange.startDate, timeRange.endDate);
  }

  query += ` GROUP BY units ORDER BY call_count DESC`;

  const stmt = db.prepare(query);
  const unitData = stmt.all(...params) as Array<{ units: string; call_count: number }>;

  // Get total for percentage calculation
  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM alerts${timeRange ? ' WHERE timestamp >= ? AND timestamp <= ?' : ''}`);
  const totalResult = timeRange 
    ? totalStmt.get(timeRange.startDate, timeRange.endDate) as { total: number }
    : totalStmt.get() as { total: number };
  const totalCalls = totalResult.total || 1;

  // Parse units and aggregate
  const unitMap = new Map<string, number>();

  unitData.forEach(row => {
    const units = row.units.split(',').map(u => u.trim());
    units.forEach(unit => {
      if (unit) {
        unitMap.set(unit, (unitMap.get(unit) || 0) + row.call_count);
      }
    });
  });

  const unitStats: UnitStatistics[] = Array.from(unitMap.entries())
    .map(([unitName, totalCalls]) => ({
      unitName,
      totalCalls,
      percentageOfTotal: (totalCalls / totalCalls) * 100
    }))
    .sort((a, b) => b.totalCalls - a.totalCalls);

  // Fix percentage calculation
  unitStats.forEach(stat => {
    stat.percentageOfTotal = (stat.totalCalls / totalCalls) * 100;
  });

  return unitStats;
}

/**
 * Get alerts for export
 */
export function getAlertsForExport(timeRange?: TimeRange): any[] {
  let query = `
    SELECT 
      id,
      timestamp,
      call_type,
      address,
      units,
      narrative,
      source
    FROM alerts
  `;

  const params: any[] = [];

  if (timeRange) {
    query += ` WHERE timestamp >= ? AND timestamp <= ?`;
    params.push(timeRange.startDate, timeRange.endDate);
  }

  query += ` ORDER BY timestamp DESC`;

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * Get geographic distribution of alerts
 */
export function getGeographicDistribution(timeRange?: TimeRange): Record<string, number> {
  let query = `
    SELECT address, COUNT(*) as count
    FROM alerts
  `;

  const params: any[] = [];

  if (timeRange) {
    query += ` WHERE timestamp >= ? AND timestamp <= ?`;
    params.push(timeRange.startDate, timeRange.endDate);
  }

  query += ` GROUP BY address ORDER BY count DESC LIMIT 50`;

  const stmt = db.prepare(query);
  const results = stmt.all(...params) as Array<{ address: string; count: number }>;

  const distribution: Record<string, number> = {};
  results.forEach(row => {
    distribution[row.address] = row.count;
  });

  return distribution;
}
