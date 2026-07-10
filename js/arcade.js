// js/arcade.js — "INFERNO" — a complete retro FPS built from scratch.
// Raycast renderer (DDA, textured walls, sliding doors, sprite billboards,
// per-column z-clipping) + full game: title screen, 4 weapons (incl. BFG),
// 15 enemy types incl. a boss, themed props, secret alcoves, armor, themed floors, projectiles, barrels,
// keycards, auto + locked doors, pickups, particles, minimap, synth sound,
// score/tally screens, persistent hi-score, 5 themed levels.
// Gun viewmodels: procedural Doom-style weapons (pistol/shotgun/plasma/BFG).
// API: window.initArcade(id) / window.destroyArcade().
(function () {
  "use strict";

  // ============================ LEVELS ============================
  // walls: # brick · T tech · S slime · M metal · X exit(needs red key)
  //        D auto sliding door · G red-locked door · = blue-locked door
  //        + yellow-locked door
  // floor: . or space · ~ hazard(theme: toxic/lava) · @ / $ teleporter pair
  //        ! ambush trigger · ^ crusher · < / > lift pad pair
  // enemies: E imp · C caster · U brute · F wraith · R gunner · L lurker
  //          N nightmare · H hound · O ogre · J jelly · Z boss
  //          A arachnid · I cultist · V vulture · K knight · g egg · 1/2/3 minibosses
  // pickups: h health · v armor · a bullets · s shells · c cells · o rockets
  //          k RED key · b BLUE key · y YELLOW key
  //          W shotgun · Q plasma · Y BFG · n chainsaw · m rocket · e berserk
  //          p rapid-fire mod · x spread mod · l lifesteal mod · z mine pack
  //          B exploding barrel · props: t r i u f
  const LEVELS = [
    {
      "name": "E1: STEEL HANGAR",
      "theme": "hangar",
      "par": 100,
      "rows": [
        "##############################",
        "#P........#........#........h#",
        "#..n......D........D....E..A.#",
        "#....r....#...B....#.........#",
        "#.........#........#...h.v...#",
        "####D######........#####D#####",
        "#.....#....#.......#....a....#",
        "#..W..D....#.......D.........#",
        "#..r..#....#.......#....E....#",
        "#.....#..B.#.......#....r....#",
        "#.....#....#...h...#...pB....#",
        "#######....#.......######....#",
        "#.....#....D.....E.....R...h.#",
        "#..E..#....#..B..........E...#",
        "#.....%....#.....H........a..#",
        "#.....#....#!...s...........X#",
        "#..a..D....#....##############",
        "#..B..#....#....#..k....r....#",
        "####D##....#....########D#####",
        "#....E....C....A....E....U...#",
        "#....L.....H....A...F....R...#",
        "#....##*##.....E.....L....J..#",
        "#....#ca.#...................#",
        "##############################"
      ]
    },
    {
      "name": "E2: THE BLACK MIRE",
      "theme": "swamp",
      "par": 140,
      "rows": [
        "################################",
        "#P......#...........#.........h#",
        "#.......D...........D.....A....#",
        "#...t...#....B.t....#.....v..k.#",
        "#.......#....E......#.....H....#",
        "####D########....##########D####",
        "#.....#....s.t......#....t..b..#",
        "#..s..=....#....F...D....a.....#",
        "#..E..#..t.#...A....#....E.....#",
        "#.t...#....#...SS...#....t.....#",
        "####D##....#.......######D######",
        "#....#..e..#....B..#......C....#",
        "#..C.D...t.#.......#....t......#",
        "#....#..h..#...E...#....s......#",
        "#..a.#..h..#..~.~..####D########",
        "####D#######..F.t..#.........h.#",
        "#......E..#....#...D....H......#",
        "#..h......D....#...#....t......#",
        "#....t.t..#....#...#....x......#",
        "#...B..E..#....#...#..a........#",
        "###########G########.#######X###",
        "#....E.....C....1...E....A....##",
        "#....R....H..t..E.....F.......##",
        "#....##*##..h~..A..........v...#",
        "#....#cv.#.....................#",
        "################################"
      ]
    },
    {
      "name": "E3: BONE CATACOMBS",
      "theme": "dungeon",
      "par": 170,
      "rows": [
        "##################################",
        "#P.......#.........h........#....#",
        "#........D.........A........D....#",
        "#..R..i..#...B.......B......#..O.#",
        "#........#......F...........#..k.#",
        "#####D########......#########D####",
        "#.......#....s...a.....#....y....#",
        "#..s....+....#.........#.....a...#",
        "#..O..i.#....#...F.....#.....C...#",
        "#.......#....#...A.....#....i....#",
        "#####D#######.........###D########",
        "#.....#%....#...H...#...#...A....#",
        "#..C..#.<...#.......#...#.....R..#",
        "#.....D.....#..Q....#...D........#",
        "#..a..#.....#..v.c..#...#.....s..#",
        "#####D#######..F....#####D########",
        "#...m......#........#....E.....h.#",
        "#..h..R....D...B....#....#..l....#",
        "#..........#........#....#>..c...#",
        "#..B..E....#...F....#....#......X#",
        "############G########.######D#####",
        "#....E.....A....@..O.....F......##",
        "#......L....N..I.H....O....L.2..##",
        "#....##*##..$..R.....A.....o.....#",
        "#....#ac.#.......................#",
        "##################################"
      ]
    },
    {
      "name": "E4: SLAG FOUNDRY",
      "theme": "foundry",
      "par": 200,
      "rows": [
        "##################################",
        "#P.........#.......C...........h.#",
        "#...U......D.........A...........#",
        "#..........#....#####............#",
        "#..s.......#....#...c......v.....#",
        "#####D######....####.............#",
        "#..c.......#...........R......s..#",
        "#..U.......=..C....U.............#",
        "#.....A....#.....H...............#",
        "############......h.......########",
        "#....E...........f.....L....b.s..#",
        "#MM..~.f..............MM.....c...#",
        "#..a.....A...........R......^....#",
        "#........B...F...F...B......^....#",
        "##########...........#.........h.#",
        "#MM...........@..N...#.......c...#",
        "#....H.....A...x.....%....F....s.#",
        "#####D######....######...........#",
        "#....s..h.F....c........z.....a..#",
        "#....N.......$.....L....R........#",
        "#....L..g......H....A...3....J...#",
        "#.............~.................X#",
        "#....##*##.....o.........k.......#",
        "#....#ca.#.......................#",
        "##################################"
      ]
    },
    {
      "name": "E5: THRONE OF CINDER",
      "theme": "throne",
      "par": 260,
      "rows": [
        "##################################",
        "#P.........#.......C...........h.#",
        "#...U......D.........A...........#",
        "#..........#....#####............#",
        "#..s.......#....#...c......v.....#",
        "#####D######....####.............#",
        "#..c.......#...........R......s..#",
        "#..U.......D..C....O.............#",
        "#.....A....#.....H...............#",
        "############......h.......###D####",
        "#Y..c.#..........................#",
        "#.....#MM......A.l......MM...c...#",
        "#..a..=..........................#",
        "########...B...F.Z.F...B.........#",
        "#......^......#.....#..........h.#",
        "#MM.<...g.....#.....#........c...#",
        "#.........^...#.....#.......b..s.#",
        "#####+#####...#######............#",
        "#....s..h.F....c..........y....a.#",
        "#....N...!........L....R....>....#",
        "#......I.......N.......H....K....#",
        "#....u.....E.....A..z.....V...u..#",
        "#....##*##.....R.....A...........#",
        "#....#vc.#.......................#",
        "##################################"
      ]
    }
  ];
  const WALLS = { "#": 1, "T": 2, "S": 3, "M": 4, "X": 5, "D": 6, "G": 7, "*": 8, "%": 9, "=": 10, "+": 11 };
  const DOOR_SPEED = 2.2;   // openness units per second
  const DOOR_HOLD = 4;      // seconds a door stays open
  let diff = 1; // 0 recruit / 1 normal / 2 nightmare
  const DIFF_NAMES = ["RECRUIT", "NORMAL", "NIGHTMARE"];
  const DIFF_MUL  = [0.75, 1.0, 1.35]; // hp/dmg scale

  // ---- daily challenge / deterministic RNG ----
  let dailyMode = false, dailySeed = 0;
  function todaySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  // small deterministic PRNG (mulberry32) — used only for daily enemy jitter
  function seededRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ============================ CONFIG ============================
  // Base ("chrome") space: HUD/menus are authored in 320x200 coordinates and
  // drawn through a scale transform. The 3D view renders at SCALE x that —
  // up to 960x600 — chosen from the display and stepped down automatically
  // if the device can't keep up.
  const BW = 320, BH = 200, BHUD = 36, VIEW_B = BH - BHUD;
  let SCALE = 2, W = BW * 2, H = BH * 2, VIEW_H = VIEW_B * 2;
  const FOV_PLANE = 0.66;
  const TEX = 128; // art is authored in 64-space and rendered at 2x

  const WEAPONS = [
    { name: "PISTOL",   ammo: "bullets", rate: 0.32, pellets: 1, spread: 0.012, dmg: [12, 18],  kick: 4,  color: "#ffe6a0" },
    { name: "SHOTGUN",  ammo: "shells",  rate: 0.95, pellets: 6, spread: 0.085, dmg: [8, 13],   kick: 9,  color: "#ffd07a" },
    { name: "PLASMA",   ammo: "cells",   rate: 0.15, proj: true, cost: 1,  dmg: [18, 26],  kick: 2,  color: "#9fe8ff" },
    { name: "BFG",      ammo: "cells",   rate: 1.35, proj: true, cost: 40, bfg: true, dmg: [90, 130], splash: 2.8, kick: 16, color: "#7dff9a" },
    { name: "CHAINSAW", ammo: "none",    rate: 0.12, melee: true, range: 1.15, dmg: [18, 28],  kick: 2,  color: "#88cc44" },
    { name: "ROCKET",   ammo: "rockets", rate: 0.90, proj: true, cost: 1, rocket: true, dmg: [55, 80], splash: 2.2, kick: 12, color: "#ff7722" }
  ];

  const ETYPES = {
    imp:    { hp: 30,  sp: 1.7,  scale: 1.0,  mdmg: [8, 14],  mrange: 1.05, score: 100,
              pal: { body: "#7a2d1c", skin: "#8f3a24", eye: "#ffe14a" } },
    caster: { hp: 24,  sp: 1.3,  scale: 0.95, mdmg: [6, 10],  mrange: 0.9,  score: 150,
              ranged: { cd: 1.7, speed: 4.2, dmg: [10, 16], hold: 4.2 },
              pal: { body: "#3a2050", skin: "#5a3a80", eye: "#c88aff" } },
    brute:  { hp: 90,  sp: 1.05, scale: 1.28, mdmg: [18, 26], mrange: 1.15, score: 250,
              pal: { body: "#2f4032", skin: "#48604a", eye: "#a6ffbf" } },
    wraith: { hp: 16,  sp: 2.7,  scale: 0.9,  mdmg: [6, 10],  mrange: 0.95, score: 150, ghost: true,
              pal: { body: "#3e5a6e", skin: "#7da8c0", eye: "#d5f4ff" } },
    gunner: { hp: 40,  sp: 1.4,  scale: 1.05, mdmg: [6, 10],  mrange: 0.9,  score: 200,
              ranged: { cd: 1.15, speed: 7, dmg: [6, 10], hold: 5.5 },
              pal: { body: "#4a3a20", skin: "#8a6b3a", eye: "#ffb04a" } },
    lurker: { hp: 22,  sp: 3.1,  scale: 0.85, mdmg: [10, 16], mrange: 0.85, score: 175,
              pal: { body: "#1a2a18", skin: "#3a5a32", eye: "#9dff7a" } },
    nightmare: { hp: 110, sp: 1.15, scale: 1.35, mdmg: [16, 24], mrange: 1.2, score: 320,
              ranged: { cd: 2.1, speed: 3.6, dmg: [12, 18], hold: 5.0 },
              pal: { body: "#2a1038", skin: "#5a2080", eye: "#ff66cc" } },
    hound:  { hp: 18,  sp: 3.6,  scale: 0.78, mdmg: [8, 14],  mrange: 0.95, score: 140,
              pal: { body: "#4a2010", skin: "#7a3a18", eye: "#ff9040" } },
    ogre:   { hp: 140, sp: 0.9,  scale: 1.45, mdmg: [20, 28], mrange: 1.25, score: 350,
              pal: { body: "#3a3020", skin: "#6a5840", eye: "#ffe08a" } },
    jelly:  { hp: 36,  sp: 1.1,  scale: 0.92, mdmg: [6, 10],  mrange: 0.85, score: 180,
              ranged: { cd: 1.4, speed: 3.2, dmg: [8, 14], hold: 4.0 },
              pal: { body: "#1a4030", skin: "#3a9060", eye: "#b0ff80" } },
    arachnid: { hp: 20, sp: 3.4, scale: 0.72, mdmg: [7, 12], mrange: 0.8, score: 130,
              pal: { body: "#3a1018", skin: "#6a2030", eye: "#ff4060" } },
    cultist: { hp: 48, sp: 1.35, scale: 1.0, mdmg: [8, 12], mrange: 0.95, score: 190,
              ranged: { cd: 1.6, speed: 5.0, dmg: [9, 14], hold: 5.0 },
              pal: { body: "#2a1828", skin: "#5a3048", eye: "#ff90c0" } },
    vulture: { hp: 28, sp: 2.9, scale: 0.88, mdmg: [7, 11], mrange: 0.9, score: 160, ghost: true,
              pal: { body: "#3a2a18", skin: "#6a4a28", eye: "#ffd070" } },
    knight: { hp: 160, sp: 0.85, scale: 1.4, mdmg: [18, 26], mrange: 1.2, score: 380,
              pal: { body: "#2a3038", skin: "#5a6878", eye: "#8ad8ff" } },
    boss:      { hp: 480, sp: 0.95, scale: 2.15, mdmg: [22, 30], mrange: 1.4,  score: 1000, boss: true,
              ranged: { cd: 1.5, speed: 4.6, dmg: [12, 18], hold: 7, burst: 3 },
              pal: { body: "#5a1010", skin: "#8a1f14", eye: "#ffd75e" } },
    egg:       { hp: 12,  sp: 0,    scale: 0.6,  mdmg: [0, 0],   mrange: 0,    score: 50,
              pal: { body: "#c8b898", skin: "#e0d0a8", eye: "#88aa44" } },
    swampLord: { hp: 160, sp: 0.85,  scale: 1.4, mdmg: [16, 24], mrange: 1.2, score: 500, miniboss: true, title: "SWAMP LORD",
              ranged: { cd: 1.8, speed: 3.5, dmg: [14, 20], hold: 4.5 },
              pal: { body: "#1a4020", skin: "#3a6840", eye: "#88ff66" } },
    boneWarden:{ hp: 200, sp: 0.85, scale: 1.4,  mdmg: [18, 26], mrange: 1.2,  score: 500, miniboss: true, title: "BONE WARDEN", shield: true,
              pal: { body: "#3a3028", skin: "#6a5838", eye: "#88ccff" } },
    slagTitan: { hp: 250, sp: 1.0,  scale: 1.5,  mdmg: [20, 30], mrange: 1.3,  score: 500, miniboss: true, title: "SLAG TITAN",
              ranged: { cd: 1.8, speed: 4.0, dmg: [15, 22], hold: 5.0 },
              pal: { body: "#4a2010", skin: "#7a3818", eye: "#ff8844" } }
  };
  const ECHARS = {
    E: "imp", C: "caster", U: "brute", Z: "boss", F: "wraith", R: "gunner",
    L: "lurker", N: "nightmare", H: "hound", O: "ogre", J: "jelly",
    A: "arachnid", I: "cultist", V: "vulture", K: "knight",
    g: "egg", "1": "swampLord", "2": "boneWarden", "3": "slagTitan"
  };

  // ============================ AUDIO (synth) ============================
  let actx = null;
  function audio() {
    if (window.__RVDW_MUTED) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  function tone(f0, f1, dur, type, vol) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(f0, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }
  function noiseBurst(dur, vol, cutoff) {
    const a = audio(); if (!a) return;
    const len = (a.sampleRate * dur) | 0;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff || 900;
    const g = a.createGain(); g.gain.value = vol || 0.12;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }
  const SFX = {
    // punchy gunshots: sharp crack (noise) + tonal snap + low thump for body
    pistol:  function () { noiseBurst(0.05, 0.24, 3400); tone(520, 110, 0.07, "square", 0.16); tone(150, 45, 0.08, "sine", 0.14); },
    shotgun: function () { noiseBurst(0.10, 0.42, 3200); noiseBurst(0.34, 0.34, 1300); tone(95, 38, 0.30, "triangle", 0.24); },
    plasma:  function () { tone(880, 230, 0.13, "sawtooth", 0.16); tone(1500, 500, 0.07, "square", 0.08); },
    bfg:     function () { noiseBurst(0.22, 0.55, 900); tone(70, 40, 0.55, "sawtooth", 0.35); tone(180, 90, 0.4, "square", 0.2); tone(40, 30, 0.7, "triangle", 0.28); },
    hurt:    function () { tone(180, 55, 0.24, "sawtooth", 0.13); noiseBurst(0.08, 0.08, 1200); },
    edie:    function () { tone(300, 42, 0.34, "square", 0.11); noiseBurst(0.18, 0.09, 700); },
    boom:    function () { noiseBurst(0.55, 0.34, 520); tone(85, 28, 0.5, "sine", 0.26); tone(200, 40, 0.3, "sawtooth", 0.12); },
    pickup:  function () { tone(620, 990, 0.1, "sine", 0.09); },
    key:     function () { tone(520, 780, 0.12, "sine", 0.1); tone(780, 1170, 0.14, "sine", 0.07); },
    nokey:   function () { tone(120, 110, 0.16, "square", 0.09); },
    switch:  function () { tone(240, 360, 0.05, "square", 0.07); noiseBurst(0.03, 0.05, 2600); },
    fireball:function () { tone(440, 150, 0.18, "sawtooth", 0.08); },
    roar:    function () { tone(95, 38, 0.8, "sawtooth", 0.2); noiseBurst(0.6, 0.14, 380); tone(60, 30, 0.7, "sine", 0.18); },
    empty:    function () { tone(90, 80, 0.05, "square", 0.06); },
    step:     function () {},
    chainsaw: function () { noiseBurst(0.08, 0.28, 2800); tone(280, 220, 0.08, "sawtooth", 0.12); },
    rocket:   function () { noiseBurst(0.14, 0.40, 2000); tone(130, 52, 0.22, "sine", 0.24); tone(80, 38, 0.28, "sawtooth", 0.14); },
    teleport: function () { tone(440, 1200, 0.18, "sine", 0.13); tone(880, 440, 0.12, "square", 0.07); },
    buzz:     function () { noiseBurst(0.06, 0.18, 3200); tone(320, 260, 0.06, "square", 0.08); }
  };

  // ============================ ART (procedural) ============================
  // art is authored in 64-unit space but rasterized at TEX (128) resolution —
  // the 2x oversampling is what keeps walls/sprites clean at high render scale
  function mkTex(size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.scale(size / 64, size / 64);
    draw(g);
    return c;
  }
  // raw-pixel-space copy helpers (NOT via mkTex — that would re-scale the art)
  function darken(tex) {
    const c = document.createElement("canvas");
    c.width = c.height = tex.width;
    const g = c.getContext("2d");
    g.drawImage(tex, 0, 0);
    g.fillStyle = "rgba(0,0,0,0.36)";
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  // subtle top-light / bottom-shade — sells depth on flat procedural walls
  function polish(tex) {
    const g = tex.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, tex.height);
    gr.addColorStop(0,   "rgba(255,255,255,0.07)");
    gr.addColorStop(0.5, "rgba(255,255,255,0)");
    gr.addColorStop(1,   "rgba(0,0,0,0.28)");
    g.fillStyle = gr;
    g.fillRect(0, 0, tex.width, tex.height);
    return tex;
  }
  function buildTextures() {
    const brick = mkTex(TEX, function (g) {
      g.fillStyle = "#4a1f16"; g.fillRect(0, 0, TEX, TEX);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const off = (y % 2) * 8;
        g.fillStyle = ["#6b2a1c", "#75301f", "#61261a", "#70392a"][(x + y * 3) % 4];
        g.fillRect(x * 16 + off - 8, y * 16, 15, 15);
      }
      g.fillStyle = "rgba(0,0,0,.35)";
      for (let y = 0; y < 4; y++) g.fillRect(0, y * 16 + 15, 64, 1);
      speckle(g, 42, 80, ["#3a150e", "#8a4530", "#2a0f0a", "#93503a"], 1, 2.5);
    });
    const tech = mkTex(TEX, function (g) {
      g.fillStyle = "#1a2236"; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = "#232c47"; g.fillRect(4, 4, 56, 56);
      g.fillStyle = "#2c3a5e"; g.fillRect(8, 8, 48, 20);
      g.fillStyle = "#ffd75e"; g.fillRect(8, 32, 48, 3);
      g.fillStyle = "#8ad8ff"; g.fillRect(12, 42, 8, 8); g.fillRect(28, 42, 8, 8); g.fillRect(44, 42, 8, 8);
      speckle(g, 91, 36, ["#101624", "#324260", "#0c1020"], 1, 2);
    });
    const slime = mkTex(TEX, function (g) {
      g.fillStyle = "#242e24"; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = ["#2e402c", "#39543a", "#1d271d", "#456349"][i % 4];
        const s = 4 + (i * 7) % 12;
        g.fillRect((i * 23) % TEX, (i * 41) % TEX, s, s);
      }
      g.fillStyle = "rgba(90,200,120,.25)";
      for (let i = 0; i < 6; i++) g.fillRect((i * 31) % 64, (i * 17) % 64, 3, 10 + (i * 5) % 12);
      speckle(g, 7, 70, ["#557a50", "#1a231a", "#6a9660", "#131a13"], 1, 2.2);
    });
    const metal = mkTex(TEX, function (g) {
      g.fillStyle = "#20242e"; g.fillRect(0, 0, TEX, TEX);
      for (let x = 0; x < 4; x++) {
        g.fillStyle = x % 2 ? "#272c38" : "#1b1f28";
        g.fillRect(x * 16, 0, 16, TEX);
        g.fillStyle = "#3a4254"; g.fillRect(x * 16, 0, 1, TEX);
      }
      g.fillStyle = "#4a5468";
      for (let i = 0; i < 8; i++) g.fillRect(6 + (i % 4) * 16, 8 + ((i / 4) | 0) * 44, 3, 3);
      speckle(g, 133, 55, ["#12151d", "#556077", "#0e1118"], 1, 2);
    });
    const exit = mkTex(TEX, function (g) {
      g.fillStyle = "#0c0d12"; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = "#ffd75e"; g.lineWidth = 4; g.strokeRect(4, 4, 56, 56);
      g.fillStyle = "#ffd75e";
      g.font = "bold 16px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("EXIT", 32, 24);
      g.fillStyle = "#8ad8ff"; g.fillRect(20, 38, 24, 14);
      g.fillStyle = "#0c0d12"; g.fillRect(29, 41, 6, 8); // keyhole
    });
    const door = mkTex(TEX, function (g) {
      g.fillStyle = "#20303f"; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#2c4356"; g.fillRect(3, 2, 58, 60);
      g.fillStyle = "#12202b"; g.fillRect(30, 2, 4, 60);      // centre seam (slides apart)
      g.fillStyle = "#8ad8ff"; g.fillRect(8, 8, 48, 4);       // hazard stripe
      g.fillStyle = "#12202b";
      for (let i = 0; i < 6; i++) g.fillRect(10 + i * 8, 8, 4, 4);
      g.fillStyle = "#8ad8ff";                                 // arrows pointing to seam
      g.beginPath(); g.moveTo(20, 34); g.lineTo(26, 30); g.lineTo(26, 38); g.fill();
      g.beginPath(); g.moveTo(44, 34); g.lineTo(38, 30); g.lineTo(38, 38); g.fill();
      g.fillStyle = "#3a5568"; g.fillRect(3, 2, 58, 2); g.fillRect(3, 58, 58, 2);
    });
    const gold = mkTex(TEX, function (g) { // RED-locked door (needs red keycard)
      g.fillStyle = "#2a0e0c"; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#5e1a16"; g.fillRect(3, 2, 58, 60);
      g.fillStyle = "#8a2a22"; g.fillRect(6, 6, 52, 52);
      g.fillStyle = "#1a0806"; g.fillRect(30, 2, 4, 60);      // seam
      g.fillStyle = "#ff6a5e"; g.fillRect(8, 8, 48, 4);
      // big keyhole medallion
      g.fillStyle = "#ff6a5e"; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill();
      g.fillStyle = "#1a0806"; g.beginPath(); g.arc(32, 30, 3.5, 0, 7); g.fill();
      g.fillRect(30, 30, 4, 10);
    });
    const secret = mkTex(TEX, function (g) {
      g.drawImage(brick, 0, 0);
      g.fillStyle = "rgba(255,215,94,0.18)";
      g.fillRect(30, 8, 4, 48);
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(28, 20, 2, 24); g.fillRect(34, 20, 2, 24);
    });
    // colored locked doors (blue / yellow) — same slab as gold but tinted
    function lockedDoor(base, trim, gem, dark) {
      return mkTex(TEX, function (g) {
        g.fillStyle = dark; g.fillRect(0, 0, 64, 64);
        g.fillStyle = base; g.fillRect(3, 2, 58, 60);
        g.fillStyle = dark; g.fillRect(30, 2, 4, 60);          // seam
        g.fillStyle = trim; g.fillRect(8, 8, 48, 4);
        g.fillStyle = trim; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill();
        g.fillStyle = gem;  g.beginPath(); g.arc(32, 30, 4, 0, 7); g.fill();
        g.fillStyle = dark; g.fillRect(30, 30, 4, 10);
        g.fillStyle = trim; g.fillRect(3, 2, 58, 2); g.fillRect(3, 58, 58, 2);
      });
    }
    const blueDoor   = lockedDoor("#1a2c48", "#5aa0e8", "#d5f0ff", "#0c1626");
    const yellowDoor = lockedDoor("#4a4210", "#ffe14a", "#fff8c0", "#20200a");
    const crackedBrick = mkTex(TEX, function (g) {
      g.drawImage(brick, 0, 0);
      // cracks overlaid on brick
      g.strokeStyle = "#110602"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(12, 6); g.lineTo(22, 24); g.lineTo(15, 40); g.stroke();
      g.beginPath(); g.moveTo(42, 4); g.lineTo(48, 22); g.lineTo(40, 36); g.stroke();
      g.beginPath(); g.moveTo(26, 32); g.lineTo(34, 52); g.lineTo(28, 62); g.stroke();
      g.strokeStyle = "rgba(200,80,40,0.35)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(10, 10); g.lineTo(20, 22); g.stroke();
      g.beginPath(); g.moveTo(44, 6); g.lineTo(50, 18); g.stroke();
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(18, 20, 3, 12); g.fillRect(44, 18, 3, 10);
    });
    const light = [null, brick, tech, slime, metal, exit, door, gold, secret, crackedBrick, blueDoor, yellowDoor].map(function (t) { return t && polish(t); });
    return { light: light, dark: [null].concat(light.slice(1).map(darken)) };
  }

  // demon frames: 0/1 walk, 2 attack, 3 pain, 4 dead — Doom-style pixel creatures
  function buildDemon(pal, opts) {
    opts = opts || {};
    const horns = opts.horns !== false;
    const spikes = !!opts.spikes;
    const bulk = !!opts.bulk;
    function frame(pose) {
      return mkTex(TEX, function (g) {
        const shade = function (c, a) {
          g.fillStyle = c; g.globalAlpha = a == null ? 1 : a;
        };
        if (pose === 4) {
          // bloody puddle + crumpled corpse
          shade("#2a0a08"); g.beginPath(); g.ellipse(32, 58, 22, 5, 0, 0, 7); g.fill();
          shade("#5a1010", 0.7); g.beginPath(); g.ellipse(32, 57, 14, 3.5, 0, 0, 7); g.fill();
          shade(pal.body); g.beginPath(); g.ellipse(30, 52, 14, 7, -0.2, 0, 7); g.fill();
          shade(pal.skin); g.beginPath(); g.ellipse(38, 48, 7, 6, 0.4, 0, 7); g.fill();
          shade("#d8c9a8");
          g.beginPath(); g.moveTo(20, 50); g.lineTo(14, 40); g.lineTo(24, 47); g.fill();
          g.beginPath(); g.moveTo(44, 50); g.lineTo(52, 42); g.lineTo(42, 48); g.fill();
          shade("#8a1a12", 0.85); g.fillRect(26, 50, 3, 2); g.fillRect(34, 53, 4, 2);
          g.globalAlpha = 1; return;
        }
        const bodyC = pose === 3 ? "#c98a7a" : pal.body;
        const skinC = pose === 3 ? "#e8b0a0" : pal.skin;
        const dark = "#1a0806";
        const mid = "#3a1410";

        // shadow
        shade("rgba(0,0,0,0.35)"); g.beginPath(); g.ellipse(32, 61, 12, 3, 0, 0, 7); g.fill();

        // legs with muscle bands
        const legY = pose === 1 ? [44, 48] : pose === 2 ? [46, 46] : [46, 48];
        shade(mid); g.fillRect(23, legY[0], 8, 16); g.fillRect(33, legY[1], 8, 16);
        shade(bodyC); g.fillRect(24, legY[0] + 1, 6, 14); g.fillRect(34, legY[1] + 1, 6, 14);
        shade(dark); g.fillRect(24, legY[0] + 6, 6, 2); g.fillRect(34, legY[1] + 8, 6, 2);
        // hooves / claws
        shade("#0c0504"); g.fillRect(23, 58, 8, 3); g.fillRect(33, 58, 8, 3);
        shade("#d8c9a8"); g.fillRect(22, 59, 2, 3); g.fillRect(30, 59, 2, 3); g.fillRect(32, 59, 2, 3); g.fillRect(40, 59, 2, 3);

        // torso
        const tw = bulk ? 16 : 13, th = bulk ? 17 : 15;
        shade(dark); g.beginPath(); g.ellipse(32, 37, tw + 1, th + 1, 0, 0, 7); g.fill();
        shade(bodyC); g.beginPath(); g.ellipse(32, 36, tw, th, 0, 0, 7); g.fill();
        // belly highlight + rib shadows
        shade(skinC, 0.35); g.beginPath(); g.ellipse(32, 38, tw * 0.55, th * 0.55, 0, 0, 7); g.fill();
        shade(dark, 0.45);
        g.fillRect(24, 30, tw * 1.2, 1.5); g.fillRect(25, 35, tw * 1.1, 1.2); g.fillRect(26, 40, tw, 1.2);
        // chest scars / scales
        shade("#0a0403", 0.5);
        for (let i = 0; i < 5; i++) g.fillRect(27 + (i % 3) * 3, 28 + i * 3, 2, 2);
        if (spikes) {
          shade(mid);
          g.beginPath(); g.moveTo(32, 20); g.lineTo(28, 28); g.lineTo(36, 28); g.fill();
          g.beginPath(); g.moveTo(22, 26); g.lineTo(18, 34); g.lineTo(24, 32); g.fill();
          g.beginPath(); g.moveTo(42, 26); g.lineTo(46, 34); g.lineTo(40, 32); g.fill();
        }
        g.globalAlpha = 1;

        // arms
        shade(skinC);
        if (pose === 2) {
          g.fillRect(10, 16, 7, 18); g.fillRect(47, 16, 7, 18);
          shade(bodyC); g.fillRect(11, 22, 5, 4); g.fillRect(48, 22, 5, 4);
          shade("#e8e0c8");
          g.fillRect(8, 12, 10, 6); g.fillRect(46, 12, 10, 6);
          // claws
          shade("#d8c9a8");
          for (let i = 0; i < 3; i++) {
            g.fillRect(8 + i * 3, 10, 2, 4);
            g.fillRect(48 + i * 3, 10, 2, 4);
          }
        } else if (pose === 1) {
          g.fillRect(14, 32, 7, 16); g.fillRect(43, 28, 7, 16);
          shade("#d8c9a8"); g.fillRect(13, 46, 3, 4); g.fillRect(49, 42, 3, 4);
        } else {
          g.fillRect(14, 28, 7, 16); g.fillRect(43, 32, 7, 16);
          shade("#d8c9a8"); g.fillRect(13, 42, 3, 4); g.fillRect(49, 46, 3, 4);
        }

        // head
        shade(dark); g.beginPath(); g.ellipse(32, 18, 11, 10, 0, 0, 7); g.fill();
        shade(skinC); g.beginPath(); g.ellipse(32, 17, 10, 9, 0, 0, 7); g.fill();
        // brow ridge
        shade(bodyC); g.fillRect(23, 12, 18, 3);
        // horns
        if (horns) {
          shade("#d8c9a8");
          g.beginPath(); g.moveTo(22, 12); g.lineTo(14, 2); g.lineTo(26, 10); g.fill();
          g.beginPath(); g.moveTo(42, 12); g.lineTo(50, 2); g.lineTo(38, 10); g.fill();
          shade("#8a6b3a", 0.7);
          g.beginPath(); g.moveTo(22, 12); g.lineTo(16, 5); g.lineTo(25, 10); g.fill();
          g.beginPath(); g.moveTo(42, 12); g.lineTo(48, 5); g.lineTo(39, 10); g.fill();
          g.globalAlpha = 1;
        }
        // eyes with glow
        shade(pose === 3 ? "#fff" : pal.eye);
        g.fillRect(26, 14, 5, 5); g.fillRect(34, 14, 5, 5);
        shade("rgba(255,220,80,0.35)");
        g.beginPath(); g.arc(28.5, 16.5, 5, 0, 7); g.fill();
        g.beginPath(); g.arc(36.5, 16.5, 5, 0, 7); g.fill();
        shade("#e33"); g.fillRect(27, 15, 2, 3); g.fillRect(35, 15, 2, 3);
        // snarl
        shade("#2a0a06"); g.fillRect(27, 22, 11, 4);
        if (pose === 2) {
          shade("#fff"); g.fillRect(28, 22, 2, 4); g.fillRect(34, 22, 2, 4);
          shade("#c9333f"); g.fillRect(30, 24, 5, 2);
        }
        // cheek / jaw detail
        shade(dark, 0.4); g.fillRect(23, 18, 3, 5); g.fillRect(39, 18, 3, 5);
        g.globalAlpha = 1;
        // blood / grime speckles
        shade("#1a0806", 0.35);
        g.fillRect(28, 32, 1, 1); g.fillRect(36, 28, 1, 1); g.fillRect(30, 42, 2, 1);
        g.globalAlpha = 1;
      });
    }
    return [frame(0), frame(1), frame(2), frame(3), frame(4)];
  }

  // WRAITH — floating spectral skull-ghost
  function buildWraith(pal) {
    function frame(pose) {
      return mkTex(TEX, function (g) {
        if (pose === 4) {
          g.fillStyle = pal.body; g.globalAlpha = 0.35;
          g.beginPath(); g.ellipse(32, 42, 18, 7, 0, 0, 7); g.fill();
          g.fillStyle = "#d5f4ff"; g.globalAlpha = 0.25;
          for (let i = 0; i < 8; i++) g.fillRect(18 + i * 4, 38 + (i % 3), 2, 2);
          g.globalAlpha = 1; return;
        }
        // ambient glow
        g.fillStyle = pal.eye; g.globalAlpha = 0.12;
        g.beginPath(); g.arc(32, 30, 22, 0, 7); g.fill();
        g.globalAlpha = 1;
        // wispy trailing tail with layers
        g.fillStyle = pal.body; g.globalAlpha = 0.55;
        g.beginPath();
        g.moveTo(18, 28);
        g.quadraticCurveTo(10, 50, 20 + (pose === 1 ? 5 : 0), 62);
        g.quadraticCurveTo(32, 48, 44 - (pose === 1 ? 5 : 0), 62);
        g.quadraticCurveTo(54, 50, 46, 28);
        g.fill();
        g.fillStyle = pal.skin; g.globalAlpha = 0.4;
        g.beginPath();
        g.moveTo(24, 32);
        g.quadraticCurveTo(20, 52, 28, 58);
        g.quadraticCurveTo(32, 50, 36, 58);
        g.quadraticCurveTo(44, 52, 40, 32);
        g.fill();
        g.globalAlpha = 1;
        // hooded head
        g.fillStyle = pose === 3 ? "#c0d8e8" : pal.skin;
        g.beginPath(); g.ellipse(32, 24, 16, 18, 0, 0, 7); g.fill();
        // hood rim
        g.fillStyle = pal.body; g.globalAlpha = 0.7;
        g.beginPath(); g.ellipse(32, 14, 15, 6, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = "#060a10";
        g.beginPath(); g.ellipse(32, 28, 12, 14, 0, 0, 7); g.fill();
        // skull face
        g.fillStyle = "#c8d8e4"; g.globalAlpha = 0.55;
        g.beginPath(); g.ellipse(32, 28, 8, 9, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        // glowing eyes
        g.fillStyle = pose === 2 ? "#fff" : pal.eye;
        g.fillRect(24, 24, 6, 7); g.fillRect(35, 24, 6, 7);
        g.fillStyle = "#8ad8ff"; g.fillRect(25, 25, 3, 4); g.fillRect(36, 25, 3, 4);
        g.fillStyle = "rgba(138,216,255,0.4)";
        g.beginPath(); g.arc(27, 27, 6, 0, 7); g.fill();
        g.beginPath(); g.arc(38, 27, 6, 0, 7); g.fill();
        // jaw
        g.fillStyle = "#0a1016"; g.fillRect(27, 36, 11, 3);
        if (pose === 2) {
          g.fillStyle = pal.skin;
          g.fillRect(10, 32, 6, 14); g.fillRect(48, 32, 6, 14);
          g.fillStyle = "#d5f4ff";
          g.fillRect(9, 30, 2, 5); g.fillRect(14, 30, 2, 5);
          g.fillRect(49, 30, 2, 5); g.fillRect(54, 30, 2, 5);
        }
        // sparkles
        g.fillStyle = "#d5f4ff"; g.globalAlpha = 0.5;
        g.fillRect(16, 20, 2, 2); g.fillRect(48, 18, 2, 2); g.fillRect(30, 8, 2, 2);
        g.globalAlpha = 1;
      });
    }
    return [frame(0), frame(1), frame(2), frame(3), frame(4)];
  }

  // GUNNER — armoured demon soldier with a shoulder cannon
  function buildGunner(pal) {
    function frame(pose) {
      return mkTex(TEX, function (g) {
        if (pose === 4) {
          g.fillStyle = "#1a1408"; g.beginPath(); g.ellipse(32, 58, 20, 5, 0, 0, 7); g.fill();
          g.fillStyle = pal.body; g.beginPath(); g.ellipse(30, 52, 13, 6, -0.15, 0, 7); g.fill();
          g.fillStyle = "#5a6b7a"; g.fillRect(38, 48, 18, 6);
          g.fillStyle = "#2a3038"; g.fillRect(52, 49, 5, 4);
          return;
        }
        // shadow
        g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(32, 61, 11, 3, 0, 0, 7); g.fill();
        // boots
        g.fillStyle = "#1a1408";
        g.fillRect(23, 54, 8, 6); g.fillRect(33, 54, 8, 6);
        g.fillStyle = "#3a2e18";
        g.fillRect(24, 46, 7, 12); g.fillRect(33, 46, 7, 12);
        g.fillStyle = "#5a4a28"; g.fillRect(24, 50, 7, 2); g.fillRect(33, 50, 7, 2);
        // armoured torso
        g.fillStyle = pose === 3 ? "#c0a070" : pal.body;
        g.fillRect(19, 20, 26, 28);
        // plating layers
        g.fillStyle = "#5a6b7a"; g.fillRect(19, 20, 26, 6);
        g.fillStyle = "#8d99b8"; g.fillRect(21, 22, 22, 2);
        g.fillStyle = "#3a4554"; g.fillRect(21, 28, 22, 2); g.fillRect(21, 36, 22, 2);
        g.fillStyle = "#ffd75e"; g.fillRect(30, 30, 4, 4); // rank badge
        g.fillStyle = "#2a2010"; g.fillRect(22, 40, 20, 3); // belt
        g.fillStyle = "#8a6b2a"; g.fillRect(28, 40, 8, 3);
        // ammo pouches
        g.fillStyle = "#4a3a20"; g.fillRect(20, 42, 5, 5); g.fillRect(39, 42, 5, 5);
        // head + helmet
        g.fillStyle = pose === 3 ? "#d0b080" : pal.skin;
        g.beginPath(); g.ellipse(29, 14, 8, 8, 0, 0, 7); g.fill();
        g.fillStyle = "#4a5464"; g.fillRect(21, 8, 16, 5); // helmet
        g.fillStyle = "#2a3038"; g.fillRect(22, 10, 14, 2);
        g.fillStyle = pose === 2 ? "#fff" : pal.eye;
        g.fillRect(25, 13, 4, 4); g.fillRect(31, 13, 4, 4);
        g.fillStyle = "#e33"; g.fillRect(26, 14, 2, 2); g.fillRect(32, 14, 2, 2);
        // visor glint
        g.fillStyle = "rgba(138,216,255,0.35)"; g.fillRect(24, 12, 12, 2);
        // left arm
        g.fillStyle = pal.skin; g.fillRect(14, 24, 6, 14);
        g.fillStyle = "#5a6b7a"; g.fillRect(13, 22, 8, 5); // shoulder pad
        // shoulder cannon
        g.fillStyle = "#4a5464"; g.fillRect(40, 18, 18, 10);
        g.fillStyle = "#2a3038"; g.fillRect(54, 19, 7, 8);
        g.fillStyle = "#8d99b8"; g.fillRect(42, 20, 10, 2);
        g.fillStyle = "#1a1e24"; g.fillRect(58, 21, 3, 4); // barrel hole
        if (pose === 2) {
          g.fillStyle = "#ffd75e"; g.beginPath(); g.arc(60, 23, 6, 0, 7); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(60, 23, 3, 0, 7); g.fill();
          g.fillStyle = "rgba(255,140,60,0.4)"; g.beginPath(); g.arc(60, 23, 9, 0, 7); g.fill();
        }
      });
    }
    return [frame(0), frame(1), frame(2), frame(3), frame(4)];
  }

  // BOSS — towering horned demon lord
  function buildBoss(pal) {
    function frame(pose) {
      return mkTex(TEX, function (g) {
        if (pose === 4) {
          g.fillStyle = "#2a0505"; g.beginPath(); g.ellipse(32, 58, 26, 6, 0, 0, 7); g.fill();
          g.fillStyle = "#8a1010"; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(32, 56, 18, 4, 0, 0, 7); g.fill();
          g.globalAlpha = 1;
          g.fillStyle = pal.body; g.beginPath(); g.ellipse(28, 48, 18, 10, -0.25, 0, 7); g.fill();
          g.fillStyle = pal.skin; g.beginPath(); g.ellipse(42, 40, 10, 9, 0.5, 0, 7); g.fill();
          g.fillStyle = "#d8c9a8";
          g.beginPath(); g.moveTo(16, 44); g.lineTo(6, 28); g.lineTo(20, 40); g.fill();
          g.beginPath(); g.moveTo(48, 42); g.lineTo(60, 30); g.lineTo(46, 40); g.fill();
          return;
        }
        const bodyC = pose === 3 ? "#c07060" : pal.body;
        const skinC = pose === 3 ? "#e0a090" : pal.skin;
        // shadow
        g.fillStyle = "rgba(0,0,0,0.4)"; g.beginPath(); g.ellipse(32, 62, 16, 3, 0, 0, 7); g.fill();
        // massive legs
        g.fillStyle = "#2a0808";
        g.fillRect(18, 42, 12, 18); g.fillRect(34, 42, 12, 18);
        g.fillStyle = bodyC;
        g.fillRect(19, 42, 10, 16); g.fillRect(35, 42, 10, 16);
        g.fillStyle = "#1a0404"; g.fillRect(19, 48, 10, 2); g.fillRect(35, 50, 10, 2);
        g.fillStyle = "#0a0202"; g.fillRect(17, 56, 14, 5); g.fillRect(33, 56, 14, 5);
        g.fillStyle = "#d8c9a8";
        g.fillRect(16, 58, 3, 4); g.fillRect(28, 58, 3, 4); g.fillRect(32, 58, 3, 4); g.fillRect(44, 58, 3, 4);
        // huge torso
        g.fillStyle = "#1a0404"; g.beginPath(); g.ellipse(32, 32, 18, 18, 0, 0, 7); g.fill();
        g.fillStyle = bodyC; g.beginPath(); g.ellipse(32, 31, 16, 16, 0, 0, 7); g.fill();
        g.fillStyle = skinC; g.globalAlpha = 0.3; g.beginPath(); g.ellipse(32, 34, 10, 10, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        // spine spikes
        g.fillStyle = "#3a1010";
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.moveTo(32, 14 + i * 6);
          g.lineTo(28, 20 + i * 6);
          g.lineTo(36, 20 + i * 6);
          g.fill();
        }
        // abs / scars
        g.fillStyle = "rgba(10,2,2,0.5)";
        g.fillRect(26, 28, 12, 1.5); g.fillRect(26, 33, 12, 1.5); g.fillRect(26, 38, 12, 1.5);
        g.fillStyle = "#5a1010"; g.fillRect(24, 26, 2, 14); // scar
        // arms
        g.fillStyle = skinC;
        if (pose === 2) {
          g.fillRect(4, 12, 10, 22); g.fillRect(50, 12, 10, 22);
          g.fillStyle = bodyC; g.fillRect(5, 18, 8, 5); g.fillRect(51, 18, 8, 5);
          g.fillStyle = "#e8e0c8";
          g.fillRect(2, 8, 12, 7); g.fillRect(50, 8, 12, 7);
          g.fillStyle = "#d8c9a8";
          for (let i = 0; i < 4; i++) {
            g.fillRect(2 + i * 3, 5, 2, 5);
            g.fillRect(50 + i * 3, 5, 2, 5);
          }
          // fire in hands
          g.fillStyle = "#ffd75e"; g.globalAlpha = 0.7;
          g.beginPath(); g.arc(8, 10, 6, 0, 7); g.fill();
          g.beginPath(); g.arc(56, 10, 6, 0, 7); g.fill();
          g.globalAlpha = 1;
        } else {
          g.fillRect(8, 26, 10, 18); g.fillRect(46, 26, 10, 18);
          g.fillStyle = "#d8c9a8";
          g.fillRect(7, 42, 3, 5); g.fillRect(14, 42, 3, 5);
          g.fillRect(47, 42, 3, 5); g.fillRect(54, 42, 3, 5);
        }
        // head
        g.fillStyle = "#1a0404"; g.beginPath(); g.ellipse(32, 14, 13, 12, 0, 0, 7); g.fill();
        g.fillStyle = skinC; g.beginPath(); g.ellipse(32, 13, 11, 10, 0, 0, 7); g.fill();
        g.fillStyle = bodyC; g.fillRect(22, 8, 20, 4); // brow
        // massive horns
        g.fillStyle = "#d8c9a8";
        g.beginPath(); g.moveTo(20, 8); g.lineTo(6, -2); g.lineTo(24, 10); g.fill();
        g.beginPath(); g.moveTo(44, 8); g.lineTo(58, -2); g.lineTo(40, 10); g.fill();
        g.fillStyle = "#8a5a20"; g.globalAlpha = 0.6;
        g.beginPath(); g.moveTo(20, 8); g.lineTo(10, 1); g.lineTo(23, 9); g.fill();
        g.beginPath(); g.moveTo(44, 8); g.lineTo(54, 1); g.lineTo(41, 9); g.fill();
        g.globalAlpha = 1;
        // crown spikes
        g.fillStyle = "#ffd75e";
        g.fillRect(28, 2, 2, 5); g.fillRect(32, 0, 2, 6); g.fillRect(36, 2, 2, 5);
        // eyes
        g.fillStyle = pose === 3 ? "#fff" : pal.eye;
        g.fillRect(24, 11, 6, 6); g.fillRect(35, 11, 6, 6);
        g.fillStyle = "rgba(255,215,94,0.4)";
        g.beginPath(); g.arc(27, 14, 6, 0, 7); g.fill();
        g.beginPath(); g.arc(38, 14, 6, 0, 7); g.fill();
        g.fillStyle = "#e33"; g.fillRect(25, 12, 3, 4); g.fillRect(36, 12, 3, 4);
        // mouth
        g.fillStyle = "#1a0404"; g.fillRect(26, 20, 13, 5);
        if (pose === 2) {
          g.fillStyle = "#fff"; g.fillRect(27, 20, 3, 5); g.fillRect(36, 20, 3, 5);
          g.fillStyle = "#c9333f"; g.fillRect(30, 22, 5, 3);
        }
      });
    }
    return [frame(0), frame(1), frame(2), frame(3), frame(4)];
  }

  function buildItems() {
    const out = {};
    out.h = mkTex(TEX, function (g) {
      g.fillStyle = "#e8e8f0"; g.fillRect(18, 34, 28, 22);
      g.fillStyle = "#c9333f"; g.fillRect(28, 38, 8, 14); g.fillRect(22, 42, 20, 6);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(18, 52, 28, 4);
    });
    out.a = mkTex(TEX, function (g) {
      g.fillStyle = "#8a6b2a"; g.fillRect(18, 40, 28, 16);
      g.fillStyle = "#ffd75e"; g.fillRect(18, 36, 28, 6);
      g.fillStyle = "#5e4718"; g.fillRect(20, 44, 24, 2); g.fillRect(20, 50, 24, 2);
    });
    out.s = mkTex(TEX, function (g) {
      g.fillStyle = "#5e2a1a"; g.fillRect(16, 42, 32, 14);
      g.fillStyle = "#c9333f"; g.fillRect(16, 38, 32, 6);
      g.fillStyle = "#ffd75e";
      for (let i = 0; i < 4; i++) g.fillRect(19 + i * 8, 45, 4, 8);
    });
    out.c = mkTex(TEX, function (g) {
      g.fillStyle = "#12303e"; g.fillRect(20, 34, 24, 22);
      g.fillStyle = "#8ad8ff"; g.fillRect(24, 38, 16, 6); g.fillRect(24, 48, 16, 4);
      g.fillStyle = "#d5f4ff"; g.fillRect(28, 39, 8, 4);
    });
    function keycard(face, edge) {
      return mkTex(TEX, function (g) {
        g.fillStyle = "#1a1520"; g.fillRect(14, 28, 36, 24);
        g.fillStyle = face;      g.fillRect(16, 30, 32, 20);
        g.fillStyle = edge;      g.fillRect(16, 30, 32, 5);
        g.fillStyle = "#0c0d12"; g.fillRect(20, 42, 14, 4);         // chip
        g.fillStyle = "#fff8d0"; g.fillRect(38, 42, 6, 6);          // hologram square
      });
    }
    out.k = keycard("#c9333f", "#ff8a70"); // RED keycard
    out.b = keycard("#3a6ad8", "#8ad8ff"); // BLUE keycard
    out.y = keycard("#e0c020", "#fff08a"); // YELLOW keycard
    out.p = mkTex(TEX, function (g) { // rapid-fire mod (yellow bolt)
      g.fillStyle = "#1a1e28"; g.beginPath(); g.arc(32, 38, 15, 0, 7); g.fill();
      g.fillStyle = "#ffd75e"; g.beginPath();
      g.moveTo(34, 26); g.lineTo(26, 40); g.lineTo(32, 40); g.lineTo(30, 50); g.lineTo(40, 36); g.lineTo(34, 36); g.closePath(); g.fill();
    });
    out.x = mkTex(TEX, function (g) { // spread mod (fan of pellets)
      g.fillStyle = "#281c1a"; g.beginPath(); g.arc(32, 38, 15, 0, 7); g.fill();
      g.fillStyle = "#ff9a50";
      for (let i = -2; i <= 2; i++) g.fillRect(32 + i * 4, 44 - Math.abs(i) * 3, 3, 6 + (2 - Math.abs(i)) * 4);
    });
    out.l = mkTex(TEX, function (g) { // lifesteal mod (green heart)
      g.fillStyle = "#101f14"; g.beginPath(); g.arc(32, 38, 15, 0, 7); g.fill();
      g.fillStyle = "#63d97a";
      g.beginPath(); g.arc(28, 34, 5, 0, 7); g.arc(36, 34, 5, 0, 7);
      g.moveTo(23, 36); g.lineTo(32, 48); g.lineTo(41, 36); g.closePath(); g.fill();
    });
    out.z = mkTex(TEX, function (g) { // mine pack
      g.fillStyle = "#1a1a1e"; g.fillRect(20, 36, 24, 18);
      g.fillStyle = "#3a3a44"; g.fillRect(22, 38, 20, 14);
      g.fillStyle = "#c9333f"; g.beginPath(); g.arc(32, 34, 6, 0, 7); g.fill();
      g.fillStyle = "#ffd75e"; g.fillRect(24, 44, 16, 3);
      g.fillStyle = "#0c0d12"; g.fillRect(28, 48, 8, 3);
    });
    out.W = mkTex(TEX, function (g) {
      g.fillStyle = "#3a2a18"; g.fillRect(14, 44, 14, 8);
      g.fillStyle = "#4a4f5e"; g.fillRect(24, 42, 28, 5); g.fillRect(24, 48, 28, 4);
      g.fillStyle = "#ffd75e"; g.fillRect(48, 41, 4, 12);
    });
    out.Q = mkTex(TEX, function (g) {
      g.fillStyle = "#1c2f42"; g.fillRect(16, 42, 32, 10);
      g.fillStyle = "#8ad8ff"; g.fillRect(20, 44, 8, 6); g.fillRect(40, 44, 8, 6);
      g.fillStyle = "#d5f4ff"; g.fillRect(44, 40, 6, 4);
    });
    out.Y = mkTex(TEX, function (g) { // BFG
      g.fillStyle = "#14301c"; g.fillRect(12, 38, 40, 16);
      g.fillStyle = "#2a6040"; g.fillRect(14, 40, 36, 12);
      g.fillStyle = "#7dff9a"; g.fillRect(18, 42, 10, 8); g.fillRect(36, 42, 10, 8);
      g.fillStyle = "#d5ffe0"; g.beginPath(); g.arc(32, 34, 6, 0, 7); g.fill();
      g.fillStyle = "#ffd75e"; g.fillRect(12, 52, 40, 3);
    });
    out.v = mkTex(TEX, function (g) { // combat armor chestplate
      g.fillStyle = "#1a2430"; g.fillRect(16, 22, 32, 36);
      g.fillStyle = "#3a5068"; g.fillRect(18, 24, 28, 30);          // plate
      g.fillStyle = "#5a7a98"; g.fillRect(20, 26, 24, 10);          // collar
      g.fillStyle = "#8ad8ff"; g.fillRect(22, 28, 20, 3);           // trim
      g.fillStyle = "#2a3848"; g.fillRect(18, 38, 12, 14); g.fillRect(34, 38, 12, 14); // abs
      g.fillStyle = "#4a90b8"; g.fillRect(28, 40, 8, 10);           // core gem
      g.fillStyle = "#ffd75e"; g.fillRect(26, 36, 12, 3);
      // shoulder pads
      g.fillStyle = "#4a6078"; g.fillRect(10, 24, 10, 12); g.fillRect(44, 24, 10, 12);
      g.fillStyle = "#8ad8ff"; g.fillRect(12, 26, 6, 2); g.fillRect(46, 26, 6, 2);
    });
    out.t = mkTex(TEX, function (g) { // swamp tree
      g.fillStyle = "#3a2810"; g.fillRect(28, 36, 8, 24);
      g.fillStyle = "#1a4020";
      g.beginPath(); g.ellipse(32, 28, 18, 16, 0, 0, 7); g.fill();
      g.fillStyle = "#2a6030";
      g.beginPath(); g.ellipse(32, 22, 14, 12, 0, 0, 7); g.fill();
      g.fillStyle = "#4a8050";
      g.beginPath(); g.ellipse(32, 18, 9, 8, 0, 0, 7); g.fill();
    });
    out.r = mkTex(TEX, function (g) { // supply crate
      g.fillStyle = "#5e3a18"; g.fillRect(16, 30, 32, 28);
      g.fillStyle = "#8a5a28"; g.fillRect(18, 32, 28, 24);
      g.fillStyle = "#2a1808"; g.fillRect(16, 42, 32, 3);
      g.fillStyle = "#ffd75e"; g.fillRect(28, 36, 8, 8);
      g.fillStyle = "#0c0d12"; g.fillRect(30, 38, 4, 4);
    });
    out.i = mkTex(TEX, function (g) { // bone idol
      g.fillStyle = "#d8c9a8"; g.fillRect(26, 20, 12, 10);
      g.fillStyle = "#c8b898"; g.fillRect(22, 30, 20, 24);
      g.fillStyle = "#1a1010"; g.fillRect(28, 24, 3, 3); g.fillRect(35, 24, 3, 3);
      g.fillStyle = "#8a7a60"; g.fillRect(30, 40, 4, 12);
      g.fillStyle = "#e8dcc0"; g.fillRect(18, 48, 6, 10); g.fillRect(40, 48, 6, 10);
    });
    out.u = mkTex(TEX, function (g) { // burial urn
      g.fillStyle = "#4a3a28"; g.fillRect(22, 28, 20, 28);
      g.fillStyle = "#6a5040"; g.fillRect(24, 30, 16, 24);
      g.fillStyle = "#ffd75e"; g.fillRect(26, 36, 12, 3);
      g.fillStyle = "#2a2018"; g.beginPath(); g.ellipse(32, 28, 12, 4, 0, 0, 7); g.fill();
    });
    out.f = mkTex(TEX, function (g) { // slag / furnace pile
      g.fillStyle = "#2a1810"; g.fillRect(14, 40, 36, 18);
      g.fillStyle = "#5a2810"; g.fillRect(18, 34, 28, 16);
      g.fillStyle = "#ff7043"; g.fillRect(24, 30, 16, 10);
      g.fillStyle = "#ffd75e"; g.fillRect(28, 28, 8, 6);
    });
    out.B = mkTex(TEX, function (g) { // barrel
      g.fillStyle = "#3a4254"; g.fillRect(20, 26, 24, 34);
      g.fillStyle = "#2a2f3d"; g.fillRect(20, 26, 24, 4); g.fillRect(20, 56, 24, 4);
      g.fillStyle = "#ffd75e"; g.fillRect(20, 40, 24, 6);
      g.fillStyle = "#0c0d12";
      for (let i = 0; i < 3; i++) g.fillRect(22 + i * 8, 41, 5, 4);
      g.fillStyle = "#63d97a"; g.beginPath(); g.ellipse(32, 27, 10, 3, 0, 0, 7); g.fill();
    });
    out.n = mkTex(TEX, function (g) { // chainsaw pickup
      g.fillStyle = "#3a3a3a"; g.fillRect(14, 38, 36, 10); // body
      g.fillStyle = "#88cc44"; g.fillRect(42, 36, 8, 14);  // blade guard
      g.fillStyle = "#cccc44"; // chain teeth
      for (let i = 0; i < 5; i++) g.fillRect(14 + i * 7, 34, 4, 4);
      g.fillStyle = "#2a1808"; g.fillRect(16, 46, 20, 8);  // handle
      g.fillStyle = "#444"; g.fillRect(44, 40, 4, 6);      // tip
    });
    out.m = mkTex(TEX, function (g) { // rocket launcher pickup
      g.fillStyle = "#5a2810"; g.fillRect(12, 40, 40, 10);
      g.fillStyle = "#8a4820"; g.fillRect(14, 42, 36, 6);
      g.fillStyle = "#1a0c06"; g.fillRect(48, 41, 4, 8);   // barrel hole
      g.fillStyle = "#ff7722"; g.beginPath(); g.arc(50, 45, 3, 0, 7); g.fill();
      g.fillStyle = "#4a3020"; g.fillRect(16, 48, 24, 8);  // grip
      g.fillStyle = "#ffd75e"; g.fillRect(12, 40, 40, 2);  // stripe
    });
    out.o = mkTex(TEX, function (g) { // rocket ammo
      g.fillStyle = "#5a2810"; g.fillRect(22, 28, 8, 26);
      g.fillStyle = "#ff7722"; g.beginPath(); g.moveTo(26, 20); g.lineTo(20, 30); g.lineTo(32, 30); g.fill();
      g.fillStyle = "#ffd75e"; g.fillRect(22, 48, 8, 4);
      for (let i = 0; i < 3; i++) g.fillRect(24 + i * 2, 54 + i, 2, 3);
    });
    out.mineFloor = mkTex(TEX, function (g) { // armed sticky mine on the floor
      g.fillStyle = "#12141a"; g.beginPath(); g.arc(32, 44, 12, 0, 7); g.fill();
      g.fillStyle = "#2a2c34"; g.beginPath(); g.arc(32, 42, 9, 0, 7); g.fill();
      g.fillStyle = "#c9333f"; g.beginPath(); g.arc(32, 40, 3.5, 0, 7); g.fill();
      g.fillStyle = "#1a1a1e";
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.fillRect(32 + Math.cos(a) * 12 - 1, 44 + Math.sin(a) * 12 - 3, 3, 5); }
    });
    out.e = mkTex(TEX, function (g) { // berserk sphere
      g.fillStyle = "rgba(200,30,30,0.9)";
      g.beginPath(); g.arc(32, 36, 16, 0, 7); g.fill();
      g.fillStyle = "#ff8a50"; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(32, 30, 5, 0, 7); g.fill();
      g.fillStyle = "#c9333f"; g.font = "bold 10px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("!", 32, 44);
    });
    return out;
  }

  // deterministic speckle/grime — cheap way to add a lot of texture detail
  function speckle(g, seed, n, colors, sMin, sMax) {
    let s = seed | 0 || 7;
    const rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(rnd() * colors.length) | 0];
      g.globalAlpha = 0.18 + rnd() * 0.3;
      const sz = sMin + rnd() * (sMax - sMin);
      g.fillRect(rnd() * 64, rnd() * 64, sz, sz);
    }
    g.globalAlpha = 1;
  }

  // ---- floor & ceiling textures (themed per level) ----
  function buildFloorTex(theme) {
    const pals = {
      hangar:  { base: "#2a3038", tints: ["#323840", "#2e343c", "#383e48", "#262c34"], grout: "#1a1e24", speck: ["#1a1e24", "#3a4250", "#12161c"] },
      swamp:   { base: "#1a2818", tints: ["#243820", "#1e301c", "#2a4024", "#162416"], grout: "#0e160c", speck: ["#0e160c", "#3a6040", "#102010"] },
      dungeon: { base: "#2a2420", tints: ["#3a3228", "#322a22", "#403830", "#2a221c"], grout: "#1a1612", speck: ["#1a1612", "#4a4034", "#12100c"] },
      foundry: { base: "#2a1a14", tints: ["#3a2218", "#301c14", "#422820", "#241410"], grout: "#140c08", speck: ["#140c08", "#5a3020", "#1a100c"] },
      throne:  { base: "#1a1010", tints: ["#2a1818", "#221414", "#321c1c", "#180c0c"], grout: "#0c0808", speck: ["#0c0808", "#4a2020", "#100808"] }
    };
    const p = pals[theme] || pals.hangar;
    return mkTex(64, function (g) {
      g.fillStyle = p.base; g.fillRect(0, 0, 64, 64);
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        g.fillStyle = p.tints[(sx + sy * 2 + ((sx ^ sy) & 1)) % 4];
        g.fillRect(sx * 32 + 1, sy * 32 + 1, 30, 30);
      }
      g.fillStyle = p.grout;
      g.fillRect(0, 0, 64, 1); g.fillRect(0, 32, 64, 2); g.fillRect(0, 63, 64, 1);
      g.fillRect(0, 0, 1, 64); g.fillRect(32, 0, 2, 64); g.fillRect(63, 0, 1, 64);
      speckle(g, 1234 + (theme || "").length * 17, 90, p.speck, 1, 3);
      g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(8, 6); g.lineTo(16, 14); g.lineTo(13, 24); g.stroke();
      g.beginPath(); g.moveTo(46, 40); g.lineTo(52, 50); g.lineTo(60, 54); g.stroke();
    });
  }
  function buildCeilTex(theme) {
    const pals = {
      hangar:  { a: "#151823", b: "#181c29", c: "#131622", rivet: "#2c3448", strip: "#3a4f6e" },
      swamp:   { a: "#101810", b: "#142014", c: "#0c140c", rivet: "#2a4030", strip: "#3a7050" },
      dungeon: { a: "#141210", b: "#1c1814", c: "#100e0c", rivet: "#3a3228", strip: "#5a4a38" },
      foundry: { a: "#1a1010", b: "#241414", c: "#140c0c", rivet: "#4a2820", strip: "#8a4030" },
      throne:  { a: "#120808", b: "#1a0c0c", c: "#0c0606", rivet: "#4a1818", strip: "#8a3030" }
    };
    const p = pals[theme] || pals.hangar;
    return mkTex(64, function (g) {
      g.fillStyle = p.a; g.fillRect(0, 0, 64, 64);
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        g.fillStyle = (sx + sy) % 2 ? p.b : p.c;
        g.fillRect(sx * 32 + 1, sy * 32 + 1, 30, 30);
      }
      g.fillStyle = "#0a0c14";
      g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64);
      g.fillStyle = p.rivet;
      for (const pt of [[5,5],[27,5],[37,5],[59,5],[5,27],[59,27],[5,37],[59,37],[5,59],[27,59],[37,59],[59,59]])
        g.fillRect(pt[0], pt[1], 2, 2);
      g.fillStyle = p.strip; g.fillRect(12, 14, 8, 2); g.fillRect(44, 46, 8, 2);
      speckle(g, 777, 60, [p.a, p.b, p.c], 1, 3);
    });
  }
  function texPixels(c) {
    return new Uint32Array(c.getContext("2d").getImageData(0, 0, c.width, c.height).data.buffer.slice(0));
  }
  const THEME_FLOOR = {};
  const THEME_CEIL = {};
  ["hangar", "swamp", "dungeon", "foundry", "throne"].forEach(function (t) {
    THEME_FLOOR[t] = texPixels(buildFloorTex(t));
    THEME_CEIL[t] = texPixels(buildCeilTex(t));
  });
  let FLOOR_PIX = THEME_FLOOR.hangar;
  let CEIL_PIX = THEME_CEIL.hangar;

  // warm muzzle-light glow (cached radial sprite, composited when firing)
  const MUZZ_GLOW = (function () {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,220,150,0.55)");
    grd.addColorStop(0.4, "rgba(255,170,80,0.22)");
    grd.addColorStop(1, "rgba(255,140,60,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    return c;
  })();

  // ============================ PARSE ============================
  function parseLevel(idx) {
    const rows = LEVELS[idx].rows;
    const map = [], enemies = [], items = [], barrels = [], doors = {}, props = [];
    const hazards = [], telepads = [], ambushes = [], crushers = [], lifts = [];
    const breakables = {}; // y*1000+x → {x,y,hp}
    let px = 1.5, py = 1.5, totSecrets = 0;
    const hpScale = (DIFF_MUL[diff] || 1) * (dailyMode ? 1.15 : 1);
    const rng = dailyMode ? seededRng(dailySeed + idx * 7919) : Math.random;
    for (let y = 0; y < rows.length; y++) {
      const line = rows[y], row = [];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        const wv = WALLS[ch] || 0;
        // floor-marker chars: treat as open floor in the map array
        if (ch === "~" || ch === "@" || ch === "$" || ch === "!" || ch === "^" || ch === "<" || ch === ">") {
          row.push(0);
        } else {
          row.push(wv);
        }
        if (wv === 9) {
          breakables[y * 1000 + x] = { x: x, y: y, hp: 3 };
        }
        if (wv === 6 || wv === 7 || wv === 8 || wv === 10 || wv === 11) {
          const lock = wv === 7 ? "red" : wv === 10 ? "blue" : wv === 11 ? "yellow" : null;
          doors[y * 1000 + x] = { x: x, y: y, open: 0, target: 0, gold: wv === 7, lock: lock, secret: wv === 8, hold: 0 };
        }
        if (wv === 8) totSecrets++;
        if (ch === "P") { px = x + 0.5; py = y + 0.5; }
        else if (ch === "~") { hazards.push({ x: x + 0.5, y: y + 0.5 }); }
        else if (ch === "^") { crushers.push({ x: x + 0.5, y: y + 0.5, cx: x, cy: y, phase: (x + y) % 5 * 0.5, drop: 0 }); }
        else if (ch === "<" || ch === ">") { lifts.push({ x: x + 0.5, y: y + 0.5, kind: ch, dest: null }); }
        else if (ch === "@" || ch === "$") { telepads.push({ x: x + 0.5, y: y + 0.5, kind: ch, dest: null }); }
        else if (ch === "!") { ambushes.push({ x: x + 0.5, y: y + 0.5, used: false }); }
        else if (ECHARS[ch]) {
          const cfg = ETYPES[ECHARS[ch]];
          const jitter = dailyMode ? (0.85 + rng() * 0.5) : 1; // daily: ±HP variance
          enemies.push({ type: ECHARS[ch], cfg: cfg, x: x + 0.5, y: y + 0.5, hp: Math.max(1, (cfg.hp * hpScale * jitter) | 0),
                         state: "idle", animT: 0, atkT: 1 + rng(), painT: 0, roared: false,
                         phase: 0, blink: 0, asleep: true, blinkT: 0, hatchT: -1, hatching: false });
        }
        else if ("hasckbyWQYvnmoepxlzg".indexOf(ch) >= 0) items.push({ x: x + 0.5, y: y + 0.5, kind: ch });
        else if (ch === "B") barrels.push({ x: x + 0.5, y: y + 0.5, hp: 12, dead: false });
        else if ("trifu".indexOf(ch) >= 0) props.push({ x: x + 0.5, y: y + 0.5, kind: ch });
      }
      map.push(row);
    }
    // link first @ ↔ first $
    const ats = telepads.filter(function (t) { return t.kind === "@"; });
    const dls = telepads.filter(function (t) { return t.kind === "$"; });
    for (let i = 0; i < Math.min(ats.length, dls.length); i++) {
      ats[i].dest = dls[i]; dls[i].dest = ats[i];
    }
    // link lift pads < ↔ > (paired in order)
    const la = lifts.filter(function (t) { return t.kind === "<"; });
    const lb = lifts.filter(function (t) { return t.kind === ">"; });
    for (let i = 0; i < Math.min(la.length, lb.length); i++) {
      la[i].dest = lb[i]; lb[i].dest = la[i];
    }
    return { map: map, enemies: enemies, items: items, barrels: barrels, doors: doors, props: props,
             hazards: hazards, telepads: telepads, ambushes: ambushes, crushers: crushers, lifts: lifts,
             breakables: breakables,
             px: px, py: py, w: rows[0].length, h: rows.length,
             name: LEVELS[idx].name, par: LEVELS[idx].par, theme: LEVELS[idx].theme || "hangar",
             totKills: enemies.length, totItems: items.length, totSecrets: totSecrets };
  }

  // ============================ PERSISTENCE ============================
  // persistent unlocks: { shellsBonus, pistolSkin, bestGrade, runs }
  function loadUnlocks() {
    const def = { shellsBonus: 0, pistolSkin: false, bestGrade: "-", runs: 0 };
    try {
      const j = JSON.parse(localStorage.getItem("inferno-unlocks") || "{}");
      return Object.assign(def, j || {});
    } catch (e) { return def; }
  }
  function saveUnlocks(u) {
    try { localStorage.setItem("inferno-unlocks", JSON.stringify(u)); } catch (e) {}
  }
  const GRADE_RANK = { "S": 5, "A": 4, "B": 3, "C": 2, "-": 0 };
  // ghost replay storage — best (fastest) recorded path per level
  function loadGhost(idx) {
    try {
      const j = JSON.parse(localStorage.getItem("inferno-ghost-" + idx) || "null");
      return (j && j.pts && j.pts.length) ? j : null;
    } catch (e) { return null; }
  }
  function saveGhost(idx, ghost) {
    try {
      const prev = loadGhost(idx);
      if (!prev || ghost.time < prev.time) localStorage.setItem("inferno-ghost-" + idx, JSON.stringify(ghost));
    } catch (e) {}
  }

  // ============================ GAME ============================
  let G = null;

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    // render resolution from the display (capped 960x600); auto-steps down if slow
    const pxw = (canvas.clientWidth || 640) * Math.min(2, window.devicePixelRatio || 1);
    this.setResolution(pxw >= 900 ? 3 : 2);
    this.tex = buildTextures();
    this.sprites = {
      imp: buildDemon(ETYPES.imp.pal, { horns: true }),
      caster: buildDemon(ETYPES.caster.pal, { horns: true, spikes: true }),
      brute: buildDemon(ETYPES.brute.pal, { horns: true, bulk: true, spikes: true }),
      boss: buildBoss(ETYPES.boss.pal),
      wraith: buildWraith(ETYPES.wraith.pal),
      gunner: buildGunner(ETYPES.gunner.pal),
      lurker: buildDemon(ETYPES.lurker.pal, { horns: false, spikes: true }),
      nightmare: buildDemon(ETYPES.nightmare.pal, { horns: true, bulk: true, spikes: true }),
      hound: buildDemon(ETYPES.hound.pal, { horns: false, spikes: true }),
      ogre: buildDemon(ETYPES.ogre.pal, { horns: true, bulk: true, spikes: true }),
      jelly: buildDemon(ETYPES.jelly.pal, { horns: false, spikes: false }),
      arachnid: buildDemon(ETYPES.arachnid.pal, { horns: false, spikes: true }),
      cultist: buildDemon(ETYPES.cultist.pal, { horns: true, spikes: false }),
      vulture: buildWraith(ETYPES.vulture.pal),
      knight: buildDemon(ETYPES.knight.pal, { horns: false, bulk: true, spikes: true }),
      egg: buildDemon(ETYPES.egg.pal, { horns: false, spikes: false }),
      swampLord: buildDemon(ETYPES.swampLord.pal, { horns: true, bulk: true, spikes: true }),
      boneWarden: buildDemon(ETYPES.boneWarden.pal, { horns: false, bulk: true, spikes: true }),
      slagTitan: buildDemon(ETYPES.slagTitan.pal, { horns: true, bulk: true, spikes: true })
    };
    this.items = buildItems();
    this.keys = {};
    this.mode = "title";     // title | play | pause | inter | dead | win
    this.projs = [];
    this.parts = [];
    this.boomQueue = [];
    this.showMap = false;
    this.msg = ""; this.msgT = 0;
    this.dmgFlash = 0; this.pickFlash = 0; this.muzzle = 0; this.fireCd = 0;
    this.bob = 0; this.shake = 0;
    this.berserkT = 0; this.hazardCd = 0; this.teleCd = 0;
    this.streakCount = 0; this.streakT = 0; this.rockets = 0;
    this.mods = { rapid: 0, spread: 0, lifesteal: 0 };
    this.mines = []; this.mineCount = 0; this.mineCd = 0;
    this.crusherCd = 0;
    this.keycards = { red: false, blue: false, yellow: false };
    this.bigMsg = ""; this.bigT = 0; this.bigColor = "#ffd75e";
    this.ghost = [];          // positions recorded this run (per level)
    this.ghostBest = null;    // loaded best ghost for current level
    this.ghostT = 0;
    this.allyOn = false; this.ally = null;
    this.combatIntensity = 0; this.music = null;
    this.cineT = 0;
    this.editor = null;
    this.running = true;
    this._last = performance.now();
    this.hi = 0;
    try { this.hi = parseInt(localStorage.getItem("rvdw-inferno-hi") || "0", 10) || 0; } catch (e) {}
    this.unlocks = loadUnlocks();

    const self = this;
    this._down = function (e) {
      const k = e.key.toLowerCase();
      if (["arrowup","arrowdown","arrowleft","arrowright"," ","w","a","s","d","r","m","p","f","c","e","o","1","2","3","4","5","6","7","8","9","[","]","-","="].indexOf(k) >= 0) e.preventDefault();
      self.keys[k] = true;
      self.press(k);
    };
    this._up = function (e) { self.keys[e.key.toLowerCase()] = false; };
    // Mouse aim: hold the left button and move to turn (drag-look), or click to
    // lock the pointer for full mouse-look. Holding also fires (auto weapons too).
    this.mdown = false;
    this._md = function (e) {
      audio(); // unlock the audio context on the first user gesture
      if (self.mode !== "play") { self.press(" "); return; }
      self.mdown = true;
      if (e && e.shiftKey && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (err) {} }
      self.tryFire();
    };
    this._mu = function () { self.mdown = false; };
    this._mm = function (e) {
      if (self.mode !== "play") return;
      const dx = e.movementX || 0;
      if (document.pointerLockElement === canvas) self.rotate(dx * 0.0032);
      else if (self.mdown) self.rotate(dx * 0.0052); // drag-look
    };
    addEventListener("keydown", this._down);
    addEventListener("keyup", this._up);
    canvas.addEventListener("mousedown", this._md);
    addEventListener("mouseup", this._mu);
    addEventListener("mousemove", this._mm);
    this.bindTouchControls();

    // entering/leaving fullscreen changes the canvas size — re-pick resolution
    this._fsc = function () {
      const pxw = (canvas.clientWidth || 640) * Math.min(2, window.devicePixelRatio || 1);
      self.setResolution(pxw >= 900 ? 3 : 2);
    };
    document.addEventListener("fullscreenchange", this._fsc);

    canvas.focus();

    this.loop = this.loop.bind(this);
    this._raf = requestAnimationFrame(this.loop);
  }

  Game.prototype.bindTouchControls = function () {
    const self = this;
    const root = document.getElementById("arcade-touch");
    if (!root) return;

    // Desktop / mouse: keep the overlay fully hidden and unbound
    const isTouch = !!(window.matchMedia && (
      matchMedia("(pointer: coarse)").matches ||
      matchMedia("(hover: none) and (pointer: coarse)").matches
    )) || (("ontouchstart" in window) && navigator.maxTouchPoints > 0 && !(matchMedia("(pointer: fine)").matches));

    if (!isTouch) {
      root.style.display = "none";
      root.setAttribute("aria-hidden", "true");
      return;
    }

    this._touchRoot = root;
    root.style.display = "";
    root.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("arcade-touch-on");

    const setKey = (k, on) => {
      if (!k) return;
      self.keys[k] = !!on;
      if (on) self.press(k);
    };

    // Virtual stick → WASD
    const stick = root.querySelector("[data-stick]");
    const knob = root.querySelector("[data-stick-knob]");
    let stickId = null;
    const stickCenter = () => {
      const r = stick.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, max: Math.min(r.width, r.height) * 0.34 };
    };
    const applyStick = (clientX, clientY) => {
      const c = stickCenter();
      let dx = clientX - c.x, dy = clientY - c.y;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, c.max);
      dx = (dx / len) * clamped; dy = (dy / len) * clamped;
      if (knob) {
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      const nx = dx / c.max, ny = dy / c.max;
      setKey("w", ny < -0.28);
      setKey("s", ny > 0.28);
      setKey("a", nx < -0.28);
      setKey("d", nx > 0.28);
    };
    const resetStick = () => {
      stickId = null;
      setKey("w", false); setKey("a", false); setKey("s", false); setKey("d", false);
      if (knob) knob.style.transform = "translate(-50%, -50%)";
    };
    stick?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      stick.setPointerCapture?.(e.pointerId);
      stickId = e.pointerId;
      applyStick(e.clientX, e.clientY);
    }, { passive: false });
    stick?.addEventListener("pointermove", (e) => {
      if (stickId !== e.pointerId) return;
      e.preventDefault();
      applyStick(e.clientX, e.clientY);
    }, { passive: false });
    const endStick = (e) => {
      if (stickId !== null && e.pointerId !== stickId) return;
      resetStick();
    };
    stick?.addEventListener("pointerup", endStick);
    stick?.addEventListener("pointercancel", endStick);

    // Look pad → rotate + tap to start/advance menus
    const look = root.querySelector("[data-look]");
    let lookId = null, lookX = 0;
    look?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      look.setPointerCapture?.(e.pointerId);
      lookId = e.pointerId;
      lookX = e.clientX;
      if (self.mode !== "play") { self.press(" "); self.enterFullscreen(); }
    }, { passive: false });
    look?.addEventListener("pointermove", (e) => {
      if (lookId !== e.pointerId || self.mode !== "play") return;
      e.preventDefault();
      const dx = e.clientX - lookX;
      lookX = e.clientX;
      self.rotate(dx * 0.0085);
    }, { passive: false });
    const endLook = (e) => {
      if (lookId !== null && e.pointerId !== lookId) return;
      lookId = null;
    };
    look?.addEventListener("pointerup", endLook);
    look?.addEventListener("pointercancel", endLook);

    // Fire hold
    const fire = root.querySelector("[data-touch-fire]");
    const fireDown = (e) => {
      e.preventDefault();
      audio();
      if (self.mode !== "play") { self.press(" "); self.enterFullscreen(); return; }
      self.mdown = true;
      self.tryFire();
    };
    const fireUp = () => { self.mdown = false; };
    fire?.addEventListener("pointerdown", fireDown, { passive: false });
    fire?.addEventListener("pointerup", fireUp);
    fire?.addEventListener("pointercancel", fireUp);
    fire?.addEventListener("pointerleave", fireUp);

    // Weapon / map buttons
    root.querySelectorAll("[data-touch-key]").forEach((btn) => {
      const key = btn.getAttribute("data-touch-key");
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        setKey(key, true);
      }, { passive: false });
      btn.addEventListener("pointerup", () => setKey(key, false));
      btn.addEventListener("pointercancel", () => setKey(key, false));
    });

    // Fullscreen + landscape lock ("flip the phone" support)
    root.querySelector("[data-touch-fs]")?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      self.toggleFullscreen();
    }, { passive: false });

    this._resetTouch = resetStick;
  };

  // Fullscreen the whole stage wrapper (canvas + touch controls stay visible)
  // and ask the OS to rotate into landscape where the API allows it.
  Game.prototype.fsTarget = function () {
    return (this.canvas.closest && this.canvas.closest(".arcade__stage")) || this.canvas;
  };
  Game.prototype.enterFullscreen = function () {
    // only auto-trigger for coarse (touch) pointers — desktop stays inline
    if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches)) return;
    if (document.fullscreenElement) return;
    this.toggleFullscreen();
  };
  Game.prototype.toggleFullscreen = function () {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      try { (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); } catch (e) {}
      return;
    }
    const el = this.fsTarget();
    const rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!rq) return;
    try {
      const p = rq.call(el);
      const lock = function () {
        try {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(function () {});
          }
        } catch (e) {}
      };
      if (p && p.then) p.then(lock).catch(function () {}); else lock();
    } catch (e) {}
  };

  Game.prototype.setResolution = function (s) {
    SCALE = s;
    W = (BW * s) | 0; H = (BH * s) | 0; VIEW_H = (VIEW_B * s) | 0;
    this.canvas.width = W; this.canvas.height = H;
    this.zbuf = new Float64Array(W);
    const g = this.ctx;
    g.imageSmoothingEnabled = true; // smooth scaling — no chunky pixels
    this.vig = g.createRadialGradient(W / 2, VIEW_H / 2, VIEW_H * 0.45, W / 2, VIEW_H / 2, VIEW_H * 0.95);
    this.vig.addColorStop(0, "rgba(0,0,0,0)");
    this.vig.addColorStop(1, "rgba(0,0,0,0.42)");
    // floor/ceiling caster buffer — half resolution, smoothed up (fast + soft)
    this.fbw = Math.max(2, W >> 1);
    this.fbh = Math.max(2, (VIEW_H >> 1) & ~1); // even, split at the horizon
    this.fcv = document.createElement("canvas");
    this.fcv.width = this.fbw; this.fcv.height = this.fbh;
    this.fctx = this.fcv.getContext("2d");
    this.fimg = this.fctx.createImageData(this.fbw, this.fbh);
    this.fbuf = new Uint32Array(this.fimg.data.buffer);
    this._fr = 0; this._jank = 0;
  };

  // True perspective floor & ceiling casting (the classic Doom-look upgrade):
  // for every buffer row we walk a world-space line and sample the stone /
  // tech-panel textures per pixel, with distance fog baked into the shade.
  Game.prototype.renderFloorCast = function (g) {
    const fw = this.fbw, fh = this.fbh, half = fh >> 1;
    const buf = this.fbuf;
    const rdx0 = this.dx - this.plx, rdy0 = this.dy - this.ply;
    const rdx1 = this.dx + this.plx, rdy1 = this.dy + this.ply;
    const px = this.px, py = this.py;
    for (let y = 0; y < half; y++) {
      const rowDist = half / (y + 0.5);
      const stepX = rowDist * (rdx1 - rdx0) / fw;
      const stepY = rowDist * (rdy1 - rdy0) / fw;
      let fx = px + rowDist * rdx0;
      let fy = py + rowDist * rdy0;
      const lit = Math.max(0.14, 1 - rowDist * 0.11);        // distance fog
      const litC = lit * 0.92;                                // ceiling a touch darker
      const rowF = (half + y) * fw, rowC = (half - 1 - y) * fw;
      for (let x = 0; x < fw; x++) {
        const ti = ((((fy * 64) | 0) & 63) << 6) | (((fx * 64) | 0) & 63);
        let p = FLOOR_PIX[ti];
        buf[rowF + x] = 0xff000000 |
          ((((p >> 16 & 255) * lit) & 255) << 16) | ((((p >> 8 & 255) * lit) & 255) << 8) | (((p & 255) * lit) & 255);
        p = CEIL_PIX[ti];
        buf[rowC + x] = 0xff000000 |
          ((((p >> 16 & 255) * litC) & 255) << 16) | ((((p >> 8 & 255) * litC) & 255) << 8) | (((p & 255) * litC) & 255);
        fx += stepX; fy += stepY;
      }
    }
    this.fctx.putImageData(this.fimg, 0, 0);
    g.drawImage(this.fcv, 0, 0, fw, fh, 0, 0, W, VIEW_H);
  };

  Game.prototype.press = function (k) {
    if (this.mode === "editor") { this.editorKey(k); return; }
    if (this.mode === "cine") { if (k === "enter" || k === " ") this.endCinematic(); return; }
    if (this.mode === "play") this.showMap = (k === "m") ? !this.showMap : this.showMap;
    if (this.mode === "title") {
      if (k === " " || k === "enter") { dailyMode = false; this.startRun(); return; }
      if (k === "c") { dailyMode = true; dailySeed = todaySeed(); this.startRun(); return; }
      if (k === "e") { this.startEditor(); return; }
      if (k === "o") { this.allyOn = !this.allyOn; this.say(this.allyOn ? "WRAITH ALLY: ON" : "WRAITH ALLY: OFF", 1.2); return; }
      if (k === "[" || k === "-") { diff = Math.max(0, diff - 1); return; }
      if (k === "]" || k === "=") { diff = Math.min(2, diff + 1); return; }
    }
    if (this.mode === "inter") {
      if (k === "s") { this.downloadScoreCard(); return; }
      if (k === " ") { this.nextLevel(); return; }
    }
    if (this.mode === "dead" && (k === "r" || k === " ")) { this.retryLevel(); return; }
    if (this.mode === "win") {
      if (k === "s") { this.downloadScoreCard(); return; }
      if (k === "r" || k === " ") { this.mode = "title"; this.stopMusic(); return; }
    }
    if (this.mode === "play") {
      if (k === " ") this.tryFire();
      if (k === "f") { this.dropMine(); return; }
      if (k === "r") this.retryLevel();
      if (k === "p") { this.mode = "pause"; return; }
      if (k === "1" || k === "2" || k === "3" || k === "4" || k === "5" || k === "6") {
        const w = +k - 1;
        if (this.owned[w] && this.cur !== w) { this.cur = w; SFX.switch(); this.say(WEAPONS[w].name, 0.7); }
      }
    } else if (this.mode === "pause" && (k === "p" || k === " ")) {
      this.mode = "play"; this._last = performance.now();
    }
  };

  Game.prototype.startRun = function () {
    this.score = 0; this.hp = 100; this.armor = 0;
    this.bullets = 40; this.shells = 0; this.cells = 0; this.rockets = 0;
    this.owned = [true, false, false, false, false, false]; this.cur = 0;
    this.berserkT = 0; this.streakCount = 0; this.streakT = 0;
    this.mods = { rapid: 0, spread: 0, lifesteal: 0 };
    this.mineCount = 0;
    this.unlocks = loadUnlocks();
    // persistent unlock: bonus starting shells
    if (this.unlocks.shellsBonus > 0) this.shells += this.unlocks.shellsBonus;
    if (dailyMode) { diff = 2; this.startMusic(); this.announce("DAILY CHALLENGE  ·  SEED " + dailySeed, "#ff8a50"); }
    else this.startMusic();
    this.loadLevel(0);
    this.mode = "play";
  };
  Game.prototype.loadLevel = function (idx) {
    this.levelIdx = idx;
    this.L = parseLevel(idx);
    this.px = this.L.px; this.py = this.L.py;
    this.dx = 1; this.dy = 0; this.plx = 0; this.ply = FOV_PLANE;
    this.kills = 0; this.itemsGot = 0; this.time = 0; this.secretsFound = 0;
    this.keycards = { red: false, blue: false, yellow: false };
    this.hazardCd = 0; this.teleCd = 0; this.crusherCd = 0;
    this.mines = []; this.mineCd = 0;
    this.projs.length = 0; this.parts.length = 0; this.boomQueue.length = 0;
    // ghost replay: reset recording, load best for this level
    this.ghost = []; this.ghostT = 0; this.ghostBest = loadGhost(idx);
    // co-op ghost ally spawns beside the player
    this.ally = this.allyOn ? { x: this.px + 0.6, y: this.py, cd: 0, animT: 0 } : null;
    FLOOR_PIX = THEME_FLOOR[this.L.theme] || THEME_FLOOR.hangar;
    CEIL_PIX = THEME_CEIL[this.L.theme] || THEME_CEIL.hangar;
    // theme-based hazard: swamp/dungeon = mild toxic; foundry/throne = hotter lava
    const lava = (this.L.theme === "foundry" || this.L.theme === "throne");
    this.hazardDmg = lava ? 10 : 4;
    this.hazardTick = lava ? 0.4 : 0.55;
    this.hazardHot = lava;
    this.chaosT = 3.4;
    this.chaosSaid = false;
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      e.asleep = Math.hypot(e.x - this.px, e.y - this.py) > 3.2;
    }
    this.say(this.L.name + "  —  YOU ARE ALONE… FOR NOW", 2.8);
  };
  Game.prototype.retryLevel = function () {
    this.hp = 100;
    this.armor = Math.max(0, Math.min(this.armor, 25));
    this.bullets = Math.max(this.bullets, 24);
    this.berserkT = 0;
    this.mode = "play";
    this.loadLevel(this.levelIdx);
  };
  Game.prototype.nextLevel = function () {
    if (this.levelIdx + 1 < LEVELS.length) { this.loadLevel(this.levelIdx + 1); this.mode = "play"; }
    else this.doWin();
  };
  Game.prototype.doWin = function () {
    this.mode = "win";
    if (this.score > this.hi) {
      this.hi = this.score;
      try { localStorage.setItem("rvdw-inferno-hi", String(this.hi)); } catch (e) {}
    }
  };
  Game.prototype.say = function (t, secs) { this.msg = t; this.msgT = secs; };
  // big centered announcer text with fade — used for milestone events
  Game.prototype.announce = function (t, color) {
    this.bigMsg = t; this.bigT = 2.2; this.bigColor = color || "#ffd75e";
  };

  // ---- dynamic music layers (Web Audio) ----
  // ambient drone always plays; combat adds a pulse bass + tension oscillator,
  // crossfaded by combatIntensity (0-1). Respects the global mute + SFX system.
  Game.prototype.startMusic = function () {
    const a = audio(); if (!a) return;
    if (this.music) return;
    try {
      const master = a.createGain(); master.gain.value = 0.5; master.connect(a.destination);
      // ambient drone
      const drone = a.createOscillator(); drone.type = "sine"; drone.frequency.value = 55;
      const droneG = a.createGain(); droneG.gain.value = 0.05;
      const drone2 = a.createOscillator(); drone2.type = "triangle"; drone2.frequency.value = 82.4;
      const drone2G = a.createGain(); drone2G.gain.value = 0.02;
      drone.connect(droneG); drone2.connect(drone2G); droneG.connect(master); drone2G.connect(master);
      // combat pulse bass
      const bass = a.createOscillator(); bass.type = "sawtooth"; bass.frequency.value = 55;
      const bassG = a.createGain(); bassG.gain.value = 0.0001;
      const bassLfo = a.createOscillator(); bassLfo.type = "square"; bassLfo.frequency.value = 4.2;
      const bassLfoG = a.createGain(); bassLfoG.gain.value = 0.06;
      bassLfo.connect(bassLfoG); bassLfoG.connect(bassG.gain);
      bass.connect(bassG); bassG.connect(master);
      // tension oscillator (higher)
      const tension = a.createOscillator(); tension.type = "sawtooth"; tension.frequency.value = 220;
      const tensionG = a.createGain(); tensionG.gain.value = 0.0001;
      tension.connect(tensionG); tensionG.connect(master);
      [drone, drone2, bass, bassLfo, tension].forEach(function (o) { try { o.start(); } catch (e) {} });
      this.music = { master: master, bassG: bassG, tensionG: tensionG,
                     nodes: [drone, drone2, bass, bassLfo, tension] };
    } catch (e) { this.music = null; }
  };
  Game.prototype.updateMusic = function (dt) {
    if (!this.music) return;
    const a = actx; if (!a) return;
    const ci = this.combatIntensity;
    try {
      this.music.bassG.gain.setTargetAtTime(0.0001 + ci * 0.05, a.currentTime, 0.4);
      this.music.tensionG.gain.setTargetAtTime(0.0001 + ci * 0.03, a.currentTime, 0.6);
    } catch (e) {}
  };
  Game.prototype.stopMusic = function () {
    if (!this.music) return;
    try { this.music.nodes.forEach(function (o) { try { o.stop(); } catch (e) {} }); } catch (e) {}
    this.music = null;
  };

  Game.prototype.rotate = function (a) {
    const c = Math.cos(a), s = Math.sin(a);
    let t = this.dx; this.dx = this.dx * c - this.dy * s; this.dy = t * s + this.dy * c;
    t = this.plx; this.plx = this.plx * c - this.ply * s; this.ply = t * s + this.ply * c;
  };
  Game.prototype.wallAt = function (x, y) {
    if (y < 0 || y >= this.L.h || x < 0 || x >= this.L.w) return 1;
    return this.L.map[y | 0][x | 0];
  };
  Game.prototype.doorAt = function (mx, my) {
    return this.L.doors[my * 1000 + mx] || null;
  };
  // blocks movement / sight? doors count as solid until nearly open
  Game.prototype.solidAt = function (x, y) {
    const v = this.wallAt(x, y);
    if (v === 0) return false;
    if (v === 6 || v === 7 || v === 8 || v === 10 || v === 11) {
      const d = this.doorAt(x | 0, y | 0);
      return !d || d.open < 0.85;
    }
    return true;
  };
  // touching a door tile opens it (auto doors always, gold doors need the key)
  Game.prototype.bumpDoors = function (x, y, byPlayer) {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const d = this.doorAt((x | 0) + ox, (y | 0) + oy);
      if (!d) continue;
      if (d.lock && !this.keycards[d.lock]) {
        if (byPlayer && this.msgT <= 0) {
          this.say(d.lock.toUpperCase() + " DOOR — FIND THE " + d.lock.toUpperCase() + " KEY", 1.4); SFX.nokey();
        }
        continue;
      }
      if (d.lock && byPlayer && d.open === 0 && d.target === 0) SFX.key();
      if (d.secret && byPlayer && d.open === 0 && d.target === 0) {
        this.announce("SECRET FOUND!", "#ffd75e"); SFX.key(); this.score += 50;
        this.secretsFound = (this.secretsFound || 0) + 1;
      }
      d.target = 1; d.hold = DOOR_HOLD;
    }
  };
  Game.prototype.updateDoors = function (dt) {
    const doors = this.L.doors;
    for (const k in doors) {
      const d = doors[k];
      if (d.target > 0) { d.hold -= dt; if (d.hold <= 0 && !this.nearEntity(d.x + 0.5, d.y + 0.5, 1.1)) d.target = 0; }
      if (d.open < d.target) d.open = Math.min(d.target, d.open + DOOR_SPEED * dt);
      else if (d.open > d.target) d.open = Math.max(d.target, d.open - DOOR_SPEED * dt);
    }
  };
  Game.prototype.nearEntity = function (x, y, r) {
    if (Math.hypot(this.px - x, this.py - y) < r) return true;
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state !== "dead" && Math.hypot(e.x - x, e.y - y) < r) return true;
    }
    return false;
  };
  Game.prototype.tryMove = function (nx, ny) {
    const R = 0.22;
    this.bumpDoors(nx, this.py, true); this.bumpDoors(this.px, ny, true);
    if (!this.solidAt(nx + (nx > this.px ? R : -R), this.py)) this.px = nx;
    if (!this.solidAt(this.px, ny + (ny > this.py ? R : -R))) this.py = ny;
  };
  Game.prototype.los = function (x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(d / 0.15);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  };
  Game.prototype.spawnParts = function (x, y, n, color, spd) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 140) this.parts.shift();
      const a = Math.random() * Math.PI * 2, v = (0.5 + Math.random()) * (spd || 1.6);
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                        life: 0, max: 0.3 + Math.random() * 0.35, color: color, sz: 0.05 + Math.random() * 0.08 });
    }
  };

  // ---- combat ----
  Game.prototype.hitscanTargets = function () {
    const t = [];
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state !== "dead") t.push({ x: e.x, y: e.y, r: 0.38 * e.cfg.scale, e: e });
    }
    for (let i = 0; i < this.L.barrels.length; i++) {
      const b = this.L.barrels[i];
      if (!b.dead) t.push({ x: b.x, y: b.y, r: 0.3, b: b });
    }
    return t;
  };
  Game.prototype.damageEnemy = function (e, dmg) {
    // knight shield: frontal hits are reduced
    if (e.cfg.shield) {
      const dist = Math.hypot(this.px - e.x, this.py - e.y);
      if (dist > 1.5) dmg *= 0.35; // shield blocks frontal damage at range
    }
    e.hp -= dmg;
    // lifesteal mod: heal a fraction of damage dealt by the player's weapons
    if (this.mods && this.mods.lifesteal > 0 && !this._allyDmg && this.hp > 0 && this.hp < 100) {
      this.hp = Math.min(100, this.hp + dmg * 0.15);
    }
    const partN = Math.min(16, 5 + Math.floor(dmg / 15));
    this.spawnParts(e.x, e.y, partN, e.cfg.boss || e.cfg.miniboss ? "#ffb08a" : "#c9333f", 1.8 + dmg * 0.012);
    // nearby kill flash (red tint)
    if (e.hp <= 0 && Math.hypot(this.px - e.x, this.py - e.y) < 3.5) {
      this.dmgFlash = Math.max(this.dmgFlash, 0.14);
    }
    if (e.hp <= 0) {
      e.state = "dead";
      this.kills++;
      this.score += e.cfg.score;
      SFX.edie();
      // shotgun gore: extra chunks + blood on a shotgun kill
      if (this.cur === 1) {
        this.spawnParts(e.x, e.y, 5 + (Math.random() * 2 | 0), "#6a0e10", 2.6); // dark red chunks
        this.spawnParts(e.x, e.y, 10, "#c9333f", 2.0);                          // blood spray
      }
      // multi-kill detection (kills bunched in a short window)
      if ((this.multiT || 0) > 0) this.multiCount = (this.multiCount || 1) + 1;
      else this.multiCount = 1;
      this.multiT = 0.8;
      if (this.multiCount === 3) this.announce("TRIPLE KILL!", "#ff8a50");
      else if (this.multiCount >= 4) this.announce("MULTI KILL x" + this.multiCount, "#ff5d52");
      // kill streak
      this.streakT = 2.0;
      this.streakCount++;
      if (this.streakCount === 3)       this.announce("IMPRESSIVE!", "#ffd75e");
      else if (this.streakCount === 5)  this.announce("KILLING SPREE!", "#ff8a50");
      else if (this.streakCount === 8)  this.announce("UNSTOPPABLE!!", "#ff5d52");
      // egg hatches into 3 arachnids
      if (e.type === "egg") {
        for (let i = 0; i < 3; i++) {
          const cfg = ETYPES.arachnid;
          this.L.enemies.push({ type: "arachnid", cfg: cfg,
            x: e.x + (Math.random() - 0.5) * 0.9, y: e.y + (Math.random() - 0.5) * 0.9,
            hp: cfg.hp, state: "chase", animT: 0, atkT: 0.4, painT: 0,
            roared: false, phase: 0, blink: 0, asleep: false, blinkT: 0, hatchT: -1, hatching: false });
          this.L.totKills++;
        }
        this.spawnParts(e.x, e.y, 12, "#c8b898", 2.2);
        this.say("IT HATCHED!", 1.2);
      }
      if (e.cfg.miniboss) {
        this.spawnParts(e.x, e.y, 50, "#ff8a50", 3.6);
        this.spawnParts(e.x, e.y, 30, "#ffd75e", 2.6);
        this.shake = Math.max(this.shake, 0.7); SFX.boom();
        this.say(e.cfg.title + " SLAIN!", 2.0);
      }
      if (e.cfg.boss) {
        this.spawnParts(e.x, e.y, 60, "#ff8a50", 3.2);
        this.spawnParts(e.x, e.y, 40, "#ffd75e", 2.4);
        this.shake = 0.8; SFX.boom();
        this.announce("THE CINDER KING FALLS", "#ffd75e");
        const self = this;
        setTimeout(function () { if (self.running && self.mode === "play") self.startCinematic(); }, 1600);
      }
    } else {
      e.state = "pain"; e.painT = 0.26;
    }
  };
  Game.prototype.explodeBarrel = function (b) {
    if (b.dead) return;
    b.dead = true;
    this.score += 50;
    SFX.boom();
    this.shake = Math.max(this.shake, 0.45);
    this.spawnParts(b.x, b.y, 34, "#ff8a50", 3.4);
    this.spawnParts(b.x, b.y, 20, "#ffd75e", 2.6);
    // splash damage
    const R = 1.8;
    const pd = Math.hypot(this.px - b.x, this.py - b.y);
    if (pd < R) this.hurtPlayer((34 * (1 - pd / R)) | 0);
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d < R) this.damageEnemy(e, 60 * (1 - d / R));
    }
    for (let i = 0; i < this.L.barrels.length; i++) {
      const o = this.L.barrels[i];
      if (!o.dead && o !== b && Math.hypot(o.x - b.x, o.y - b.y) < R) {
        this.boomQueue.push({ b: o, t: 0.14 });
      }
    }
  };
  Game.prototype.hurtPlayer = function (dmg) {
    if (this.mode !== "play") return;
    dmg = Math.max(0, dmg | 0);
    if (this.armor > 0 && dmg > 0) {
      const absorbed = Math.min(this.armor, Math.ceil(dmg * 0.66));
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.dmgFlash = 0.65;
    SFX.hurt();
    if (this.hp <= 0) { this.hp = 0; this.mode = "dead"; }
  };

  Game.prototype.tryFire = function () {
    if (this.mode !== "play" || this.fireCd > 0) return;
    const w = WEAPONS[this.cur];
    const bersMul = (this.berserkT > 0 && (w.melee || this.cur === 4)) ? 2 : 1;
    // ammo check (chainsaw has "none" = infinite)
    if (w.ammo !== "none") {
      const cost = w.cost || 1;
      if ((this[w.ammo] || 0) < cost) {
        this.fireCd = 0.5;
        this.say("NO AMMO — SWITCH WEAPONS (1-6) OR FIND SOME", 1.1);
        SFX.empty(); return;
      }
      this[w.ammo] -= cost;
    }
    this.fireCd = w.rate * (this.mods.rapid > 0 ? 0.65 : 1);
    this.muzzle = w.bfg ? 0.18 : w.rocket ? 0.14 : 0.09;
    this.shake = Math.max(this.shake, w.kick * 0.016);
    if (w.bfg) { SFX.bfg(); this.shake = Math.max(this.shake, 0.45); }
    else if (w.melee) { SFX.chainsaw(); }
    else if (w.rocket) { SFX.rocket(); this.shake = Math.max(this.shake, 0.28); }
    else (w.name === "PISTOL" ? SFX.pistol : w.name === "SHOTGUN" ? SFX.shotgun : SFX.plasma)();

    // CHAINSAW: melee sweep
    if (w.melee) {
      const targets = this.hitscanTargets();
      const aim = Math.atan2(this.dy, this.dx);
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.e && t.e.state === "dead") continue;
        if (t.b && t.b.dead) continue;
        const dist = Math.hypot(t.x - this.px, t.y - this.py);
        if (dist > w.range) continue;
        let da = Math.atan2(t.y - this.py, t.x - this.px) - aim;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > 0.75) continue;
        const dmg = (w.dmg[0] + Math.random() * (w.dmg[1] - w.dmg[0])) * bersMul;
        if (t.e) this.damageEnemy(t.e, dmg);
        else { t.b.hp -= 8; this.spawnParts(t.b.x, t.b.y, 2, "#88cc44", 0.9); if (t.b.hp <= 0) this.explodeBarrel(t.b); }
      }
      // hit breakable wall directly ahead
      const bx = (this.px + this.dx * 1.0) | 0;
      const by = (this.py + this.dy * 1.0) | 0;
      const bk = by * 1000 + bx;
      if (this.L.breakables[bk]) this.damageBreakable(bk);
      return;
    }

    // PROJECTILE (plasma, bfg, rocket)
    if (w.proj) {
      const speed = w.bfg ? 5.2 : w.rocket ? 7 : 9;
      this.projs.push({
        x: this.px + this.dx * 0.45, y: this.py + this.dy * 0.45,
        vx: this.dx * speed, vy: this.dy * speed, player: true,
        dmg: w.dmg[0] + Math.random() * (w.dmg[1] - w.dmg[0]),
        bfg: !!w.bfg, rocket: !!w.rocket, splash: w.splash || 0
      });
      return;
    }

    // HITSCAN pellets — spread mod adds extra pellets and widens the cone
    const aim = Math.atan2(this.dy, this.dx);
    const targets = this.hitscanTargets();
    const spreadMod = this.mods.spread > 0;
    const pellets = w.pellets + (spreadMod ? (w.pellets >= 4 ? 3 : 2) : 0);
    const spreadAmt = w.spread * (spreadMod ? 1.7 : 1);
    for (let p = 0; p < pellets; p++) {
      const off = (Math.random() * 2 - 1) * spreadAmt;
      let best = null, bestD = 1e9;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.e && t.e.state === "dead") continue;
        if (t.b && t.b.dead) continue;
        const dx = t.x - this.px, dy = t.y - this.py;
        const dist = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - (aim + off);
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) < Math.atan2(t.r, dist) + 0.015 && dist < bestD &&
            this.los(this.px, this.py, t.x, t.y)) { best = t; bestD = dist; }
      }
      if (best) {
        if (best.e) this.damageEnemy(best.e, w.dmg[0] + Math.random() * (w.dmg[1] - w.dmg[0]));
        else { best.b.hp -= 10; this.spawnParts(best.b.x, best.b.y, 3, "#8ad8ff", 1); if (best.b.hp <= 0) this.explodeBarrel(best.b); }
      }
      // also check breakable wall along aim ray
      const wxh = (this.px + Math.cos(aim + off) * Math.min(bestD || 8, 8)) | 0;
      const wyh = (this.py + Math.sin(aim + off) * Math.min(bestD || 8, 8)) | 0;
      const bkh = wyh * 1000 + wxh;
      if (this.L.breakables[bkh] && this.wallAt(wxh, wyh) === 9) this.damageBreakable(bkh);
    }
  };

  Game.prototype.damageBreakable = function (key) {
    const br = this.L.breakables[key];
    if (!br) return;
    br.hp--;
    this.spawnParts(br.x + 0.5, br.y + 0.5, 6, "#8a6040", 1.4);
    if (br.hp <= 0) {
      this.L.map[br.y][br.x] = 0;
      delete this.L.breakables[key];
      this.spawnParts(br.x + 0.5, br.y + 0.5, 20, "#8a5030", 2.4);
      this.spawnParts(br.x + 0.5, br.y + 0.5, 12, "#ffd75e", 1.8);
      this.shake = Math.max(this.shake, 0.4);
      SFX.boom();
      this.say("WALL DESTROYED!", 1.2);
    }
  };

  Game.prototype.rocketBlast = function (x, y, dmg, radius) {
    this.spawnParts(x, y, 28, "#ff7722", 3.6);
    this.spawnParts(x, y, 16, "#ffd75e", 2.4);
    this.shake = Math.max(this.shake, 0.5); SFX.boom();
    // self-damage if too close
    const pd = Math.hypot(this.px - x, this.py - y);
    if (pd < radius) this.hurtPlayer(((dmg * 0.6 * (1 - pd / radius)) | 0));
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) this.damageEnemy(e, dmg * (1 - d / radius));
    }
    for (let i = 0; i < this.L.barrels.length; i++) {
      const b = this.L.barrels[i];
      if (!b.dead && Math.hypot(b.x - x, b.y - y) < radius * 0.8) {
        b.hp = 0; this.explodeBarrel(b);
      }
    }
    // damage nearby breakable walls
    const rx0 = (x - radius) | 0, rx1 = (x + radius) | 0;
    const ry0 = (y - radius) | 0, ry1 = (y + radius) | 0;
    for (let by = ry0; by <= ry1; by++) for (let bx2 = rx0; bx2 <= rx1; bx2++) {
      const bk = by * 1000 + bx2;
      if (this.L.breakables[bk] && Math.hypot(bx2 + 0.5 - x, by + 0.5 - y) < radius) {
        this.damageBreakable(bk);
      }
    }
  };

  Game.prototype.bfgBlast = function (x, y, dmg, radius) {
    this.spawnParts(x, y, 42, "#7dff9a", 4.2);
    this.spawnParts(x, y, 24, "#d5ffe0", 3.2);
    this.shake = Math.max(this.shake, 0.55);
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) this.damageEnemy(e, dmg * (1 - d / radius));
    }
    for (let i = 0; i < this.L.barrels.length; i++) {
      const b = this.L.barrels[i];
      if (!b.dead && Math.hypot(b.x - x, b.y - y) < radius * 0.75) {
        b.hp = 0; this.explodeBarrel(b);
      }
    }
  };

  // ---- update ----
  Game.prototype.update = function (dt) {
    if (this.mode !== "play") return;
    this.time += dt;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.8);
    this.pickFlash = Math.max(0, this.pickFlash - dt * 2);
    if (this.liftFlash > 0) this.liftFlash = Math.max(0, this.liftFlash - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.msgT > 0) this.msgT -= dt;

    // berserk timer
    if (this.berserkT > 0) { this.berserkT -= dt; if (this.berserkT <= 0) this.say("BERSERK FADED", 1.0); }

    // kill streak decay
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streakCount = 0; }

    // weapon-mod timers
    if (this.bigT > 0) this.bigT -= dt;
    if (this.multiT > 0) this.multiT -= dt;
    if (this.mineCd > 0) this.mineCd -= dt;
    for (const mk in this.mods) {
      if (this.mods[mk] > 0) {
        this.mods[mk] -= dt;
        if (this.mods[mk] <= 0) { this.mods[mk] = 0; this.say(mk.toUpperCase() + " MOD FADED", 1.0); }
      }
    }

    // ghost replay recording — sample the player position every 0.1s
    this.ghostT += dt;
    if (this.ghostT >= 0.1) {
      this.ghostT -= 0.1;
      if (this.ghost.length < 6000) this.ghost.push(this.px, this.py);
    }

    this.updateMines(dt);
    this.updateAlly(dt);
    this.updateCrushers(dt);
    this.updateLifts(dt);

    // combat intensity → drives dynamic music layers (0-1)
    let awake = 0, close = 0;
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead" || e.asleep) continue;
      awake++;
      if (Math.hypot(e.x - this.px, e.y - this.py) < 8) close++;
    }
    const targetCI = this.chaosSaid || awake > 0 ? Math.min(1, 0.25 + close * 0.18) : 0;
    this.combatIntensity += (targetCI - this.combatIntensity) * Math.min(1, dt * 2);
    this.updateMusic(dt);

    // held-fire: mouse held always auto-fires; space auto-fires plasma/rocket; chainsaw auto-fires when held
    const cw = WEAPONS[this.cur];
    if (this.mdown || (this.keys[" "] && (cw.proj || cw.melee))) this.tryFire();

    // movement
    const sp = 3.1 * dt, rot = 2.5 * dt;
    let mvx = 0, mvy = 0, moved = false;
    if (this.keys["w"] || this.keys["arrowup"])   { mvx += this.dx; mvy += this.dy; }
    if (this.keys["s"] || this.keys["arrowdown"]) { mvx -= this.dx; mvy -= this.dy; }
    if (this.keys["a"]) { mvx += this.dy; mvy -= this.dx; }
    if (this.keys["d"]) { mvx -= this.dy; mvy += this.dx; }
    if (this.keys["arrowleft"])  this.rotate(-rot);
    if (this.keys["arrowright"]) this.rotate(rot);
    const ml = Math.hypot(mvx, mvy);
    const spMulB = (this.berserkT > 0) ? 1.25 : 1;
    if (ml > 0.001) { this.tryMove(this.px + (mvx / ml) * sp * spMulB, this.py + (mvy / ml) * sp * spMulB); moved = true; }
    this.bob += dt * (moved ? 9 : 2);
    this.updateDoors(dt);

    // floor hazards (~): damage player if standing on one
    if (this.L.hazards && this.L.hazards.length > 0) {
      this.hazardCd = Math.max(0, this.hazardCd - dt);
      for (let i = 0; i < this.L.hazards.length; i++) {
        const hz = this.L.hazards[i];
        if (Math.abs(this.px - hz.x) < 0.6 && Math.abs(this.py - hz.y) < 0.6) {
          if (this.hazardCd <= 0) {
            this.hurtPlayer((this.hazardDmg * DIFF_MUL[diff]) | 0);
            this.hazardCd = this.hazardTick || 0.5;
            if (Math.random() < 0.35) this.say(this.hazardHot ? "RISING LAVA!" : "TOXIC GROUND!", 0.8);
          }
          break;
        }
      }
    }

    // teleporters (@ / $)
    if (this.L.telepads && this.L.telepads.length > 0 && this.teleCd <= 0) {
      for (let i = 0; i < this.L.telepads.length; i++) {
        const tp = this.L.telepads[i];
        if (!tp.dest) continue;
        if (Math.abs(this.px - tp.x) < 0.55 && Math.abs(this.py - tp.y) < 0.55) {
          this.px = tp.dest.x + 0.5; this.py = tp.dest.y + 0.5;
          this.teleCd = 1.0; this.shake = Math.max(this.shake, 0.3);
          SFX.teleport(); this.say("TELEPORT!", 1.0);
          break;
        }
      }
    }
    if (this.teleCd > 0) this.teleCd -= dt;

    // ambush triggers (!)
    if (this.L.ambushes) {
      for (let i = 0; i < this.L.ambushes.length; i++) {
        const ab = this.L.ambushes[i];
        if (ab.used) continue;
        if (Math.abs(this.px - ab.x) < 0.55 && Math.abs(this.py - ab.y) < 0.55) {
          ab.used = true;
          this.say("AMBUSH!", 2.0); SFX.roar(); this.shake = Math.max(this.shake, 0.45);
          // open all doors within 4 tiles
          for (const k in this.L.doors) {
            const d = this.L.doors[k];
            if (Math.hypot(d.x - ab.x, d.y - ab.y) < 4) { d.target = 1; d.hold = DOOR_HOLD; }
          }
          // wake all enemies within 6 tiles
          for (let j = 0; j < this.L.enemies.length; j++) {
            const e = this.L.enemies[j];
            if (e.state !== "dead" && Math.hypot(e.x - ab.x, e.y - ab.y) < 6) {
              e.asleep = false; e.state = "chase";
            }
          }
        }
      }
    }

    // pickups
    for (let i = this.L.items.length - 1; i >= 0; i--) {
      const it = this.L.items[i];
      if (Math.hypot(it.x - this.px, it.y - this.py) < 0.55) {
        let took = true, special = false;
        if (it.kind === "h") { if (this.hp >= 100) took = false; else { this.hp = Math.min(100, this.hp + 25); this.say("+25 HEALTH", 1); } }
        else if (it.kind === "v") { if (this.armor >= 100) took = false; else { this.armor = Math.min(100, this.armor + 25); this.say("+25 ARMOR", 1); } }
        else if (it.kind === "a") { this.bullets += 10; this.say("+10 BULLETS", 1); }
        else if (it.kind === "s") { this.shells += 4; this.say("+4 SHELLS", 1); }
        else if (it.kind === "c") { this.cells += 20; this.say("+20 CELLS", 1); }
        else if (it.kind === "o") { this.rockets += 5; this.say("+5 ROCKETS", 1); }
        else if (it.kind === "k") { this.keycards.red = true; this.announce("RED KEY", "#ff6a5e"); SFX.key(); special = true; }
        else if (it.kind === "b") { this.keycards.blue = true; this.announce("BLUE KEY", "#5aa0e8"); SFX.key(); special = true; }
        else if (it.kind === "y") { this.keycards.yellow = true; this.announce("YELLOW KEY", "#ffe14a"); SFX.key(); special = true; }
        else if (it.kind === "W") { this.owned[1] = true; this.cur = 1; this.shells += 8; this.say("SHOTGUN! (KEY 2)", 1.8); SFX.key(); special = true; }
        else if (it.kind === "Q") { this.owned[2] = true; this.cur = 2; this.cells += 40; this.say("PLASMA RIFLE! (KEY 3)", 1.8); SFX.key(); special = true; }
        else if (it.kind === "Y") { this.owned[3] = true; this.cur = 3; this.cells += 80; this.say("BFG-9000! (KEY 4)", 2.2); SFX.key(); this.shake = 0.35; special = true; }
        else if (it.kind === "n") { this.owned[4] = true; this.cur = 4; this.say("CHAINSAW! (KEY 5)", 1.8); SFX.key(); special = true; }
        else if (it.kind === "m") { this.owned[5] = true; this.cur = 5; this.rockets += 10; this.say("ROCKET LAUNCHER! (KEY 6)", 1.8); SFX.key(); this.shake = 0.25; special = true; }
        else if (it.kind === "e") { this.berserkT = 8; this.announce("BERSERK!!", "#ff5d52"); SFX.roar(); this.pickFlash = 0.8; this.shake = 0.3; special = true; }
        else if (it.kind === "p") { this.mods.rapid = 20; this.announce("RAPID FIRE MOD", "#ffd75e"); SFX.key(); this.pickFlash = 0.6; special = true; }
        else if (it.kind === "x") { this.mods.spread = 20; this.announce("SPREAD MOD", "#ff9a50"); SFX.key(); this.pickFlash = 0.6; special = true; }
        else if (it.kind === "l") { this.mods.lifesteal = 15; this.announce("LIFESTEAL MOD", "#63d97a"); SFX.key(); this.pickFlash = 0.6; special = true; }
        else if (it.kind === "z") { this.mineCount = Math.min(5, this.mineCount + 3); this.announce("MINE PACK  (+3)", "#c9333f"); SFX.key(); special = true; }
        if (took) {
          if (!special) SFX.pickup();
          this.pickFlash = Math.max(this.pickFlash, 0.5); this.itemsGot++; this.score += 25;
          this.L.items.splice(i, 1);
        }
      }
    }

    // barrels queued to blow (chain reactions)
    for (let i = this.boomQueue.length - 1; i >= 0; i--) {
      this.boomQueue[i].t -= dt;
      if (this.boomQueue[i].t <= 0) { this.explodeBarrel(this.boomQueue[i].b); this.boomQueue.splice(i, 1); }
    }

    // solo grace → then the map wakes up
    if (this.chaosT > 0) {
      this.chaosT -= dt;
      if (this.chaosT <= 0 && !this.chaosSaid) {
        this.chaosSaid = true;
        this.announce("THE HORDE STIRS", "#ff8a50");
        SFX.roar(); this.shake = 0.35;
        for (let i = 0; i < this.L.enemies.length; i++) this.L.enemies[i].asleep = false;
      }
    }

    // enemies
    const dmgMul = (1 + this.levelIdx * 0.14) * DIFF_MUL[diff];
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      if (e.state === "pain") { e.painT -= dt; if (e.painT <= 0) e.state = "chase"; continue; }
      const ex = this.px - e.x, ey = this.py - e.y;
      const dist = Math.hypot(ex, ey);
      // wraiths phase through walls, so they always "see" you within range
      const sees = e.cfg.ghost ? (dist < 12) : (dist < 10 && this.los(e.x, e.y, this.px, this.py));
      if (e.cfg.ghost) e.blink = (e.blink + dt) % 1e6;
      if (e.asleep) {
        if (this.chaosT > 0 && dist > 2.2) continue;
        e.asleep = false;
      }
      // egg: idle until damaged or player within 2.5, then hatch after 0.5s
      if (e.type === "egg") {
        if (e.state === "idle" && dist < 2.5 && !e.hatching) { e.hatching = true; e.hatchT = 0.5; }
        if (e.hatching) {
          e.hatchT -= dt;
          if (e.hatchT <= 0) { this.damageEnemy(e, e.hp + 1); } // force death = hatch
        }
        continue;
      }
      if (e.state === "idle") {
        if (sees) {
          e.state = "chase";
          if (e.cfg.boss && !e.roared) { e.roared = true; this.announce("THE CINDER KING AWAKENS", "#ff5d52"); SFX.roar(); this.shake = 0.6; }
          if (e.cfg.miniboss && !e.roared) { e.roared = true; this.announce(e.cfg.title + " AWAKENS!", "#ff8a50"); SFX.roar(); this.shake = 0.45; }
        } else continue;
      }
      e.animT += dt * 5;
      e.atkT = Math.max(0, e.atkT - dt);

      // arachnid blink: teleport ~1.5 tiles toward player every 2.5s when chasing at distance
      if (e.type === "arachnid" && e.state === "chase") {
        e.blinkT = (e.blinkT || 0) + dt;
        if (e.blinkT >= 2.5 && dist > 2) {
          e.blinkT = 0;
          const bstep = 1.5;
          const nx = e.x + (ex / dist) * bstep;
          const ny = e.y + (ey / dist) * bstep;
          if (!this.solidAt(nx, ny)) { e.x = nx; e.y = ny; }
        }
      }

      // BOSS enrage: below 40% HP it speeds up, fires faster with a wider spread
      let spMul = 1, rngCd = 1, rngSpread = 0;
      if (e.cfg.boss) {
        if (!e.enraged && e.hp <= e.cfg.hp * 0.4) {
          e.enraged = true;
          this.say("THE CINDER KING ENRAGES!", 2); SFX.roar(); this.shake = 0.7;
        }
        if (e.enraged) { spMul = 1.6; rngCd = 0.55; rngSpread = 2; }
      }

      const rng = e.cfg.ranged;
      if (rng && sees && dist > e.cfg.mrange && dist < 9) {
        // hold distance & cast fireballs
        if (dist > rng.hold) this.stepEnemy(e, (ex / dist) * spMul, (ey / dist) * spMul, dt);
        if (e.atkT <= 0) {
          e.atkT = rng.cd * rngCd;
          e.state = "attack";
          SFX.fireball();
          const n = (rng.spread || 1) + rngSpread;
          for (let f = 0; f < n; f++) {
            const spread = n > 1 ? (f - (n - 1) / 2) * 0.22 : 0;
            const a = Math.atan2(ey, ex) + spread;
            this.projs.push({ x: e.x + Math.cos(a) * 0.45, y: e.y + Math.sin(a) * 0.45,
                              vx: Math.cos(a) * rng.speed, vy: Math.sin(a) * rng.speed,
                              player: false, dmg: (rng.dmg[0] + Math.random() * (rng.dmg[1] - rng.dmg[0])) * dmgMul });
          }
        } else if (e.state === "attack" && e.atkT < rng.cd - 0.35) e.state = "chase";
      } else if (dist > e.cfg.mrange && sees) {
        e.state = "chase";
        this.stepEnemy(e, (ex / dist) * spMul, (ey / dist) * spMul, dt);
      } else if (dist <= e.cfg.mrange) {
        e.state = "attack";
        if (e.atkT <= 0) {
          e.atkT = 1.0;
          this.hurtPlayer(((e.cfg.mdmg[0] + Math.random() * (e.cfg.mdmg[1] - e.cfg.mdmg[0])) * dmgMul) | 0);
        }
      }
    }

    // projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (this.solidAt(p.x, p.y)) {
        if (p.bfg)    this.bfgBlast(p.x, p.y, p.dmg * 0.85, p.splash || 2.5);
        else if (p.rocket) this.rocketBlast(p.x, p.y, p.dmg, p.splash || 2.2);
        else this.spawnParts(p.x, p.y, 4, p.player ? "#8ad8ff" : "#ff8a50", 1.2);
        // rocket can damage breakable wall it hit
        if (p.rocket) {
          const bwx = (p.x) | 0, bwy = (p.y) | 0;
          const bwk = bwy * 1000 + bwx;
          if (this.L.breakables[bwk]) this.damageBreakable(bwk);
        }
        this.projs.splice(i, 1); continue;
      }
      if (p.player) {
        let hit = false;
        const targets = this.hitscanTargets();
        for (let t = 0; t < targets.length; t++) {
          const tg = targets[t];
          const hitR = tg.r + (p.bfg ? 0.35 : 0.12);
          if (Math.hypot(tg.x - p.x, tg.y - p.y) < hitR) {
            if (p.bfg)    this.bfgBlast(p.x, p.y, p.dmg, p.splash || 2.5);
            else if (p.rocket) this.rocketBlast(p.x, p.y, p.dmg, p.splash || 2.2);
            else if (tg.e) { this._allyDmg = !!p.ally; this.damageEnemy(tg.e, p.dmg); this._allyDmg = false; }
            else { tg.b.hp = 0; this.explodeBarrel(tg.b); }
            hit = true; break;
          }
        }
        if (hit) {
          if (!p.bfg && !p.rocket) this.spawnParts(p.x, p.y, 5, "#8ad8ff", 1.4);
          this.projs.splice(i, 1);
        }
      } else if (Math.hypot(this.px - p.x, this.py - p.y) < 0.38) {
        this.hurtPlayer(p.dmg | 0);
        this.projs.splice(i, 1);
      }
    }

    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
    }

    // exit (needs keycard)
    const tx = this.px | 0, ty = this.py | 0;
    const near = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = 0; i < 4; i++) {
      if (this.wallAt(tx + near[i][0], ty + near[i][1]) === 5) {
        if (this.keycards.red) { this.finishLevel(); }
        else if (this.msgT <= 0) { this.say("THE EXIT NEEDS THE RED KEYCARD", 1.6); SFX.nokey(); }
        break;
      }
    }
  };
  Game.prototype.stepEnemy = function (e, ux, uy, dt) {
    const s = e.cfg.sp * dt, R = 0.3;
    const nx = e.x + ux * s, ny = e.y + uy * s;
    // wraiths phase through walls; everyone else opens doors by bumping them
    if (e.cfg.ghost) { e.x = nx; e.y = ny; return; }
    this.bumpDoors(nx, e.y, false); this.bumpDoors(e.x, ny, false);
    if (!this.solidAt(nx + (nx > e.x ? R : -R), e.y)) e.x = nx;
    if (!this.solidAt(e.x, ny + (ny > e.y ? R : -R))) e.y = ny;
  };

  // ---- sticky mines ----
  Game.prototype.dropMine = function () {
    if (this.mineCount <= 0) { this.say("NO MINES — FIND A MINE PACK", 1.0); SFX.empty(); return; }
    if (this.mines.length >= 5) { this.say("MINE LIMIT REACHED (5)", 1.0); return; }
    this.mineCount--;
    this.mines.push({ x: this.px, y: this.py, arm: 0.6, life: 8, blink: 0 });
    SFX.switch(); this.say("MINE DEPLOYED", 0.8);
    this.spawnParts(this.px, this.py, 4, "#c9333f", 0.8);
  };
  Game.prototype.explodeMine = function (m) {
    const R = 2.0, dmg = 70;
    this.spawnParts(m.x, m.y, 26, "#ff8a50", 3.2);
    this.spawnParts(m.x, m.y, 14, "#ffd75e", 2.2);
    this.shake = Math.max(this.shake, 0.4); SFX.boom();
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d < R) this.damageEnemy(e, dmg * (1 - d / R));
    }
    const pd = Math.hypot(this.px - m.x, this.py - m.y);
    if (pd < R * 0.7) this.hurtPlayer(((dmg * 0.35) * (1 - pd / (R * 0.7))) | 0);
    for (let i = 0; i < this.L.barrels.length; i++) {
      const b = this.L.barrels[i];
      if (!b.dead && Math.hypot(b.x - m.x, b.y - m.y) < R) { b.hp = 0; this.explodeBarrel(b); }
    }
  };
  Game.prototype.updateMines = function (dt) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.blink += dt;
      if (m.arm > 0) { m.arm -= dt; continue; }
      m.life -= dt;
      let boom = m.life <= 0;
      if (!boom) {
        for (let j = 0; j < this.L.enemies.length; j++) {
          const e = this.L.enemies[j];
          if (e.state !== "dead" && Math.hypot(e.x - m.x, e.y - m.y) < 1.2) { boom = true; break; }
        }
      }
      if (boom) { this.explodeMine(m); this.mines.splice(i, 1); }
    }
  };

  // ---- co-op ghost ally (wraith) ----
  Game.prototype.updateAlly = function (dt) {
    const al = this.ally; if (!al) return;
    al.animT += dt * 3;
    // follow the player, keeping a small standoff distance
    const fx = this.px - al.x, fy = this.py - al.y, fd = Math.hypot(fx, fy) || 1;
    if (fd > 1.4) { const s = 3.4 * dt; al.x += (fx / fd) * s; al.y += (fy / fd) * s; }
    // auto-fire weak plasma at the nearest visible enemy every 1.2s
    al.cd = Math.max(0, al.cd - dt);
    if (al.cd <= 0) {
      let best = null, bd = 9;
      for (let i = 0; i < this.L.enemies.length; i++) {
        const e = this.L.enemies[i];
        if (e.state === "dead" || e.asleep) continue;
        const d = Math.hypot(e.x - al.x, e.y - al.y);
        if (d < bd && this.los(al.x, al.y, e.x, e.y)) { best = e; bd = d; }
      }
      if (best) {
        al.cd = 1.2;
        const a = Math.atan2(best.y - al.y, best.x - al.x);
        this.projs.push({ x: al.x + Math.cos(a) * 0.4, y: al.y + Math.sin(a) * 0.4,
                          vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, player: true, ally: true, dmg: 12 });
      }
    }
  };

  // ---- crushers ----
  Game.prototype.updateCrushers = function (dt) {
    if (!this.L.crushers || !this.L.crushers.length) return;
    for (let i = 0; i < this.L.crushers.length; i++) {
      const c = this.L.crushers[i];
      c.phase = (c.phase + dt) % 2.5;          // ~2.5s cycle
      const slam = c.phase < 0.4;              // ~0.4s danger window
      c.drop = slam ? (1 - c.phase / 0.4) : Math.max(0, c.drop - dt * 3);
      if (slam && !c.hit && (this.px | 0) === c.cx && (this.py | 0) === c.cy) {
        c.hit = true;
        this.hurtPlayer((25 * DIFF_MUL[diff]) | 0);
        this.shake = Math.max(this.shake, 0.5); SFX.boom();
        this.spawnParts(c.x, c.y, 10, "#888", 2.0);
      }
      if (!slam) c.hit = false;
      // warn when standing under a crusher that is about to slam
      if (!slam && c.phase > 2.1 && (this.px | 0) === c.cx && (this.py | 0) === c.cy && this.msgT <= 0) {
        this.say("CRUSHER — MOVE!", 0.6);
      }
    }
  };

  // ---- lifts (paired teleport pads with a black flash) ----
  Game.prototype.updateLifts = function (dt) {
    if (!this.L.lifts || !this.L.lifts.length || this.teleCd > 0) return;
    for (let i = 0; i < this.L.lifts.length; i++) {
      const lf = this.L.lifts[i];
      if (!lf.dest) continue;
      if (Math.abs(this.px - lf.x) < 0.5 && Math.abs(this.py - lf.y) < 0.5) {
        this.px = lf.dest.x + 0.5; this.py = lf.dest.y + 0.5;
        this.teleCd = 1.0; this.liftFlash = 0.45;
        SFX.teleport(); this.announce("LIFT", "#8ad8ff");
        break;
      }
    }
  };

  // ---- level completion / grade / unlocks ----
  Game.prototype.finishLevel = function () {
    this.mode = "inter";
    // persist ghost replay if this run was faster
    if (this.ghost.length > 2) saveGhost(this.levelIdx, { time: this.time, pts: this.ghost.slice() });
    const grade = this.computeGrade();
    // unlock: A/S beating a level grants bonus starting shells + best-grade record
    const u = this.unlocks;
    if (GRADE_RANK[grade] > GRADE_RANK[u.bestGrade]) u.bestGrade = grade;
    if (grade === "A" || grade === "S") u.shellsBonus = Math.max(u.shellsBonus, 5);
    u.runs = (u.runs || 0) + 1;
    saveUnlocks(u);
    this.announce("LEVEL CLEARED  ·  GRADE " + grade, grade === "S" ? "#ffd75e" : "#88ff88");
  };
  Game.prototype.computeGrade = function () {
    const killPct = this.kills / Math.max(1, this.L.totKills);
    const secPct = this.secretsFound / Math.max(1, this.L.totSecrets || 1);
    const timePct = this.time / Math.max(1, this.L.par);
    // blended score: kills 55%, secrets 20%, time 25%
    const s = killPct * 0.55 + secPct * 0.20 + (timePct <= 1 ? 0.25 : Math.max(0, 0.25 - (timePct - 1) * 0.18));
    if (s >= 0.92 && killPct >= 0.9 && timePct <= 1.15) return "S";
    if (s >= 0.75) return "A";
    if (s >= 0.55) return "B";
    return "C";
  };

  // ---- ending cinematic ----
  Game.prototype.startCinematic = function () {
    this.mode = "cine"; this.cineT = 0; this.cineStart = performance.now();
    if (this.score > this.hi) { this.hi = this.score; try { localStorage.setItem("rvdw-inferno-hi", String(this.hi)); } catch (e) {} }
    // full campaign clear unlocks the gold pistol skin
    const u = this.unlocks; u.pistolSkin = true; saveUnlocks(u);
    SFX.roar();
  };
  Game.prototype.endCinematic = function () { this.doWin(); };

  // ============================ RENDER ============================
  Game.prototype.render = function () {
    const g = this.ctx;
    if (this.mode === "title") { this.renderTitle(g); return; }
    if (this.mode === "editor") { this.renderEditor(g); return; }
    if (this.mode === "cine") { this.renderCinematic(g); return; }

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 7 * SCALE : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 5 * SCALE : 0;
    const pad = 8 * SCALE;
    g.save();
    g.translate(shakeX | 0, shakeY | 0);

    // perspective-textured floor & ceiling (true Doom-style floor casting)
    this.renderFloorCast(g);

    // walls
    const L = this.L;
    for (let x = 0; x < W; x++) {
      const cam = 2 * x / W - 1;
      const rdx = this.dx + this.plx * cam;
      const rdy = this.dy + this.ply * cam;
      let mapX = this.px | 0, mapY = this.py | 0;
      const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
      let stepX, stepY, sdx, sdy;
      if (rdx < 0) { stepX = -1; sdx = (this.px - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - this.px) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (this.py - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - this.py) * ddy; }
      let hit = 0, side = 0, guard = 0;
      while (!hit && guard++ < 96) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        if (mapY < 0 || mapY >= L.h || mapX < 0 || mapX >= L.w) { hit = 1; break; }
        const v = L.map[mapY][mapX];
        if (v > 0) {
          if (v === 6 || v === 7 || v === 8 || v === 10 || v === 11) {
            const dr = L.doors[mapY * 1000 + mapX];
            const o = dr ? dr.open : 0;
            const pd = side === 0 ? (mapX - this.px + (1 - stepX) / 2) / (rdx || 1e-9)
                                  : (mapY - this.py + (1 - stepY) / 2) / (rdy || 1e-9);
            let wx = side === 0 ? this.py + pd * rdy : this.px + pd * rdx; wx -= wx | 0;
            const pan = 0.5 * (1 - o);
            if (wx > pan && wx < 1 - pan) continue;
            hit = v === 8 ? 1 : v; // secrets look like brick until open
          } else hit = v;
        }
      }
      const dist = side === 0 ? (mapX - this.px + (1 - stepX) / 2) / (rdx || 1e-9)
                              : (mapY - this.py + (1 - stepY) / 2) / (rdy || 1e-9);
      const d = Math.max(0.04, dist);
      this.zbuf[x] = d;
      const lh = (VIEW_H / d) | 0;
      const drawY = (VIEW_H - lh) / 2;
      let wallX = side === 0 ? this.py + d * rdy : this.px + d * rdx;
      wallX -= wallX | 0;
      let texX = (wallX * TEX) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = TEX - texX - 1;
      const texSet = side === 1 ? this.tex.dark : this.tex.light;
      const t = texSet[hit] || texSet[1];
      g.drawImage(t, texX, 0, 1, TEX, x, drawY, 1, lh);
      if (d > 3.4) {
        g.fillStyle = "rgba(6,7,12," + Math.min(0.72, (d - 3.4) * 0.13).toFixed(2) + ")";
        g.fillRect(x, Math.max(0, drawY | 0), 1, Math.min(lh, VIEW_H));
      }
    }

    // telepad glow on floor (simple overlay circles in screen-space)
    if (this.L.telepads && this.L.telepads.length > 0) {
      const invD2 = 1 / (this.plx * this.dy - this.dx * this.ply);
      for (let ti = 0; ti < this.L.telepads.length; ti++) {
        const tp = this.L.telepads[ti];
        const trx = tp.x - this.px, trry = tp.y - this.py;
        const trX2 = invD2 * (this.dy * trx - this.dx * trry);
        const trY2 = invD2 * (-this.ply * trx + this.plx * trry);
        if (trY2 <= 0.1) continue;
        const tpsx = (W / 2) * (1 + trX2 / trY2);
        if (tpsx < 0 || tpsx >= W) continue;
        const tpSize = Math.max(4, (VIEW_H * 0.18) / trY2);
        const tpPulse = 0.5 + 0.5 * Math.sin(this.time * 4 + ti);
        g.globalAlpha = 0.25 + tpPulse * 0.2;
        g.fillStyle = tp.kind === "@" ? "#cc88ff" : "#88ccff";
        g.beginPath(); g.arc(tpsx, VIEW_H - tpSize * 0.3, tpSize, 0, 7); g.fill();
        g.globalAlpha = 1;
      }
    }
    // lift-pad glow (green/cyan pads)
    if (this.L.lifts && this.L.lifts.length > 0) {
      const invD2 = 1 / (this.plx * this.dy - this.dx * this.ply);
      for (let ti = 0; ti < this.L.lifts.length; ti++) {
        const lf = this.L.lifts[ti];
        const trx = lf.x - this.px, trry = lf.y - this.py;
        const trX2 = invD2 * (this.dy * trx - this.dx * trry);
        const trY2 = invD2 * (-this.ply * trx + this.plx * trry);
        if (trY2 <= 0.1) continue;
        const lsx = (W / 2) * (1 + trX2 / trY2);
        if (lsx < 0 || lsx >= W) continue;
        const lSize = Math.max(4, (VIEW_H * 0.18) / trY2);
        const lPulse = 0.5 + 0.5 * Math.sin(this.time * 5 + ti);
        g.globalAlpha = 0.28 + lPulse * 0.22;
        g.fillStyle = lf.kind === "<" ? "#63d97a" : "#5aa0e8";
        g.beginPath(); g.arc(lsx, VIEW_H - lSize * 0.3, lSize, 0, 7); g.fill();
        g.globalAlpha = 1;
      }
    }

    // ---- billboards (enemies, barrels, items) far→near ----
    const spr = [];
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i];
      spr.push({ x: e.x, y: e.y, e: e, d: dist2(e.x - this.px, e.y - this.py) });
    }
    for (let i = 0; i < L.barrels.length; i++) {
      const b = L.barrels[i];
      if (!b.dead) spr.push({ x: b.x, y: b.y, barrel: true, d: dist2(b.x - this.px, b.y - this.py) });
    }
    for (let i = 0; i < (L.props || []).length; i++) {
      const p = L.props[i];
      spr.push({ x: p.x, y: p.y, prop: p.kind, d: dist2(p.x - this.px, p.y - this.py) });
    }
    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      spr.push({ x: it.x, y: it.y, kind: it.kind, d: dist2(it.x - this.px, it.y - this.py) });
    }
    for (let i = 0; i < this.mines.length; i++) {
      const m = this.mines[i];
      spr.push({ x: m.x, y: m.y, mine: m, d: dist2(m.x - this.px, m.y - this.py) });
    }
    if (this.ally) spr.push({ x: this.ally.x, y: this.ally.y, ally: this.ally, d: dist2(this.ally.x - this.px, this.ally.y - this.py) });
    spr.sort(function (a, b) { return b.d - a.d; });

    const invDet = 1 / (this.plx * this.dy - this.dx * this.ply);
    for (let s = 0; s < spr.length; s++) {
      const sp = spr[s];
      const rx = sp.x - this.px, ry = sp.y - this.py;
      const trX = invDet * (this.dy * rx - this.dx * ry);
      const trY = invDet * (-this.ply * rx + this.plx * ry);
      if (trY <= 0.1) continue;
      const sx = ((W / 2) * (1 + trX / trY)) | 0;
      let size = Math.abs((VIEW_H / trY) | 0);
      let img, yOff = 0, alpha = 1;
      if (sp.e) {
        const e = sp.e;
        const frames = this.sprites[e.type];
        img = e.state === "dead" ? frames[4]
            : e.state === "pain" ? frames[3]
            : e.state === "attack" ? frames[2]
            : frames[(e.animT | 0) % 2];
        size = (size * e.cfg.scale) | 0;
        yOff = e.cfg.scale > 1 ? -(size * (e.cfg.scale - 1) * 0.18) : 0;
        if (e.cfg.ghost && e.state !== "dead") {
          alpha = 0.5 + 0.22 * Math.sin(e.blink * 6);       // spectral shimmer
          yOff -= size * (0.06 + 0.04 * Math.sin(e.blink * 3)); // float
        }
      } else if (sp.ally) {
        // co-op wraith ally: translucent cyan billboard
        const fr = this.sprites.wraith;
        img = fr[(sp.ally.animT | 0) % 2];
        size = (size * 0.9) | 0;
        alpha = 0.5 + 0.15 * Math.sin(sp.ally.animT * 2);
        yOff = -size * 0.08;
      } else if (sp.mine) {
        img = this.items.mineFloor;
        size = (size * 0.45) | 0;
        yOff = size * 0.55;
        if (sp.mine.arm <= 0 && Math.sin(sp.mine.blink * 10) > 0) alpha = 0.6; // armed blink
      } else if (sp.barrel) {
        img = this.items.B;
        size = (size * 0.8) | 0;
        yOff = size * 0.12;
      } else if (sp.prop) {
        img = this.items[sp.prop];
        if (!img) continue;
        const sc = sp.prop === "t" ? 1.15 : sp.prop === "f" ? 0.85 : 0.9;
        size = (size * sc) | 0;
        yOff = size * (sp.prop === "t" ? 0.05 : 0.14);
      } else {
        img = this.items[sp.kind];
        if (!img) continue;
        size = (size * 0.72) | 0;
        yOff = size * 0.18;
      }
      const y0 = ((VIEW_H - size) / 2 + yOff) | 0;
      const x0 = sx - (size >> 1);
      const colW = Math.max(1, (size / 48) | 0); // finer strips = cleaner wall clipping
      if (alpha < 1) g.globalAlpha = alpha;
      for (let cx = Math.max(0, x0); cx < Math.min(W, x0 + size); cx += colW) {
        if (this.zbuf[cx] <= trY) continue;
        const u = ((cx - x0) / size) * TEX;
        g.drawImage(img, u, 0, Math.max(1, (colW / size) * TEX), TEX, cx, y0, colW, size);
      }
      if (alpha < 1) g.globalAlpha = 1;
    }

    // ---- projectiles (glowing orbs) ----
    for (let i = 0; i < this.projs.length; i++) {
      const p = this.projs[i];
      const rx = p.x - this.px, ry = p.y - this.py;
      const trX = invDet * (this.dy * rx - this.dx * ry);
      const trY = invDet * (-this.ply * rx + this.plx * ry);
      if (trY <= 0.1) continue;
      const sx = (W / 2) * (1 + trX / trY);
      if (sx < 0 || sx >= W || this.zbuf[sx | 0] <= trY) continue;
      const scale = p.bfg ? 0.09 : 0.041;
      const r = Math.max(2, (VIEW_H * scale) / trY);
      if (p.bfg) {
        g.fillStyle = "rgba(125,255,154,0.28)";
        g.beginPath(); g.arc(sx, VIEW_H / 2, r * 2.4, 0, 7); g.fill();
        g.fillStyle = "#7dff9a";
        g.beginPath(); g.arc(sx, VIEW_H / 2, r * 1.35, 0, 7); g.fill();
        g.fillStyle = "#d5ffe0";
        g.beginPath(); g.arc(sx, VIEW_H / 2, r * 0.55, 0, 7); g.fill();
      } else {
        g.fillStyle = p.player ? "rgba(138,216,255,0.35)" : "rgba(255,138,80,0.35)";
        g.beginPath(); g.arc(sx, VIEW_H / 2, r * 1.8, 0, 7); g.fill();
        g.fillStyle = p.player ? "#d5f4ff" : "#ffd07a";
        g.beginPath(); g.arc(sx, VIEW_H / 2, r, 0, 7); g.fill();
      }
    }

    // ---- particles ----
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      const rx = p.x - this.px, ry = p.y - this.py;
      const trX = invDet * (this.dy * rx - this.dx * ry);
      const trY = invDet * (-this.ply * rx + this.plx * ry);
      if (trY <= 0.1) continue;
      const sx = (W / 2) * (1 + trX / trY);
      if (sx < 0 || sx >= W || this.zbuf[sx | 0] <= trY) continue;
      const r = Math.max(1, (p.sz * VIEW_H) / trY);
      g.globalAlpha = 1 - p.life / p.max;
      g.fillStyle = p.color;
      g.fillRect(sx - r / 2, VIEW_H / 2 - r / 2 + (p.life / p.max) * (VIEW_H * 0.08) / trY, r, r);
      g.globalAlpha = 1;
    }

    // ---- ghost replay (translucent green marker retracing the best run) ----
    if (this.ghostBest && this.ghostBest.pts) {
      const pts = this.ghostBest.pts;
      // index advances with the current run time so the ghost "races" you
      const gi = (Math.min(this.time, this.ghostBest.time) / 0.1 | 0) * 2;
      if (gi + 1 < pts.length) {
        const gx0 = pts[gi], gy0 = pts[gi + 1];
        const rx = gx0 - this.px, ry = gy0 - this.py;
        const trX = invDet * (this.dy * rx - this.dx * ry);
        const trY = invDet * (-this.ply * rx + this.plx * ry);
        if (trY > 0.1) {
          const sx = (W / 2) * (1 + trX / trY);
          if (sx >= 0 && sx < W && this.zbuf[sx | 0] > trY) {
            const gh = Math.abs((VIEW_H / trY) | 0) * 0.8;
            g.globalAlpha = 0.35;
            g.fillStyle = "#63d97a";
            g.fillRect(sx - gh * 0.18, (VIEW_H - gh) / 2 + gh * 0.1, gh * 0.36, gh * 0.8);
            g.beginPath(); g.arc(sx, (VIEW_H - gh) / 2 + gh * 0.05, gh * 0.16, 0, 7); g.fill();
            g.globalAlpha = 1;
          }
        }
      }
    }

    // ---- crusher slam overlay (dark ceiling bar drops when a near crusher fires)
    if (this.L.crushers && this.L.crushers.length) {
      let maxDrop = 0;
      for (let i = 0; i < this.L.crushers.length; i++) {
        const c = this.L.crushers[i];
        if (c.drop > 0 && Math.hypot(c.x - this.px, c.y - this.py) < 3) maxDrop = Math.max(maxDrop, c.drop);
      }
      if (maxDrop > 0) {
        g.fillStyle = "rgba(10,8,8," + (0.5 * maxDrop).toFixed(2) + ")";
        g.fillRect(0, 0, W, (VIEW_H * 0.5 * maxDrop) | 0);
      }
    }

    // muzzle light — briefly warms the whole scene when firing
    if (this.muzzle > 0) {
      g.globalAlpha = Math.min(1, this.muzzle * 9);
      const mr = VIEW_H * 0.9;
      g.drawImage(MUZZ_GLOW, W / 2 - mr, VIEW_H * 0.75 - mr, mr * 2, mr * 2);
      g.globalAlpha = 1;
    }

    this.renderGun(g);
    g.restore(); // shake

    // vignette (cached gradient — one fill)
    g.fillStyle = this.vig; g.fillRect(0, 0, W, VIEW_H);

    // flashes + berserk vignette
    if (this.dmgFlash > 0) { g.fillStyle = "rgba(200,30,30," + (this.dmgFlash * 0.4).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }
    if (this.pickFlash > 0) { g.fillStyle = "rgba(255,240,180," + (this.pickFlash * 0.22).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }
    if (this.berserkT > 0) { g.fillStyle = "rgba(160,0,0," + Math.min(0.22, this.berserkT * 0.025).toFixed(3) + ")"; g.fillRect(0, 0, W, VIEW_H); }
    if (this.liftFlash > 0) { g.fillStyle = "rgba(0,0,0," + Math.min(1, this.liftFlash * 2).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }

    // weather screen-space particles (theme-based)
    const theme = this.L && this.L.theme;
    if (theme === "swamp" || theme === "foundry" || theme === "throne") {
      const wt = this.time;
      const wCount = 18;
      for (let wi = 0; wi < wCount; wi++) {
        const wx = ((wi * 97 + Math.sin(wt * 0.7 + wi) * 14) % W + W) % W;
        const wy = (W - ((wt * (6 + wi % 5) + wi * 43) % VIEW_H + VIEW_H)) % VIEW_H;
        if (theme === "swamp")   { g.fillStyle = "rgba(80,160,60,0.45)"; g.fillRect(wx, wy, 2, 3); }
        else if (theme === "foundry") { g.fillStyle = "rgba(255,120,40,0.50)"; g.fillRect(wx, wy, 2, 2); }
        else                    { g.fillStyle = "rgba(180,180,180,0.30)"; g.fillRect(wx, wy, 2, 4); }
      }
    }

    // crosshair (chrome space)
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(BW / 2 - 1, VIEW_B / 2 - 5, 2, 3); g.fillRect(BW / 2 - 1, VIEW_B / 2 + 2, 2, 3);
    g.fillRect(BW / 2 - 5, VIEW_B / 2 - 1, 3, 2); g.fillRect(BW / 2 + 2, VIEW_B / 2 - 1, 3, 2);
    g.restore();

    if (this.showMap) this.renderMap(g);
    this.renderBossBar(g);
    this.renderStatusStrip(g);
    this.renderHUD(g);

    // message
    if (this.msgT > 0 && this.msg) {
      g.save(); g.scale(SCALE, SCALE);
      g.font = "bold 10px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 12, BW, 16);
      g.fillStyle = "#ffd75e"; g.fillText(this.msg, BW / 2, 20);
      g.restore();
    }

    // big centered announcer text (fades + pops) — dark plate so it stays readable
    if (this.bigT > 0 && this.bigMsg) {
      g.save(); g.scale(SCALE, SCALE);
      const a = Math.min(1, this.bigT / 0.55);
      const pop = this.bigT > 1.9 ? (2.2 - this.bigT) / 0.3 : 1;
      const fs = 15 + pop * 3;
      g.globalAlpha = a;
      g.font = "bold " + fs.toFixed(0) + "px monospace";
      g.textAlign = "center"; g.textBaseline = "middle";
      const tw = Math.min(BW - 16, g.measureText(this.bigMsg).width + 24);
      g.fillStyle = "rgba(4,6,14,0.82)";
      g.fillRect((BW - tw) / 2, 46, tw, 22);
      g.strokeStyle = "rgba(255,215,94,0.35)"; g.lineWidth = 1;
      g.strokeRect((BW - tw) / 2 + 0.5, 46.5, tw - 1, 21);
      g.fillStyle = "#000"; g.fillText(this.bigMsg, BW / 2 + 1, 58);
      g.fillStyle = this.bigColor || "#ffd75e"; g.fillText(this.bigMsg, BW / 2, 57);
      g.globalAlpha = 1;
      g.restore();
    }

    // overlays
    if (this.mode === "pause") this.renderOverlay(g, "PAUSED", "#8ad8ff", "P or SPACE to resume");
    if (this.mode === "dead")  this.renderOverlay(g, "YOU DIED", "#ff5d52", "R or SPACE to retry  ·  score " + this.score);
    if (this.mode === "inter") this.renderTally(g, "LEVEL CLEARED!", this.levelIdx + 1 < LEVELS.length ? "SPACE for next level" : "SPACE to finish");
    if (this.mode === "win")   this.renderWin(g);
  };

  function dist2(a, b) { return a * a + b * b; }

  Game.prototype.renderGun = function (g) {
    g.save(); g.scale(SCALE, SCALE);
    const w = WEAPONS[this.cur];
    const bobX = Math.sin(this.bob) * 4, bobY = Math.abs(Math.cos(this.bob)) * 3;
    const kick = this.fireCd > w.rate - 0.12 ? w.kick : 0;
    // Classic Doom placement: low in the frame, never a full-screen pillar
    const gx = BW / 2 + bobX;
    const gy = VIEW_B - 8 + bobY + kick;

    if (this.muzzle > 0) {
      const fx = gx + (this.cur === 0 ? 2 : this.cur === 5 ? 22 : 0);
      const fy = gy - (this.cur === 0 ? 38 : this.cur === 1 ? 42 : this.cur === 2 ? 40 : this.cur === 3 ? 46 : this.cur === 4 ? 28 : 20);
      const mColor = w.bfg ? "rgba(125,255,154,0.95)" : w.rocket ? "rgba(255,120,60,0.95)" : w.melee ? "rgba(80,200,60,0.85)" : w.proj ? "rgba(150,230,255,0.9)" : "rgba(255,230,140,0.95)";
      g.fillStyle = mColor;
      g.beginPath(); g.arc(fx, fy, 7 + Math.random() * 5, 0, 7); g.fill();
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(fx, fy, 3, 0, 7); g.fill();
    }

    // sleeves + hands
    g.fillStyle = "#2a2030";
    g.fillRect(gx - 36, gy - 4, 22, 18);
    g.fillRect(gx + 14, gy - 2, 22, 16);
    g.fillStyle = "#c4a882";
    g.fillRect(gx - 32, gy - 2, 14, 12);
    g.fillRect(gx + 18, gy, 14, 10);
    g.fillStyle = "#a88860";
    g.fillRect(gx - 32, gy - 2, 14, 2);
    g.fillRect(gx + 18, gy, 14, 2);

    if (this.cur === 0) {
      // PISTOL (gold skin when the campaign has been beaten)
      const gold = this.unlocks && this.unlocks.pistolSkin;
      g.fillStyle = gold ? "#8a6b2a" : "#1a1e28"; g.fillRect(gx - 4, gy - 36, 10, 28);
      g.fillStyle = gold ? "#c9a24a" : "#3a4254"; g.fillRect(gx - 5, gy - 34, 12, 8);
      g.fillStyle = gold ? "#5e4718" : "#12141c"; g.fillRect(gx - 2, gy - 36, 6, 5);
      g.fillStyle = gold ? "#a8842e" : "#2a2f3d"; g.fillRect(gx - 6, gy - 12, 14, 16);
      g.fillStyle = "#5e3a1e"; g.fillRect(gx - 5, gy + 2, 10, 14);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 6, gy - 12, 14, 2);
      g.fillStyle = gold ? "#ffe8a0" : "#8a9ab0"; g.fillRect(gx + 4, gy - 8, 3, 6);
    } else if (this.cur === 1) {
      // SHOTGUN — twin barrels + wood stock
      g.fillStyle = "#1a1c22"; g.fillRect(gx - 14, gy - 40, 10, 34);
      g.fillStyle = "#22262e"; g.fillRect(gx + 2, gy - 40, 10, 34);
      g.fillStyle = "#0c0e12"; g.fillRect(gx - 12, gy - 40, 6, 4); g.fillRect(gx + 4, gy - 40, 6, 4);
      g.fillStyle = "#3a4254"; g.fillRect(gx - 16, gy - 10, 30, 12);
      g.fillStyle = "#6b4420"; g.fillRect(gx - 18, gy, 34, 14);
      g.fillStyle = "#8a5a28"; g.fillRect(gx - 10, gy + 4, 18, 8);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 16, gy - 10, 30, 2);
      g.fillStyle = "#c4a882"; g.fillRect(gx - 8, gy - 6, 8, 6);
    } else if (this.cur === 2) {
      // PLASMA RIFLE
      g.fillStyle = "#142838"; g.fillRect(gx - 16, gy - 38, 32, 36);
      g.fillStyle = "#1c3a50"; g.fillRect(gx - 14, gy - 34, 28, 28);
      g.fillStyle = "#8ad8ff"; g.fillRect(gx - 10, gy - 30, 7, 24); g.fillRect(gx + 3, gy - 30, 7, 24);
      g.fillStyle = "#d5f4ff"; g.fillRect(gx - 4, gy - 40, 8, 6);
      g.fillStyle = "#4a90b8"; g.fillRect(gx - 8, gy - 8, 16, 10);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 16, gy - 2, 32, 2);
      g.fillStyle = "#0a1820"; g.fillRect(gx - 12, gy + 2, 24, 10);
    } else if (this.cur === 3) {
      // BFG
      g.fillStyle = "#0e2418"; g.fillRect(gx - 22, gy - 36, 44, 40);
      g.fillStyle = "#1a4030"; g.fillRect(gx - 18, gy - 30, 36, 30);
      g.fillStyle = "#2a6040"; g.fillRect(gx - 14, gy - 24, 28, 20);
      g.fillStyle = "#7dff9a"; g.fillRect(gx - 12, gy - 20, 10, 16); g.fillRect(gx + 2, gy - 20, 10, 16);
      g.fillStyle = "#d5ffe0";
      g.beginPath(); g.arc(gx, gy - 38, 11, 0, 7); g.fill();
      g.fillStyle = "#7dff9a";
      g.beginPath(); g.arc(gx, gy - 38, 6, 0, 7); g.fill();
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 22, gy + 2, 44, 3);
      g.fillStyle = "#14301c"; g.fillRect(gx - 10, gy + 4, 20, 10);
    } else if (this.cur === 4) {
      // CHAINSAW — green/grey saw with chain detail
      const buzz = this.fireCd > 0 ? Math.floor(this.time * 28) % 2 : 0;
      g.fillStyle = "#3a3a3a"; g.fillRect(gx - 22, gy - 22, 42, 14); // body
      g.fillStyle = "#555";    g.fillRect(gx - 22, gy - 20, 42, 8);  // body highlight
      // blade
      g.fillStyle = "#88cc44"; g.fillRect(gx + 18, gy - 32, 18, 22);
      g.fillStyle = "#aae066"; g.fillRect(gx + 20, gy - 30, 14, 6);
      // chain teeth along top (animated buzz when firing)
      g.fillStyle = "#cccc44";
      for (let ci = 0; ci < 5; ci++) {
        const tx = gx - 18 + ci * 9 + buzz;
        g.fillRect(tx, gy - 30, 5, 6);
      }
      g.fillStyle = "#666"; g.fillRect(gx - 24, gy - 10, 6, 18); // rear grip
      g.fillStyle = "#88cc44"; g.fillRect(gx + 34, gy - 28, 6, 8); // tip
      g.fillStyle = "#2a1808"; g.fillRect(gx - 16, gy - 8, 28, 14); // handle housing
    } else {
      // ROCKET LAUNCHER — orange/brown tube
      const fv = this.fireCd > w.rate - 0.25 ? 1 : 0;
      g.fillStyle = "#5a2810"; g.fillRect(gx - 24, gy - 28, 50, 16); // tube
      g.fillStyle = "#8a4820"; g.fillRect(gx - 22, gy - 26, 46, 10);
      g.fillStyle = "#ff7722"; // exhaust glow when firing
      if (fv) { g.globalAlpha = 0.7; g.beginPath(); g.arc(gx - 26, gy - 20, 8, 0, 7); g.fill(); g.globalAlpha = 1; }
      g.fillStyle = "#1a0c06"; g.fillRect(gx + 22, gy - 27, 5, 12); // barrel
      g.fillStyle = "#4a3020"; g.fillRect(gx - 16, gy - 12, 26, 16); // grip body
      g.fillStyle = "#6a4030"; g.fillRect(gx - 12, gy - 10, 18, 10);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 24, gy - 28, 50, 2);  // stripe
      g.fillStyle = "#ff7722"; g.fillRect(gx - 2, gy - 32, 6, 6);    // sight
    }
    g.restore();
  };

  Game.prototype.renderMap = function (g) {
    g.save(); g.scale(SCALE, SCALE); // chrome space
    const L = this.L, sc = Math.min(4, ((BW * 0.36) / L.w) | 0) || 3;
    const mw = L.w * sc, mh = L.h * sc, ox = BW - mw - 6, oy = 6;
    g.fillStyle = "rgba(4,5,11,0.78)"; g.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const v = L.map[y][x];
      if (!v) continue;
      g.fillStyle = v === 5 ? "#ffd75e"
                  : v === 7 ? "#ff6a5e"                    // red door
                  : v === 10 ? "#5aa0e8"                   // blue door
                  : v === 11 ? "#ffe14a"                   // yellow door
                  : v === 6 || v === 8 ? "rgba(138,216,255,0.7)"
                  : "rgba(150,175,230,0.5)";
      g.fillRect(ox + x * sc, oy + y * sc, sc, sc);
    }
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i];
      if (e.state === "dead") continue;
      g.fillStyle = e.cfg.boss ? "#ff5d52" : "#c9333f";
      g.fillRect(ox + e.x * sc - 1, oy + e.y * sc - 1, e.cfg.boss ? 4 : 2, e.cfg.boss ? 4 : 2);
    }
    for (let i = 0; i < (L.hazards || []).length; i++) {
      const hz = L.hazards[i];
      g.fillStyle = "#44aa22";
      g.fillRect(ox + hz.x * sc - 1, oy + hz.y * sc - 1, 2, 2);
    }
    for (let i = 0; i < (L.telepads || []).length; i++) {
      const tp = L.telepads[i];
      g.fillStyle = "#cc88ff";
      g.fillRect(ox + tp.x * sc - 1, oy + tp.y * sc - 1, 2, 2);
    }
    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      g.fillStyle = it.kind === "k" ? "#ffd75e" : it.kind === "Y" ? "#7dff9a" : it.kind === "n" ? "#88cc44" : it.kind === "m" ? "#ff7722" : it.kind === "v" ? "#4a9ad8" : "#8ad8ff";
      g.fillRect(ox + it.x * sc - 1, oy + it.y * sc - 1, 2, 2);
    }
    g.fillStyle = "#fff";
    g.fillRect(ox + this.px * sc - 1.5, oy + this.py * sc - 1.5, 3, 3);
    g.strokeStyle = "#fff"; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(ox + this.px * sc, oy + this.py * sc);
    g.lineTo(ox + (this.px + this.dx * 1.6) * sc, oy + (this.py + this.dy * 1.6) * sc);
    g.stroke();
    g.restore();
  };

  // segmented boss health bar — shown while the Cinder King is alive & awake
  Game.prototype.renderBossBar = function (g) {
    let boss = null;
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.cfg.boss && e.roared && e.state !== "dead") { boss = e; break; }
    }
    if (!boss) return;
    g.save(); g.scale(SCALE, SCALE);
    const bw = 200, bx = (BW - bw) / 2, by = 10;
    const frac = Math.max(0, boss.hp / boss.cfg.hp);
    // frame
    g.fillStyle = "rgba(4,5,11,0.8)"; g.fillRect(bx - 4, by - 3, bw + 8, 16);
    g.strokeStyle = boss.enraged ? "#ff7043" : "#6a1414"; g.lineWidth = 1;
    g.strokeRect(bx - 4, by - 3, bw + 8, 16);
    // fill
    g.fillStyle = "#2a0a0a"; g.fillRect(bx, by, bw, 7);
    const grd = g.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, "#ff5d52"); grd.addColorStop(1, boss.enraged ? "#ffd75e" : "#c9333f");
    g.fillStyle = grd; g.fillRect(bx, by, (bw * frac) | 0, 7);
    // segment ticks
    g.fillStyle = "rgba(4,5,11,0.9)";
    for (let s = 1; s < 10; s++) g.fillRect(bx + (bw * s / 10) | 0, by, 1, 7);
    // label
    g.font = "bold 8px monospace"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = boss.enraged ? "#ffd75e" : "#ff8a70";
    g.fillText(boss.enraged ? "THE CINDER KING  —  ENRAGED" : "THE CINDER KING", BW / 2, by - 5);
    g.textAlign = "left";
    g.restore();
  };

  Game.prototype.renderFace = function (g, x, y) {
    // detailed doom-marine status face, 22x22
    const hp = this.hp;
    const hurt = this.dmgFlash > 0.3, grin = this.pickFlash > 0.25;
    const cx = x + 11;
    // backdrop
    g.fillStyle = "#0c0d12"; g.fillRect(x, y, 22, 22);
    // neck / shoulders
    g.fillStyle = "#2f6a4a"; g.fillRect(x + 4, y + 19, 14, 3);
    // head base + shading (skin darkens as HP drops)
    const skin = hp > 66 ? "#d9a273" : hp > 33 ? "#c68a5c" : "#a86f4a";
    const shade = hp > 66 ? "#b07e50" : hp > 33 ? "#9c6a40" : "#834f30";
    g.fillStyle = skin; g.fillRect(x + 4, y + 4, 14, 16);
    g.fillStyle = shade; g.fillRect(x + 14, y + 5, 4, 15);      // right-side shadow
    g.fillRect(x + 4, y + 4, 14, 1);
    // jaw
    g.fillStyle = skin; g.fillRect(x + 5, y + 18, 12, 2);
    // brown hair with a highlight
    g.fillStyle = "#5a3418"; g.fillRect(x + 3, y + 2, 16, 5);
    g.fillStyle = "#7a4a24"; g.fillRect(x + 4, y + 2, 6, 2);
    g.fillRect(x + 3, y + 3, 16, 1);
    // brow
    g.fillStyle = "#4a2c14"; g.fillRect(x + 4, y + 8, 6, 1); g.fillRect(x + 12, y + 8, 6, 1);
    // eyes (whites, blue iris tracking left/right slightly with head-bob)
    const look = (Math.sin(this.bob * 0.5) * 1.4) | 0;
    g.fillStyle = "#eef2ff"; g.fillRect(x + 5, y + 9, 5, 3); g.fillRect(x + 12, y + 9, 5, 3);
    g.fillStyle = "#2b6fb0"; g.fillRect(x + 7 + look, y + 9, 2, 3); g.fillRect(x + 14 + look, y + 9, 2, 3);
    g.fillStyle = "#0a0e16"; g.fillRect(x + 7 + look, y + 10, 1, 1); g.fillRect(x + 14 + look, y + 10, 1, 1);
    // angry lowered brows when hurt or low HP
    if (hurt || hp <= 33) { g.fillStyle = "#3a2010"; g.fillRect(x + 5, y + 8, 5, 2); g.fillRect(x + 12, y + 8, 5, 2); }
    // nose
    g.fillStyle = shade; g.fillRect(x + 10, y + 11, 2, 4);
    // moustache/stubble
    g.fillStyle = "#4a2c16"; g.fillRect(x + 6, y + 15, 10, 1);
    // mouth reacts to state
    if (grin) { g.fillStyle = "#eef2ff"; g.fillRect(x + 7, y + 16, 8, 2); }          // teeth grin
    else if (hurt) { g.fillStyle = "#5a0c08"; g.fillRect(x + 8, y + 15, 6, 4); }     // open shout
    else { g.fillStyle = "#3a1a10"; g.fillRect(x + 7, y + 16, 8, 2); }               // set jaw
    // blood/wounds at low HP
    if (hp <= 33) {
      g.fillStyle = "#b02020";
      g.fillRect(x + 5, y + 6, 4, 2); g.fillRect(x + 14, y + 13, 3, 4); g.fillRect(x + 6, y + 17, 2, 2);
    } else if (hp <= 66) {
      g.fillStyle = "#8a3020"; g.fillRect(x + 14, y + 12, 3, 2);
    }
  };

  // small overlay strip above the HUD: active mod timers + daily/ghost badges
  Game.prototype.renderStatusStrip = function (g) {
    g.save(); g.scale(SCALE, SCALE);
    g.font = "bold 7px monospace"; g.textBaseline = "middle"; g.textAlign = "left";
    let x = 4;
    const mods = [["RAPID", this.mods.rapid, 20, "#ffd75e"], ["SPREAD", this.mods.spread, 20, "#ff9a50"], ["LIFE", this.mods.lifesteal, 15, "#63d97a"]];
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i]; if (m[1] <= 0) continue;
      const w = 34;
      g.fillStyle = "rgba(4,5,11,0.6)"; g.fillRect(x, 4, w, 9);
      g.fillStyle = m[3]; g.fillRect(x, 12, (w * m[1] / m[2]) | 0, 1);
      g.fillText(m[0] + " " + Math.ceil(m[1]) + "s", x + 2, 8);
      x += w + 3;
    }
    // badges (top-right)
    g.textAlign = "right";
    let bx = BW - 4;
    if (dailyMode) { g.fillStyle = "#ff8a50"; g.fillText("DAILY #" + dailySeed, bx, 8); bx -= 66; }
    if (this.ghostBest) { g.fillStyle = "#63d97a"; g.fillText("GHOST", bx, 8); bx -= 34; }
    if (this.allyOn) { g.fillStyle = "#8ad8ff"; g.fillText("ALLY", bx, 8); }
    g.restore();
  };

  Game.prototype.renderHUD = function (g) {
    g.save(); g.scale(SCALE, SCALE); // chrome space
    g.fillStyle = "#0b0f1a"; g.fillRect(0, VIEW_B, BW, BHUD);
    g.fillStyle = "#232c47"; g.fillRect(0, VIEW_B, BW, 1);
    this.renderFace(g, 3, VIEW_B + 3);
    g.font = "bold 8px monospace"; g.textBaseline = "middle"; g.textAlign = "left";
    // HP
    g.fillStyle = "#31121a"; g.fillRect(28, VIEW_B + 3, 44, 7);
    g.fillStyle = this.hp > 35 ? "#c9333f" : "#ff7043";
    g.fillRect(28, VIEW_B + 3, (44 * this.hp / 100) | 0, 7);
    g.fillStyle = "#fff"; g.fillText(String(this.hp), 30, VIEW_B + 7);
    // Armor
    g.fillStyle = "#122033"; g.fillRect(28, VIEW_B + 12, 44, 6);
    g.fillStyle = "#4a9ad8";
    g.fillRect(28, VIEW_B + 12, (44 * (this.armor || 0) / 100) | 0, 6);
    g.fillStyle = "#cfe8ff"; g.fillText(String(this.armor || 0), 30, VIEW_B + 15);
    // ammo for current weapon
    const w = WEAPONS[this.cur];
    const ammoVal = w.ammo === "none" ? "INF" : String(this[w.ammo] || 0);
    g.fillStyle = "#8d99b8"; g.fillText("AMMO", 76, VIEW_B + 8);
    g.fillStyle = w.ammo === "none" ? "#88cc44" : "#ffd75e"; g.fillText(ammoVal, 104, VIEW_B + 8);
    // weapon slots 1-6
    for (let i = 0; i < 6; i++) {
      const owned = this.owned[i];
      g.fillStyle = i === this.cur ? "#ffd75e" : owned ? "#8ad8ff" : "#2a3350";
      g.fillText(String(i + 1), 76 + i * 9, VIEW_B + 20);
    }
    g.fillStyle = "#8d99b8"; g.fillText(w.name, 132, VIEW_B + 20);
    // keycards (red / blue / yellow)
    const kc = this.keycards, kcCol = ["#c9333f", "#3a6ad8", "#e0c020"], kcOwn = [kc.red, kc.blue, kc.yellow];
    for (let ki = 0; ki < 3; ki++) {
      const kx = 124 + ki * 7;
      if (kcOwn[ki]) { g.fillStyle = kcCol[ki]; g.fillRect(kx, VIEW_B + 3, 6, 9); g.fillStyle = "#0b0f1a"; g.fillRect(kx + 1, VIEW_B + 5, 4, 2); }
      else { g.fillStyle = "#2a3350"; g.fillRect(kx, VIEW_B + 3, 6, 9); }
    }
    // mine count
    if (this.mineCount > 0) { g.fillStyle = "#c9333f"; g.fillText("◆" + this.mineCount, 124, VIEW_B + 20); }
    // kills
    g.fillStyle = "#8d99b8"; g.fillText("K", 148, VIEW_B + 8);
    g.fillStyle = "#8ad8ff"; g.fillText(this.kills + "/" + this.L.totKills, 156, VIEW_B + 8);
    // level + precise time
    g.fillStyle = "#8d99b8"; g.fillText("L" + (this.levelIdx + 1), 148, VIEW_B + 8 + 12);
    const tm = this.time;
    const tms = ((tm / 60) | 0) + ":" + ("0" + ((tm | 0) % 60)).slice(-2) + "." + (((tm * 10) | 0) % 10);
    g.fillStyle = "#8ad8ff"; g.fillText(tms, 162, VIEW_B + 20);
    // score
    g.textAlign = "right";
    g.fillStyle = "#ffd75e"; g.fillText("SCORE " + this.score, BW - 5, VIEW_B + 8);
    g.fillStyle = "#8d99b8"; g.fillText("HI " + Math.max(this.hi, this.score), BW - 5, VIEW_B + 20);
    g.restore();
  };

  Game.prototype.renderOverlay = function (g, title, color, sub) {
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "rgba(4,5,11,0.62)"; g.fillRect(0, 0, BW, BH);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 22px monospace"; g.fillStyle = color;
    g.fillText(title, BW / 2, 84);
    g.font = "bold 9px monospace"; g.fillStyle = "#eef2ff";
    g.fillText(sub, BW / 2, 108);
    g.restore();
  };
  Game.prototype.renderTally = function (g, title, sub) {
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "rgba(4,5,11,0.82)"; g.fillRect(0, 0, BW, BH);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 16px monospace"; g.fillStyle = "#ffd75e";
    g.fillText(title, BW / 2, 22);
    // grade (kills + secrets + time blend)
    const killPct = this.kills / Math.max(1, this.L.totKills);
    const secPct = this.secretsFound / Math.max(1, this.L.totSecrets || 1);
    const grade = this.computeGrade();
    const gradeColor = grade === "S" ? "#ffd75e" : grade === "A" ? "#88ff88" : grade === "B" ? "#8ad8ff" : "#8d99b8";
    g.font = "bold 26px monospace"; g.fillStyle = gradeColor;
    g.fillText(grade, 44, 44);
    g.font = "bold 8px monospace"; g.fillStyle = "#8d99b8"; g.fillText("GRADE", 44, 62);
    // stat rows (right of the grade)
    g.font = "bold 9px monospace";
    const rows = [
      ["KILLS",  this.kills + " / " + this.L.totKills + "  (" + ((100 * killPct) | 0) + "%)"],
      ["SECRETS", this.secretsFound + " / " + (this.L.totSecrets || 0) + "  (" + ((100 * secPct) | 0) + "%)"],
      ["ITEMS",  this.itemsGot + " / " + this.L.totItems],
      ["TIME",   (((this.time | 0) / 60) | 0) + ":" + ("0" + (this.time | 0) % 60).slice(-2) + "  par " + ((this.L.par / 60) | 0) + ":" + ("0" + this.L.par % 60).slice(-2)],
      ["SCORE",  String(this.score)]
    ];
    for (let i = 0; i < rows.length; i++) {
      g.fillStyle = "#8d99b8"; g.textAlign = "right"; g.fillText(rows[i][0], 150, 34 + i * 13);
      g.fillStyle = "#eef2ff"; g.textAlign = "left";  g.fillText(rows[i][1], 158, 34 + i * 13);
    }
    // intermission map art (mini top-down) on the right with path + kill dots
    this.renderMiniMap(g, 168, 30, 140, 96);
    g.textAlign = "center"; g.fillStyle = "#8ad8ff";
    g.font = "bold 9px monospace";
    g.fillText(sub, BW / 2, 176);
    g.fillStyle = "#8d99b8"; g.font = "bold 7px monospace";
    g.fillText("S = download score card", BW / 2, 190);
    g.restore();
  };

  // mini top-down level art used on the intermission screen (chrome-space)
  Game.prototype.renderMiniMap = function (g, ox, oy, maxW, maxH) {
    const L = this.L;
    const sc = Math.max(1, Math.min(maxW / L.w, maxH / L.h));
    const mw = L.w * sc, mh = L.h * sc;
    g.fillStyle = "rgba(2,3,7,0.9)"; g.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const v = L.map[y][x]; if (!v) continue;
      g.fillStyle = v === 5 ? "#ffd75e"
                  : (v >= 6 && v <= 11) ? "#3a4c6e"
                  : "#26314c";
      g.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc));
    }
    // player path (recorded ghost of this run)
    g.fillStyle = "rgba(99,217,122,0.7)";
    for (let i = 0; i + 1 < this.ghost.length; i += 6) {
      g.fillRect(ox + this.ghost[i] * sc - 0.5, oy + this.ghost[i + 1] * sc - 0.5, 1.5, 1.5);
    }
    // kill markers (dead enemies)
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i]; if (e.state !== "dead") continue;
      g.fillStyle = "#c9333f"; g.fillRect(ox + e.x * sc - 1, oy + e.y * sc - 1, 2, 2);
    }
    // final player position
    g.fillStyle = "#fff"; g.fillRect(ox + this.px * sc - 1, oy + this.py * sc - 1, 2, 2);
  };
  Game.prototype.renderWin = function (g) {
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "rgba(10,6,0,0.82)"; g.fillRect(0, 0, BW, BH);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 20px monospace"; g.fillStyle = "#ffd75e";
    g.fillText("THE CINDER KING FALLS", BW / 2, 44);
    g.font = "bold 10px monospace"; g.fillStyle = "#eef2ff";
    g.fillText("FINAL SCORE  " + this.score, BW / 2, 74);
    g.fillStyle = this.score >= this.hi ? "#ffd75e" : "#8d99b8";
    g.fillText(this.score >= this.hi ? "★ NEW HI-SCORE ★" : "HI-SCORE  " + this.hi, BW / 2, 92);
    g.fillStyle = "#8ad8ff";
    g.fillText("Now imagine what I could build for YOUR project.", BW / 2, 120);
    g.fillStyle = "#8d99b8";
    g.fillText("SPACE to return to title", BW / 2, 150);
    g.restore();
  };
  // ---- ending cinematic ----
  Game.prototype.renderCinematic = function (g) {
    const t = (performance.now() - (this.cineStart || performance.now())) / 1000;
    if (t > 11) { this.endCinematic(); return; }
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "#070406"; g.fillRect(0, 0, BW, BH);
    // rising embers
    for (let i = 0; i < 30; i++) {
      const y = (BH - ((t * (12 + i % 9) + i * 41) % (BH + 40)));
      g.fillStyle = i % 3 ? "rgba(255,110,60,0.5)" : "rgba(255,200,90,0.5)";
      g.fillRect(((i * 61 + Math.sin(t + i) * 10) % BW + BW) % BW, y, 2, 3);
    }
    g.textAlign = "center"; g.textBaseline = "middle";
    // staged text crawl
    const lines = [
      [0.3, "THE CINDER KING FALLS...", "#ffd75e", 16],
      [3.0, "The gates of the inferno seal behind you.", "#eef2ff", 9],
      [5.0, "FINAL SCORE  " + this.score, "#ff8a50", 12],
      [7.0, "GRADE ON RECORD  " + this.unlocks.bestGrade, "#8ad8ff", 10],
      [9.0, "THANKS FOR PLAYING", "#ffd75e", 14]
    ];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; if (t < l[0]) continue;
      g.globalAlpha = Math.min(1, (t - l[0]) * 1.5);
      g.font = "bold " + l[3] + "px monospace"; g.fillStyle = l[2];
      g.fillText(l[1], BW / 2, 50 + i * 22);
    }
    g.globalAlpha = 1;
    g.font = "bold 8px monospace"; g.fillStyle = "#8d99b8";
    if (Math.sin(t * 4) > 0) g.fillText("ENTER / CLICK TO CONTINUE", BW / 2, BH - 12);
    g.restore();
  };

  // ---- level editor (visitor try) ----
  Game.prototype.startEditor = function () {
    const W2 = 24, H2 = 16;
    const grid = [];
    for (let y = 0; y < H2; y++) {
      let row = "";
      for (let x = 0; x < W2; x++) row += (x === 0 || y === 0 || x === W2 - 1 || y === H2 - 1) ? "#" : ".";
      grid.push(row.split(""));
    }
    grid[1][1] = "P";
    this.editor = { w: W2, h: H2, grid: grid, cx: 2, cy: 2, tile: 0 };
    this.mode = "editor";
  };
  // palette: index → char + label
  Game.prototype.editorPalette = function () {
    return [
      { ch: "#", name: "WALL" }, { ch: ".", name: "FLOOR" }, { ch: "D", name: "DOOR" },
      { ch: "X", name: "EXIT" }, { ch: "k", name: "RED KEY" }, { ch: "G", name: "RED DOOR" },
      { ch: "E", name: "IMP" }, { ch: "B", name: "BARREL" }, { ch: "P", name: "PLAYER START" }
    ];
  };
  Game.prototype.editorKey = function (k) {
    const ed = this.editor; if (!ed) return;
    if (k === "escape") { this.mode = "title"; this.editor = null; return; }
    if (k === "w" || k === "arrowup") ed.cy = Math.max(0, ed.cy - 1);
    else if (k === "s" || k === "arrowdown") ed.cy = Math.min(ed.h - 1, ed.cy + 1);
    else if (k === "a" || k === "arrowleft") ed.cx = Math.max(0, ed.cx - 1);
    else if (k === "d" || k === "arrowright") ed.cx = Math.min(ed.w - 1, ed.cx + 1);
    else if (k >= "1" && k <= "9") {
      const pal = this.editorPalette(); const idx = +k - 1;
      if (idx < pal.length) {
        const ch = pal[idx].ch;
        // only one player start allowed
        if (ch === "P") for (let y = 0; y < ed.h; y++) for (let x = 0; x < ed.w; x++) if (ed.grid[y][x] === "P") ed.grid[y][x] = ".";
        ed.grid[ed.cy][ed.cx] = ch; ed.tile = idx;
      }
    } else if (k === " ") { this.playtestEditor(); }
  };
  Game.prototype.playtestEditor = function () {
    const ed = this.editor; if (!ed) return;
    // ensure a player start + an exit exist
    let hasP = false;
    for (let y = 0; y < ed.h; y++) for (let x = 0; x < ed.w; x++) if (ed.grid[y][x] === "P") hasP = true;
    if (!hasP) ed.grid[1][1] = "P";
    const rows = ed.grid.map(function (r) { return r.join(""); });
    // stash a custom level in a reserved slot (reused across playtests)
    if (this._customIdx == null) this._customIdx = LEVELS.length;
    LEVELS[this._customIdx] = { name: "CUSTOM MAP", theme: "hangar", par: 120, rows: rows };
    this.score = this.score || 0; this.hp = 100; this.armor = 0;
    this.bullets = 60; this.shells = 8; this.cells = 40; this.rockets = 5;
    this.owned = [true, true, true, false, false, false]; this.cur = 0;
    this.keycards = { red: true, blue: true, yellow: true };
    this.editor = null;
    this.loadLevel(this._customIdx);
    this.mode = "play";
  };
  Game.prototype.renderEditor = function (g) {
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "#0a0c14"; g.fillRect(0, 0, BW, BH);
    const ed = this.editor;
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 11px monospace";
    g.fillStyle = "#ffd75e"; g.fillText("LEVEL EDITOR", BW / 2, 10);
    const sc = Math.min(7, ((BW - 20) / ed.w) | 0);
    const ox = (BW - ed.w * sc) / 2, oy = 20;
    const colors = { "#": "#26314c", ".": "#0e1220", "D": "#5aa0e8", "X": "#ffd75e", "k": "#c9333f", "G": "#ff6a5e", "E": "#8f3a24", "B": "#3a4254", "P": "#63d97a" };
    for (let y = 0; y < ed.h; y++) for (let x = 0; x < ed.w; x++) {
      const ch = ed.grid[y][x];
      g.fillStyle = colors[ch] || "#0e1220";
      g.fillRect(ox + x * sc, oy + y * sc, sc - 0.5, sc - 0.5);
    }
    // cursor
    g.strokeStyle = "#fff"; g.lineWidth = 1;
    g.strokeRect(ox + ed.cx * sc, oy + ed.cy * sc, sc, sc);
    // palette
    const pal = this.editorPalette();
    g.textAlign = "left"; g.font = "bold 7px monospace";
    let py = oy + ed.h * sc + 8;
    for (let i = 0; i < pal.length; i++) {
      g.fillStyle = i === ed.tile ? "#ffd75e" : "#8d99b8";
      g.fillText((i + 1) + " " + pal[i].name, 8 + (i % 3) * 104, py + ((i / 3) | 0) * 9);
    }
    g.textAlign = "center"; g.fillStyle = "#8d99b8"; g.font = "bold 7px monospace";
    g.fillText("WASD move cursor · 1-9 place tile · SPACE playtest · ESC back", BW / 2, BH - 8);
    g.restore();
  };

  // ---- shareable score card (PNG download) ----
  Game.prototype.downloadScoreCard = function () {
    try {
      const cw = 640, ch = 360;
      const c = document.createElement("canvas"); c.width = cw; c.height = ch;
      const x = c.getContext("2d");
      const grd = x.createLinearGradient(0, 0, 0, ch);
      grd.addColorStop(0, "#1a0806"); grd.addColorStop(1, "#070810");
      x.fillStyle = grd; x.fillRect(0, 0, cw, ch);
      x.strokeStyle = "#ff8a50"; x.lineWidth = 4; x.strokeRect(8, 8, cw - 16, ch - 16);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = "#ffd75e"; x.font = "bold 44px monospace"; x.fillText("INFERNO", cw / 2, 54);
      x.fillStyle = "#ff8a50"; x.font = "bold 16px monospace"; x.fillText("SCORE CARD", cw / 2, 84);
      x.fillStyle = "#eef2ff"; x.font = "bold 20px monospace";
      x.fillText(this.L.name, cw / 2, 128);
      const grade = this.computeGrade();
      x.font = "bold 90px monospace"; x.fillStyle = "#ffd75e"; x.fillText(grade, cw / 2, 200);
      x.font = "bold 16px monospace"; x.fillStyle = "#8d99b8"; x.fillText("GRADE", cw / 2, 248);
      x.font = "bold 15px monospace"; x.textAlign = "center";
      const tm = this.time | 0;
      const info = "KILLS " + this.kills + "/" + this.L.totKills +
                   "    SECRETS " + this.secretsFound + "/" + (this.L.totSecrets || 0) +
                   "    TIME " + ((tm / 60) | 0) + ":" + ("0" + tm % 60).slice(-2);
      x.fillStyle = "#eef2ff"; x.fillText(info, cw / 2, 284);
      x.fillStyle = "#ffd75e"; x.font = "bold 18px monospace"; x.fillText("SCORE  " + this.score, cw / 2, 312);
      x.fillStyle = "#8d99b8"; x.font = "bold 12px monospace";
      x.fillText((dailyMode ? "DAILY #" + dailySeed + "  ·  " : "") + new Date().toLocaleDateString(), cw / 2, 338);
      const finish = function (url) {
        const a = document.createElement("a");
        a.href = url; a.download = "inferno-scorecard.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };
      if (c.toBlob) c.toBlob(function (b) { const u = URL.createObjectURL(b); finish(u); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); });
      else finish(c.toDataURL("image/png"));
      this.say("SCORE CARD DOWNLOADED", 1.4);
    } catch (e) { this.say("SCORE CARD FAILED", 1.2); }
  };

  Game.prototype.renderTitle = function (g) {
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "#070810"; g.fillRect(0, 0, BW, BH);
    // ember particles
    const t = performance.now() * 0.001;
    for (let i = 0; i < 26; i++) {
      const y = (BH - ((t * (14 + i % 9) + i * 37) % BH));
      g.fillStyle = i % 3 ? "rgba(255,138,80,0.5)" : "rgba(255,215,94,0.55)";
      g.fillRect(((i * 53 + Math.sin(t + i) * 8) % BW + BW) % BW, y, 2, 2);
    }
    // demons flanking
    g.drawImage(this.sprites.imp[(t * 2 | 0) % 2], 22, 96, 64, 64);
    g.drawImage(this.sprites.boss[(t * 2 | 0) % 2], 226, 84, 76, 76);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 34px monospace";
    g.fillStyle = "#3a0c08"; g.fillText("INFERNO", BW / 2 + 2, 52 + 2);
    g.fillStyle = "#ffd75e"; g.fillText("INFERNO", BW / 2, 52);
    g.font = "bold 9px monospace"; g.fillStyle = "#ff8a50";
    g.fillText("— RAYMOND VDW'S DEMON PURGE —", BW / 2, 74);
    g.fillStyle = "#eef2ff"; g.font = "bold 11px monospace";
    g.fillText(Math.sin(t * 4) > -0.2 ? "CLICK OR PRESS SPACE TO ENTER HELL" : "", BW / 2, 116);
    // difficulty selector
    g.font = "bold 9px monospace"; g.fillStyle = "#8d99b8"; g.fillText("DIFFICULTY  [ / ]  TO CHANGE", BW / 2, 136);
    const dColors = ["#88ff88", "#ffd75e", "#ff5d52"];
    g.fillStyle = dColors[diff]; g.font = "bold 11px monospace";
    g.fillText("▶ " + DIFF_NAMES[diff] + " ◀", BW / 2, 150);
    g.font = "bold 8px monospace"; g.fillStyle = "#8d99b8";
    g.fillText("WASD MOVE · MOUSE/ARROWS AIM · FIRE CLICK/SPACE · F MINE · 1-6 WEAPONS", BW / 2, 160);
    g.fillStyle = "#ff8a50";
    g.fillText("C DAILY CHALLENGE · E LEVEL EDITOR · O WRAITH ALLY" + (this.allyOn ? " [ON]" : ""), BW / 2, 170);
    g.fillStyle = "#8d99b8";
    g.fillText("KEYCARDS · CRUSHERS · LAVA · LIFTS · MODS · MINES · GHOST REPLAY", BW / 2, 180);
    // hi-score + persistent unlocks
    let uy = 190;
    if (this.hi > 0) { g.fillStyle = "#ffd75e"; g.fillText("HI-SCORE " + this.hi, BW / 2, uy); uy += 0; }
    const u = this.unlocks || {};
    const unl = [];
    if (u.bestGrade && u.bestGrade !== "-") unl.push("BEST " + u.bestGrade);
    if (u.shellsBonus > 0) unl.push("+" + u.shellsBonus + " SHELLS");
    if (u.pistolSkin) unl.push("GOLD PISTOL");
    if (unl.length) { g.fillStyle = "#63d97a"; g.font = "bold 7px monospace"; g.fillText("UNLOCKED: " + unl.join(" · "), BW / 2, 197); }
    g.restore();
  };

  Game.prototype.loop = function () {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.update(dt);
    this.render();

    // adaptive quality: if the device can't hold the frame rate at this
    // resolution, step the render scale down (960 -> 640 -> 480 wide)
    if (this.mode === "play") {
      this._fr++;
      if (dt > 0.031) this._jank++;
      if (this._fr >= 120) {
        if (this._jank / this._fr > 0.35 && SCALE > 1.5) this.setResolution(SCALE >= 3 ? 2 : 1.5);
        this._fr = 0; this._jank = 0;
      }
    }
  };

  Game.prototype.destroy = function () {
    this.running = false;
    this.stopMusic();
    if (this._raf) cancelAnimationFrame(this._raf);
    removeEventListener("keydown", this._down);
    removeEventListener("keyup", this._up);
    removeEventListener("mousemove", this._mm);
    removeEventListener("mouseup", this._mu);
    this.canvas.removeEventListener("mousedown", this._md);
    document.removeEventListener("fullscreenchange", this._fsc);
    if (this._resetTouch) this._resetTouch();
    this.mdown = false;
    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen(); } catch (e) {}
    }
    if (this._resetTouch) try { this._resetTouch(); } catch (e) {}
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    if (actx) { try { actx.suspend(); } catch (e) {} }
  };

  // ============================ API ============================
  window.initArcade = function (canvasId) {
    const canvas = typeof canvasId === "string" ? document.getElementById(canvasId) : canvasId;
    if (!canvas) return;
    if (G) { G.destroy(); G = null; }
    G = new Game(canvas);
    window.__arcade = G; // debug handle
  };
  window.destroyArcade = function () {
    if (G) { G.destroy(); G = null; }
  };
})();
