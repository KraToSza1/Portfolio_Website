/**
 * Canvas Utilities
 * Helper functions for canvas operations
 */

import { viewport } from '../core/state.js';

/**
 * Size a canvas element to match the viewport
 */
export function sizeCanvas(canvas) {
  const vw = Math.floor(window.visualViewport?.width || window.innerWidth);
  const vh = Math.floor(window.visualViewport?.height || window.innerHeight);

  canvas.width = Math.floor(vw * viewport.dpr);
  canvas.height = Math.floor(vh * viewport.dpr);
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);

  return { w: vw, h: vh };
}

/**
 * Rebuild background gradient
 */
export function rebuildBgGradient(bctx, bgW, bgH) {
  const grd = bctx.createRadialGradient(
    bgW * 0.2,
    bgH * 0.15,
    0,
    bgW * 0.5,
    bgH * 0.5,
    Math.max(bgW, bgH)
  );
  grd.addColorStop(0, "#0a0b12");
  grd.addColorStop(0.6, "#06070d");
  grd.addColorStop(1, "#000");
  return grd;
}

/**
 * Convert percentage to pixels
 */
export function toPx(percentage, size) {
  return (percentage / 100) * size;
}
