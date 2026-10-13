// Pure geometry for fitting media into a fixed-ratio frame without cropping.

// Output sizes follow Instagram's recommended upload dimensions.
export const RATIOS = [
  { id: '1:1', label: 'Square 1:1', width: 1080, height: 1080 },
  { id: '4:5', label: 'Portrait 4:5', width: 1080, height: 1350 },
  { id: '3:4', label: 'Portrait 3:4', width: 1080, height: 1440 },
  { id: '9:16', label: 'Story 9:16', width: 1080, height: 1920 },
  { id: '16:9', label: 'Landscape 16:9', width: 1920, height: 1080 },
  { id: '1.91:1', label: 'Landscape 1.91:1', width: 1080, height: 566 },
];

export function getRatio(id) {
  return RATIOS.find((r) => r.id === id) ?? RATIOS[0];
}

/**
 * Where the media goes inside the frame.
 * scale: 0..1 fraction of the largest uncropped size.
 * offsetX/offsetY: -1..1, position within the leftover space (0 = centered).
 */
export function fitRect(srcW, srcH, frameW, frameH, { scale = 1, offsetX = 0, offsetY = 0 } = {}) {
  if (!(srcW > 0 && srcH > 0)) throw new RangeError('source size must be positive');
  const contain = Math.min(frameW / srcW, frameH / srcH);
  const s = contain * clamp(scale, 0.05, 1);
  const w = srcW * s;
  const h = srcH * s;
  const freeX = (frameW - w) / 2;
  const freeY = (frameH - h) / 2;
  return {
    x: freeX + freeX * clamp(offsetX, -1, 1),
    y: freeY + freeY * clamp(offsetY, -1, 1),
    w,
    h,
  };
}

/** Rect that covers the whole frame (cropping the source); used for the blurred background. */
export function coverRect(srcW, srcH, frameW, frameH) {
  if (!(srcW > 0 && srcH > 0)) throw new RangeError('source size must be positive');
  const s = Math.max(frameW / srcW, frameH / srcH);
  const w = srcW * s;
  const h = srcH * s;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

/** Pick the preset closest to the source's own shape. */
export function closestRatio(srcW, srcH) {
  const target = Math.log(srcW / srcH);
  let best = RATIOS[0];
  for (const r of RATIOS) {
    if (Math.abs(Math.log(r.width / r.height) - target) < Math.abs(Math.log(best.width / best.height) - target)) best = r;
  }
  return best;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
