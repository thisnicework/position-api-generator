// --- DOM Elements ---
const canvas = document.getElementById('control-canvas');
const ctx = canvas.getContext('2d');
const glCanvas = document.getElementById('gl-canvas');
let gl = null;
let glProgram = null;
let glUniforms = {};

function initWebGLShader() {
  if (!glCanvas) return;
  gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn("WebGL not supported on this browser.");
    return;
  }

  const vsSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2 u_resolution;
    uniform vec2 u_cursor;
    uniform float u_time;
    uniform float u_rotation;
    uniform float u_action;

    vec3 palette( in float t ) {
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.263, 0.416, 0.557);
      return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
      // Pure Pitch Void Black Canvas (#000000) for Modern Fine Art Aesthetics
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
  `;



  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    gl = null;
    glProgram = null;
    return;
  }


  glProgram = gl.createProgram();
  gl.attachShader(glProgram, vs);
  gl.attachShader(glProgram, fs);
  gl.linkProgram(glProgram);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1,
  ]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(glProgram, "a_position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  glUniforms.resolution = gl.getUniformLocation(glProgram, "u_resolution");
  glUniforms.cursor = gl.getUniformLocation(glProgram, "u_cursor");
  glUniforms.time = gl.getUniformLocation(glProgram, "u_time");
  glUniforms.rotation = gl.getUniformLocation(glProgram, "u_rotation");
  glUniforms.action = gl.getUniformLocation(glProgram, "u_action");
}

function renderShader(normCursorX, normCursorY) {
  if (!gl || !glProgram) return;

  const w = canvas.width;
  const h = canvas.height;
  if (glCanvas.width !== w || glCanvas.height !== h) {
    glCanvas.width = w;
    glCanvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  gl.useProgram(glProgram);

  gl.uniform2f(glUniforms.resolution, w, h);
  gl.uniform2f(glUniforms.cursor, normCursorX, normCursorY);
  gl.uniform1f(glUniforms.time, performance.now() / 1000.0);
  gl.uniform1f(glUniforms.rotation, state.rotation);
  gl.uniform1f(glUniforms.action, state.action);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

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

// Serial Input DOM Elements
const serialBadge = document.getElementById('serial-badge');
const serialModeSelect = document.getElementById('serial-mode');
const webserialControls = document.getElementById('webserial-controls');
const serialBaudSelect = document.getElementById('serial-baud');
const webserialConnectBtn = document.getElementById('webserial-connect-btn');
const webserialDisconnectBtn = document.getElementById('webserial-disconnect-btn');

const nodeserialControls = document.getElementById('nodeserial-controls');
const refreshPortsBtn = document.getElementById('refresh-ports-btn');
const nodePortSelect = document.getElementById('node-port-select');
const nodeSerialBaudSelect = document.getElementById('node-serial-baud');
const nodeConnectBtn = document.getElementById('node-connect-btn');
const nodeDisconnectBtn = document.getElementById('node-disconnect-btn');

const serialControlTypeSelect = document.getElementById('serial-control-type');
const serialOrderSelect = document.getElementById('serial-order');
const serialInvertXCheckbox = document.getElementById('serial-invert-x');
const serialInvertYCheckbox = document.getElementById('serial-invert-y');
const serialInvertRotCheckbox = document.getElementById('serial-invert-rot');
const serialAnalogMapCheckbox = document.getElementById('serial-analog-map');
const serialRawValSpan = document.getElementById('serial-raw-val');




const calibMinXInput = document.getElementById('calib-min-x');
const calibXInput = document.getElementById('calib-x');
const calibMaxXInput = document.getElementById('calib-max-x');

const calibMinYInput = document.getElementById('calib-min-y');
const calibYInput = document.getElementById('calib-y');
const calibMaxYInput = document.getElementById('calib-max-y');

const calibMinRotInput = document.getElementById('calib-min-rot');
const calibRotInput = document.getElementById('calib-rot');
const calibMaxRotInput = document.getElementById('calib-max-rot');



const calibStatusTag = document.getElementById('calib-status-tag');
const start3sCalibBtn = document.getElementById('start-3s-calib-btn');
const quickCalibBtn = document.getElementById('quick-calib-btn');
const calibProgressContainer = document.getElementById('calib-progress-container');
const calibProgressBar = document.getElementById('calib-progress-bar');
const calibProgressText = document.getElementById('calib-progress-text');

let lastRawSerialValues = { x: 508, y: 179, rot: 10 };
let isCalibrating = false;
let calibSamples = [];
let calibStartTime = 0;
const CALIB_DURATION = 5000;

// --- Sensor Smoothing Filter (Moving Average Ring Buffer) ---
const SMOOTHING_SIZE = 5;  // 5-sample moving average window
const sensorHistory = {
  x: [],
  y: [],
  rot: []
};

function pushSensorSample(axis, value) {
  sensorHistory[axis].push(value);
  if (sensorHistory[axis].length > SMOOTHING_SIZE) {
    sensorHistory[axis].shift();
  }
}

function getSmoothedValue(axis) {
  const arr = sensorHistory[axis];
  if (arr.length === 0) return 0;
  // Median filter for spike rejection, then average the middle values
  const sorted = [...arr].sort((a, b) => a - b);
  // Remove the single highest and lowest outliers if we have enough samples
  if (sorted.length >= 5) {
    const trimmed = sorted.slice(1, sorted.length - 1);
    return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
  }
  return sorted[Math.floor(sorted.length / 2)];
}

// Helper to calculate circular / 360-degree angle difference in [-180, +180] range
function getCircularDiff(val, center) {
  let diff = val - center;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function getSmoothedRotation(centerRot = 10) {
  const arr = sensorHistory.rot;
  if (arr.length === 0) return centerRot;
  if (arr.length === 1) return arr[0];

  // Unwrap circular difference relative to centerRot to avoid sine/cosine non-linear distortion
  const unwrapped = arr.map(val => centerRot + getCircularDiff(val, centerRot));
  const sorted = [...unwrapped].sort((a, b) => a - b);
  
  if (sorted.length >= 5) {
    const trimmed = sorted.slice(1, sorted.length - 1);
    const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
    return ((avg % 360) + 360) % 360;
  }
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return ((avg % 360) + 360) % 360;
}













// --- Rainbow Afterimage Trails & macOS Pinwheel Spin State ---
const rainbowTrails = [];
let pinwheelSpinAngle = 0;

// --- Physics State & Variables ---
const state = {
  x: 2500,       // Start in the center of the 0..5000 grid
  y: 2500,       // Start in the center of the 0..5000 grid
  vx: 0,         // Velocity X
  vy: 0,         // Velocity Y
  rotation: 0,   // Angle in degrees (0 - 360)
  vRotation: 0,  // Rotational velocity (deg/frame)
  action: 4,     // Action mode state code (default: 4)

};


const settings = {
  maxSpeed: 120.0,         // Controlled & smooth movement speed (0..5000 map)
  acceleration: 14.0,      // Smooth acceleration
  friction: 0.88,          // Natural deceleration
  rotationSpeed: 3.0,      // Smooth keyboard rotation speed
  maxRotationSpeed: 5.0,   // Controlled max rotation speed
  rotationFriction: 0.85,  // Natural rotation deceleration
  canvasRangeX: 5000,       // Coordinate mapping width (0..5000)
  canvasRangeY: 5000,       // Coordinate mapping height (0..5000)
};







// --- Keyboard State ---
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false, W: false,
  a: false, A: false,
  s: false, S: false,
  d: false, D: false,
  q: false, Q: false,
  e: false, E: false,
  Space: false,
};


// --- Networking State ---
function getDefaultEndpoint() {
  const origin = window.location.origin;
  if (!origin || origin.includes('file://') || (window.location.port && window.location.port !== '5005')) {
    return 'http://localhost:5005/api/state';
  }
  return `${origin}/api/state`;
}

let apiEndpoint = getDefaultEndpoint();
let transmitInterval = 1500; // 1500ms (1.5s) default transmission interval gap


let transmitIntervalId = null;
let connectionState = 'disconnected'; // 'disconnected', 'connecting', 'connected'

// Track last sent state to only send when values change
let lastTransmittedState = { x: null, y: null, rotation: null, action: null };

// --- Action Pattern Classifier State ---
const actionTracker = {
  borderMoveStartTime: null,
  cornerDwellStartTime: null, // Start timestamp for dwelling in 4 screen corners for Code 7
  trajectoryHistory: [], // Array of { x, y, time } for Closed Shape (닫힌 도형) loop detection
  closedShapeUntil: 0,   // Hysteresis timestamp for smooth active state
  straightMoveAccumulator: 0, // Accumulated straight linear distance along X or Y
  straightMoveUntil: 0,       // Active window for Code 4 trigger when straight movement accumulates
  lastYDir: 0,                // Last recorded Y-axis velocity sign (-1, 0, 1)
  yReversalTimes: [],         // Timestamps of Y-axis direction reversals
  yOscillationUntil: 0,       // Active window for Code 0 trigger (Y-oscillation 4x)
};




// --- 7 Monitors (0~6) Action FIFO Shift Queue State ---
// Monitor 0 to 6 queue holding full snapshots { x, y, rotation, action, timestamp } (Length 7)
let monitorQueue = [null, null, null, null, null, null, null];
let monitorShiftIntervalMs = 1500; // 1.5s sampling interval gap
let monitorShiftTimerId = null;

const monitorsQueueContainer = document.getElementById('monitors-queue-container');

function updateMonitorsUI() {
  if (!monitorsQueueContainer) return;
  monitorsQueueContainer.innerHTML = '';
  
  for (let i = 0; i < 7; i++) {
    const item = monitorQueue[i];
    const badge = document.createElement('div');
    badge.style.padding = '3px 2px';
    badge.style.borderRadius = '4px';
    badge.style.fontWeight = 'bold';
    badge.style.transition = 'all 0.2s ease';
    
    if (!item) {
      badge.style.background = 'rgba(255, 255, 255, 0.05)';
      badge.style.color = '#64748b';
      badge.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      badge.innerHTML = `<span style="font-size: 8px; color: #475569; display: block;">M${i}</span>Null`;
    } else {
      badge.style.background = 'rgba(56, 189, 248, 0.18)';
      badge.style.color = '#38bdf8';
      badge.style.border = '1px solid rgba(56, 189, 248, 0.5)';
      badge.style.boxShadow = '0 0 8px rgba(56, 189, 248, 0.2)';
      badge.innerHTML = `
        <span style="font-size: 8px; color: #7dd3fc; display: block;">M${i}</span>
        <div style="font-size: 11px; font-weight: 800; color: #38bdf8;">A:${item.action}</div>
        <div style="font-size: 7px; color: #94a3b8; font-weight: normal; margin-top: 1px;">(${item.x.toFixed(0)},${item.y.toFixed(0)})</div>
        <div style="font-size: 7px; color: #94a3b8; font-weight: normal;">${item.rotation}°</div>
      `;
    }
    monitorsQueueContainer.appendChild(badge);
  }
}

function startMonitorShiftTimer() {
  if (monitorShiftTimerId) clearInterval(monitorShiftTimerId);
  
  updateMonitorsUI();
  
  // Every 1.5s (1500ms), sample current active snapshot (x, y, rotation, action), unshift to M0, and shift existing right
  monitorShiftTimerId = setInterval(() => {
    const currentTrigger = state.action !== undefined ? state.action : 4;
    const snapshot = {
      x: parseFloat(state.x.toFixed(1)),
      y: parseFloat(state.y.toFixed(1)),
      rotation: Math.round(state.rotation),
      action: currentTrigger,
      timestamp: Date.now()
    };

    monitorQueue.unshift(snapshot);
    if (monitorQueue.length > 7) {
      monitorQueue.pop();
    }
    updateMonitorsUI();
    transmitState();
  }, monitorShiftIntervalMs);
}





startMonitorShiftTimer();


function updateTrajectory(now) {
  const history = actionTracker.trajectoryHistory;
  const last = history[history.length - 1];
  
  // Record position point if moved at least 6 units from last recorded point
  if (!last || Math.hypot(state.x - last.x, state.y - last.y) >= 6) {
    history.push({ x: state.x, y: state.y, time: now });
  }

  // Keep trajectory history strictly within past 5 seconds (5000 ms)
  const cutoff = now - 5000;
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

  // Search backward in past 5 seconds trajectory history for loop closure (닫힌 루프)
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
    // Strictly evaluate points visited within the past 5 seconds (1.0s <= timeDiff <= 5.0s)
    if (timeDiff >= 1000 && timeDiff <= 5000) {
      const distanceToCurrent = Math.hypot(current.x - pt.x, current.y - pt.y);
      const bboxWidth = maxX - minX;
      const bboxHeight = maxY - minY;

      // Closed Shape (닫힌 도형) Loop Closure Criteria (Past 5s):
      // 1. Current position returns near a point visited within the past 5 seconds (distance <= 480)
      // 2. Traveled path length along trajectory between them is at least 1100 units
      // 3. 2D Bounding box of the shape has width and height >= 240 (ensures 2D enclosed shape)
      if (distanceToCurrent <= 480 && pathLength >= 1100 && bboxWidth >= 240 && bboxHeight >= 240) {
        return true;
      }
    }
  }

  return false;
}

// --- Manual Trigger Override State ---
let manualActionOverride = null; // null = Auto algorithm detection, number = forced trigger code

function setManualTrigger(code) {
  const manualTriggerSelect = document.getElementById('manual-trigger-select');
  const customTriggerContainer = document.getElementById('custom-trigger-container');

  if (code === 'auto' || code === null || code === undefined) {
    manualActionOverride = null;
    if (manualTriggerSelect) manualTriggerSelect.value = 'auto';
    if (customTriggerContainer) customTriggerContainer.style.display = 'none';
    logTerminal('system', `⚙️ Trigger Mode set to: AUTO (알고리즘 자동 감지)`);
  } else {
    const num = parseInt(code, 10);
    if (!isNaN(num)) {
      manualActionOverride = num;
      lastActiveTrigger = num;
      state.action = num;
      logTerminal('success', `🎯 Manual Trigger Override set to: Code ${num}`);
    }
  }
  updateQuickTriggerBtnsUI();
}

function updateQuickTriggerBtnsUI() {
  const btns = document.querySelectorAll('.quick-trigger-btn');
  btns.forEach(btn => {
    const code = btn.getAttribute('data-code');
    if ((code === 'auto' && manualActionOverride === null) || (parseInt(code, 10) === manualActionOverride)) {
      btn.style.background = 'rgba(56, 189, 248, 0.4)';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#38bdf8';
      btn.style.fontWeight = 'bold';
      btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.4)';
    } else {
      btn.style.background = 'rgba(15, 23, 42, 0.6)';
      btn.style.color = '#94a3b8';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      btn.style.fontWeight = 'normal';
      btn.style.boxShadow = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const manualTriggerSelect = document.getElementById('manual-trigger-select');
  const customTriggerContainer = document.getElementById('custom-trigger-container');
  const customTriggerInput = document.getElementById('custom-trigger-input');
  const applyCustomTriggerBtn = document.getElementById('apply-custom-trigger-btn');

  if (manualTriggerSelect) {
    manualTriggerSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        if (customTriggerContainer) customTriggerContainer.style.display = 'block';
      } else {
        if (customTriggerContainer) customTriggerContainer.style.display = 'none';
        setManualTrigger(val);
      }
    });
  }

  if (applyCustomTriggerBtn) {
    applyCustomTriggerBtn.addEventListener('click', () => {
      if (customTriggerInput) {
        const val = customTriggerInput.value;
        setManualTrigger(val);
      }
    });
  }
});

// Event Delegation for Quick Trigger Buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.quick-trigger-btn');
  if (btn) {
    const code = btn.getAttribute('data-code');
    setManualTrigger(code);
    const manualTriggerSelect = document.getElementById('manual-trigger-select');
    const customTriggerContainer = document.getElementById('custom-trigger-container');
    const customTriggerInput = document.getElementById('custom-trigger-input');

    if (manualTriggerSelect) {
      if (code === 'auto') manualTriggerSelect.value = 'auto';
      else if (['1','2','3','4','6','7'].includes(code)) manualTriggerSelect.value = code;
      else {
        manualTriggerSelect.value = 'custom';
        if (customTriggerContainer) customTriggerContainer.style.display = 'block';
        if (customTriggerInput) customTriggerInput.value = code;
      }
    }
  }
});


let lastActiveTrigger = 4; // Remembers last triggered action code (defaults to 4)

function determineActionCode() {
  // If manual override is active, strictly return forced trigger code!
  if (manualActionOverride !== null) {
    lastActiveTrigger = manualActionOverride;
    return manualActionOverride;
  }

  const now = Date.now();
  const linearSpeed = Math.hypot(state.vx, state.vy);
  const rotSpeed = Math.abs(state.vRotation);
  const distFromCenter = Math.hypot(state.x - 2500, state.y - 2500);
  const distToTop = Math.hypot(state.x - 2500, state.y - 5000);

  // Update trajectory points (always, regardless of which trigger fires)
  updateTrajectory(now);

  // ─────────────────────────────────────────────────────────
  // PHASE 1: Accumulate/update ALL detector states independently
  //          (No early returns here — every detector gets updated)
  // ─────────────────────────────────────────────────────────

  // ▸ Detector A: Y-Axis Pure Oscillation (Code 0)
  const isXStationary = Math.abs(state.vx) < 1.5;
  const currentYDir = Math.abs(state.vy) >= 0.8 ? Math.sign(state.vy) : 0;

  if (currentYDir !== 0 && actionTracker.lastYDir !== 0 && currentYDir !== actionTracker.lastYDir) {
    if (isXStationary) {
      actionTracker.yReversalTimes.push(now);
    }
  }
  if (currentYDir !== 0) {
    actionTracker.lastYDir = currentYDir;
  }

  while (actionTracker.yReversalTimes.length > 0 && actionTracker.yReversalTimes[0] < now - 2500) {
    actionTracker.yReversalTimes.shift();
  }

  const recentHistory = actionTracker.trajectoryHistory.filter(pt => now - pt.time <= 2500);
  let recentMinX = state.x, recentMaxX = state.x;
  let recentMinY = state.y, recentMaxY = state.y;
  recentHistory.forEach(pt => {
    recentMinX = Math.min(recentMinX, pt.x);
    recentMaxX = Math.max(recentMaxX, pt.x);
    recentMinY = Math.min(recentMinY, pt.y);
    recentMaxY = Math.max(recentMaxY, pt.y);
  });
  const recentXSpan = recentMaxX - recentMinX;
  const recentYSpan = recentMaxY - recentMinY;

  if (actionTracker.yReversalTimes.length >= 4 && recentXSpan <= 120 && recentYSpan >= 60) {
    actionTracker.yOscillationUntil = now + 1500;
    actionTracker.yReversalTimes = [];
  }

  // ▸ Detector B: Straight Linear Movement (Code 4)
  const isStraightMove = linearSpeed >= 0.8 && rotSpeed < 0.4;
  if (isStraightMove) {
    actionTracker.straightMoveAccumulator += linearSpeed;
    if (actionTracker.straightMoveAccumulator >= 120) {
      actionTracker.straightMoveUntil = now + 1500;
      actionTracker.straightMoveAccumulator = 0;
    }
  } else if (linearSpeed < 0.2) {
    actionTracker.straightMoveAccumulator = Math.max(0, actionTracker.straightMoveAccumulator - 2.0);
  } else {
    actionTracker.straightMoveAccumulator = Math.max(0, actionTracker.straightMoveAccumulator - 1.0);
  }

  // ▸ Detector C: Closed Shape / Circle Loop (Code 1)
  const isClosedShapeNow = checkClosedShape(now);
  if (isClosedShapeNow) {
    actionTracker.closedShapeUntil = now + 1500;
  }

  // ▸ Detector D: Full Screen Outer Border Outward Push Movement (Code 6)
  const nearLeft = state.x <= 500 && state.vx < -0.2;
  const nearRight = state.x >= 4500 && state.vx > 0.2;
  const nearBottom = state.y <= 500 && state.vy < -0.2;
  const nearTop = state.y >= 4500 && state.vy > 0.2;
  const nx = distFromCenter > 0 ? (state.x - 2500) / distFromCenter : 0;
  const ny = distFromCenter > 0 ? (state.y - 2500) / distFromCenter : 0;
  const outwardVel = state.vx * nx + state.vy * ny;
  const nearOuterRadial = distFromCenter >= 2000 && outwardVel > 0.2;

  const isPushingOutsideBorder = nearLeft || nearRight || nearBottom || nearTop || nearOuterRadial;

  if (isPushingOutsideBorder) {
    actionTracker.lastBorderPauseTime = null;
    if (!actionTracker.borderMoveStartTime) {
      actionTracker.borderMoveStartTime = now;
    }
  } else {
    if (!actionTracker.lastBorderPauseTime) {
      actionTracker.lastBorderPauseTime = now;
    } else if (now - actionTracker.lastBorderPauseTime > 300) {
      actionTracker.borderMoveStartTime = null;
      actionTracker.borderMoveStartTime = null;
    }
  }


  // ▸ Detector E: 4 Screen Corners Dwelling Proximity (Code 7)
  const distTL = Math.hypot(state.x - 0, state.y - 5000);
  const distTR = Math.hypot(state.x - 5000, state.y - 5000);
  const distBL = Math.hypot(state.x - 0, state.y - 0);
  const distBR = Math.hypot(state.x - 5000, state.y - 0);
  const minCornerDist = Math.min(distTL, distTR, distBL, distBR);
  const isAtAnyCorner = minCornerDist <= 550;

  if (isAtAnyCorner) {
    if (!actionTracker.cornerDwellStartTime) {
      actionTracker.cornerDwellStartTime = now;
    }
  } else {
    actionTracker.cornerDwellStartTime = null;
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 2: Evaluate triggers by SPECIFICITY (most specific first)
  //          Each has EXCLUSIVE geometric criteria — no overlaps
  // ─────────────────────────────────────────────────────────

  // ▶ Code 0: Pure Y-axis pendulum (X span ≤ 150, distinct from circle's ≥ 240)
  if (now < actionTracker.yOscillationUntil && recentXSpan <= 150) {
    lastActiveTrigger = 0;
    return 0;
  }

  // ▶ Code 7: Staying near any of the 4 screen corners for 600ms+
  if (actionTracker.cornerDwellStartTime && (now - actionTracker.cornerDwellStartTime >= 600)) {
    lastActiveTrigger = 7;
    return 7;
  }


  // ▶ Code 6: Border radial movement (distFromCenter ≥ 1400, sustained 800ms+)
  if (actionTracker.borderMoveStartTime && (now - actionTracker.borderMoveStartTime >= 800)) {
    lastActiveTrigger = 6;
    return 6;
  }

  // ▶ Code 1: Closed shape / circle (loop bbox ≥ 240×240, pathLen ≥ 1100)
  if (now < actionTracker.closedShapeUntil) {
    lastActiveTrigger = 1;
    return 1;
  }

  // ▶ Code 3: Fast rotation (rotSpeed ≥ 1.2)
  const isRotating = keys.q || keys.Q || keys.e || keys.E || rotSpeed >= 0.15;
  if (isRotating && rotSpeed >= 1.2) {
    lastActiveTrigger = 3;
    return 3;
  }

  // ▶ Code 2: Slow rotation (0.15 ≤ rotSpeed < 1.2)
  if (isRotating && rotSpeed >= 0.15 && rotSpeed < 1.2) {
    lastActiveTrigger = 2;
    return 2;
  }

  // ▶ Code 4: Sustained straight linear movement
  if (now < actionTracker.straightMoveUntil) {
    lastActiveTrigger = 4;
    return 4;
  }

  // ▶ Idle: no active trigger — hold last known trigger
  return lastActiveTrigger;
}



// --- Control Panel Show/Hide Toggle Logic ---
const appContainerEl = document.querySelector('.app-container');
const mainGridEl = document.querySelector('.main-grid');
const controlPanelEl = document.querySelector('.control-panel');
const toggleMenuHint = document.getElementById('toggle-menu-hint');

function toggleControlPanel() {
  if (appContainerEl) {
    appContainerEl.classList.toggle('screensaver-mode');
  }
  if (controlPanelEl) {
    controlPanelEl.classList.toggle('hidden-panel');
  }
  if (mainGridEl) {
    mainGridEl.classList.toggle('hide-controls');
  }
  const isHidden = mainGridEl ? mainGridEl.classList.contains('hide-controls') : false;
  if (toggleMenuHint) {
    toggleMenuHint.textContent = isHidden ? "⌨️ Press 'S' to Show Menu" : "⌨️ Press 'S' to Hide Menu";
  }
  // Recalculate canvas size dynamically
  setTimeout(() => {
    resizeCanvas();
  }, 50);
}



if (toggleMenuHint) {
  toggleMenuHint.addEventListener('click', toggleControlPanel);
}

// --- Initialize Event Listeners ---
window.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');

  if (isTyping) return;

  if (e.code === 'KeyS' && !e.repeat) {
    toggleControlPanel();
  }

  // Map Physical Keyboard Codes & Keys (Works seamlessly with Korean IME & all OS layouts)
  const codeMap = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
    KeyQ: 'q', KeyE: 'e', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Space: 'Space'
  };

  const targetKey = codeMap[e.code] || (e.key === ' ' ? 'Space' : e.key);
  if (targetKey in keys) {
    keys[targetKey] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const codeMap = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
    KeyQ: 'q', KeyE: 'e', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Space: 'Space'
  };

  const targetKey = codeMap[e.code] || (e.key === ' ' ? 'Space' : e.key);
  if (targetKey in keys) {
    keys[targetKey] = false;
  }
});





intervalSlider.addEventListener('input', (e) => {
  transmitInterval = parseInt(e.target.value, 10);
  const sec = (transmitInterval / 1000).toFixed(1);
  intervalVal.textContent = `${transmitInterval} ms (${sec}s)`;
  if (connectionState === 'connected') {
    clearInterval(transmitIntervalId);
    startTransmissionLoop();
  }
});


const monitorDelaySlider = document.getElementById('monitor-delay');
const monitorDelayVal = document.getElementById('monitor-delay-val');
let monitorDelayMs = 500;

if (monitorDelaySlider && monitorDelayVal) {
  monitorDelaySlider.addEventListener('input', (e) => {
    monitorDelayMs = parseInt(e.target.value, 10);
    const sec = (monitorDelayMs / 1000).toFixed(1);
    monitorDelayVal.textContent = `${monitorDelayMs} ms (${sec}s)`;
  });
}

const joystickSpeedSlider = document.getElementById('joystick-speed-slider');
const speedSliderValSpan = document.getElementById('speed-slider-val');

if (joystickSpeedSlider && speedSliderValSpan) {
  joystickSpeedSlider.addEventListener('input', (e) => {
    const mult = parseFloat(e.target.value) || 0.8;
    speedSliderValSpan.textContent = `${mult.toFixed(1)}x`;
  });
}


const joystickDeadzoneSlider = document.getElementById('joystick-deadzone-slider');
const deadzoneSliderValSpan = document.getElementById('deadzone-slider-val');

if (joystickDeadzoneSlider && deadzoneSliderValSpan) {
  joystickDeadzoneSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10) || 16;
    deadzoneSliderValSpan.textContent = `${val}%`;
  });
}


// Smooth Joystick Deadzone Filter with linear re-scaling (0..1)
function applyDeadzone(val, dz) {
  if (Math.abs(val) <= dz) return 0;
  const sign = Math.sign(val);
  return sign * ((Math.abs(val) - dz) / (1.0 - dz));
}




clearTerminalBtn.addEventListener('click', () => {
  terminalBody.innerHTML = '';
});

connectBtn.addEventListener('click', () => {
  setupConnection();
});

clearTerminalBtn.addEventListener('click', () => {
  terminalBody.innerHTML = '';
});

// --- Serial Communication State ---
let serialPort = null;
let serialReader = null;
let keepReadingSerial = false;
let nodeSerialStatusInterval = null;

// --- Serial Data Parser ---
function parseSerialString(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  let x = null, y = null, rotation = null, action = null;

  // 1. JSON Format: {"x":2500, "y":2500, "rotation":90}
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
    } catch (e) {}
  }

  // 2. Tagged Format: X:2500 Y:2500 R:90 or X=2500, Y=2500, R=90
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

  // 3. CSV Format: 508, 10, 179 or 2500, 2500, 90
  if (x === null || y === null || rotation === null) {
    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 3) {
      const v1 = parseFloat(parts[0]);
      const v2 = parseFloat(parts[1]);
      const v3 = parseFloat(parts[2]);
      if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
        const order = serialOrderSelect ? serialOrderSelect.value : 'yrx';
        if (order === 'yrx') {
          // Y, Rotation, X (1:Y, 2:Rotation, 3:X) -> X and Y Swapped!
          y = v1;
          rotation = v2;
          x = v3;
        } else if (order === 'xry') {
          // X, Rotation, Y (1:X, 2:Rotation, 3:Y)
          x = v1;
          rotation = v2;
          y = v3;
        } else if (order === 'yxr') {
          // Y, X, Rotation (1:Y, 2:X, 3:Rotation)
          y = v1;
          x = v2;
          rotation = v3;
        } else {
          // X, Y, Rotation (1:X, 2:Y, 3:Rotation)
          x = v1;
          y = v2;
          rotation = v3;
        }
        if (parts.length >= 4 && !isNaN(parseInt(parts[3]))) {
          action = parseInt(parts[3], 10);
        }
      }
    }
  }



  if (x !== null && y !== null && rotation !== null) {
    // Optional Analog ADC (0~1023) mapping
    if (serialAnalogMapCheckbox && serialAnalogMapCheckbox.checked) {
      if (x <= 1023 && y <= 1023) {
        x = (x / 1023) * 5000;
        y = (y / 1023) * 5000;
      }
      if (rotation <= 1023 && rotation > 360) {
        rotation = (rotation / 1023) * 360;
      }
    }

    x = Math.max(0, Math.min(5000, x));
    y = Math.max(0, Math.min(5000, y));
    rotation = ((rotation % 360) + 360) % 360;

    return { x, y, rotation, action };
  }

  return null;
}

// Helper to calculate circular / 360-degree angle difference in [-180, +180] range
function getCircularDiff(val, center) {
  let diff = val - center;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}


function processIncomingSerialLine(line) {
  const parsed = parseSerialString(line);
  if (!parsed) return;

  // Save last raw parsed values for auto-calibration button
  lastRawSerialValues = { x: parsed.x, y: parsed.y, rot: parsed.rotation };

  // Collect 3-sec calibration sample if active
  if (isCalibrating) {
    const now = Date.now();
    calibSamples.push({ x: parsed.x, y: parsed.y, rot: parsed.rotation });
    const elapsed = now - calibStartTime;
    const progress = Math.min(100, Math.round((elapsed / CALIB_DURATION) * 100));

    if (calibProgressBar) calibProgressBar.style.width = `${progress}%`;
    if (calibProgressText) calibProgressText.textContent = `Collecting zero-point samples (${progress}%)...`;

    if (elapsed >= CALIB_DURATION) {
      finish3sCalibration();
    }
  }

  const mode = serialControlTypeSelect ? serialControlTypeSelect.value : 'joystick';

  if (mode === 'joystick') {
    // 🎮 Joystick Game Movement Mode

    // --- Step 1: Push raw sensor values into smoothing filter ---
    pushSensorSample('x', parsed.x);
    pushSensorSample('y', parsed.y);
    pushSensorSample('rot', parsed.rotation);

    // Read Min, Center, Max baseline values from inputs
    const minX = calibMinXInput ? (parseFloat(calibMinXInput.value) || 0) : 0;
    const centerX = calibXInput ? (parseFloat(calibXInput.value) || 508) : 508;
    const maxX = calibMaxXInput ? (parseFloat(calibMaxXInput.value) || 1023) : 1023;

    const minY = calibMinYInput ? (parseFloat(calibMinYInput.value) || 0) : 0;
    const centerY = calibYInput ? (parseFloat(calibYInput.value) || 179) : 179;
    const maxY = calibMaxYInput ? (parseFloat(calibMaxYInput.value) || 1023) : 1023;

    const minRotSpan = calibMinRotInput ? (parseFloat(calibMinRotInput.value) || 512) : 512;
    const centerRot = calibRotInput ? (parseFloat(calibRotInput.value) || 512) : 512;
    const maxRotSpan = calibMaxRotInput ? (parseFloat(calibMaxRotInput.value) || 512) : 512;

    // --- Step 2: Get smoothed (filtered) sensor values ---
    const smoothX = getSmoothedValue('x');
    const smoothY = getSmoothedValue('y');
    const smoothRot = getSmoothedRotation(centerRot);

    const invertX = serialInvertXCheckbox ? serialInvertXCheckbox.checked : false;
    const invertY = serialInvertYCheckbox ? serialInvertYCheckbox.checked : false;
    const invertRot = serialInvertRotCheckbox ? serialInvertRotCheckbox.checked : false;

    let normX = 0;
    let normY = 0;
    let normRot = 0;

    // --- Step 3: Normalize using SMOOTHED values (not raw) ---

    // X: Piecewise normalization (-1.0 ~ +1.0)
    const diffX = smoothX - centerX;
    if (diffX > 0) {
      normX = diffX / Math.max(5, maxX - centerX);
    } else {
      normX = diffX / Math.max(5, centerX - minX);
    }
    if (invertX) normX = -normX;

    // Y: Piecewise normalization (-1.0 ~ +1.0)
    const diffY = smoothY - centerY;
    if (diffY > 0) {
      normY = diffY / Math.max(5, maxY - centerY);
    } else {
      normY = diffY / Math.max(5, centerY - minY);
    }
    if (invertY) normY = -normY;

    // Rotation: Piecewise deflection normalization strictly using calibrated center and spans (-1.0 ~ +1.0)
    let diffRot = smoothRot - centerRot;

    if (invertRot) diffRot = -diffRot;

    if (diffRot > 0) {
      normRot = diffRot / Math.max(1, maxRotSpan);
    } else {
      normRot = diffRot / Math.max(1, minRotSpan);
    }








    // Clamp to [-1.0, +1.0]
    normX = Math.max(-1.0, Math.min(1.0, normX));
    normY = Math.max(-1.0, Math.min(1.0, normY));
    normRot = Math.max(-1.0, Math.min(1.0, normRot));

    // --- Step 4: Smooth Radial/Axial Deadzone Filter with linear re-scaling ---
    const dzPercent = joystickDeadzoneSlider ? (parseInt(joystickDeadzoneSlider.value, 10) || 16) : 16;
    const DEADZONE = dzPercent / 100.0;


    normX = applyDeadzone(normX, DEADZONE);
    normY = applyDeadzone(normY, DEADZONE);
    normRot = applyDeadzone(normRot, DEADZONE);


    // --- Step 5: LERP smoothing on velocity output (prevents any remaining spikes) ---
    const speedMult = joystickSpeedSlider ? (parseFloat(joystickSpeedSlider.value) || 0.8) : 0.8;
    const LERP = 0.4;  // Smooth blend factor (0=frozen, 1=instant)


    const targetVx = normX * (settings.maxSpeed * speedMult);
    const targetVy = normY * (settings.maxSpeed * speedMult);

    // Apply 1.6x power curve to rotation (ultra-gentle micro-touches near center, smooth acceleration at edges)
    const rotCurve = Math.sign(normRot) * Math.pow(Math.abs(normRot), 1.6);
    const targetVRot = rotCurve * (settings.maxRotationSpeed * (speedMult * 0.75));

    state.vx += (targetVx - state.vx) * LERP;
    state.vy += (targetVy - state.vy) * LERP;
    state.vRotation += (targetVRot - state.vRotation) * LERP;








    if (parsed.action !== null && parsed.action !== 4) {
      state.action = parsed.action;
    }


    if (serialRawValSpan) {
      serialRawValSpan.textContent = `RAW: ${parsed.x},${parsed.rotation},${parsed.y} | dX:${normX > 0 ? '+' : ''}${normX.toFixed(2)} dY:${normY > 0 ? '+' : ''}${normY.toFixed(2)} dRot:${normRot > 0 ? '+' : ''}${normRot.toFixed(2)}`;
    }

    logSerialJoystickRX(normX, normY, normRot);
  } else {
    // 📍 Absolute Position Mode (절대 위치 좌표)
    state.x = parsed.x;
    state.y = parsed.y;
    state.rotation = parsed.rotation;
    state.vx = 0;
    state.vy = 0;
    state.vRotation = 0;
    if (parsed.action !== null && parsed.action !== 4) {
      state.action = parsed.action;
    }


    if (serialRawValSpan) {
      serialRawValSpan.textContent = `RAW: X:${parsed.x.toFixed(1)} Y:${parsed.y.toFixed(1)} R:${parsed.rotation.toFixed(0)}°`;
    }

    logSerialRX(parsed);
  }
}

function logSerialJoystickRX(normX, normY, normRot) {
  const line = document.createElement('div');
  line.className = 'log-line serial-log';
  line.textContent = `>> joystick_game: (dX:${normX >= 0 ? '+' : ''}${normX.toFixed(2)}, dY:${normY >= 0 ? '+' : ''}${normY.toFixed(2)}, dRot:${normRot >= 0 ? '+' : ''}${normRot.toFixed(2)})`;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
  if (terminalBody.childElementCount > 30) {
    terminalBody.removeChild(terminalBody.firstChild);
  }
}


function logSerialRX(parsed) {
  const line = document.createElement('div');
  line.className = 'log-line serial-log';
  line.textContent = `>> serial_rx: (X:${parsed.x.toFixed(1)}, Y:${parsed.y.toFixed(1)}, R:${Math.round(parsed.rotation)}°)`;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
  if (terminalBody.childElementCount > 30) {
    terminalBody.removeChild(terminalBody.firstChild);
  }
}


// --- Web Serial API Connection ---
async function connectWebSerial() {
  console.log('[SERIAL] connectWebSerial button clicked');
  logTerminal('system', 'Connect Serial Port button clicked. Checking Web Serial API...');

  if (!('serial' in navigator)) {
    let reason = '현재 브라우저 환경에서 Web Serial API를 사용할 수 없습니다.\n\n[해결 방법]\n1. 브라우저 주소창에 http://localhost:5005 로 접속해 주세요.\n   (Live Server 127.0.0.1:5500 주소에서는 보안 문제로 제한될 수 있습니다)\n2. 또는 위쪽 [Serial Source Mode]를 "Server Serial (Node.js API)"로 바꿔서 연결해 보세요!';
    logTerminal('error', `Web Serial 미지원: http://localhost:5005 접속 또는 Server Serial 모드를 사용하세요.`);
    alert(`⚠️ 시리얼 연결 안내\n\n${reason}`);
    return;
  }

  try {
    const baudRate = parseInt(serialBaudSelect.value, 10) || 115200;
    logTerminal('system', `Requesting Serial Port dialog... (Baud: ${baudRate})`);
    
    serialPort = await navigator.serial.requestPort();
    logTerminal('system', `Opening serial port at ${baudRate} bps...`);
    await serialPort.open({ baudRate });

    updateSerialBadge('connected', `SERIAL: ${baudRate}bps`);
    webserialConnectBtn.style.display = 'none';
    webserialDisconnectBtn.style.display = 'block';
    logTerminal('success', `✅ Web Serial Port connected successfully at ${baudRate} bps.`);

    keepReadingSerial = true;
    readWebSerialStream();
  } catch (err) {
    console.error('[SERIAL] Error opening web serial:', err);
    let helpMsg = err.message;
    if (err.name === 'NotFoundError' || err.message.includes('No port selected')) {
      helpMsg = '시리얼 포트 선택이 취소되었습니다.';
    } else if (err.name === 'SecurityError') {
      helpMsg = '보안 제한으로 시리얼 포트 요청이 거부되었습니다. http://localhost:5005 주소로 접속하시거나 Server Serial 모드를 사용해 주세요.';
      alert(`⚠️ 보안 제한 오류 (SecurityError)\n\n${helpMsg}`);
    } else if (err.message.includes('Failed to open') || err.message.includes('already open') || err.message.includes('Resource busy') || err.message.includes('Access denied') || err.message.includes('occupied')) {
      helpMsg = '포트를 열 수 없습니다. 아두이노 IDE의 시리얼 모니터를 닫아주세요!';
      alert('⚠️ 시리얼 포트 연결 실패!\n\n아두이노 IDE의 [시리얼 모니터] 창이 열려있으면 포트가 점유되어 연결할 수 없습니다. 시리얼 모니터를 닫고 다시 시도해 주세요.');
    } else {
      alert(`⚠️ 시리얼 연결 오류:\n${err.message}`);
    }
    logTerminal('error', `Web Serial 연결 오류: ${helpMsg}`);
    updateSerialBadge('disconnected', 'OFFLINE');
  }
}

window.connectWebSerial = connectWebSerial;
window.disconnectWebSerial = disconnectWebSerial;




async function readWebSerialStream() {
  let textBuffer = '';
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  serialReader = reader;

  try {
    while (keepReadingSerial) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        textBuffer += value;
        const lines = textBuffer.split(/\r?\n/);
        textBuffer = lines.pop(); // Keep partial line in buffer

        for (const line of lines) {
          processIncomingSerialLine(line);
        }
      }
    }
  } catch (err) {
    if (keepReadingSerial) {
      logTerminal('error', `Serial Read Error: ${err.message}`);
    }
  } finally {
    reader.releaseLock();
  }
}

async function disconnectWebSerial() {
  keepReadingSerial = false;
  if (serialReader) {
    try { await serialReader.cancel(); } catch (e) {}
    serialReader = null;
  }
  if (serialPort) {
    try { await serialPort.close(); } catch (e) {}
    serialPort = null;
  }
  updateSerialBadge('disconnected', 'OFFLINE');
  webserialConnectBtn.style.display = 'block';
  webserialDisconnectBtn.style.display = 'none';
  logTerminal('system', 'Web Serial Port disconnected.');
}

function updateSerialBadge(stateClass, label) {
  if (serialBadge) {
    serialBadge.className = `badge badge-${stateClass}`;
    serialBadge.textContent = label;
  }
}

// --- Server Serial API Connection ---
async function fetchServerSerialPorts() {
  try {
    const res = await fetch(`${currentOrigin}/api/serial/ports`);
    if (!res.ok) throw new Error('Server serialport endpoint not available');
    const data = await res.json();
    
    nodePortSelect.innerHTML = '<option value="">-- Select Port --</option>';
    if (data.ports && data.ports.length > 0) {
      data.ports.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.path;
        opt.textContent = `${p.path} ${p.manufacturer ? '(' + p.manufacturer + ')' : ''}`;
        nodePortSelect.appendChild(opt);
      });
      logTerminal('system', `Found ${data.ports.length} server serial port(s).`);
    } else {
      const opt = document.createElement('option');
      opt.value = "";
      opt.textContent = "No serial ports found on server";
      nodePortSelect.appendChild(opt);
    }
  } catch (err) {
    logTerminal('error', `Server serial check: ${err.message}`);
  }
}

async function connectNodeSerial() {
  const portPath = nodePortSelect.value;
  const baudRate = parseInt(nodeSerialBaudSelect.value, 10) || 115200;

  if (!portPath) {
    alert('Please select a Server Serial Port first.');
    return;
  }

  try {
    const res = await fetch(`${currentOrigin}/api/serial/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: portPath, baudRate })
    });
    const data = await res.json();

    if (res.ok) {
      updateSerialBadge('connected', `SRV SERIAL: ${baudRate}bps`);
      nodeConnectBtn.style.display = 'none';
      nodeDisconnectBtn.style.display = 'block';
      logTerminal('success', `Connected server serial port ${portPath} at ${baudRate} bps.`);

      startNodeSerialPolling();
    } else {
      throw new Error(data.error || 'Failed to connect');
    }
  } catch (err) {
    logTerminal('error', `Server serial connect error: ${err.message}`);
  }
}

async function disconnectNodeSerial() {
  stopNodeSerialPolling();
  try {
    await fetch(`${currentOrigin}/api/serial/disconnect`, { method: 'POST' });
    updateSerialBadge('disconnected', 'OFFLINE');
    nodeConnectBtn.style.display = 'block';
    nodeDisconnectBtn.style.display = 'none';
    logTerminal('system', 'Server serial port disconnected.');
  } catch (err) {
    logTerminal('error', `Server serial disconnect error: ${err.message}`);
  }
}

function startNodeSerialPolling() {
  stopNodeSerialPolling();
  nodeSerialStatusInterval = setInterval(async () => {
    try {
      const res = await fetch(`${currentOrigin}/api/state`);
      if (res.ok) {
        const latest = await res.json();
        if (latest.method === 'SerialPort') {
          state.x = latest.x;
          state.y = latest.y;
          state.rotation = latest.rotation;
          state.vx = 0;
          state.vy = 0;
          state.vRotation = 0;
          if (latest.action !== undefined) state.action = latest.action;
          if (serialRawValSpan) {
            serialRawValSpan.textContent = `X:${latest.x.toFixed(1)} Y:${latest.y.toFixed(1)} R:${latest.rotation.toFixed(0)}°`;
          }
        }
      }
    } catch (e) {}
  }, 100);
}

function stopNodeSerialPolling() {
  if (nodeSerialStatusInterval) {
    clearInterval(nodeSerialStatusInterval);
    nodeSerialStatusInterval = null;
  }
}

// Mode Selector Change Handler
if (serialModeSelect) {
  serialModeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'webserial') {
      webserialControls.style.display = 'block';
      nodeserialControls.style.display = 'none';
    } else {
      webserialControls.style.display = 'none';
      nodeserialControls.style.display = 'block';
      fetchServerSerialPorts();
    }
  });
}

if (webserialConnectBtn) webserialConnectBtn.addEventListener('click', connectWebSerial);
if (webserialDisconnectBtn) webserialDisconnectBtn.addEventListener('click', disconnectWebSerial);
if (refreshPortsBtn) refreshPortsBtn.addEventListener('click', fetchServerSerialPorts);
if (nodeConnectBtn) nodeConnectBtn.addEventListener('click', connectNodeSerial);
if (nodeDisconnectBtn) nodeDisconnectBtn.addEventListener('click', disconnectNodeSerial);

function start3sCalibration() {
  isCalibrating = true;
  calibSamples = [];
  calibStartTime = Date.now();

  if (calibStatusTag) {
    calibStatusTag.textContent = 'CALIBRATING...';
    calibStatusTag.style.background = '#fff3e0';
    calibStatusTag.style.color = '#e65100';
    calibStatusTag.style.borderColor = '#ffe0b2';
  }

  if (calibProgressContainer) calibProgressContainer.style.display = 'block';
  if (calibProgressBar) calibProgressBar.style.width = '0%';
  if (calibProgressText) calibProgressText.textContent = 'Move joystick to all limits... (0%)';
  if (start3sCalibBtn) {
    start3sCalibBtn.disabled = true;
    start3sCalibBtn.textContent = 'Learning...';
  }

  logTerminal('system', 'Started 5-second dynamic range calibration. Please move joystick to all limits (+X, -X, +Y, -Y, CW, CCW).');
}

function finish3sCalibration() {
  isCalibrating = false;
  if (calibSamples.length === 0) return;

  // Initial 15% samples set resting center
  const centerCount = Math.max(1, Math.floor(calibSamples.length * 0.15));
  let sumX = 0, sumY = 0, sumRot = 0;
  for (let i = 0; i < centerCount; i++) {
    sumX += calibSamples[i].x;
    sumY += calibSamples[i].y;
    sumRot += calibSamples[i].rot;
  }
  const avgX = Math.round(sumX / centerCount);
  const avgY = Math.round(sumY / centerCount);
  const avgRot = Math.round(sumRot / centerCount);

  // Compute observed Min & Max across all samples
  let minObsX = calibSamples[0].x, maxObsX = calibSamples[0].x;
  let minObsY = calibSamples[0].y, maxObsY = calibSamples[0].y;
  let maxCcwDeflection = 15;
  let maxCwDeflection = 15;

  calibSamples.forEach(s => {
    minObsX = Math.min(minObsX, s.x);
    maxObsX = Math.max(maxObsX, s.x);
    minObsY = Math.min(minObsY, s.y);
    maxObsY = Math.max(maxObsY, s.y);

    const dR = getCircularDiff(s.rot, avgRot);
    if (dR > 0) {
      maxCwDeflection = Math.max(maxCwDeflection, dR);
    } else {
      maxCcwDeflection = Math.max(maxCcwDeflection, Math.abs(dR));
    }
  });

  maxCcwDeflection = Math.max(10, Math.min(180, Math.round(maxCcwDeflection)));
  maxCwDeflection = Math.max(10, Math.min(180, Math.round(maxCwDeflection)));

  if (calibMinXInput) calibMinXInput.value = minObsX;
  if (calibXInput) calibXInput.value = avgX;
  if (calibMaxXInput) calibMaxXInput.value = maxObsX;

  if (calibMinYInput) calibMinYInput.value = minObsY;
  if (calibYInput) calibYInput.value = avgY;
  if (calibMaxYInput) calibMaxYInput.value = maxObsY;

  if (calibMinRotInput) calibMinRotInput.value = maxCcwDeflection;
  if (calibRotInput) calibRotInput.value = avgRot;
  if (calibMaxRotInput) calibMaxRotInput.value = maxCwDeflection;

  localStorage.setItem('5hz_calib_min_x', minObsX);
  localStorage.setItem('5hz_calib_x', avgX);
  localStorage.setItem('5hz_calib_max_x', maxObsX);

  localStorage.setItem('5hz_calib_min_y', minObsY);
  localStorage.setItem('5hz_calib_y', avgY);
  localStorage.setItem('5hz_calib_max_y', maxObsY);

  localStorage.setItem('5hz_calib_min_rot', maxCcwDeflection);
  localStorage.setItem('5hz_calib_rot', avgRot);
  localStorage.setItem('5hz_calib_max_rot', maxCwDeflection);

  if (calibStatusTag) {
    calibStatusTag.textContent = 'DONE';
    calibStatusTag.style.background = '#e8f5e9';
    calibStatusTag.style.color = '#2e7d32';
    calibStatusTag.style.borderColor = '#c8e6c9';
  }

  if (calibProgressContainer) calibProgressContainer.style.display = 'none';
  if (start3sCalibBtn) {
    start3sCalibBtn.disabled = false;
    start3sCalibBtn.textContent = '⏱️ 5s Auto Learn';
  }

  logTerminal('success', `✅ 5s Range Calibration Complete! Center: (${avgX}, ${avgY}, ${avgRot}) | Rot Span: CCW -${maxCcwDeflection}°, CW +${maxCwDeflection}°`);
}

function loadSavedCalibration() {
  const savedMinX = localStorage.getItem('5hz_calib_min_x');
  const savedX = localStorage.getItem('5hz_calib_x');
  const savedMaxX = localStorage.getItem('5hz_calib_max_x');

  const savedMinY = localStorage.getItem('5hz_calib_min_y');
  const savedY = localStorage.getItem('5hz_calib_y');
  const savedMaxY = localStorage.getItem('5hz_calib_max_y');

  const savedMinRot = localStorage.getItem('5hz_calib_min_rot');
  const savedRot = localStorage.getItem('5hz_calib_rot');
  const savedMaxRot = localStorage.getItem('5hz_calib_max_rot');

  if (savedMinX && calibMinXInput) calibMinXInput.value = savedMinX;
  if (savedX && calibXInput) calibXInput.value = savedX;
  if (savedMaxX && calibMaxXInput) calibMaxXInput.value = savedMaxX;

  if (savedMinY && calibMinYInput) calibMinYInput.value = savedMinY;
  if (savedY && calibYInput) calibYInput.value = savedY;
  if (savedMaxY && calibMaxYInput) calibMaxYInput.value = savedMaxY;

  if (savedMinRot && calibMinRotInput) calibMinRotInput.value = savedMinRot;
  if (savedRot && calibRotInput) calibRotInput.value = savedRot;
  if (savedMaxRot && calibMaxRotInput) calibMaxRotInput.value = savedMaxRot;
}



if (start3sCalibBtn) {
  start3sCalibBtn.addEventListener('click', () => {
    start3sCalibration();
  });
}

if (quickCalibBtn) {
  quickCalibBtn.addEventListener('click', () => {
    if (calibXInput) calibXInput.value = Math.round(lastRawSerialValues.x);
    if (calibYInput) calibYInput.value = Math.round(lastRawSerialValues.y);
    if (calibRotInput) calibRotInput.value = Math.round(lastRawSerialValues.rot);
    localStorage.setItem('5hz_calib_x', Math.round(lastRawSerialValues.x));
    localStorage.setItem('5hz_calib_y', Math.round(lastRawSerialValues.y));
    localStorage.setItem('5hz_calib_rot', Math.round(lastRawSerialValues.rot));
    logTerminal('success', `Instant Zero set to X:${Math.round(lastRawSerialValues.x)}, Y:${Math.round(lastRawSerialValues.y)}, Rot:${Math.round(lastRawSerialValues.rot)}`);
  });
}


loadSavedCalibration();


if (serialOrderSelect) {
  serialOrderSelect.addEventListener('change', (e) => {
    if (e.target.value === 'xry') {
      if (calibXInput) calibXInput.value = 508;
      if (calibYInput) calibYInput.value = 179;
      if (calibRotInput) calibRotInput.value = 10;
    } else {
      if (calibXInput) calibXInput.value = 508;
      if (calibYInput) calibYInput.value = 10;
      if (calibRotInput) calibRotInput.value = 179;
    }
  });
}






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
let isTransmitting = false; // Prevent async HTTP request overlap

function transmitState() {
  const currentX = parseFloat(state.x.toFixed(2));
  const currentY = parseFloat(state.y.toFixed(2));
  const currentRotation = Math.round(state.rotation);
  const currentAction = state.action !== undefined ? state.action : 4;

  const monitorsHash = JSON.stringify(monitorQueue);
  const now = Date.now();
  const timeSinceLastTransmit = now - (lastTransmittedState.timestamp || 0);

  // Transmission Gap Throttling: Ensure transmissions strictly respect transmitInterval (e.g., 1.5s / 1500ms gap)
  const minGap = Math.max(100, transmitInterval - 50);
  if (timeSinceLastTransmit < minGap) {
    return;
  }

  // Heartbeat check: force transmit if idle time exceeds 1.5x of interval
  const isHeartbeatDue = timeSinceLastTransmit >= (transmitInterval * 1.5);


  if (
    !isHeartbeatDue &&
    currentX === lastTransmittedState.x &&
    currentY === lastTransmittedState.y &&
    currentRotation === lastTransmittedState.rotation &&
    currentAction === lastTransmittedState.action &&
    monitorsHash === lastTransmittedState.monitorsHash
  ) {
    return;
  }

  // Prevent overlapping pending HTTP fetch requests
  if (isTransmitting) return;
  isTransmitting = true;


  // Update last transmitted values
  lastTransmittedState = {
    x: currentX,
    y: currentY,
    rotation: currentRotation,
    action: currentAction,
    monitorsHash: monitorsHash,
    timestamp: now
  };

  const payload = {
    x: currentX,
    y: currentY,
    rotation: currentRotation,
    timestamp: now,
    action: currentAction,
    monitors: [...monitorQueue],
    monitorDelay: monitorDelayMs
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
  })
  .finally(() => {
    isTransmitting = false;
  });
}


function logTransmission(payload, statusText) {
  const monStr = Array.isArray(payload.monitors) 
    ? payload.monitors.map(m => m === null ? 'Null' : `A:${m.action}(${m.x.toFixed(0)},${m.y.toFixed(0)},${m.rotation}°)`).join(' ') 
    : '';
  const msg = `>> tx_data(x=${payload.x.toFixed(1).padStart(5, ' ')}, y=${payload.y.toFixed(1).padStart(5, ' ')}, θ=${String(payload.rotation).padStart(3, ' ')}°, action=${payload.action}) | Monitors: [${monStr}] [${statusText}]`;


  
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
  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 0, height: 0 };
  const w = (rect.width && rect.width > 0) ? rect.width : window.innerWidth;
  const h = (rect.height && rect.height > 0) ? rect.height : window.innerHeight;

  canvas.width = Math.max(w, 300);
  canvas.height = Math.max(h, 300);
  if (glCanvas) {
    glCanvas.width = Math.max(w, 300);
    glCanvas.height = Math.max(h, 300);
    if (gl) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    }
  }
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
  // 1. Position Input Forces
  let ax = 0;
  let ay = 0;
  
  if (keys.ArrowUp || keys.w || keys.W) ay += settings.acceleration;     // Up increases Y
  if (keys.ArrowDown || keys.s || keys.S) ay -= settings.acceleration;   // Down decreases Y
  if (keys.ArrowLeft || keys.a || keys.A) ax -= settings.acceleration;   // Left decreases X
  if (keys.ArrowRight || keys.d || keys.D) ax += settings.acceleration;  // Right increases X

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

  // 4. Update coordinates across FULL SCREEN (0..5000 grid)
  state.x += state.vx;
  state.y += state.vy; 

  const MIN_BOUND = 20;
  const MAX_BOUND = 4980;

  if (state.x < MIN_BOUND) { state.x = MIN_BOUND; state.vx = 0; }
  if (state.x > MAX_BOUND) { state.x = MAX_BOUND; state.vx = 0; }
  if (state.y < MIN_BOUND) { state.y = MIN_BOUND; state.vy = 0; }
  if (state.y > MAX_BOUND) { state.y = MAX_BOUND; state.vy = 0; }


  // Update angle (keep within 0-360)
  state.rotation = (state.rotation + state.vRotation + 360) % 360;

  // Determine active action pattern code
  state.action = determineActionCode();

  // 5. Update Telemetry UI & Terminal HUD Overlay
  const distFromCenter = Math.hypot(state.x - 2500, state.y - 2500);
  telX.textContent = state.x.toFixed(1);
  telY.textContent = state.y.toFixed(1);
  telR.textContent = `${Math.round(state.rotation)}°`;
  if (telD) telD.textContent = distFromCenter.toFixed(1);

  // Update Large Terminal HUD Overlay
  const hudX = document.getElementById('hud-val-x');
  const hudY = document.getElementById('hud-val-y');
  const hudRot = document.getElementById('hud-val-rot');
  const hudAct = document.getElementById('hud-val-act');
  if (hudX) hudX.textContent = state.x.toFixed(1);
  if (hudY) hudY.textContent = state.y.toFixed(1);
  if (hudRot) hudRot.textContent = `${String(Math.round(state.rotation)).padStart(3, '0')}°`;
  if (hudAct) hudAct.textContent = `[${state.action}]`;


  if (telA) {
    const actionLabels = {
      1: '1 (Circling / Closed Loop)',
      2: '2 (Rotate Slow 느린 회전)',
      3: '3 (Rotate Fast 빠른 회전)',
      4: '4 (Default 기본)',
      6: '6 (Border Push >= 0.8s)',
      7: '7 (Near Top 2500, 5000)',
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

  // Translate coordinates from state [0..5000] to screen pixels
  const screenX = (state.x / settings.canvasRangeX) * width;
  const screenY = height - (state.y / settings.canvasRangeY) * height;

  // 1. Render WebGL GLSL Shader Background & Ambient Aura
  const normCursorX = state.x / settings.canvasRangeX;
  const normCursorY = state.y / settings.canvasRangeY;

  if (gl && glProgram) {
    renderShader(normCursorX, normCursorY);
    ctx.clearRect(0, 0, width, height);
  } else {
    // 2D Fallback Pure Pitch Black Background (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }

  const isScreensaver = (mainGridEl && mainGridEl.classList.contains('hide-controls')) || (appContainerEl && appContainerEl.classList.contains('screensaver-mode'));





  const nowTime = Date.now();
  const currentHue = ((state.rotation % 360) + 360) % 360;


  // Sub-pixel continuous trail recording (no gaps when moving fast!)
  const lastTrailPt = rainbowTrails[rainbowTrails.length - 1];
  if (lastTrailPt) {
    const dist = Math.hypot(screenX - lastTrailPt.x, screenY - lastTrailPt.y);
    const rotDiff = Math.abs(state.rotation - lastTrailPt.rotation);
    const steps = Math.min(30, Math.max(1, Math.floor(Math.max(dist / 3, rotDiff / 4))));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const subX = lastTrailPt.x + (screenX - lastTrailPt.x) * t;
      const subY = lastTrailPt.y + (screenY - lastTrailPt.y) * t;
      const subRot = lastTrailPt.rotation + (state.rotation - lastTrailPt.rotation) * t;
      const subHue = ((subRot % 360) + 360) % 360;
      const subTime = lastTrailPt.time + (nowTime - lastTrailPt.time) * t;
      rainbowTrails.push({ x: subX, y: subY, rotation: subRot, hue: subHue, time: subTime });
    }
  } else {
    rainbowTrails.push({ x: screenX, y: screenY, rotation: state.rotation, hue: currentHue, time: nowTime });
  }

  // --- 1. Persistent Fabric Phosphor Afterglow Trail (원 천 뒤 후레쉬 잔상 효과) ---
  const TRAIL_LIFETIME = 9500; // 9.5 seconds long persistent fabric afterglow
  while (rainbowTrails.length > 0 && nowTime - rainbowTrails[0].time > TRAIL_LIFETIME) {
    rainbowTrails.shift();
  }

  if (rainbowTrails.length > 1) {
    ctx.save();
    
    // A. Soft Diffused Spotlight Footprints on Fabric (천 위 광원 잔상)
    for (let i = 0; i < rainbowTrails.length; i += 3) {
      const p = rainbowTrails[i];
      const age = nowTime - p.time;
      const life = Math.max(0, 1 - age / TRAIL_LIFETIME);
      const alpha = life * life; // Exponential decay

      const spotRadius = (95 + Math.sin(i * 0.12) * 12) * life;
      const spotGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, spotRadius);
      spotGrad.addColorStop(0, `hsla(${p.hue}, 100%, 75%, ${alpha * 0.35})`);
      spotGrad.addColorStop(0.4, `hsla(${p.hue}, 100%, 65%, ${alpha * 0.12})`);
      spotGrad.addColorStop(0.8, `hsla(${p.hue}, 100%, 55%, ${alpha * 0.03})`);
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, spotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // B. Continuous Luminous Light Ribbon Diffusing Through Fabric Threads
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < rainbowTrails.length - 1; i++) {
      const p1 = rainbowTrails[i];
      const p2 = rainbowTrails[i + 1];
      const age = nowTime - p1.time;
      const life = Math.max(0, 1 - age / TRAIL_LIFETIME);
      const alpha = life * 0.85;

      // Outer Volumetric Soft Light Aura
      ctx.strokeStyle = `hsla(${p1.hue}, 100%, 65%, ${alpha * 0.22})`;
      ctx.lineWidth = 70 * life;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Main Diffused Fabric Light Ribbon
      ctx.strokeStyle = `hsla(${p1.hue}, 100%, 70%, ${alpha * 0.65})`;
      ctx.lineWidth = 30 * life;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Inner Radiant Light Filament
      ctx.strokeStyle = `hsla(${p1.hue}, 100%, 92%, ${alpha * 0.9})`;
      ctx.lineWidth = 4.5 * life;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();


  }


  // --- 2. Main Light Source: Flashlight Shining Through Circular Screen ---
  ctx.save();
  ctx.translate(screenX, screenY);

  const fabricRadius = 150; // Volumetric Backlight Radius (300px diameter)

  // Pure Volumetric Light Projection & Smooth Glow Gradient (Clean & Minimalist)
  const fabricGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, fabricRadius);
  fabricGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)'); // Pure central light source
  fabricGrad.addColorStop(0.18, `hsla(${currentHue}, 100%, 82%, 0.48)`);
  fabricGrad.addColorStop(0.42, `hsla(${currentHue}, 100%, 65%, 0.2)`);
  fabricGrad.addColorStop(0.72, `hsla(${currentHue}, 100%, 55%, 0.06)`);
  fabricGrad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fades smoothly into pitch black void

  ctx.fillStyle = fabricGrad;
  ctx.beginPath();
  ctx.arc(0, 0, fabricRadius, 0, Math.PI * 2);
  ctx.fill();

  // Flashlight Bulb Focal Point (Pure Luminous Center)
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.restore();









  
  // Draw coordinate label near the dot (Hide in screensaver mode)
  if (!isScreensaver) {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.font = '11px "Fira Code", monospace';
    ctx.fillText(
      `(${state.x.toFixed(0)}, ${state.y.toFixed(0)}, ${Math.round(state.rotation)}°)`,
      screenX + 24,
      screenY + 4
    );
  }
}



// Start everything
initWebGLShader();
const defaultServer = getDefaultEndpoint();
if (addressInput) addressInput.value = defaultServer;
apiEndpoint = defaultServer;

resizeCanvas();
requestAnimationFrame(mainLoop);
setupConnection();
logTerminal('success', 'WebGL Shader Screensaver Engine started.');



