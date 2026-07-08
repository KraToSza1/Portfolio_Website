/**
 * UI Module
 * Handles UI rendering including planets, station, and targets
 */

import { elements, camera, ship, viewport } from '../core/state.js';
import { toPx } from '../utils/canvas.js';
import { drawTargetPlanet } from './planets.js';

// Station configuration
const STATION_CFG = {
  label: "Station",
  sprite: "",
  px: 22,
  py: 18,
  scale: 1
};

let stationImg = null;
let lastHoveredIndex = -1;

/**
 * Initialize station
 */
export function initStation() {
  const { SITE } = require('../core/state.js');
  STATION_CFG.label = SITE?.station?.label || "Station";
  STATION_CFG.sprite = SITE?.station?.sprite || "";
  STATION_CFG.px = (typeof SITE?.station?.px === "number") ? SITE.station.px : 22;
  STATION_CFG.py = (typeof SITE?.station?.py === "number") ? SITE.station.py : 18;
  STATION_CFG.scale = SITE?.station?.scale ?? 1;
  
  if (STATION_CFG.sprite) {
    const _img = new Image();
    _img.onload = () => { stationImg = _img; };
    try {
      _img.decoding = "async";
    } catch {}
    _img.src = STATION_CFG.sprite;
  }
}

const STATION = {
  r: 18,
  rot: 0,
  rotSpeed: 0.0035,
  pulse: 0,
  ...STATION_CFG
};

/**
 * Draw decorative space station
 */
export function drawStation() {
  const { uictx, width, height } = elements;
  if (!uictx) return;
  
  const x = toPx(STATION.px, width);
  const y = toPx(STATION.py, height);

  STATION.rot += STATION.rotSpeed;
  STATION.pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.002);

  uictx.save();
  uictx.translate(x, y);
  uictx.rotate(STATION.rot);

  // Pseudo-3D ring (tilted ellipse + glow)
  uictx.save();
  uictx.rotate(-0.25);
  uictx.globalAlpha = 0.30 + STATION.pulse * 0.25;
  uictx.strokeStyle = "rgba(180,210,255,0.85)";
  uictx.lineWidth = 1.2;
  uictx.beginPath();
  uictx.ellipse(0, 0, STATION.r*1.9, STATION.r*0.9, 0, 0, Math.PI*2);
  uictx.stroke();
  uictx.restore();

  // Sprite (if provided), otherwise vector fallback
  if (stationImg) {
    const s = STATION.r * 2.2 * (STATION.scale || 1);
    uictx.save();
    uictx.globalAlpha = 0.85;
    uictx.shadowColor = "rgba(100,140,255,0.55)";
    uictx.shadowBlur = 16;
    uictx.drawImage(stationImg, -s*0.5, -s*0.5, s, s);
    uictx.restore();
  } else {
    // Vector fallback
    uictx.fillStyle = "#cfe1ff";
    uictx.beginPath();
    uictx.arc(0, 0, STATION.r*0.46, 0, Math.PI*2);
    uictx.fill();

    uictx.strokeStyle = "#9fb6ff";
    uictx.lineWidth = 2;
    uictx.beginPath();
    uictx.moveTo(-STATION.r*1.2, 0);
    uictx.lineTo(STATION.r*1.2, 0);
    uictx.stroke();
    uictx.beginPath();
    uictx.moveTo(0, -STATION.r*1.2);
    uictx.lineTo(0, STATION.r*1.2);
    uictx.stroke();
  }

  // Tiny blink
  uictx.fillStyle = "rgba(255,255,255,0.9)";
  uictx.beginPath();
  uictx.arc(STATION.r*0.75, 0, 1.6 + STATION.pulse*0.8, 0, Math.PI*2);
  uictx.fill();

  uictx.restore();

  // Label
  uictx.font = "600 14px Segoe UI, sans-serif";
  const label = STATION.label || "Station";
  const lw = uictx.measureText(label).width;
  uictx.fillStyle = "#cfe1ff";
  uictx.fillText(label, x - lw/2, y + STATION.r + 16);
}

/**
 * Draw all targets (planets)
 */
export function drawTargets(TARGETS) {
  const { uictx, width, height, mouseX, mouseY } = elements;
  if (!uictx) return -1;
  
  const warping = camera.active || Math.abs(camera.scale - 1) > 0.02;
  uictx.textBaseline = "top";
  const now = performance.now();
  let hoveredIdx = -1;

  TARGETS.forEach((t, i) => {
    const x = toPx(t.px, width);
    const y = toPx(t.py, height);
    const r = t.r;
    let hovered = false;
    
    if (!warping && !ship.moving) {
      const dist = Math.hypot(mouseX - x, mouseY - y);
      hovered = dist <= r + 6;
      if (hovered) hoveredIdx = i;
    }
    drawTargetPlanet(x, y, t, hovered, now);
  });

  // Draw station after planets
  drawStation();

  return hoveredIdx;
}

/**
 * Draw UI
 */
export function drawUI(TARGETS) {
  const { uictx, width, height } = elements;
  if (!uictx) return;
  
  uictx.clearRect(0, 0, width, height);
  uictx.save();
  uictx.translate(width/2, height/2);
  uictx.scale(camera.scale, camera.scale);
  uictx.translate(-width/2 - camera.x, -height/2 - camera.y);
  
  const hoveredIdx = drawTargets(TARGETS);
  lastHoveredIndex = hoveredIdx;
  
  uictx.restore();
}

export function getLastHoveredIndex() {
  return lastHoveredIndex;
}
