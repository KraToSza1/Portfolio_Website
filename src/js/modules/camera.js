/**
 * Camera Module
 * Handles camera zoom, pan, and transitions
 */

import { CONFIG } from '../core/config.js';
import { camera, starfield } from '../core/state.js';

/**
 * Update camera position and scale
 */
export function updateCam() {
  camera.x += (camera.tx - camera.x) * 0.12;
  camera.y += (camera.ty - camera.y) * 0.12;
  camera.scale += (camera.ts - camera.scale) * 0.12;
  
  if (camera.active && 
      Math.abs(camera.x - camera.tx) < 0.6 && 
      Math.abs(camera.y - camera.ty) < 0.6 && 
      Math.abs(camera.scale - camera.ts) < 0.01) {
    camera.active = false;
    if (!camera.arriving) {
      camera.arriving = true;
      setTimeout(() => {
        camera.arriving = false;
        camera.tx = 0;
        camera.ty = 0;
        camera.ts = 1;
        if (typeof camera.onArrive === "function") {
          camera.onArrive();
        }
        camera.onArrive = null;
        starfield.warpTarget = CONFIG.STARS.CRUISE_SPEED;
      }, CONFIG.CAMERA.RETURN_DELAY);
    }
  }
}
