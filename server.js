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
let latestState = { x: 0, y: 0, rotation: 0, timestamp: 0, method: 'none' };

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ noServer: true });

// Broadcast function to send data to all connected WebSocket clients (like TouchDesigner)
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// HTTP POST endpoint for state updates
app.post('/api/state', (req, res) => {
  const { x, y, rotation, timestamp } = req.body;
  
  if (typeof x !== 'number' || typeof y !== 'number' || typeof rotation !== 'number') {
    return res.status(400).json({ error: 'Invalid state format. Require x, y, rotation numbers.' });
  }

  latestState = { x, y, rotation, timestamp, method: 'HTTP POST' };
  
  // Log receipt in a formatted way
  logState('HTTP', latestState);
  
  // Broadcast to all WebSocket clients (TouchDesigner)
  broadcast({ type: 'state', ...latestState });
  
  res.json({ status: 'ok', received: latestState });
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
  console.log('\x1b[36m[WS] Client connected\x1b[0m');
  
  // Send latest state to newly connected client (TouchDesigner) immediately
  ws.send(JSON.stringify({ type: 'state', ...latestState }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { x, y, rotation, timestamp } = data;
      
      latestState = { x, y, rotation, timestamp, method: 'WebSocket' };
      logState('WS', latestState);
      
      // Broadcast state to all other connected clients
      broadcast({ type: 'state', ...latestState });
      
      // Echo back acknowledgment to sender
      ws.send(JSON.stringify({ status: 'ack', timestamp }));
    } catch (err) {
      ws.send(JSON.stringify({ error: 'Invalid JSON format' }));
    }
  });

  ws.on('close', () => {
    console.log('\x1b[31m[WS] Client disconnected\x1b[0m');
  });
});

// Helper function to print values with nice formatting in console
function logState(type, state) {
  const timeStr = new Date(state.timestamp).toISOString().split('T')[1].slice(0, -1);
  const xStr = state.x.toFixed(1).padStart(6, ' ');
  const yStr = state.y.toFixed(1).padStart(6, ' ');
  const rStr = state.rotation.toFixed(0).padStart(3, ' ');
  
  const typeColor = type === 'HTTP' ? '\x1b[33m' : '\x1b[32m'; // Yellow for HTTP, Green for WS
  console.log(`${typeColor}[${type}]\x1b[0m Time: ${timeStr} | Position: (\x1b[35mX:${xStr}\x1b[0m, \x1b[35mY:${yStr}\x1b[0m) | Angle: \x1b[36m${rStr}°\x1b[0m`);
}

server.listen(port, () => {
  console.log(`\n\x1b[1;32m====================================================\x1b[0m`);
  console.log(`\x1b[1;32m  5Hz API Control Server running on port ${port}  \x1b[0m`);
  console.log(`\x1b[1;32m  Web Interface: http://localhost:${port}          \x1b[0m`);
  console.log(`\x1b[1;32m====================================================\x1b[0m\n`);
});
