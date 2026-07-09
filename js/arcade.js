// js/arcade.js — "INFERNO" — a tiny retro FPS built from scratch.
// Raycast renderer (DDA, textured walls, sprite billboards with per-column
// z-clipping), procedural art, two levels, combat, pickups, HUD.
// No libraries. API: window.initArcade(canvasId) / window.destroyArcade().
(function () {
  "use strict";

  // ============================ LEVELS ============================
  // # brick · T tech · S slime · M metal · X exit wall
  // . floor · P player start · E enemy · h health · a ammo
  const LEVELS = [
    {
      name: "E1: HANGAR OF REGRET",
      rows: [
        "################",
        "#P.....#....h..#",
        "#......#.......#",
        "#..E...#...E...#",
        "#......T.......#",
        "###T#### ......#",   // note: space == floor too
        "#..a...#####T###",
        "#......S.......#",
        "#..E...S...E...#",
        "#......S.......#",
        "#h.....S....a..#",
        "####.###...#####",
        "#........E.....#",
        "#..a...........X",
        "#............h.#",
        "################"
      ]
    },
    {
      name: "E2: THE GOLD FOUNDRY",
      rows: [
        "####################",
        "#P........#....E..h#",
        "#.....E...#........#",
        "#..........T...E...#",
        "####T###..#........#",
        "#......#..####..####",
        "#..E...M.....a.....#",
        "#......#..E........#",
        "#..a...#......###S##",
        "###.####..h...S....#",
        "#.........E...S..E.#",
        "#..h..........S....#",
        "#......E......S..a.#",
        "#..................X",
        "#..a......E......h.#",
        "####################"
      ]
    }
  ];
  const WALLS = { "#": 1, "T": 2, "S": 3, "M": 4, "X": 5 };

  // ============================ ART (procedural) ============================
  const TEX = 64;
  function mkTex(draw) {
    const c = document.createElement("canvas");
    c.width = c.height = TEX;
    draw(c.getContext("2d"));
    return c;
  }
  function darken(tex) {
    const c = document.createElement("canvas");
    c.width = c.height = TEX;
    const g = c.getContext("2d");
    g.drawImage(tex, 0, 0);
    g.fillStyle = "rgba(0,0,0,0.36)";
    g.fillRect(0, 0, TEX, TEX);
    return c;
  }
  function buildTextures() {
    const brick = mkTex(g => {
      g.fillStyle = "#4a1f16"; g.fillRect(0, 0, TEX, TEX);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const off = (y % 2) * 8;
        g.fillStyle = ["#6b2a1c", "#75301f", "#61261a", "#70392a"][(x + y * 3) % 4];
        g.fillRect(x * 16 + off - 8, y * 16, 15, 15);
      }
      g.fillStyle = "rgba(0,0,0,.35)";
      for (let y = 0; y < 4; y++) g.fillRect(0, y * 16 + 15, TEX, 1);
    });
    const tech = mkTex(g => {
      g.fillStyle = "#1a2236"; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = "#232c47"; g.fillRect(4, 4, 56, 56);
      g.fillStyle = "#2c3a5e"; g.fillRect(8, 8, 48, 20);
      g.fillStyle = "#ffd75e"; g.fillRect(8, 32, 48, 3);
      g.fillStyle = "#8ad8ff"; g.fillRect(12, 42, 8, 8); g.fillRect(28, 42, 8, 8); g.fillRect(44, 42, 8, 8);
      g.fillStyle = "#0e1626";
      for (const [x, y] of [[6,6],[56,6],[6,56],[56,56]]) g.fillRect(x, y, 2, 2);
    });
    const slime = mkTex(g => {
      g.fillStyle = "#242e24"; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = ["#2e402c", "#39543a", "#1d271d", "#456349"][i % 4];
        const s = 4 + (i * 7) % 12;
        g.fillRect((i * 23) % TEX, (i * 41) % TEX, s, s);
      }
      g.fillStyle = "rgba(90,200,120,.25)";
      for (let i = 0; i < 6; i++) g.fillRect((i * 31) % TEX, (i * 17) % TEX, 3, 10 + (i * 5) % 12);
    });
    const metal = mkTex(g => {
      g.fillStyle = "#20242e"; g.fillRect(0, 0, TEX, TEX);
      for (let x = 0; x < 4; x++) {
        g.fillStyle = x % 2 ? "#272c38" : "#1b1f28";
        g.fillRect(x * 16, 0, 16, TEX);
        g.fillStyle = "#3a4254"; g.fillRect(x * 16, 0, 1, TEX);
      }
      g.fillStyle = "#4a5468";
      for (let i = 0; i < 8; i++) g.fillRect(6 + (i % 4) * 16, 8 + ((i / 4) | 0) * 44, 3, 3);
    });
    const exit = mkTex(g => {
      g.fillStyle = "#0c0d12"; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = "#ffd75e"; g.lineWidth = 4; g.strokeRect(4, 4, 56, 56);
      g.fillStyle = "#ffd75e";
      g.font = "bold 16px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("EXIT", 32, 26);
      g.fillStyle = "#8ad8ff"; g.fillRect(16, 40, 32, 10);
      g.fillStyle = "#0c0d12"; g.font = "bold 9px monospace"; g.fillText("→", 32, 45);
    });
    const light = [null, brick, tech, slime, metal, exit];
    return { light: light, dark: [null].concat(light.slice(1).map(darken)) };
  }

  // demon sprite frames: 0/1 walk, 2 attack, 3 pain, 4 dead
  function buildImp() {
    function frame(pose) {
      return mkTex(g => {
        g.clearRect(0, 0, TEX, TEX);
        if (pose === 4) { // dead — a smear and horns
          g.fillStyle = "#3d1210"; g.beginPath(); g.ellipse(32, 56, 20, 6, 0, 0, 7); g.fill();
          g.fillStyle = "#5a2418"; g.beginPath(); g.ellipse(32, 53, 12, 5, 0, 0, 7); g.fill();
          g.fillStyle = "#d8c9a8";
          g.beginPath(); g.moveTo(22, 52); g.lineTo(18, 44); g.lineTo(25, 49); g.fill();
          g.beginPath(); g.moveTo(42, 52); g.lineTo(46, 44); g.lineTo(39, 49); g.fill();
          return;
        }
        const bodyC = pose === 3 ? "#c98a7a" : "#7a2d1c";
        const skinC = pose === 3 ? "#e8b0a0" : "#8f3a24";
        // legs
        g.fillStyle = "#571f12";
        g.fillRect(24, 46, 7, 16); g.fillRect(33, 46, 7, 16);
        // body
        g.fillStyle = bodyC;
        g.beginPath(); g.ellipse(32, 36, 13, 15, 0, 0, 7); g.fill();
        // arms
        g.fillStyle = skinC;
        if (pose === 2) { // attack: claws raised
          g.fillRect(13, 18, 6, 16); g.fillRect(45, 18, 6, 16);
          g.fillStyle = "#e8e0c8";
          g.fillRect(12, 14, 8, 5); g.fillRect(44, 14, 8, 5);
        } else if (pose === 1) {
          g.fillRect(15, 34, 6, 14); g.fillRect(43, 30, 6, 14);
        } else {
          g.fillRect(15, 30, 6, 14); g.fillRect(43, 34, 6, 14);
        }
        // head
        g.fillStyle = skinC;
        g.beginPath(); g.ellipse(32, 18, 10, 9, 0, 0, 7); g.fill();
        // horns
        g.fillStyle = "#d8c9a8";
        g.beginPath(); g.moveTo(24, 14); g.lineTo(19, 4); g.lineTo(27, 10); g.fill();
        g.beginPath(); g.moveTo(40, 14); g.lineTo(45, 4); g.lineTo(37, 10); g.fill();
        // eyes
        g.fillStyle = pose === 3 ? "#fff" : "#ffe14a";
        g.fillRect(27, 15, 4, 4); g.fillRect(34, 15, 4, 4);
        g.fillStyle = "#e33"; g.fillRect(28, 16, 2, 2); g.fillRect(35, 16, 2, 2);
        // mouth
        g.fillStyle = "#2a0a06"; g.fillRect(28, 23, 9, 3);
        if (pose === 2) { g.fillStyle = "#fff"; g.fillRect(28, 23, 2, 3); g.fillRect(34, 23, 2, 3); }
      });
    }
    return [frame(0), frame(1), frame(2), frame(3), frame(4)];
  }
  function buildPickups() {
    const health = mkTex(g => {
      g.fillStyle = "#e8e8f0"; g.fillRect(18, 34, 28, 22);
      g.fillStyle = "#c9333f"; g.fillRect(28, 38, 8, 14); g.fillRect(22, 42, 20, 6);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(18, 52, 28, 4);
    });
    const ammo = mkTex(g => {
      g.fillStyle = "#8a6b2a"; g.fillRect(18, 40, 28, 16);
      g.fillStyle = "#ffd75e"; g.fillRect(18, 36, 28, 6);
      g.fillStyle = "#5e4718"; g.fillRect(20, 44, 24, 2); g.fillRect(20, 50, 24, 2);
      g.fillStyle = "#2a2010"; g.font = "bold 9px monospace"; g.textAlign = "center";
      g.fillText("AMMO", 32, 39.5);
    });
    return { h: health, a: ammo };
  }

  // ============================ GAME ============================
  const W = 320, H = 200, HUD_H = 26, VIEW_H = H - HUD_H;
  const FOV_PLANE = 0.66;

  let G = null; // active game instance

  function parseLevel(idx) {
    const rows = LEVELS[idx].rows;
    const map = [], enemies = [], items = [];
    let px = 1.5, py = 1.5;
    for (let y = 0; y < rows.length; y++) {
      const line = rows[y], row = [];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        row.push(WALLS[ch] || 0);
        if (ch === "P") { px = x + 0.5; py = y + 0.5; }
        if (ch === "E") enemies.push({ x: x + 0.5, y: y + 0.5, hp: 30, state: "idle", frame: 0, animT: 0, atkT: 0, painT: 0, deadT: 0 });
        if (ch === "h") items.push({ x: x + 0.5, y: y + 0.5, kind: "h" });
        if (ch === "a") items.push({ x: x + 0.5, y: y + 0.5, kind: "a" });
      }
      map.push(row);
    }
    return { map, enemies, items, px, py, w: rows[0].length, h: rows.length, name: LEVELS[idx].name };
  }

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.tex = buildTextures();
    this.imp = buildImp();
    this.pick = buildPickups();
    this.zbuf = new Float64Array(W);
    this.keys = {};
    this.levelIdx = 0;
    this.hp = 100; this.ammo = 24; this.kills = 0;
    this.msg = ""; this.msgT = 0;
    this.dmgFlash = 0; this.pickFlash = 0; this.muzzle = 0; this.fireCd = 0;
    this.bob = 0; this.over = null; // null | "dead" | "win"
    this.running = true;
    this._last = performance.now();
    this.loadLevel(0);

    // ---- input ----
    const self = this;
    this._down = function (e) {
      const k = e.key.toLowerCase();
      if (["arrowup","arrowdown","arrowleft","arrowright"," ","w","a","s","d","r"].indexOf(k) >= 0) e.preventDefault();
      self.keys[k] = true;
      if (k === "r") self.restart();
      if (k === " ") self.tryFire();
    };
    this._up = function (e) { self.keys[e.key.toLowerCase()] = false; };
    this._click = function () {
      if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        try { canvas.requestPointerLock(); } catch (err) {}
      }
      self.tryFire();
    };
    this._mm = function (e) {
      if (document.pointerLockElement === canvas) self.rotate(e.movementX * 0.0032);
    };
    addEventListener("keydown", this._down);
    addEventListener("keyup", this._up);
    canvas.addEventListener("mousedown", this._click);
    addEventListener("mousemove", this._mm);
    canvas.focus();

    // sfx pool
    this.sfx = [];
    for (let i = 0; i < 3; i++) {
      const a = new Audio("assets/audio/shoot.mp3");
      a.volume = 0.14;
      this.sfx.push(a);
    }
    this.sfxI = 0;

    this.loop = this.loop.bind(this);
    this._raf = requestAnimationFrame(this.loop);
  }

  Game.prototype.loadLevel = function (idx) {
    this.levelIdx = idx;
    this.L = parseLevel(idx);
    this.px = this.L.px; this.py = this.L.py;
    this.dx = 1; this.dy = 0; this.plx = 0; this.ply = FOV_PLANE;
    this.kills = 0;
    this.say(this.L.name, 2.6);
  };
  Game.prototype.restart = function () {
    if (this.over === "win") { this.hp = 100; this.ammo = 24; this.over = null; this.loadLevel(0); return; }
    this.hp = 100; this.ammo = 24; this.over = null;
    this.loadLevel(this.levelIdx);
  };
  Game.prototype.say = function (t, secs) { this.msg = t; this.msgT = secs; };
  Game.prototype.playShot = function () {
    if (window.__RVDW_MUTED) return;
    const a = this.sfx[this.sfxI++ % this.sfx.length];
    try { a.currentTime = 0; a.play().catch(function(){}); } catch (e) {}
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

  Game.prototype.tryFire = function () {
    if (this.over || this.fireCd > 0) return;
    if (this.ammo <= 0) { this.say("OUT OF AMMO — find gold boxes", 1.4); return; }
    this.ammo--; this.fireCd = 0.34; this.muzzle = 0.09;
    this.playShot();
    // hitscan: nearest living enemy near screen center with LOS
    let best = null, bestD = 1e9;
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") continue;
      const ex = e.x - this.px, ey = e.y - this.py;
      const dist = Math.hypot(ex, ey);
      // angle between aim direction and enemy
      const aim = Math.atan2(this.dy, this.dx);
      let da = Math.atan2(ey, ex) - aim;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const halfWidth = Math.atan2(0.38, dist); // enemy body half-width
      if (Math.abs(da) < halfWidth + 0.02 && dist < bestD && this.los(this.px, this.py, e.x, e.y)) {
        best = e; bestD = dist;
      }
    }
    if (best) {
      best.hp -= 12 + Math.random() * 6;
      if (best.hp <= 0) {
        best.state = "dead"; best.deadT = 0; this.kills++;
        this.say("DEMON DOWN", 0.8);
      } else {
        best.state = "pain"; best.painT = 0.28;
      }
    }
  };

  Game.prototype.update = function (dt) {
    if (this.over) return;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 2);
    this.pickFlash = Math.max(0, this.pickFlash - dt * 2);
    if (this.msgT > 0) this.msgT -= dt;

    // movement
    const sp = 3.1 * dt, rot = 2.4 * dt;
    let mvx = 0, mvy = 0, moved = false;
    if (this.keys["w"] || this.keys["arrowup"])   { mvx += this.dx; mvy += this.dy; }
    if (this.keys["s"] || this.keys["arrowdown"]) { mvx -= this.dx; mvy -= this.dy; }
    if (this.keys["a"]) { mvx += this.dy; mvy -= this.dx; }   // strafe left
    if (this.keys["d"]) { mvx -= this.dy; mvy += this.dx; }   // strafe right
    if (this.keys["arrowleft"])  this.rotate(-rot);
    if (this.keys["arrowright"]) this.rotate(rot);
    const ml = Math.hypot(mvx, mvy);
    if (ml > 0.001) {
      this.tryMove(this.px + (mvx / ml) * sp, this.py + (mvy / ml) * sp);
      moved = true;
    }
    this.bob += dt * (moved ? 9 : 2);

    // pickups
    for (let i = this.L.items.length - 1; i >= 0; i--) {
      const it = this.L.items[i];
      if (Math.hypot(it.x - this.px, it.y - this.py) < 0.55) {
        if (it.kind === "h") { this.hp = Math.min(100, this.hp + 25); this.say("+25 HEALTH", 1); }
        else { this.ammo += 8; this.say("+8 AMMO", 1); }
        this.pickFlash = 0.5;
        this.L.items.splice(i, 1);
      }
    }

    // enemies
    for (let i = 0; i < this.L.enemies.length; i++) {
      const e = this.L.enemies[i];
      if (e.state === "dead") { e.deadT += dt; continue; }
      if (e.state === "pain") {
        e.painT -= dt;
        if (e.painT <= 0) e.state = "chase";
        continue;
      }
      const ex = this.px - e.x, ey = this.py - e.y;
      const dist = Math.hypot(ex, ey);
      const sees = dist < 9 && this.los(e.x, e.y, this.px, this.py);
      if (e.state === "idle" && sees) e.state = "chase";
      if (e.state === "chase" || e.state === "attack") {
        e.animT += dt * 5;
        e.atkT = Math.max(0, e.atkT - dt);
        if (dist > 1.05 && sees) {
          e.state = "chase";
          const s = 1.7 * dt;
          const nx = e.x + (ex / dist) * s, ny = e.y + (ey / dist) * s;
          const R = 0.3;
          if (!this.wallAt(nx + (nx > e.x ? R : -R), e.y)) e.x = nx;
          if (!this.wallAt(e.x, ny + (ny > e.y ? R : -R))) e.y = ny;
        } else if (dist <= 1.05) {
          e.state = "attack";
          if (e.atkT <= 0) {
            e.atkT = 1.0;
            this.hp -= 8 + (Math.random() * 6 | 0);
            this.dmgFlash = 0.6;
            if (this.hp <= 0) { this.hp = 0; this.over = "dead"; this.say("", 0); }
          }
        }
      }
    }

    // exit check: any adjacent tile is the exit wall
    const tx = this.px | 0, ty = this.py | 0;
    const near = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = 0; i < 4; i++) {
      if (this.wallAt(tx + near[i][0], ty + near[i][1]) === 5) {
        if (this.levelIdx + 1 < LEVELS.length) {
          this.loadLevel(this.levelIdx + 1);
          this.say(this.L.name, 2.6);
        } else {
          this.over = "win";
        }
        break;
      }
    }
  };

  // ============================ RENDER ============================
  Game.prototype.render = function () {
    const g = this.ctx, L = this.L;

    // ceiling & floor
    g.fillStyle = "#12141f"; g.fillRect(0, 0, W, VIEW_H / 2);
    g.fillStyle = "#26201b"; g.fillRect(0, VIEW_H / 2, W, VIEW_H / 2);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, VIEW_H * 0.42, W, VIEW_H * 0.16); // horizon depth haze

    // walls (DDA per column)
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
      while (!hit && guard++ < 64) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        if (mapY < 0 || mapY >= L.h || mapX < 0 || mapX >= L.w) { hit = 1; break; }
        if (L.map[mapY][mapX] > 0) hit = L.map[mapY][mapX];
      }
      const dist = side === 0 ? (mapX - this.px + (1 - stepX) / 2) / (rdx || 1e-9)
                              : (mapY - this.py + (1 - stepY) / 2) / (rdy || 1e-9);
      const d = Math.max(0.04, dist);
      this.zbuf[x] = d;
      const lh = (VIEW_H / d) | 0;
      const y0 = Math.max(0, (VIEW_H - lh) >> 1);
      const drawY = (VIEW_H - lh) / 2;
      let wallX = side === 0 ? this.py + d * rdy : this.px + d * rdx;
      wallX -= wallX | 0;
      let texX = (wallX * TEX) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = TEX - texX - 1;
      const texSet = side === 1 ? this.tex.dark : this.tex.light;
      const t = texSet[hit] || texSet[1];
      g.drawImage(t, texX, 0, 1, TEX, x, drawY, 1, lh);
      // distance fog (cheap: darken far columns)
      if (d > 3.4) {
        g.fillStyle = "rgba(6,7,12," + Math.min(0.72, (d - 3.4) * 0.13).toFixed(2) + ")";
        g.fillRect(x, y0, 1, Math.min(lh, VIEW_H));
      }
    }

    // sprites (enemies + items), far → near
    const spr = [];
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i];
      spr.push({ x: e.x, y: e.y, e: e, kind: "e",
                 d: (e.x - this.px) * (e.x - this.px) + (e.y - this.py) * (e.y - this.py) });
    }
    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      spr.push({ x: it.x, y: it.y, kind: it.kind,
                 d: (it.x - this.px) * (it.x - this.px) + (it.y - this.py) * (it.y - this.py) });
    }
    spr.sort(function (a, b) { return b.d - a.d; });

    const invDet = 1 / (this.plx * this.dy - this.dx * this.ply);
    for (let s = 0; s < spr.length; s++) {
      const sp = spr[s];
      const rx = sp.x - this.px, ry = sp.y - this.py;
      const trX = invDet * (this.dy * rx - this.dx * ry);
      const trY = invDet * (-this.ply * rx + this.plx * ry);
      if (trY <= 0.1) continue; // behind camera
      const sx = ((W / 2) * (1 + trX / trY)) | 0;
      let size = Math.abs((VIEW_H / trY) | 0);
      let img;
      if (sp.kind === "e") {
        const e = sp.e;
        img = e.state === "dead" ? this.imp[4]
            : e.state === "pain" ? this.imp[3]
            : e.state === "attack" ? this.imp[2]
            : this.imp[(e.animT | 0) % 2];
      } else {
        img = this.pick[sp.kind];
        size = (size * 0.72) | 0;
      }
      const y0 = ((VIEW_H - size) / 2 + (sp.kind === "e" ? 0 : size * 0.18)) | 0;
      const x0 = sx - (size >> 1);
      // per-column z-clip against walls
      const colW = Math.max(1, (size / 24) | 0); // draw in small vertical strips
      for (let cx = Math.max(0, x0); cx < Math.min(W, x0 + size); cx += colW) {
        if (this.zbuf[cx] <= trY) continue;
        const u = ((cx - x0) / size) * TEX;
        g.drawImage(img, u, 0, Math.max(1, (colW / size) * TEX), TEX, cx, y0, colW, size);
      }
    }

    // ---- weapon ----
    const bobX = Math.sin(this.bob) * 5, bobY = Math.abs(Math.cos(this.bob)) * 4;
    const gx = W / 2 + bobX, gy = VIEW_H - 34 + bobY + (this.fireCd > 0.24 ? 6 : 0);
    if (this.muzzle > 0) {
      g.fillStyle = "rgba(255,230,140,0.9)";
      g.beginPath(); g.arc(gx, gy - 12, 10 + Math.random() * 5, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath(); g.arc(gx, gy - 12, 4, 0, 7); g.fill();
    }
    g.fillStyle = "#2a2f3d"; g.fillRect(gx - 7, gy - 10, 14, 44);        // barrel/slide
    g.fillStyle = "#3a4254"; g.fillRect(gx - 10, gy + 6, 20, 30);        // body
    g.fillStyle = "#ffd75e"; g.fillRect(gx - 10, gy + 6, 20, 3);         // gold accent
    g.fillStyle = "#12141c"; g.fillRect(gx - 4, gy - 8, 8, 6);           // muzzle

    // crosshair
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(W / 2 - 1, VIEW_H / 2 - 5, 2, 3); g.fillRect(W / 2 - 1, VIEW_H / 2 + 2, 2, 3);
    g.fillRect(W / 2 - 5, VIEW_H / 2 - 1, 3, 2); g.fillRect(W / 2 + 2, VIEW_H / 2 - 1, 3, 2);

    // damage / pickup flashes
    if (this.dmgFlash > 0) { g.fillStyle = "rgba(200,30,30," + (this.dmgFlash * 0.45).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }
    if (this.pickFlash > 0) { g.fillStyle = "rgba(255,240,180," + (this.pickFlash * 0.25).toFixed(2) + ")"; g.fillRect(0, 0, W, VIEW_H); }

    // ---- HUD ----
    g.fillStyle = "#0b0f1a"; g.fillRect(0, VIEW_H, W, HUD_H);
    g.fillStyle = "#232c47"; g.fillRect(0, VIEW_H, W, 1);
    g.font = "bold 9px monospace"; g.textBaseline = "middle"; g.textAlign = "left";
    // health
    g.fillStyle = "#8d99b8"; g.fillText("HP", 8, VIEW_H + 13);
    g.fillStyle = "#31121a"; g.fillRect(24, VIEW_H + 8, 60, 10);
    g.fillStyle = this.hp > 35 ? "#c9333f" : "#ff7043";
    g.fillRect(24, VIEW_H + 8, (60 * this.hp / 100) | 0, 10);
    g.fillStyle = "#fff"; g.fillText(String(this.hp), 30, VIEW_H + 13);
    // ammo
    g.fillStyle = "#8d99b8"; g.fillText("AMMO", 100, VIEW_H + 13);
    g.fillStyle = "#ffd75e"; g.fillText(String(this.ammo), 132, VIEW_H + 13);
    // kills
    const total = this.L.enemies.length;
    g.fillStyle = "#8d99b8"; g.fillText("KILLS", 168, VIEW_H + 13);
    g.fillStyle = "#8ad8ff"; g.fillText(this.kills + "/" + total, 202, VIEW_H + 13);
    // level
    g.fillStyle = "#8d99b8"; g.textAlign = "right";
    g.fillText("LVL " + (this.levelIdx + 1) + "/" + LEVELS.length, W - 8, VIEW_H + 13);
    g.textAlign = "left";

    // message
    if (this.msgT > 0 && this.msg) {
      g.font = "bold 10px monospace"; g.textAlign = "center";
      g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(0, 14, W, 16);
      g.fillStyle = "#ffd75e"; g.fillText(this.msg, W / 2, 22);
      g.textAlign = "left";
    }

    // overlays
    if (this.over) {
      g.fillStyle = this.over === "dead" ? "rgba(80,0,0,0.55)" : "rgba(0,20,30,0.55)";
      g.fillRect(0, 0, W, H);
      g.textAlign = "center";
      g.font = "bold 22px monospace";
      g.fillStyle = this.over === "dead" ? "#ff5d52" : "#ffd75e";
      g.fillText(this.over === "dead" ? "YOU DIED" : "AREA CLEARED!", W / 2, 78);
      g.font = "bold 10px monospace"; g.fillStyle = "#eef2ff";
      g.fillText(this.over === "dead" ? "Press R to try again" : "The galaxy is safe. Press R to replay", W / 2, 102);
      if (this.over === "win") {
        g.fillStyle = "#8ad8ff";
        g.fillText("Now imagine what I could build for YOUR project.", W / 2, 122);
      }
      g.textAlign = "left";
    }
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
  };

  // ============================ API ============================
  window.initArcade = function (canvasId) {
    const canvas = typeof canvasId === "string" ? document.getElementById(canvasId) : canvasId;
    if (!canvas) return;
    if (G) { G.destroy(); G = null; }
    G = new Game(canvas);
    window.__arcade = G; // debug handle (drive frames manually from devtools)
  };
  window.destroyArcade = function () {
    if (G) { G.destroy(); G = null; }
  };
})();
