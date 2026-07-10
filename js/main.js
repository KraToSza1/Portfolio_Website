// ========================== ELEMENTS ==========================
const bg = document.getElementById("bg-canvas");
const bctx = bg.getContext("2d", { alpha: false });

const stage = document.getElementById("stage");
const ui = document.getElementById("fps-canvas");
const uictx = ui.getContext("2d", { alpha: true });

const intro = document.getElementById("intro");
const introScroll = document.getElementById("intro-scroll");
const warpOverlay = document.getElementById("warp");
const startBtn = document.getElementById("start-button");
const shootSfx = document.getElementById("sfx-shoot");
const bgMusic = document.getElementById("bg-music");

// Intro crawl: pause while the visitor reads (scroll/touch), then resume
// automatically after ~3s of no interaction so the text keeps rising.
(() => {
  if (!intro || !introScroll) return;
  const crawlEl = intro.querySelector(".crawl");
  let resumeTimer = null;

  const pauseCrawl = () => {
    intro.classList.add("is-reading");
    crawlEl?.classList.add("is-paused");
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      intro.classList.remove("is-reading");
      crawlEl?.classList.remove("is-paused");
    }, 3000);
  };

  ["touchstart", "wheel", "scroll"].forEach(evt => {
    introScroll.addEventListener(evt, pauseCrawl, { passive: true });
  });
})();

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
      <a class="link-btn" href="${LINKS.w4d}" target="_blank" rel="noopener">${ICONS.w4d}Whts4dinner</a>
      <a class="link-btn" href="${LINKS.email}">${ICONS.email}Email</a>
    </div>`;
}

// ---------- Contact form endpoint (optional) ----------
const CONTACT_ENDPOINT = (SITE.forms && SITE.forms.contact) || (SITE.contact && SITE.contact.formEndpoint) || "";

// ---------- Skills ----------
const SKILLS = (SITE.skills || []).map(g => ({
  title: g.group || g.title || "Skills",
  accent: String(g.accent || SITE.skillsPlanet?.palette || "aqua").toLowerCase(),
  mark: g.mark || (g.group || "SK").slice(0, 2).toUpperCase(),
  items: (g.items || []).map(it => ({ name: it.name, pct: it.level ?? it.pct ?? 0 })),
  badges: g.badges || []
}));

function skillFillClass(accent){
  const p = String(accent || "aqua").toLowerCase();
  if (p === "amber" || p === "gold") return "skill__fill--amber";
  if (p === "coral") return "skill__fill--coral";
  if (p === "mint" || p === "emerald") return "skill__fill--mint";
  if (p === "violet" || p === "purple") return "skill__fill--violet";
  return "skill__fill--aqua";
}

function skillLevelLabel(pct){
  if (pct >= 88) return "Expert";
  if (pct >= 78) return "Strong";
  if (pct >= 68) return "Solid";
  return "Building";
}

function renderSkillsHTML(){
  const all = SKILLS.flatMap(g => g.items);
  const avg = all.length
    ? Math.round(all.reduce((sum, s) => sum + s.pct, 0) / all.length)
    : 0;
  const expert = all.filter(s => s.pct >= 88).length;
  const top = [...all].sort((a, b) => b.pct - a.pct).slice(0, 5);

  const groups = SKILLS.map((g, gi) => {
    const fill = skillFillClass(g.accent);
    const rows = g.items.map((s, si) => `
      <div class="skill" style="--i:${si}">
        <div class="skill__row">
          <div class="skill__name">${s.name}</div>
          <div class="skill__meta">
            <span class="skill__tier">${skillLevelLabel(s.pct)}</span>
            <span class="skill__pct">${s.pct}%</span>
          </div>
        </div>
        <div class="skill__bar" aria-hidden="true">
          <div class="skill__fill ${fill}" style="--w:${s.pct}%; --delay:${0.08 + si * 0.06}s"></div>
        </div>
      </div>`).join("");
    const badges = g.badges?.length
      ? `<div class="badges">${g.badges.map(b => `<span class="badge">${b}</span>`).join("")}</div>`
      : "";
    return `
      <section class="skill-group skill-group--${g.accent}" style="--gi:${gi}">
        <header class="skill-group__head">
          <span class="skill-group__mark" aria-hidden="true">${g.mark}</span>
          <div>
            <h3 class="skill-group__title">${g.title}</h3>
            <p class="skill-group__count">${g.items.length} systems</p>
          </div>
        </header>
        <div class="skill-group__body">${rows}</div>
        ${badges}
      </section>`;
  }).join("");

  const chips = top.map(s =>
    `<span class="skills__chip"><strong>${s.name}</strong><em>${s.pct}%</em></span>`
  ).join("");

  return `
    <div class="skills-panel">
      <div class="skills__hero">
        <div>
          <p class="skills__kicker">Loadout</p>
          <p class="skills__summary">
            Cinematic UI + performance-first toolkit —
            <strong>${all.length}</strong> skills across
            <strong>${SKILLS.length}</strong> tracks · avg
            <strong>${avg}%</strong> ·
            <strong>${expert}</strong> expert-tier.
          </p>
        </div>
        <div class="skills__stats" aria-label="Skills snapshot">
          <div class="skills__stat"><span>${SKILLS.length}</span><small>Tracks</small></div>
          <div class="skills__stat"><span>${all.length}</span><small>Skills</small></div>
          <div class="skills__stat"><span>${avg}%</span><small>Avg</small></div>
        </div>
      </div>
      <div class="skills__signature">
        <p class="skills__signature-label">Signature stack</p>
        <div class="skills__chips">${chips}</div>
      </div>
      <div class="skills">${groups}</div>
      ${renderLinksRow()}
    </div>`;
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
function casePreviewGallery(cs){
  const shots = Array.isArray(cs.previews) ? cs.previews.filter(Boolean) : [];
  const fallback = cs.hero || cs.thumb || "";
  if (!shots.length && fallback) shots.push(fallback);
  if (!shots.length) return `<div class="case__preview-empty">Preview coming soon</div>`;

  const main = shots[0];
  const listAttr = shots.map(s => encodeURIComponent(s)).join("|");
  const thumbs = shots.map((src, i) => `
    <button type="button" class="case__thumb${i === 0 ? " is-active" : ""}" data-preview-src="${src}" data-preview-index="${i}" aria-label="Show preview ${i + 1}">
      <img src="${src}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.style.display='none'">
    </button>`).join("");

  return `
    <div class="case__gallery" data-case-gallery data-preview-list="${listAttr}">
      <button type="button" class="case__preview-frame" data-open-lightbox aria-label="Open preview fullscreen">
        <img class="case__hero" src="${main}" alt="${cs.title} preview" loading="lazy" decoding="async"
          onerror="this.onerror=null;this.src='${cs.thumb || fallback || ""}';">
        <span class="case__zoom-hint" aria-hidden="true">Click to enlarge</span>
      </button>
      ${shots.length > 1 ? `<div class="case__thumbs">${thumbs}</div>` : ""}
    </div>`;
}

let lightbox;
let lightboxState = { srcs: [], index: 0 };

function ensureLightbox(){
  if (lightbox) return lightbox;
  lightbox = document.createElement("div");
  lightbox.id = "preview-lightbox";
  lightbox.hidden = true;
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Image preview");
  lightbox.innerHTML = `
    <div class="lightbox__backdrop" data-lightbox-close></div>
    <div class="lightbox__dialog">
      <button type="button" class="lightbox__close" data-lightbox-close aria-label="Close preview">×</button>
      <button type="button" class="lightbox__nav lightbox__nav--prev" data-lightbox-prev aria-label="Previous image">‹</button>
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="Project preview">
        <figcaption class="lightbox__caption"></figcaption>
      </figure>
      <button type="button" class="lightbox__nav lightbox__nav--next" data-lightbox-next aria-label="Next image">›</button>
    </div>`;
  document.body.appendChild(lightbox);

  lightbox.addEventListener("click", (e) => {
    if (e.target.closest("[data-lightbox-close]")) closeLightbox();
    else if (e.target.closest("[data-lightbox-prev]")) stepLightbox(-1);
    else if (e.target.closest("[data-lightbox-next]")) stepLightbox(1);
  });

  // Thumb-friendly swipe between previews
  let touchX = 0, touchY = 0, swiping = false;
  lightbox.addEventListener("touchstart", (e) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    touchX = t.clientX; touchY = t.clientY; swiping = true;
  }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (!swiping) return;
    swiping = false;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    stepLightbox(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (!lightbox || lightbox.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeLightbox(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
  }, true);

  return lightbox;
}

function renderLightbox(){
  if (!lightbox) return;
  const { srcs, index } = lightboxState;
  const img = lightbox.querySelector(".lightbox__img");
  const caption = lightbox.querySelector(".lightbox__caption");
  const prev = lightbox.querySelector("[data-lightbox-prev]");
  const next = lightbox.querySelector("[data-lightbox-next]");
  const src = srcs[index] || "";
  img.src = src;
  caption.textContent = srcs.length > 1 ? `${index + 1} / ${srcs.length}` : "";
  const multi = srcs.length > 1;
  prev.hidden = !multi;
  next.hidden = !multi;
}

function openLightbox(srcs, index = 0){
  const list = (srcs || []).filter(Boolean);
  if (!list.length) return;
  ensureLightbox();
  lightboxState = { srcs: list, index: Math.max(0, Math.min(index, list.length - 1)) };
  renderLightbox();
  lightbox.hidden = false;
  document.documentElement.classList.add("lightbox-open");
  lightbox.querySelector(".lightbox__close")?.focus?.();
}

function closeLightbox(){
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  document.documentElement.classList.remove("lightbox-open");
  const img = lightbox.querySelector(".lightbox__img");
  if (img) img.removeAttribute("src");
}

function stepLightbox(delta){
  const { srcs } = lightboxState;
  if (!srcs.length) return;
  lightboxState.index = (lightboxState.index + delta + srcs.length) % srcs.length;
  renderLightbox();
}

function bindCaseGalleries(root){
  root?.querySelectorAll?.("[data-case-gallery]")?.forEach(gallery => {
    const hero = gallery.querySelector(".case__hero");
    const openBtn = gallery.querySelector("[data-open-lightbox]");
    const list = (gallery.getAttribute("data-preview-list") || "")
      .split("|")
      .map(s => { try { return decodeURIComponent(s); } catch { return s; } })
      .filter(Boolean);
    let activeIndex = 0;

    const setActive = (src, index) => {
      activeIndex = index;
      if (hero && src) hero.src = src;
      gallery.querySelectorAll(".case__thumb").forEach(b => b.classList.remove("is-active"));
      const active = gallery.querySelector(`.case__thumb[data-preview-index="${index}"]`);
      active?.classList.add("is-active");
      active?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
    };

    gallery.querySelectorAll(".case__thumb").forEach(btn => {
      btn.addEventListener("click", () => {
        const src = btn.getAttribute("data-preview-src");
        const index = Number(btn.getAttribute("data-preview-index") || 0);
        setActive(src, index);
      });
    });

    openBtn?.addEventListener("click", () => {
      openLightbox(list, activeIndex);
    });

    // Swipe main preview left/right on touch devices
    let tx = 0, ty = 0, tracking = false;
    openBtn?.addEventListener("touchstart", (e) => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      tx = t.clientX; ty = t.clientY; tracking = true;
    }, { passive: true });
    openBtn?.addEventListener("touchend", (e) => {
      if (!tracking || list.length < 2) { tracking = false; return; }
      tracking = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - tx;
      const dy = t.clientY - ty;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      const next = (activeIndex + (dx < 0 ? 1 : -1) + list.length) % list.length;
      setActive(list[next], next);
    }, { passive: true });
  });
}

function caseStudyHTML(cs){
  const pills = (cs.stack||cs.tags||[]).map(t=>`<span class="pill">${t}</span>`).join("");
  const bullets = (cs.points||cs.bullets||[]).map(b=>`<li>${b}</li>`).join("");
  const links = (cs.links||[]).map(l=>`<a class="link-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("");
  const gallery = casePreviewGallery(cs);
  const video = cs.video ? renderVideo(cs.video) : "";
  const badge = cs.status === "live"
    ? `<span class="status-badge status-badge--live">Live</span>`
    : (cs.status === "prototype" ? `<span class="status-badge">Prototype</span>` : "");
  const meta = [
    cs.role ? `<div class="case__meta-item"><span class="case__meta-label">Role</span><span>${cs.role}</span></div>` : "",
    cs.year ? `<div class="case__meta-item"><span class="case__meta-label">Year</span><span>${cs.year}</span></div>` : "",
    cs.type ? `<div class="case__meta-item"><span class="case__meta-label">Type</span><span>${cs.type}</span></div>` : ""
  ].filter(Boolean).join("");
  const section = (label, body) => body
    ? `<section class="case__block"><h4 class="case__block-title">${label}</h4><p class="case__block-body">${body}</p></section>`
    : "";
  const highlights = (cs.highlights||[]).map(h => `
    <div class="case__stat">
      <strong class="case__stat-value">${h.value}</strong>
      <span class="case__stat-label">${h.label}</span>
    </div>`).join("");
  return `
    <article class="case case--rich">
      <header class="case__intro">
        <div class="case__heading">
          <h3 class="case__title">${cs.title}</h3>
          ${badge}
        </div>
        <p class="case__summary">${cs.summary}</p>
        ${meta ? `<div class="case__meta">${meta}</div>` : ""}
        ${highlights ? `<div class="case__stats">${highlights}</div>` : ""}
        <div class="pills">${pills}</div>
      </header>
      <div class="case__media">
        ${gallery}${video}
      </div>
      <div class="case__body">
        ${section("The problem", cs.problem)}
        ${section("What I built", cs.solution)}
        ${bullets ? `<section class="case__block"><h4 class="case__block-title">Highlights</h4><ul class="case__bullets">${bullets}</ul></section>` : ""}
        ${section("Outcome", cs.outcome)}
        ${links ? `<div class="link-row case__actions">${links}</div>` : ""}
      </div>
    </article>`;
}
const CASE_A = {
  title:"Horror Mission HUD",
  summary:"Cinematic, moment-to-moment HUD for objectives, markers, and state transitions in a horror FPS.",
  role:"UI/UX · Blueprints + UMG/CommonUI",
  year:"2025",
  type:"Game UI",
  stack:["UE5","UMG/CommonUI","Blueprints","HUD","Materials"],
  status:"prototype",
  problem:"Horror games die when the HUD feels like a spreadsheet. Players need guidance that stays diegetic, readable in the dark, and cheap on frame time.",
  solution:"A state-driven mission HUD with timed objective beats, distance-gated markers, and screen-edge hints — all budgeted for 60fps+ on mid-range hardware.",
  outcome:"A reusable horror HUD pattern with cinematic transitions that still respects a hard performance budget.",
  highlights:[
    { value:"60fps+", label:"HUD budget target" },
    { value:"UMG", label:"CommonUI widgets" },
    { value:"Diegetic", label:"Marker language" }
  ],
  points:[
    "Objective pipeline with timed beats and diegetic transitions.",
    "Marker system with distance-gated hints and screen-edge indicators.",
    "Budgeted animation curves + lightweight materials.",
    "Data-driven design for fast iteration and polish passes."
  ],
  hero:"assets/images/cases/Demo.png",
  thumb:"assets/images/thumb-hud.svg",
  previews:[
    "assets/images/cases/Demo.png"
  ],
  video:"assets/videos/Horror.mp4",
  links:[{ label:"GitHub →", href:"https://github.com/KraToSza1/HorrorFPS" }]
};
const CASE_B = {
  title:"Will Tool — Dynamic PDF Builder",
  summary:"React app that turns smart forms into legally structured PDFs — live MVP clients can click through today.",
  role:"Frontend Lead · Full product slice",
  year:"2025",
  type:"Client MVP",
  stack:["React","TypeScript","PDF","Forms","Validation","Vercel"],
  status:"live",
  problem:"Legal document intake was slow, error-prone, and hard to turn into a clean printable PDF without manual cleanup.",
  solution:"A schema-driven question graph with autofill, validation, and a printer-friendly export pipeline that assembles structured PDFs from form state.",
  outcome:"A deployable MVP on Vercel that demonstrates the full intake → PDF path for stakeholders.",
  highlights:[
    { value:"Live", label:"Vercel MVP" },
    { value:"Schema", label:"Question graph" },
    { value:"PDF", label:"Export pipeline" }
  ],
  points:[
    "Composable question graph → schema-backed output.",
    "Autofill + validation + printer-friendly themes.",
    "Export pipeline with embedded signatures (prototype).",
    "Production-ready demo path for client walkthroughs."
  ],
  hero:"assets/images/cases/previews/will/01-home.jpg",
  thumb:"assets/images/thumb-willtool.svg",
  previews:[
    "assets/images/cases/previews/will/01-home.jpg",
    "assets/images/cases/previews/will/02-scroll.jpg",
    "assets/images/cases/previews/will/03-mobile.jpg",
    "assets/images/cases/willtool.png"
  ],
  video:"",
  links:[
    { label:"Open live demo →", href:"https://mvp-tool-will-form-generator.vercel.app" },
    { label:"GitHub →", href:"https://github.com/KraToSza1/MVP-Tool-Will-Form-Generator" }
  ]
};
const CASE_C = {
  title:"Hack & Slash ARPG UI",
  summary:"Reusable CommonUI menu scaffolding with rotators, EnhancedInput, and animation hooks for an action RPG.",
  role:"Gameplay UI · UE5 (C++/BP)",
  year:"2025",
  type:"Game UI",
  stack:["UE5","C++","Blueprints","CommonUI","EnhancedInput","HUD"],
  status:"prototype",
  problem:"ARPG menus get brittle fast — inventory, skills, and equipment each want their own navigation rules, skins, and input paths.",
  solution:"A slot-based CommonUI framework with data-driven options, EnhancedInput mapping, rotators, and style assets so menus stay consistent and skinnable.",
  outcome:"A reusable menu foundation that can grow with combat systems without rewriting focus and input every time.",
  highlights:[
    { value:"CommonUI", label:"Menu system" },
    { value:"C++/BP", label:"Hybrid stack" },
    { value:"Input", label:"EnhancedInput" }
  ],
  points:[
    "Slot-based widgets with data-driven options.",
    "Controller/keyboard navigation rules and sound cues.",
    "Rotators for inventory, skills, and equipment.",
    "Skinning via style assets and data tables.",
    "Animation hooks for cinematic transitions."
  ],
  hero:"assets/images/cases/Equipped Axe.png",
  thumb:"assets/images/thumb-commonui.svg",
  previews:[
    "assets/images/cases/Equipped Axe.png"
  ],
  video:"assets/videos/A Basic Dungeon.mp4",
  links:[{ label:"GitHub →", href:"https://github.com/KraToSza1/SlashRPG" }]
};
const CASE_W4D = {
  title:"Whts4dinner.com",
  summary:"Our flagship shipped product — a smart recipe finder and meal-planning web app that answers “what’s for dinner?” in seconds.",
  role:"Co-founder · Design · Build · Ship",
  year:"2025–26",
  type:"SaaS product",
  stack:["React","TypeScript","Tailwind","Supabase","OAuth","Spoonacular API","Stripe","Vercel"],
  status:"live",
  problem:"People waste time staring at the fridge. Recipe sites are bloated, and planning dinner from ingredients on hand is still annoying.",
  solution:"A fast meal-planning product with recipe search, ingredient-aware discovery, OAuth accounts, serverless API proxying (Spoonacular), caching, and production auth via Supabase — designed, built, and shipped with my beautiful partner.",
  outcome:"A live consumer product at whts4dinner.com with real accounts, ongoing iteration, and a full founder lifecycle from idea → deploy → maintain.",
  highlights:[
    { value:"Live", label:"Production SaaS" },
    { value:"Partners", label:"Built together" },
    { value:"OAuth", label:"Real accounts" },
    { value:"API", label:"Cached proxy" }
  ],
  points:[
    "End-to-end product: discovery, planning flows, auth, and hosting.",
    "Supabase auth (magic link + Google OAuth) with persisted preferences.",
    "Serverless Spoonacular proxy so API keys never hit the browser.",
    "Client + server caching for snappy recipe search.",
    "Stripe-ready billing path for paid tiers.",
    "Designed, developed, deployed and maintained with my beautiful partner."
  ],
  hero:"assets/images/cases/previews/w4d/01-home.jpg",
  thumb:"assets/images/thumb-w4d.svg",
  previews:[
    "assets/images/cases/previews/w4d/01-home.jpg",
    "assets/images/cases/previews/w4d/02-search.jpg",
    "assets/images/cases/previews/w4d/03-mobile.jpg"
  ],
  video:"",
  links:[
    { label:"Visit whts4dinner.com →", href:"https://whts4dinner.com" },
    { label:"GitHub →", href:"https://github.com/KraToSza1/whats-4-dinner" }
  ]
};
const CASE_D = {
  title:"Farmily — Mobile Foundations",
  summary:"Expo/React Native foundations for a farm-produce ordering app with auth and a PayFast payments plan.",
  role:"Mobile · React Native (Expo)",
  year:"2024–25",
  type:"Mobile prototype",
  stack:["React Native","Expo","TypeScript","Auth","PayFast"],
  status:"prototype",
  problem:"Farm produce ordering needed a mobile-first flow — browse, auth, and pay — without waiting for a full native team.",
  solution:"An Expo app skeleton with protected routes, theming, reusable components, and a clear PayFast integration plan.",
  outcome:"A solid mobile foundation ready to grow into a full ordering product.",
  highlights:[
    { value:"Expo", label:"Cross-platform" },
    { value:"Auth", label:"Protected routes" },
    { value:"PayFast", label:"Payments plan" }
  ],
  points:[
    "Auth flow + protected screens.",
    "Theming, icons, and responsive components.",
    "Payments integration plan (PayFast).",
    "Built as a product foundation for farm produce orders."
  ],
  hero:"assets/images/cases/1.jpg",
  thumb:"assets/images/thumb-farmily.svg",
  previews:[
    "assets/images/cases/1.jpg",
    "assets/images/cases/4.jpg",
    "assets/images/cases/3.jpg",
    "assets/images/cases/2.jpg"
  ],
  video:"",
  links:[{ label:"GitHub →", href:"https://github.com/KraToSza1/Farmilly_Mobile_App" }]
};
const CASE_STORIQ = {
  title:"StorIQ Location SEO Builder",
  summary:"Facility location page production cockpit — generate and ship SEO-ready location pages at scale.",
  role:"Full-stack product build",
  year:"2026",
  type:"Internal / ops tool",
  stack:["React","TypeScript","SEO","Content Ops","Vercel"],
  status:"live",
  problem:"Multi-location businesses drown in near-duplicate location pages. Manual SEO copy doesn’t scale and quality drifts.",
  solution:"A production cockpit that structures facility/location content, keeps local SEO fields consistent, and speeds page generation for publishing workflows.",
  outcome:"A live tooling surface teams can use to produce location pages without starting from a blank doc every time.",
  highlights:[
    { value:"SEO", label:"Location pages" },
    { value:"Ops", label:"Content cockpit" },
    { value:"Live", label:"On Vercel" }
  ],
  points:[
    "Structured workflows for facility / location page generation.",
    "Consistency checks aimed at local SEO fields and messaging.",
    "Shipped as a usable production-style tool, not just a mock."
  ],
  hero:"assets/images/cases/previews/storiq/01-home.jpg",
  thumb:"assets/images/thumb-storiq.svg",
  previews:[
    "assets/images/cases/previews/storiq/01-home.jpg",
    "assets/images/cases/previews/storiq/02-scroll.jpg",
    "assets/images/cases/previews/storiq/03-mobile.jpg"
  ],
  video:"",
  links:[
    { label:"Open live app →", href:"https://storiq-location-seo-builder.vercel.app" },
    { label:"GitHub →", href:"https://github.com/KraToSza1/storiq-location-seo-builder" }
  ]
};
const CASE_FORGE = {
  title:"ForgeQuest AI",
  summary:"Personalized Unreal learning through build / break / fix quests — AI-guided practice for game developers.",
  role:"Product · AI UX · Web",
  year:"2026",
  type:"EdTech / AI",
  stack:["React","TypeScript","AI","UE5 Learning","Vercel"],
  status:"live",
  problem:"Learning Unreal from long courses is passive. People need short, active quests that force them to build, break, and repair systems.",
  solution:"A web learning experience that turns UE concepts into quest loops — build something, break it on purpose, then fix it — with personalized practice paths.",
  outcome:"A live ForgeQuest experience focused on retention, clarity, and hands-on Unreal practice.",
  highlights:[
    { value:"Build", label:"Quest loop" },
    { value:"Break", label:"Failure practice" },
    { value:"Fix", label:"Retention" }
  ],
  points:[
    "Quest-style learning loops for Unreal concepts.",
    "Personalized practice paths for aspiring UE developers.",
    "Shipped web UX tuned for clarity and repeat sessions."
  ],
  hero:"assets/images/cases/previews/forge/01-home.jpg",
  thumb:"assets/images/thumb-forge.svg",
  previews:[
    "assets/images/cases/previews/forge/01-home.jpg",
    "assets/images/cases/previews/forge/02-scroll.jpg",
    "assets/images/cases/previews/forge/03-mobile.jpg"
  ],
  video:"",
  links:[
    { label:"Open ForgeQuest →", href:"https://forgequest-ai-web.vercel.app" },
    { label:"GitHub →", href:"https://github.com/KraToSza1/forgequest-ai" }
  ]
};
const CASE_QUOTE = {
  title:"QuotePilot AI",
  summary:"Lead, quote & follow-up PWA for service SMEs — capture leads, send quotes, follow up, get paid.",
  role:"Product · PWA · SME tooling",
  year:"2026",
  type:"SaaS / PWA",
  stack:["React","TypeScript","PWA","Supabase","AI Assist","Vercel"],
  status:"live",
  problem:"Quote-driven service SMEs lose work in WhatsApp threads and spreadsheets. Enterprise CRMs are too heavy for “send quote → chase payment.”",
  solution:"A focused PWA: capture enquiries, draft/send quotes (with AI assist), schedule follow-ups, and keep the pipeline visible on mobile and desktop.",
  outcome:"A live pilot product with marketing site, auth, and an `/app` workspace aimed at real service businesses.",
  highlights:[
    { value:"PWA", label:"Mobile quoting" },
    { value:"AI", label:"Draft assist" },
    { value:"SME", label:"No heavy CRM" }
  ],
  points:[
    "Lead → quote → follow-up pipeline without enterprise CRM bloat.",
    "Mobile-friendly PWA so teams can quote on site.",
    "AI-assisted drafting to cut time-to-quote.",
    "Public marketing pages + authenticated app workspace."
  ],
  hero:"assets/images/cases/previews/quote/01-home.jpg",
  thumb:"assets/images/thumb-quote.svg",
  previews:[
    "assets/images/cases/previews/quote/01-home.jpg",
    "assets/images/cases/previews/quote/02-features.jpg",
    "assets/images/cases/previews/quote/03-pricing.jpg"
  ],
  video:"",
  links:[
    { label:"Open QuotePilot →", href:"https://quote-pilot-ai.vercel.app" },
    { label:"GitHub →", href:"https://github.com/KraToSza1/QuotePilot-AI" }
  ]
};
const CASE_CANTEEN = {
  title:"Elize's Canteen (MiniSME)",
  summary:"Corporate canteen ordering experience for MiniSME — menus, orders, and a clean staff-facing daily flow.",
  role:"Frontend · Product UI",
  year:"2026",
  type:"SME product demo",
  stack:["React","TypeScript","Vite","Vercel"],
  status:"live",
  problem:"Office canteens need a simple digital menu/order path staff will actually use — not a bloated restaurant platform.",
  solution:"A focused MiniSME canteen UI: browse the menu, place orders, and keep the operational surface clean for everyday use.",
  outcome:"A live demo product that shows how a small SME tool can feel polished and practical.",
  highlights:[
    { value:"SME", label:"Real context" },
    { value:"UI", label:"Daily ops" },
    { value:"Live", label:"Demo product" }
  ],
  points:[
    "Menu browsing and order flow for a corporate canteen.",
    "Operational UI aimed at daily staff use.",
    "Deployed MiniSME demo on Vercel."
  ],
  hero:"assets/images/cases/previews/canteen/01-home.jpg",
  thumb:"assets/images/thumb-canteen.svg",
  previews:[
    "assets/images/cases/previews/canteen/01-home.jpg",
    "assets/images/cases/previews/canteen/02-scroll.jpg",
    "assets/images/cases/previews/canteen/03-mobile.jpg"
  ],
  video:"",
  links:[
    { label:"Open live demo →", href:"https://mini-sme-elizes-canteen.vercel.app" },
    { label:"GitHub →", href:"https://github.com/KraToSza1/MiniSME-elizes-canteen" }
  ]
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
    image: c.image || c.cover || "",
    track: c.track || "",
    profile: c.profile || "",
    status, pct
  };
}

function statusBadgeHTML(status, pct){
  if (status === "complete" || pct === 100) {
    return `<span class="status-badge status-badge--live">Completed</span>`;
  }
  if (status === "in-progress" || (typeof pct === "number" && pct < 100)) {
    return `<span class="status-badge">In progress${typeof pct === "number" ? ` · ${pct}%` : ""}</span>`;
  }
  if (status === "planned") {
    return `<span class="status-badge">Planned</span>`;
  }
  return "";
}

function progressBarHTML(pct){
  if (typeof pct !== "number" || pct >= 100) return "";
  return `<div class="cert__progress" aria-hidden="true">
            <div class="cert__progress-fill" style="--w:${pct}%"></div>
          </div>`;
}

function certCardHTML(c){
  const meta = [c.issuer, c.year].filter(Boolean).join(" · ");
  const badge = statusBadgeHTML(c.status, c.pct);
  const bar = progressBarHTML(c.pct);
  const track = c.track ? `<span class="cert__track">${c.track}</span>` : "";
  const img = c.image
    ? `<img class="cert__cover" src="${c.image}" alt="" loading="lazy" decoding="async">`
    : `<div class="cert__cover cert__cover--fallback" aria-hidden="true"></div>`;
  const btn = c.link
    ? `<a class="link-btn" href="${c.link}" target="_blank" rel="noopener">View credential</a>`
    : "";

  return `
    <article class="cert-card${c.status === "complete" ? " cert-card--done" : ""}">
      <div class="cert__media">${img}${badge}</div>
      <div class="cert__body">
        ${track}
        <h3 class="cert__title">${c.name}</h3>
        <p class="cert__meta">${meta}</p>
        ${bar}
        ${btn ? `<div class="link-row cert__actions">${btn}</div>` : ""}
      </div>
    </article>`;
}

function certificationsHTML(){
  const items = (SITE.certifications?.length ? SITE.certifications : RAW_CERTS)
    .map(normalizeCert)
    .sort((a,b) => {
      const order = v => v.status==="complete" ? 0
               : v.status==="in-progress" ? 1
               : 2;
      if (order(a) !== order(b)) return order(a) - order(b);
      const ay = parseInt(a.year) || 0, by = parseInt(b.year) || 0;
      return by - ay;
    });

  const done = items.filter(c => c.status === "complete" || c.pct === 100);
  const active = items.filter(c => !(c.status === "complete" || c.pct === 100));
  const profile = "https://www.udemy.com/user/raymond-van-der-walt/";

  return `
    <div class="certs">
      <div class="certs__hero">
        <div>
          <p class="certs__kicker">Learning log</p>
          <p class="certs__summary">
            <strong>${done.length}</strong> completed ·
            <strong>${active.length}</strong> in progress ·
            formal IIE Higher Certificate + Udemy game/UI track
          </p>
        </div>
        <a class="link-btn" href="${profile}" target="_blank" rel="noopener">Udemy profile →</a>
      </div>

      <section class="certs__section">
        <h3 class="certs__heading">Completed</h3>
        <div class="certs__grid">${done.map(certCardHTML).join("")}</div>
      </section>

      ${active.length ? `
      <section class="certs__section">
        <h3 class="certs__heading">In progress</h3>
        <div class="certs__grid">${active.map(certCardHTML).join("")}</div>
      </section>` : ""}
    </div>`;
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
            <a href="mailto:${CONTACT_EMAIL}" class="contact-pill__link">Email me</a>
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

    <div class="about__content-grid">
      <div class="about__left-column">
        <figure class="about__profile-image">
          <img
            class="about__portrait"
            src="${PROFILE_SRC}"
            alt="Illustrated portrait of Raymond Van Der Walt in a creative developer workspace"
            width="200"
            height="216"
            onerror="this.style.display='none'"
            decoding="async"
          />
        </figure>
        <div class="about__profile-info">
          <h3 class="about__name">Raymond Van Der Walt</h3>
          <p class="about__title">Frontend &amp; Game Developer</p>
          <p class="about__bio-text">
            Based in <strong class="highlight">South Africa</strong>, I build at the intersection of
            <strong class="highlight">cinematic UI</strong> and
            <strong class="highlight">interactive systems</strong> —
            whether that’s a production web product or an Unreal HUD that has to feel alive at 60fps.
          </p>
          <p class="about__bio-text">
            With <strong class="highlight">${YEARS}+ years</strong> shipping interfaces, I work across
            <strong class="highlight-cyan">React / TypeScript</strong>,
            <strong class="highlight-cyan">UE5 (UMG / CommonUI / Blueprints)</strong>, and
            <strong class="highlight-cyan">Canvas / WebGL</strong>.
            I care about moment-to-moment feel, accessibility, and keeping frame time lean so polish never costs performance.
          </p>
          <p class="about__bio-text">
            I’m also a founder-builder. My flagship product is
            <a href="https://whts4dinner.com" target="_blank" rel="noopener"><strong class="highlight">Whts4dinner.com</strong></a>
            — a live meal-planning app I built with my beautiful partner — alongside tools like QuotePilot, ForgeQuest AI, StorIQ, Elize’s Canteen, and Will Tool.
            On the game side I craft cinematic mission HUDs, ARPG menu systems, and UI that speaks the same language as game state.
          </p>
          <p class="about__bio-text">
            Outside client work I’m usually deep in UE5 C++ / UI courses, prototyping product ideas, or tuning micro-interactions until they feel right.
            If you need someone who can own the UI end-to-end — design collaboration, implementation, and ship — let’s talk.
          </p>
          <div class="about__focus">
            <p class="about__focus-label">Currently focused on</p>
            <div class="about__soft-skills">
              <span class="soft-skill-tag">UE5 UI systems</span>
              <span class="soft-skill-tag">React products</span>
              <span class="soft-skill-tag">Cinematic HUDs</span>
              <span class="soft-skill-tag">AI-assisted tools</span>
              <span class="soft-skill-tag">Performance budgets</span>
            </div>
          </div>
        </div>
      </div>

      <div class="about__right-column">
        <div class="about__details-grid">
          <div class="about__detail-section">
            <h4 class="about__detail-title">Experience</h4>
            <div class="about__detail-item">
              <div class="detail-item__years">2025–26</div>
              <div class="detail-item__desc">
                <strong>Whts4dinner.com — Founder &amp; Developer</strong><br>
                Designed, built, and shipped a live meal-planning web app with my beautiful partner — in production at whts4dinner.com.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">2025–26</div>
              <div class="detail-item__desc">
                <strong>Product builds — QuotePilot, ForgeQuest, StorIQ, MiniSME</strong><br>
                Shipped AI / SME web tools and location SEO tooling end-to-end on Vercel.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">2022–25</div>
              <div class="detail-item__desc">
                <strong>Frontend &amp; Game Developer</strong><br>
                Cinematic HUDs, CommonUI systems, and performance-first web experiences with UE5, React, and WebGL.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">2020–22</div>
              <div class="detail-item__desc">
                <strong>Web Developer</strong><br>
                Responsive web apps and dynamic form flows with React, TypeScript, and Node.js.
              </div>
            </div>
          </div>

          <div class="about__detail-section">
            <h4 class="about__detail-title">How I work</h4>
            <div class="about__detail-item">
              <div class="detail-item__years">01</div>
              <div class="detail-item__desc">
                <strong>UI wired to real state</strong><br>
                Interfaces that react to gameplay, data, and user intent — not static mock screenshots.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">02</div>
              <div class="detail-item__desc">
                <strong>Feel first, then polish</strong><br>
                Micro-feedback, motion, and input response tuned so every click and hover earns its keep.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">03</div>
              <div class="detail-item__desc">
                <strong>Ship clean systems</strong><br>
                Maintainable React / UE5 UI architecture, performance budgets, and accessibility baked in.
              </div>
            </div>
          </div>

          <div class="about__detail-section">
            <h4 class="about__detail-title">Education</h4>
            <div class="about__detail-item">
              <div class="detail-item__years">IIE</div>
              <div class="detail-item__desc">
                <strong>Higher Certificate in Web and Mobile Development</strong><br>
                The Independent Institute of Education (IIE) — formal training in web &amp; mobile development.
              </div>
            </div>
            <div class="about__detail-item">
              <div class="detail-item__years">Ongoing</div>
              <div class="detail-item__desc">
                <strong>Continuous Learning</strong><br>
                Deep UE5 C++ / UI tracks on Udemy, plus hands-on product and game projects on top of formal study.
              </div>
            </div>
          </div>

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

          <div class="about__detail-section">
            <h4 class="about__detail-title">Soft Skills</h4>
            <div class="about__soft-skills">
              <span class="soft-skill-tag">Creativity</span>
              <span class="soft-skill-tag">Attention to Detail</span>
              <span class="soft-skill-tag">Problem Solving</span>
              <span class="soft-skill-tag">Communication</span>
              <span class="soft-skill-tag">Team Collaboration</span>
              <span class="soft-skill-tag">Performance Focus</span>
              <span class="soft-skill-tag">Founder mindset</span>
              <span class="soft-skill-tag">Self-directed learning</span>
            </div>
          </div>
        </div>

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
    <p>A complete retro FPS I built from scratch in a canvas — raycast walls, sliding
    doors, <strong>6 weapons</strong> (pistol, shotgun, plasma, BFG, chainsaw &amp; rockets), 19 enemy
    types including minibosses and egg hatchers, colored keycards, crushers, lava &amp; toxic
    hazards, teleporters, lifts, breakable walls, berserk &amp; weapon mods, sticky mines, a
    co-op wraith ally, ghost-replay speedrunning, a daily challenge, a level editor, and five
    themed levels with an ending cinematic. Three difficulty modes. No engine: every pixel drawn in code.</p>
    <div class="arcade">
      <div class="arcade__rotate">↻ Rotate your phone sideways for the best experience</div>
      <div class="arcade__stage" id="arcade-stage">
        <canvas id="arcade-canvas" width="320" height="200" tabindex="0" aria-label="Retro FPS game"></canvas>
        <div class="arcade__touch" id="arcade-touch" aria-hidden="true">
          <div class="arcade__stick" id="arcade-stick" data-stick>
            <div class="arcade__stick-base"></div>
            <div class="arcade__stick-knob" data-stick-knob></div>
            <span class="arcade__stick-label">Move</span>
          </div>
          <div class="arcade__actions">
            <button type="button" class="arcade__btn" data-touch-key="1" aria-label="Pistol">1</button>
            <button type="button" class="arcade__btn" data-touch-key="2" aria-label="Shotgun">2</button>
            <button type="button" class="arcade__btn" data-touch-key="3" aria-label="Plasma">3</button>
            <button type="button" class="arcade__btn" data-touch-key="4" aria-label="BFG">4</button>
            <button type="button" class="arcade__btn" data-touch-key="5" aria-label="Chainsaw">5</button>
            <button type="button" class="arcade__btn" data-touch-key="6" aria-label="Rocket">6</button>
            <button type="button" class="arcade__btn" data-touch-fs aria-label="Fullscreen">⛶</button>
            <button type="button" class="arcade__btn arcade__btn--map" data-touch-key="m" aria-label="Map">Map</button>
            <button type="button" class="arcade__btn arcade__btn--fire" data-touch-fire aria-label="Fire">Fire</button>
          </div>
          <div class="arcade__look" id="arcade-look" data-look>
            <span class="arcade__look-label">Drag to aim</span>
          </div>
        </div>
      </div>
      <div class="arcade__controls">
        <span><strong>Desktop:</strong> WASD move · mouse aim · click/space fire · 1–6 weapons · F drop mine · M map · P pause · [ ] difficulty</span>
        <span><strong>Keycards:</strong> red / blue / yellow open matching doors · <strong>Mods:</strong> rapid · spread · lifesteal</span>
        <span><strong>Title screen:</strong> C daily challenge · E level editor · O toggle wraith ally · <strong>Intermission/win:</strong> S download score card</span>
        <span class="arcade__controls-mobile"><strong>Mobile:</strong> left stick move · right pad aim · Fire button · 1–6 weapons</span>
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
    title:"Whts4dinner.com",
    summary:"Flagship product — smart recipe finder & meal planning. “What’s for dinner?” answered in seconds.",
    status:"live",
    requires:["React","TypeScript","Tailwind","OAuth","Supabase","Vercel"],
    does:[
      "Recipe discovery and meal planning flows",
      "OAuth sign-in with real user accounts",
      "Shipped, hosted and iterated in production"
    ],
    links:[
      { label:"Visit live site", href:"https://whts4dinner.com" },
      { label:"Case study →", href:"#case-w4d", case:"W4D" }
    ]
  },
  {
    title:"QuotePilot AI",
    summary:"Lead, quote & follow-up PWA for service SMEs — cut time-to-quote.",
    status:"live",
    requires:["React","TypeScript","PWA","AI Assist","Vercel"],
    does:[
      "Enquiry → quote → follow-up pipeline",
      "Mobile-friendly PWA for on-site quoting",
      "AI-assisted draft quotes"
    ],
    links:[{ label:"Open live app", href:"https://quote-pilot-ai.vercel.app" }]
  },
  {
    title:"ForgeQuest AI",
    summary:"Personalized Unreal learning via build / break / fix quests.",
    status:"live",
    requires:["React","TypeScript","AI","UE5 Learning","Vercel"],
    does:[
      "Quest-style practice loops for UE concepts",
      "Personalized learning paths",
      "Shipped web learning experience"
    ],
    links:[{ label:"Open ForgeQuest", href:"https://forgequest-ai-web.vercel.app" }]
  },
  {
    title:"StorIQ Location SEO Builder",
    summary:"Facility location page production cockpit for SEO-ready pages at scale.",
    status:"live",
    requires:["React","TypeScript","SEO","Content Ops","Vercel"],
    does:[
      "Location page generation workflow",
      "Consistent local SEO structure",
      "Live production tooling"
    ],
    links:[{ label:"Open StorIQ", href:"https://storiq-location-seo-builder.vercel.app" }]
  },
  {
    title:"Elize's Canteen (MiniSME)",
    summary:"Corporate canteen ordering UI — menus and daily staff flows.",
    status:"live",
    requires:["React","TypeScript","Vite","Vercel"],
    does:[
      "Menu browsing + order flow",
      "Operational UI for SME canteen use",
      "Live MiniSME demo product"
    ],
    links:[{ label:"Open live demo", href:"https://mini-sme-elizes-canteen.vercel.app" }]
  },
  {
    title:"Will Tool — Dynamic PDF",
    summary:"Schema-driven forms that export legally structured PDFs.",
    status:"live",
    requires:["React","TypeScript","PDF","Forms","Vercel"],
    does:[
      "Schema-driven questions with validation + autofill",
      "Printer-friendly themes",
      "Live MVP clients can click through"
    ],
    links:[{ label:"Open live demo", href:"https://mvp-tool-will-form-generator.vercel.app" }]
  },
  {
    title:"Horror Mission HUD",
    summary:"Cinematic HUD driving objectives, diegetic markers, and guided flow.",
    status:"prototype",
    requires:["UE5","Blueprints","CommonUI","Materials/Shaders"],
    does:[
      "Objective/state machine → HUD states + timed beats",
      "Marker hints, distance gating, screen-edge arrows",
      "Strict frame-time budget for animations/materials"
    ],
    links:[{ label:"GitHub", href:"https://github.com/KraToSza1/HorrorFPS" }]
  },
  {
    title:"Hack & Slash ARPG UI",
    summary:"UE5 CommonUI menus with rotators, EnhancedInput and styling.",
    status:"prototype",
    requires:["UE5","C++","Blueprints","CommonUI"],
    does:[
      "Slot-based widgets and data-driven options",
      "EnhancedInput navigation + sound cues",
      "Skins via style assets and data tables"
    ],
    links:[{ label:"GitHub", href:"https://github.com/KraToSza1/SlashRPG" }]
  },
  {
    title:"Farmily",
    summary:"Expo/React Native foundations for farm-produce orders with auth + payments plan.",
    status:"prototype",
    requires:["React Native","Expo","TypeScript","Auth","PayFast"],
    does:[
      "Auth flow + protected routes",
      "Responsive components + theming",
      "Payments integration plan"
    ],
    links:[{ label:"GitHub", href:"https://github.com/KraToSza1/Farmilly_Mobile_App" }]
  }
];

const CASE_BY_KEY = {
  W4D: CASE_W4D, A: CASE_A, B: CASE_B, C: CASE_C, D: CASE_D,
  STORIQ: CASE_STORIQ, FORGE: CASE_FORGE, QUOTE: CASE_QUOTE, CANTEEN: CASE_CANTEEN
};

function projectsHTML(){
  const cards = PROJECTS.map((p, i) => {
    const badge = p.status === "live"
      ? `<span class="status-badge status-badge--live">Live</span>`
      : (p.status === "prototype" ? `<span class="status-badge">Prototype</span>` : "");
    const linkHtml = (p.links||[]).map(l => {
      if (l.case && CASE_BY_KEY[l.case]) {
        return `<button type="button" class="link-btn" data-case="${l.case}">${l.label}</button>`;
      }
      return `<a class="link-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`;
    }).join("");
    return `
    <article class="card card--project" style="--card-i:${i}">
      <div class="case__heading">
        <h3 class="card__title">${p.title}</h3>
        ${badge}
      </div>
      <p class="card__desc">${p.summary}</p>
      <h4 class="card__sub">What it does</h4>
      <ul class="list">${p.does.map(d=>`<li>${d}</li>`).join("")}</ul>
      <h4 class="card__sub">Stack</h4>
      <div class="pills">${p.requires.map(t=>`<span class="pill">${t}</span>`).join("")}</div>
      ${linkHtml ? `<div class="link-row">${linkHtml}</div>` : ""}
    </article>`;
  }).join("");
  return `
    <p class="projects-intro">Shipped products, client tools, and game UI systems — live demos first.</p>
    <div class="grid-cards">${cards}</div>
    <p style="margin-top:12px">Want the source or a deeper walkthrough? <a href="${LINKS.email}">Email me</a> · or jump to <strong>Solar System →</strong> for full case studies.</p>`;
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
      const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim(),
        _hp: form["_hp"]?.value || ""
      };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error("Network error");
      status.textContent = "Thanks! I’ll get back to you shortly.";
      form.reset();
      try { window.va?.("event", { name: "contact_submit" }); } catch {}
    } catch (err) {
      status.textContent = "Email service is busy — opening your email app instead…";
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
    { name: "Verdis", px:50, py:42, r:46, planet: PLANETS.mint, label:"Whts4dinner", action: () => openLanding("Whts4dinner.com — Live Product", caseStudyHTML(CASE_W4D)), warp: "theme-emerald", noSprite: true, ringTilt: 0.3 },
    { name: NAMES[4], px:22, py:22, r:40, planet: PLANETS.coral,  label:"QuotePilot", action: () => openLanding("QuotePilot AI", caseStudyHTML(CASE_QUOTE)), warp: "theme-magma", ringTilt: 0.18 },
    { name: NAMES[8], px:78, py:20, r:40, planet: PLANETS.violet, label:"ForgeQuest", action: () => openLanding("ForgeQuest AI", caseStudyHTML(CASE_FORGE)), warp: "theme-violet", ringTilt: -0.22 },
    { name: NAMES[1], px:18, py:55, r:38, planet: PLANETS.aqua,   label:"StorIQ", action: () => openLanding("StorIQ Location SEO Builder", caseStudyHTML(CASE_STORIQ)), warp: "theme-cyan", ringTilt: 0.2 },
    { name: NAMES[7], px:82, py:55, r:38, planet: PLANETS.aqua,   label:"Will Tool", action: () => openLanding("Will Tool — Dynamic PDF", caseStudyHTML(CASE_B)), warp: "theme-cyan" },
    { name: NAMES[5], px:28, py:78, r:34, planet: PLANETS.mint,   label:"Elize's Canteen", action: () => openLanding("Elize's Canteen", caseStudyHTML(CASE_CANTEEN)), warp: "theme-emerald", ringTilt: -0.15 },
    { name: NAMES[0], px:50, py:78, r:36, planet: PLANETS.amber,  label:"Farmily", action: () => openLanding("Farmily — Mobile Foundations", caseStudyHTML(CASE_D)), warp: "theme-magma", ringTilt: 0.12 },
    { name: NAMES[6], px:72, py:78, r:34, planet: PLANETS.coral,  label:"Horror HUD", action: () => openLanding("Horror Mission HUD", caseStudyHTML(CASE_A)), warp: "theme-magma" },
    { name: NAMES[9], px:50, py:62, r:32, planet: PLANETS.violet, label:"ARPG UI", action: () => openLanding("Hack & Slash ARPG UI", caseStudyHTML(CASE_C)), warp: "theme-violet", ringTilt: 0.25 },
    { name: NAMES[2], px:50, py:92, r:34, planet: PLANETS.amber,  label:"← Back", action: () => setRoom(0), warp: "theme-magma" },
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

// === Decorative Space Station (procedural Star Wars / Trek vibe) ============
const STATION_CFG = {
  label: SITE.station?.label || "Station",
  sprite: "", // procedural art — ignore flat PNG icon
  px: (typeof SITE.station?.px === "number") ? SITE.station.px : 22,
  py: (typeof SITE.station?.py === "number") ? SITE.station.py : 58,
  scale: SITE.station?.scale ?? 1.35
};
const STATION = {
  r: 28, rot: 0, rotSpeed: 0.0022, pulse: 0, ringRot: 0,
  ...STATION_CFG
};

function drawStation(){
  const x = toPx(STATION.px, width);
  const y = toPx(STATION.py, height);
  const R = STATION.r * (STATION.scale || 1);
  const t = performance.now();

  STATION.rot += STATION.rotSpeed;
  STATION.ringRot += STATION.rotSpeed * 0.55;
  STATION.pulse = 0.5 + 0.5 * Math.sin(t * 0.0024);

  uictx.save();
  uictx.translate(x, y);

  // ambient glow behind the station
  const glow = uictx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 3.2);
  glow.addColorStop(0, `rgba(120,180,255,${0.16 + STATION.pulse * 0.08})`);
  glow.addColorStop(0.45, "rgba(80,130,220,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  uictx.fillStyle = glow;
  uictx.beginPath(); uictx.arc(0, 0, R * 3.2, 0, Math.PI * 2); uictx.fill();

  // outer habitat ring (DS9 / Golan vibe) — slow counter-rotate
  uictx.save();
  uictx.rotate(STATION.ringRot);
  uictx.strokeStyle = "rgba(170,195,230,0.55)";
  uictx.lineWidth = Math.max(2, R * 0.08);
  uictx.beginPath(); uictx.arc(0, 0, R * 1.72, 0, Math.PI * 2); uictx.stroke();
  uictx.strokeStyle = "rgba(90,120,170,0.85)";
  uictx.lineWidth = Math.max(1, R * 0.035);
  uictx.beginPath(); uictx.arc(0, 0, R * 1.58, 0, Math.PI * 2); uictx.stroke();
  // ring modules / docking bays
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const mx = Math.cos(a) * R * 1.65;
    const my = Math.sin(a) * R * 1.65;
    uictx.save();
    uictx.translate(mx, my);
    uictx.rotate(a + Math.PI / 2);
    uictx.fillStyle = i % 2 ? "#6a7f9e" : "#4e617c";
    uictx.fillRect(-R * 0.14, -R * 0.08, R * 0.28, R * 0.16);
    uictx.fillStyle = i % 3 === 0
      ? `rgba(255,220,120,${0.45 + STATION.pulse * 0.4})`
      : `rgba(120,210,255,${0.35 + STATION.pulse * 0.35})`;
    uictx.fillRect(-R * 0.05, -R * 0.03, R * 0.1, R * 0.06);
    uictx.restore();
  }
  // spokes to hub
  uictx.strokeStyle = "rgba(140,165,200,0.45)";
  uictx.lineWidth = Math.max(1, R * 0.03);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    uictx.beginPath();
    uictx.moveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7);
    uictx.lineTo(Math.cos(a) * R * 1.55, Math.sin(a) * R * 1.55);
    uictx.stroke();
  }
  uictx.restore();

  // tilted orbital ring (Death Star / ringworld silhouette)
  uictx.save();
  uictx.rotate(-0.42 + STATION.rot * 0.15);
  uictx.strokeStyle = `rgba(190,215,255,${0.35 + STATION.pulse * 0.2})`;
  uictx.lineWidth = Math.max(1.2, R * 0.045);
  uictx.shadowColor = "rgba(120,180,255,0.55)";
  uictx.shadowBlur = 10;
  uictx.beginPath(); uictx.ellipse(0, 0, R * 2.15, R * 0.72, 0, 0, Math.PI * 2); uictx.stroke();
  uictx.shadowBlur = 0;
  // ring traffic lights
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.0006;
    const lx = Math.cos(a) * R * 2.15;
    const ly = Math.sin(a) * R * 0.72;
    uictx.fillStyle = i % 2
      ? `rgba(255,230,140,${0.5 + STATION.pulse * 0.5})`
      : `rgba(140,220,255,${0.45 + STATION.pulse * 0.4})`;
    uictx.beginPath(); uictx.arc(lx, ly, Math.max(1.2, R * 0.045), 0, Math.PI * 2); uictx.fill();
  }
  uictx.restore();

  // main body rotates slowly
  uictx.save();
  uictx.rotate(STATION.rot);

  // solar / radiator wings
  for (const side of [-1, 1]) {
    uictx.fillStyle = "#2a3648";
    uictx.fillRect(side * R * 0.55, -R * 0.95, side * R * 0.95, R * 0.28);
    uictx.fillStyle = "#3d5168";
    uictx.fillRect(side * R * 0.58, -R * 0.9, side * R * 0.88, R * 0.08);
    uictx.fillRect(side * R * 0.58, -R * 0.78, side * R * 0.88, R * 0.08);
    // panel grid
    uictx.strokeStyle = "rgba(100,180,255,0.25)";
    uictx.lineWidth = 0.8;
    for (let g = 0; g < 5; g++) {
      const gx = side * (R * 0.62 + g * R * 0.18);
      uictx.beginPath();
      uictx.moveTo(gx, -R * 0.95);
      uictx.lineTo(gx, -R * 0.67);
      uictx.stroke();
    }
    // blue energy shimmer on panels
    uictx.fillStyle = `rgba(100,190,255,${0.08 + STATION.pulse * 0.1})`;
    uictx.fillRect(side * R * 0.58, -R * 0.92, side * R * 0.88, R * 0.22);
  }

  // spherical hub (Death Star core)
  const hub = uictx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.1, 0, 0, R * 0.95);
  hub.addColorStop(0, "#d8e6ff");
  hub.addColorStop(0.35, "#8aa0c0");
  hub.addColorStop(0.7, "#4a5a72");
  hub.addColorStop(1, "#1c2430");
  uictx.fillStyle = hub;
  uictx.beginPath(); uictx.arc(0, 0, R * 0.78, 0, Math.PI * 2); uictx.fill();

  // equatorial trench
  uictx.strokeStyle = "#0e141c";
  uictx.lineWidth = Math.max(2, R * 0.1);
  uictx.beginPath(); uictx.arc(0, 0, R * 0.78, -0.18, Math.PI + 0.18); uictx.stroke();
  uictx.strokeStyle = "rgba(255,210,120,0.35)";
  uictx.lineWidth = Math.max(1, R * 0.035);
  uictx.beginPath(); uictx.arc(0, 0, R * 0.78, 0.15, Math.PI - 0.15); uictx.stroke();

  // surface panel lines
  uictx.strokeStyle = "rgba(20,28,40,0.55)";
  uictx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    uictx.beginPath();
    uictx.ellipse(0, 0, R * 0.78, R * 0.78 * Math.abs(Math.cos(i * 0.35)), 0, 0, Math.PI * 2);
    uictx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    uictx.beginPath();
    uictx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
    uictx.lineTo(Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76);
    uictx.stroke();
  }

  // superlaser / sensor dish (Death Star homage — small)
  uictx.fillStyle = "#2a3548";
  uictx.beginPath(); uictx.arc(-R * 0.28, -R * 0.28, R * 0.22, 0, Math.PI * 2); uictx.fill();
  uictx.strokeStyle = "#6a7f9e";
  uictx.lineWidth = 1.2;
  uictx.stroke();
  const dish = uictx.createRadialGradient(-R * 0.28, -R * 0.28, 0, -R * 0.28, -R * 0.28, R * 0.16);
  dish.addColorStop(0, `rgba(180,230,255,${0.55 + STATION.pulse * 0.35})`);
  dish.addColorStop(0.6, "rgba(60,120,180,0.35)");
  dish.addColorStop(1, "rgba(20,40,60,0.1)");
  uictx.fillStyle = dish;
  uictx.beginPath(); uictx.arc(-R * 0.28, -R * 0.28, R * 0.16, 0, Math.PI * 2); uictx.fill();

  // command tower / spire
  uictx.fillStyle = "#5a6e88";
  uictx.fillRect(-R * 0.08, -R * 1.15, R * 0.16, R * 0.4);
  uictx.fillStyle = "#8aa0c0";
  uictx.fillRect(-R * 0.12, -R * 1.2, R * 0.24, R * 0.1);
  uictx.fillStyle = `rgba(255,220,120,${0.55 + STATION.pulse * 0.45})`;
  uictx.beginPath(); uictx.arc(0, -R * 1.22, Math.max(1.5, R * 0.05), 0, Math.PI * 2); uictx.fill();

  // docking arm
  uictx.strokeStyle = "#7a90b0";
  uictx.lineWidth = Math.max(1.5, R * 0.05);
  uictx.beginPath();
  uictx.moveTo(R * 0.55, R * 0.2);
  uictx.lineTo(R * 1.15, R * 0.55);
  uictx.stroke();
  uictx.fillStyle = "#9bb0cc";
  uictx.beginPath(); uictx.arc(R * 1.15, R * 0.55, R * 0.1, 0, Math.PI * 2); uictx.fill();
  uictx.fillStyle = `rgba(120,220,255,${0.4 + STATION.pulse * 0.4})`;
  uictx.beginPath(); uictx.arc(R * 1.15, R * 0.55, R * 0.045, 0, Math.PI * 2); uictx.fill();

  // hull window lights
  const windows = [
    [0.35, 0.15], [0.45, -0.1], [0.2, 0.4], [-0.15, 0.35],
    [0.55, 0.35], [-0.45, 0.15], [0.1, -0.5], [-0.5, -0.15]
  ];
  for (let i = 0; i < windows.length; i++) {
    const [wx, wy] = windows[i];
    const blink = 0.45 + 0.55 * Math.sin(t * 0.003 + i * 1.7);
    uictx.fillStyle = i % 3 === 0
      ? `rgba(255,220,120,${blink})`
      : `rgba(160,220,255,${blink})`;
    uictx.fillRect(wx * R, wy * R, Math.max(1.5, R * 0.06), Math.max(1.2, R * 0.045));
  }

  // engine glow at the "rear"
  uictx.fillStyle = `rgba(100,190,255,${0.25 + STATION.pulse * 0.35})`;
  uictx.beginPath(); uictx.ellipse(0, R * 0.72, R * 0.22, R * 0.1, 0, 0, Math.PI * 2); uictx.fill();
  uictx.fillStyle = `rgba(220,245,255,${0.35 + STATION.pulse * 0.4})`;
  uictx.beginPath(); uictx.ellipse(0, R * 0.72, R * 0.1, R * 0.045, 0, 0, Math.PI * 2); uictx.fill();

  uictx.restore(); // end body rotate

  // nav beacon (world-space, doesn't spin with hull)
  uictx.fillStyle = `rgba(255,255,255,${0.7 + STATION.pulse * 0.3})`;
  uictx.shadowColor = "rgba(180,220,255,0.9)";
  uictx.shadowBlur = 8;
  uictx.beginPath();
  uictx.arc(R * 1.55, -R * 0.15, 1.8 + STATION.pulse * 1.2, 0, Math.PI * 2);
  uictx.fill();
  uictx.shadowBlur = 0;

  uictx.restore();

  // label plate
  uictx.font = "700 12px 'Space Grotesk', 'Segoe UI', sans-serif";
  const label = STATION.label || "Station";
  if (STATION._lw == null) STATION._lw = uictx.measureText(label).width;
  const lw = STATION._lw;
  const ly = y + R * 1.85;
  const padX = 10, padY = 5;
  const bx = x - lw / 2 - padX;
  const by = ly - 11;
  const bw = lw + padX * 2;
  const bh = 18;
  uictx.fillStyle = "rgba(8,14,26,0.6)";
  uictx.beginPath();
  uictx.moveTo(bx + 9, by);
  uictx.arcTo(bx + bw, by, bx + bw, by + bh, 9);
  uictx.arcTo(bx + bw, by + bh, bx, by + bh, 9);
  uictx.arcTo(bx, by + bh, bx, by, 9);
  uictx.arcTo(bx, by, bx + bw, by, 9);
  uictx.closePath();
  uictx.fill();
  uictx.strokeStyle = "rgba(140,180,230,0.4)";
  uictx.lineWidth = 1;
  uictx.stroke();
  uictx.fillStyle = "#d5e6ff";
  uictx.fillText(label, x - lw / 2, ly);
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
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (lightbox && !lightbox.hidden) return; // lightbox owns Escape
    if (landing && !landing.hidden) closeLanding();
  });
}
function closeLanding(){
  if (!landing) return;
  closeLightbox();
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
  bindCaseGalleries(landing);
  landing.querySelectorAll("[data-case]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-case");
      const cs = CASE_BY_KEY[key];
      if (!cs) return;
      openLanding(cs.title, caseStudyHTML(cs));
    });
  });
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

async function enterMission({ playSfx = true } = {}){
  if (missionStarted) return;
  if (playSfx && shootSfx) {
    try {
      await shootSfx.play();
      shootSfx.pause();
      shootSfx.currentTime = 0;
    } catch {}
  }
  startBgMusic();
  startWarp(pickWarpTheme(true));
}

startBtn?.addEventListener("click", () => enterMission({ playSfx: true }));

// Clear older auto-skip preference so revisit no longer jumps past the crawl
try { localStorage.removeItem("rvdw-entered-mission"); } catch {}

// ADD: pause heavy work when tab hidden (lower warp target & star density)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden"){
    warpTarget = CONFIG.STARS.IDLE_SPEED;
    STAR_STEP = 3;
  } else {
    STAR_STEP = LOW_END ? 2 : 1;
  }
}, { passive: true });
