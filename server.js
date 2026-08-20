const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store latest state in server memory
let latestState = { x: 2500, y: 2500, rotation: 0, action: 4, timestamp: 0, method: 'none' };

let defaultMonitorDelayMs = 500; // Default 0.5s delay between sequential monitors
let autoMonitorIndexCounter = 0;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ noServer: true });

// Scheduled Broadcast function: sends absolute execution timestamp (executeAt) for sequential monitors
function broadcastScheduled(stateData, monitorDelayMs) {
  const baseTime = Date.now();
  const stepDelay = typeof monitorDelayMs === 'number' ? monitorDelayMs : defaultMonitorDelayMs;

  let index = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Use client's registered monitorIndex or fall back to client sequence
      const monitorIndex = typeof client.monitorIndex === 'number' ? client.monitorIndex : index;
      const executeAt = baseTime + (monitorIndex * stepDelay);

      const scheduledPayload = {
        type: 'state',
        scheduledType: 'scheduled_state',
        monitorIndex: monitorIndex,
        executeAt: executeAt,
        delayMs: stepDelay,
        ...stateData
      };

      client.send(JSON.stringify(scheduledPayload));
      index++;
    }
  });
}


// HTTP POST endpoint for state updates
app.post('/api/state', (req, res) => {
  const { x, y, rotation, action, timestamp, monitorDelay } = req.body;
  
  if (typeof x !== 'number' || typeof y !== 'number' || typeof rotation !== 'number') {
    return res.status(400).json({ error: 'Invalid state format. Require x, y, rotation numbers.' });
  }

  const actionCode = typeof action === 'number' ? action : 4;
  if (typeof monitorDelay === 'number') {
    defaultMonitorDelayMs = monitorDelay;
  }

  latestState = { x, y, rotation, action: actionCode, timestamp: timestamp || Date.now(), method: 'HTTP POST' };

  // Log receipt in a formatted way
  logState('HTTP', latestState);
  
  // Broadcast with absolute timestamps to all WebSocket monitors (TouchDesigner)
  broadcastScheduled(latestState, defaultMonitorDelayMs);
  
  res.json({ status: 'ok', received: latestState, monitorDelay: defaultMonitorDelayMs });
});

// HTTP GET endpoint to retrieve the latest state
app.get('/api/state', (req, res) => {
  res.json(latestState);
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  // Assign default sequential monitor index
  ws.monitorIndex = autoMonitorIndexCounter++;
  console.log(`\x1b[36m[WS] Client connected (Assigned Monitor Index: ${ws.monitorIndex})\x1b[0m`);
  
  // Send latest state to newly connected client (TouchDesigner) immediately
  const initialExecuteAt = Date.now() + (ws.monitorIndex * defaultMonitorDelayMs);
  ws.send(JSON.stringify({
    type: 'state',
    scheduledType: 'scheduled_state',
    monitorIndex: ws.monitorIndex,
    executeAt: initialExecuteAt,
    delayMs: defaultMonitorDelayMs,
    ...latestState
  }));

  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Handle client registration / monitor index override
      if (data.type === 'register') {
        if (typeof data.monitorIndex === 'number') {
          ws.monitorIndex = data.monitorIndex;
          console.log(`\x1b[32m[WS] Client updated Monitor Index to ${ws.monitorIndex}\x1b[0m`);
          ws.send(JSON.stringify({ status: 'registered', monitorIndex: ws.monitorIndex }));
        }
        return;
      }
      
      const { x, y, rotation, action, timestamp, monitorDelay } = data;
      
      const actionCode = typeof action === 'number' ? action : 4;
      if (typeof monitorDelay === 'number') {
        defaultMonitorDelayMs = monitorDelay;
      }

      latestState = { x, y, rotation, action: actionCode, timestamp: timestamp || Date.now(), method: 'WebSocket' };
      logState('WS', latestState);
      
      // Broadcast scheduled state to all connected clients
      broadcastScheduled(latestState, defaultMonitorDelayMs);
      
      // Echo back acknowledgment to sender
      ws.send(JSON.stringify({ status: 'ack', timestamp: latestState.timestamp }));
    } catch (err) {
      ws.send(JSON.stringify({ error: 'Invalid JSON format' }));
    }
  });

  ws.on('close', () => {
    console.log(`\x1b[31m[WS] Client disconnected (Monitor Index was: ${ws.monitorIndex})\x1b[0m`);
  });
});


// Helper function to print values with nice formatting in console
function logState(type, state) {
  const timeStr = new Date(state.timestamp).toISOString().split('T')[1].slice(0, -1);
  const xStr = state.x.toFixed(1).padStart(6, ' ');
  const yStr = state.y.toFixed(1).padStart(6, ' ');
  const rStr = state.rotation.toFixed(0).padStart(3, ' ');
  const aStr = String(state.action !== undefined ? state.action : 4).padStart(2, ' ');
  
  let typeColor = '\x1b[33m'; // Default Yellow
  if (type === 'WS') typeColor = '\x1b[32m'; // Green
  if (type === 'SERIAL') typeColor = '\x1b[36m'; // Cyan
  
  console.log(`${typeColor}[${type}]\x1b[0m Time: ${timeStr} | Position: (\x1b[35mX:${xStr}\x1b[0m, \x1b[35mY:${yStr}\x1b[0m) | Angle: \x1b[36m${rStr}°\x1b[0m | Action: \x1b[33m${aStr}\x1b[0m`);
}

// --- Serial Port Integration (Node.js backend) ---
let SerialPort = null;
let ReadlineParser = null;
try {
  const serialModule = require('serialport');
  const parserModule = require('@serialport/parser-readline');
  SerialPort = serialModule.SerialPort;
  ReadlineParser = parserModule.ReadlineParser;
} catch (e) {
  console.log('\x1b[33m[SERIAL] serialport module not available or native dependencies missing.\x1b[0m');
}

let activeSerialPort = null;
let activeSerialParser = null;
let activePortPath = null;

function parseSerialLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let x = null, y = null, rotation = null, action = 4;


  // 1. Try JSON format: {"x":2500, "y":2500, "rotation":90}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj.x === 'number') x = obj.x;
      if (typeof obj.y === 'number') y = obj.y;
      if (typeof obj.rotation === 'number') rotation = obj.rotation;
      else if (typeof obj.r === 'number') rotation = obj.r;
      else if (typeof obj.deg === 'number') rotation = obj.deg;
      if (typeof obj.action === 'number') action = obj.action;
      else if (typeof obj.a === 'number') action = obj.a;
    } catch (err) {}
  }

  // 2. Try Tagged Key-Value format: X:2500 Y:2500 R:90
  if (x === null || y === null || rotation === null) {
    const xMatch = trimmed.match(/(?:x|posx|x_val)[:=]\s*(-?\d+(?:\.\d+)?)/i);
    const yMatch = trimmed.match(/(?:y|posy|y_val)[:=]\s*(-?\d+(?:\.\d+)?)/i);
    const rMatch = trimmed.match(/(?:r|rot|deg|angle|rotation)[:=]\s*(-?\d+(?:\.\d+)?)/i);
    const aMatch = trimmed.match(/(?:a|act|action)[:=]\s*(\d+)/i);

    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);
    if (rMatch) rotation = parseFloat(rMatch[1]);
    if (aMatch) action = parseInt(aMatch[1], 10);
  }

  // 3. Try CSV format: 508, 10, 179 or 2500, 2500, 90
  if (x === null || y === null || rotation === null) {
    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 3) {
      const v1 = parseFloat(parts[0]);
      const v2 = parseFloat(parts[1]);
      const v3 = parseFloat(parts[2]);
      if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
        // Default to Y, Rotation, X (1:Y, 2:Rotation, 3:X) -> Swapped X and Y
        y = v1;
        rotation = v2;
        x = v3;
        if (parts.length >= 4 && !isNaN(parseInt(parts[3]))) {
          action = parseInt(parts[3], 10);
        }
      }
    }
  }



  if (x !== null && y !== null && rotation !== null) {
    x = Math.max(0, Math.min(5000, x));
    y = Math.max(0, Math.min(5000, y));
    rotation = ((rotation % 360) + 360) % 360;
    return { x, y, rotation, action, timestamp: Date.now(), method: 'SerialPort' };
  }

  return null;
}

// Endpoint: List available serial ports
app.get('/api/serial/ports', async (req, res) => {
  if (!SerialPort) {
    return res.status(501).json({ error: 'SerialPort module not installed on server' });
  }
  try {
    const ports = await SerialPort.list();
    res.json({ ports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Get active serial status
app.get('/api/serial/status', (req, res) => {
  res.json({
    connected: !!(activeSerialPort && activeSerialPort.isOpen),
    port: activePortPath
  });
});

// Endpoint: Connect to serial port
app.post('/api/serial/connect', (req, res) => {
  if (!SerialPort) {
    return res.status(501).json({ error: 'SerialPort module not installed on server' });
  }

  const { path: portPath, baudRate } = req.body;
  if (!portPath) {
    return res.status(400).json({ error: 'port path is required' });
  }

  // Close existing port if open
  if (activeSerialPort && activeSerialPort.isOpen) {
    try { activeSerialPort.close(); } catch (e) {}
  }

  const rate = parseInt(baudRate, 10) || 115200;

  try {
    activeSerialPort = new SerialPort({ path: portPath, baudRate: rate });
    activeSerialParser = activeSerialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    activePortPath = portPath;

    activeSerialParser.on('data', (line) => {
      const parsed = parseSerialLine(line);
      if (parsed) {
        latestState = parsed;
        logState('SERIAL', latestState);
        broadcastScheduled(latestState, defaultMonitorDelayMs);

      }
    });

    activeSerialPort.on('error', (err) => {
      console.error(`\x1b[31m[SERIAL] Error on ${portPath}: ${err.message}\x1b[0m`);
    });

    activeSerialPort.on('close', () => {
      console.log(`\x1b[33m[SERIAL] Connection closed: ${portPath}\x1b[0m`);
      activePortPath = null;
    });

    console.log(`\x1b[32m[SERIAL] Connected to ${portPath} at ${rate} bps\x1b[0m`);
    res.json({ status: 'connected', port: portPath, baudRate: rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Disconnect serial port
app.post('/api/serial/disconnect', (req, res) => {
  if (activeSerialPort && activeSerialPort.isOpen) {
    activeSerialPort.close((err) => {
      if (err) return res.status(500).json({ error: err.message });
      activePortPath = null;
      res.json({ status: 'disconnected' });
    });
  } else {
    res.json({ status: 'already disconnected' });
  }
});

server.listen(port, () => {
  console.log(`\n\x1b[1;32m====================================================\x1b[0m`);
  console.log(`\x1b[1;32m  5Hz API Control Server running on port ${port}  \x1b[0m`);
  console.log(`\x1b[1;32m  Web Interface: http://localhost:${port}          \x1b[0m`);
  console.log(`\x1b[1;32m====================================================\x1b[0m\n`);
});

