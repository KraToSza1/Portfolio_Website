/**
 * TIE Fighter Silhouettes Module
 * Handles rendering of subtle TIE fighter silhouettes in the background
 */

import { CONFIG } from '../core/config.js';
import { viewport, mission } from '../core/state.js';

/**
 * TIE fighter state
 */
export const TIE_FIGHTERS = [];
let tieFighterLastUpdate = 0;
const TIE_UPDATE_INTERVAL = 50; // Update TIE fighters every 50ms (20fps instead of 60fps)

/**
 * Initialize TIE fighters
 */
export function initTIEFighters() {
  // Reduced count for performance - only 2 TIE fighters
  const count = 2;
  for (let i = 0; i < count; i++) {
    TIE_FIGHTERS.push({
      x: Math.random() * viewport.bgW,
      y: Math.random() * viewport.bgH * 0.3,
      speed: 0.15 + Math.random() * 0.2,
      size: 10 + Math.random() * 8,
      alpha: 0.12 + Math.random() * 0.08,
      time: Math.random() * Math.PI * 2
    });
  }
}

/**
 * Draw TIE fighters
 */
export function drawTIEFighters(ctx, now) {
  if (CONFIG.reduceMotion || !mission.started) return;
  
  if (TIE_FIGHTERS.length === 0) initTIEFighters();
  
  // Throttle updates for performance
  if (now - tieFighterLastUpdate < TIE_UPDATE_INTERVAL) return;
  tieFighterLastUpdate = now;
  
  ctx.save();
  
  TIE_FIGHTERS.forEach(tie => {
    tie.time += 0.0005; // Slower animation
    
    // Move TIE fighters slowly (subtle movement)
    tie.x += Math.sin(tie.time) * 0.2;
    tie.y += tie.speed;
    
    // Wrap around screen
    if (tie.x < -50) tie.x = viewport.bgW + 50;
    if (tie.x > viewport.bgW + 50) tie.x = -50;
    if (tie.y > viewport.bgH + 50) {
      tie.y = -50;
      tie.x = Math.random() * viewport.bgW;
    }
    
    // Simplified drawing - fewer draw calls
    ctx.globalAlpha = tie.alpha;
    ctx.fillStyle = "rgba(150, 150, 150, 0.7)";
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1;
    
    // Main body only (simpler for performance)
    ctx.beginPath();
    ctx.arc(tie.x, tie.y, tie.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings (single call with moveTo)
    ctx.beginPath();
    ctx.arc(tie.x - tie.size * 0.5, tie.y, tie.size * 0.35, 0, Math.PI * 2);
    ctx.moveTo(tie.x + tie.size * 0.5, tie.y);
    ctx.arc(tie.x + tie.size * 0.5, tie.y, tie.size * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  });
  
  ctx.restore();
}
