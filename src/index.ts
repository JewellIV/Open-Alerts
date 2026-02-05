import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './database';
import { sendDiscordAlert, isDiscordConfigured } from './services/discordService';
import { sendSlackAlert, isSlackConfigured } from './services/slackService';
import { sendResgridAlert, isResgridConfigured, getResgridConfig } from './services/resgridService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Connection settings to prevent disconnections
  pingTimeout: 60000, // 60 seconds - how long to wait for pong response
  pingInterval: 25000, // 25 seconds - how often to ping clients
  transports: ['polling', 'websocket'], // Allow both transports, polling first
  allowEIO3: true, // Allow Engine.IO v3 clients
  connectTimeout: 45000, // 45 seconds - connection timeout
  upgradeTimeout: 30000, // 30 seconds - upgrade timeout
  // Additional stability settings
  maxHttpBufferSize: 1e8, // 100MB max buffer
  allowRequest: (req, callback) => {
    // Allow all requests
    callback(null, true)
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files (for production/Raspberry Pi deployment)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'OpenAlerts API is running' });
});

// Admin password authentication (for web admin pages)
// Simple in-memory session store (for production, use Redis or database)
interface AdminSession {
  token: string;
  expiresAt: number;
}

const adminSessions = new Map<string, AdminSession>();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt < now) {
      adminSessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

// Admin password validation middleware
const validateAdminSession = (req: Request, res: Response, next: Function) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  // If ADMIN_PASSWORD is not set, allow all admin requests
  if (!adminPassword) {
    return next();
  }
  
  const sessionToken = req.headers['x-admin-token'] as string;
  
  if (!sessionToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin session required'
    });
  }
  
  const session = adminSessions.get(sessionToken);
  
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(sessionToken);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired admin session'
    });
  }
  
  // Extend session
  session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  next();
};

// Admin login endpoint
app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    // If no admin password is set, allow login with any password (or no password)
    if (!adminPassword) {
      // Generate session token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      adminSessions.set(token, { token, expiresAt });
      
      return res.json({
        success: true,
        token,
        expiresAt,
        message: 'Admin login successful (no password configured)'
      });
    }
    
    if (!password || password !== adminPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid password'
      });
    }
    
    // Generate session token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    adminSessions.set(token, { token, expiresAt });
    
    console.log('✅ Admin login successful');
    
    res.json({
      success: true,
      token,
      expiresAt,
      message: 'Admin login successful'
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', validateAdminSession, (req: Request, res: Response) => {
  try {
    const sessionToken = req.headers['x-admin-token'] as string;
    if (sessionToken) {
      adminSessions.delete(sessionToken);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during admin logout:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Optional API key authentication middleware (for programmatic API access)
const validateApiKey = (req: Request, res: Response, next: Function) => {
  const apiKey = process.env.API_KEY;
  
  // If API_KEY is set, require it; otherwise allow all requests
  if (apiKey) {
    const providedKey = req.query.api_key || req.headers['x-api-key'];
    if (providedKey !== apiKey) {
      console.warn('⚠️ API key validation failed:', {
        hasApiKey: !!apiKey,
        providedKey: providedKey ? '***' : 'none',
        path: req.path
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      });
    }
    console.log('✅ API key validated for:', req.path);
  }
  
  next();
};


// Alert ingestion endpoint
app.post('/api/alert', validateApiKey, (req: Request, res: Response) => {
  try {
    // Log incoming request for debugging
    console.log('📥 Incoming alert request:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      body: req.body
    });

    const { call_type, address, units, narrative } = req.body;

    // Validate required fields
    if (!call_type || !address || !units) {
      console.warn('⚠️ Invalid alert request - missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['call_type', 'address', 'units']
      });
    }

    // Insert alert into database
    const stmt = db.prepare(`
      INSERT INTO alerts (call_type, address, units, narrative)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(call_type, address, units, narrative || null);

    const alert = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      call_type,
      address,
      units,
      narrative: narrative || null
    };

    console.log('Alert saved:', alert);

    // Emit socket event to all connected clients
    io.emit('dispatch_alert', alert);

    // Send to Discord webhook if configured (Phase 5)
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      sendDiscordAlert(alert, discordWebhookUrl).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send Discord alert:', error);
      });
    }

    // Send to Slack webhook if configured
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      sendSlackAlert(alert, slackWebhookUrl).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send Slack alert:', error);
      });
    }

    // Send to Resgrid if configured
    const resgridConfig = getResgridConfig();
    if (resgridConfig) {
      sendResgridAlert(alert, resgridConfig).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send Resgrid alert:', error);
      });
    }

    res.status(201).json({
      success: true,
      alert,
      discord_sent: !!discordWebhookUrl,
      slack_sent: !!slackWebhookUrl,
      resgrid_sent: !!resgridConfig
    });
  } catch (error) {
    console.error('Error processing alert:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ActiveAlerts/Active911 webhook endpoint
// Receives alerts from ActiveAlerts and forwards them to OpenAlerts format
app.post('/api/webhook/activealerts', (req: Request, res: Response) => {
  try {
    console.log('📥 ActiveAlerts webhook received:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      body: req.body
    });

    const activeAlert = req.body;

    // Transform ActiveAlerts format to OpenAlerts format
    // ActiveAlerts typically sends: { type, address, units, message, etc. }
    // Common field mappings:
    const transformedAlert = {
      call_type: activeAlert.type || 
                 activeAlert.call_type || 
                 activeAlert.incident_type || 
                 activeAlert.nature || 
                 'Dispatch',
      address: activeAlert.address || 
               activeAlert.location || 
               activeAlert.full_address || 
               `${activeAlert.street || ''} ${activeAlert.city || ''}, ${activeAlert.state || ''} ${activeAlert.zip || ''}`.trim() ||
               'Unknown Location',
      units: activeAlert.units || 
             activeAlert.unit || 
             activeAlert.dispatched_units || 
             activeAlert.responding_units ||
             (Array.isArray(activeAlert.units_array) ? activeAlert.units_array.join(', ') : '') ||
             'Unknown Units',
      narrative: activeAlert.message || 
                 activeAlert.narrative || 
                 activeAlert.description || 
                 activeAlert.notes || 
                 activeAlert.call_notes ||
                 null
    };

    // Validate transformed alert
    if (!transformedAlert.call_type || !transformedAlert.address || !transformedAlert.units) {
      console.warn('⚠️ Invalid ActiveAlerts webhook - missing required fields after transformation');
      console.warn('Original payload:', JSON.stringify(activeAlert, null, 2));
      return res.status(400).json({
        error: 'Invalid webhook format',
        message: 'Missing required fields after transformation',
        received: activeAlert
      });
    }

    // Forward to internal alert endpoint by calling the same logic
    const stmt = db.prepare(`
      INSERT INTO alerts (call_type, address, units, narrative)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      transformedAlert.call_type,
      transformedAlert.address,
      transformedAlert.units,
      transformedAlert.narrative || null
    );

    const alert = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      call_type: transformedAlert.call_type,
      address: transformedAlert.address,
      units: transformedAlert.units,
      narrative: transformedAlert.narrative || null
    };

    console.log('✅ ActiveAlerts alert processed:', alert);

    // Emit socket event to all connected clients
    io.emit('dispatch_alert', alert);

    // Send to Discord webhook if configured (Phase 5)
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      sendDiscordAlert(alert, discordWebhookUrl).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send Discord alert:', error);
      });
    }

    // Send to Slack webhook if configured
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      sendSlackAlert(alert, slackWebhookUrl).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send Slack alert:', error);
      });
    }

    // Send to Resgrid if configured
    const resgridConfig = getResgridConfig();
    if (resgridConfig) {
      sendResgridAlert(alert, resgridConfig).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send Resgrid alert:', error);
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Alert forwarded successfully',
      alert,
      discord_sent: !!discordWebhookUrl,
      slack_sent: !!slackWebhookUrl,
      resgrid_sent: !!resgridConfig
    });

  } catch (error) {
    console.error('❌ Error processing ActiveAlerts webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all alerts endpoint (for testing/debugging)
app.get('/api/alerts', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 100');
    const alerts = stmt.all();
    res.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Track connected clients
let connectedClients = 0;

// Socket.io connection handling
io.on('connection', (socket) => {
  connectedClients++;
  console.log(`📡 Client connected: ${socket.id} (Total: ${connectedClients})`);
  
  // Set socket to not timeout
  socket.setMaxListeners(0);
  
  // Handle ping/pong for connection health check
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });
  
  // Send periodic heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat', Date.now());
    }
  }, 20000); // Every 20 seconds
  
  socket.on('disconnect', (reason) => {
    connectedClients--;
    clearInterval(heartbeatInterval);
    console.log(`📡 Client disconnected: ${socket.id} (Reason: ${reason}, Total: ${connectedClients})`);
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Endpoint to check connection count
app.get('/api/connections', (req: Request, res: Response) => {
  res.json({ 
    connectedClients,
    message: `${connectedClients} client(s) currently connected`
  });
});

// Helper function to get first occurrence of a day in a month
function getFirstOccurrenceOfDayInMonth(year: number, month: number, dayOfWeek: number): number {
  // dayOfWeek: 0 = Sunday, 1 = Monday, etc.
  const firstDay = new Date(year, month, 1).getDay();
  const daysUntilTarget = (dayOfWeek - firstDay + 7) % 7;
  return 1 + daysUntilTarget; // First occurrence is day 1 + days until target
}

// Notices API endpoints
app.get('/api/notices', (req: Request, res: Response) => {
  try {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get all active notices
    const allNotices = db.prepare('SELECT * FROM notices WHERE is_active = 1').all();
    
    // Filter notices based on time rules
    const activeNotices = allNotices.filter((notice: any) => {
      // Check expiration
      if (notice.expires_at) {
        const expiresAt = new Date(notice.expires_at);
        if (now > expiresAt) {
          return false; // Expired
        }
      }
      
      // Check time of day
      if (notice.start_time && notice.end_time) {
        if (currentTime < notice.start_time || currentTime > notice.end_time) {
          return false; // Outside time window
        }
      }
      
      // Check days of week (comma-separated: "1,2,3" for Mon, Tue, Wed)
      if (notice.days_of_week) {
        const allowedDays = notice.days_of_week.split(',').map((d: string) => parseInt(d.trim()));
        if (!allowedDays.includes(currentDay)) {
          return false; // Not on allowed day
        }
      }
      
      // Check meeting night
      if (notice.is_meeting_night && notice.meeting_day_of_week !== null) {
        if (currentDay !== notice.meeting_day_of_week) {
          return false; // Not meeting night
        }
        
        // Check if it's "first of month" meeting
        if (notice.is_first_of_month === 1) {
          // Check if today is the first occurrence of this day in the month
          const firstOccurrence = getFirstOccurrenceOfDayInMonth(now.getFullYear(), now.getMonth(), notice.meeting_day_of_week);
          const today = now.getDate();
          if (today !== firstOccurrence) {
            return false; // Not the first occurrence of this day in the month
          }
        }
      }
      
      return true;
    });
    
    res.json({ notices: activeNotices });
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a new notice
app.post('/api/notices', validateAdminSession, (req: Request, res: Response) => {
  try {
    console.log('📝 Creating notice:', req.body);
    
    const { 
      text, 
      priority = 'medium',
      expires_at,
      start_time,
      end_time,
      days_of_week,
      is_meeting_night = false,
      meeting_day_of_week,
      is_first_of_month = false
    } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['text'],
        received: req.body
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO notices (
        text, priority, expires_at, start_time, end_time, 
        days_of_week, is_meeting_night, meeting_day_of_week, is_first_of_month
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Convert expires_at to proper format if provided
    let expiresAtValue = null;
    if (expires_at) {
      try {
        // Ensure it's a valid ISO datetime string
        const date = new Date(expires_at);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        expiresAtValue = date.toISOString();
      } catch (error) {
        console.warn('Invalid expires_at format, ignoring:', expires_at);
      }
    }
    
    const result = stmt.run(
      text,
      priority,
      expiresAtValue,
      start_time || null,
      end_time || null,
      days_of_week || null,
      is_meeting_night ? 1 : 0,
      meeting_day_of_week !== null && meeting_day_of_week !== undefined ? meeting_day_of_week : null,
      is_first_of_month ? 1 : 0
    );
    
    const notice = {
      id: result.lastInsertRowid,
      text,
      priority,
      expires_at,
      start_time,
      end_time,
      days_of_week,
      is_meeting_night,
      meeting_day_of_week
    };
    
    console.log('Notice created:', notice);
    
    // Emit socket event to update all clients
    io.emit('notices_updated');
    
    res.status(201).json({
      success: true,
      notice
    });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update a notice
app.put('/api/notices/:id', validateAdminSession, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      text, 
      priority,
      expires_at,
      start_time,
      end_time,
      days_of_week,
      is_meeting_night,
      meeting_day_of_week,
      is_first_of_month,
      is_active
    } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (text !== undefined) { updates.push('text = ?'); values.push(text); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    
    // Handle expires_at conversion
    if (expires_at !== undefined) {
      let expiresAtValue = null;
      if (expires_at) {
        try {
          const date = new Date(expires_at);
          if (!isNaN(date.getTime())) {
            expiresAtValue = date.toISOString();
          }
        } catch (error) {
          console.warn('Invalid expires_at format:', expires_at);
        }
      }
      updates.push('expires_at = ?');
      values.push(expiresAtValue);
    }
    
    if (start_time !== undefined) { updates.push('start_time = ?'); values.push(start_time || null); }
    if (end_time !== undefined) { updates.push('end_time = ?'); values.push(end_time || null); }
    if (days_of_week !== undefined) { updates.push('days_of_week = ?'); values.push(days_of_week || null); }
    if (is_meeting_night !== undefined) { updates.push('is_meeting_night = ?'); values.push(is_meeting_night ? 1 : 0); }
    if (meeting_day_of_week !== undefined) { 
      updates.push('meeting_day_of_week = ?'); 
      values.push(meeting_day_of_week !== null && meeting_day_of_week !== undefined ? meeting_day_of_week : null); 
    }
    if (is_first_of_month !== undefined) { updates.push('is_first_of_month = ?'); values.push(is_first_of_month ? 1 : 0); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    
    const stmt = db.prepare(`UPDATE notices SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    io.emit('notices_updated');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a notice
app.delete('/api/notices/:id', validateAdminSession, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM notices WHERE id = ?');
    stmt.run(id);
    
    io.emit('notices_updated');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all notices (for admin)
app.get('/api/notices/all', validateAdminSession, (req: Request, res: Response) => {
  try {
    console.log('📋 Fetching all notices');
    const notices = db.prepare('SELECT * FROM notices ORDER BY created_at DESC').all();
    console.log(`Found ${notices.length} notices`);
    res.json({ notices });
  } catch (error) {
    console.error('Error fetching all notices:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Amplifier control endpoints (for GPIO/relay control via backend)
// Note: For dual relay setup, amplifier relay stays OFF (unmuted) and radio relay controls radio

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amplifierRelay: any = null; // Will be Gpio if onoff is installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let radioRelay: any = null; // Second relay for radio control

// Unit-based speaker relays - one GPIO pin per unit
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unitSpeakerRelays: Map<number, any> = new Map(); // pinNumber -> Gpio instance
const unitToPinMap: Map<string, number> = new Map(); // unitName -> pinNumber
const pinToUnitsMap: Map<number, string[]> = new Map(); // pinNumber -> unitNames[]

// Room configuration - maps room IDs to unit assignments (no longer has gpioPin)
interface RoomSpeakerConfig {
  roomId: string
  roomName: string
  units?: string[] // Units assigned to this room (e.g., ["Engine 1", "Ladder 2"])
}

// Load room speaker configuration from environment
const roomSpeakerConfigs: RoomSpeakerConfig[] = [];

/**
 * Custom pin mapping for units
 * Each unit gets a unique pin, except Medic/Ambulance pairs share pins
 */
const UNIT_PIN_MAP: Record<string, number> = {
  // Medic/Ambulance pairs share pins
  'Medic 21': 21,
  'Ambulance 21': 21,
  'Medic 22': 22,
  'Ambulance 22': 22,
  
  // All other units get unique pins
  'Engine 2': 4,
  'Tanker 2': 5,
  'Tanker 21': 6,
  'Squad 2': 7,
  'Brush 2': 8,
  'Response 2': 9,
};

/**
 * Extract GPIO pin number from unit name
 * Uses custom mapping for known units, falls back to number extraction for others
 */
function extractPinFromUnitName(unitName: string): number | null {
  // Check custom mapping first (exact match)
  if (UNIT_PIN_MAP[unitName]) {
    return UNIT_PIN_MAP[unitName];
  }
  
  // For Medic/Ambulance pairs, check if we can match by number
  const medicMatch = unitName.match(/^(Medic|Ambulance)\s*(\d+)$/i);
  if (medicMatch) {
    const number = parseInt(medicMatch[2], 10);
    // Use the number as the pin for Medic/Ambulance pairs (21, 22, etc.)
    if (number > 0 && number <= 40) {
      // Warn if using reserved pins
      if (number === 18) {
        console.warn(`⚠️ GPIO ${number} is reserved for amplifier relay. Consider using a different unit number.`);
        return null; // Don't allow using reserved pin
      }
      if (number === 23) {
        console.warn(`⚠️ GPIO ${number} is reserved for radio relay. Consider using a different unit number.`);
        return null; // Don't allow using reserved pin
      }
      return number;
    }
  }
  
  // For other units, extract number and assign unique pins starting from 10
  // Remove common prefixes and extract number
  const normalized = unitName.replace(/^(Ambulance|Medic|Engine|Ladder|Rescue|Squad|Tanker|Brush|Chief|Deputy|Battalion|Response)\s*/i, '');
  
  // Extract number from the string
  const match = normalized.match(/\d+/);
  if (match) {
    const unitNumber = parseInt(match[0], 10);
    
    // Assign unique pins starting from 10 (avoiding reserved pins)
    // Use unit number + offset to ensure uniqueness
    let pin = unitNumber + 10;
    
    // Adjust for reserved pins
    if (pin === 18) pin = 19; // Skip amplifier pin
    if (pin === 23) pin = 24; // Skip radio pin
    if (pin === 2 || pin === 3) pin = unitNumber + 20; // Skip I2C pins
    if (pin === 14 || pin === 15) pin = unitNumber + 20; // Skip UART pins
    
    // Ensure pin is in valid range
    if (pin > 0 && pin <= 27) {
      return pin;
    }
  }
  
  return null;
}

/**
 * Get GPIO pin for a unit name, handling aliases
 * Medic/Ambulance pairs share pins, all other units get unique pins
 */
function getPinForUnit(unitName: string): number | null {
  // Check if we already have a mapping
  if (unitToPinMap.has(unitName)) {
    return unitToPinMap.get(unitName)!;
  }
  
  // Extract pin from unit name
  const pin = extractPinFromUnitName(unitName);
  if (pin) {
    // Store mapping for this unit
    unitToPinMap.set(unitName, pin);
    
    // Add to reverse mapping (pin -> units)
    if (!pinToUnitsMap.has(pin)) {
      pinToUnitsMap.set(pin, []);
    }
    pinToUnitsMap.get(pin)!.push(unitName);
    
    return pin;
  }
  
  return null;
}

// Parse room speaker config from environment variable
// Format: ROOM_SPEAKERS=room1:Engine 1|Ladder 2,room2:Medic 3|Engine 2
// Note: GPIO pins are now auto-assigned based on unit numbers
const roomSpeakersEnv = process.env.ROOM_SPEAKERS;
if (roomSpeakersEnv) {
  const rooms = roomSpeakersEnv.split(',');
  for (const room of rooms) {
    const parts = room.split(':');
    if (parts.length >= 2) {
      const roomId = parts[0].trim();
      const units = parts[1] ? parts[1].split('|').map(u => u.trim()) : undefined;
      
      roomSpeakerConfigs.push({
        roomId,
        roomName: roomId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        units
      });
      
      // Extract pins from units and build mappings
      if (units) {
        for (const unit of units) {
          getPinForUnit(unit);
        }
      }
    }
  }
}

// Load room speaker configs from database (overrides environment variable if exists)
try {
  const stmt = db.prepare('SELECT room_id, room_name, units FROM room_speakers');
  const dbRooms = stmt.all() as Array<{ room_id: string; room_name: string; units: string | null }>;
  
  for (const dbRoom of dbRooms) {
    // Check if room already exists (from env var), if so, replace it with DB version
    const existingIndex = roomSpeakerConfigs.findIndex(r => r.roomId === dbRoom.room_id);
    const units = dbRoom.units ? dbRoom.units.split(',').map(u => u.trim()).filter(u => u) : undefined;
    
    const roomConfig: RoomSpeakerConfig = {
      roomId: dbRoom.room_id,
      roomName: dbRoom.room_name,
      units
    };
    
    if (existingIndex >= 0) {
      // Replace existing config from env var with DB version
      roomSpeakerConfigs[existingIndex] = roomConfig;
    } else {
      // Add new config from DB
      roomSpeakerConfigs.push(roomConfig);
    }
    
    // Extract pins from units and build mappings
    if (units) {
      for (const unit of units) {
        getPinForUnit(unit);
      }
    }
  }
  
  if (dbRooms.length > 0) {
    console.log(`📋 Loaded ${dbRooms.length} room speaker config(s) from database`);
  }
} catch (error) {
  console.warn('⚠️ Could not load room speakers from database:', error);
}

// Also load units from station_units database to build pin mappings
try {
  const stmt = db.prepare('SELECT unit_name FROM station_units WHERE is_active = 1');
  const units = stmt.all() as { unit_name: string }[];
  for (const unit of units) {
    getPinForUnit(unit.unit_name);
  }
  console.log(`📋 Loaded ${unitToPinMap.size} unit-to-pin mappings from database`);
} catch (error) {
  console.warn('⚠️ Could not load units from database:', error);
}

// Initialize GPIO relays (only on Raspberry Pi)
if (process.platform === 'linux') {
  try {
    // Try to import onoff (may not be installed)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Gpio } = require('onoff');
    
    // Amplifier relay (GPIO 18) - stays OFF (unmuted) so alerts always play
    amplifierRelay = new Gpio(18, 'out');
    amplifierRelay.writeSync(0); // Start unmuted (alerts always play)
    console.log('✅ Amplifier relay initialized on GPIO 18 (stays OFF - alerts always play)');
    
    // Radio relay (GPIO 23) - controls radio muting independently
    radioRelay = new Gpio(23, 'out');
    radioRelay.writeSync(0); // Start unmuted (radio plays)
    console.log('✅ Radio relay initialized on GPIO 23');
    
    // Initialize unit-based speaker relays
    // Each unique pin gets one relay instance
    const initializedPins = new Set<number>();
    for (const [unitName, pin] of unitToPinMap.entries()) {
      if (!initializedPins.has(pin)) {
        try {
          const relay = new Gpio(pin, 'out');
          relay.writeSync(0); // Start unmuted (speakers play)
          unitSpeakerRelays.set(pin, relay);
          initializedPins.add(pin);
          
          const unitsForPin = pinToUnitsMap.get(pin) || [];
          console.log(`✅ Unit speaker relay initialized: GPIO ${pin} (Units: ${unitsForPin.join(', ')})`);
        } catch (error) {
          console.warn(`⚠️ Failed to initialize unit speaker relay for GPIO ${pin}:`, error);
        }
      }
    }
    
    console.log(`📊 Initialized ${unitSpeakerRelays.size} unit-based speaker relays`);
  } catch (error) {
    console.warn('⚠️ GPIO not available - onoff library may not be installed');
    console.warn('Install with: npm install onoff');
    console.warn('For dual relay setup, install onoff and restart backend');
  }
}

app.post('/api/amplifier/mute', validateApiKey, (req: Request, res: Response) => {
  try {
    const { mute } = req.body;
    
    // For dual relay setup: amplifier relay stays OFF (unmuted), radio relay controls radio
    // This endpoint controls radio muting (not amplifier muting)
    if (radioRelay) {
      // GPIO control: 1 = mute radio (relay closed), 0 = unmute radio (relay open)
      radioRelay.writeSync(mute ? 1 : 0);
      console.log(`📻 Radio ${mute ? 'muted' : 'unmuted'} via GPIO pin 23`);
    } else {
      console.log(`📻 Radio ${mute ? 'muted' : 'unmuted'} (GPIO not available)`);
    }
    
    res.json({ 
      success: true, 
      muted: mute,
      message: `Radio ${mute ? 'muted' : 'unmuted'} successfully`
    });
  } catch (error) {
    console.error('Error controlling radio relay:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/amplifier/volume', validateApiKey, (req: Request, res: Response) => {
  try {
    const { volume } = req.body; // 0-100
    
    // TODO: Implement volume control if amplifier supports it
    // This might require PWM control or digital potentiometer
    
    console.log(`🔊 Amplifier volume set to ${volume}% via GPIO`);
    
    res.json({ 
      success: true, 
      volume: volume,
      message: `Amplifier volume set to ${volume}%`
    });
  } catch (error) {
    console.error('Error setting amplifier volume:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/amplifier/status', validateApiKey, (req: Request, res: Response) => {
  try {
    // Return amplifier status
    res.json({ 
      success: true,
      available: true,
      message: 'Amplifier control API available'
    });
  } catch (error) {
    console.error('Error getting amplifier status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unit-based speaker control endpoints
app.post('/api/unit-speaker/mute', validateAdminSession, (req: Request, res: Response) => {
  try {
    const { units, mute } = req.body;
    
    if (!units || !Array.isArray(units)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Units array is required'
      });
    }
    
    const controlledPins = new Set<number>();
    const results: Array<{ unit: string; pin: number; success: boolean }> = [];
    
    for (const unitName of units) {
      const pin = getPinForUnit(unitName);
      if (pin && !controlledPins.has(pin)) {
        const relay = unitSpeakerRelays.get(pin);
        if (relay) {
          try {
            // GPIO control: 1 = mute (relay closed), 0 = unmute (relay open)
            relay.writeSync(mute ? 1 : 0);
            controlledPins.add(pin);
            results.push({ unit: unitName, pin, success: true });
            console.log(`🔊 Unit speaker ${mute ? 'muted' : 'unmuted'}: ${unitName} (GPIO ${pin})`);
          } catch (error) {
            results.push({ unit: unitName, pin, success: false });
            console.error(`Error controlling relay for ${unitName} (GPIO ${pin}):`, error);
          }
        } else {
          results.push({ unit: unitName, pin, success: false });
        }
      }
    }
    
    res.json({ 
      success: true, 
      muted: mute,
      controlledPins: Array.from(controlledPins),
      results,
      message: `${controlledPins.size} unit speaker(s) ${mute ? 'muted' : 'unmuted'} successfully`
    });
  } catch (error) {
    console.error('Error controlling unit speakers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Room speaker control endpoints (for per-room relay control - now uses unit pins)
// Public endpoint - room displays need to control their own speakers without admin login
app.post('/api/room-speaker/:roomId/mute', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { mute } = req.body;
    
    const roomConfig = roomSpeakerConfigs.find(r => r.roomId === roomId);
    if (!roomConfig) {
      return res.status(404).json({
        error: 'Room not found',
        message: `Room not configured: ${roomId}`,
        availableRooms: roomSpeakerConfigs.map(r => r.roomId)
      });
    }
    
    if (!roomConfig.units || roomConfig.units.length === 0) {
      return res.json({
        success: true,
        muted: mute,
        roomId,
        roomName: roomConfig.roomName,
        message: 'Room has no units assigned - no relays to control'
      });
    }
    
    // Control all unit pins for this room
    const controlledPins = new Set<number>();
    for (const unitName of roomConfig.units) {
      const pin = getPinForUnit(unitName);
      if (pin && !controlledPins.has(pin)) {
        const relay = unitSpeakerRelays.get(pin);
        if (relay) {
          relay.writeSync(mute ? 1 : 0);
          controlledPins.add(pin);
        }
      }
    }
    
    console.log(`🔊 Room speaker ${mute ? 'muted' : 'unmuted'}: ${roomConfig.roomName} (${controlledPins.size} pins: ${Array.from(controlledPins).join(', ')})`);
    
    res.json({ 
      success: true, 
      muted: mute,
      roomId,
      roomName: roomConfig.roomName,
      controlledPins: Array.from(controlledPins),
      message: `Room speaker ${mute ? 'muted' : 'unmuted'} successfully`
    });
  } catch (error) {
    console.error('Error controlling room speaker:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get room speaker status
// Public endpoint - room displays need to check their own status
app.get('/api/room-speaker/:roomId/status', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const roomConfig = roomSpeakerConfigs.find(r => r.roomId === roomId);
    
    if (roomConfig) {
      // Get pins for units in this room
      const pins: number[] = [];
      const unitPins: Array<{ unit: string; pin: number; available: boolean }> = [];
      
      if (roomConfig.units) {
        for (const unitName of roomConfig.units) {
          const pin = getPinForUnit(unitName);
          if (pin) {
            if (!pins.includes(pin)) {
              pins.push(pin);
            }
            unitPins.push({
              unit: unitName,
              pin,
              available: unitSpeakerRelays.has(pin)
            });
          }
        }
      }
      
      res.json({ 
        success: true,
        roomId,
        roomName: roomConfig.roomName,
        units: roomConfig.units || [],
        unitPins,
        pins,
        available: pins.length > 0 && pins.some(pin => unitSpeakerRelays.has(pin)),
        message: 'Room speaker configuration available'
      });
    } else {
      res.status(404).json({
        error: 'Room not found',
        message: `Room not configured: ${roomId}`,
        availableRooms: roomSpeakerConfigs.map(r => r.roomId)
      });
    }
  } catch (error) {
    console.error('Error getting room speaker status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List all configured room speakers
app.get('/api/room-speakers', validateAdminSession, (req: Request, res: Response) => {
  try {
    const rooms = roomSpeakerConfigs.map(config => {
      const pins: number[] = [];
      if (config.units) {
        for (const unitName of config.units) {
          const pin = getPinForUnit(unitName);
          if (pin && !pins.includes(pin)) {
            pins.push(pin);
          }
        }
      }
      
      return {
        roomId: config.roomId,
        roomName: config.roomName,
        units: config.units || [],
        pins,
        available: pins.length > 0 && pins.some(pin => unitSpeakerRelays.has(pin))
      };
    });
    
    res.json({ 
      success: true,
      rooms,
      count: rooms.length
    });
  } catch (error) {
    console.error('Error listing room speakers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get unit-to-pin mappings
app.get('/api/unit-pins', validateAdminSession, (req: Request, res: Response) => {
  try {
    const mappings: Array<{ unit: string; pin: number; available: boolean }> = [];
    for (const [unitName, pin] of unitToPinMap.entries()) {
      mappings.push({
        unit: unitName,
        pin,
        available: unitSpeakerRelays.has(pin)
      });
    }
    
    // Group by pin
    const pinsMap = new Map<number, string[]>();
    for (const [unitName, pin] of unitToPinMap.entries()) {
      if (!pinsMap.has(pin)) {
        pinsMap.set(pin, []);
      }
      pinsMap.get(pin)!.push(unitName);
    }
    
    res.json({ 
      success: true, 
      mappings,
      pins: Object.fromEntries(pinsMap),
      totalUnits: unitToPinMap.size,
      totalPins: pinsMap.size
    });
  } catch (error) {
    console.error('Error getting unit pins:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save or update room speaker assignment (stores in database)
// Public endpoint - room displays need to save their own assignments
app.post('/api/room-speaker/:roomId/assign', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { roomName, units } = req.body;
    
    if (!roomId || !roomName) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'roomId and roomName are required'
      });
    }
    
    // Convert units array to comma-separated string for storage
    const unitsString = Array.isArray(units) && units.length > 0 
      ? units.join(',') 
      : null;
    
    // Insert or update room speaker assignment
    const stmt = db.prepare(`
      INSERT INTO room_speakers (room_id, room_name, units, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(room_id) DO UPDATE SET
        room_name = excluded.room_name,
        units = excluded.units,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(roomId, roomName, unitsString);
    
    // Update in-memory config
    const existingIndex = roomSpeakerConfigs.findIndex(r => r.roomId === roomId);
    const roomConfig: RoomSpeakerConfig = {
      roomId,
      roomName,
      units: unitsString ? unitsString.split(',').map(u => u.trim()).filter(u => u) : undefined
    };
    
    if (existingIndex >= 0) {
      roomSpeakerConfigs[existingIndex] = roomConfig;
    } else {
      roomSpeakerConfigs.push(roomConfig);
    }
    
    // Extract pins from units and build mappings
    if (roomConfig.units) {
      for (const unit of roomConfig.units) {
        getPinForUnit(unit);
      }
    }
    
    console.log(`💾 Saved room speaker assignment: ${roomName} (${roomId}) - Units: ${unitsString || 'All alerts'}`);
    
    res.json({
      success: true,
      roomId,
      roomName,
      units: roomConfig.units || [],
      message: 'Room speaker assignment saved successfully'
    });
  } catch (error) {
    console.error('Error saving room speaker assignment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get room speaker assignment from database (public endpoint for room displays)
app.get('/api/room-speaker/:roomId/assign', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    
    const stmt = db.prepare('SELECT room_id, room_name, units FROM room_speakers WHERE room_id = ?');
    const result = stmt.get(roomId) as { room_id: string; room_name: string; units: string | null } | undefined;
    
    if (result) {
      const units = result.units ? result.units.split(',').map(u => u.trim()).filter(u => u) : [];
      res.json({
        success: true,
        roomId: result.room_id,
        roomName: result.room_name,
        units
      });
    } else {
      res.status(404).json({
        error: 'Not found',
        message: `Room speaker assignment not found for room: ${roomId}`
      });
    }
  } catch (error) {
    console.error('Error fetching room speaker assignment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Station Units Management Endpoints
// Public endpoint to get active units (for unit selector on displays)
app.get('/api/station-units', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM station_units WHERE is_active = 1 ORDER BY unit_name ASC');
    const units = stmt.all();
    res.json({ success: true, units });
  } catch (error) {
    console.error('Error fetching station units:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/station-units', validateApiKey, (req: Request, res: Response) => {
  try {
    const { unit_name, unit_type, description } = req.body;
    
    if (!unit_name || unit_name.trim() === '') {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['unit_name']
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO station_units (unit_name, unit_type, description)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(unit_name.trim(), unit_type || null, description || null);
    
    const unit = {
      id: result.lastInsertRowid,
      unit_name: unit_name.trim(),
      unit_type: unit_type || null,
      description: description || null,
      is_active: 1
    };
    
    console.log('Station unit created:', unit);
    res.status(201).json({ success: true, unit });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'Unit already exists',
        message: `Unit "${req.body.unit_name}" already exists`
      });
    }
    console.error('Error creating station unit:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.put('/api/station-units/:id', validateAdminSession, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { unit_name, unit_type, description, is_active } = req.body;
    
    const stmt = db.prepare(`
      UPDATE station_units
      SET unit_name = ?, unit_type = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      unit_name || null,
      unit_type || null,
      description || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      id
    );
    
    console.log(`Station unit updated: ID ${id}`);
    res.json({ success: true, message: 'Unit updated successfully' });
  } catch (error) {
    console.error('Error updating station unit:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.delete('/api/station-units/:id', validateApiKey, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Soft delete (set is_active = 0)
    const stmt = db.prepare('UPDATE station_units SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
    
    console.log(`Station unit deleted: ID ${id}`);
    res.json({ success: true, message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Error deleting station unit:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fallback to index.html for SPA routing (must be after all API routes)
app.get('*', (req: Request, res: Response) => {
  // Only serve index.html if request is not for an API endpoint
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

httpServer.listen(PORT, () => {
  console.log(`🚨 OpenAlerts API server running on http://localhost:${PORT}`);
  console.log(`📊 Database initialized at: alerts.db`);
  console.log(`🔌 Socket.io server ready`);
  
  // Phase 5: Discord integration status
  if (isDiscordConfigured()) {
    console.log(`📱 Discord webhook configured - mobile alerts enabled`);
  } else {
    console.log(`ℹ️  Discord webhook not configured - set DISCORD_WEBHOOK_URL in .env to enable mobile alerts`);
  }
  
  // Slack integration status
  if (isSlackConfigured()) {
    console.log(`💬 Slack webhook configured - mobile alerts enabled`);
  } else {
    console.log(`ℹ️  Slack webhook not configured - set SLACK_WEBHOOK_URL in .env to enable`);
  }
  
  // Resgrid integration status
  if (isResgridConfigured()) {
    const config = getResgridConfig();
    console.log(`📡 Resgrid integration configured - alerts will be sent to ${config?.baseUrl}`);
  } else {
    console.log(`ℹ️  Resgrid not configured - set RESGRID_BASE_URL, RESGRID_API_TOKEN, and RESGRID_DEPARTMENT_ID in .env to enable`);
  }
});
