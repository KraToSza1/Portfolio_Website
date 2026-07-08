/**
 * Application Configuration
 * Centralized configuration constants for the portfolio application
 */

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const CONFIG = {
  STARS: {
    COUNT: 420,
    IDLE_SPEED: 0.0,
    CRUISE_SPEED: reduceMotion ? 0.002 : 0.006,
    WARP_SPEED: reduceMotion ? 0.10 : 0.24,
    METEOR_PROB: 0.001,
    METEOR_MAX: 1
  },
  CAMERA: {
    ZOOM: reduceMotion ? 1.35 : 1.85,
    RETURN_DELAY: 180
  },
  UI: {
    SHOW_CROSSHAIR: false
  },
  SHIP: {
    FLIGHT_MS: reduceMotion ? 500 : 900,
    ARC_HEIGHT: 0.18,
    LAND_SCALE: 0.55,
    ANGLE_OFFSET: 0
  },
  AUTOPILOT_IDLE_MS: Infinity,
  WARP: {
    ENTER_FADE_MS: reduceMotion ? 0 : 450,
    HOLD_MS: reduceMotion ? 200 : 1300,
    EXIT_FADE_MS: reduceMotion ? 0 : 350,
    USE_PULSE: !reduceMotion
  }
};

export const COOL_THEMES = ["theme-cyan", "theme-violet"];
export const ALL_THEMES = ["theme-cyan", "theme-violet", "theme-magma", "theme-emerald"];

export const THEME_TINTS = {
  "theme-cyan": [160, 210, 255],
  "theme-violet": [200, 170, 255],
  "theme-magma": [255, 170, 140],
  "theme-emerald": [140, 255, 200]
};
