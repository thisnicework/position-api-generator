// --- DOM Elements ---
const canvas = document.getElementById('control-canvas');
const ctx = canvas.getContext('2d');
const addressInput = document.getElementById('server-address');
const intervalSlider = document.getElementById('tx-interval');
const intervalVal = document.getElementById('interval-val');
const connectBtn = document.getElementById('connect-btn');
const connectionBadge = document.getElementById('connection-badge');
const clearTerminalBtn = document.getElementById('clear-terminal');
const terminalBody = document.getElementById('terminal-body');

// Telemetry Fields
const telX = document.getElementById('tel-x');
const telY = document.getElementById('tel-y');
const telR = document.getElementById('tel-r');
const telD = document.getElementById('tel-d');
const telA = document.getElementById('tel-a');

// --- Physics State & Variables ---
const state = {
  x: 2500,       // Start in the center of the 0..5000 grid
  y: 2500,       // Start in the center of the 0..5000 grid
  vx: 0,         // Velocity X
  vy: 0,         // Velocity Y
  rotation: 0,   // Angle in degrees (0 - 360)
  vRotation: 0,  // Rotational velocity (deg/frame)
  action: 3,     // Action mode state code 0..6 (default: 3)
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
const currentOrigin = window.location.origin.includes('file://') ? 'http://localhost:5005' : window.location.origin;
let apiEndpoint = `${currentOrigin}/api/state`;
let transmitInterval = 200; // ms
let transmitIntervalId = null;
let connectionState = 'disconnected'; // 'disconnected', 'connecting', 'connected'

// Track last sent state to only send when values change
let lastTransmittedState = { x: null, y: null, rotation: null, action: null };

// --- Action Pattern Classifier State ---
const actionTracker = {
  borderMoveStartTime: null,
  trajectoryHistory: [], // Array of { x, y, time } for Closed Shape (닫힌 도형) loop detection
  closedShapeUntil: 0,   // Hysteresis timestamp for smooth active state
};

function updateTrajectory(now) {
  const history = actionTracker.trajectoryHistory;
  const last = history[history.length - 1];
  
  // Record position point if moved at least 6 units from last recorded point
  if (!last || Math.hypot(state.x - last.x, state.y - last.y) >= 6) {
    history.push({ x: state.x, y: state.y, time: now });
  }

  // Keep trajectory history for past 6 seconds
  const cutoff = now - 6000;
  while (history.length > 0 && history[0].time < cutoff) {
    history.shift();
  }
}

function checkClosedShape(now) {
  const history = actionTracker.trajectoryHistory;
  if (history.length < 10) return false;

  const current = { x: state.x, y: state.y };
  let pathLength = 0;
  let minX = current.x, maxX = current.x, minY = current.y, maxY = current.y;

  // Search backward in trajectory history for loop closure (닫힌 루프)
  for (let i = history.length - 2; i >= 0; i--) {
    const pt = history[i];
    const prevPt = history[i + 1];
    const stepDist = Math.hypot(prevPt.x - pt.x, prevPt.y - pt.y);
    pathLength += stepDist;

    minX = Math.min(minX, pt.x);
    maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y);
    maxY = Math.max(maxY, pt.y);

    const timeDiff = now - pt.time;
    // Check points visited at least 1.2 seconds ago
    if (timeDiff >= 1200) {
      const distanceToCurrent = Math.hypot(current.x - pt.x, current.y - pt.y);
      const bboxWidth = maxX - minX;
      const bboxHeight = maxY - minY;

      // Closed Shape (닫힌 도형) Loop Closure Criteria:
      // 1. Current position returns near a previously visited point (distance <= 480)
      // 2. Traveled path length along trajectory between them is at least 1200 units
      // 3. 2D Bounding box of the shape has width and height >= 250 (ensures 2D enclosed shape, not 1D line)
      if (distanceToCurrent <= 480 && pathLength >= 1200 && bboxWidth >= 250 && bboxHeight >= 250) {
        return true;
      }
    }
  }

  return false;
}

function determineActionCode() {
  const distFromCenter = Math.hypot(state.x - 2500, state.y - 2500);
  const distToTop = Math.hypot(state.x - 2500, state.y - 5000);
  const linearSpeed = Math.hypot(state.vx, state.vy);
  const rotSpeed = Math.abs(state.vRotation);
  const now = Date.now();

  // Update trajectory points
  updateTrajectory(now);

  // Mode 6: (2500, 5000)에 근접했을 때 (within 400 units of top point)
  if (distToTop <= 400) {
    return 6;
  }

  // Mode 5: 원 보더 방향으로 1.5초 이상 이동 (이때 원 보더와 가까운 위치에 있어야함)
  const isNearBorder = distFromCenter >= 1900;
  const nx = distFromCenter > 0 ? (state.x - 2500) / distFromCenter : 0;
  const ny = distFromCenter > 0 ? (state.y - 2500) / distFromCenter : 0;
  const outwardVel = state.vx * nx + state.vy * ny;

  const isMovingTowardBorder = isNearBorder && (
    outwardVel > 0.5 ||
    (distFromCenter >= 2400 && (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight))
  );

  if (isMovingTowardBorder) {
    if (!actionTracker.borderMoveStartTime) {
      actionTracker.borderMoveStartTime = now;
    }
    if (now - actionTracker.borderMoveStartTime >= 1500) {
      return 5;
    }
  } else {
    actionTracker.borderMoveStartTime = null;
  }

  // Mode 2: 제자리에서 빙빙 (Spinning in place)
  const isSpinningKeys = keys.q || keys.Q || keys.e || keys.E || rotSpeed > 0.6;
  if (isSpinningKeys && linearSpeed < 3.5) {
    return 2;
  }

  // Mode 1: 닫힌 도형/원 이동 (Closed Shape Loop Detection)
  const isClosedShapeNow = checkClosedShape(now);
  if (isClosedShapeNow) {
    actionTracker.closedShapeUntil = now + 1500; // Keep Mode 1 active for 1.5s after loop completion
  }
  if (now < actionTracker.closedShapeUntil) {
    return 1;
  }

  // Mode 3: 기본
  return 3;
}

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

  apiEndpoint = addressInput.value.trim();
  transmitInterval = parseInt(intervalSlider.value);

  updateConnectionStatus('connecting', 'CONNECTING...');
  logTerminal('system', `Initializing communication interface... Interval: ${transmitInterval}ms`);

  updateConnectionStatus('connected', 'ONLINE');
  startTransmissionLoop();
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

// --- Transmit State via HTTP POST ---
function transmitState() {
  const currentX = parseFloat(state.x.toFixed(2));
  const currentY = parseFloat(state.y.toFixed(2));
  const currentRotation = Math.round(state.rotation);
  const currentAction = state.action !== undefined ? state.action : 3;

  // Skip sending if values haven't changed
  if (
    currentX === lastTransmittedState.x &&
    currentY === lastTransmittedState.y &&
    currentRotation === lastTransmittedState.rotation &&
    currentAction === lastTransmittedState.action
  ) {
    return;
  }

  // Update last transmitted values
  lastTransmittedState = {
    x: currentX,
    y: currentY,
    rotation: currentRotation,
    action: currentAction
  };

  const payload = {
    x: currentX,
    y: currentY,
    rotation: currentRotation,
    action: currentAction,
    timestamp: Date.now()
  };

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
    updateConnectionStatus('disconnected', 'ERROR');
  });
}

function logTransmission(payload, statusText) {
  const msg = `>> tx_data(x=${payload.x.toFixed(1).padStart(5, ' ')}, y=${payload.y.toFixed(1).padStart(5, ' ')}, theta=${String(payload.rotation).padStart(3, ' ')}°, action=${payload.action}) [${statusText}]`;
  
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
if (telD) telD.textContent = '0.0';

// --- Main Loop: Physics & Rendering (60fps) ---
function mainLoop() {
  updatePhysics();
  render();
  requestAnimationFrame(mainLoop);
}

function updatePhysics() {
  const centerX = 2500;
  const centerY = 2500;
  const maxRadius = 2440; // Clamped slightly inside 2500 so marker icon remains fully inside the circle

  const currDx = state.x - centerX;
  const currDy = state.y - centerY;
  const currDist = Math.hypot(currDx, currDy);

  // 1. Position Input Forces
  let ax = 0;
  let ay = 0;
  
  if (keys.ArrowUp) ay += settings.acceleration;  // Up increases Y
  if (keys.ArrowDown) ay -= settings.acceleration; // Down decreases Y
  if (keys.ArrowLeft) ax -= settings.acceleration; // Left decreases X
  if (keys.ArrowRight) ax += settings.acceleration; // Right increases X

  // If currently at or beyond boundary, check if input force/velocity moves outward or along wall
  if (currDist >= maxRadius) {
    const nextVx = (state.vx + ax) * settings.friction;
    const nextVy = (state.vy + ay) * settings.friction;
    const nextDist = Math.hypot((state.x + nextVx) - centerX, (state.y + nextVy) - centerY);

    // If movement pushes outward or along the boundary wall (distance does not decrease), block it!
    if (nextDist >= currDist) {
      ax = 0;
      ay = 0;
      state.vx = 0;
      state.vy = 0;
    }
  }

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
  state.y += state.vy; 

  // Constrain coordinates to circular map boundary centered at (2500, 2500)
  const dx = state.x - centerX;
  const dy = state.y - centerY;
  const dist = Math.hypot(dx, dy);

  if (dist > maxRadius) {
    state.x = centerX + (dx / dist) * maxRadius;
    state.y = centerY + (dy / dist) * maxRadius;
    state.vx = 0;
    state.vy = 0;
  }

  // Update angle (keep within 0-360)
  state.rotation = (state.rotation + state.vRotation + 360) % 360;

  // Determine active action pattern code
  state.action = determineActionCode();

  // 5. Update Telemetry UI
  const distFromCenter = Math.hypot(state.x - 2500, state.y - 2500);
  telX.textContent = state.x.toFixed(1);
  telY.textContent = state.y.toFixed(1);
  telR.textContent = `${Math.round(state.rotation)}°`;
  if (telD) telD.textContent = distFromCenter.toFixed(1);

  if (telA) {
    const actionLabels = {
      1: '1 (Circling >= 1.2 turns)',
      2: '2 (Spinning in Place)',
      3: '3 (Default)',
      5: '5 (Border Push >= 1.5s)',
      6: '6 (Near Top 2500, 5000)',
    };
    telA.textContent = actionLabels[state.action] !== undefined ? actionLabels[state.action] : `${state.action}`;
  }
}

function render() {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const mapRadius = width / 2;

  // 1. Draw Outer Square Frame Background & Grid
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // Outer Grid Lines (Square Coordinate System 0..5000)
  ctx.strokeStyle = '#e6e6e6';
  ctx.lineWidth = 1;
  for (let gx = 1000; gx < 5000; gx += 1000) {
    const x = (gx / 5000) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let gy = 1000; gy < 5000; gy += 1000) {
    const y = (gy / 5000) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Outer Square Boundary Box (Borders wrapping the circle)
  ctx.strokeStyle = '#a0a0a0';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(0, 0, width, height);

  // 2. Draw Inscribed Circular Map Area
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
  ctx.clip();

  // Circular Map White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Inner Circular Grid Lines
  ctx.strokeStyle = '#eeeeee';
  ctx.lineWidth = 1;
  for (let gx = 1000; gx < 5000; gx += 1000) {
    const x = (gx / 5000) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let gy = 1000; gy < 5000; gy += 1000) {
    const y = (gy / 5000) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw Center-Based Distance Reference Circles (Dotted Polar Grid centered at screen center 2500, 2500)
  ctx.strokeStyle = '#c7c7c7';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 4]); // Dotted circles
  ctx.fillStyle = '#888888';
  ctx.font = '10px "Fira Code", monospace';
  
  for (let r = 500; r <= 2500; r += 500) {
    const radius = (r / 5000) * width;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw distance level text label on each circle
    if (r < 2500) {
      ctx.fillText(`${r}`, centerX + 4, centerY - radius + 11);
    }
  }
  ctx.setLineDash([]); // Reset dash

  // Draw Center Crosshair / Point (2500, 2500)
  ctx.strokeStyle = 'rgba(0, 114, 189, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 6, centerY);
  ctx.lineTo(centerX + 6, centerY);
  ctx.moveTo(centerX, centerY - 6);
  ctx.lineTo(centerX, centerY + 6);
  ctx.stroke();
  ctx.fillStyle = '#0072bd';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Inscribed Circular Map Outer Ring Border
  ctx.strokeStyle = '#0072bd'; // Accent Blue Ring
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, mapRadius - 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // Translate coordinates from state [0..5000] to screen pixels (Y is inverted: 0 is bottom, height is top)
  const screenX = (state.x / settings.canvasRangeX) * width;
  const screenY = height - (state.y / settings.canvasRangeY) * height;

  // Draw target dot connection line from SCREEN CENTER (centerX, centerY) (MATLAB Orange dashed line)
  ctx.strokeStyle = 'rgba(217, 83, 25, 0.75)'; // MATLAB Orange
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(screenX, screenY);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Draw distance label on the midpoint of the line if target is not at center
  const distFromCenter = Math.hypot(state.x - 2500, state.y - 2500);
  if (distFromCenter > 80) {
    const midX = (centerX + screenX) / 2;
    const midY = (centerY + screenY) / 2;
    ctx.fillStyle = '#d95319';
    ctx.font = '500 10px "Fira Code", monospace';
    ctx.fillText(`d=${distFromCenter.toFixed(0)}`, midX + 6, midY - 4);
  }

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

  // Restore clip context
  ctx.restore();
}

// Start everything
addressInput.value = "https://position-api-generator.onrender.com/api/state";
apiEndpoint = addressInput.value;

setupConnection();
requestAnimationFrame(mainLoop);
logTerminal('success', 'Dot visualizer engine started.');
