/**
 * Starfield Module
 * Handles star rendering, meteors, and starfield animations
 */

import { CONFIG } from '../core/config.js';
import { starfield, viewport, input, mission } from '../core/state.js';
import { elements } from '../core/state.js';
import { drawNebula } from './nebula.js';
import { renderDistantSun } from './sun.js';
import { drawTIEFighters } from './tie-fighters.js';

/**
 * Spawn a new star at a random position
 */
export function spawnStar() {
  return {
    x: (Math.random() - 0.5) * viewport.bgW * 2,
    y: (Math.random() - 0.5) * viewport.bgH * 2,
    base: 0.15 + Math.random() * 0.35,
    a: 0,
    ta: 0,
    next: performance.now() + 500 + Math.random() * 1500,
    twEnd: 0
  };
}

/**
 * Spawn a meteor from a random edge
 */
export function spawnMeteor() {
  const edges = ["top", "right", "bottom", "left"][Math.floor(Math.random() * 4)];
  let x, y, vx, vy;
  const speed = 3.5 + Math.random() * 2.2;
  
  if (edges === "top") {
    x = Math.random() * viewport.width;
    y = -20;
    vx = (Math.random() * 2 - 1) * 0.6;
    vy = speed;
  } else if (edges === "bottom") {
    x = Math.random() * viewport.width;
    y = viewport.height + 20;
    vx = (Math.random() * 2 - 1) * 0.6;
    vy = -speed;
  } else if (edges === "left") {
    x = -20;
    y = Math.random() * viewport.height;
    vx = speed;
    vy = (Math.random() * 2 - 1) * 0.6;
  } else {
    x = viewport.width + 20;
    y = Math.random() * viewport.height;
    vx = -speed;
    vy = (Math.random() * 2 - 1) * 0.6;
  }
  
  starfield.meteors.push({
    x, y, vx, vy,
    life: 0,
    maxLife: 120 + Math.random() * 100,
    len: 40 + Math.random() * 60
  });
}

/**
 * Update and draw meteors
 */
export function updateMeteors(ctx) {
  if (CONFIG.reduceMotion && Math.random() < CONFIG.STARS.METEOR_PROB && starfield.meteors.length < CONFIG.STARS.METEOR_MAX) {
    spawnMeteor();
  }
  
  ctx.lineCap = "round";
  
  for (let i = starfield.meteors.length - 1; i >= 0; i--) {
    const m = starfield.meteors[i];
    m.x += m.vx;
    m.y += m.vy;
    m.life++;
    
    const tailX = m.x - m.vx * (m.len / 10);
    const tailY = m.y - m.vy * (m.len / 10);
    const alpha = Math.max(0, 1 - m.life / m.maxLife);
    
    ctx.strokeStyle = `rgba(255,255,255,${0.50 * alpha})`;
    ctx.lineWidth = Math.max(1, 1.6 * alpha);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    
    if (m.life > m.maxLife || m.x < -120 || m.y < -120 || m.x > viewport.width + 120 || m.y > viewport.height + 120) {
      starfield.meteors.splice(i, 1);
    }
  }
}

/**
 * Render the starfield
 */
export function renderStars() {
  const { bctx, bgW, bgH } = elements;
  if (!bctx) return;
  
  // Paint background
  bctx.fillStyle = "#000";
  bctx.fillRect(0, 0, bgW, bgH);
  bctx.fillStyle = viewport.bgGradient;
  bctx.fillRect(0, 0, bgW, bgH);

  // Draw nebula FIRST (furthest layer)
  drawNebula(bctx);

  // Draw distant sun/planet BEFORE stars (so stars appear in front)
  const now = performance.now();
  renderDistantSun(bctx, now);
  
  // Draw TIE fighter silhouettes (very distant)
  drawTIEFighters(bctx, now);

  // Adaptive quality while page/tab hidden
  const hidden = document.visibilityState === "hidden";
  const step = hidden ? 3 : starfield.STAR_STEP;

  // Update star speed
  starfield.starSpeed += (starfield.warpTarget - starfield.starSpeed) * 0.06;
  const cx = bgW / 2;
  const cy = bgH / 2;
  const parallaxFactor = starfield.starSpeed > 0.02 ? 0.0006 : 0.00008;
  const parallaxX = (input.mouseX - cx) * parallaxFactor;
  const parallaxY = (input.mouseY - cy) * parallaxFactor;

  if (starfield.starSpeed < 0.01) {
    // Idle stars
    bctx.fillStyle = "#fff";
    for (let k = 0; k < starfield.stars.length; k += step) {
      const s = starfield.stars[k];
      if (s.twEnd === 0 && Math.random() < 0.002) {
        s.twEnd = now + 800;
        s.ta = 1.0;
      }
      if (s.twEnd && now >= s.twEnd) {
        s.twEnd = 0;
        s.ta = s.base;
      }
      if (!s.twEnd && now >= s.next) {
        s.next = now + 500 + Math.random() * 1500;
        s.ta = s.base + (Math.random() * 0.15 - 0.07);
        s.ta = Math.min(0.7, Math.max(0.05, s.ta));
      }
      s.a += (s.ta - s.a) * 0.05;
      const rx = cx + s.x + parallaxX * 40;
      const ry = cy + s.y + parallaxY * 40;
      const r = s.twEnd ? 1.6 : 1.1;
      bctx.globalAlpha = Math.max(0, Math.min(1, s.a));
      bctx.beginPath();
      bctx.arc(rx, ry, r, 0, Math.PI * 2);
      bctx.fill();
    }
    bctx.globalAlpha = 1;
  } else {
    // Warp streaks
    bctx.lineCap = "round";
    const minSide = Math.min(bgW, bgH);

    for (let k = 0; k < starfield.stars.length; k += step) {
      const s = starfield.stars[k];
      s.x += s.x * starfield.starSpeed + parallaxX * 40;
      s.y += s.y * starfield.starSpeed + parallaxY * 40;
      
      if (s.x * s.x + s.y * s.y > (bgW * bgW + bgH * bgH)) {
        Object.assign(s, spawnStar());
      }

      // Distance from center: fade lengths/alpha near the center to avoid white-out
      const dist = Math.hypot(s.x, s.y);
      const centerFade = Math.min(1, dist / (minSide * 0.36));

      const len = Math.min(12, 1 + starfield.starSpeed * 520) * (0.25 + 0.75 * centerFade);
      const alpha = Math.min(0.28, 0.08 + starfield.starSpeed * 0.50) * centerFade;
      const width = Math.max(0.6, starfield.starSpeed * 18 * (0.2 + 0.8 * centerFade));

      bctx.strokeStyle = `rgba(${starfield.starTint[0]},${starfield.starTint[1]},${starfield.starTint[2]},${alpha})`;
      bctx.lineWidth = width;

      bctx.beginPath();
      bctx.moveTo(cx + s.x, cy + s.y);
      bctx.lineTo(
        cx + s.x - (s.x * starfield.starSpeed * len),
        cy + s.y - (s.y * starfield.starSpeed * len)
      );
      bctx.stroke();
    }
  }
  
  updateMeteors(bctx);
}

/**
 * Initialize starfield
 */
export function initStarfield() {
  starfield.stars = Array.from({ length: CONFIG.STARS.COUNT }, () => spawnStar());
  starfield.meteors = [];
}
