/**
 * Image Loading Utilities
 * Functions for lazy loading and warming images
 */

const supportsCreateImageBitmap = 'createImageBitmap' in window;

/**
 * Warm a single image asynchronously
 */
export async function warmImage(url, priority = 'low') {
  try {
    const resp = await fetch(url, { priority }).catch(() => fetch(url));
    if (!resp || !resp.ok) return;
    const blob = await resp.blob();
    if (supportsCreateImageBitmap) {
      await createImageBitmap(blob);
    } else {
      const img = new Image();
      try {
        img.decoding = 'async';
      } catch {}
      img.src = URL.createObjectURL(blob);
      await img.decode().catch(() => {});
      URL.revokeObjectURL(img.src);
    }
  } catch (_) {
    /* ignore */
  }
}

/**
 * Warm images sequentially to avoid overloading
 */
export function warmImagesSequential(urls) {
  let i = 0;
  const next = () => {
    if (i >= urls.length) return;
    warmImage(urls[i++]).finally(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(next, { timeout: 1500 });
      } else {
        setTimeout(next, 0);
      }
    });
  };
  next();
}
