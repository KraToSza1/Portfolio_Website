/**
 * Main Application Entry Point
 * Initializes and coordinates all application modules
 */

import { initializeElements } from './state.js';
import { CONFIG } from './config.js';
import { startBgMusic, playShootSfx } from '../modules/audio.js';
import { updateViewportVars, throttleRAF } from '../utils/throttle.js';
import { sizeCanvas, rebuildBgGradient, toPx } from '../utils/canvas.js';
import { viewport, starfield, mission, camera, ship, input } from './state.js';
import { elements } from './state.js';

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Initialize DOM elements
  initializeElements();
  
  // Initialize viewport
  updateViewportVars();
  resizeAll();
  
  // Setup event listeners
  setupEventListeners();
  
  // Start main loop
  startMainLoop();
  
  console.log('[App] ✅ Portfolio application initialized');
}

function setupEventListeners() {
  // Viewport resize
  const onResize = throttleRAF(() => {
    updateViewportVars();
    resizeAll();
  });
  
  addEventListener('resize', onResize, { passive: true });
  addEventListener('orientationchange', () => setTimeout(onResize, 50), { passive: true });
  
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize, { passive: true });
  }
  
  // React to display scale changes (DPR)
  try {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', onResize, { passive: true });
  } catch {
    // Some browsers don't support this exact query
  }
  
  // Start button
  if (elements.startBtn) {
    elements.startBtn.addEventListener('click', handleStartClick);
  }
}

function resizeAll() {
  viewport.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  
  const a = sizeCanvas(elements.bg);
  const b = sizeCanvas(elements.ui);
  
  viewport.bgW = a.w;
  viewport.bgH = a.h;
  viewport.width = b.w;
  viewport.height = b.h;
  
  viewport.bgGradient = rebuildBgGradient(elements.bctx, viewport.bgW, viewport.bgH);
  
  // Update ship position if needed
  if (ship.x === 0 && ship.y === 0) {
    ship.x = viewport.width / 2;
    ship.y = viewport.height * 0.86;
  }
}

function handleStartClick() {
  (async () => {
    try {
      await elements.shootSfx?.play();
      elements.shootSfx?.pause();
      elements.shootSfx.currentTime = 0;
    } catch {
      // Ignore errors
    }
    
    startBgMusic();
    
    // Import warp module dynamically to avoid circular dependencies
    const { startWarp, pickWarpTheme } = await import('../modules/warp.js');
    startWarp(pickWarpTheme(true));
  })();
}

function startMainLoop() {
  // Main loop will be set up by the main.js file
  // This is a placeholder for the modularized version
  console.log('[App] Main loop will be initialized by main.js');
}

export { resizeAll, handleStartClick };
