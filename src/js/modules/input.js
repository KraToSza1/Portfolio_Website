/**
 * Input Module
 * Handles mouse and keyboard input, autopilot
 */

import { CONFIG } from '../core/config.js';
import { elements, input, camera, ship } from '../core/state.js';
import { viewport } from '../core/state.js';
import { toPx } from '../utils/canvas.js';
import { flyShipTo } from './ship.js';
import { pickWarpTheme } from './warp.js';
import { setLandingBackgroundByPlanet } from './landing.js';
import { getLastHoveredIndex } from './ui.js';

let _pendingMouse = null;

/**
 * Note that input occurred
 */
export function noteInput() {
  input.lastInputAt = performance.now();
  input.autopilotLock = false;
}

/**
 * Setup input event listeners
 */
export function setupInputHandlers(TARGETS) {
  const { ui } = elements;
  if (!ui) return;

  // Mouse move → coalesced into RAF
  document.addEventListener("mousemove", (e) => {
    _pendingMouse = { x: e.clientX, y: e.clientY };
    noteInput();
  }, { passive: true });

  // Canvas click
  ui.addEventListener("click", (e) => {
    if (camera.active || camera.arriving || ship.moving) return;
    
    const r = ui.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    
    for (const t of TARGETS) {
      const tx = toPx(t.px, viewport.width);
      const ty = toPx(t.py, viewport.height);
      const rr = t.r;
      
      if (Math.hypot(x - tx, y - ty) <= rr) {
        const ring = document.createElement("div");
        ring.className = "flash";
        ring.style.left = tx + "px";
        ring.style.top = ty + "px";
        elements.stage.appendChild(ring);
        ring.addEventListener("animationend", () => ring.remove(), { once: true });
        
        const theme = t.warp || pickWarpTheme(true);
        flyShipTo(tx, ty, () => {
          setLandingBackgroundByPlanet(t);
          t.action();
        }, theme);
        return;
      }
    }
    noteInput();
  }, { passive: true });

  // Keyboard Enter
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || camera.active || camera.arriving || ship.moving) return;
    
    const hoveredIdx = getLastHoveredIndex();
    if (hoveredIdx < 0) return;
    
    const t = TARGETS[hoveredIdx];
    const tx = toPx(t.px, viewport.width);
    const ty = toPx(t.py, viewport.height);
    
    const ring = document.createElement("div");
    ring.className = "flash";
    ring.style.left = tx + "px";
    ring.style.top = ty + "px";
    elements.stage.appendChild(ring);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
    
    const theme = t.warp || pickWarpTheme(true);
    flyShipTo(tx, ty, () => {
      setLandingBackgroundByPlanet(t);
      t.action();
    }, theme);
    noteInput();
  });
}

/**
 * Apply coalesced mouse update
 */
export function applyMouseUpdate() {
  if (_pendingMouse) {
    input.mouseX = _pendingMouse.x;
    input.mouseY = _pendingMouse.y;
    _pendingMouse = null;
  }
}

/**
 * Maybe trigger autopilot
 */
export function maybeAutopilot(TARGETS) {
  if (ship.moving || camera.active || camera.arriving || input.autopilotLock) return;
  if (performance.now() - input.lastInputAt < CONFIG.AUTOPILOT_IDLE_MS) return;
  
  const t = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  const tx = toPx(t.px, viewport.width);
  const ty = toPx(t.py, viewport.height);
  const ang = Math.random() * Math.PI * 2;
  const offset = t.r * (1.3 + Math.random() * 0.6);
  const px = tx + Math.cos(ang) * offset;
  const py = ty + Math.sin(ang) * offset;
  
  input.autopilotLock = true;
  flyShipTo(px, py, () => {
    setLandingBackgroundByPlanet(t);
    if (typeof t.action === "function") t.action();
  }, t.warp || pickWarpTheme(true));
}
