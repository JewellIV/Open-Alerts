import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'alerts.db');
const db = new Database(dbPath);

// Create alerts table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    call_type TEXT NOT NULL,
    address TEXT NOT NULL,
    units TEXT NOT NULL,
    narrative TEXT
  )
`);

// Create notices table for time-based notices
db.exec(`
  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    start_time TEXT,
    end_time TEXT,
    days_of_week TEXT,
    is_meeting_night INTEGER DEFAULT 0,
    meeting_day_of_week INTEGER,
    is_first_of_month INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  )
`);

// Create station_units table for managing station units
db.exec(`
  CREATE TABLE IF NOT EXISTS station_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_name TEXT NOT NULL UNIQUE,
    unit_type TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create room_speakers table for managing room speaker assignments
db.exec(`
  CREATE TABLE IF NOT EXISTS room_speakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL UNIQUE,
    room_name TEXT NOT NULL,
    units TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add is_first_of_month column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE notices ADD COLUMN is_first_of_month INTEGER DEFAULT 0`);
} catch (error) {
  // Column already exists, ignore error
}

console.log('📊 Database tables initialized: alerts, notices, station_units, room_speakers');

export default db;
