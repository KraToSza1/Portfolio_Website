/**
 * Math Utilities
 * Mathematical helper functions
 */

/**
 * Cubic Bezier curve calculation
 */
export function cubic(p0, p1, p2, p3, t) {
  const it = 1 - t;
  return {
    x: it * it * it * p0.x + 3 * it * it * t * p1.x + 3 * it * t * t * p2.x + t * t * t * p3.x,
    y: it * it * it * p0.y + 3 * it * it * t * p1.y + 3 * it * t * t * p2.y + t * t * t * p3.y
  };
}

/**
 * Cubic Bezier tangent calculation
 */
export function cubicTangent(p0, p1, p2, p3, t) {
  const it = 1 - t;
  return {
    x: 3 * it * it * (p1.x - p0.x) + 6 * it * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * it * it * (p1.y - p0.y) + 6 * it * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
  };
}

/**
 * Ease in-out cubic easing function
 */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
