/**
 * Planets Module
 * Handles planet data, rendering, textures, and rooms
 */

import { CONFIG } from '../core/config.js';
import { SITE, viewport } from '../core/state.js';
import { elements } from '../core/state.js';
import { toPx } from '../utils/canvas.js';

/**
 * Planet color palettes
 */
export const PLANETS = {
  amber:  { base:"#ffd84a", shade:"#f4b800", highlight:"#fff8c9", glow:"#ffe05e", ring:false },
  aqua:   { base:"#78d7ff", shade:"#3682ff", highlight:"#eaffff", glow:"#9edbff", ring:true,  ringColor:"rgba(160,210,255,.6)" },
  coral:  { base:"#ff9aa2", shade:"#ff4f6d", highlight:"#ffe9ec", glow:"#ffc3ca", ring:false },
  mint:   { base:"#9df6c7", shade:"#2ce6a1", highlight:"#eafff6", glow:"#aefbd7", ring:false },
  violet: { base:"#b99cff", shade:"#6e52ff", highlight:"#efeaff", glow:"#c9b3ff", ring:true,  ringColor:"rgba(185,156,255,.55)" }
};

export const WARP_THEME = {
  amber:"theme-magma",
  aqua:"theme-cyan",
  coral:"theme-magma",
  mint:"theme-emerald",
  violet:"theme-violet"
};

/**
 * Generate a planet name
 */
export function makePlanetName() {
  const A = ["Vy","Xe","Ka","Or","Ny","Au","Ze","Vo","Sy","Ty","Qui","Ara","Lo"];
  const B = ["ris","thos","lune","dris","ron","vera","drax","lyx","phos","thia","nox","lyra","dune"];
  return A[Math.floor(Math.random() * A.length)] + B[Math.floor(Math.random() * B.length)];
}

/**
 * Planet cache
 */
const planetCache = new Map();
export const FILE_OVERRIDE = {
  abysium: "Abyssium",
  abyssium: "Abyssium",
  cindrix: "Cindrix",
  thal3: "Thal3",
  orionisix: "Orionis-IX",
  volara: "Volara",
  nyxus: "Nyxus",
  aurelia: "Aurelia",
  kairon: "Kairon",
  xerith: "Xerith",
  vespera: "Vespera",
  solyn: "Solyn"
};

/**
 * Seeded random number generator
 */
function seededRand(seed) {
  let x = seed|0 || 123456789;
  return () => (x ^= x<<13, x ^= x>>>17, x ^= x<<5, (x>>>0)/4294967295);
}

/**
 * Make a planet texture programmatically
 */
export function makePlanetTexture(r, palette, seed = Date.now()) {
  const rand = seededRand(seed);
  const c = document.createElement('canvas');
  const s = Math.ceil(r * 2);
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s*0.35, s*0.35, r*0.2, s/2, s/2, r);
  g.addColorStop(0, palette.highlight || "#ffffff");
  g.addColorStop(0.02, palette.base);
  g.addColorStop(1, palette.shade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s/2, s/2, r, 0, Math.PI*2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 120; i++) {
    const rr = r*(0.05 + rand()*0.25);
    const a = 0.10 + rand()*0.25;
    ctx.globalAlpha = a;
    ctx.filter = `blur(${Math.max(0.6, rr*0.15)}px)`;
    const ang = rand()*Math.PI*2;
    const dist = rand()*r*0.7;
    const cx = s/2 + Math.cos(ang)*dist;
    const cy = s/2 + Math.sin(ang)*dist;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI*2);
    ctx.fillStyle = rand() < 0.5 ? "#ffffff" : "#000000";
    ctx.fill();
  }
  ctx.restore();
  ctx.filter = "none";
  const rim = ctx.createRadialGradient(s/2, s/2, r*0.9, s/2, s/2, r*1.08);
  rim.addColorStop(0, "rgba(255,255,255,0.0)");
  rim.addColorStop(1, (palette.glow || palette.base) + "00");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(s/2, s/2, r*1.08, 0, Math.PI*2);
  ctx.fill();
  return c;
}

/**
 * Ensure asteroids are generated for a planet
 */
export function ensureAsteroids(t) {
  if (!t.asteroids || t.beltPoints) return;
  const { count = 120, inner = 1.6, outer = 2.1, tilt = -0.22 } = t.asteroids || {};
  const rand = seededRand(t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0) ^ 9137);
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i/count)*Math.PI*2 + rand()*0.5;
    const radius = t.r * (inner + rand()*(outer-inner));
    const er = radius * 0.52;
    pts.push({
      a, radius, er,
      size: 0.6 + rand()*1.4,
      shade: 0.6 + rand()*0.4,
      speed: 0.0006 + rand()*0.0006
    });
  }
  t.beltPoints = pts;
  t.beltTilt = tilt;
}

/**
 * Build planet textures
 */
export function buildPlanetTextures(list) {
  list.forEach(t => {
    const key = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (planetCache.has(key)) {
      t.tex = planetCache.get(key);
      ensureAsteroids(t);
      return;
    }

    const img = new Image();
    try {
      img.decoding = "async";
    } catch {}
    img.onload = () => {
      planetCache.set(key, img);
      t.tex = img;
      ensureAsteroids(t);
    };
    img.onerror = () => {
      const tex = makePlanetTexture(t.r, t.planet, t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
      planetCache.set(key, tex);
      t.tex = tex;
      ensureAsteroids(t);
    };
    const fname = FILE_OVERRIDE[key] || key;
    img.src = `assets/planets/${fname}.png`;
  });
}

/**
 * Ensure text metrics are cached
 */
export function ensureTextMetrics(t) {
  if (t._mw && t._nw) return;
  const { uictx } = elements;
  if (!uictx) return;
  
  uictx.save();
  uictx.font = "600 18px Segoe UI, sans-serif";
  t._mw = uictx.measureText(t.label || "").width;
  uictx.font = "14px Segoe UI, sans-serif";
  t._nw = uictx.measureText(`· ${t.name}`).width;
  uictx.restore();
}

/**
 * Draw planet halo
 */
export function drawPlanetHalo(x, y, t, r, now) {
  const { uictx } = elements;
  if (!uictx) return;
  
  const pulse = 0.9 + Math.sin(now*0.0008 + r*0.03)*0.1;
  uictx.save();
  uictx.globalAlpha = 0.14 * pulse;
  uictx.shadowColor = t.planet.glow || t.planet.base;
  uictx.shadowBlur = r * (1.2 + 0.6*pulse);
  uictx.beginPath();
  uictx.arc(x, y, r*1.16, 0, Math.PI*2);
  uictx.strokeStyle = "transparent";
  uictx.stroke();
  uictx.restore();
}

/**
 * Draw planet sparkle
 */
export function drawPlanetSparkle(x, y, r, now) {
  const { uictx } = elements;
  if (!uictx) return;
  
  const sparkleFrame = Math.floor(now / 40);
  const a = (sparkleFrame * 0.024) % (Math.PI*2);
  const sx = x + Math.cos(a) * r*0.35;
  const sy = y + Math.sin(a*1.3) * r*0.22;
  uictx.save();
  uictx.globalAlpha = 0.22 + Math.sin(sparkleFrame*0.4)*0.08;
  uictx.fillStyle = "#ffffff";
  uictx.beginPath();
  uictx.arc(sx, sy, Math.max(1.4, r*0.038), 0, Math.PI*2);
  uictx.fill();
  uictx.restore();
}

/**
 * Get jitter for planet animation
 */
function jitterFor(t) {
  const seed = t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const now = performance.now()*0.001;
  const amp = Math.max(1.2, Math.min(6, t.r*0.08));
  return {
    x: Math.cos(now*0.6 + seed*0.01) * amp,
    y: Math.sin(now*0.7 + seed*0.02) * amp
  };
}

/**
 * Draw asteroid belt
 */
export function drawAsteroidBelt(x, y, t) {
  const { uictx } = elements;
  if (!uictx || !t.beltPoints) return;
  
  uictx.save();
  uictx.translate(x, y);
  uictx.rotate(t.beltTilt || 0);
  for (const p of t.beltPoints) {
    p.a += p.speed;
    const px = Math.cos(p.a) * p.radius;
    const py = Math.sin(p.a) * p.er;
    uictx.globalAlpha = 0.75 * p.shade;
    uictx.fillStyle = "rgba(220,230,255,0.85)";
    uictx.beginPath();
    uictx.arc(px, py, p.size, 0, Math.PI*2);
    uictx.fill();
  }
  uictx.restore();
  uictx.globalAlpha = 1;
}

/**
 * Draw target planet
 */
export function drawTargetPlanet(x, y, t, hovered, now) {
  const { uictx } = elements;
  if (!uictx) return;
  
  const r = t.r;
  drawPlanetHalo(x, y, t, r, now);
  const j = jitterFor(t);
  const px = x + j.x;
  const py = y + j.y;

  if (t.tex) {
    uictx.drawImage(t.tex, px - r, py - r, r * 2, r * 2);
  }

  if (t.planet.ring) {
    uictx.save();
    uictx.translate(px, py);
    uictx.rotate(typeof t.ringTilt === "number" ? t.ringTilt : -0.22);
    
    const ringGlow = 0.8 + Math.sin(now * 0.0008 + r * 0.03) * 0.2;
    uictx.strokeStyle = t.planet.ringColor || "rgba(200,220,255,.55)";
    uictx.lineWidth = Math.max(2, r * 0.12);
    uictx.shadowBlur = r * 0.6;
    uictx.shadowColor = t.planet.ringColor || "rgba(150,200,255,0.5)";
    uictx.globalAlpha = ringGlow;
    uictx.beginPath();
    uictx.ellipse(0, 0, r*1.35, r*0.55, 0, 0, Math.PI*2);
    uictx.stroke();
    uictx.restore();
  }

  if (t.beltPoints) {
    drawAsteroidBelt(px, py, t);
  }
  drawPlanetSparkle(px, py, r, now);

  if (hovered) {
    const glowPulse = 0.85 + Math.sin(now * 0.003) * 0.15;
    uictx.save();
    uictx.globalAlpha = 0.35 * glowPulse;
    uictx.shadowColor = t.planet.glow || t.planet.base;
    uictx.shadowBlur = r * 1.5;
    uictx.beginPath();
    uictx.arc(px, py, r*1.2, 0, Math.PI*2);
    uictx.strokeStyle = "transparent";
    uictx.stroke();
    uictx.restore();
  }

  ensureTextMetrics(t);

  uictx.save();
  uictx.font = "600 18px Segoe UI, sans-serif";
  const holographicGlow = 0.9 + Math.sin(now * 0.001) * 0.1;
  uictx.fillStyle = `rgba(0, 255, 255, ${holographicGlow})`;
  uictx.shadowBlur = 10;
  uictx.shadowColor = "rgba(0, 255, 255, 0.7)";
  uictx.fillText(t.label, px - t._mw/2, py + r + 10);

  uictx.font = "14px Segoe UI, sans-serif";
  const nameText = `· ${t.name}`;
  uictx.fillStyle = `rgba(255, 255, 255, ${holographicGlow * 0.95})`;
  uictx.shadowBlur = 6;
  uictx.shadowColor = "rgba(200, 255, 255, 0.5)";
  uictx.fillText(nameText, px - t._nw/2, py + r + 30);
  uictx.restore();
}
