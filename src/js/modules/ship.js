/**
 * Ship Module
 * Handles ship movement, positioning, and animation
 */

import { CONFIG } from '../core/config.js';
import { ship, viewport, camera, starfield } from '../core/state.js';
import { elements } from '../core/state.js';
import { cubic, cubicTangent, easeInOutCubic } from '../utils/math.js';
import { playShootSfx } from './audio.js';
import { pickWarpTheme, setStarTintFromTheme } from './warp.js';

/**
 * Ensure ship is positioned
 */
export function ensureShip() {
  if (!ship.x && !ship.y) {
    ship.x = viewport.width / 2;
    ship.y = viewport.height * 0.86;
    placeShipAt(ship.x, ship.y, ship.angle);
  }
}

/**
 * Ensure 3D ship is initialized
 */
export function ensureShip3D() {
  const cvs = document.getElementById("ship3d");
  if (!cvs) return;
  
  if (window.initShip3D && !CONFIG.reduceMotion) {
    try {
      window.initShip3D("ship3d");
      window.updateShip3D?.({ engineOn: true });
      placeShipAt(ship.x, ship.y, ship.angle);
    } catch (e) {
      console.warn("Ship3D init failed:", e);
    }
  }
}

/**
 * Place ship at a specific position
 */
export function placeShipAt(x, y, deg, scale) {
  ship.x = x;
  ship.y = y;
  ship.angle = deg;
  
  if (window.updateShip3D) {
    try {
      window.updateShip3D({
        x: x / viewport.width,
        y: y / viewport.height,
        angleDeg: deg + CONFIG.SHIP.ANGLE_OFFSET,
        scale: (typeof scale === "number") ? scale : undefined
      });
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Aim ship towards a point
 */
export function aimShipTowards(tx, ty) {
  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const deg = Math.atan2(dy, dx) * 180 / Math.PI;
  placeShipAt(ship.x, ship.y, deg);
}

/**
 * Fly ship to a target position with bezier curve
 */
export function flyShipTo(targetX, targetY, onArrive, theme) {
  ensureShip();
  
  const p0 = { x: ship.x, y: ship.y };
  const p3 = { x: targetX, y: targetY };
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const dist = Math.hypot(dx, dy);
  const arc = dist * CONFIG.SHIP.ARC_HEIGHT;
  const midx = (p0.x + p3.x) / 2;
  const midy = (p0.y + p3.y) / 2;
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const p1 = { x: midx + nx * arc, y: midy + ny * arc };
  const p2 = { x: midx + nx * arc, y: midy + ny * arc };

  ship.path = { p0, p1, p2, p3 };
  ship.t0 = performance.now();
  ship.dur = CONFIG.SHIP.FLIGHT_MS;
  ship.moving = true;
  ship.onArrive = onArrive || null;

  try {
    elements.shootSfx.currentTime = 0;
    elements.shootSfx.play();
  } catch {
    // Ignore errors
  }
  
  if (!CONFIG.reduceMotion) {
    starfield.warpTarget = Math.max(starfield.warpTarget, 0.08);
  }

  const ttheme = theme || pickWarpTheme(true);
  elements.warpOverlay.classList.remove("theme-cyan", "theme-violet", "theme-magma", "theme-emerald", "pulse");
  elements.warpOverlay.classList.add(ttheme);
  setStarTintFromTheme(ttheme);
  if (CONFIG.WARP.USE_PULSE) {
    elements.warpOverlay.classList.add("pulse");
  }

  window.updateShip3D?.({ engineOn: true });
}

/**
 * Update ship position during flight
 */
export function updateShip() {
  if (!ship.moving || !ship.path) return;
  
  const t = Math.min(1, (performance.now() - ship.t0) / ship.dur);
  const et = easeInOutCubic(t);

  const p = cubic(ship.path.p0, ship.path.p1, ship.path.p2, ship.path.p3, et);
  const tg = cubicTangent(ship.path.p0, ship.path.p1, ship.path.p2, ship.path.p3, et);
  const angle = Math.atan2(tg.y, tg.x) * 180 / Math.PI;

  const scale = 1 - (1 - CONFIG.SHIP.LAND_SCALE) * et;
  placeShipAt(p.x, p.y, angle, scale);

  if (t >= 1) {
    ship.moving = false;
    window.updateShip3D?.({ engineOn: false, scale: CONFIG.SHIP.LAND_SCALE });
    
    if (!CONFIG.reduceMotion) {
      starfield.warpTarget = 0.22;
    }
    
    camera.tx = ship.x - viewport.width / 2;
    camera.ty = ship.y - viewport.height / 2;
    camera.ts = CONFIG.CAMERA.ZOOM;
    camera.active = true;
    
    const arrive = ship.onArrive;
    ship.onArrive = null;
    camera.onArrive = () => {
      if (typeof arrive === "function") arrive();
    };
  }
}
