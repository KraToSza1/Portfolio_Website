/**
 * Distant Sun Module
 * Handles rendering of the glowing sun/planet in the far distance
 */

import { CONFIG } from '../core/config.js';
import { viewport, input, mission } from '../core/state.js';

/**
 * Distant sun configuration
 */
export const DISTANT_SUN = {
  x: 0.85,           // Position (0-1): 85% from left (right side)
  y: 0.15,           // Position (0-1): 15% from top (top area)
  baseRadius: 35,    // Base radius in pixels (scales with viewport) - much smaller!
  glowRadius: 80,     // Glow radius - much smaller!
  pulseSpeed: 0.0004, // MUCH slower pulse (more sun-like, less strobing)
  pulseAmount: 0.03,  // MUCH less pulsing (3% instead of 15% - more stable)
  color: [255, 235, 190], // Warmer, more sun-like orange/yellow
  glowColor: [255, 210, 160], // Glow color (softer, warmer)
  time: 0             // Animation time
};

/**
 * Render the distant sun
 */
export function renderDistantSun(ctx, now) {
  // Only show sun after mission has started
  if (!mission.started || CONFIG.reduceMotion) return;
  
  DISTANT_SUN.time = now || performance.now();
  const t = DISTANT_SUN.time * DISTANT_SUN.pulseSpeed;
  // Very subtle, gentle pulse (almost imperceptible - more sun-like)
  const pulse = 1.0 + Math.sin(t) * DISTANT_SUN.pulseAmount;
  
  // Scale sun size with viewport
  const scale = Math.min(viewport.bgW, viewport.bgH) / 1000;
  const radius = DISTANT_SUN.baseRadius * scale * pulse;
  const glowRadius = DISTANT_SUN.glowRadius * scale * pulse;
  
  // Position (top-right area, with subtle parallax)
  const parallaxFactor = 0.0002; // Subtle parallax
  const parallaxX = (input.mouseX - viewport.bgW / 2) * parallaxFactor;
  const parallaxY = (input.mouseY - viewport.bgH / 2) * parallaxFactor;
  const sunX = viewport.bgW * DISTANT_SUN.x + parallaxX * 15;
  const sunY = viewport.bgH * DISTANT_SUN.y + parallaxY * 15;
  
  // Draw outer glow (soft, large - sun atmosphere)
  const outerGlow = ctx.createRadialGradient(sunX, sunY, radius * 0.4, sunX, sunY, glowRadius);
  outerGlow.addColorStop(0, `rgba(${DISTANT_SUN.glowColor[0]}, ${DISTANT_SUN.glowColor[1]}, ${DISTANT_SUN.glowColor[2]}, 0.28)`);
  outerGlow.addColorStop(0.4, `rgba(${DISTANT_SUN.glowColor[0]}, ${DISTANT_SUN.glowColor[1]}, ${DISTANT_SUN.glowColor[2]}, 0.15)`);
  outerGlow.addColorStop(0.7, `rgba(${DISTANT_SUN.glowColor[0]}, ${DISTANT_SUN.glowColor[1]}, ${DISTANT_SUN.glowColor[2]}, 0.08)`);
  outerGlow.addColorStop(1, 'rgba(255, 200, 150, 0)');
  
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw middle glow (medium intensity - sun's outer layers)
  const middleGlow = ctx.createRadialGradient(sunX, sunY, radius * 0.6, sunX, sunY, radius * 1.5);
  middleGlow.addColorStop(0, `rgba(${DISTANT_SUN.color[0]}, ${DISTANT_SUN.color[1]}, ${DISTANT_SUN.color[2]}, 0.5)`);
  middleGlow.addColorStop(0.5, `rgba(${DISTANT_SUN.color[0]}, ${DISTANT_SUN.color[1]}, ${DISTANT_SUN.color[2]}, 0.28)`);
  middleGlow.addColorStop(0.8, `rgba(${DISTANT_SUN.color[0]}, ${DISTANT_SUN.color[1]}, ${DISTANT_SUN.color[2]}, 0.12)`);
  middleGlow.addColorStop(1, 'rgba(255, 220, 180, 0)');
  
  ctx.fillStyle = middleGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw inner core (bright, solid - sun's surface)
  const innerCore = ctx.createRadialGradient(sunX, sunY, radius * 0.2, sunX, sunY, radius);
  innerCore.addColorStop(0, `rgba(255, 255, 245, 0.98)`); // Very bright center (almost white)
  innerCore.addColorStop(0.2, `rgba(255, 250, 230, 0.95)`); // Bright yellow-white
  innerCore.addColorStop(0.4, `rgba(${DISTANT_SUN.color[0]}, ${DISTANT_SUN.color[1]}, ${DISTANT_SUN.color[2]}, 0.9)`);
  innerCore.addColorStop(0.7, `rgba(${DISTANT_SUN.color[0]}, ${DISTANT_SUN.color[1]}, ${DISTANT_SUN.color[2]}, 0.7)`);
  innerCore.addColorStop(1, 'rgba(255, 210, 160, 0.4)');
  
  ctx.fillStyle = innerCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Very subtle corona/atmosphere (no strobing)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.12; // Constant, no pulsing
  const corona = ctx.createRadialGradient(sunX, sunY, radius * 0.9, sunX, sunY, radius * 2.5);
  corona.addColorStop(0, 'rgba(255, 245, 210, 0.25)');
  corona.addColorStop(0.5, 'rgba(255, 230, 180, 0.15)');
  corona.addColorStop(1, 'rgba(255, 200, 150, 0)');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
