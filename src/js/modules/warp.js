/**
 * Warp Effects Module
 * Handles warp transitions and theme management
 */

import { CONFIG, COOL_THEMES, ALL_THEMES, THEME_TINTS } from '../core/config.js';
import { elements, starfield, mission, viewport } from '../core/state.js';
import { warmImagesSequential } from '../utils/image.js';
import { initTIEFighters } from './tie-fighters.js';

/**
 * Set star tint from theme
 */
export function setStarTintFromTheme(theme) {
  starfield.starTint = THEME_TINTS[theme] || [160, 210, 255];
}

/**
 * Pick a warp theme (prefers cool themes)
 */
export function pickWarpTheme(preferred = true) {
  const pool = preferred ? COOL_THEMES : ALL_THEMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Start warp effect
 */
export function startWarp(theme = pickWarpTheme(true)) {
  const { warpOverlay, intro, stage } = elements;
  
  // Mark mission as started - sun will now appear
  mission.started = true;
  
  // Initialize TIE fighters after mission starts
  if (typeof initTIEFighters === 'function') {
    initTIEFighters();
  }
  
  // Safety: remove previous theme classes
  warpOverlay.classList.remove("theme-cyan", "theme-violet", "theme-magma", "theme-emerald", "pulse");
  if (theme) warpOverlay.classList.add(theme);
  setStarTintFromTheme(theme);
  if (CONFIG.WARP.USE_PULSE) warpOverlay.classList.add("pulse");

  warpOverlay.hidden = false;
  warpOverlay.classList.add("active");
  starfield.warpTarget = CONFIG.STARS.WARP_SPEED;

  setTimeout(() => {
    intro.style.display = "none";
    stage.hidden = false;
    
    // Resize all (will be handled by main app)
    if (typeof window.resizeAll === 'function') {
      window.resizeAll();
    }
    
    // Ensure ship exists
    if (typeof window.ensureShip === 'function') {
      window.ensureShip();
    }
    if (typeof window.ensureShip3D === 'function') {
      window.ensureShip3D();
    }

    // Begin warming planet PNGs only after first transition
    try {
      // This would need access to ROOMS and FILE_OVERRIDE from the planets module
      // For now, we'll handle this in the main app or planets module
      if (typeof window.warmPlanetImages === 'function') {
        window.warmPlanetImages();
      }
    } catch {
      // Ignore errors
    }
  }, CONFIG.WARP.ENTER_FADE_MS);

  setTimeout(() => {
    starfield.warpTarget = CONFIG.STARS.CRUISE_SPEED;
    warpOverlay.classList.remove("active", "pulse");
    setTimeout(() => {
      warpOverlay.hidden = true;
    }, CONFIG.WARP.EXIT_FADE_MS);
  }, CONFIG.WARP.ENTER_FADE_MS + CONFIG.WARP.HOLD_MS);
}
