import { RATIOS, getRatio, closestRatio, fitRect } from './layout.js';
import { renderFrame } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

const SWATCHES = ['#ffffff', '#000000', '#f2e8dc', '#ffd6e0', '#cfe8ff', '#d9f2d0', '#2b2d42', '#e1306c'];
// Preview renders at this fraction of 1080p so dragging sliders stays smooth.
const PREVIEW_SCALE = 0.6;
// 4K video still gets compressed by the browser's encoder; give it plenty of bits.
const VIDEO_BITRATE = { 1: 16_000_000, 2: 60_000_000 };

const DEFAULTS = {
  ratio: '1:1',
  background: 'blur',
  blur: 0.6,
  dim: 0.1,
  color: '#ffffff',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  radius: 0,
  border: 0,
  borderColor: '#ffffff',
  shadow: false,
  res: 2,
  format: 'image/png',
};

let settings = { ...DEFAULTS };
let media = null; // { el, w, h, kind: 'image' | 'video', name, url }
let exporting = false;

// ---------- setup ----------

for (const r of RATIOS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = r.label;
  b.dataset.ratio = r.id;
  b.setAttribute('role', 'radio');
  $('ratios').append(b);
}
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = c;
  b.dataset.color = c;
  b.setAttribute('aria-label', `Background ${c}`);
  $('swatches').append(b);
}

$('ratios').addEventListener('click', (e) => {
  const id = e.target.dataset?.ratio;
  if (id) update({ ratio: id, offsetX: 0, offsetY: 0 });
});
document.querySelectorAll('[data-bg]').forEach((b) =>
  b.addEventListener('click', () => update({ background: b.dataset.bg })),
);
$('swatches').addEventListener('click', (e) => {
  const c = e.target.dataset?.color;
  if (c) update({ color: c, background: 'color' });
});
$('resSeg').addEventListener('click', (e) => {
  const r = e.target.dataset?.res;
  if (r) update({ res: Number(r) });
});
$('fmtSeg').addEventListener('click', (e) => {
  const f = e.target.dataset?.fmt;
  if (f) update({ format: f });
});

for (const id of ['blur', 'dim', 'scale', 'radius', 'border']) {
  $(id).addEventListener('input', (e) => update({ [id]: Number(e.target.value) }));
}
$('color').addEventListener('input', (e) => update({ color: e.target.value, background: 'color' }));
$('borderColor').addEventListener('input', (e) => update({ borderColor: e.target.value }));
$('shadow').addEventListener('change', (e) => update({ shadow: e.target.checked }));

$('resetBtn').addEventListener('click', () => {
  const keep = { ratio: settings.ratio, res: settings.res, format: settings.format };
  update({ ...DEFAULTS, ...keep });
});
$('newBtn').addEventListener('click', () => $('file').click());
$('exportBtn').addEventListener('click', () => (media?.kind === 'video' ? exportVideo() : exportImage(false)));
$('shareBtn').addEventListener('click', () => exportImage(true));

// ---------- loading ----------

$('file').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) load(f);
  e.target.value = '';
});
const drop = $('drop');
for (const t of ['dragenter', 'dragover']) {
  document.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
}
for (const t of ['dragleave', 'drop']) {
  document.addEventListener(t, () => drop.classList.remove('over'));
}
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) load(f);
});

async function load(file) {
  if (exporting) return;
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.src = url;
      v.playsInline = true;
      v.preload = 'auto';
      v.loop = true;
      await once(v, 'loadeddata');
      setMedia({ el: v, w: v.videoWidth, h: v.videoHeight, kind: 'video', name: file.name, url });
      v.addEventListener('timeupdate', syncSeek);
    } else {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      setMedia({ el: img, w: img.naturalWidth, h: img.naturalHeight, kind: 'image', name: file.name, url });
    }
  } catch {
    URL.revokeObjectURL(url);
    status(`Couldn't open "${file.name}". Try a JPEG, PNG, HEIC (Safari), MP4 or MOV file.`);
  }
}

function setMedia(m) {
  if (media) {
    if (media.kind === 'video') media.el.pause();
    media.audio?.ctx.close();
    URL.revokeObjectURL(media.url);
  }
  media = m;
  $('drop').hidden = true;
  $('canvasWrap').hidden = false;
  $('videoBar').hidden = m.kind !== 'video';
  $('panel').setAttribute('aria-disabled', 'false');
  $('shareBtn').hidden = !(m.kind === 'image' && navigator.canShare);
  update({ ratio: closestRatio(m.w, m.h).id, offsetX: 0, offsetY: 0 });
  status(`${m.w}×${m.h} ${m.kind}`);
  if (m.kind === 'video') loop();
}

// ---------- state + drawing ----------

function update(patch) {
  settings = { ...settings, ...patch };
  syncControls();
  draw();
}

function outputSize() {
  const r = getRatio(settings.ratio);
  return { width: r.width * settings.res, height: r.height * settings.res };
}

function draw() {
  if (!media) return;
  const r = getRatio(settings.ratio);
  const w = Math.round(r.width * PREVIEW_SCALE);
  const h = Math.round(r.height * PREVIEW_SCALE);
  if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
  renderFrame(ctx, media.el, media.w, media.h, settings);
}

function loop() {
  if (media?.kind !== 'video') return;
  if (!exporting) draw();
  requestAnimationFrame(loop);
}

function syncControls() {
  const s = settings;
  setOn('[data-ratio]', (b) => b.dataset.ratio === s.ratio);
  setOn('[data-bg]', (b) => b.dataset.bg === s.background);
  setOn('[data-color]', (b) => s.background === 'color' && b.dataset.color === s.color);
  setOn('[data-res]', (b) => Number(b.dataset.res) === s.res);
  setOn('[data-fmt]', (b) => b.dataset.fmt === s.format);
  $('blurOpts').hidden = s.background !== 'blur';
  $('colorOpts').hidden = s.background !== 'color';
  for (const id of ['blur', 'dim', 'scale', 'radius', 'border']) $(id).value = s[id];
  $('color').value = s.color;
  $('borderColor').value = s.borderColor;
  $('shadow').checked = s.shadow;
  $('fmtSeg').hidden = media?.kind === 'video';

  const { width, height } = outputSize();
  let info = `${width}×${height}`;
  if (media?.kind === 'video') info += ', video re-encoded at high bitrate';
  else info += s.format === 'image/png' ? ', no compression' : ', JPEG quality 100%';
  if (media) {
    const fit = fitRect(media.w, media.h, width, height, s);
    if (fit.w > media.w * 1.01) info += `. Your ${media.w}×${media.h} original gets upscaled to fit.`;
  }
  $('exportInfo').textContent = info;
}

function setOn(sel, pred) {
  document.querySelectorAll(sel).forEach((b) => {
    const on = pred(b);
    b.classList.toggle('on', on);
    if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', String(on));
  });
}

// ---------- drag to position ----------

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!media) return;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  drag = { x: e.clientX, y: e.clientY, ox: settings.offsetX, oy: settings.offsetY };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const fit = fitRect(media.w, media.h, rect.width, rect.height, settings);
  const freeX = (rect.width - fit.w) / 2;
  const freeY = (rect.height - fit.h) / 2;
  update({
    offsetX: freeX > 0.5 ? clamp(drag.ox + (e.clientX - drag.x) / freeX, -1, 1) : 0,
    offsetY: freeY > 0.5 ? clamp(drag.oy + (e.clientY - drag.y) / freeY, -1, 1) : 0,
  });
});
for (const t of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(t, () => {
    drag = null;
    canvas.classList.remove('dragging');
  });
}
canvas.addEventListener('dblclick', () => update({ offsetX: 0, offsetY: 0 }));

// ---------- video transport ----------

$('playBtn').addEventListener('click', () => {
  const v = media?.el;
  if (!v || exporting) return;
  if (v.paused) v.play();
  else v.pause();
  $('playBtn').textContent = v.paused ? 'Play' : 'Pause';
});
$('seek').addEventListener('input', (e) => {
  const v = media?.el;
  if (v?.duration) v.currentTime = (e.target.value / 1000) * v.duration;
});
function syncSeek() {
  const v = media?.el;
  if (!v?.duration) return;
  $('seek').value = Math.round((v.currentTime / v.duration) * 1000);
  $('time').textContent = fmtTime(v.currentTime);
}

// ---------- export ----------

function renderFull() {
  const { width, height } = outputSize();
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  renderFrame(out.getContext('2d'), media.el, media.w, media.h, settings);
  return out;
}

async function exportImage(share) {
  if (!media || exporting) return;
  busy(true, 'Rendering…');
  try {
    const out = renderFull();
    const type = settings.format;
    const blob = await new Promise((res) => out.toBlob(res, type, type === 'image/jpeg' ? 1 : undefined));
    if (!blob) throw new Error('This browser could not encode the image at this size.');
    const name = `${baseName(media.name)}-nocrop-${settings.ratio.replace(':', 'x')}.${type === 'image/png' ? 'png' : 'jpg'}`;
    const file = new File([blob], name, { type });
    if (share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      download(blob, name);
    }
    status(`Saved ${out.width}×${out.height} ${type === 'image/png' ? 'PNG' : 'JPEG'} (${mb(blob.size)}).`);
  } catch (err) {
    if (err?.name !== 'AbortError') status(`Export failed: ${err.message}`);
  } finally {
    busy(false);
  }
}

async function exportVideo() {
  if (!media || exporting) return;
  if (!window.MediaRecorder) return status('Video export needs a browser with MediaRecorder support.');
  const mime = ['video/mp4;codecs=avc1.640033', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  if (!mime) return status('This browser cannot record video.');

  const m = media;
  const v = m.el;
  busy(true, 'Rendering video…');
  const out = document.createElement('canvas');
  Object.assign(out, outputSize());
  const octx = out.getContext('2d');
  // Frame rate 0 + requestFrame(): we push each rendered frame ourselves, so a slow
  // encoder can't silently drop the whole video track.
  const stream = out.captureStream(0);
  const [videoTrack] = stream.getVideoTracks();
  const paint = () => {
    renderFrame(octx, v, m.w, m.h, settings);
    videoTrack.requestFrame?.();
  };
  const audio = audioFor(m);
  let audioDest = null;
  if (audio) {
    // Route sound into the recording only, not the speakers, while exporting.
    audioDest = audio.ctx.createMediaStreamDestination();
    audio.src.disconnect();
    audio.src.connect(audioDest);
    audioDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    await audio.ctx.resume();
  }

  try {
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE[settings.res] });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = once(rec, 'stop');

    v.pause();
    v.loop = false;
    v.currentTime = 0;
    await once(v, 'seeked');
    rec.start(1000);
    paint();
    await v.play();

    // Draw once per decoded video frame where supported, else once per display frame.
    const nextFrame = v.requestVideoFrameCallback ? (cb) => v.requestVideoFrameCallback(cb) : requestAnimationFrame;
    await new Promise((resolve) => {
      const tick = () => {
        paint();
        status(`Rendering video… ${Math.round((v.currentTime / v.duration) * 100)}%`);
        if (v.ended || v.paused) resolve();
        else nextFrame(tick);
      };
      nextFrame(tick);
      v.addEventListener('ended', resolve, { once: true });
    });
    paint();
    rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    if (!(await hasPicture(blob))) {
      return status(
        `This browser's video encoder couldn't keep up at ${out.width}×${out.height}. Try 1080p, or Chrome/Edge on a computer with hardware encoding.`,
      );
    }
    download(blob, `${baseName(m.name)}-nocrop-${settings.ratio.replace(':', 'x')}.${ext}`);
    status(`Saved ${out.width}×${out.height} ${ext.toUpperCase()} (${mb(blob.size)}).`);
  } catch (err) {
    status(`Video export failed: ${err.message}`);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    if (audio) {
      audio.src.disconnect();
      audio.src.connect(audio.ctx.destination);
    }
    v.pause();
    v.loop = true;
    $('playBtn').textContent = 'Play';
    busy(false);
  }
}

// A media element can be wired into Web Audio only once, so keep the graph per file.
function audioFor(m) {
  if (m.audio !== undefined) return m.audio;
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(m.el);
    src.connect(ctx.destination);
    m.audio = { ctx, src };
  } catch {
    m.audio = null; // export without sound
  }
  return m.audio;
}

// ---------- helpers ----------

async function hasPicture(blob) {
  const v = document.createElement('video');
  v.muted = true;
  v.src = URL.createObjectURL(blob);
  try {
    await Promise.race([once(v, 'loadedmetadata'), new Promise((r) => setTimeout(r, 5000))]);
    return v.videoWidth > 0;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(v.src);
  }
}

function busy(on, msg) {
  exporting = on;
  $('exportBtn').disabled = on;
  $('exportBtn').textContent = on ? 'Working…' : 'Save';
  if (msg) status(msg);
}
function status(msg) {
  $('status').textContent = msg;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
function once(target, event) {
  return new Promise((resolve, reject) => {
    target.addEventListener(event, resolve, { once: true });
    target.addEventListener('error', reject, { once: true });
  });
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const baseName = (n) => n.replace(/\.[^.]+$/, '') || 'photo';
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

syncControls();
