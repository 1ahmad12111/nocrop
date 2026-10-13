import { fitRect, coverRect } from './layout.js';

// Scratch canvases for the downscale/upscale blur. This works in every browser,
// unlike ctx.filter (missing in older Safari), and stays cheap for video frames.
const small = document.createElement('canvas');
const medium = document.createElement('canvas');

/**
 * Draw one frame: background (blurred copy or solid color) plus the uncropped media.
 * source: anything drawImage accepts (img, video, bitmap).
 */
export function renderFrame(ctx, source, srcW, srcH, s) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (s.background === 'blur') {
    drawBlurred(ctx, source, srcW, srcH, W, H, s.blur);
    if (s.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = s.color;
    ctx.fillRect(0, 0, W, H);
  }

  const r = fitRect(srcW, srcH, W, H, s);
  const radius = Math.min(r.w, r.h) * s.radius * 0.5;

  if (s.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.max(W, H) * 0.03;
    ctx.shadowOffsetY = Math.max(W, H) * 0.008;
    ctx.fillStyle = '#000';
    roundRect(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    ctx.restore();
  }

  if (s.border > 0) {
    const b = Math.max(W, H) * s.border * 0.04;
    ctx.fillStyle = s.borderColor;
    roundRect(ctx, r.x - b, r.y - b, r.w + 2 * b, r.h + 2 * b, radius ? radius + b : 0);
    ctx.fill();
  }

  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.clip();
  ctx.drawImage(source, r.x, r.y, r.w, r.h);
  ctx.restore();

  ctx.restore();
  return r;
}

function drawBlurred(ctx, source, srcW, srcH, W, H, strength) {
  // strength 0..1 → downscale factor 4..48
  const factor = 4 + Math.round(strength * 44);
  const sw = Math.max(2, Math.round(W / factor));
  const sh = Math.max(2, Math.round(H / factor));
  const mw = Math.min(W, sw * 4);
  const mh = Math.min(H, sh * 4);
  if (small.width !== sw || small.height !== sh) Object.assign(small, { width: sw, height: sh });
  if (medium.width !== mw || medium.height !== mh) Object.assign(medium, { width: mw, height: mh });

  const sctx = small.getContext('2d');
  const c = coverRect(srcW, srcH, sw, sh);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(source, c.x, c.y, c.w, c.h);

  // Two upscale steps smooth out the bilinear blockiness of a single big jump.
  const mctx = medium.getContext('2d');
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(small, 0, 0, mw, mh);
  ctx.imageSmoothingQuality = 'high';
  // Overdraw slightly so blurred edges don't fade to transparent.
  const pad = Math.max(W, H) * 0.02;
  ctx.drawImage(medium, -pad, -pad, W + 2 * pad, H + 2 * pad);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
