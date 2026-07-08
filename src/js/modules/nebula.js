/**
 * Nebula Backgrounds Module
 * Handles rendering of colorful nebula backgrounds with caching
 */

import { CONFIG } from '../core/config.js';
import { viewport } from '../core/state.js';

let nebulaCache = null;
let lastNebulaCache = '';

/**
 * Draw nebula background
 */
export function drawNebula(ctx) {
  if (CONFIG.reduceMotion) return;
  
  // Cache nebula (only redraw if viewport changed)
  const cacheKey = `${viewport.bgW}_${viewport.bgH}`;
  const needsCache = !nebulaCache || cacheKey !== lastNebulaCache;
  
  if (needsCache) {
    // Create canvas for caching (works in all browsers)
    const cacheCanvas = document.createElement('canvas');
    cacheCanvas.width = viewport.bgW;
    cacheCanvas.height = viewport.bgH;
    const cacheCtx = cacheCanvas.getContext('2d');
    
    cacheCtx.save();
    cacheCtx.globalAlpha = 0.18; // More subtle for performance
    
    // Single combined gradient for better performance
    const combined = cacheCtx.createRadialGradient(
      viewport.bgW * 0.5,
      viewport.bgH * 0.5,
      0,
      viewport.bgW * 0.6,
      viewport.bgH * 0.6,
      viewport.bgW * 0.8
    );
    combined.addColorStop(0, "rgba(150, 100, 255, 0.12)");
    combined.addColorStop(0.4, "rgba(100, 150, 255, 0.08)");
    combined.addColorStop(0.7, "rgba(100, 255, 200, 0.05)");
    combined.addColorStop(1, "transparent");
    
    cacheCtx.fillStyle = combined;
    cacheCtx.fillRect(0, 0, viewport.bgW, viewport.bgH);
    cacheCtx.restore();
    
    nebulaCache = cacheCanvas;
    lastNebulaCache = cacheKey;
  }
  
  // Draw cached nebula (much faster than redrawing every frame)
  if (nebulaCache) {
    ctx.drawImage(nebulaCache, 0, 0);
  }
}
