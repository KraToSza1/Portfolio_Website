// ========================== ELEMENTS ==========================
const bg = document.getElementById("bg-canvas");
const bctx = bg.getContext("2d", { alpha: false });

const stage = document.getElementById("stage");
const ui = document.getElementById("fps-canvas");
const uictx = ui.getContext("2d", { alpha: true });

const intro = document.getElementById("intro");
const warpOverlay = document.getElementById("warp");
const startBtn = document.getElementById("start-button");
const shootSfx = document.getElementById("sfx-shoot");
const bgMusic = document.getElementById("bg-music");

// set default SFX volume
if (shootSfx) shootSfx.volume = 0.12;

// ---------- Sound toggle (music + SFX), persisted across visits ----------
const audioToggle = document.getElementById("audio-toggle");
let soundMuted = false;
try { soundMuted = localStorage.getItem("rvdw-sound-muted") === "1"; } catch {}

function applySoundState(){
  window.__RVDW_MUTED = soundMuted; // read by the arcade module
  if (bgMusic)  bgMusic.muted  = soundMuted;
  if (shootSfx) shootSfx.muted = soundMuted;
  if (bgMusic){
    if (soundMuted && !bgMusic.paused) bgMusic.pause();
    else if (!soundMuted && missionStarted && bgMusic.paused){
      bgMusic.volume = 0.12;
      bgMusic.play().catch(() => {});
    }
  }
  if (audioToggle){
    audioToggle.dataset.muted = soundMuted ? "true" : "false";
    audioToggle.setAttribute("aria-pressed", soundMuted ? "true" : "false");
    audioToggle.setAttribute("aria-label", soundMuted ? "Turn sound on" : "Turn sound off");
    audioToggle.title = soundMuted ? "Sound: off" : "Sound: on";
  }
}
audioToggle?.addEventListener("click", () => {
  soundMuted = !soundMuted;
  try { localStorage.setItem("rvdw-sound-muted", soundMuted ? "1" : "0"); } catch {}
  applySoundState();
});

// Site data (skills, links, etc.)
const SITE = (() => { try { return JSON.parse(document.getElementById("site-data")?.textContent || "{}"); } catch { return {}; } })();
const APP_OPTS = window.APP_OPTS || {};

// soft fade helper
function fadeTo(audio, target = 0.12, ms = 1200) {
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

function startBgMusic() {
  if (!bgMusic || soundMuted) return;
  bgMusic.volume = 0.15;
  bgMusic.currentTime = 0;
  bgMusic.play().then(() => {
    fadeTo(bgMusic, 0.12, 1200);
  }).catch(() => {
    // fallback if blocked
    const tryResume = () => {
      bgMusic.play().then(() => {
        fadeTo(bgMusic, 0.12, 1200);
        removeEventListener("pointerdown", tryResume, true);
        removeEventListener("keydown", tryResume, true);
      }).catch(()=>{});
    };
    addEventListener("pointerdown", tryResume, true);
    addEventListener("keydown", tryResume, true);
  });
}

// example helper for playing shoot sound safely
function playShootSfx() {
  try {
    if (shootSfx) {
      shootSfx.volume = 0.22; // ensure volume each play
      shootSfx.currentTime = 0;
      shootSfx.play();
    }
  } catch {}
}


// ========================== CONFIG / STATE ==========================
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const CONFIG = {
  STARS: {
    COUNT: 420,
    IDLE_SPEED: 0.0,
    CRUISE_SPEED: reduceMotion ? 0.002 : 0.006,
    WARP_SPEED: reduceMotion ? 0.10 : 0.24, // warp factor
    METEOR_PROB: 0.001,
    METEOR_MAX: 1
  },
  CAMERA: { ZOOM: reduceMotion ? 1.35 : 1.85, RETURN_DELAY: 180 },
  UI: { SHOW_CROSSHAIR: false },
  SHIP: { FLIGHT_MS: reduceMotion ? 500 : 900, ARC_HEIGHT: 0.18, LAND_SCALE: 0.55, ANGLE_OFFSET: 0 },
  AUTOPILOT_IDLE_MS: Infinity,

  WARP: {
    ENTER_FADE_MS: reduceMotion ? 0 : 450,
    HOLD_MS:       reduceMotion ? 200 : 1300,
    EXIT_FADE_MS:  reduceMotion ? 0 : 350,
    USE_PULSE:     !reduceMotion
  }
};

// === Lazy warmers for big planet PNGs (sequential, low priority) ===
const supportsCreateImageBitmap = 'createImageBitmap' in window;

async function warmImage(url, priority = 'low') {
  try {
    const resp = await fetch(url, { priority }).catch(() => fetch(url));
    if (!resp || !resp.ok) return;
    const blob = await resp.blob();
    if (supportsCreateImageBitmap) {
      await createImageBitmap(blob);        // off-main-thread decode in Chromium/Firefox
    } else {
      const img = new Image();
      try { img.decoding = 'async'; } catch {}
      img.src = URL.createObjectURL(blob);
      await img.decode().catch(() => {});
      URL.revokeObjectURL(img.src);
    }
  } catch (_) { /* ignore */ }
}

function warmImagesSequential(urls) {
  let i = 0;
  const next = () => {
    if (i >= urls.length) return;
    warmImage(urls[i++]).finally(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(next, { timeout: 1500 });
      else setTimeout(next, 0);
    });
  };
  next();
}

// Cool palette preference (safer/less white)
const COOL_THEMES = ["theme-cyan","theme-violet"];
const ALL_THEMES  = ["theme-cyan","theme-violet","theme-magma","theme-emerald"];

// === NEW: star tint that follows the theme =========================
let starTint = [160,210,255]; // default cyan-ish
const THEME_TINTS = {
  "theme-cyan":   [160,210,255],
  "theme-violet": [200,170,255],
  "theme-magma":  [255,170,140],
  "theme-emerald":[140,255,200]
};
function setStarTintFromTheme(theme){ starTint = THEME_TINTS[theme] || [160,210,255]; }

// cached vanishing-point glow for the hyperspace tunnel (one per theme tint)
const warpGlowCache = new Map();
function getWarpGlow(){
  const key = starTint.join(",");
  let c = warpGlowCache.get(key);
  if (c) return c;
  const size = 256, half = size / 2;
  c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0,    "rgba(255,255,255,0.5)");
  g.addColorStop(0.25, `rgba(${starTint[0]},${starTint[1]},${starTint[2]},0.32)`);
  g.addColorStop(0.6,  `rgba(${starTint[0]},${starTint[1]},${starTint[2]},0.10)`);
  g.addColorStop(1,    `rgba(${starTint[0]},${starTint[1]},${starTint[2]},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  warpGlowCache.set(key, c);
  return c;
}

// 3D ship state (Three.js only)
let ship = { x: 0, y: 0, angle: -90, moving: false, onArrive: null, path: null, t0: 0, dur: CONFIG.SHIP.FLIGHT_MS };

// DPI + input
let dpr = Math.max(1, window.devicePixelRatio || 1);
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
let lastInputAt = performance.now(), autopilotLock = false;

// ========================== VIEWPORT / SIZING ==========================
// cache canvas CSS pixel sizes to avoid layout reads per frame
let width = 0, height = 0, bgW = 0, bgH = 0;
let bgGradient = null;

// Dynamic --vh for mobile address-bar changes
function updateViewportVars(){
  const vv = window.visualViewport;
  const vh = (vv?.height || window.innerHeight) * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
updateViewportVars();

// Throttle util
function throttleRAF(fn){
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; fn(...args); });
  };
}

function sizeCanvas(c) {
  // Use visualViewport if available for more accurate iOS sizing
  const vw = Math.floor(window.visualViewport?.width || window.innerWidth);
  const vh = Math.floor(window.visualViewport?.height || window.innerHeight);

  c.width = Math.floor(vw * dpr);
  c.height = Math.floor(vh * dpr);
  c.style.width = vw + "px";
  c.style.height = vh + "px";

  const ctx = c.getContext("2d");
  // Reset transform each time we change backing size
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { w: vw, h: vh };
}

function rebuildBgGradient() {
  // PERF: bake the base gradient AND the nebula into ONE cached canvas at
  // DEVICE resolution — per-frame background cost becomes a single 1:1 blit
  // (a CSS-px cache would be re-filtered/upscaled every frame on HiDPI)
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bgW * dpr));
  c.height = Math.max(1, Math.round(bgH * dpr));
  const x = c.getContext("2d");
  x.scale(dpr, dpr);

  const grd = x.createRadialGradient(bgW*0.2,bgH*0.15,0,bgW*0.5,bgH*0.5,Math.max(bgW,bgH));
  grd.addColorStop(0,"#0a0b12"); grd.addColorStop(0.6,"#06070d"); grd.addColorStop(1,"#000");
  x.fillStyle = grd; x.fillRect(0,0,bgW,bgH);

  if (!reduceMotion) {
    x.save();
    x.globalAlpha = 0.18;
    const nebula = x.createRadialGradient(bgW*0.5, bgH*0.5, 0, bgW*0.6, bgH*0.6, bgW*0.8);
    nebula.addColorStop(0,   "rgba(150, 100, 255, 0.12)");
    nebula.addColorStop(0.4, "rgba(100, 150, 255, 0.08)");
    nebula.addColorStop(0.7, "rgba(100, 255, 200, 0.05)");
    nebula.addColorStop(1,   "transparent");
    x.fillStyle = nebula; x.fillRect(0,0,bgW,bgH);
    x.restore();
  }

  bgGradient = c;
}

function resizeAll() {
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // clamp DPR: >2 is invisible but 2x+ the fill cost
  const a = sizeCanvas(bg);
  const b = sizeCanvas(ui);

  bgW = a.w; bgH = a.h;
  width = b.w; height = b.h;
  rebuildBgGradient();

  placeShipAt(ship.x || (width/2),
              ship.y || (height*0.86),
              ship.angle);
}
const onResize = throttleRAF(() => { updateViewportVars(); resizeAll(); });
addEventListener("resize", onResize, { passive:true });
addEventListener("orientationchange", () => setTimeout(onResize, 50), { passive:true });
if (window.visualViewport){
  window.visualViewport.addEventListener("resize", onResize, { passive:true });
}

resizeAll();

// React to display scale changes (DPR)
try {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", onResize, { passive:true });
} catch { /* some browsers don't support this exact query */ }

// ========================== WARP FX (built from scratch) ==========================
// Self-contained hyperspace effect. Design goals:
//  - runs on ANY canvas-capable browser: no Path2D, no exotic APIs,
//    zero allocations in the hot loop (no GC hitches)
//  - constant cost: exactly 3 batched strokes + 1 glow blit per frame,
//    regardless of star count or warp speed
//  - time-based motion (identical feel at 30fps or 144fps)
//  - perspective model: particles accelerate outward from a vanishing
//    point, streak length grows with speed and distance (like real
//    light-speed footage), depth sold via 3 brightness/width layers
const WarpFX = (function () {
  const LAYERS = [
    { w: 1.0, a: 0.20, sp: 0.55 },  // far: thin + faint + slow
    { w: 1.9, a: 0.32, sp: 0.85 },  // mid
    { w: 3.0, a: 0.46, sp: 1.25 }   // near: thick + bright + fast
  ];
  const COUNT = 216; // divisible by 3 layers
  const parts = [];
  function seed() {
    parts.length = 0;
    for (let i = 0; i < COUNT; i++) {
      parts.push({
        ang: Math.random() * Math.PI * 2,
        dist: 0.05 + Math.pow(Math.random(), 0.6) // 0..1 normalized radius
      });
    }
  }
  seed();

  function render(ctx, cx, cy, maxR, intensity, dt, tint) {
    const k = Math.max(0, Math.min(1, intensity));
    if (k <= 0.01) return;

    // vanishing-point glow (cached sprite, grows with speed)
    const glow = getWarpGlow();
    const gr = maxR * (0.35 + 0.45 * k);
    ctx.globalAlpha = 0.6 * k;
    ctx.drawImage(glow, cx - gr, cy - gr, gr * 2, gr * 2);
    ctx.globalAlpha = 1;

    if (reduceMotion) return; // glow only — no rushing streaks

    const dtn = Math.min(3, dt / 16.7); // time-normalized step
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // overlaps build a bright core
    ctx.lineCap = "round";

    for (let L = 0; L < 3; L++) {
      const lay = LAYERS[L];
      ctx.strokeStyle = "rgba(" + tint[0] + "," + tint[1] + "," + tint[2] + "," +
                        (lay.a * (0.3 + 0.7 * k)).toFixed(3) + ")";
      ctx.lineWidth = lay.w * (0.5 + 1.7 * k);
      ctx.beginPath();
      for (let i = L; i < COUNT; i += 3) {
        const p = parts[i];
        // perspective: speed scales with distance from the vanishing point
        p.dist += (0.0025 + p.dist * 0.065 * lay.sp * k) * dtn;
        if (p.dist > 1.08) {           // recycle in place — no allocation
          p.dist = 0.03 + Math.random() * 0.14;
          p.ang = Math.random() * Math.PI * 2;
        }
        const streak = Math.min(0.34, 0.015 + p.dist * 0.38 * k);
        const d1 = Math.max(0.004, p.dist - streak);
        const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
        ctx.moveTo(cx + ca * p.dist * maxR, cy + sa * p.dist * maxR);
        ctx.lineTo(cx + ca * d1 * maxR, cy + sa * d1 * maxR);
      }
      ctx.stroke(); // ONE stroke per layer
    }
    ctx.restore();
  }

  return { render: render, reseed: seed };
})();

// ========================== STARFIELD ==========================
let starSpeed = CONFIG.STARS.IDLE_SPEED;
let warpTarget = CONFIG.STARS.IDLE_SPEED;
const stars = Array.from({ length: CONFIG.STARS.COUNT }, () => spawnStar());
const meteors = [];

// ADD: simple adaptive quality flag (auto toggled below)
let LOW_END = false;                   // heuristic jank detector flips this
let STAR_STEP = 1;                     // draw every STAR_STEP-th star

// ========================== DISTANT SUN/PLANET ==========================
// Glowing sun/planet in the far distance (top-right corner)
// Only shows after mission starts (Enter Mission button clicked)
let missionStarted = false; // Track if mission has started

const DISTANT_SUN = {
  x: 0.85,           // Position (0-1): 85% from left (right side)
  y: 0.15,           // Position (0-1): 15% from top (top area)
  baseRadius: 35,    // Base radius in pixels (scales with viewport) - much smaller!
  glowRadius: 80,   // Glow radius - much smaller!
  pulseSpeed: 0.0004, // MUCH slower pulse (more sun-like, less strobing)
  pulseAmount: 0.03,  // MUCH less pulsing (3% instead of 15% - more stable)
  color: [255, 235, 190], // Warmer, more sun-like orange/yellow
  glowColor: [255, 210, 160], // Glow color (softer, warmer)
  time: 0             // Animation time
};

// PERF: reset stars IN PLACE — allocating fresh objects for every respawn
// during warp caused GC pauses (= stutter) right in the middle of the effect
function resetStar(s) {
  s.x = (Math.random()-0.5)*bgW*2;
  s.y = (Math.random()-0.5)*bgH*2;
  s.base = 0.15+Math.random()*0.35;
  s.a = 0; s.ta = 0;
  s.next = performance.now()+500+Math.random()*1500;
  s.twEnd = 0;
  return s;
}
function spawnStar() { return resetStar({}); }
function spawnMeteor() {
  const edges = ["top","right","bottom","left"][Math.floor(Math.random()*4)];
  let x, y, vx, vy; const speed = 3.5 + Math.random()*2.2;
  if (edges==="top"){ x=Math.random()*width; y=-20; vx=(Math.random()*2-1)*0.6; vy=speed; }
  if (edges==="bottom"){ x=Math.random()*width; y=height+20; vx=(Math.random()*2-1)*0.6; vy=-speed; }
  if (edges==="left"){ x=-20; y=Math.random()*height; vx=speed; vy=(Math.random()*2-1)*0.6; }
  if (edges==="right"){ x=width+20; y=Math.random()*height; vx=-speed; vy=(Math.random()*2-1)*0.6; }
  meteors.push({ x, y, vx, vy, life: 0, maxLife: 120 + Math.random()*100, len: 40 + Math.random()*60 });
}
function updateMeteors(ctx){
  if (!reduceMotion && Math.random() < CONFIG.STARS.METEOR_PROB && meteors.length < CONFIG.STARS.METEOR_MAX) spawnMeteor();
  ctx.lineCap = "round";
  for (let i = meteors.length - 1; i >= 0; i--){
    const m = meteors[i];
    m.x += m.vx; m.y += m.vy; m.life++;
    const tailX = m.x - m.vx * (m.len / 10);
    const tailY = m.y - m.vy * (m.len / 10);
    const alpha = Math.max(0, 1 - m.life / m.maxLife);
    ctx.strokeStyle = `rgba(255,255,255,${0.50*alpha})`;
    ctx.lineWidth = Math.max(1, 1.6*alpha);
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tailX, tailY); ctx.stroke();
    if (m.life>m.maxLife || m.x<-120 || m.y<-120 || m.x>width+120 || m.y>height+120) meteors.splice(i,1);
  }
}

// ===== PERF: cached sprites (glows + labels) ==============================
// Canvas shadowBlur + per-frame gradient/text rendering were the main causes
// of jank during planet flights — everything below renders ONCE to an
// offscreen canvas and is drawn with a single drawImage per frame.

const glowSpriteCache = new Map();
function getGlowSprite(color){
  let c = glowSpriteCache.get(color);
  if (c) return c;
  const size = 128, half = size / 2;
  c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(half, half, size * 0.16, half, half, half);
  g.addColorStop(0,   color + "66");
  g.addColorStop(0.5, color + "22");
  g.addColorStop(1,   color + "00");
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  glowSpriteCache.set(color, c);
  return c;
}

const LABEL_SS = 2; // supersample so labels stay crisp under camera zoom
function ensureLabelSprite(t){
  if (t._labelSprite) return;
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  const f1 = "600 17px 'Space Grotesk', 'Segoe UI', sans-serif";
  const f2 = "13px 'Inter', 'Segoe UI', sans-serif";
  x.font = f1; const w1 = x.measureText(t.label || "").width;
  x.font = f2; const w2 = x.measureText(`· ${t.name}`).width;
  const pad = 16;
  const w = Math.ceil(Math.max(w1, w2)) + pad * 2;
  const h = 56;
  c.width = w * LABEL_SS; c.height = h * LABEL_SS;
  x.scale(LABEL_SS, LABEL_SS);
  x.textAlign = "center"; x.textBaseline = "top";
  x.font = f1;
  x.shadowColor = "rgba(138, 216, 255, 0.65)";
  x.shadowBlur = 10;
  x.fillStyle = "rgba(238, 242, 255, 0.96)";
  x.fillText(t.label || "", w / 2, 4);
  x.shadowBlur = 0;
  x.font = f2;
  x.fillStyle = "rgba(160, 172, 200, 0.95)";
  x.fillText(`· ${t.name}`, w / 2, 30);
  t._labelSprite = { canvas: c, w, h };
}

// PERF: the sun is pre-rendered to an offscreen sprite once per viewport size —
// building 4 radial gradients per frame was a major source of jank
let sunSprite = null, sunSpriteKey = "";
function buildSunSprite(scale){
  const half = Math.max(12, 100 * scale); // covers corona (radius*2.5) + margin
  const size = Math.ceil(half * 2);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const radius = DISTANT_SUN.baseRadius * scale;
  const glowRadius = DISTANT_SUN.glowRadius * scale;
  const gc = DISTANT_SUN.glowColor, cc = DISTANT_SUN.color;

  const outerGlow = x.createRadialGradient(half, half, radius * 0.4, half, half, glowRadius);
  outerGlow.addColorStop(0,   `rgba(${gc[0]}, ${gc[1]}, ${gc[2]}, 0.28)`);
  outerGlow.addColorStop(0.4, `rgba(${gc[0]}, ${gc[1]}, ${gc[2]}, 0.15)`);
  outerGlow.addColorStop(0.7, `rgba(${gc[0]}, ${gc[1]}, ${gc[2]}, 0.08)`);
  outerGlow.addColorStop(1,   "rgba(255, 200, 150, 0)");
  x.fillStyle = outerGlow;
  x.beginPath(); x.arc(half, half, glowRadius, 0, Math.PI * 2); x.fill();

  const middleGlow = x.createRadialGradient(half, half, radius * 0.6, half, half, radius * 1.5);
  middleGlow.addColorStop(0,   `rgba(${cc[0]}, ${cc[1]}, ${cc[2]}, 0.5)`);
  middleGlow.addColorStop(0.5, `rgba(${cc[0]}, ${cc[1]}, ${cc[2]}, 0.28)`);
  middleGlow.addColorStop(0.8, `rgba(${cc[0]}, ${cc[1]}, ${cc[2]}, 0.12)`);
  middleGlow.addColorStop(1,   "rgba(255, 220, 180, 0)");
  x.fillStyle = middleGlow;
  x.beginPath(); x.arc(half, half, radius * 1.5, 0, Math.PI * 2); x.fill();

  const innerCore = x.createRadialGradient(half, half, radius * 0.2, half, half, radius);
  innerCore.addColorStop(0,   "rgba(255, 255, 245, 0.98)");
  innerCore.addColorStop(0.2, "rgba(255, 250, 230, 0.95)");
  innerCore.addColorStop(0.4, `rgba(${cc[0]}, ${cc[1]}, ${cc[2]}, 0.9)`);
  innerCore.addColorStop(0.7, `rgba(${cc[0]}, ${cc[1]}, ${cc[2]}, 0.7)`);
  innerCore.addColorStop(1,   "rgba(255, 210, 160, 0.4)");
  x.fillStyle = innerCore;
  x.beginPath(); x.arc(half, half, radius, 0, Math.PI * 2); x.fill();

  x.save();
  x.globalCompositeOperation = "screen";
  x.globalAlpha = 0.12;
  const corona = x.createRadialGradient(half, half, radius * 0.9, half, half, radius * 2.5);
  corona.addColorStop(0,   "rgba(255, 245, 210, 0.25)");
  corona.addColorStop(0.5, "rgba(255, 230, 180, 0.15)");
  corona.addColorStop(1,   "rgba(255, 200, 150, 0)");
  x.fillStyle = corona;
  x.beginPath(); x.arc(half, half, radius * 2.5, 0, Math.PI * 2); x.fill();
  x.restore();

  return c;
}

function renderDistantSun(ctx, now) {
  if (!missionStarted || reduceMotion) return;

  const scale = Math.min(bgW, bgH) / 1000;
  const key = Math.round(scale * 100);
  if (!sunSprite || sunSpriteKey !== key) { sunSprite = buildSunSprite(scale); sunSpriteKey = key; }

  const pulse = 1.0 + Math.sin(now * DISTANT_SUN.pulseSpeed) * DISTANT_SUN.pulseAmount;
  const parallaxFactor = 0.0002 * 15;
  const sunX = bgW * DISTANT_SUN.x + (mouseX - bgW/2) * parallaxFactor;
  const sunY = bgH * DISTANT_SUN.y + (mouseY - bgH/2) * parallaxFactor;
  const half = (sunSprite.width / 2) * pulse;
  ctx.drawImage(sunSprite, sunX - half, sunY - half, half * 2, half * 2);
}

// ========================== TIE FIGHTER SILHOUETTES ==========================
const TIE_FIGHTERS = [];
let tieFighterLastUpdate = 0;
const TIE_UPDATE_INTERVAL = 50; // Update TIE fighters every 50ms (20fps instead of 60fps)

function initTIEFighters() {
  // Reduced count for performance - only 2 TIE fighters
  const count = 2;
  for (let i = 0; i < count; i++) {
    TIE_FIGHTERS.push({
      x: Math.random() * bgW,
      y: Math.random() * bgH * 0.3,
      speed: 0.15 + Math.random() * 0.2,
      size: 10 + Math.random() * 8,
      alpha: 0.12 + Math.random() * 0.08,
      time: Math.random() * Math.PI * 2
    });
  }
}

function drawTIEFighters(ctx, now) {
  if (reduceMotion || !missionStarted) return;

  if (TIE_FIGHTERS.length === 0) initTIEFighters();

  // Throttle POSITION updates only — always draw, otherwise the fighters
  // flicker in and out (the bg canvas is repainted every frame)
  const doUpdate = now - tieFighterLastUpdate >= TIE_UPDATE_INTERVAL;
  if (doUpdate) tieFighterLastUpdate = now;

  ctx.save();

  TIE_FIGHTERS.forEach(tie => {
    if (doUpdate) {
      tie.time += 0.0005;
      tie.x += Math.sin(tie.time) * 0.2;
      tie.y += tie.speed;

      // Wrap around screen
      if (tie.x < -50) tie.x = bgW + 50;
      if (tie.x > bgW + 50) tie.x = -50;
      if (tie.y > bgH + 50) {
        tie.y = -50;
        tie.x = Math.random() * bgW;
      }
    }

    ctx.globalAlpha = tie.alpha;
    ctx.fillStyle = "rgba(150, 150, 150, 0.7)";
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1;
    
    // Main body only (simpler for performance)
    ctx.beginPath();
    ctx.arc(tie.x, tie.y, tie.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings (single call with moveTo)
    ctx.beginPath();
    ctx.arc(tie.x - tie.size * 0.5, tie.y, tie.size * 0.35, 0, Math.PI * 2);
    ctx.moveTo(tie.x + tie.size * 0.5, tie.y);
    ctx.arc(tie.x + tie.size * 0.5, tie.y, tie.size * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  });
  
  ctx.restore();
}

// (nebula is baked into the background cache — see rebuildBgGradient)

function renderStars(dt = 16.7) {
  // paint bg (gradient + nebula pre-baked at device res; 1:1 copy, no filtering)
  bctx.save();
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.drawImage(bgGradient, 0, 0);
  bctx.restore();

  // Draw distant sun/planet BEFORE stars (so stars appear in front)
  const now = performance.now();
  renderDistantSun(bctx, now);
  
  // Draw TIE fighter silhouettes (very distant)
  drawTIEFighters(bctx, now);

  // adaptive quality while page/tab hidden (skip work)
  const hidden = document.visibilityState === "hidden";
  const step = hidden ? 3 : STAR_STEP;

  // punchy ramp-up, smooth wind-down — feels like a hyperspace kick
  const rampBase = warpTarget > starSpeed ? 0.88 : 0.95;
  starSpeed += (warpTarget - starSpeed) * Math.min(1, 1 - Math.pow(rampBase, dt / 16.7));
  const cx = bgW/2, cy = bgH/2;
  const parallaxFactor = starSpeed > 0.02 ? 0.0006 : 0.00008;
  const parallaxX = (mouseX - cx) * parallaxFactor;
  const parallaxY = (mouseY - cy) * parallaxFactor;

  if (starSpeed < 0.01) {
    bctx.fillStyle = "#fff";
    for (let k = 0; k < stars.length; k += step) {
      const s = stars[k];
      if (s.twEnd === 0 && Math.random() < 0.002) { s.twEnd = now + 800; s.ta = 1.0; }
      if (s.twEnd && now >= s.twEnd) { s.twEnd = 0; s.ta = s.base; }
      if (!s.twEnd && now >= s.next) {
        s.next = now + 500 + Math.random() * 1500;
        s.ta = s.base + (Math.random() * 0.15 - 0.07);
        s.ta = Math.min(0.7, Math.max(0.05, s.ta));
      }
      s.a += (s.ta - s.a) * 0.05;
      const rx = cx + s.x + parallaxX*40;
      const ry = cy + s.y + parallaxY*40;
      const r = s.twEnd ? 1.6 : 1.1;
      // PERF: fillRect instead of arc — identical look at 1-2px, far cheaper
      bctx.globalAlpha = Math.max(0, Math.min(1, s.a));
      bctx.fillRect(rx - r, ry - r, r + r, r + r);
    }
    bctx.globalAlpha = 1;
  } else {
    // --- WARP — rendered by the WarpFX module (3 strokes + 1 blit total) ---
    const speedNorm = Math.min(1, starSpeed / CONFIG.STARS.WARP_SPEED);
    WarpFX.render(bctx, cx, cy, Math.hypot(bgW, bgH) * 0.56, speedNorm, dt, starTint);
  }
  updateMeteors(bctx);
}

// Helper: choose a warp theme (bias to cool)
function pickWarpTheme(preferred = true){
  const pool = preferred ? COOL_THEMES : ALL_THEMES;
  return pool[Math.floor(Math.random()*pool.length)];
}

function startWarp(theme = pickWarpTheme(true)){
  // Mark mission as started - sun will now appear
  missionStarted = true;
  
  // Initialize TIE fighters after mission starts
  if (TIE_FIGHTERS.length === 0) {
    initTIEFighters();
  }
  
  // Safety: remove previous theme classes
  warpOverlay.classList.remove("theme-cyan","theme-violet","theme-magma","theme-emerald","pulse");
  if (theme) warpOverlay.classList.add(theme);
  setStarTintFromTheme(theme);                       // <-- NEW: tint stars to match theme
  if (CONFIG.WARP.USE_PULSE) warpOverlay.classList.add("pulse");

  warpOverlay.hidden = false;
  warpOverlay.classList.add("active");
  warpTarget = CONFIG.STARS.WARP_SPEED;

  setTimeout(() => {
    intro.style.display = "none";
    stage.hidden = false;
    resizeAll();
    ensureShip();
    ensureShip3D();
  }, CONFIG.WARP.ENTER_FADE_MS);

  // Warm planet PNGs only AFTER the warp fully settles — fetching/decoding
  // megabytes of images during the warp animation caused visible stutter
  setTimeout(() => {
    try {
      const allTargets = [...ROOMS[0].targets, ...ROOMS[1].targets];
      const seen = new Set();
      const urls = [];
      allTargets.forEach(t => {
        if (t.noSprite) return;
        const key = (t.name || "").toLowerCase().replace(/[^a-z0-9]/g,'');
        if (!key) return;
        const file = FILE_OVERRIDE[key] || key;
        const url = `assets/planets/${file}.png`;
        if (!seen.has(url)) { seen.add(url); urls.push(url); }
      });
      if (urls.length) {
        if ('requestIdleCallback' in window) requestIdleCallback(() => warmImagesSequential(urls), { timeout: 4_000 });
        else setTimeout(() => warmImagesSequential(urls), 500);
      }
    } catch {}
  }, CONFIG.WARP.ENTER_FADE_MS + CONFIG.WARP.HOLD_MS + CONFIG.WARP.EXIT_FADE_MS + 1500);

  setTimeout(() => {
    warpTarget = CONFIG.STARS.CRUISE_SPEED;
    warpOverlay.classList.remove("active","pulse");
    setTimeout(() => { warpOverlay.hidden = true; }, CONFIG.WARP.EXIT_FADE_MS);
  }, CONFIG.WARP.ENTER_FADE_MS + CONFIG.WARP.HOLD_MS);
}

// ========================== PLANETS & DATA ==========================
const PLANETS = {
  amber:  { base:"#ffd84a", shade:"#f4b800", highlight:"#fff8c9", glow:"#ffe05e", ring:false },
  aqua:   { base:"#78d7ff", shade:"#3682ff", highlight:"#eaffff", glow:"#9edbff", ring:true,  ringColor:"rgba(160,210,255,.6)" },
  coral:  { base:"#ff9aa2", shade:"#ff4f6d", highlight:"#ffe9ec", glow:"#ffc3ca", ring:false },
  mint:   { base:"#9df6c7", shade:"#2ce6a1", highlight:"#eafff6", glow:"#aefbd7", ring:false },
  violet: { base:"#b99cff", shade:"#6e52ff", highlight:"#efeaff", glow:"#c9b3ff", ring:true,  ringColor:"rgba(185,156,255,.55)" }
};
const WARP_THEME = { amber:"theme-magma", aqua:"theme-cyan", coral:"theme-magma", mint:"theme-emerald", violet:"theme-violet" };

function makePlanetName(){
  const A=["Vy","Xe","Ka","Or","Ny","Au","Ze","Vo","Sy","Ty","Qui","Ara","Lo"];
  const B=["ris","thos","lune","dris","ron","vera","drax","lyx","phos","thia","nox","lyra","dune"];
  return A[Math.floor(Math.random()*A.length)]+B[Math.floor(Math.random()*B.length)];
}

const LINKS = {
  resume: SITE.links?.resume || "assets/docs/Raymond-Van-Der-Walt-Resume.pdf",
  github: SITE.links?.github || "https://github.com/",
  linkedin: SITE.links?.linkedin || "https://www.linkedin.com/",
  w4d: SITE.links?.whats4dinner || "https://whts4dinner.com",
  email: (SITE.links?.email && `mailto:${SITE.links.email}`) || (SITE.contact?.email && `mailto:${SITE.contact.email}`) || "mailto:Raymondvdw@gmail.com"
};

// inline SVG icons for link buttons
const ICONS = {
  resume: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 12h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1v3.12c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>`,
  email: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.24-8 5-8-5V6l8 5 8-5v2.24z"/></svg>`,
  w4d: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>`
};

// helper to reuse link row
function renderLinksRow(){
  return `
    <div class="link-row">
      <a class="link-btn" href="${LINKS.resume}" target="_blank" rel="noopener">${ICONS.resume}Resume</a>
      <a class="link-btn" href="${LINKS.github}" target="_blank" rel="noopener">${ICONS.github}GitHub</a>
      <a class="link-btn" href="${LINKS.linkedin}" target="_blank" rel="noopener">${ICONS.linkedin}LinkedIn</a>
      <a class="link-btn" href="${LINKS.w4d}" target="_blank" rel="noopener">${ICONS.w4d}Whats4Dinner</a>
      <a class="link-btn" href="${LINKS.email}">${ICONS.email}Email</a>
    </div>`;
}

// ---------- Contact form endpoint (optional) ----------
const CONTACT_ENDPOINT = (SITE.forms && SITE.forms.contact) || (SITE.contact && SITE.contact.formEndpoint) || "";

// ---------- Skills ----------
const SKILLS = (SITE.skills || []).map(g => ({
  title: g.group || g.title || "Skills",
  items: (g.items || []).map(it => ({ name: it.name, pct: it.level ?? it.pct ?? 0 })),
  badges: g.badges || []
}));

function skillBarClass(){
  const p = String(SITE.skillsPlanet?.palette || "aqua").toLowerCase();
  if (p === "amber") return "skill__fill--amber";
  if (p === "coral") return "skill__fill--coral";
  if (p === "mint")  return "skill__fill--mint";
  return "skill__fill--aqua";
}

function renderSkillsHTML(){
  const barClass = skillBarClass();
  const groups = SKILLS.map(g => {
    const rows = g.items.map(s => `
      <div class="skill">
        <div class="skill__row">
          <div class="skill__name">${s.name}</div>
          <div class="skill__pct">${s.pct}%</div>
        </div>
        <div class="skill__bar"><div class="skill__fill ${barClass}" style="--w:${s.pct}%"></div></div>
      </div>`).join("");
    const badges = g.badges?.length ? `<div class="badges">${g.badges.map(b=>`<span class="badge">${b}</span>`).join("")}</div>` : "";
    return `<section class="skill-group"><h3 class="skill-group__title">${g.title}</h3>${rows}${badges}</section>`;
  }).join("");

  return `<p>Here’s a snapshot of my current toolkit. I focus on cinematic UI and performance.</p><div class="skills">${groups}</div>${renderLinksRow()}`;
}

// Skills planet config
const skillsCfg = SITE.skillsPlanet || {};
const skillsPalette = PLANETS[(skillsCfg.palette || "violet")] || PLANETS.violet;
const SKILLS_PLANET = {
  name: skillsCfg.name || makePlanetName(),
  label: skillsCfg.label || "My Skills",
  r: Math.max(36, Math.min(80, (skillsCfg.size || 54))),
  planet: skillsPalette,
  asteroids: { count: 130, inner: 1.6, outer: 2.15, tilt: -0.28 }
};

// ---------- Video helper ----------
function renderVideo(url){
  if (!url) return "";
  const safe = String(url).trim();
  try {
    const u = new URL(safe, window.location.href);
    const href = u.href;

    // YouTube
    if (/youtube\.com\/watch|youtu\.be\//i.test(href)) {
      const id = href.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)?.[1] || "";
      if (id) {
        return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${id}?rel=0" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      }
    }
    // Vimeo
    if (/vimeo\.com\/(\d+)/i.test(href)) {
      const vid = href.match(/vimeo\.com\/(\d+)/i)[1];
      return `<div class="video-wrap"><iframe src="https://player.vimeo.com/video/${vid}" title="Video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    // MP4 direct
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(href)) {
      return `<div class="video-wrap"><video src="${href}" controls playsinline preload="metadata"></video></div>`;
    }
  } catch {}
  return "";
}

// ---------- Case studies ----------
function caseStudyHTML(cs){
  const pills = (cs.stack||cs.tags||[]).map(t=>`<span class="pill">${t}</span>`).join("");
  const bullets = (cs.points||cs.bullets||[]).map(b=>`<li>${b}</li>`).join("");
  const links = (cs.links||[]).map(l=>`<a class="link-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("");
  const hero = cs.hero ? `<img class="case__hero" src="${cs.hero}" alt="${cs.title} hero" onerror="this.style.display='none'">` : "";
  const video = cs.video ? renderVideo(cs.video) : "";
  const role = cs.role ? `<p class="case__summary"><strong>Role:</strong> ${cs.role}</p>` : "";
  return `
    <article class="case">
      <div>${hero}${video}</div>
      <div>
        <h3 class="case__title">${cs.title}</h3>
        <p class="case__summary">${cs.summary}</p>
        ${role}
        <div class="pills">${pills}</div>
        ${bullets ? `<ul class="case__bullets">${bullets}</ul>` : ""}
        ${links ? `<div class="link-row" style="margin-top:12px">${links}</div>` : ""}
      </div>
    </article>`;
}
const CASE_A = {
  title:"NDA (Horror) Mission HUD",
  summary:"Cinematic, moment-to-moment HUD for objectives, markers, and state transitions.",
  role:"UI/UX · Blueprints + UMG/CommonUI",
  stack:["UE5","UMG/CommonUI","Blueprints","HUD"],
  points:[
    "Objective pipeline with timed beats and diegetic transitions.",
    "Marker system with distance-gated hints and screen-edge indicators.",
    "Budgeted animation curves + lightweight materials to stay 60fps+.",
    "Cinematic feel with smooth transitions and responsive feedback.",
    "Data-driven design for easy iteration and polish."
  ],
  hero:"assets/images/cases/Demo.png",
  video:"assets/videos/Horror.mp4",
  links:[]
};
const CASE_B = {
  title:"Will Tool MVP Dynamic PDF Builder",
  summary:"React app that generates legally structured PDFs from smart forms.",
  role:"Frontend Lead",
  stack:["React","TypeScript","PDF","Forms"],
  points:[
    "Composable question graph → schema-backed output.",
    "Autofill + validation + printer-friendly themes.",
    "Export pipeline with embedded signatures (prototype)."
  ],
  hero:"assets/images/cases/willtool.png",
  video:"",
  links:[]
};
const CASE_C = {
  title:"Hack & Slash ARPG",
  summary:"Reusable menu scaffolding with rotators, input mapping (EnhancedInput), and animation hooks.",
  role:"Gameplay UI · UE 5.3 (C++/BP)",
  stack:["UE5.6","C++","Blueprints","CommonUI","EnhancedInput","Animation","HUD","Widgets","Rotators"],
  points:[
    "Slot-based widgets with data-driven options.",
    "Controller/keyboard navigation rules and sound cues.",
    "Skinning via style assets and data tables.",
    "Rotators for inventory, skills, and equipment.",
    "EnhancedInput for flexible key mapping.",
    "Animation hooks for cinematic transitions."
  ],
  hero:"assets/images/cases/Equipped Axe.png",
  video:"assets/videos/A Basic Dungeon.mp4",
  links:[]
};
const CASE_W4D = {
  title:"Whats4Dinner.com",
  summary:"My own shipped product: a live meal-planning and recipe web app, running in production right now.",
  role:"Design · Build · Ship (solo founder)",
  stack:["React","TypeScript","OAuth","Product Design","Deployment"],
  points:[
    "Built end-to-end and running live at whts4dinner.com.",
    "OAuth sign-in with real user accounts.",
    "Recipe discovery and “what’s for dinner?” planning flows.",
    "Designed, developed, deployed and maintained solo — the full product lifecycle."
  ],
  links:[{ label:"Visit whts4dinner.com →", href:"https://whts4dinner.com" }]
};
const CASE_D = {
  title:"Farmily — Mobile Foundations",
  summary:"Expo/React Native app skeleton with auth and payments plan.",
  role:"Mobile · React Native (Expo)",
  stack:["React Native","Expo","Auth","Payments"],
  points:[
    "Auth flow + protected screens.",
    "Theming and icons; responsive components.",
    "Payments integration plan PayFast."
  ],
  hero:"assets/images/cases/2.jpg",
  video:"",
  links:[]
};

// ---------- Certifications (richer) ----------
const RAW_CERTS = (SITE.certifications && SITE.certifications.length ? SITE.certifications : [
  { name:"(Example) Meta Front-End Developer", issuer:"Coursera", year:"2024", link:"#", status:"complete" },
  { name:"(Example) Google UX Design", issuer:"Coursera", year:"2023", link:"#", status:"complete" },
  { name:"(Example) Advanced JavaScript", issuer:"Udemy", year:"2022", progress: 60 }
]);

function normalizeCert(c){
  // Accept: c.status, c.progress number, or c.progress string ("Completed", "In progress", "75%")
  const rawProg = (c.progress ?? "").toString().trim().toLowerCase();
  const rawStatus = (c.status ?? rawProg).toString().trim().toLowerCase();

  let status = "";         // "complete" | "in-progress" | "planned" | ""
  let pct;

  if (typeof c.progress === "number") {
    pct = Math.max(0, Math.min(100, c.progress));
    status = pct >= 100 ? "complete" : "in-progress";
  } else if (/^\d{1,3}%?$/.test(rawProg)) {
    pct = Math.max(0, Math.min(100, parseInt(rawProg, 10)));
    status = pct >= 100 ? "complete" : "in-progress";
  } else {
    if (rawStatus.includes("complete"))   { status = "complete";   pct = 100; }
    else if (rawStatus.includes("progress")) { status = "in-progress"; }
    else if (rawStatus.includes("plan"))  { status = "planned"; }
  }

  const safeLink = c.verify || c.link ? encodeURI(c.verify || c.link) : "";

  return {
    name: c.name || "",
    issuer: c.issuer || "",
    year: c.year || c.date || "",
    link: safeLink,
    skills: c.skills || [],
    status, pct
  };
}

function statusBadgeHTML(status, pct){
  if (status === "complete" || pct === 100) {
    return `<div class="badges"><span class="badge">Completed</span></div>`;
  }
  if (status === "in-progress" || (typeof pct === "number" && pct < 100)) {
    return `<div class="badges"><span class="badge">In progress${typeof pct === "number" ? ` · ${pct}%` : ""}</span></div>`;
  }
  if (status === "planned") {
    return `<div class="badges"><span class="badge">Planned</span></div>`;
  }
  return "";
}

function progressBarHTML(pct){
  if (typeof pct !== "number" || pct >= 100) return "";
  // Reuse the existing skill bar styles so no extra CSS is needed
  return `<div class="skill__bar" style="margin-top:8px">
            <div class="skill__fill ${skillBarClass()}" style="--w:${pct}%"></div>
          </div>`;
}

function certificationsHTML(){
  const items = (SITE.certifications?.length ? SITE.certifications : RAW_CERTS)
    .map(normalizeCert)
    // Sort: in-progress first, then completed, then others; tiebreaker by year desc
    .sort((a,b) => {
      const order = v => v.status==="complete" ? 0
               : v.status==="in-progress" ? 1
               : 2;
      if (order(a) !== order(b)) return order(a) - order(b);
      const ay = parseInt(a.year) || 0, by = parseInt(b.year) || 0;
      return by - ay;
    });

  const cards = items.map(c => {
    const meta = [c.issuer, c.year].filter(Boolean).join(" · ");
    const skills = c.skills.length ? `<p class="card__sub">Skills</p><p class="case__summary">${c.skills.join(" · ")}</p>` : "";
    const badge = statusBadgeHTML(c.status, c.pct);
    const bar   = progressBarHTML(c.pct);
    const btn   = c.link ? `<div class="link-row"><a class="link-btn" href="${c.link}" target="_blank" rel="noopener">View credential</a></div>` : "";

    return `
      <article class="card">
        <h3 class="card__title">${c.name}</h3>
        <p class="card__desc">${meta}</p>
        ${skills}
        ${badge}
        ${bar}
        ${btn}
      </article>
    `;
  }).join("");

  return `<div class="grid-cards">${cards}</div>`;
}

// ---------- About ----------
const YEARS = Number(SITE.years) || 4;
const PROFILE_SRC =
  (typeof SITE.profile === "string" ? SITE.profile :
   SITE.profile?.photo || SITE.profile?.src) || "assets/images/profile.png";

const CONTACT_LOCATION = SITE.contact?.location || "";
const CONTACT_EMAIL = SITE.links?.email || SITE.contact?.email || "Raymondvdw@gmail.com";
const CONTACT_PHONE = SITE.contact?.phone || "";

const aboutHTML = `
  <div class="about about--professional">
    <!-- Header with Contact Pills -->
    <div class="about__header-section">
      <p class="about__main-title">${SITE.contact?.availability || "Open to opportunities"}</p>
      <div class="about__contact-pills">
        ${CONTACT_LOCATION ? `<div class="contact-pill">
          <span class="contact-pill__icon">📍</span>
          <span class="contact-pill__text">${CONTACT_LOCATION}</span>
        </div>` : ""}
        <div class="contact-pill">
          <span class="contact-pill__icon">✉️</span>
          <span class="contact-pill__text">
            <a href="mailto:${CONTACT_EMAIL}" class="contact-pill__link">${CONTACT_EMAIL}</a>
          </span>
        </div>
        ${CONTACT_PHONE ? `<div class="contact-pill">
          <span class="contact-pill__icon">📞</span>
          <span class="contact-pill__text">
            <a href="tel:${CONTACT_PHONE}" class="contact-pill__link">${CONTACT_PHONE}</a>
          </span>
        </div>` : ""}
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="about__content-grid">
      <!-- Left Column: Profile & Bio -->
      <div class="about__left-column">
        <figure class="about__profile-image">
          <img
            class="about__portrait"
            src="${PROFILE_SRC}"
            alt="Raymond Van Der Walt"
            onerror="this.style.display='none'"
            decoding="async"
          />
        </figure>
        <div class="about__profile-info">
          <h3 class="about__name">Raymond Van Der Walt</h3>
          <p class="about__title">Frontend &amp; Game Developer</p>
          <p class="about__bio-text">
            I'm a developer who lives where <strong class="highlight">UI meets gameplay</strong>. 
            With <strong class="highlight">${YEARS}+ years</strong> of experience, I build 
            <strong class="highlight-cyan">cinematic HUDs</strong>, 
            <strong class="highlight-cyan">moment-to-moment interactions</strong>, and 
            <strong class="highlight-cyan">performance-first web experiences</strong> 
            using UE5, React, TypeScript, and Canvas/WebGL.
          </p>
          <p class="about__bio-text">
            I love <strong class="highlight">tuning feel</strong>, building
            <strong class="highlight">micro-feedback</strong>, and keeping
            <strong class="highlight">frame time lean</strong> so polish never costs performance.
            I collaborate tightly with design, wire UI to real game states, and ship clean, maintainable systems.
          </p>
          <p class="about__bio-text">
            I also ship my own products — like
            <a href="https://whts4dinner.com" target="_blank" rel="noopener"><strong class="highlight">Whats4Dinner.com</strong></a>,
            a live meal-planning app I designed, built and run solo.
          </p>
        </div>
      </div>

      <!-- Right Column: Experience & Skills -->
      <div class="about__right-column">
        <div class="about__details-grid">
          <!-- Experience Section -->
          <div class="about__detail-section">
            <h4 class="about__detail-title">Experience</h4>
            <div class="about__detail-item">
              <div class="detail-item__years">2025</div>
              <div class="detail-item__desc">
                <strong>Whats4Dinner.com — Founder &amp; Developer</strong><br>
                Designed, built and shipped a live meal-planning web app with OAuth accounts — running in production.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">2022-25</div>
              <div class="detail-item__desc">
                <strong>Frontend &amp; Game Developer</strong><br>
                Building cinematic UI systems, HUDs, and performance-first web experiences with UE5, React, and WebGL.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">2020-22</div>
              <div class="detail-item__desc">
                <strong>Web Developer</strong><br>
                Developing responsive web applications and dynamic form flows with React, TypeScript, and Node.js.
              </div>
            </div>
          </div>

          <!-- Education Section -->
          <div class="about__detail-section">
            <h4 class="about__detail-title">Education</h4>
            <div class="about__detail-item">
              <div class="detail-item__years">2016-19</div>
              <div class="detail-item__desc">
                <strong>Self-Taught &amp; Online Learning</strong><br>
                Continuous learning through Udemy, Coursera, and hands-on project development.
              </div>
            </div>
          </div>

          <!-- Technical Skills -->
          <div class="about__detail-section">
            <h4 class="about__detail-title">Technical Skills</h4>
            <div class="about__skills-grid">
              <div class="skill-card">
                <div class="skill-card__icon">UE5</div>
                <div class="skill-card__name">Unreal Engine 5</div>
                <div class="skill-card__rating">
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot"></span>
                </div>
              </div>
              <div class="skill-card">
                <div class="skill-card__icon">&lt;/&gt;</div>
                <div class="skill-card__name">React</div>
                <div class="skill-card__rating">
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot"></span>
                </div>
              </div>
              <div class="skill-card">
                <div class="skill-card__icon">TS</div>
                <div class="skill-card__name">TypeScript</div>
                <div class="skill-card__rating">
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot"></span>
                  <span class="skill-dot"></span>
                </div>
              </div>
              <div class="skill-card">
                <div class="skill-card__icon">GL</div>
                <div class="skill-card__name">Canvas/WebGL</div>
                <div class="skill-card__rating">
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot skill-dot--filled"></span>
                  <span class="skill-dot"></span>
                  <span class="skill-dot"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Soft Skills -->
          <div class="about__detail-section">
            <h4 class="about__detail-title">Soft Skills</h4>
            <div class="about__soft-skills">
              <span class="soft-skill-tag">Creativity</span>
              <span class="soft-skill-tag">Attention to Detail</span>
              <span class="soft-skill-tag">Problem Solving</span>
              <span class="soft-skill-tag">Communication</span>
              <span class="soft-skill-tag">Team Collaboration</span>
              <span class="soft-skill-tag">Performance Focus</span>
            </div>
          </div>
        </div>

        <!-- Contact Links -->
        <div class="about__contact-section">
          ${renderLinksRow()}
        </div>
      </div>
    </div>
  </div>
`;

// ---------- Work With Me (services + contact merged into one panel) ----------
const SERVICES = SITE.services || {};
function workWithMeHTML(){
  const tiers = (SERVICES.tiers || []).map(t => `
    <article class="price-card${t.featured ? " price-card--featured" : ""}">
      ${t.featured ? `<div class="price-card__flag">Most popular</div>` : ""}
      <h3 class="price-card__name">${t.name}</h3>
      <div class="price-card__price">${t.price}</div>
      <div class="price-card__tagline">${t.tagline || ""}</div>
      <ul class="price-card__features">${(t.features || []).map(f => `<li>${f}</li>`).join("")}</ul>
    </article>`).join("");
  const includes = (SERVICES.includes || []).map(i => `<span class="badge">${i}</span>`).join("");
  return `
    <p>${SERVICES.intro || "I design and build websites — get in touch for a quote."}</p>
    <div class="price-grid">${tiers}</div>
    ${includes ? `<p class="subhead">Every project includes</p><div class="badges">${includes}</div>` : ""}
    ${SERVICES.note ? `<p class="input-help" style="margin-top:12px">${SERVICES.note}</p>` : ""}
    <p class="subhead" style="margin-top:20px">Start your project</p>
    ${CONTACT_HTML}`;
}

// ---------- Arcade (retro FPS, lazy-loaded) ----------
function arcadeHTML(){
  return `
    <p>A complete retro FPS I built from scratch in a canvas — raycast walls, three
    weapons, four demon breeds, exploding barrels, keycards and a boss fight across
    three levels. No engine, no libraries, no image files: everything is code,
    the same rendering tech behind the 1993 classics.</p>
    <div class="arcade">
      <canvas id="arcade-canvas" width="320" height="200" tabindex="0" aria-label="Retro FPS game"></canvas>
      <div class="arcade__controls">
        <span><strong>WASD / ↑↓</strong> move</span>
        <span><strong>←→ / mouse</strong> turn</span>
        <span><strong>Space / click</strong> fire</span>
        <span><strong>1–3</strong> weapons</span>
        <span><strong>M</strong> map</span>
        <span><strong>P</strong> pause</span>
        <span><strong>R</strong> retry</span>
      </div>
    </div>`;
}
function openArcadePanel(){
  openLanding("Inferno — Retro FPS", arcadeHTML());
  if (window.initArcade) { window.initArcade("arcade-canvas"); return; }
  const s = document.createElement("script");
  s.src = "js/arcade.js";
  s.onload = () => { if (window.initArcade) window.initArcade("arcade-canvas"); };
  s.onerror = () => { const el = document.getElementById("landing-body"); if (el) el.insertAdjacentHTML("beforeend", "<p>Couldn't load the game module.</p>"); };
  document.head.appendChild(s);
}

// ---------- Projects (rich details) ----------
const PROJECTS = [
  {
    title:"Whats4Dinner.com",
    summary:"Live meal-planning web app — recipe discovery, sign-in, and “what’s for dinner?” answered in seconds.",
    requires:["React","TypeScript","OAuth","API design","Deployment"],
    does:[
      "Recipe discovery and meal planning flows",
      "OAuth sign-in with real user accounts",
      "Shipped, hosted and running in production"
    ],
    links:[{ label:"Visit live site", href:"https://whts4dinner.com" }]
  },
  {
    title:"NDA Signed Mission HUD",
    summary:"Cinematic HUD driving objectives, diegetic markers, and guided flow.",
    requires:["UE5","Blueprints","CommonUI","Materials/Shaders"],
    does:[
      "Objective/state machine → HUD states + timed beats",
      "Marker hints, distance gating, screen-edge arrows",
      "Strict frame-time budget for animations/materials"
    ],
    links:[]
  },
  {
    title:"Will Tool MVP — Dynamic PDF",
    summary:"Form flows that export legally structured PDFs.",
    requires:["HTML","CSS/Tailwind","JavaScript","React","TypeScript","Node"],
    does:[
      "Schema-driven questions with validation + autofill",
      "Accessible components, printer-friendly themes",
      "PDF assembly pipeline (prototype signatures)"
    ],
    links:[]
  },
  {
    title:"Common UI Menu Framework",
    summary:"UE5 menu system with rotators, input mapping and styling.",
    requires:["UE5.6","C++","Blueprints","CommonUI"],
    does:[
      "Slot-based widgets and data-driven options",
      "EnhancedInput navigation + sound cues",
      "Skins via style assets and data tables"
    ],
    links:[]
  },
  {
    title:"Farmily",
    summary:"Expo/React Native app foundations with auth and payments plan.",
    requires:["React Native","Expo","TypeScript","Auth","Stripe (plan)"],
    does:[
      "Auth flow + protected routes",
      "Responsive components + theming",
      "Payments integration plan"
    ],
    links:[]
  }
];
function projectsHTML(){
  const cards = PROJECTS.map(p => `
    <article class="card">
      <h3 class="card__title">${p.title}</h3>
      <p class="card__desc">${p.summary}</p>
      <h4 class="card__sub">What it does</h4>
      <ul class="list">${p.does.map(d=>`<li>${d}</li>`).join("")}</ul>
      <h4 class="card__sub">What it requires</h4>
      <p class="case__summary">${p.requires.join(" · ")}</p>
      ${p.links?.length ? `<div class="link-row">${p.links.map(l=>`<a class="link-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("")}</div>` : ""}
    </article>
  `).join("");
  return `<div class="grid-cards">${cards}</div><p style="margin-top:12px">Want the source or a live demo? <a href="${LINKS.email}">Email me</a>.</p>`;
}

// ---------- Contact ----------
const CONTACT_HTML = `
  <form id="contact-form" class="contact" novalidate>
    <div class="contact__row">
      <label class="sr-only" for="c-name">Name</label>
      <input id="c-name" class="input" name="name" type="text" placeholder="Your name" required>

      <label class="sr-only" for="c-email">Email</label>
      <input id="c-email" class="input" name="email" type="email" placeholder="you@email.com" required>
    </div>

    <label class="sr-only" for="c-msg">Message</label>
    <textarea id="c-msg" class="textarea" name="message" placeholder="How can I help?" required></textarea>

    <!-- Honeypot -->
    <input type="text" name="_hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">

    <div class="link-row">
      <button class="btn" type="submit">Send message</button>
      <a class="link-btn" href="${LINKS.email}">Or email me directly</a>
    </div>
    <p id="contact-status" aria-live="polite" style="margin:6px 0 0; color:#cfe1ff;"></p>
  </form>
  <p class="subhead">Or find me here</p>
  ${renderLinksRow()}
`;

function bindContactForm(){
  const form = landing?.querySelector?.("#contact-form");
  if (!form) return;

  const status = landing.querySelector("#contact-status");
  const endpoint = (CONTACT_ENDPOINT || "").trim();
  const btn = form.querySelector("button[type=submit]");

  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||"").trim());

  function setInvalid(el, on){
    el.classList.toggle("is-invalid", !!on);
    el.setAttribute("aria-invalid", on ? "true" : "false");
  }

  function validate(){
    const okName = !!form.name.value.trim();
    const okEmail = emailOk(form.email.value);
    const okMsg = !!form.message.value.trim();
    setInvalid(form.name, !okName);
    setInvalid(form.email, !okEmail);
    setInvalid(form.message, !okMsg);
    return okName && okEmail && okMsg;
  }

  ["input","blur","keyup"].forEach(ev=>{
    form.addEventListener(ev, e => {
      if (e.target.matches(".input, .textarea")) validate();
    }, true);
  });

  function mailtoFallback() {
    const n = encodeURIComponent(form.name.value || "");
    const e = encodeURIComponent(form.email.value || "");
    const m = encodeURIComponent(form.message.value || "");
    const subject = encodeURIComponent(`Portfolio contact from ${form.name.value || "visitor"}`);
    const body = encodeURIComponent(`Name: ${decodeURIComponent(n)}\nEmail: ${decodeURIComponent(e)}\n\n${decodeURIComponent(m)}`);
    const emailAddr = (SITE.links?.email || "Raymondvdw@gmail.com").replace(/^mailto:/,"");
    window.location.href = `mailto:${emailAddr}?subject=${subject}&body=${body}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) { status.textContent = "Please fill all fields correctly."; return; }
    status.textContent = "Sending…";
    btn.disabled = true;

    if (form["_hp"]?.value) { status.textContent = "Thanks!"; form.reset(); btn.disabled = false; return; }

    if (!endpoint) {
      mailtoFallback();
      status.textContent = "Opening your email app…";
      btn.disabled = false;
      return;
    }

    try {
      const fd = new FormData(form);
      const resp = await fetch(endpoint, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Network error");
      status.textContent = "Thanks! I’ll get back to you shortly.";
      form.reset();
    } catch (err) {
      status.textContent = "Couldn’t reach the server. Opening your email app instead…";
      mailtoFallback();
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- About ----------
const aboutHTMLPanel = aboutHTML;

// ROOMS
const NAMES = ["Volara","Nyxus","Aurelia","Thal-3","Kairon","Xerith","Cindrix","Abyssium","Vespera","Solyn"];

let currentRoom = 0;
const ROOMS = [
  { targets: [
    { name: NAMES[0], px: 18, py: 26, r: 46, planet: PLANETS.amber,  label: "About Me",        action: () => openLanding("About Me", aboutHTMLPanel), warp: "theme-magma" },
    // ring tilt variations added
    { name: NAMES[7], px: 47, py: 42, r: 36, planet: PLANETS.aqua,   label: "Projects",        action: () => openLanding("Projects", projectsHTML()), warp: "theme-cyan",   ringTilt:  0.32 },
    { name: NAMES[9], px: 60, py: 18, r: 34, planet: PLANETS.violet, label: "Certifications",  action: () => openLanding("Certifications", certificationsHTML()), warp: "theme-violet", ringTilt: -0.38 },
    { name: SKILLS_PLANET.name, px: 75, py: 68, r: SKILLS_PLANET.r, planet: SKILLS_PLANET.planet, label: SKILLS_PLANET.label, action: () => openLanding("Skills", renderSkillsHTML()), asteroids: SKILLS_PLANET.asteroids, warp: WARP_THEME[skillsCfg.palette || "violet"] || "theme-violet" },
    { name: "Aurum", px: 78, py: 22, r: 42, planet: PLANETS.amber, label: "Work With Me", action: () => openLanding("Work With Me", workWithMeHTML()), warp: "theme-magma", noSprite: true },
    { name: "Inferno", px: 14, py: 70, r: 40, planet: PLANETS.coral, label: "Arcade", action: () => openArcadePanel(), warp: "theme-magma", noSprite: true },
    { name: NAMES[3], px: 42, py: 74, r: 40, planet: PLANETS.mint,   label: "Solar System →",     action: () => setRoom(1), warp: "theme-emerald" },
  ]},
  { targets: [
    { name: "Verdis", px:50, py:44, r:44, planet: PLANETS.mint, label:"Whats4Dinner.com", action: () => openLanding("Whats4Dinner.com — Live Product", caseStudyHTML(CASE_W4D)), warp: "theme-emerald", noSprite: true, ringTilt: 0.3 },
    { name: NAMES[1], px:28, py:30, r:42, planet: PLANETS.aqua,   label:"Case Study A", action: () => openLanding("Case Study A", caseStudyHTML(CASE_A)), warp: "theme-cyan",   ringTilt:  0.22 },
    { name: NAMES[4], px:72, py:30, r:48, planet: PLANETS.coral,  label:"Case Study B", action: () => openLanding("Case Study B", caseStudyHTML(CASE_B)), warp: "theme-magma" },
    { name: NAMES[8], px:30, py:72, r:44, planet: PLANETS.violet, label:"Case Study C", action: () => openLanding("Case Study C", caseStudyHTML(CASE_C)), warp: "theme-violet", ringTilt: -0.28 },
    { name: NAMES[5], px:70, py:72, r:42, planet: PLANETS.mint,   label:"Case Study D", action: () => openLanding("Case Study D", caseStudyHTML(CASE_D)), warp: "theme-emerald" },
    { name: NAMES[2], px:50, py:90, r:38, planet: PLANETS.amber,  label:"← Back",       action: () => setRoom(0), warp: "theme-magma" },
  ]},
];
let TARGETS = ROOMS[currentRoom].targets;

// ---------- image filename overrides (exact case) ----------
const FILE_OVERRIDE = {
  abysium: "Abyssium", abyssium: "Abyssium",
  cindrix: "Cindrix",
  thal3: "Thal3",
  orionisix: "Orionis-IX",
  volara: "Volara",
  nyxus: "Nyxus-768",
  aurelia: "Aurelia",
  kairon: "Kairon",
  xerith: "Xerith",
  vespera: "Vespera",
  solyn: "Solyn"
};

const planetCache = new Map();

// PERF: downscale big planet PNGs (up to 1024px) ONCE to ~display size —
// rescaling the full-res image every frame was a large per-frame cost.
// 2x supersample keeps them sharp under DPR and the 1.85x camera zoom.
function prescalePlanet(img, r){
  const size = Math.max(2, Math.ceil(r * 2 * 2));
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, size, size);
  return c;
}

function buildPlanetTextures(list){
  list.forEach(t => {
    const key = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (planetCache.has(key)) { t.tex = planetCache.get(key); ensureAsteroids(t); return; }

    // planets without artwork go straight to a generated texture (no 404 fetch)
    if (t.noSprite) {
      const tex = makePlanetTexture(t.r, t.planet, t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
      planetCache.set(key, tex); t.tex = tex; ensureAsteroids(t);
      return;
    }

    const img = new Image();
    // PATCH: hint async decode to avoid layout jank
    try { img.decoding = "async"; } catch {}
    img.onload = () => {
      const tex = prescalePlanet(img, t.r);
      planetCache.set(key, tex); t.tex = tex; ensureAsteroids(t);
    };
    img.onerror = () => {
      const tex = makePlanetTexture(t.r, t.planet, t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
      planetCache.set(key, tex); t.tex = tex; ensureAsteroids(t);
    };
    const fname = FILE_OVERRIDE[key] || key;
    img.src = `assets/planets/${fname}.png`;
  });
}
buildPlanetTextures(TARGETS);

function setRoom(i){
  currentRoom = Math.max(0, Math.min(i, ROOMS.length-1));
  TARGETS = ROOMS[currentRoom].targets;
  buildPlanetTextures(TARGETS);
  if (typeof buildQuickNav === "function") buildQuickNav();
}

// ========================== ASTEROIDS / PLANET TEXTURES ==========================
function seededRand(seed){ let x = seed|0 || 123456789; return () => (x ^= x<<13, x ^= x>>>17, x ^= x<<5, (x>>>0)/4294967295); }
function makePlanetTexture(r, palette, seed=Date.now()){
  const rand = seededRand(seed);
  const c = document.createElement("canvas"); const s = Math.ceil(r*2);
  c.width = c.height = s; const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s*0.35, s*0.35, r*0.2, s/2, s/2, r);
  g.addColorStop(0, palette.highlight || "#ffffff"); g.addColorStop(0.02, palette.base); g.addColorStop(1, palette.shade);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s/2, s/2, r, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "overlay";
  for (let i=0;i<120;i++){
    const rr = r*(0.05 + rand()*0.25), a = 0.10 + rand()*0.25;
    ctx.globalAlpha = a; ctx.filter = `blur(${Math.max(0.6, rr*0.15)}px)`;
    const ang = rand()*Math.PI*2, dist = rand()*r*0.7, cx = s/2 + Math.cos(ang)*dist, cy = s/2 + Math.sin(ang)*dist;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.fillStyle = rand() < 0.5 ? "#ffffff" : "#000000"; ctx.fill();
  }
  ctx.restore(); ctx.filter = "none";
  const rim = ctx.createRadialGradient(s/2, s/2, r*0.9, s/2, s/2, r*1.08);
  rim.addColorStop(0, "rgba(255,255,255,0.0)"); rim.addColorStop(1, (palette.glow || palette.base) + "00");
  ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(s/2, s/2, r*1.08, 0, Math.PI*2); ctx.fill();
  return c;
}
function ensureAsteroids(t){
  if (!t.asteroids || t.beltPoints) return;
  const { count=120, inner=1.6, outer=2.1, tilt=-0.22 } = t.asteroids || {};
  const rand = seededRand(t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0) ^ 9137);
  const pts = [];
  for (let i=0;i<count;i++){
    const a = (i/count)*Math.PI*2 + rand()*0.5;
    const radius = t.r * (inner + rand()*(outer-inner));
    const er = radius * 0.52;
    pts.push({ a, radius, er, size: 0.6 + rand()*1.4, shade: 0.6 + rand()*0.4, speed: 0.0006 + rand()*0.0006 });
  }
  t.beltPoints = pts; t.beltTilt = tilt;
}
function drawAsteroidBelt(x, y, t){
  if (!t.beltPoints) return;
  // PERF: one path + one fill for the whole belt (was 130 separate fills/frame)
  uictx.save(); uictx.translate(x,y); uictx.rotate(t.beltTilt || 0);
  uictx.globalAlpha = 0.6;
  uictx.fillStyle = "rgba(220,230,255,0.85)";
  uictx.beginPath();
  for (const p of t.beltPoints){
    p.a += p.speed;
    const px = Math.cos(p.a) * p.radius, py = Math.sin(p.a) * p.er;
    uictx.moveTo(px + p.size, py);
    uictx.arc(px, py, p.size, 0, Math.PI*2);
  }
  uictx.fill();
  uictx.restore(); uictx.globalAlpha = 1;
}

// ========================== DRAWING ==========================
let lastHoveredIndex = -1;
function drawPlanetHalo(x, y, t, r, now){
  // cached radial-gradient sprite — no shadowBlur, one drawImage
  const pulse = 0.9 + Math.sin(now*0.0008 + r*0.03)*0.1;
  const sprite = getGlowSprite(t.planet.glow || t.planet.base);
  const gr = r * 2.4 * pulse;
  uictx.globalAlpha = 0.42;
  uictx.drawImage(sprite, x - gr, y - gr, gr * 2, gr * 2);
  uictx.globalAlpha = 1;
}
function drawPlanetSparkle(x,y,r,now){
  // Throttle sparkle updates (every 40ms = ~25fps for this effect)
  const sparkleFrame = Math.floor(now / 40);
  const a = (sparkleFrame * 0.024) % (Math.PI*2); // Simpler calculation
  const sx = x + Math.cos(a) * r*0.35, sy = y + Math.sin(a*1.3) * r*0.22;
  uictx.save(); 
  uictx.globalAlpha = 0.22 + Math.sin(sparkleFrame*0.4)*0.08; // Simpler calculation
  uictx.fillStyle = "#ffffff"; 
  uictx.beginPath(); 
  uictx.arc(sx, sy, Math.max(1.4, r*0.038), 0, Math.PI*2); // Slightly smaller
  uictx.fill(); 
  uictx.restore();
}
function jitterFor(t){
  const seed = t.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const now = performance.now()*0.001;
  const amp = Math.max(1.2, Math.min(6, t.r*0.08));
  return { x: Math.cos(now*0.6 + seed*0.01) * amp, y: Math.sin(now*0.7 + seed*0.02) * amp };
}

function drawTargetPlanet(x,y,t, hovered, now){
  const r = t.r;
  drawPlanetHalo(x,y,t,r,now);
  const j = jitterFor(t);
  const px = x + j.x, py = y + j.y;

  if (t.tex) uictx.drawImage(t.tex, px - r, py - r, r * 2, r * 2);

  if (t.planet.ring){
    uictx.save();
    uictx.translate(px, py);
    uictx.rotate(typeof t.ringTilt === "number" ? t.ringTilt : -0.22);

    const ringGlow = 0.8 + Math.sin(now * 0.0008 + r * 0.03) * 0.2;
    const ringColor = t.planet.ringColor || "rgba(200,220,255,.55)";
    // soft under-glow pass (wide + faint) replaces expensive shadowBlur
    uictx.strokeStyle = ringColor;
    uictx.globalAlpha = 0.25 * ringGlow;
    uictx.lineWidth = Math.max(5, r * 0.24);
    uictx.beginPath();
    uictx.ellipse(0, 0, r*1.35, r*0.55, 0, 0, Math.PI*2);
    uictx.stroke();
    // crisp main ring
    uictx.globalAlpha = ringGlow;
    uictx.lineWidth = Math.max(2, r * 0.1);
    uictx.beginPath();
    uictx.ellipse(0, 0, r*1.35, r*0.55, 0, 0, Math.PI*2);
    uictx.stroke();

    uictx.restore();
    uictx.globalAlpha = 1;
  }

  if (t.beltPoints) drawAsteroidBelt(px, py, t);
  drawPlanetSparkle(px,py,r,now);

  if (hovered){
    const glowPulse = 0.85 + Math.sin(now * 0.003) * 0.15;
    const sprite = getGlowSprite(t.planet.glow || t.planet.base);
    const gr = r * 2.9;
    uictx.globalAlpha = 0.55 * glowPulse;
    uictx.drawImage(sprite, px - gr, py - gr, gr * 2, gr * 2);
    uictx.globalAlpha = 1;
  }

  // Planet labels — pre-rendered sprite, one drawImage per frame
  ensureLabelSprite(t);
  const ls = t._labelSprite;
  uictx.drawImage(ls.canvas, px - ls.w / 2, py + r + 6, ls.w, ls.h);
}

// === Decorative Space Station (sprite + pseudo-3D) ==========================
const STATION_CFG = {
  label: SITE.station?.label || "Station",
  sprite: SITE.station?.sprite || "",        // e.g. "assets/images/station.png"
  px: (typeof SITE.station?.px === "number") ? SITE.station.px : 22,   // default moved LEFT
  py: (typeof SITE.station?.py === "number") ? SITE.station.py : 18,
  scale: SITE.station?.scale ?? 1
};
let stationImg = null;
if (STATION_CFG.sprite) {
  const _img = new Image();
  _img.onload = () => { stationImg = _img; };
  try { _img.decoding = "async"; } catch {}
  _img.src = STATION_CFG.sprite;
}
const STATION = { r: 18, rot: 0, rotSpeed: 0.0035, pulse: 0, ...STATION_CFG };

function drawStation(){
  const x = toPx(STATION.px, width);
  const y = toPx(STATION.py, height);

  STATION.rot += STATION.rotSpeed;
  STATION.pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.002);

  uictx.save();
  uictx.translate(x, y);
  uictx.rotate(STATION.rot);

  // pseudo-3D ring (tilted ellipse + glow)
  uictx.save();
  uictx.rotate(-0.25);
  uictx.globalAlpha = 0.30 + STATION.pulse * 0.25;
  uictx.strokeStyle = "rgba(180,210,255,0.85)";
  uictx.lineWidth = 1.2;
  uictx.beginPath(); uictx.ellipse(0, 0, STATION.r*1.9, STATION.r*0.9, 0, 0, Math.PI*2); uictx.stroke();
  uictx.restore();

  // sprite (if provided), otherwise vector fallback
  if (stationImg) {
    const s = STATION.r * 2.2 * (STATION.scale || 1);
    // soft drop shadow for depth
    uictx.save();
    uictx.globalAlpha = 0.85;
    uictx.shadowColor = "rgba(100,140,255,0.55)";
    uictx.shadowBlur = 16;
    uictx.drawImage(stationImg, -s*0.5, -s*0.5, s, s);
    uictx.restore();
  } else {
    // vector fallback
    uictx.fillStyle = "#cfe1ff";
    uictx.beginPath(); uictx.arc(0, 0, STATION.r*0.46, 0, Math.PI*2); uictx.fill();

    uictx.strokeStyle = "#9fb6ff";
    uictx.lineWidth = 2;
    uictx.beginPath(); uictx.moveTo(-STATION.r*1.2, 0); uictx.lineTo(STATION.r*1.2, 0); uictx.stroke();
    uictx.beginPath(); uictx.moveTo(0, -STATION.r*1.2); uictx.lineTo(0, STATION.r*1.2); uictx.stroke();
  }

  // tiny blink
  uictx.fillStyle = "rgba(255,255,255,0.9)";
  uictx.beginPath(); uictx.arc(STATION.r*0.75, 0, 1.6 + STATION.pulse*0.8, 0, Math.PI*2); uictx.fill();

  uictx.restore();

  // label (uses SITE.station.label if provided) — width measured once
  uictx.font = "600 13px 'Space Grotesk', 'Segoe UI', sans-serif";
  const label = STATION.label || "Station";
  if (STATION._lw == null) STATION._lw = uictx.measureText(label).width;
  uictx.fillStyle = "#cfe1ff";
  uictx.fillText(label, x - STATION._lw/2, y + STATION.r + 16);
}

function drawTargets(){
  const warping = cam.active || Math.abs(cam.scale - 1) > 0.02;
  uictx.textBaseline = "top";
  const now = performance.now();
  let hoveredIdx = -1;

  TARGETS.forEach((t, i) => {
    const x = toPx(t.px, width);
    const y = toPx(t.py, height);
    const r = t.r;
    let hovered = false;
    if (!warping && !ship.moving){
      const dist = Math.hypot(mouseX - x, mouseY - y);
      hovered = dist <= r + 6;
      if (hovered) hoveredIdx = i;
    }
    drawTargetPlanet(x, y, t, hovered, now);
  });

  // Decorative station (draw after planets so it floats on top a bit)
  drawStation();

  // pointer cursor over clickable planets (cheap: only touch DOM on change)
  if (hoveredIdx !== lastHoveredIndex) ui.style.cursor = hoveredIdx >= 0 ? "pointer" : "";
  lastHoveredIndex = hoveredIdx;
}
function drawUI(){
  uictx.clearRect(0,0,width,height);
  uictx.save();
  uictx.translate(width/2, height/2);
  uictx.scale(cam.scale, cam.scale);
  uictx.translate(-width/2 - cam.x, -height/2 - cam.y);
  drawTargets();
  uictx.restore();
}

// ========================== CAMERA ==========================
const cam = { x:0, y:0, scale:1, tx:0, ty:0, ts:1, active:false, arriving:false, onArrive:null };
function updateCam(dt = 16.7){
  // time-based smoothing (equivalent to 0.12/frame at 60fps) so slow devices
  // converge in the same wall-clock time instead of taking forever
  const a = Math.min(1, 1 - Math.pow(0.88, dt / 16.7));
  cam.x += (cam.tx - cam.x) * a;
  cam.y += (cam.ty - cam.y) * a;
  cam.scale += (cam.ts - cam.scale) * a;
  if (cam.active && Math.abs(cam.x-cam.tx)<0.6 && Math.abs(cam.y-cam.ty)<0.6 && Math.abs(cam.scale-cam.ts)<0.01){
    cam.active = false;
    if (!cam.arriving) {
      cam.arriving = true;
      setTimeout(() => {
        cam.arriving = false;
        cam.tx = 0; cam.ty = 0; cam.ts = 1;
        if (typeof cam.onArrive === "function") cam.onArrive();
        cam.onArrive = null;
        warpTarget = CONFIG.STARS.CRUISE_SPEED;
      }, CONFIG.CAMERA.RETURN_DELAY);
    }
  }
}

// ========================== HELPERS ==========================
function toPx(p, size){ return (p/100) * size; }

// ========================== SHIP (3D only) ==========================
function ensureShip(){
  if (!ship.x && !ship.y){
    ship.x = width / 2;
    ship.y = height * 0.86;
    placeShipAt(ship.x, ship.y, ship.angle);
  }
}
function ensureShip3D(){
  const cvs = document.getElementById("ship3d");
  if (!cvs) return;
  if (window.initShip3D && !reduceMotion) {
    try {
      window.initShip3D("ship3d");
      window.updateShip3D?.({ engineOn: true });
      placeShipAt(ship.x, ship.y, ship.angle);
    }
    catch (e){ console.warn("Ship3D init failed:", e); }
  }
}
function placeShipAt(x, y, deg, scale){
  ship.x = x; ship.y = y; ship.angle = deg;
  if (window.updateShip3D){
    try {
      window.updateShip3D({
        x: x/width,
        y: y/height,
        angleDeg: deg + CONFIG.SHIP.ANGLE_OFFSET,
        scale: (typeof scale === "number") ? scale : undefined
      });
    } catch {}
  }
}
function aimShipTowards(tx, ty){
  const dx = tx - ship.x, dy = ty - ship.y;
  const deg = Math.atan2(dy, dx) * 180 / Math.PI;
  placeShipAt(ship.x, ship.y, deg);
}

// Bezier helpers
function cubic(p0,p1,p2,p3,t){ const it=1-t; return { x: it*it*it*p0.x + 3*it*it*t*p1.x + 3*it*t*t*p2.x + t*t*t*p3.x,
                                                      y: it*it*it*p0.y + 3*it*it*t*p1.y + 3*it*t*t*p2.y + t*t*t*p3.y }; }
function cubicTangent(p0,p1,p2,p3,t){ const it=1-t; return { x: 3*it*it*(p1.x-p0.x) + 6*it*t*(p2.x-p1.x) + 3*t*t*(p3.x-p2.x),
                                                             y: 3*it*it*(p1.y-p0.y) + 6*it*t*(p2.y-p1.y) + 3*t*t*(p3.y-p2.y) }; }
const easeInOutCubic = t => t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

function flyShipTo(targetX, targetY, onArrive, theme){
  ensureShip();
  const p0 = { x: ship.x, y: ship.y }, p3 = { x: targetX, y: targetY };
  const dx = p3.x - p0.x, dy = p3.y - p0.y, dist = Math.hypot(dx, dy);
  const arc = dist * CONFIG.SHIP.ARC_HEIGHT;
  const midx = (p0.x + p3.x)/2, midy = (p0.y + p3.y)/2;
  const nx = -dy/(dist||1), ny = dx/(dist||1);
  const p1 = { x: midx + nx*arc, y: midy + ny*arc };
  const p2 = { x: midx + nx*arc, y: midy + ny*arc };

  ship.path = { p0,p1,p2,p3 }; ship.t0 = performance.now(); ship.dur = CONFIG.SHIP.FLIGHT_MS;
  ship.moving = true; ship.onArrive = onArrive || null;

  try { shootSfx.currentTime = 0; shootSfx.play(); } catch {}
  if (!reduceMotion) warpTarget = Math.max(warpTarget, 0.08);

  const ttheme = theme || pickWarpTheme(true);
  warpOverlay.classList.remove("theme-cyan","theme-violet","theme-magma","theme-emerald","pulse");
  warpOverlay.classList.add(ttheme);
  setStarTintFromTheme(ttheme);
  if (CONFIG.WARP.USE_PULSE) warpOverlay.classList.add("pulse");

  window.updateShip3D?.({ engineOn: true });
}
function updateShip(){
  if (!ship.moving || !ship.path) return;
  const t = Math.min(1, (performance.now() - ship.t0) / ship.dur);
  const et = easeInOutCubic(t);

  const p = cubic(ship.path.p0, ship.path.p1, ship.path.p2, ship.path.p3, et);
  const tg = cubicTangent(ship.path.p0, ship.path.p1, ship.path.p2, ship.path.p3, et);
  const angle = Math.atan2(tg.y, tg.x) * 180 / Math.PI;

  const scale = 1 - (1 - CONFIG.SHIP.LAND_SCALE) * et;
  placeShipAt(p.x, p.y, angle, scale);

  if (t >= 1){
    ship.moving = false;
    window.updateShip3D?.({ engineOn: false, scale: CONFIG.SHIP.LAND_SCALE });
    if (!reduceMotion) warpTarget = 0.22;
    cam.tx = ship.x - width/2; cam.ty = ship.y - height/2; cam.ts = CONFIG.CAMERA.ZOOM; cam.active = true;
    const arrive = ship.onArrive; ship.onArrive = null;
    cam.onArrive = () => { if (typeof arrive === "function") arrive(); };
  }
}

// ========================== LANDING OVERLAY ==========================
let landing;
function ensureLanding(){
  if (landing) return;
  landing = document.createElement("div");
  landing.id = "landing"; landing.hidden = true;
  landing.innerHTML = `
    <div class="landing__bg"></div>
    <div class="landing__panel">
      <button class="landing__close btn-lcars" aria-label="Close">Back to orbit</button>
      <h2 id="landing-title" class="holographic"></h2>
      <div id="landing-body"></div>
    </div>`;
  document.body.appendChild(landing);
  landing.querySelector(".landing__close").addEventListener("click", closeLanding);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && landing && !landing.hidden) closeLanding(); });
}
function closeLanding(){
  if (!landing) return;
  landing.hidden = true;
  if (window.destroyArcade) window.destroyArcade(); // stop the game loop if running
}
function setLandingBackgroundByPlanet(t){
  ensureLanding();
  const bgEl = landing.querySelector(".landing__bg");
  const glow = t?.planet?.glow || "#9fc7ff";
  const base = t?.planet?.base || "#0c1220";
  // keep the backdrop dark — just a soft planet-coloured aura, not a colour flood
  bgEl.style.background = `
    radial-gradient(1100px 700px at 22% 18%, ${glow}2b 0%, transparent 55%),
    radial-gradient(1300px 900px at 82% 88%, ${base}1a 0%, transparent 60%),
    #04050b`;
}

function refreshSkillBars(){
  const bars = landing?.querySelectorAll?.(".skill__fill");
  if (!bars || !bars.length) return;
  bars.forEach(b => {
    b.style.animation = "none";
    void b.offsetHeight;
    b.style.animation = "";
  });
}

function openLanding(title, html){
  ensureLanding();
  if (window.destroyArcade) window.destroyArcade(); // leaving the arcade for another panel
  landing.querySelector("#landing-title").textContent = title;
  landing.querySelector("#landing-body").innerHTML = html;
  landing.hidden = false;
  if (landing.querySelector("#contact-form")) bindContactForm();
  if (landing.querySelector(".skills")) refreshSkillBars();
}

// ========================== INPUT ==========================
// Mouse move → coalesced into RAF via setting targets only
let _pendingMouse = null;
function noteInput(){ lastInputAt = performance.now(); autopilotLock = false; }
document.addEventListener("mousemove", (e) => {
  _pendingMouse = { x: e.clientX, y: e.clientY };
  noteInput();
}, { passive: true });

// Shared "fly to planet and open it" behaviour (canvas click, keyboard, quick nav)
function engageTarget(t){
  if (cam.active || cam.arriving || ship.moving) return;
  if (typeof setNavOpen === "function") setNavOpen(false);
  if (landing && !landing.hidden) closeLanding();
  const tx = toPx(t.px, width), ty = toPx(t.py, height);
  const ring = document.createElement("div");
  ring.className = "flash"; ring.style.left = tx + "px"; ring.style.top = ty + "px";
  stage.appendChild(ring); ring.addEventListener("animationend", () => ring.remove(), { once: true });
  const theme = t.warp || pickWarpTheme(true);
  flyShipTo(tx, ty, () => { setLandingBackgroundByPlanet(t); t.action(); }, theme);
}

ui.addEventListener("click", (e) => {
  if (cam.active || cam.arriving || ship.moving) return;
  const r = ui.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  for (const t of TARGETS) {
    const tx = toPx(t.px, width), ty = toPx(t.py, height), rr = t.r;
    if (Math.hypot(x - tx, y - ty) <= rr) { engageTarget(t); return; }
  }
  noteInput();
}, { passive: true });

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || cam.active || cam.arriving || ship.moving) return;
  if (landing && !landing.hidden) return; // don't hijack keys while a panel is open
  if (lastHoveredIndex < 0) return;
  engageTarget(TARGETS[lastHoveredIndex]);
  noteInput();
});

// ========================== QUICK NAV ==========================
// Accessible nav mirroring the current room's planets. Responsive:
// a single-row pill bar on wide screens, a compact menu button that
// opens a vertical dropdown on phones/tablets (CSS decides which).
const quickNav = document.getElementById("quick-nav");
function setNavOpen(open){
  if (!quickNav) return;
  quickNav.classList.toggle("quick-nav--open", !!open);
  const t = quickNav.querySelector(".quick-nav__toggle");
  if (t){
    t.setAttribute("aria-expanded", open ? "true" : "false");
    t.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }
}
function buildQuickNav(){
  if (!quickNav) return;
  const wasOpen = quickNav.classList.contains("quick-nav--open");
  quickNav.innerHTML = "";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "quick-nav__toggle";
  toggle.setAttribute("aria-expanded", wasOpen ? "true" : "false");
  toggle.setAttribute("aria-label", "Open navigation");
  toggle.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg><span>Menu</span>`;
  toggle.addEventListener("click", () => setNavOpen(!quickNav.classList.contains("quick-nav--open")));

  const list = document.createElement("div");
  list.className = "quick-nav__list";
  TARGETS.forEach(t => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quick-nav__btn";
    b.textContent = t.label;
    b.addEventListener("click", () => { noteInput(); setNavOpen(false); engageTarget(t); });
    list.appendChild(b);
  });

  quickNav.appendChild(toggle);
  quickNav.appendChild(list);
  quickNav.hidden = false;
}

// ========================== AUTOPILOT ==========================
function maybeAutopilot(){
  if (ship.moving || cam.active || cam.arriving || autopilotLock) return;
  if (performance.now() - lastInputAt < CONFIG.AUTOPILOT_IDLE_MS) return;
  const t = TARGETS[Math.floor(Math.random()*TARGETS.length)];
  const tx = toPx(t.px, width), ty = toPx(t.py, height);
  const ang = Math.random()*Math.PI*2, offset = t.r * (1.3 + Math.random()*0.6);
  const px = tx + Math.cos(ang)*offset, py = ty + Math.sin(ang)*offset;
  autopilotLock = true;
  flyShipTo(px, py, () => { setLandingBackgroundByPlanet(t); if (typeof t.action === "function") t.action(); }, t.warp || pickWarpTheme(true));
}

// ========================== LOOP ==========================
// ADD: ultra-light jank detector -> toggles LOW_END & lowers star density
let _jankCount = 0, _frames = 0;
function adaptQuality(dt){
  _frames++;
  if (dt > 32) _jankCount++;                 // ~ <30fps frame
  if (_frames >= 120){                       // check every ~2s
    const ratio = _jankCount / _frames;
    if (!LOW_END && ratio > 0.2){            // many slow frames → lower quality
      LOW_END = true;
      document.documentElement.classList.add("low-end");
      STAR_STEP = 2;                         // draw every 2nd star
    } else if (LOW_END && ratio < 0.06){     // recover
      LOW_END = false;
      document.documentElement.classList.remove("low-end");
      STAR_STEP = 1;
    }
    _jankCount = 0; _frames = 0;
  }
}

// ========================== FRAME PROFILER ==========================
// Pinpoints stutter: whenever a frame stalls (>50ms) the console gets a
// per-section breakdown naming the culprit. Add ?debug to the URL (or set
// localStorage rvdw-debug=1) for rolling 5s averages as well.
const PERF_DEBUG = /[?&]debug/.test(location.search) ||
  (() => { try { return localStorage.getItem("rvdw-debug") === "1"; } catch { return false; } })();
const perf = { frame: {}, sums: {}, frames: 0, lastSummary: performance.now(), lastWarn: 0 };
function perfTime(name, fn, arg){
  const t0 = performance.now();
  fn(arg);
  perf.frame[name] = performance.now() - t0;
}

let _lastTs = performance.now();
function loop(){
  const now = performance.now();
  const dt = now - _lastTs; _lastTs = now;

  // apply coalesced mouse update here (1x per frame)
  if (_pendingMouse){
    mouseX = _pendingMouse.x; mouseY = _pendingMouse.y;
    _pendingMouse = null;
    if (!ship.moving) aimShipTowards(mouseX, mouseY);
  }

  // PERF: skip painting entirely while a landing panel covers the canvases
  const covered = landing && !landing.hidden;

  perf.frame = {};
  if (!covered) perfTime("stars+bg", renderStars, dt);
  perfTime("camera", updateCam, dt);
  perfTime("ship", updateShip);
  if (!covered) perfTime("planets+ui", drawUI);
  maybeAutopilot();

  adaptQuality(dt); // PATCH: adaptive perf

  // jank report: name the slow section instead of guessing
  // (only when the tab is focused — background/occluded tabs are throttled
  // by the browser itself, which is not jank)
  if (dt > 50 && dt < 5000 && document.hasFocus() && now - perf.lastWarn > 2000){
    perf.lastWarn = now;
    const parts = Object.entries(perf.frame).map(([k,v]) => `${k} ${v.toFixed(1)}ms`).join(" · ");
    console.warn(`[perf] long frame ${dt.toFixed(0)}ms → ${parts} (rest = ship3d/GC/browser)`);
  }
  if (PERF_DEBUG){
    for (const k in perf.frame) perf.sums[k] = (perf.sums[k] || 0) + perf.frame[k];
    perf.frames++;
    if (now - perf.lastSummary > 5000){
      const avg = Object.entries(perf.sums).map(([k,v]) => `${k} ${(v/perf.frames).toFixed(2)}ms`).join(" · ");
      console.info(`[perf] avg over ${perf.frames} frames → ${avg}`);
      perf.sums = {}; perf.frames = 0; perf.lastSummary = now;
    }
  }

  requestAnimationFrame(loop);
}
ensureLanding();
buildQuickNav();
applySoundState();
loop();

// re-render cached planet labels once the web fonts are ready
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    ROOMS.forEach(room => room.targets.forEach(t => { t._labelSprite = null; }));
  });
}

// tiny debug hook (harmless in production, useful in devtools)
window.__portfolioState = () => ({
  shipMoving: ship.moving,
  camActive: cam.active,
  camArriving: cam.arriving,
  cam: { x: cam.x, y: cam.y, scale: cam.scale, tx: cam.tx, ty: cam.ty, ts: cam.ts },
  room: currentRoom
});

// Safer, cooler warp on start (cyan/violet bias)
startBtn?.addEventListener("click", async () => {
  try {
    await shootSfx.play();
    shootSfx.pause();
    shootSfx.currentTime = 0;
  } catch {}

  startBgMusic(); // 🔊 fade-in music here
  startWarp(pickWarpTheme(true));
});


// Auto-start intro (if enabled) with cool theme
if (APP_OPTS.autoStartIntroMs) {
  setTimeout(() => {
    const introVisible = getComputedStyle(intro).display !== "none";
    const stageHidden = stage.hasAttribute("hidden");
    if (introVisible && stageHidden) {
      startWarp(pickWarpTheme(true));
    }
  }, APP_OPTS.autoStartIntroMs);
}

// ADD: pause heavy work when tab hidden (lower warp target & star density)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden"){
    warpTarget = CONFIG.STARS.IDLE_SPEED;
    STAR_STEP = 3;
  } else {
    STAR_STEP = LOW_END ? 2 : 1;
  }
}, { passive: true });
