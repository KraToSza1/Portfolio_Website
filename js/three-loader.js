/**
 * Three.js Loader - LOCAL FIRST, then CDN fallback
 * Loads Three.js from local file first, then tries CDNs if needed
 */

(function() {
  'use strict';

  if (window.THREE) {
    console.log('[ThreeLoader] Three.js already loaded');
    return;
  }

  // Try local file FIRST (bypasses CSP issues)
  const localUrl = 'assets/js/three.min.js';
  
  // CDN fallbacks (will fail due to Firefox CSP, but we try anyway)
  const cdnUrls = [
    'https://unpkg.com/three@0.179.1/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r179/three.min.js'
  ];

  let currentIndex = 0;
  let triedLocal = false;

  function loadFromScript(url) {
    return new Promise((resolve, reject) => {
      if (window.THREE) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.type = 'text/javascript';
      script.async = true;
      
      // Don't set crossOrigin for local files
      if (!url.startsWith('http')) {
        // Local file
      } else {
        script.crossOrigin = 'anonymous';
      }

      let checkCount = 0;
      const maxChecks = 30; // 3 seconds max wait

      script.onload = () => {
        // Wait for THREE to be defined
        const checkThree = setInterval(() => {
          checkCount++;
          if (window.THREE) {
            clearInterval(checkThree);
            console.log('[ThreeLoader] ✅ Successfully loaded from:', url);
            resolve();
          } else if (checkCount >= maxChecks) {
            clearInterval(checkThree);
            reject(new Error('THREE not defined after load'));
          }
        }, 100);
      };

      script.onerror = () => {
        reject(new Error('Failed to load script'));
      };

      document.head.appendChild(script);
    });
  }

  async function tryLoad() {
    if (window.THREE) {
      console.log('[ThreeLoader] Three.js ready!');
      return;
    }

    // First, try LOCAL file (bypasses CSP)
    if (!triedLocal) {
      triedLocal = true;
      try {
        await loadFromScript(localUrl);
        if (window.THREE) {
          console.log('[ThreeLoader] ✅ Loaded from LOCAL file');
          return;
        }
      } catch (err) {
        console.warn('[ThreeLoader] Local file not found, trying CDNs...');
        // Continue to CDN fallbacks
      }
    }

    // Try CDN fallbacks (will likely fail due to Firefox CSP)
    if (currentIndex < cdnUrls.length) {
      try {
        await loadFromScript(cdnUrls[currentIndex]);
        if (window.THREE) return;
      } catch (err) {
        console.warn('[ThreeLoader] Failed from:', cdnUrls[currentIndex], err.message);
        currentIndex++;
        setTimeout(tryLoad, 200);
      }
    } else {
      // All failed
      console.error('[ThreeLoader] ❌ All loading attempts failed!');
      console.error('[ThreeLoader] Please download Three.js manually:');
      console.error('[ThreeLoader] 1. Go to: https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.min.js');
      console.error('[ThreeLoader] 2. Save as: assets/js/three.min.js');
      console.error('[ThreeLoader] 3. Refresh the page');
    }
  }

  // Start loading immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryLoad);
  } else {
    tryLoad();
  }

  // Also try after a short delay
  setTimeout(() => {
    if (!window.THREE && !triedLocal) {
      tryLoad();
    }
  }, 500);
})();
