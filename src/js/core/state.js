/**
 * Application State Management
 * Global state variables for the portfolio application
 */

import { CONFIG } from './config.js';

// Canvas contexts and elements
export const elements = {
  bg: null,
  bctx: null,
  stage: null,
  ui: null,
  uictx: null,
  intro: null,
  warpOverlay: null,
  startBtn: null,
  shootSfx: null,
  bgMusic: null
};

// Viewport state
export const viewport = {
  dpr: Math.max(1, window.devicePixelRatio || 1),
  width: 0,
  height: 0,
  bgW: 0,
  bgH: 0,
  bgGradient: null
};

// Input state
export const input = {
  mouseX: window.innerWidth / 2,
  mouseY: window.innerHeight / 2,
  lastInputAt: performance.now(),
  autopilotLock: false
};

// Ship state
export const ship = {
  x: 0,
  y: 0,
  angle: -90,
  moving: false,
  onArrive: null,
  path: null,
  t0: 0,
  dur: CONFIG.SHIP.FLIGHT_MS
};

// Camera state
export const camera = {
  x: 0,
  y: 0,
  scale: 1,
  tx: 0,
  ty: 0,
  ts: 1,
  active: false,
  arriving: false,
  onArrive: null
};

// Starfield state
export const starfield = {
  starSpeed: CONFIG.STARS.IDLE_SPEED,
  warpTarget: CONFIG.STARS.IDLE_SPEED,
  stars: [],
  meteors: [],
  LOW_END: false,
  STAR_STEP: 1,
  starTint: [160, 210, 255]
};

// Mission state
export const mission = {
  started: false
};

// Site data
export const SITE = (() => {
  try {
    return JSON.parse(document.getElementById("site-data")?.textContent || "{}");
  } catch {
    return {};
  }
})();

export const APP_OPTS = window.APP_OPTS || {};

// Initialize elements on DOM ready
export function initializeElements() {
  elements.bg = document.getElementById("bg-canvas");
  elements.bctx = elements.bg?.getContext("2d", { alpha: false });
  elements.stage = document.getElementById("stage");
  elements.ui = document.getElementById("fps-canvas");
  elements.uictx = elements.ui?.getContext("2d", { alpha: true });
  elements.intro = document.getElementById("intro");
  elements.warpOverlay = document.getElementById("warp");
  elements.startBtn = document.getElementById("start-button");
  elements.shootSfx = document.getElementById("sfx-shoot");
  elements.bgMusic = document.getElementById("bg-music");
  
  if (elements.shootSfx) {
    elements.shootSfx.volume = 0.12;
  }
}
