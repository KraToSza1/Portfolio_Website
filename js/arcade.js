// js/arcade.js — "INFERNO" — a complete retro FPS built from scratch.
// Raycast renderer (DDA, textured walls, sprite billboards, per-column
// z-clipping) + full game: title screen, 3 weapons, 4 enemy types incl. a
// boss, projectiles, exploding barrels, keycards, pickups, particles,
// minimap, synthesized sound, score/tally screens, persistent hi-score.
// No libraries, no image assets. API: window.initArcade(id) / window.destroyArcade().
(function () {
  "use strict";

  // ============================ LEVELS ============================
  // walls: # brick · T tech · S slime · M metal · X exit(needs key)
  // floor: . or space
  // P player · E imp · C caster · U brute · Z boss
  // h health · a bullets · s shells · c cells · k keycard
  // W shotgun pickup · Q plasma pickup · B exploding barrel
  const LEVELS = [
    {
      name: "E1: HANGAR OF REGRET", par: 75,
      rows: [
        "################",
        "#P.....#...a..h#",
        "#......#.......#",
        "#..E...#..E....#",
        "#......T....B..#",
        "###T####.......#",
        "#....B.#####T###",
        "#..a...S.......#",
        "#..E...S..E..k.#",
        "#......S.......#",
        "#h.....S.......#",
        "####.###..E....#",
        "#..W.......B...#",
        "#..E...........X",
        "#..a........h..#",
        "################"
      ]
    },
    {
      name: "E2: THE GOLD FOUNDRY", par: 120,
      rows: [
        "####################",
        "#P.......#.....C..h#",
        "#....E...#.........#",
        "#.........T...E....#",
        "####T###..#....B...#",
        "#......#..####..####",
        "#..C...M....a......#",
        "#......#..E....s...#",
        "#..s...#......###S##",
        "###.####..h...S....#",
        "#....B....C...S..E.#",
        "#..h..........S....#",
        "#......E...Q..S..c.#",
        "#..................X",
        "#..a......E....k.h.#",
        "####################"
      ]
    },
    {
      name: "E3: THRONE OF CINDER", par: 180,
      rows: [
        "####################",
        "#P.......#....C...h#",
        "#...U....#.........#",
        "#......#.#...####..#",
        "#..s...#.....#..c..#",
        "####.###..####..####",
        "#..c...#..........s#",
        "#..U...#..C....U...#",
        "#......#...........#",
        "###.####....h......#",
        "#........B.........#",
        "#..M...........M...#",
        "#..................#",
        "#.....B..Z...B.....#",
        "#..................#",
        "#..M...........M...#",
        "#....s...h....c....#",
        "#..................#",
        "#h.......a........c#",
        "####################"
      ]
    }
  ];
  const WALLS = { "#": 1, "T": 2, "S": 3, "M": 4, "X": 5 };

  // ============================ CONFIG ============================
  const W = 320, H = 200, HUD_H = 28, VIEW_H = H - HUD_H;
  const FOV_PLANE = 0.66;
  const TEX = 64;

  const WEAPONS = [
    { name: "PISTOL",  ammo: "bullets", rate: 0.32, pellets: 1, spread: 0.012, dmg: [12, 18], kick: 4,  color: "#ffe6a0" },
    { name: "SHOTGUN", ammo: "shells",  rate: 0.95, pellets: 6, spread: 0.085, dmg: [8, 13],  kick: 9,  color: "#ffd07a" },
    { name: "PLASMA",  ammo: "cells",   rate: 0.15, proj: true, dmg: [18, 26], kick: 2,  color: "#9fe8ff" }
  ];

  const ETYPES = {
    imp:    { hp: 30,  sp: 1.7,  scale: 1.0,  mdmg: [8, 14],  mrange: 1.05, score: 100,
              pal: { body: "#7a2d1c", skin: "#8f3a24", eye: "#ffe14a" } },
    caster: { hp: 24,  sp: 1.3,  scale: 0.95, mdmg: [6, 10],  mrange: 0.9,  score: 150,
              ranged: { cd: 1.7, speed: 4.2, dmg: [10, 16], hold: 4.2 },
              pal: { body: "#3a2050", skin: "#5a3a80", eye: "#c88aff" } },
    brute:  { hp: 90,  sp: 1.05, scale: 1.28, mdmg: [18, 26], mrange: 1.15, score: 250,
              pal: { body: "#2f4032", skin: "#48604a", eye: "#a6ffbf" } },
    boss:   { hp: 420, sp: 0.95, scale: 2.15, mdmg: [22, 30], mrange: 1.4,  score: 1000, boss: true,
              ranged: { cd: 1.5, speed: 4.6, dmg: [12, 18], hold: 7, spread: 3 },
              pal: { body: "#5a1010", skin: "#8a1f14", eye: "#ffd75e" } }
  };
  const ECHARS = { E: "imp", C: "caster", U: "brute", Z: "boss" };

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
    pistol:  function () { tone(300, 90, 0.09, "square", 0.07); noiseBurst(0.06, 0.05, 2200); },
    shotgun: function () { noiseBurst(0.28, 0.16, 1100); tone(140, 50, 0.2, "triangle", 0.1); },
    plasma:  function () { tone(680, 190, 0.12, "sawtooth", 0.06); },
    hurt:    function () { tone(170, 60, 0.22, "sawtooth", 0.09); },
    edie:    function () { tone(280, 45, 0.32, "square", 0.07); noiseBurst(0.15, 0.05, 700); },
    boom:    function () { noiseBurst(0.5, 0.2, 500); tone(90, 30, 0.45, "sine", 0.16); },
    pickup:  function () { tone(620, 990, 0.1, "sine", 0.06); },
    key:     function () { tone(520, 780, 0.12, "sine", 0.07); tone(780, 1170, 0.14, "sine", 0.05); },
    nokey:   function () { tone(120, 110, 0.16, "square", 0.07); },
    switch:  function () { tone(220, 320, 0.05, "square", 0.04); },
    fireball:function () { tone(420, 150, 0.18, "sawtooth", 0.045); },
    roar:    function () { tone(90, 40, 0.7, "sawtooth", 0.14); noiseBurst(0.5, 0.08, 400); },
    step:    function () {}
  };

  // ============================ ART (procedural) ============================
  function mkTex(size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"));
    return c;
  }
  function darken(tex) {
    return mkTex(TEX, function (g) {
      g.drawImage(tex, 0, 0);
      g.fillStyle = "rgba(0,0,0,0.36)";
      g.fillRect(0, 0, TEX, TEX);
    });
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
      for (let y = 0; y < 4; y++) g.fillRect(0, y * 16 + 15, TEX, 1);
    });
    const tech = mkTex(TEX, function (g) {
      g.fillStyle = "#1a2236"; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = "#232c47"; g.fillRect(4, 4, 56, 56);
      g.fillStyle = "#2c3a5e"; g.fillRect(8, 8, 48, 20);
      g.fillStyle = "#ffd75e"; g.fillRect(8, 32, 48, 3);
      g.fillStyle = "#8ad8ff"; g.fillRect(12, 42, 8, 8); g.fillRect(28, 42, 8, 8); g.fillRect(44, 42, 8, 8);
    });
    const slime = mkTex(TEX, function (g) {
      g.fillStyle = "#242e24"; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = ["#2e402c", "#39543a", "#1d271d", "#456349"][i % 4];
        const s = 4 + (i * 7) % 12;
        g.fillRect((i * 23) % TEX, (i * 41) % TEX, s, s);
      }
      g.fillStyle = "rgba(90,200,120,.25)";
      for (let i = 0; i < 6; i++) g.fillRect((i * 31) % TEX, (i * 17) % TEX, 3, 10 + (i * 5) % 12);
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
    const light = [null, brick, tech, slime, metal, exit];
    return { light: light, dark: [null].concat(light.slice(1).map(darken)) };
  }

  // demon frames: 0/1 walk, 2 attack, 3 pain, 4 dead — palette-driven
  function buildDemon(pal) {
    function frame(pose) {
      return mkTex(TEX, function (g) {
        if (pose === 4) {
          g.fillStyle = "#3d1210"; g.beginPath(); g.ellipse(32, 56, 20, 6, 0, 0, 7); g.fill();
          g.fillStyle = pal.body; g.beginPath(); g.ellipse(32, 53, 12, 5, 0, 0, 7); g.fill();
          g.fillStyle = "#d8c9a8";
          g.beginPath(); g.moveTo(22, 52); g.lineTo(18, 44); g.lineTo(25, 49); g.fill();
          g.beginPath(); g.moveTo(42, 52); g.lineTo(46, 44); g.lineTo(39, 49); g.fill();
          return;
        }
        const bodyC = pose === 3 ? "#c98a7a" : pal.body;
        const skinC = pose === 3 ? "#e8b0a0" : pal.skin;
        g.fillStyle = pose === 3 ? "#8a5a50" : "#571f12";
        g.fillRect(24, 46, 7, 16); g.fillRect(33, 46, 7, 16);
        g.fillStyle = bodyC;
        g.beginPath(); g.ellipse(32, 36, 13, 15, 0, 0, 7); g.fill();
        g.fillStyle = skinC;
        if (pose === 2) {
          g.fillRect(13, 18, 6, 16); g.fillRect(45, 18, 6, 16);
          g.fillStyle = "#e8e0c8";
          g.fillRect(12, 14, 8, 5); g.fillRect(44, 14, 8, 5);
          g.fillStyle = skinC;
        } else if (pose === 1) {
          g.fillRect(15, 34, 6, 14); g.fillRect(43, 30, 6, 14);
        } else {
          g.fillRect(15, 30, 6, 14); g.fillRect(43, 34, 6, 14);
        }
        g.beginPath(); g.ellipse(32, 18, 10, 9, 0, 0, 7); g.fill();
        g.fillStyle = "#d8c9a8";
        g.beginPath(); g.moveTo(24, 14); g.lineTo(19, 4); g.lineTo(27, 10); g.fill();
        g.beginPath(); g.moveTo(40, 14); g.lineTo(45, 4); g.lineTo(37, 10); g.fill();
        g.fillStyle = pose === 3 ? "#fff" : pal.eye;
        g.fillRect(27, 15, 4, 4); g.fillRect(34, 15, 4, 4);
        g.fillStyle = "#e33"; g.fillRect(28, 16, 2, 2); g.fillRect(35, 16, 2, 2);
        g.fillStyle = "#2a0a06"; g.fillRect(28, 23, 9, 3);
        if (pose === 2) { g.fillStyle = "#fff"; g.fillRect(28, 23, 2, 3); g.fillRect(34, 23, 2, 3); }
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
    out.k = mkTex(TEX, function (g) {
      g.fillStyle = "#ffd75e";
      g.beginPath(); g.arc(32, 36, 8, 0, 7); g.fill();
      g.fillStyle = "#0c0d12"; g.beginPath(); g.arc(32, 36, 3.5, 0, 7); g.fill();
      g.fillStyle = "#ffd75e"; g.fillRect(29, 42, 6, 16); g.fillRect(35, 50, 6, 4); g.fillRect(35, 44, 4, 3);
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
    out.B = mkTex(TEX, function (g) { // barrel
      g.fillStyle = "#3a4254"; g.fillRect(20, 26, 24, 34);
      g.fillStyle = "#2a2f3d"; g.fillRect(20, 26, 24, 4); g.fillRect(20, 56, 24, 4);
      g.fillStyle = "#ffd75e"; g.fillRect(20, 40, 24, 6);
      g.fillStyle = "#0c0d12";
      for (let i = 0; i < 3; i++) g.fillRect(22 + i * 8, 41, 5, 4);
      g.fillStyle = "#63d97a"; g.beginPath(); g.ellipse(32, 27, 10, 3, 0, 0, 7); g.fill();
    });
    return out;
  }

  // ============================ PARSE ============================
  function parseLevel(idx) {
    const rows = LEVELS[idx].rows;
    const map = [], enemies = [], items = [], barrels = [];
    let px = 1.5, py = 1.5;
    for (let y = 0; y < rows.length; y++) {
      const line = rows[y], row = [];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        row.push(WALLS[ch] || 0);
        if (ch === "P") { px = x + 0.5; py = y + 0.5; }
        else if (ECHARS[ch]) {
          const cfg = ETYPES[ECHARS[ch]];
          enemies.push({ type: ECHARS[ch], cfg: cfg, x: x + 0.5, y: y + 0.5, hp: cfg.hp,
                         state: "idle", animT: 0, atkT: 1 + Math.random(), painT: 0, roared: false });
        }
        else if ("hasckWQ".indexOf(ch) >= 0) items.push({ x: x + 0.5, y: y + 0.5, kind: ch });
        else if (ch === "B") barrels.push({ x: x + 0.5, y: y + 0.5, hp: 12, dead: false });
      }
      map.push(row);
    }
    return { map: map, enemies: enemies, items: items, barrels: barrels,
             px: px, py: py, w: rows[0].length, h: rows.length,
             name: LEVELS[idx].name, par: LEVELS[idx].par,
             totKills: enemies.length, totItems: items.length };
  }

  // ============================ GAME ============================
  let G = null;

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.tex = buildTextures();
    this.sprites = {
      imp: buildDemon(ETYPES.imp.pal),
      caster: buildDemon(ETYPES.caster.pal),
      brute: buildDemon(ETYPES.brute.pal),
      boss: buildDemon(ETYPES.boss.pal)
    };
    this.items = buildItems();
    this.zbuf = new Float64Array(W);
    this.keys = {};
    this.mode = "title";     // title | play | pause | inter | dead | win
    this.projs = [];
    this.parts = [];
    this.boomQueue = [];
    this.showMap = false;
    this.msg = ""; this.msgT = 0;
    this.dmgFlash = 0; this.pickFlash = 0; this.muzzle = 0; this.fireCd = 0;
    this.bob = 0; this.shake = 0;
    this.running = true;
    this._last = performance.now();
    this.hi = 0;
    try { this.hi = parseInt(localStorage.getItem("rvdw-inferno-hi") || "0", 10) || 0; } catch (e) {}

    const self = this;
    this._down = function (e) {
      const k = e.key.toLowerCase();
      if (["arrowup","arrowdown","arrowleft","arrowright"," ","w","a","s","d","r","m","p","1","2","3"].indexOf(k) >= 0) e.preventDefault();
      self.keys[k] = true;
      self.press(k);
    };
    this._up = function (e) { self.keys[e.key.toLowerCase()] = false; };
    this._click = function () {
      if (self.mode === "play" && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        try { canvas.requestPointerLock(); } catch (err) {}
      }
      self.press(" ");
    };
    this._mm = function (e) {
      if (self.mode === "play" && document.pointerLockElement === canvas) self.rotate(e.movementX * 0.0032);
    };
    addEventListener("keydown", this._down);
    addEventListener("keyup", this._up);
    canvas.addEventListener("mousedown", this._click);
    addEventListener("mousemove", this._mm);
    canvas.focus();

    this.loop = this.loop.bind(this);
    this._raf = requestAnimationFrame(this.loop);
  }

  Game.prototype.press = function (k) {
    if (k === "m") this.showMap = !this.showMap;
    if (this.mode === "title" && (k === " " || k === "enter")) { this.startRun(); return; }
    if (this.mode === "inter" && k === " ") { this.nextLevel(); return; }
    if (this.mode === "dead" && (k === "r" || k === " ")) { this.retryLevel(); return; }
    if (this.mode === "win" && (k === "r" || k === " ")) { this.mode = "title"; return; }
    if (this.mode === "play") {
      if (k === " ") this.tryFire();
      if (k === "r") this.retryLevel();
      if (k === "p") { this.mode = "pause"; return; }
      if (k === "1" || k === "2" || k === "3") {
        const w = +k - 1;
        if (this.owned[w] && this.cur !== w) { this.cur = w; SFX.switch(); this.say(WEAPONS[w].name, 0.7); }
      }
    } else if (this.mode === "pause" && (k === "p" || k === " ")) {
      this.mode = "play"; this._last = performance.now();
    }
  };

  Game.prototype.startRun = function () {
    this.score = 0; this.hp = 100;
    this.bullets = 40; this.shells = 0; this.cells = 0;
    this.owned = [true, false, false]; this.cur = 0;
    this.loadLevel(0);
    this.mode = "play";
  };
  Game.prototype.loadLevel = function (idx) {
    this.levelIdx = idx;
    this.L = parseLevel(idx);
    this.px = this.L.px; this.py = this.L.py;
    this.dx = 1; this.dy = 0; this.plx = 0; this.ply = FOV_PLANE;
    this.kills = 0; this.itemsGot = 0; this.time = 0;
    this.hasKey = false;
    this.projs.length = 0; this.parts.length = 0; this.boomQueue.length = 0;
    this.say(this.L.name, 2.6);
  };
  Game.prototype.retryLevel = function () {
    this.hp = 100;
    this.bullets = Math.max(this.bullets, 24);
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

  Game.prototype.rotate = function (a) {
    const c = Math.cos(a), s = Math.sin(a);
    let t = this.dx; this.dx = this.dx * c - this.dy * s; this.dy = t * s + this.dy * c;
    t = this.plx; this.plx = this.plx * c - this.ply * s; this.ply = t * s + this.ply * c;
  };
  Game.prototype.wallAt = function (x, y) {
    if (y < 0 || y >= this.L.h || x < 0 || x >= this.L.w) return 1;
    return this.L.map[y | 0][x | 0];
  };
  Game.prototype.tryMove = function (nx, ny) {
    const R = 0.22;
    if (!this.wallAt(nx + (nx > this.px ? R : -R), this.py)) this.px = nx;
    if (!this.wallAt(this.px, ny + (ny > this.py ? R : -R))) this.py = ny;
  };
  Game.prototype.los = function (x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(d / 0.15);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.wallAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
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
    e.hp -= dmg;
    this.spawnParts(e.x, e.y, 5, e.cfg.boss ? "#ffb08a" : "#c9333f", 1.8);
    if (e.hp <= 0) {
      e.state = "dead";
      this.kills++;
      this.score += e.cfg.score;
      SFX.edie();
      if (e.cfg.boss) {
        this.spawnParts(e.x, e.y, 60, "#ff8a50", 3.2);
        this.spawnParts(e.x, e.y, 40, "#ffd75e", 2.4);
        this.shake = 0.8;
        SFX.boom();
        const self = this;
        setTimeout(function () { if (self.running && self.mode === "play") self.doWin(); }, 1400);
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
    this.hp -= dmg;
    this.dmgFlash = 0.65;
    SFX.hurt();
    if (this.hp <= 0) { this.hp = 0; this.mode = "dead"; }
  };

  Game.prototype.tryFire = function () {
    if (this.mode !== "play" || this.fireCd > 0) return;
    const w = WEAPONS[this.cur];
    if (this[w.ammo] <= 0) { this.say("NO " + (w.ammo === "bullets" ? "BULLETS" : w.ammo.toUpperCase()), 1.1); SFX.nokey(); return; }
    this[w.ammo]--;
    this.fireCd = w.rate;
    this.muzzle = 0.09;
    (w.name === "PISTOL" ? SFX.pistol : w.name === "SHOTGUN" ? SFX.shotgun : SFX.plasma)();

    if (w.proj) { // plasma bolt
      this.projs.push({ x: this.px + this.dx * 0.4, y: this.py + this.dy * 0.4,
                        vx: this.dx * 9, vy: this.dy * 9, player: true,
                        dmg: w.dmg[0] + Math.random() * (w.dmg[1] - w.dmg[0]) });
      return;
    }
    // hitscan pellets
    const aim = Math.atan2(this.dy, this.dx);
    const targets = this.hitscanTargets();
    for (let p = 0; p < w.pellets; p++) {
      const off = (Math.random() * 2 - 1) * w.spread;
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
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.msgT > 0) this.msgT -= dt;

    // held-fire (plasma is auto)
    if (this.keys[" "] && WEAPONS[this.cur].proj) this.tryFire();

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
    if (ml > 0.001) { this.tryMove(this.px + (mvx / ml) * sp, this.py + (mvy / ml) * sp); moved = true; }
    this.bob += dt * (moved ? 9 : 2);

    // pickups
    for (let i = this.L.items.length - 1; i >= 0; i--) {
      const it = this.L.items[i];
      if (Math.hypot(it.x - this.px, it.y - this.py) < 0.55) {
        let took = true;
        if (it.kind === "h") { if (this.hp >= 100) took = false; else { this.hp = Math.min(100, this.hp + 25); this.say("+25 HEALTH", 1); } }
        else if (it.kind === "a") { this.bullets += 10; this.say("+10 BULLETS", 1); }
        else if (it.kind === "s") { this.shells += 4; this.say("+4 SHELLS", 1); }
        else if (it.kind === "c") { this.cells += 20; this.say("+20 CELLS", 1); }
        else if (it.kind === "k") { this.hasKey = true; this.say("GOLD KEYCARD ACQUIRED", 1.6); SFX.key(); }
        else if (it.kind === "W") { this.owned[1] = true; this.cur = 1; this.shells += 8; this.say("SHOTGUN! (KEY 2)", 1.8); SFX.key(); }
        else if (it.kind === "Q") { this.owned[2] = true; this.cur = 2; this.cells += 40; this.say("PLASMA RIFLE! (KEY 3)", 1.8); SFX.key(); }
        if (took) {
          if (it.kind !== "k" && it.kind !== "W" && it.kind !== "Q") SFX.pickup();
          this.pickFlash = 0.5; this.itemsGot++; this.score += 25;
          this.L.items.splice(i, 1);
        }
      }
    }

    // barrels queued to blow (chain reactions)
    for (let i = this.boomQueue.length - 1; i >= 0; i--) {
      this.boomQueue[i].t -= dt;
      if (this.boomQueue[i].t <= 0) { this.explodeBarrel(this.boomQueue[i].b); this.boomQueue.splice(i, 1); }
    }

    // enemies
    const dmgMul = 1 + this.levelIdx * 0.12;
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      if (e.state === "pain") { e.painT -= dt; if (e.painT <= 0) e.state = "chase"; continue; }
      const ex = this.px - e.x, ey = this.py - e.y;
      const dist = Math.hypot(ex, ey);
      const sees = dist < 10 && this.los(e.x, e.y, this.px, this.py);
      if (e.state === "idle") { if (sees) { e.state = "chase"; if (e.cfg.boss && !e.roared) { e.roared = true; this.say("THE CINDER KING AWAKENS", 2.2); SFX.roar(); this.shake = 0.6; } } else continue; }
      e.animT += dt * 5;
      e.atkT = Math.max(0, e.atkT - dt);

      const rng = e.cfg.ranged;
      if (rng && sees && dist > e.cfg.mrange && dist < 9) {
        // hold distance & cast fireballs
        if (dist > rng.hold) this.stepEnemy(e, ex / dist, ey / dist, dt);
        if (e.atkT <= 0) {
          e.atkT = rng.cd;
          e.state = "attack";
          SFX.fireball();
          const n = rng.spread || 1;
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
        this.stepEnemy(e, ex / dist, ey / dist, dt);
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
      if (this.wallAt(p.x, p.y)) {
        this.spawnParts(p.x, p.y, 4, p.player ? "#8ad8ff" : "#ff8a50", 1.2);
        this.projs.splice(i, 1); continue;
      }
      if (p.player) {
        let hit = false;
        const targets = this.hitscanTargets();
        for (let t = 0; t < targets.length; t++) {
          const tg = targets[t];
          if (Math.hypot(tg.x - p.x, tg.y - p.y) < tg.r + 0.12) {
            if (tg.e) this.damageEnemy(tg.e, p.dmg);
            else { tg.b.hp = 0; this.explodeBarrel(tg.b); }
            hit = true; break;
          }
        }
        if (hit) { this.spawnParts(p.x, p.y, 5, "#8ad8ff", 1.4); this.projs.splice(i, 1); }
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
        if (this.hasKey) { this.mode = "inter"; }
        else if (this.msgT <= 0) { this.say("THE EXIT NEEDS THE GOLD KEYCARD", 1.6); SFX.nokey(); }
        break;
      }
    }
  };
  Game.prototype.stepEnemy = function (e, ux, uy, dt) {
    const s = e.cfg.sp * dt, R = 0.3;
    const nx = e.x + ux * s, ny = e.y + uy * s;
    if (!this.wallAt(nx + (nx > e.x ? R : -R), e.y)) e.x = nx;
    if (!this.wallAt(e.x, ny + (ny > e.y ? R : -R))) e.y = ny;
  };

  // ============================ RENDER ============================
  Game.prototype.render = function () {
    const g = this.ctx;
    if (this.mode === "title") { this.renderTitle(g); return; }

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 7 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 5 : 0;
    g.save();
    g.translate(shakeX | 0, shakeY | 0);

    // ceiling & floor
    g.fillStyle = "#12141f"; g.fillRect(-8, -8, W + 16, VIEW_H / 2 + 8);
    g.fillStyle = "#26201b"; g.fillRect(-8, VIEW_H / 2, W + 16, VIEW_H / 2 + 8);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(-8, VIEW_H * 0.42, W + 16, VIEW_H * 0.16);

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
      while (!hit && guard++ < 80) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        if (mapY < 0 || mapY >= L.h || mapX < 0 || mapX >= L.w) { hit = 1; break; }
        if (L.map[mapY][mapX] > 0) hit = L.map[mapY][mapX];
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
    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      spr.push({ x: it.x, y: it.y, kind: it.kind, d: dist2(it.x - this.px, it.y - this.py) });
    }
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
      let img, yOff = 0;
      if (sp.e) {
        const e = sp.e;
        const frames = this.sprites[e.type];
        img = e.state === "dead" ? frames[4]
            : e.state === "pain" ? frames[3]
            : e.state === "attack" ? frames[2]
            : frames[(e.animT | 0) % 2];
        size = (size * e.cfg.scale) | 0;
        yOff = e.cfg.scale > 1 ? -(size * (e.cfg.scale - 1) * 0.18) : 0;
      } else if (sp.barrel) {
        img = this.items.B;
        size = (size * 0.8) | 0;
        yOff = size * 0.12;
      } else {
        img = this.items[sp.kind];
        size = (size * 0.72) | 0;
        yOff = size * 0.18;
      }
      const y0 = ((VIEW_H - size) / 2 + yOff) | 0;
      const x0 = sx - (size >> 1);
      const colW = Math.max(1, (size / 24) | 0);
      for (let cx = Math.max(0, x0); cx < Math.min(W, x0 + size); cx += colW) {
        if (this.zbuf[cx] <= trY) continue;
        const u = ((cx - x0) / size) * TEX;
        g.drawImage(img, u, 0, Math.max(1, (colW / size) * TEX), TEX, cx, y0, colW, size);
      }
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
      const r = Math.max(2, 7 / trY);
      g.fillStyle = p.player ? "rgba(138,216,255,0.35)" : "rgba(255,138,80,0.35)";
      g.beginPath(); g.arc(sx, VIEW_H / 2, r * 1.8, 0, 7); g.fill();
      g.fillStyle = p.player ? "#d5f4ff" : "#ffd07a";
      g.beginPath(); g.arc(sx, VIEW_H / 2, r, 0, 7); g.fill();
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
      g.fillRect(sx - r / 2, VIEW_H / 2 - r / 2 + (p.life / p.max) * 14 / trY, r, r);
      g.globalAlpha = 1;
    }

    this.renderGun(g);
    g.restore(); // shake

    // flashes
    if (this.dmgFlash > 0) { g.fillStyle = "rgba(200,30,30," + (this.dmgFlash * 0.4).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }
    if (this.pickFlash > 0) { g.fillStyle = "rgba(255,240,180," + (this.pickFlash * 0.22).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }

    // crosshair
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(W / 2 - 1, VIEW_H / 2 - 5, 2, 3); g.fillRect(W / 2 - 1, VIEW_H / 2 + 2, 2, 3);
    g.fillRect(W / 2 - 5, VIEW_H / 2 - 1, 3, 2); g.fillRect(W / 2 + 2, VIEW_H / 2 - 1, 3, 2);

    if (this.showMap) this.renderMap(g);
    this.renderHUD(g);

    // message
    if (this.msgT > 0 && this.msg) {
      g.font = "bold 10px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 12, W, 16);
      g.fillStyle = "#ffd75e"; g.fillText(this.msg, W / 2, 20);
      g.textAlign = "left";
    }

    // overlays
    if (this.mode === "pause") this.renderOverlay(g, "PAUSED", "#8ad8ff", "P or SPACE to resume");
    if (this.mode === "dead")  this.renderOverlay(g, "YOU DIED", "#ff5d52", "R or SPACE to retry  ·  score " + this.score);
    if (this.mode === "inter") this.renderTally(g, "LEVEL CLEARED!", this.levelIdx + 1 < LEVELS.length ? "SPACE for next level" : "SPACE to finish");
    if (this.mode === "win")   this.renderWin(g);
  };

  function dist2(a, b) { return a * a + b * b; }

  Game.prototype.renderGun = function (g) {
    const w = WEAPONS[this.cur];
    const bobX = Math.sin(this.bob) * 5, bobY = Math.abs(Math.cos(this.bob)) * 4;
    const kick = this.fireCd > w.rate - 0.1 ? w.kick : 0;
    const gx = W / 2 + bobX, gy = VIEW_H - 34 + bobY + kick;
    if (this.muzzle > 0) {
      g.fillStyle = w.proj ? "rgba(150,230,255,0.9)" : "rgba(255,230,140,0.9)";
      g.beginPath(); g.arc(gx, gy - 12, 9 + Math.random() * 6, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath(); g.arc(gx, gy - 12, 4, 0, 7); g.fill();
    }
    if (this.cur === 0) { // pistol
      g.fillStyle = "#2a2f3d"; g.fillRect(gx - 7, gy - 10, 14, 44);
      g.fillStyle = "#3a4254"; g.fillRect(gx - 10, gy + 6, 20, 30);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 10, gy + 6, 20, 3);
      g.fillStyle = "#12141c"; g.fillRect(gx - 4, gy - 8, 8, 6);
    } else if (this.cur === 1) { // shotgun
      g.fillStyle = "#23272f"; g.fillRect(gx - 14, gy - 8, 12, 42);
      g.fillStyle = "#2c313c"; g.fillRect(gx + 2, gy - 8, 12, 42);
      g.fillStyle = "#12141c"; g.fillRect(gx - 12, gy - 8, 8, 5); g.fillRect(gx + 4, gy - 8, 8, 5);
      g.fillStyle = "#5e3a1e"; g.fillRect(gx - 16, gy + 22, 32, 16);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 16, gy + 22, 32, 3);
    } else { // plasma
      g.fillStyle = "#1c2f42"; g.fillRect(gx - 12, gy - 6, 24, 40);
      g.fillStyle = "#8ad8ff"; g.fillRect(gx - 8, gy - 2, 6, 26); g.fillRect(gx + 2, gy - 2, 6, 26);
      g.fillStyle = "#d5f4ff"; g.fillRect(gx - 4, gy - 8, 8, 5);
      g.fillStyle = "#ffd75e"; g.fillRect(gx - 12, gy + 30, 24, 3);
    }
  };

  Game.prototype.renderMap = function (g) {
    const L = this.L, sc = Math.min(4, ((W * 0.36) / L.w) | 0) || 3;
    const mw = L.w * sc, mh = L.h * sc, ox = W - mw - 6, oy = 6;
    g.fillStyle = "rgba(4,5,11,0.78)"; g.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const v = L.map[y][x];
      if (!v) continue;
      g.fillStyle = v === 5 ? "#ffd75e" : "rgba(150,175,230,0.5)";
      g.fillRect(ox + x * sc, oy + y * sc, sc, sc);
    }
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i];
      if (e.state === "dead") continue;
      g.fillStyle = e.cfg.boss ? "#ff5d52" : "#c9333f";
      g.fillRect(ox + e.x * sc - 1, oy + e.y * sc - 1, e.cfg.boss ? 4 : 2, e.cfg.boss ? 4 : 2);
    }
    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      g.fillStyle = it.kind === "k" ? "#ffd75e" : "#8ad8ff";
      g.fillRect(ox + it.x * sc - 1, oy + it.y * sc - 1, 2, 2);
    }
    g.fillStyle = "#fff";
    g.fillRect(ox + this.px * sc - 1.5, oy + this.py * sc - 1.5, 3, 3);
    g.strokeStyle = "#fff"; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(ox + this.px * sc, oy + this.py * sc);
    g.lineTo(ox + (this.px + this.dx * 1.6) * sc, oy + (this.py + this.dy * 1.6) * sc);
    g.stroke();
  };

  Game.prototype.renderFace = function (g, x, y) {
    // doomguy-style status face, 22x22
    const hp = this.hp;
    g.fillStyle = "#0c0d12"; g.fillRect(x, y, 22, 22);
    g.fillStyle = hp > 66 ? "#d8a678" : hp > 33 ? "#c08a60" : "#a06848";
    g.fillRect(x + 3, y + 2, 16, 18);
    g.fillStyle = "#7a4a28"; g.fillRect(x + 3, y + 2, 16, 4); // hair
    if (hp <= 33) { g.fillStyle = "#a02020"; g.fillRect(x + 4, y + 5, 5, 3); g.fillRect(x + 14, y + 12, 4, 4); }
    // eyes — track a bit with bob for life
    const look = (Math.sin(this.bob * 0.5) * 1.5) | 0;
    g.fillStyle = "#fff";
    g.fillRect(x + 5, y + 8, 5, 3); g.fillRect(x + 12, y + 8, 5, 3);
    g.fillStyle = "#12141c";
    g.fillRect(x + 6 + look, y + 8, 2, 3); g.fillRect(x + 13 + look, y + 8, 2, 3);
    // mouth
    g.fillStyle = "#5a2418";
    if (this.pickFlash > 0.25) g.fillRect(x + 7, y + 15, 8, 3);           // grin
    else if (this.dmgFlash > 0.3) { g.fillStyle = "#3a0c08"; g.fillRect(x + 8, y + 14, 6, 4); } // ow
    else if (hp <= 33) g.fillRect(x + 8, y + 16, 6, 2);
    else g.fillRect(x + 7, y + 16, 8, 2);
  };

  Game.prototype.renderHUD = function (g) {
    g.fillStyle = "#0b0f1a"; g.fillRect(0, VIEW_H, W, HUD_H);
    g.fillStyle = "#232c47"; g.fillRect(0, VIEW_H, W, 1);
    this.renderFace(g, 3, VIEW_H + 3);
    g.font = "bold 9px monospace"; g.textBaseline = "middle"; g.textAlign = "left";
    // HP
    g.fillStyle = "#31121a"; g.fillRect(30, VIEW_H + 5, 52, 9);
    g.fillStyle = this.hp > 35 ? "#c9333f" : "#ff7043";
    g.fillRect(30, VIEW_H + 5, (52 * this.hp / 100) | 0, 9);
    g.fillStyle = "#fff"; g.fillText(String(this.hp), 34, VIEW_H + 10);
    // ammo for current weapon
    const w = WEAPONS[this.cur];
    g.fillStyle = "#8d99b8"; g.fillText("AMMO", 30, VIEW_H + 21);
    g.fillStyle = "#ffd75e"; g.fillText(String(this[w.ammo]), 62, VIEW_H + 21);
    // weapon slots
    for (let i = 0; i < 3; i++) {
      const owned = this.owned[i];
      g.fillStyle = i === this.cur ? "#ffd75e" : owned ? "#8ad8ff" : "#2a3350";
      g.fillText(String(i + 1), 92 + i * 12, VIEW_H + 10);
    }
    g.fillStyle = "#8d99b8"; g.fillText(w.name, 92, VIEW_H + 21);
    // keycard
    if (this.hasKey) {
      g.fillStyle = "#ffd75e"; g.fillRect(146, VIEW_H + 5, 7, 10);
      g.fillStyle = "#0b0f1a"; g.fillRect(148, VIEW_H + 7, 3, 3);
    } else {
      g.fillStyle = "#2a3350"; g.fillRect(146, VIEW_H + 5, 7, 10);
    }
    // kills
    g.fillStyle = "#8d99b8"; g.fillText("K", 160, VIEW_H + 10);
    g.fillStyle = "#8ad8ff"; g.fillText(this.kills + "/" + this.L.totKills, 170, VIEW_H + 10);
    // level + time
    g.fillStyle = "#8d99b8"; g.fillText("L" + (this.levelIdx + 1), 160, VIEW_H + 21);
    const tm = this.time | 0;
    g.fillText(((tm / 60) | 0) + ":" + ("0" + tm % 60).slice(-2), 178, VIEW_H + 21);
    // score
    g.textAlign = "right";
    g.fillStyle = "#ffd75e"; g.fillText("SCORE " + this.score, W - 5, VIEW_H + 10);
    g.fillStyle = "#8d99b8"; g.fillText("HI " + Math.max(this.hi, this.score), W - 5, VIEW_H + 21);
    g.textAlign = "left";
  };

  Game.prototype.renderOverlay = function (g, title, color, sub) {
    g.fillStyle = "rgba(4,5,11,0.62)"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 22px monospace"; g.fillStyle = color;
    g.fillText(title, W / 2, 84);
    g.font = "bold 9px monospace"; g.fillStyle = "#eef2ff";
    g.fillText(sub, W / 2, 108);
    g.textAlign = "left";
  };
  Game.prototype.renderTally = function (g, title, sub) {
    g.fillStyle = "rgba(4,5,11,0.78)"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 18px monospace"; g.fillStyle = "#ffd75e";
    g.fillText(title, W / 2, 46);
    g.font = "bold 10px monospace";
    const rows = [
      ["KILLS",  this.kills + " / " + this.L.totKills + "  (" + ((100 * this.kills / Math.max(1, this.L.totKills)) | 0) + "%)"],
      ["ITEMS",  this.itemsGot + " / " + this.L.totItems],
      ["TIME",   (((this.time | 0) / 60) | 0) + ":" + ("0" + (this.time | 0) % 60).slice(-2) + "   (par " + ((this.L.par / 60) | 0) + ":" + ("0" + this.L.par % 60).slice(-2) + ")"],
      ["SCORE",  String(this.score)]
    ];
    for (let i = 0; i < rows.length; i++) {
      g.fillStyle = "#8d99b8"; g.textAlign = "right"; g.fillText(rows[i][0], W / 2 - 10, 78 + i * 16);
      g.fillStyle = "#eef2ff"; g.textAlign = "left";  g.fillText(rows[i][1], W / 2 + 10, 78 + i * 16);
    }
    g.textAlign = "center"; g.fillStyle = "#8ad8ff";
    g.fillText(sub, W / 2, 160);
    g.textAlign = "left";
  };
  Game.prototype.renderWin = function (g) {
    g.fillStyle = "rgba(10,6,0,0.82)"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 20px monospace"; g.fillStyle = "#ffd75e";
    g.fillText("THE CINDER KING FALLS", W / 2, 44);
    g.font = "bold 10px monospace"; g.fillStyle = "#eef2ff";
    g.fillText("FINAL SCORE  " + this.score, W / 2, 74);
    g.fillStyle = this.score >= this.hi ? "#ffd75e" : "#8d99b8";
    g.fillText(this.score >= this.hi ? "★ NEW HI-SCORE ★" : "HI-SCORE  " + this.hi, W / 2, 92);
    g.fillStyle = "#8ad8ff";
    g.fillText("Now imagine what I could build for YOUR project.", W / 2, 120);
    g.fillStyle = "#8d99b8";
    g.fillText("SPACE to return to title", W / 2, 150);
    g.textAlign = "left";
  };
  Game.prototype.renderTitle = function (g) {
    g.fillStyle = "#070810"; g.fillRect(0, 0, W, H);
    // ember particles
    const t = performance.now() * 0.001;
    for (let i = 0; i < 26; i++) {
      const y = (H - ((t * (14 + i % 9) + i * 37) % H));
      g.fillStyle = i % 3 ? "rgba(255,138,80,0.5)" : "rgba(255,215,94,0.55)";
      g.fillRect(((i * 53 + Math.sin(t + i) * 8) % W + W) % W, y, 2, 2);
    }
    // demons flanking
    g.drawImage(this.sprites.imp[(t * 2 | 0) % 2], 22, 96, 64, 64);
    g.drawImage(this.sprites.boss[(t * 2 | 0) % 2], 226, 84, 76, 76);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 34px monospace";
    g.fillStyle = "#3a0c08"; g.fillText("INFERNO", W / 2 + 2, 52 + 2);
    g.fillStyle = "#ffd75e"; g.fillText("INFERNO", W / 2, 52);
    g.font = "bold 9px monospace"; g.fillStyle = "#ff8a50";
    g.fillText("— RAYMOND VDW'S DEMON PURGE —", W / 2, 74);
    g.fillStyle = "#eef2ff"; g.font = "bold 11px monospace";
    g.fillText(Math.sin(t * 4) > -0.2 ? "CLICK OR PRESS SPACE TO ENTER HELL" : "", W / 2, 116);
    g.font = "bold 8px monospace"; g.fillStyle = "#8d99b8";
    g.fillText("WASD MOVE · ARROWS/MOUSE TURN · SPACE/CLICK FIRE", W / 2, 148);
    g.fillText("1-3 WEAPONS · M MAP · P PAUSE · R RETRY", W / 2, 160);
    g.fillText("3 LEVELS · FIND THE GOLD KEYCARD · SLAY THE CINDER KING", W / 2, 172);
    if (this.hi > 0) { g.fillStyle = "#ffd75e"; g.fillText("HI-SCORE " + this.hi, W / 2, 188); }
    g.textAlign = "left";
  };

  Game.prototype.loop = function () {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.update(dt);
    this.render();
  };

  Game.prototype.destroy = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    removeEventListener("keydown", this._down);
    removeEventListener("keyup", this._up);
    removeEventListener("mousemove", this._mm);
    this.canvas.removeEventListener("mousedown", this._click);
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
