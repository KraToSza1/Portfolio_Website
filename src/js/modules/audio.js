/**
 * Audio Management Module
 * Handles background music and sound effects
 */

import { elements } from '../core/state.js';

/**
 * Fade audio volume smoothly
 */
export function fadeTo(audio, target = 0.12, ms = 1200) {
  if (!audio) return;
  const steps = 24;
  const step = (target - (audio.volume || 0)) / steps;
  let i = 0;
  const id = setInterval(() => {
    i++;
    audio.volume = Math.max(0, Math.min(1, (audio.volume || 0) + step));
    if (i >= steps) clearInterval(id);
  }, Math.max(16, Math.floor(ms / steps)));
}

/**
 * Start background music with fade-in
 */
export function startBgMusic() {
  const { bgMusic } = elements;
  if (!bgMusic) return;
  
  bgMusic.volume = 0.15;
  bgMusic.currentTime = 0;
  bgMusic.play().then(() => {
    fadeTo(bgMusic, 0.12, 1200);
  }).catch(() => {
    // Fallback if blocked by autoplay policy
    const tryResume = () => {
      bgMusic.play().then(() => {
        fadeTo(bgMusic, 0.12, 1200);
        removeEventListener("pointerdown", tryResume, true);
        removeEventListener("keydown", tryResume, true);
      }).catch(() => {});
    };
    addEventListener("pointerdown", tryResume, true);
    addEventListener("keydown", tryResume, true);
  });
}

/**
 * Play shoot sound effect safely
 */
export function playShootSfx() {
  try {
    if (elements.shootSfx) {
      elements.shootSfx.volume = 0.22;
      elements.shootSfx.currentTime = 0;
      elements.shootSfx.play();
    }
  } catch {
    // Ignore errors
  }
}
