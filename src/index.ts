import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { exec } from 'child_process';
import multer from 'multer';
import db from './database';
import { sendDiscordAlert, isDiscordConfigured } from './services/discordService';
import { sendSlackAlert, isSlackConfigured } from './services/slackService';
import { sendResgridAlert, isResgridConfigured, getResgridConfig } from './services/resgridService';
import { getUnitDisplayMapping, getUnitToCadCode, resolveUnitsForDisplay } from './utils/unitResolution';

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

// Recordings directory for TwoToneDetect audio uploads
const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
  console.log('📁 Created recordings directory');
}
app.use('/recordings', express.static(recordingsDir));

// Multer config for recording uploads
const recordingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, recordingsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    const safeName = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});
const uploadRecording = multer({
  storage: recordingStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.amr', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`));
  },
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'OpenAlerts API is running',
    platform: process.platform,
    amplifierGpioUrl: process.env.AMPLIFIER_GPIO_URL || null,
    roomGpioUrlsConfigured: Boolean(process.env.ROOM_GPIO_URLS)
  });
});

// Admin password authentication (for web admin pages)
// Sessions persisted in SQLite so login survives backend restart
interface AdminSession {
  token: string;
  expiresAt: number;
}

const adminSessions = new Map<string, AdminSession>();

// Load persisted sessions from database on startup
try {
  const rows = db.prepare('SELECT token, expires_at FROM admin_sessions WHERE expires_at > ?').all(Date.now()) as { token: string; expires_at: number }[];
  for (const row of rows) {
    adminSessions.set(row.token, { token: row.token, expiresAt: row.expires_at });
  }
  if (rows.length > 0) console.log(`📋 Restored ${rows.length} admin session(s) from database`);
} catch (e) {
  console.warn('Could not load admin sessions from database:', e);
}

function saveAdminSession(token: string, expiresAt: number): void {
  adminSessions.set(token, { token, expiresAt });
  try {
    db.prepare('INSERT OR REPLACE INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
  } catch (e) {
    console.warn('Could not persist admin session:', e);
  }
}

function deleteAdminSession(token: string): void {
  adminSessions.delete(token);
  try {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  } catch (e) {
    console.warn('Could not delete admin session from database:', e);
  }
}

// Clean up expired sessions every 5 minutes (memory and database)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt < now) {
      deleteAdminSession(token);
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
    deleteAdminSession(sessionToken);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired admin session'
    });
  }
  
  // Extend session (24 hours from now)
  const newExpiresAt = Date.now() + (24 * 60 * 60 * 1000);
  session.expiresAt = newExpiresAt;
  try {
    db.prepare('UPDATE admin_sessions SET expires_at = ? WHERE token = ?').run(newExpiresAt, sessionToken);
  } catch (e) {
    console.warn('Could not update admin session expiry:', e);
  }
  
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
      
      saveAdminSession(token, expiresAt);
      
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
    
    saveAdminSession(token, expiresAt);
    
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
      deleteAdminSession(sessionToken);
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

// Admin send alert - manually trigger an alert to the system
app.post('/api/admin/send-alert', validateAdminSession, (req: Request, res: Response) => {
  try {
    const { call_type, address, units, narrative } = req.body;

    if (!call_type || !address || !units) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['call_type', 'address', 'units']
      });
    }

    const stmt = db.prepare(`
      INSERT INTO alerts (call_type, address, units, narrative, source)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(call_type, address, units, narrative || null, 'admin');

    const alert = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      call_type,
      address,
      units,
      display_units: resolveUnitsForDisplay(units),
      narrative: narrative || null,
      recording_url: null
    };

    console.log('📢 Admin alert sent:', alert);

    io.emit('dispatch_alert', alert);

    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(call_type);
      if (alertCategory === 'fire') {
        if (ledRingController) flashLEDRing(255, 0, 0, 120000);
        else controlLEDRingPython('fire');
      } else {
        if (ledRingController) flashLEDRing(0, 0, 255, 120000);
        else controlLEDRingPython('ems');
      }
    }

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) sendDiscordAlert(alert, discordWebhookUrl).catch(console.error);
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) sendSlackAlert(alert, slackWebhookUrl).catch(console.error);
    const resgridConfig = getResgridConfig();
    if (resgridConfig) sendResgridAlert(alert, resgridConfig).catch(console.error);

    res.status(201).json({
      success: true,
      alert,
      message: 'Alert sent to all displays'
    });
  } catch (error) {
    console.error('Error sending admin alert:', error);
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

// Accept either admin session (X-Admin-Token) or API key (x-api-key) - for admin UI and scripts
const validateAdminOrApiKey = (req: Request, res: Response, next: Function) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionToken = req.headers['x-admin-token'] as string;
  const session = sessionToken ? adminSessions.get(sessionToken) : null;
  const hasValidAdmin = adminPassword && session && session.expiresAt >= Date.now();
  if (hasValidAdmin) {
    const newExpiresAt = Date.now() + (24 * 60 * 60 * 1000);
    session!.expiresAt = newExpiresAt;
    try {
      db.prepare('UPDATE admin_sessions SET expires_at = ? WHERE token = ?').run(newExpiresAt, sessionToken);
    } catch (e) { /* ignore */ }
    return next();
  }
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    const providedKey = req.query.api_key || req.headers['x-api-key'];
    if (providedKey === apiKey) return next();
  } else {
    return next(); // no API_KEY set, allow
  }
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Admin login required or valid API key'
  });
};


// Helper function to determine alert category (fire vs EMS)
function getCallTypeCategory(callType: string): 'fire' | 'ems' {
  const lowerCallType = callType.toLowerCase();
  
  // Check for fire-related keywords
  if (lowerCallType.includes('fire') || 
      lowerCallType.includes('structure') ||
      lowerCallType.includes('brush') ||
      lowerCallType.includes('vehicle fire') ||
      lowerCallType.includes('wildfire') ||
      lowerCallType.includes('smoke')) {
    return 'fire';
  }
  
  // Default to EMS for medical calls
  return 'ems';
}

// LED Ring Controller for WS2812B RGB LEDs
let ledRingController: any = null;
const LED_RING_PIN = parseInt(process.env.LED_RING_PIN || '18', 10);
const LED_RING_COUNT = parseInt(process.env.LED_RING_COUNT || '24', 10);
const LED_RING_ENABLED = process.env.LED_RING_ENABLED === 'true';

// Initialize LED ring (only on Raspberry Pi)
if (process.platform === 'linux' && LED_RING_ENABLED) {
  try {
    // Try to import rpi-ws281x (Node.js wrapper)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws281x = require('rpi-ws281x-native');
    
    ws281x.init(LED_RING_COUNT, {
      gpio: LED_RING_PIN,
      brightness: parseInt(process.env.LED_RING_BRIGHTNESS || '128', 10), // 0-255
      stripType: ws281x.stripType.WS2812B
    });
    
    ledRingController = ws281x;
    console.log(`✅ LED ring initialized: ${LED_RING_COUNT} LEDs on GPIO ${LED_RING_PIN}`);
  } catch (error) {
    console.warn('⚠️ LED ring Node.js library not available - will use Python script fallback');
    console.warn('Install with: npm install rpi-ws281x');
    console.warn('Or use Python script method (see LED_RING_INTEGRATION.md)');
  }
}

// Helper function to set all LEDs to a color (Node.js method)
function setLEDRingColor(r: number, g: number, b: number): void {
  if (!ledRingController) return;
  
  try {
    const colors = new Uint32Array(LED_RING_COUNT);
    const color = (r << 16) | (g << 8) | b;
    
    for (let i = 0; i < LED_RING_COUNT; i++) {
      colors[i] = color;
    }
    
    ledRingController.render(colors);
  } catch (error) {
    console.error('Error setting LED ring color:', error);
  }
}

// Helper function for flashing animation (Node.js method)
function flashLEDRing(r: number, g: number, b: number, duration: number): void {
  if (!ledRingController) return;
  
  const interval = 500; // Flash every 500ms
  const iterations = Math.floor(duration / interval);
  let count = 0;
  
  const flashInterval = setInterval(() => {
    if (count % 2 === 0) {
      setLEDRingColor(r, g, b); // On
    } else {
      setLEDRingColor(0, 0, 0); // Off
    }
    count++;
    
    if (count >= iterations * 2) {
      clearInterval(flashInterval);
      setLEDRingColor(0, 0, 0); // Turn off
    }
  }, interval / 2);
}

// Python script fallback method (more reliable)
function controlLEDRingPython(action: string, r?: number, g?: number, b?: number, duration?: number): void {
  if (!LED_RING_ENABLED) return;
  
  const scriptPath = path.join(__dirname, 'led_ring_controller.py');
  let command = `python3 ${scriptPath} ${action}`;
  
  if (r !== undefined && g !== undefined && b !== undefined) {
    command += ` ${r} ${g} ${b}`;
    if (duration !== undefined) {
      command += ` ${duration}`;
    }
  }
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.warn('LED ring control error (Python):', error.message);
      // Don't log stderr if script doesn't exist (expected on non-Pi systems)
      if (!error.message.includes('ENOENT')) {
        console.warn('LED ring stderr:', stderr);
      }
    } else if (stdout) {
      console.log('LED ring:', stdout.trim());
    }
  });
}

// Alert ingestion endpoint
app.post('/api/alert', validateApiKey, (req: Request, res: Response) => {
  try {
    // Log incoming request for debugging
    console.log('📥 Incoming alert request:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      body: req.body
    });

    const { call_type, address, units, narrative, latitude, longitude } = req.body;

    // Validate required fields
    if (!call_type || !address || !units) {
      console.warn('⚠️ Invalid alert request - missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['call_type', 'address', 'units']
      });
    }

    const lat = latitude != null && latitude !== '' ? parseFloat(String(latitude)) : null;
    const lon = longitude != null && longitude !== '' ? parseFloat(String(longitude)) : null;
    const validLat = lat != null && !isNaN(lat) && lat >= -90 && lat <= 90 ? lat : null;
    const validLon = lon != null && !isNaN(lon) && lon >= -180 && lon <= 180 ? lon : null;

    // Insert alert into database (with source tracking and optional lat/lon)
    const source = req.body.source || 'api';
    const stmt = db.prepare(`
      INSERT INTO alerts (call_type, address, units, narrative, source, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(call_type, address, units, narrative || null, source, validLat, validLon);

    const alert = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      call_type,
      address,
      units,
      display_units: resolveUnitsForDisplay(units),
      narrative: narrative || null,
      recording_url: null,
      latitude: validLat,
      longitude: validLon
    };

    console.log('Alert saved:', alert);

    // Emit socket event to all connected clients
    io.emit('dispatch_alert', alert);

    // Control LED ring based on alert type
    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(call_type);
      if (alertCategory === 'fire') {
        // Flash red for fire alerts
        if (ledRingController) {
          flashLEDRing(255, 0, 0, 120000); // Red, 2 minutes
        } else {
          controlLEDRingPython('fire');
        }
      } else {
        // Flash blue for EMS alerts
        if (ledRingController) {
          flashLEDRing(0, 0, 255, 120000); // Blue, 2 minutes
        } else {
          controlLEDRingPython('ems');
        }
      }
    }

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

// Alert with recording (TwoToneDetect post_email_command - record first, then send)
app.post('/api/alert/with-recording', validateApiKey, uploadRecording.single('recording'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Missing recording file',
        message: 'Must include a recording file (mp3, wav, amr, m4a)'
      });
    }

    const call_type = req.body.call_type || 'Dispatch';
    const address = req.body.address || 'See narrative';
    const units = req.body.units || 'See narrative';
    const narrative = req.body.narrative || 'Two-tone page with recording';
    const source = req.body.source || 'twotonedetect';

    const recordingUrl = `/recordings/${req.file.filename}`;

    const stmt = db.prepare(`
      INSERT INTO alerts (call_type, address, units, narrative, source, recording_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(call_type, address, units, narrative, source, recordingUrl);

    const alert = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      call_type,
      address,
      units,
      display_units: resolveUnitsForDisplay(units),
      narrative: narrative || null,
      recording_url: recordingUrl
    };

    console.log('📥 Alert with recording saved:', { ...alert, recording: req.file.filename });

    io.emit('dispatch_alert', alert);

    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(call_type);
      if (alertCategory === 'fire') {
        if (ledRingController) flashLEDRing(255, 0, 0, 120000);
        else controlLEDRingPython('fire');
      } else {
        if (ledRingController) flashLEDRing(0, 0, 255, 120000);
        else controlLEDRingPython('ems');
      }
    }

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) sendDiscordAlert(alert, discordWebhookUrl).catch(console.error);
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) sendSlackAlert(alert, slackWebhookUrl).catch(console.error);
    const resgridConfig = getResgridConfig();
    if (resgridConfig) sendResgridAlert(alert, resgridConfig).catch(console.error);

    res.status(201).json({
      success: true,
      alert,
      recording_url: recordingUrl
    });
  } catch (error) {
    console.error('Error processing alert with recording:', error);
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
      display_units: resolveUnitsForDisplay(transformedAlert.units),
      narrative: transformedAlert.narrative || null
    };

    console.log('✅ ActiveAlerts alert processed:', alert);

    // Emit socket event to all connected clients
    io.emit('dispatch_alert', alert);

    // Control LED ring based on alert type
    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(transformedAlert.call_type);
      if (alertCategory === 'fire') {
        if (ledRingController) {
          flashLEDRing(255, 0, 0, 120000);
        } else {
          controlLEDRingPython('fire');
        }
      } else {
        if (ledRingController) {
          flashLEDRing(0, 0, 255, 120000);
        } else {
          controlLEDRingPython('ems');
        }
      }
    }

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

// Import CAD integration services
import {
  FirehouseTransformer,
  IamRespondingTransformer,
  CentralSquareTransformer,
  processCADAlert
} from './services/cadIntegrations';

// Firehouse Software webhook endpoint
app.post('/api/webhook/firehouse', (req: Request, res: Response) => {
  try {
    console.log('📥 Firehouse Software webhook received:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      body: req.body
    });

    const transformer = new FirehouseTransformer();
    if (!transformer.validate(req.body)) {
      return res.status(400).json({
        error: 'Invalid webhook format',
        message: 'Missing required fields for Firehouse Software format'
      });
    }

    const transformedAlert = transformer.transform(req.body);
    if (!transformedAlert) {
      return res.status(400).json({
        error: 'Transformation failed',
        message: 'Could not transform Firehouse Software alert format'
      });
    }

    const alert = processCADAlert(transformedAlert, 'firehouse');

    // Emit socket event
    io.emit('dispatch_alert', alert);

    // Control LED ring based on alert type
    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(alert.call_type);
      if (alertCategory === 'fire') {
        if (ledRingController) {
          flashLEDRing(255, 0, 0, 120000);
        } else {
          controlLEDRingPython('fire');
        }
      } else {
        if (ledRingController) {
          flashLEDRing(0, 0, 255, 120000);
        } else {
          controlLEDRingPython('ems');
        }
      }
    }

    // Send to integrations
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    const resgridConfig = getResgridConfig();

    if (discordWebhookUrl) {
      sendDiscordAlert(alert, discordWebhookUrl).catch(console.error);
    }
    if (slackWebhookUrl) {
      sendSlackAlert(alert, slackWebhookUrl).catch(console.error);
    }
    if (resgridConfig) {
      sendResgridAlert(alert, resgridConfig).catch(console.error);
    }

    res.status(200).json({
      success: true,
      message: 'Firehouse Software alert processed successfully',
      alert
    });
  } catch (error) {
    console.error('❌ Error processing Firehouse Software webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// IamResponding webhook endpoint
app.post('/api/webhook/iamresponding', (req: Request, res: Response) => {
  try {
    console.log('📥 IamResponding webhook received:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      body: req.body
    });

    const transformer = new IamRespondingTransformer();
    if (!transformer.validate(req.body)) {
      return res.status(400).json({
        error: 'Invalid webhook format',
        message: 'Missing required fields for IamResponding format'
      });
    }

    const transformedAlert = transformer.transform(req.body);
    if (!transformedAlert) {
      return res.status(400).json({
        error: 'Transformation failed',
        message: 'Could not transform IamResponding alert format'
      });
    }

    const alert = processCADAlert(transformedAlert, 'iamresponding');

    // Emit socket event
    io.emit('dispatch_alert', alert);

    // Control LED ring based on alert type
    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(alert.call_type);
      if (alertCategory === 'fire') {
        if (ledRingController) {
          flashLEDRing(255, 0, 0, 120000);
        } else {
          controlLEDRingPython('fire');
        }
      } else {
        if (ledRingController) {
          flashLEDRing(0, 0, 255, 120000);
        } else {
          controlLEDRingPython('ems');
        }
      }
    }

    // Send to integrations
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    const resgridConfig = getResgridConfig();

    if (discordWebhookUrl) {
      sendDiscordAlert(alert, discordWebhookUrl).catch(console.error);
    }
    if (slackWebhookUrl) {
      sendSlackAlert(alert, slackWebhookUrl).catch(console.error);
    }
    if (resgridConfig) {
      sendResgridAlert(alert, resgridConfig).catch(console.error);
    }

    res.status(200).json({
      success: true,
      message: 'IamResponding alert processed successfully',
      alert
    });
  } catch (error) {
    console.error('❌ Error processing IamResponding webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// CentralSquare/TriTech webhook endpoint
app.post('/api/webhook/centralsquare', (req: Request, res: Response) => {
  try {
    console.log('📥 CentralSquare/TriTech webhook received:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      body: req.body
    });

    const transformer = new CentralSquareTransformer();
    if (!transformer.validate(req.body)) {
      return res.status(400).json({
        error: 'Invalid webhook format',
        message: 'Missing required fields for CentralSquare/TriTech format'
      });
    }

    const transformedAlert = transformer.transform(req.body);
    if (!transformedAlert) {
      return res.status(400).json({
        error: 'Transformation failed',
        message: 'Could not transform CentralSquare/TriTech alert format'
      });
    }

    const alert = processCADAlert(transformedAlert, 'centralsquare');

    // Emit socket event
    io.emit('dispatch_alert', alert);

    // Control LED ring based on alert type
    if (LED_RING_ENABLED) {
      const alertCategory = getCallTypeCategory(alert.call_type);
      if (alertCategory === 'fire') {
        if (ledRingController) {
          flashLEDRing(255, 0, 0, 120000);
        } else {
          controlLEDRingPython('fire');
        }
      } else {
        if (ledRingController) {
          flashLEDRing(0, 0, 255, 120000);
        } else {
          controlLEDRingPython('ems');
        }
      }
    }

    // Send to integrations
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    const resgridConfig = getResgridConfig();

    if (discordWebhookUrl) {
      sendDiscordAlert(alert, discordWebhookUrl).catch(console.error);
    }
    if (slackWebhookUrl) {
      sendSlackAlert(alert, slackWebhookUrl).catch(console.error);
    }
    if (resgridConfig) {
      sendResgridAlert(alert, resgridConfig).catch(console.error);
    }

    res.status(200).json({
      success: true,
      message: 'CentralSquare/TriTech alert processed successfully',
      alert
    });
  } catch (error) {
    console.error('❌ Error processing CentralSquare/TriTech webhook:', error);
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
    const rows = stmt.all() as any[];
    const alerts = rows.map(a => ({
      ...a,
      display_units: resolveUnitsForDisplay(a.units || '')
    }));
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
  /** When set, backend forwards mute requests to this room Pi's GPIO service (avoids browser PNA block from HTTP page to localhost). */
  gpioServiceUrl?: string
}

// Load room speaker configuration from environment
const roomSpeakerConfigs: RoomSpeakerConfig[] = [];

/**
 * Custom pin mapping for units
 * Each unit gets a unique pin, except Medic/Ambulance pairs share pins.
 * Avoid SPI pins (7, 8, 9, 10, 11) when SPI is enabled on the Pi.
 */
const UNIT_PIN_MAP: Record<string, number> = {
  // Medic/Ambulance pairs share pins
  'Medic 21': 21,
  'Ambulance 21': 21,
  // Medic 22/Ambulance 22: use GPIO 24 (22 can be unreliable on some Pi 5)
  'Medic 22': 24,
  'Ambulance 22': 24,
  
  // All other units get unique pins (avoid 7,8,9,10,11 = SPI)
  'Engine 2': 4,
  'Tanker 2': 5,
  'Tanker 21': 6,
  'Squad 2': 12,
  'Brush 2': 13,
  'Response 2': 16,
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
    // Skip SPI pins (7, 8, 9, 10, 11) when SPI is enabled on Pi
    if (pin >= 7 && pin <= 11) pin = unitNumber + 12;
    
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
// Format: room1:Engine 1|Ladder 2,room2:Medic 3  OR  room1,room2,room3 (room IDs only, no units)
const roomSpeakersEnv = process.env.ROOM_SPEAKERS;
if (roomSpeakersEnv) {
  const rooms = roomSpeakersEnv.split(',').map(s => s.trim()).filter(Boolean);
  for (const room of rooms) {
    const parts = room.split(':');
    const roomId = parts[0].trim();
    if (!roomId) continue;
    const units = parts.length >= 2 && parts[1] ? parts[1].split('|').map(u => u.trim()) : undefined;

    roomSpeakerConfigs.push({
      roomId,
      roomName: roomId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      units
    });

    if (units) {
      for (const unit of units) {
        getPinForUnit(unit);
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

// Optional: per-room GPIO service URL so backend can forward mute to room Pi (avoids browser PNA block when page is HTTP).
// Format: ROOM_GPIO_URLS=mens_bunk:http://192.168.68.140:4000,other_room:http://192.168.68.141:4000
const roomGpioUrlsEnv = process.env.ROOM_GPIO_URLS;
if (roomGpioUrlsEnv) {
  const entries = roomGpioUrlsEnv.split(',').map(s => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const idx = entry.indexOf(':');
    if (idx > 0) {
      const roomId = entry.slice(0, idx).trim();
      const url = entry.slice(idx + 1).trim().replace(/\/+$/, '');
      const room = roomSpeakerConfigs.find(r => r.roomId === roomId);
      if (room) {
        room.gpioServiceUrl = url;
        console.log(`🔌 Room "${roomId}" GPIO proxy: ${url}`);
      } else {
        roomSpeakerConfigs.push({
          roomId,
          roomName: roomId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          gpioServiceUrl: url
        });
        console.log(`🔌 Room "${roomId}" GPIO proxy (added from ROOM_GPIO_URLS): ${url}`);
      }
    }
  }
}

const AMPLIFIER_GPIO_URL = (process.env.AMPLIFIER_GPIO_URL || '').replace(/\/+$/, '');
const RADIO_GPIO_PIN = parseInt(process.env.RADIO_GPIO_PIN || '23', 10);

async function proxyGpioMute(
  gpioServiceUrl: string,
  mute: boolean,
  pins?: number[]
): Promise<{ ok: boolean; status?: number; pins?: number[]; error?: string }> {
  const url = `${gpioServiceUrl.replace(/\/+$/, '')}/gpio/mute`;
  const body: { mute: boolean; pins?: number[] } = { mute };
  if (Array.isArray(pins) && pins.length > 0) {
    body.pins = pins;
  }
  try {
    const fwd = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!fwd.ok) {
      const errText = await fwd.text();
      return { ok: false, status: fwd.status, error: errText || `Upstream returned ${fwd.status}` };
    }
    const data = (await fwd.json().catch(() => ({}))) as { pins?: number[] };
    return { ok: true, pins: data.pins };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'GPIO proxy request failed'
    };
  }
}

function gpioServiceUrlsForUnit(unitName: string): string[] {
  const urls = new Set<string>();
  const needle = unitName.toLowerCase();
  for (const room of roomSpeakerConfigs) {
    if (!room.gpioServiceUrl) continue;
    if (!room.units || room.units.length === 0) continue;
    if (room.units.some((unit) => unit.toLowerCase() === needle)) {
      urls.add(room.gpioServiceUrl);
    }
  }
  return Array.from(urls);
}

function allGpioServiceUrls(): string[] {
  const urls = new Set<string>();
  for (const room of roomSpeakerConfigs) {
    if (room.gpioServiceUrl) urls.add(room.gpioServiceUrl);
  }
  if (AMPLIFIER_GPIO_URL) urls.add(AMPLIFIER_GPIO_URL);
  return Array.from(urls);
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
} else {
  console.log(`🖥️  Local GPIO skipped (${process.platform}) — relays stay on Raspberry Pi GPIO services`);
  if (AMPLIFIER_GPIO_URL) {
    console.log(`📻 Amplifier/radio GPIO proxy: ${AMPLIFIER_GPIO_URL} (pin ${RADIO_GPIO_PIN})`);
  } else {
    console.log('ℹ️  Set AMPLIFIER_GPIO_URL to the engine-bay Pi GPIO service if radio/amp relays are still on a Pi');
  }
  const proxyCount = roomSpeakerConfigs.filter((room) => room.gpioServiceUrl).length;
  if (proxyCount > 0) {
    console.log(`🔌 Room GPIO proxies configured: ${proxyCount}`);
  } else {
    console.log('ℹ️  Set ROOM_GPIO_URLS so this Windows server can mute room Pi relays');
  }
}

app.post('/api/amplifier/mute', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { mute } = req.body;
    
    // For dual relay setup: amplifier relay stays OFF (unmuted), radio relay controls radio
    // This endpoint controls radio muting (not amplifier muting)
    if (radioRelay) {
      // GPIO control: 1 = mute radio (relay closed), 0 = unmute radio (relay open)
      radioRelay.writeSync(mute ? 1 : 0);
      console.log(`📻 Radio ${mute ? 'muted' : 'unmuted'} via GPIO pin ${RADIO_GPIO_PIN}`);
    } else if (AMPLIFIER_GPIO_URL) {
      const proxied = await proxyGpioMute(AMPLIFIER_GPIO_URL, !!mute, [RADIO_GPIO_PIN]);
      if (!proxied.ok) {
        console.warn(`📻 Radio GPIO proxy failed: ${proxied.error}`);
        return res.status(502).json({
          error: 'Amplifier GPIO proxy failed',
          message: proxied.error || 'Unable to reach Pi GPIO service'
        });
      }
      console.log(`📻 Radio ${mute ? 'muted' : 'unmuted'} via GPIO proxy ${AMPLIFIER_GPIO_URL} pin ${RADIO_GPIO_PIN}`);
    } else {
      console.log(`📻 Radio ${mute ? 'muted' : 'unmuted'} (GPIO not available — set AMPLIFIER_GPIO_URL)`);
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
app.post('/api/unit-speaker/mute', validateAdminSession, async (req: Request, res: Response) => {
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
      if (!pin || controlledPins.has(pin)) continue;

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
        continue;
      }

      const proxyUrls = gpioServiceUrlsForUnit(unitName);
      const targets = proxyUrls.length > 0 ? proxyUrls : allGpioServiceUrls();
      if (targets.length === 0) {
        results.push({ unit: unitName, pin, success: false });
        continue;
      }

      let proxiedOk = false;
      for (const url of targets) {
        const proxied = await proxyGpioMute(url, !!mute, [pin]);
        if (proxied.ok) proxiedOk = true;
        else console.warn(`🔊 Unit GPIO proxy failed for ${unitName} via ${url}: ${proxied.error}`);
      }
      if (proxiedOk) {
        controlledPins.add(pin);
        results.push({ unit: unitName, pin, success: true });
        console.log(`🔊 Unit speaker ${mute ? 'muted' : 'unmuted'} (proxy): ${unitName} (GPIO ${pin})`);
      } else {
        results.push({ unit: unitName, pin, success: false });
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
app.post('/api/room-speaker/:roomId/mute', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { mute, pins } = req.body;
    
    const roomConfig = roomSpeakerConfigs.find(r => r.roomId === roomId);
    if (!roomConfig) {
      return res.status(404).json({
        error: 'Room not found',
        message: `Room not configured: ${roomId}`,
        availableRooms: roomSpeakerConfigs.map(r => r.roomId)
      });
    }

    // If this room has a GPIO service URL (room Pi), forward mute there so browser PNA is not involved
    if (roomConfig.gpioServiceUrl) {
      const pinList = Array.isArray(pins) && pins.length > 0 ? pins : undefined;
      const proxied = await proxyGpioMute(roomConfig.gpioServiceUrl, !!mute, pinList);
      if (!proxied.ok) {
        console.warn(`Room GPIO proxy ${roomId} failed (${proxied.status}): ${proxied.error}`);
        return res.status(502).json({
          error: 'Room GPIO proxy failed',
          message: proxied.error || `Upstream returned ${proxied.status}`
        });
      }
      console.log(`🔊 Room speaker ${mute ? 'muted' : 'unmuted'} (proxy): ${roomConfig.roomName}`);
      return res.json({
        success: true,
        muted: mute,
        roomId,
        roomName: roomConfig.roomName,
        controlledPins: proxied.pins,
        message: `Room speaker ${mute ? 'muted' : 'unmuted'} successfully`
      });
    }

    // Room has no gpioServiceUrl – central server has no relay for this room; relays are on room Pi, so set ROOM_GPIO_URLS for this roomId
    if (!roomConfig.units || roomConfig.units.length === 0) {
      return res.json({
        success: true,
        muted: mute,
        roomId,
        roomName: roomConfig.roomName,
        message: 'Room has no units assigned - no relays to control'
      });
    }
    
    // Control all unit pins for this room (local relays on this server)
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
      const unitToCadCode = getUnitToCadCode();
      const pins: number[] = [];
      const unitPins: Array<{ unit: string; pin: number; available: boolean; cadCode?: string }> = [];

      if (roomConfig.units) {
        for (const unitName of roomConfig.units) {
          const pin = getPinForUnit(unitName);
          if (pin) {
            if (!pins.includes(pin)) {
              pins.push(pin);
            }
            const available = !!roomConfig.gpioServiceUrl || unitSpeakerRelays.has(pin);
            unitPins.push({
              unit: unitName,
              pin,
              available,
              cadCode: unitToCadCode[unitName]
            });
          }
        }
      }
      if (roomConfig.gpioServiceUrl && unitToPinMap.size > 0) {
        const existingUnits = new Set(unitPins.map((u) => u.unit.toLowerCase()));
        for (const [unitName, pin] of unitToPinMap.entries()) {
          if (existingUnits.has(unitName.toLowerCase())) continue;
          if (!pins.includes(pin)) pins.push(pin);
          unitPins.push({
            unit: unitName,
            pin,
            available: true,
            cadCode: unitToCadCode[unitName]
          });
          existingUnits.add(unitName.toLowerCase());
        }
      }

      res.json({ 
        success: true,
        roomId,
        roomName: roomConfig.roomName,
        units: roomConfig.units || [],
        unitPins,
        pins,
        available: pins.length > 0 && (!!roomConfig.gpioServiceUrl || pins.some(pin => unitSpeakerRelays.has(pin))),
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

// Import reporting service
import {
  getAlertStatistics,
  getUnitStatistics,
  getAlertsForExport,
  getGeographicDistribution
} from './services/reportingService';

// Reporting and Analytics Endpoints
app.get('/api/reports/statistics', validateAdminSession, (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const timeRange = (startDate && endDate) ? { startDate, endDate } : undefined;
    const stats = getAlertStatistics(timeRange);

    res.json({
      success: true,
      statistics: stats,
      timeRange: timeRange || 'all'
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/reports/units', validateAdminSession, (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const timeRange = (startDate && endDate) ? { startDate, endDate } : undefined;
    const unitStats = getUnitStatistics(timeRange);

    res.json({
      success: true,
      units: unitStats,
      timeRange: timeRange || 'all'
    });
  } catch (error) {
    console.error('Error getting unit statistics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/reports/geographic', validateAdminSession, (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const timeRange = (startDate && endDate) ? { startDate, endDate } : undefined;
    const distribution = getGeographicDistribution(timeRange);

    res.json({
      success: true,
      distribution,
      timeRange: timeRange || 'all'
    });
  } catch (error) {
    console.error('Error getting geographic distribution:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/reports/export', validateAdminSession, (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const format = (req.query.format as string) || 'json';

    const timeRange = (startDate && endDate) ? { startDate, endDate } : undefined;
    const alerts = getAlertsForExport(timeRange);

    if (format === 'csv') {
      // Generate CSV
      const headers = ['ID', 'Timestamp', 'Call Type', 'Address', 'Units', 'Narrative', 'Source'];
      const rows = alerts.map(a => [
        a.id,
        a.timestamp,
        a.call_type,
        a.address,
        a.units,
        a.narrative || '',
        a.source || 'api'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=alerts_${Date.now()}.csv`);
      res.send(csv);
    } else {
      // JSON format (default)
      res.json({
        success: true,
        alerts,
        count: alerts.length,
        timeRange: timeRange || 'all'
      });
    }
  } catch (error) {
    console.error('Error exporting alerts:', error);
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

// LED Ring Control Endpoints
app.post('/api/led-ring/:action', validateApiKey, (req: Request, res: Response) => {
  try {
    const { action } = req.params;
    const { r, g, b, duration } = req.body;
    
    if (!LED_RING_ENABLED) {
      return res.status(503).json({ error: 'LED ring not enabled' });
    }
    
    switch (action) {
      case 'set':
        if (ledRingController) {
          setLEDRingColor(r || 0, g || 0, b || 0);
        } else {
          controlLEDRingPython('set', r || 0, g || 0, b || 0);
        }
        res.json({ success: true, action: 'set', color: { r, g, b } });
        break;
        
      case 'flash':
        const flashDuration = duration || 5000;
        if (ledRingController) {
          flashLEDRing(r || 255, g || 0, b || 0, flashDuration);
        } else {
          controlLEDRingPython('flash', r || 255, g || 0, b || 0, flashDuration);
        }
        res.json({ success: true, action: 'flash', duration: flashDuration });
        break;
        
      case 'off':
        if (ledRingController) {
          setLEDRingColor(0, 0, 0);
        } else {
          controlLEDRingPython('off');
        }
        res.json({ success: true, action: 'off' });
        break;
        
      case 'fire':
        if (ledRingController) {
          flashLEDRing(255, 0, 0, 120000); // Red flash for 2 minutes
        } else {
          controlLEDRingPython('fire');
        }
        res.json({ success: true, action: 'fire' });
        break;
        
      case 'ems':
        if (ledRingController) {
          flashLEDRing(0, 0, 255, 120000); // Blue flash for 2 minutes
        } else {
          controlLEDRingPython('ems');
        }
        res.json({ success: true, action: 'ems' });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error controlling LED ring:', error);
    res.status(500).json({ error: 'Failed to control LED ring' });
  }
});

app.get('/api/led-ring/status', (req: Request, res: Response) => {
  res.json({
    enabled: LED_RING_ENABLED,
    available: LED_RING_ENABLED && (ledRingController !== null || process.platform === 'linux'),
    pin: LED_RING_PIN,
    count: LED_RING_COUNT,
    method: ledRingController ? 'nodejs' : 'python'
  });
});

// Station Units Management Endpoints
// Public endpoint to get active units (for unit selector on displays)
app.get('/api/station-units', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM station_units WHERE is_active = 1 ORDER BY unit_name ASC');
    const units = stmt.all();
    const unitMapping = getUnitDisplayMapping();
    res.json({ success: true, units, unit_mapping: unitMapping });
  } catch (error) {
    console.error('Error fetching station units:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/station-units', validateAdminOrApiKey, (req: Request, res: Response) => {
  try {
    const { unit_name, unit_type, description, cad_code } = req.body;
    
    if (!unit_name || unit_name.trim() === '') {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['unit_name']
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO station_units (unit_name, unit_type, description, cad_code)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      unit_name.trim(),
      unit_type || null,
      description || null,
      cad_code && typeof cad_code === 'string' ? cad_code.trim() || null : null
    );
    
    const unit = {
      id: result.lastInsertRowid,
      unit_name: unit_name.trim(),
      unit_type: unit_type || null,
      description: description || null,
      cad_code: cad_code && typeof cad_code === 'string' ? cad_code.trim() || null : null,
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
    const { unit_name, unit_type, description, cad_code, is_active } = req.body;
    
    const stmt = db.prepare(`
      UPDATE station_units
      SET unit_name = ?, unit_type = ?, description = ?, cad_code = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      unit_name || null,
      unit_type || null,
      description || null,
      cad_code && typeof cad_code === 'string' ? cad_code.trim() || null : null,
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

app.delete('/api/station-units/:id', validateAdminOrApiKey, (req: Request, res: Response) => {
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

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚨 OpenAlerts API server running on http://0.0.0.0:${PORT} (${process.platform})`);
  console.log(`📊 Database initialized at: alerts.db`);
  console.log(`🔌 Socket.io server ready`);
  if (process.platform === 'win32') {
    console.log('🖥️  Windows host: displays should open http://THIS_PC_IP:3000 — keep room-gpio-service running on each Pi');
  }
  
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
