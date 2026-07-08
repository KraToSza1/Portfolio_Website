/**
 * Throttling Utilities
 * Performance optimization helpers
 */

/**
 * Throttle function using requestAnimationFrame
 */
export function throttleRAF(fn) {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fn(...args);
    });
  };
}

/**
 * Update viewport CSS variables for mobile address bar handling
 */
export function updateViewportVars() {
  const vv = window.visualViewport;
  const vh = (vv?.height || window.innerHeight) * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
