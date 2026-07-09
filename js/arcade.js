// js/arcade.js — "INFERNO" — a complete retro FPS built from scratch.
// Raycast renderer (DDA, textured walls, sliding doors, sprite billboards,
// per-column z-clipping) + full game: title screen, 3 weapons, 6 enemy types
// incl. a boss, projectiles, exploding barrels, keycards, auto + locked doors,
// pickups, particles, minimap, synthesized sound, score/tally screens,
// persistent hi-score, 4 big levels.
// No libraries, no image assets. API: window.initArcade(id) / window.destroyArcade().
(function () {
  "use strict";

  // ============================ LEVELS ============================
  // walls: # brick · T tech · S slime · M metal · X exit(needs key)
  //        D auto sliding door · G gold-locked door (needs keycard)
  // floor: . or space
  // enemies: E imp · C caster · U brute · F wraith · R gunner · Z boss
  // pickups: h health · a bullets · s shells · c cells · k keycard
  //          W shotgun · Q plasma · B exploding barrel
  const LEVELS = [
    {
      name: "E1: HANGAR OF REGRET", par: 110,
      rows: [
        "########################",
        "#P.....#......#....h...#",
        "#......D......D....E...#",
        "#..E...#..B...#........#",
        "#......#..E...#...s....#",
        "###D########......####D#",
        "#....#....F...#...a...k#",
        "#..W.#....#...D........#",
        "#..E.D....#...#...E....#",
        "#....#..B.#...#........#",
        "#....#....#.h.#...B....#",
        "####.#####D###....###D##",
        "#......#.......E......h#",
        "#..h...#..B.......E....#",
        "#..E...D...........a...#",
        "#......#....s.........X#",
        "#..a.B.#....#.........##",
        "#......#....#..k...##..#",
        "####D###....#####..D...#",
        "#....E.............E...#",
        "########################"
      ]
    },
    {
      name: "E2: THE GOLD FOUNDRY", par: 150,
      rows: [
        "##########################",
        "#P.....#.....C....#.....h#",
        "#......D..........D......#",
        "#..E...#....B.....#...R..#",
        "#......#....E.....#.....k#",
        "###D#######....######D####",
        "#....#....s........#.....#",
        "#..s.#....D....F...#..a..#",
        "#..E.#....#........D..E..#",
        "#....#....#####S####.....#",
        "###.D#....#.......#..###D#",
        "#...##....G.......#....C.#",
        "#..C.#....#....B..#......#",
        "#....#....#.......#..s...#",
        "#..a.#....#.......###D####",
        "###D########..F.........h#",
        "#......E..#....#....E....#",
        "#..h......D....#....D....#",
        "#.........#....#........G#",
        "#...B..R..#.B..#..a.....X#",
        "####.#####.####.####.###.#",
        "#..................E....##",
        "##########################"
      ]
    },
    {
      name: "E4: THE MAW", par: 200,
      rows: [
        "############################",
        "#P.....#......h......#.....#",
        "#......D.............D.....#",
        "#..R...#...B....B....#..U..#",
        "#......#.....F.......#....k#",
        "###D########....######D#####",
        "#.....#....s...c...#.......#",
        "#..s..#....D.......#....a..#",
        "#..U..#....#...F...D....C..#",
        "#.....#....#.......#.......#",
        "###.D######S##S#####..D#####",
        "#...##....#......#....#....#",
        "#..C.#....G......#....D..R.#",
        "#....#....#..Q...#....#....#",
        "#..a.#....#......#....#..s.#",
        "###D########..F...####D#####",
        "#........#........#...E...h#",
        "#..h..R..D...B....#...#....#",
        "#........#........#...#..c.#",
        "#..B..E..#...F....#...#...X#",
        "####.#####.######.####D##.##",
        "#.................E.......##",
        "############################"
      ]
    },
    {
      name: "E3: THRONE OF CINDER", par: 220,
      rows: [
        "######################",
        "#P.......#.....C....h#",
        "#...U....D...........#",
        "#......#.#...####....#",
        "#..s...#.....#..c....#",
        "###D###...####...#####",
        "#..c...#.........R..s#",
        "#..U...D..C....U.....#",
        "#......#.............#",
        "####.###R....h...##D##",
        "#........B..........s#",
        "#..M...........M....c#",
        "#...................a#",
        "#...B...F.Z.F....B...#",
        "#...................h#",
        "#..M...........M....c#",
        "#........B..........s#",
        "####D####....#####..##",
        "#....s..h.F....c....a#",
        "#...................R#",
        "######################"
      ]
    }
  ];
  const WALLS = { "#": 1, "T": 2, "S": 3, "M": 4, "X": 5, "D": 6, "G": 7 };
  const DOOR_SPEED = 2.2;   // openness units per second
  const DOOR_HOLD = 4;      // seconds a door stays open

  // ============================ CONFIG ============================
  // Base ("chrome") space: HUD/menus are authored in 320x200 coordinates and
  // drawn through a scale transform. The 3D view renders at SCALE x that —
  // up to 960x600 — chosen from the display and stepped down automatically
  // if the device can't keep up.
  const BW = 320, BH = 200, BHUD = 28, VIEW_B = BH - BHUD;
  let SCALE = 2, W = BW * 2, H = BH * 2, VIEW_H = VIEW_B * 2;
  const FOV_PLANE = 0.66;
  const TEX = 128; // art is authored in 64-space and rendered at 2x

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
    wraith: { hp: 16,  sp: 2.7,  scale: 0.9,  mdmg: [6, 10],  mrange: 0.95, score: 150, ghost: true,
              pal: { body: "#3e5a6e", skin: "#7da8c0", eye: "#d5f4ff" } },
    gunner: { hp: 40,  sp: 1.4,  scale: 1.05, mdmg: [6, 10],  mrange: 0.9,  score: 200,
              ranged: { cd: 1.15, speed: 7, dmg: [6, 10], hold: 5.5 },
              pal: { body: "#4a3a20", skin: "#8a6b3a", eye: "#ffb04a" } },
    boss:   { hp: 420, sp: 0.95, scale: 2.15, mdmg: [22, 30], mrange: 1.4,  score: 1000, boss: true,
              ranged: { cd: 1.5, speed: 4.6, dmg: [12, 18], hold: 7, spread: 3 },
              pal: { body: "#5a1010", skin: "#8a1f14", eye: "#ffd75e" } }
  };
  const ECHARS = { E: "imp", C: "caster", U: "brute", Z: "boss", F: "wraith", R: "gunner" };

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
    hurt:    function () { tone(180, 55, 0.24, "sawtooth", 0.13); noiseBurst(0.08, 0.08, 1200); },
    edie:    function () { tone(300, 42, 0.34, "square", 0.11); noiseBurst(0.18, 0.09, 700); },
    boom:    function () { noiseBurst(0.55, 0.34, 520); tone(85, 28, 0.5, "sine", 0.26); tone(200, 40, 0.3, "sawtooth", 0.12); },
    pickup:  function () { tone(620, 990, 0.1, "sine", 0.09); },
    key:     function () { tone(520, 780, 0.12, "sine", 0.1); tone(780, 1170, 0.14, "sine", 0.07); },
    nokey:   function () { tone(120, 110, 0.16, "square", 0.09); },
    switch:  function () { tone(240, 360, 0.05, "square", 0.07); noiseBurst(0.03, 0.05, 2600); },
    fireball:function () { tone(440, 150, 0.18, "sawtooth", 0.08); },
    roar:    function () { tone(95, 38, 0.8, "sawtooth", 0.2); noiseBurst(0.6, 0.14, 380); tone(60, 30, 0.7, "sine", 0.18); },
    empty:   function () { tone(90, 80, 0.05, "square", 0.06); },
    step:    function () {}
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
    const gold = mkTex(TEX, function (g) {
      g.fillStyle = "#3a2e10"; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#5e4718"; g.fillRect(3, 2, 58, 60);
      g.fillStyle = "#8a6b2a"; g.fillRect(6, 6, 52, 52);
      g.fillStyle = "#2a2008"; g.fillRect(30, 2, 4, 60);      // seam
      g.fillStyle = "#ffd75e"; g.fillRect(8, 8, 48, 4);
      // big keyhole medallion
      g.fillStyle = "#ffd75e"; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill();
      g.fillStyle = "#2a2008"; g.beginPath(); g.arc(32, 30, 3.5, 0, 7); g.fill();
      g.fillRect(30, 30, 4, 10);
    });
    const light = [null, brick, tech, slime, metal, exit, door, gold].map(function (t) { return t && polish(t); });
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

  // WRAITH — a floating spectral skull-ghost (translucency applied at draw time)
  function buildWraith(pal) {
    function frame(pose) {
      return mkTex(TEX, function (g) {
        if (pose === 4) {
          g.fillStyle = pal.body; g.globalAlpha = 0.4;
          g.beginPath(); g.ellipse(32, 40, 16, 6, 0, 0, 7); g.fill();
          g.globalAlpha = 1; return;
        }
        // wispy trailing tail
        g.fillStyle = pal.body;
        g.beginPath();
        g.moveTo(20, 30);
        g.quadraticCurveTo(14, 52, 22 + (pose === 1 ? 4 : 0), 60);
        g.quadraticCurveTo(32, 50, 42 - (pose === 1 ? 4 : 0), 60);
        g.quadraticCurveTo(50, 52, 44, 30);
        g.fill();
        // hooded head
        g.fillStyle = pose === 3 ? "#c0d8e8" : pal.skin;
        g.beginPath(); g.ellipse(32, 26, 15, 17, 0, 0, 7); g.fill();
        g.fillStyle = "#0a1016";
        g.beginPath(); g.ellipse(32, 30, 11, 13, 0, 0, 7); g.fill(); // hood shadow
        // glowing eyes
        g.fillStyle = pose === 2 ? "#fff" : pal.eye;
        g.fillRect(25, 26, 5, 6); g.fillRect(35, 26, 5, 6);
        g.fillStyle = "#8ad8ff"; g.fillRect(26, 27, 2, 3); g.fillRect(36, 27, 2, 3);
        // claws when attacking
        if (pose === 2) {
          g.fillStyle = pal.skin;
          g.fillRect(12, 34, 5, 12); g.fillRect(47, 34, 5, 12);
        }
      });
    }
    return [frame(0), frame(1), frame(2), frame(3), frame(4)];
  }

  // GUNNER — armoured demon soldier with a shoulder cannon
  function buildGunner(pal) {
    function frame(pose) {
      return mkTex(TEX, function (g) {
        if (pose === 4) {
          g.fillStyle = "#2a2010"; g.beginPath(); g.ellipse(32, 56, 20, 6, 0, 0, 7); g.fill();
          g.fillStyle = pal.body; g.beginPath(); g.ellipse(32, 53, 12, 5, 0, 0, 7); g.fill();
          g.fillStyle = "#5a6b7a"; g.fillRect(40, 48, 16, 5); // dropped gun
          return;
        }
        g.fillStyle = "#3a2e18";
        g.fillRect(24, 46, 7, 16); g.fillRect(33, 46, 7, 16);
        // armoured torso
        g.fillStyle = pose === 3 ? "#c0a070" : pal.body;
        g.fillRect(20, 22, 24, 26);
        g.fillStyle = "#5a6b7a"; g.fillRect(20, 22, 24, 5); // chest plate
        g.fillStyle = "#8d99b8"; g.fillRect(22, 30, 20, 2); g.fillRect(22, 38, 20, 2);
        // head
        g.fillStyle = pose === 3 ? "#d0b080" : pal.skin;
        g.beginPath(); g.ellipse(30, 16, 8, 8, 0, 0, 7); g.fill();
        g.fillStyle = pose === 2 ? "#fff" : pal.eye;
        g.fillRect(26, 14, 3, 4); g.fillRect(32, 14, 3, 4);
        // shoulder cannon (muzzle flashes on attack)
        g.fillStyle = "#4a5464"; g.fillRect(40, 20, 16, 8);
        g.fillStyle = "#2a3038"; g.fillRect(52, 21, 6, 6);
        if (pose === 2) { g.fillStyle = "#ffd75e"; g.beginPath(); g.arc(58, 24, 5, 0, 7); g.fill(); }
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
    const map = [], enemies = [], items = [], barrels = [], doors = {};
    let px = 1.5, py = 1.5;
    for (let y = 0; y < rows.length; y++) {
      const line = rows[y], row = [];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        const wv = WALLS[ch] || 0;
        row.push(wv);
        if (wv === 6 || wv === 7) {
          // door: open = 0 (shut) .. 1 (fully retracted); gold doors need the key
          doors[y * 1000 + x] = { x: x, y: y, open: 0, target: 0, gold: wv === 7, hold: 0 };
        }
        if (ch === "P") { px = x + 0.5; py = y + 0.5; }
        else if (ECHARS[ch]) {
          const cfg = ETYPES[ECHARS[ch]];
          enemies.push({ type: ECHARS[ch], cfg: cfg, x: x + 0.5, y: y + 0.5, hp: cfg.hp,
                         state: "idle", animT: 0, atkT: 1 + Math.random(), painT: 0, roared: false,
                         phase: 0, blink: 0 });
        }
        else if ("hasckWQ".indexOf(ch) >= 0) items.push({ x: x + 0.5, y: y + 0.5, kind: ch });
        else if (ch === "B") barrels.push({ x: x + 0.5, y: y + 0.5, hp: 12, dead: false });
      }
      map.push(row);
    }
    return { map: map, enemies: enemies, items: items, barrels: barrels, doors: doors,
             px: px, py: py, w: rows[0].length, h: rows.length,
             name: LEVELS[idx].name, par: LEVELS[idx].par,
             totKills: enemies.length, totItems: items.length };
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
      imp: buildDemon(ETYPES.imp.pal),
      caster: buildDemon(ETYPES.caster.pal),
      brute: buildDemon(ETYPES.brute.pal),
      boss: buildDemon(ETYPES.boss.pal),
      wraith: buildWraith(ETYPES.wraith.pal),
      gunner: buildGunner(ETYPES.gunner.pal)
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
    canvas.focus();

    this.loop = this.loop.bind(this);
    this._raf = requestAnimationFrame(this.loop);
  }

  Game.prototype.bindTouchControls = function () {
    const self = this;
    const root = document.getElementById("arcade-touch");
    if (!root) return;
    this._touchRoot = root;
    root.setAttribute("aria-hidden", "false");

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
      if (self.mode !== "play") self.press(" ");
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
      if (self.mode !== "play") { self.press(" "); return; }
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

    this._resetTouch = resetStick;
  };

  Game.prototype.setResolution = function (s) {
    SCALE = s;
    W = (BW * s) | 0; H = (BH * s) | 0; VIEW_H = (VIEW_B * s) | 0;
    this.canvas.width = W; this.canvas.height = H;
    this.zbuf = new Float64Array(W);
    const g = this.ctx;
    g.imageSmoothingEnabled = true; // smooth scaling — no chunky pixels
    // lighting gradients + vignette, cached per resolution
    this.ceilG = g.createLinearGradient(0, 0, 0, VIEW_H / 2);
    this.ceilG.addColorStop(0, "#1c2134");
    this.ceilG.addColorStop(1, "#0a0c14");
    this.floorG = g.createLinearGradient(0, VIEW_H / 2, 0, VIEW_H);
    this.floorG.addColorStop(0, "#16110e");
    this.floorG.addColorStop(1, "#332a22");
    this.vig = g.createRadialGradient(W / 2, VIEW_H / 2, VIEW_H * 0.45, W / 2, VIEW_H / 2, VIEW_H * 0.95);
    this.vig.addColorStop(0, "rgba(0,0,0,0)");
    this.vig.addColorStop(1, "rgba(0,0,0,0.42)");
    this._fr = 0; this._jank = 0;
  };

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
  Game.prototype.doorAt = function (mx, my) {
    return this.L.doors[my * 1000 + mx] || null;
  };
  // blocks movement / sight? doors count as solid until nearly open
  Game.prototype.solidAt = function (x, y) {
    const v = this.wallAt(x, y);
    if (v === 0) return false;
    if (v === 6 || v === 7) {
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
      if (d.gold && !this.hasKey) {
        if (byPlayer && this.msgT <= 0) { this.say("A GOLD DOOR — FIND THE KEYCARD", 1.4); SFX.nokey(); }
        continue;
      }
      if (d.gold && byPlayer && d.open === 0 && d.target === 0) SFX.key();
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
    if (this[w.ammo] <= 0) {
      this.fireCd = 0.5; // throttle the empty click when the fire button is held
      this.say("NO " + (w.ammo === "bullets" ? "BULLETS" : w.ammo.toUpperCase()) + " — SWITCH (1-3) OR FIND AMMO", 1.1);
      SFX.empty(); return;
    }
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

    // held-fire: mouse held always auto-fires; space auto-fires plasma
    if (this.mdown || (this.keys[" "] && WEAPONS[this.cur].proj)) this.tryFire();

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
    this.updateDoors(dt);

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
      // wraiths phase through walls, so they always "see" you within range
      const sees = e.cfg.ghost ? (dist < 12) : (dist < 10 && this.los(e.x, e.y, this.px, this.py));
      if (e.cfg.ghost) e.blink = (e.blink + dt) % 1e6;
      if (e.state === "idle") { if (sees) { e.state = "chase"; if (e.cfg.boss && !e.roared) { e.roared = true; this.say("THE CINDER KING AWAKENS", 2.2); SFX.roar(); this.shake = 0.6; } } else continue; }
      e.animT += dt * 5;
      e.atkT = Math.max(0, e.atkT - dt);

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
    // wraiths phase through walls; everyone else opens doors by bumping them
    if (e.cfg.ghost) { e.x = nx; e.y = ny; return; }
    this.bumpDoors(nx, e.y, false); this.bumpDoors(e.x, ny, false);
    if (!this.solidAt(nx + (nx > e.x ? R : -R), e.y)) e.x = nx;
    if (!this.solidAt(e.x, ny + (ny > e.y ? R : -R))) e.y = ny;
  };

  // ============================ RENDER ============================
  Game.prototype.render = function () {
    const g = this.ctx;
    if (this.mode === "title") { this.renderTitle(g); return; }

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 7 * SCALE : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 5 * SCALE : 0;
    const pad = 8 * SCALE;
    g.save();
    g.translate(shakeX | 0, shakeY | 0);

    // ceiling & floor — gradient lighting instead of flat fills
    g.fillStyle = this.ceilG;  g.fillRect(-pad, -pad, W + pad * 2, VIEW_H / 2 + pad);
    g.fillStyle = this.floorG; g.fillRect(-pad, VIEW_H / 2, W + pad * 2, VIEW_H / 2 + pad);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(-pad, VIEW_H * 0.42, W + pad * 2, VIEW_H * 0.16);

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
          if (v === 6 || v === 7) {
            // sliding door: panels retract to the sides, ray passes through the growing centre gap
            const dr = L.doors[mapY * 1000 + mapX];
            const o = dr ? dr.open : 0;
            const pd = side === 0 ? (mapX - this.px + (1 - stepX) / 2) / (rdx || 1e-9)
                                  : (mapY - this.py + (1 - stepY) / 2) / (rdy || 1e-9);
            let wx = side === 0 ? this.py + pd * rdy : this.px + pd * rdx; wx -= wx | 0;
            const pan = 0.5 * (1 - o);
            if (wx > pan && wx < 1 - pan) continue; // open gap
            hit = v;
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
      const r = Math.max(2, (VIEW_H * 0.041) / trY);
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
      g.fillRect(sx - r / 2, VIEW_H / 2 - r / 2 + (p.life / p.max) * (VIEW_H * 0.08) / trY, r, r);
      g.globalAlpha = 1;
    }

    this.renderGun(g);
    g.restore(); // shake

    // vignette (cached gradient — one fill)
    g.fillStyle = this.vig; g.fillRect(0, 0, W, VIEW_H);

    // flashes
    if (this.dmgFlash > 0) { g.fillStyle = "rgba(200,30,30," + (this.dmgFlash * 0.4).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }
    if (this.pickFlash > 0) { g.fillStyle = "rgba(255,240,180," + (this.pickFlash * 0.22).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }

    // crosshair (chrome space)
    g.save(); g.scale(SCALE, SCALE);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(BW / 2 - 1, VIEW_B / 2 - 5, 2, 3); g.fillRect(BW / 2 - 1, VIEW_B / 2 + 2, 2, 3);
    g.fillRect(BW / 2 - 5, VIEW_B / 2 - 1, 3, 2); g.fillRect(BW / 2 + 2, VIEW_B / 2 - 1, 3, 2);
    g.restore();

    if (this.showMap) this.renderMap(g);
    this.renderBossBar(g);
    this.renderHUD(g);

    // message
    if (this.msgT > 0 && this.msg) {
      g.save(); g.scale(SCALE, SCALE);
      g.font = "bold 10px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 12, BW, 16);
      g.fillStyle = "#ffd75e"; g.fillText(this.msg, BW / 2, 20);
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
    g.save(); g.scale(SCALE, SCALE); // chrome space
    const w = WEAPONS[this.cur];
    const bobX = Math.sin(this.bob) * 5, bobY = Math.abs(Math.cos(this.bob)) * 4;
    const kick = this.fireCd > w.rate - 0.1 ? w.kick : 0;
    const gx = BW / 2 + bobX, gy = VIEW_B - 34 + bobY + kick;
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
                  : v === 7 ? "#ffcf5e"                    // gold door
                  : v === 6 ? "rgba(138,216,255,0.7)"     // auto door
                  : "rgba(150,175,230,0.5)";
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

  Game.prototype.renderHUD = function (g) {
    g.save(); g.scale(SCALE, SCALE); // chrome space
    g.fillStyle = "#0b0f1a"; g.fillRect(0, VIEW_B, BW, BHUD);
    g.fillStyle = "#232c47"; g.fillRect(0, VIEW_B, BW, 1);
    this.renderFace(g, 3, VIEW_B + 3);
    g.font = "bold 9px monospace"; g.textBaseline = "middle"; g.textAlign = "left";
    // HP
    g.fillStyle = "#31121a"; g.fillRect(30, VIEW_B + 5, 52, 9);
    g.fillStyle = this.hp > 35 ? "#c9333f" : "#ff7043";
    g.fillRect(30, VIEW_B + 5, (52 * this.hp / 100) | 0, 9);
    g.fillStyle = "#fff"; g.fillText(String(this.hp), 34, VIEW_B + 10);
    // ammo for current weapon
    const w = WEAPONS[this.cur];
    g.fillStyle = "#8d99b8"; g.fillText("AMMO", 30, VIEW_B + 21);
    g.fillStyle = "#ffd75e"; g.fillText(String(this[w.ammo]), 62, VIEW_B + 21);
    // weapon slots
    for (let i = 0; i < 3; i++) {
      const owned = this.owned[i];
      g.fillStyle = i === this.cur ? "#ffd75e" : owned ? "#8ad8ff" : "#2a3350";
      g.fillText(String(i + 1), 92 + i * 12, VIEW_B + 10);
    }
    g.fillStyle = "#8d99b8"; g.fillText(w.name, 92, VIEW_B + 21);
    // keycard
    if (this.hasKey) {
      g.fillStyle = "#ffd75e"; g.fillRect(146, VIEW_B + 5, 7, 10);
      g.fillStyle = "#0b0f1a"; g.fillRect(148, VIEW_B + 7, 3, 3);
    } else {
      g.fillStyle = "#2a3350"; g.fillRect(146, VIEW_B + 5, 7, 10);
    }
    // kills
    g.fillStyle = "#8d99b8"; g.fillText("K", 160, VIEW_B + 10);
    g.fillStyle = "#8ad8ff"; g.fillText(this.kills + "/" + this.L.totKills, 170, VIEW_B + 10);
    // level + time
    g.fillStyle = "#8d99b8"; g.fillText("L" + (this.levelIdx + 1), 160, VIEW_B + 21);
    const tm = this.time | 0;
    g.fillText(((tm / 60) | 0) + ":" + ("0" + tm % 60).slice(-2), 178, VIEW_B + 21);
    // score
    g.textAlign = "right";
    g.fillStyle = "#ffd75e"; g.fillText("SCORE " + this.score, BW - 5, VIEW_B + 10);
    g.fillStyle = "#8d99b8"; g.fillText("HI " + Math.max(this.hi, this.score), BW - 5, VIEW_B + 21);
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
    g.fillStyle = "rgba(4,5,11,0.78)"; g.fillRect(0, 0, BW, BH);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 18px monospace"; g.fillStyle = "#ffd75e";
    g.fillText(title, BW / 2, 46);
    g.font = "bold 10px monospace";
    const rows = [
      ["KILLS",  this.kills + " / " + this.L.totKills + "  (" + ((100 * this.kills / Math.max(1, this.L.totKills)) | 0) + "%)"],
      ["ITEMS",  this.itemsGot + " / " + this.L.totItems],
      ["TIME",   (((this.time | 0) / 60) | 0) + ":" + ("0" + (this.time | 0) % 60).slice(-2) + "   (par " + ((this.L.par / 60) | 0) + ":" + ("0" + this.L.par % 60).slice(-2) + ")"],
      ["SCORE",  String(this.score)]
    ];
    for (let i = 0; i < rows.length; i++) {
      g.fillStyle = "#8d99b8"; g.textAlign = "right"; g.fillText(rows[i][0], BW / 2 - 10, 78 + i * 16);
      g.fillStyle = "#eef2ff"; g.textAlign = "left";  g.fillText(rows[i][1], BW / 2 + 10, 78 + i * 16);
    }
    g.textAlign = "center"; g.fillStyle = "#8ad8ff";
    g.fillText(sub, BW / 2, 160);
    g.restore();
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
    g.font = "bold 8px monospace"; g.fillStyle = "#8d99b8";
    g.fillText("WASD MOVE · MOVE MOUSE OR ARROWS TO AIM", BW / 2, 148);
    g.fillText("HOLD CLICK / SPACE = FIRE · 1-3 WEAPONS · M MAP · P PAUSE", BW / 2, 160);
    g.fillText("4 LEVELS · 6 DEMON BREEDS · OPEN THE DOORS · SLAY THE CINDER KING", BW / 2, 172);
    if (this.hi > 0) { g.fillStyle = "#ffd75e"; g.fillText("HI-SCORE " + this.hi, BW / 2, 188); }
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
    if (this._raf) cancelAnimationFrame(this._raf);
    removeEventListener("keydown", this._down);
    removeEventListener("keyup", this._up);
    removeEventListener("mousemove", this._mm);
    removeEventListener("mouseup", this._mu);
    this.canvas.removeEventListener("mousedown", this._md);
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
