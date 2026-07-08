/**
 * Browser Compatibility Layer
 * Fixes cross-browser issues for Firefox, Chrome, Edge, Opera, Safari
 */

(function() {
  'use strict';

  // Polyfill for requestAnimationFrame
  if (!window.requestAnimationFrame) {
    let lastTime = 0;
    window.requestAnimationFrame = function(callback) {
      const currTime = Date.now();
      const timeToCall = Math.max(0, 16 - (currTime - lastTime));
      const id = setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };
    window.cancelAnimationFrame = function(id) { clearTimeout(id); };
  }

  // Polyfill for performance.now with better precision
  if (!window.performance || !window.performance.now) {
    const startTime = Date.now();
    window.performance = window.performance || {};
    window.performance.now = function() {
      return Date.now() - startTime;
    };
  }

  // Fix for Firefox canvas context creation
  if (CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.setTransform) {
    CanvasRenderingContext2D.prototype.setTransform = function(a, b, c, d, e, f) {
      this.transform(a, b, c, d, e, f);
    };
  }

  // Fix matchMedia for older browsers
  if (!window.matchMedia) {
    window.matchMedia = function(query) {
      return {
        matches: false,
        media: query,
        addListener: function() {},
        removeListener: function() {},
        addEventListener: function() {},
        removeEventListener: function() {}
      };
    };
  }

  // Visual Viewport API polyfill
  if (!window.visualViewport) {
    Object.defineProperty(window, 'visualViewport', {
      get: function() {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          offsetLeft: 0,
          offsetTop: 0,
          scale: 1,
          pageLeft: window.pageXOffset || window.scrollX || 0,
          pageTop: window.pageYOffset || window.scrollY || 0
        };
      },
      configurable: true
    });
  }

  // Better WebGL context creation for cross-browser support
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(contextType, attributes) {
    // Enhanced WebGL context creation with fallbacks
    if (contextType === 'webgl' || contextType === 'experimental-webgl') {
      try {
        // Try with attributes first
        const ctx = originalGetContext.call(this, contextType, attributes);
        if (ctx) return ctx;
      } catch (e) {
        // Continue to fallback
      }
      
      // Fallback: try without strict attributes (for Firefox/Edge)
      try {
        const ctx = originalGetContext.call(this, 'webgl') 
                 || originalGetContext.call(this, 'experimental-webgl');
        if (ctx) return ctx;
      } catch (e) {
        console.warn('[Compat] WebGL context creation failed:', e);
      }
    }
    
    // Default behavior for other contexts
    return originalGetContext.call(this, contextType, attributes);
  };

  // Fix Object.assign for older browsers
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      const to = Object(target);
      for (let index = 1; index < arguments.length; index++) {
        const nextSource = arguments[index];
        if (nextSource != null) {
          for (const nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }

  // Fix Math.hypot for older browsers
  if (!Math.hypot) {
    Math.hypot = function() {
      let y = 0, i = arguments.length;
      while (i--) y += arguments[i] * arguments[i];
      return Math.sqrt(y);
    };
  }

  console.log('[Compat] Browser compatibility layer loaded');
})();

