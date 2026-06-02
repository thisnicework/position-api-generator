// --- DOM Elements ---
const canvas = document.getElementById('control-canvas');
const ctx = canvas.getContext('2d');
const protocolSelect = document.getElementById('comm-protocol');
const addressInput = document.getElementById('server-address');
const intervalSlider = document.getElementById('tx-interval');
const intervalVal = document.getElementById('interval-val');
const connectBtn = document.getElementById('connect-btn');
const connectionBadge = document.getElementById('connection-badge');
const clearTerminalBtn = document.getElementById('clear-terminal');
const terminalBody = document.getElementById('terminal-body');

// Supabase-specific DOM elements
const localConfigGroup = document.getElementById('local-config-group');
const supabaseConfigGroup = document.getElementById('supabase-config-group');
const supabaseUrlInput = document.getElementById('supabase-url');
const supabaseKeyInput = document.getElementById('supabase-key');

// Telemetry Fields
const telX = document.getElementById('tel-x');
const telY = document.getElementById('tel-y');
const telR = document.getElementById('tel-r');

// --- Physics State & Variables ---
const state = {
  x: 2500,       // Start in the center of the 0..5000 grid
  y: 2500,       // Start in the center of the 0..5000 grid
  vx: 0,         // Velocity X
  vy: 0,         // Velocity Y
  rotation: 0,   // Angle in degrees (0 - 360)
  vRotation: 0,  // Rotational velocity (deg/frame)
};

const settings = {
  maxSpeed: 29.4,          // 70% of previous max speed (42.0 * 0.7)
  acceleration: 3.85,      // 70% of previous acceleration (5.5 * 0.7)
  friction: 0.85,          // Retains snappy deceleration
  rotationSpeed: 0.7,      // 70% of previous rotation acceleration (1.0 * 0.7)
  maxRotationSpeed: 2.8,   // 70% of previous max rotation speed (4.0 * 0.7 = 168 deg/sec)
  rotationFriction: 0.75,  // Retains snappy rotation deceleration
  canvasRangeX: 5000,       // Coordinate mapping width (0..5000)
  canvasRangeY: 5000,       // Coordinate mapping height (0..5000)
};

// --- Keyboard State ---
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  q: false,
  e: false,
  Space: false,
};

// --- Networking State ---
let activeProtocol = 'http'; // 'http', 'ws', or 'supabase'
let apiEndpoint = 'http://localhost:5005/api/state';
let transmitInterval = 200; // ms
let transmitIntervalId = null;
let wsClient = null;
let connectionState = 'disconnected'; // 'disconnected', 'connecting', 'connected'

// Supabase State
let supabaseClient = null;

// --- Initialize Event Listeners ---
window.addEventListener('keydown', (e) => {
  const key = e.key === ' ' ? 'Space' : e.key;
  if (key in keys) {
    keys[key] = true;
    // Prevent default browser behavior (like scrolling on Space/Arrows)
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key === ' ' ? 'Space' : e.key;
  if (key in keys) {
    keys[key] = false;
  }
});

function updateProtocolUI() {
  const proto = protocolSelect.value;
  if (proto === 'supabase') {
    localConfigGroup.style.display = 'none';
    supabaseConfigGroup.style.display = 'block';
  } else {
    localConfigGroup.style.display = 'block';
    supabaseConfigGroup.style.display = 'none';
    if (proto === 'ws') {
      addressInput.value = 'ws://localhost:5005/ws';
    } else {
      addressInput.value = 'http://localhost:5005/api/state';
    }
  }
}

protocolSelect.addEventListener('change', () => {
  updateProtocolUI();
  localStorage.setItem('comm_protocol', protocolSelect.value);
});

intervalSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  intervalVal.textContent = `${val} ms`;
});

connectBtn.addEventListener('click', () => {
  setupConnection();
});

clearTerminalBtn.addEventListener('click', () => {
  terminalBody.innerHTML = '';
});

function setupConnection() {
  // Clean up existing loops/connections
  if (transmitIntervalId) {
    clearInterval(transmitIntervalId);
    transmitIntervalId = null;
  }
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }

  activeProtocol = protocolSelect.value;
  transmitInterval = parseInt(intervalSlider.value);

  updateConnectionStatus('connecting', 'CONNECTING...');

  if (activeProtocol === 'supabase') {
    const url = supabaseUrlInput.value.trim();
    const key = supabaseKeyInput.value.trim();
    
    if (!url || !key) {
      logTerminal('error', 'Supabase URL and Anon Key are required!');
      updateConnectionStatus('disconnected', 'CONFIG ERROR');
      return;
    }
    
    // Save credentials to localStorage
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    
    logTerminal('system', `Initializing Supabase client... Interval: ${transmitInterval}ms`);
    initSupabase(url, key);
  } else {
    apiEndpoint = addressInput.value.trim();
    logTerminal('system', `Initializing communication interface... Protocol: ${activeProtocol.toUpperCase()}, Interval: ${transmitInterval}ms`);

    if (activeProtocol === 'ws') {
      initWebSocket();
    } else {
      updateConnectionStatus('connected', 'HTTP ONLINE');
      startTransmissionLoop();
    }
  }
}

function initSupabase(url, key) {
  try {
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase SDK not loaded. Check internet connection or CDN script tag.');
    }
    
    supabaseClient = supabase.createClient(url, key);
    
    updateConnectionStatus('connected', 'SUPABASE ONLINE');
    logTerminal('success', `Supabase Client initialized. Writing to table 'position_state'.`);
    startTransmissionLoop();
  } catch (err) {
    logTerminal('error', `Failed to initialize Supabase: ${err.message}`);
    updateConnectionStatus('disconnected', 'SUPABASE ERROR');
  }
}

function initWebSocket() {
  try {
    wsClient = new WebSocket(apiEndpoint);

    wsClient.onopen = () => {
      updateConnectionStatus('connected', 'WS CONNECTED');
      logTerminal('success', `WebSocket connected to ${apiEndpoint}`);
      startTransmissionLoop();
    };

    wsClient.onmessage = (event) => {
      // Handle acknowledgment or feedback from backend
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'ack') {
          // Can measure latency if needed
        }
      } catch (err) {}
    };

    wsClient.onerror = (err) => {
      logTerminal('error', `WebSocket error connecting to ${apiEndpoint}`);
      updateConnectionStatus('disconnected', 'WS ERROR');
    };

    wsClient.onclose = () => {
      logTerminal('system', `WebSocket connection closed.`);
      updateConnectionStatus('disconnected', 'OFFLINE');
      if (transmitIntervalId) {
        clearInterval(transmitIntervalId);
        transmitIntervalId = null;
      }
    };
  } catch (err) {
    logTerminal('error', `Failed to build WebSocket: ${err.message}`);
    updateConnectionStatus('disconnected', 'OFFLINE');
  }
}

function updateConnectionStatus(stateClass, label) {
  connectionState = stateClass;
  connectionBadge.className = `badge badge-${stateClass}`;
  connectionBadge.textContent = label;
}

function startTransmissionLoop() {
  transmitIntervalId = setInterval(() => {
    transmitState();
  }, transmitInterval);

  logTerminal('system', `Started transmission loop. Interval: ${transmitInterval}ms`);
}

// --- Transmit State via selected Protocol ---
function transmitState() {
  const payload = {
    x: parseFloat(state.x.toFixed(2)),
    y: parseFloat(state.y.toFixed(2)),
    rotation: Math.round(state.rotation),
    timestamp: Date.now()
  };

  if (activeProtocol === 'ws' && wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(payload));
    logTransmission(payload, 'WS SEND');
  } else if (activeProtocol === 'http') {
    fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      logTransmission(payload, `HTTP 200 OK`);
    })
    .catch(err => {
      logTerminal('error', `Transmit fail: ${err.message}`);
      updateConnectionStatus('disconnected', 'HTTP ERROR');
    });
  } else if (activeProtocol === 'supabase' && supabaseClient) {
    // Database Upsert directly at the transmit interval rate (no sockets)
    supabaseClient
      .from('position_state')
      .upsert({ id: 1, ...payload })
      .then(({ error }) => {
        if (error) {
          logTerminal('error', `Supabase DB Write error: ${error.message}`);
        } else {
          logTransmission(payload, 'SB DB UPSERT');
        }
      });
  }
}

function logTransmission(payload, statusText) {
  const msg = `>> tx_data(x=${payload.x.toFixed(1).padStart(5, ' ')}, y=${payload.y.toFixed(1).padStart(5, ' ')}, theta=${String(payload.rotation).padStart(3, ' ')}°) [${statusText}]`;
  
  const line = document.createElement('div');
  line.className = 'log-line send-log';
  line.textContent = msg;
  terminalBody.appendChild(line);
  
  // Scroll to bottom
  terminalBody.scrollTop = terminalBody.scrollHeight;

  // Limit terminal logs
  if (terminalBody.childElementCount > 30) {
    terminalBody.removeChild(terminalBody.firstChild);
  }
}

function logTerminal(type, message) {
  const line = document.createElement('div');
  line.className = `log-line ${type}-log`;
  line.textContent = `>> system_msg: ${message}`;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

// --- Canvas Sizing ---
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Set initial telemetry values
telX.textContent = '2500.0';
telY.textContent = '2500.0';
telR.textContent = '0°';

// --- Main Loop: Physics & Rendering (60fps) ---
function mainLoop() {
  updatePhysics();
  render();
  requestAnimationFrame(mainLoop);
}

function updatePhysics() {
  // 1. Position Input Forces
  let ax = 0;
  let ay = 0;
  
  if (keys.ArrowUp) ay += settings.acceleration;  // Up increases Y (closer to 800)
  if (keys.ArrowDown) ay -= settings.acceleration; // Down decreases Y (closer to 0)
  if (keys.ArrowLeft) ax -= settings.acceleration; // Left decreases X (closer to 0)
  if (keys.ArrowRight) ax += settings.acceleration; // Right increases X (closer to 800)

  state.vx += ax;
  state.vy += ay;

  // Apply Friction
  state.vx *= settings.friction;
  state.vy *= settings.friction;

  // Limit position speed
  const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
  if (speed > settings.maxSpeed) {
    state.vx = (state.vx / speed) * settings.maxSpeed;
    state.vy = (state.vy / speed) * settings.maxSpeed;
  }

  // 2. Rotation Input Forces
  let aRotation = 0;
  if (keys.q || keys.Q) aRotation -= settings.rotationSpeed;
  if (keys.e || keys.E) aRotation += settings.rotationSpeed;

  state.vRotation += aRotation;
  state.vRotation *= settings.rotationFriction;

  // Limit rotation speed
  if (Math.abs(state.vRotation) > settings.maxRotationSpeed) {
    state.vRotation = Math.sign(state.vRotation) * settings.maxRotationSpeed;
  }

  // 3. Space Brake Key
  if (keys.Space) {
    state.vx *= 0.5;
    state.vy *= 0.5;
    state.vRotation *= 0.5;
  }

  // 4. Update coordinates
  state.x += state.vx;
  // Keep in mind canvas Y goes down, but we want Y pointing UP in telemetry.
  // We simulate positions inside our defined canvas coordinate range
  state.y += state.vy; 

  // Constrain coordinates to range boundary [0, 800]
  const xLimit = settings.canvasRangeX;
  const yLimit = settings.canvasRangeY;
  
  if (state.x > xLimit) { state.x = xLimit; state.vx = 0; }
  if (state.x < 0) { state.x = 0; state.vx = 0; }
  if (state.y > yLimit) { state.y = yLimit; state.vy = 0; }
  if (state.y < 0) { state.y = 0; state.vy = 0; }

  // Update angle (keep within 0-360)
  state.rotation = (state.rotation + state.vRotation + 360) % 360;

  // 5. Update Telemetry UI
  telX.textContent = state.x.toFixed(1);
  telY.textContent = state.y.toFixed(1);
  telR.textContent = `${Math.round(state.rotation)}°`;
}

function render() {
  const width = canvas.width;
  const height = canvas.height;

  // Clear Canvas (MATLAB White Background)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw Grid Lines (MATLAB Style matching 0..5000 coordinates)
  ctx.strokeStyle = '#e9e9e9';
  ctx.lineWidth = 1;
  
  // Draw vertical grid lines at 1000, 2000, 3000, 4000
  for (let gx = 1000; gx < 5000; gx += 1000) {
    const x = (gx / 5000) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  // Draw horizontal grid lines at 1000, 2000, 3000, 4000
  for (let gy = 1000; gy < 5000; gy += 1000) {
    const y = (gy / 5000) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw Origin Distance Reference Circles (MATLAB Dotted Polar Grid, centered at 0, height - bottom-left)
  ctx.strokeStyle = '#c7c7c7';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 4]); // Dotted circles
  for (let r = 1000; r < 7000; r += 1000) {
    const radius = (r / 5000) * width;
    ctx.beginPath();
    ctx.arc(0, height, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]); // Reset dash

  // MATLAB Outer Axes Border (box on style)
  ctx.strokeStyle = '#a5a5a5';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(0, 0, width, height);

  // Translate coordinates from state [0..800] to screen pixels (Y is inverted: 0 is bottom, height is top)
  const screenX = (state.x / settings.canvasRangeX) * width;
  const screenY = height - (state.y / settings.canvasRangeY) * height;

  // Draw target dot connection line to origin (0, height) (MATLAB Orange dashed line)
  ctx.strokeStyle = 'rgba(217, 83, 25, 0.6)'; // MATLAB Orange
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(screenX, screenY);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Save context for dot drawing
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate((state.rotation * Math.PI) / 180);

  // MATLAB Marker Outer Circle (Blue border)
  ctx.strokeStyle = '#0072bd'; // MATLAB Blue
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#e1f5fe'; // MATLAB Light blue fill
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Direction/Vector arrow inside dot pointing forward (Orange/Red)
  ctx.fillStyle = '#d95319'; // MATLAB Orange
  ctx.beginPath();
  ctx.moveTo(0, -9); // Tip
  ctx.lineTo(-4, -2); // Left base
  ctx.lineTo(-1.5, -3); // Inner left
  ctx.lineTo(-1.5, 4);  // Tail left
  ctx.lineTo(1.5, 4);   // Tail right
  ctx.lineTo(1.5, -3);  // Inner right
  ctx.lineTo(4, -2);  // Right base
  ctx.closePath();
  ctx.fill();

  // Center core dot
  ctx.fillStyle = '#0072bd';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  
  // Draw coordinate label near the dot (MATLAB label style)
  ctx.fillStyle = '#333333';
  ctx.font = '11px "Fira Code", monospace';
  ctx.fillText(
    `(${state.x.toFixed(0)}, ${state.y.toFixed(0)}, ${Math.round(state.rotation)}°)`,
    screenX + 22,
    screenY + 4
  );
}

// Start everything
if (localStorage.getItem('supabase_url')) {
  supabaseUrlInput.value = localStorage.getItem('supabase_url');
}
if (localStorage.getItem('supabase_key')) {
  supabaseKeyInput.value = localStorage.getItem('supabase_key');
}
if (localStorage.getItem('comm_protocol')) {
  protocolSelect.value = localStorage.getItem('comm_protocol');
}
updateProtocolUI();

setupConnection();
requestAnimationFrame(mainLoop);
logTerminal('success', 'Dot visualizer engine started.');
