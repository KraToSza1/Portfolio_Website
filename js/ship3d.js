// js/ship3d.js
// Globals: window.initShip3D, window.updateShip3D, window.destroyShip3D
// Style: "Icon Fighter" — teal tip/canopy, red wings, grey hull. WebGL1-safe (three r0.157+).

(function () {
  "use strict";

  // ---- tiny helpers ---------------------------------------------------------
  // soft radial glow texture — used for the engine bloom and the trail puffs.
  // Drawn on camera-facing planes (NOT THREE.Sprite: sprites misbehave with
  // this scene's Y-flipped orthographic camera).
  function radialGlowTexture(size = 128) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size/2);
    grd.addColorStop(0,    "rgba(255,255,255,0.95)");
    grd.addColorStop(0.25, "rgba(200,235,255,0.55)");
    grd.addColorStop(0.6,  "rgba(150,215,255,0.18)");
    grd.addColorStop(1,    "rgba(150,215,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  class Ship3D {
    constructor(canvasOrId) {
      const el = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) : canvasOrId;
      if (!el) throw new Error("Ship3D: canvas not found");

      this.hostCanvas = el;
      this.canvas = el;
      this.enabled = false;

      // state
      this.w = 0; this.h = 0;
      this._raf = null;
      this._time = 0;
      this._lastTs = performance.now();
      this._prev = { x: null, y: null };
      this._lastHeading = null;
      this._turnVel = 0;
      this._bank = 0;
      this._spawnTimer = 0;
      this.engineOn = true;
      this._engineManual = undefined;
      this._paused = false;

      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      
      // Wait for Three.js to load if not available yet
      if (!window.THREE) {
        // Check every 100ms for up to 10 seconds (100 attempts)
        let attempts = 0;
        const maxAttempts = 100;
        const checkThree = setInterval(() => {
          attempts++;
          if (window.THREE) {
            clearInterval(checkThree);
            // Three.js is now loaded, initialize renderer
            try {
              this._initializeRenderer();
              if (this.enabled) {
                console.log("[Ship3D] Successfully initialized after Three.js load");
              }
            } catch (e) {
              console.warn("[Ship3D] Init failed after Three.js load:", e);
            }
            return;
          }
          if (attempts >= maxAttempts) {
            clearInterval(checkThree);
            console.error("[Ship3D] Three.js not loaded after 10 seconds. Ship will not render.");
            console.error("[Ship3D] Make sure Three.js CDN is accessible or load it locally.");
            return;
          }
        }, 100);
        return;
      }
      
      if (reduce) return;
      
      // Initialize renderer - all initialization happens here
      this._initializeRenderer();
      
      // Don't continue if initialization failed
      if (!this.enabled || !this.renderer) return;
    }

    _initializeRenderer() {
      if (!window.THREE) {
        console.warn("[Ship3D] Three.js not available");
        return;
      }
      
      // ---- renderer (robust if canvas already has a 2D ctx) -----------------
      const makeRendererOn = (canvas) => {
        // Prefer explicit WebGL1 context (WebGL2 will still work if present)
        // Enhanced browser compatibility for Firefox, Edge, Opera
        const webglOptions = {
          alpha: true, 
          antialias: true, 
          premultipliedAlpha: false,
          preserveDrawingBuffer: false, 
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false // Allow fallback for older devices
        };
        
        const ctx = canvas.getContext("webgl", webglOptions) 
                 || canvas.getContext("webgl", webglOptions) // Retry
                 || canvas.getContext("experimental-webgl", webglOptions);
        
        if (!ctx) {
          // Try without strict options for older browsers
          const ctx2 = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
          if (!ctx2) throw new Error("Ship3D: WebGL not available");
          return new THREE.WebGLRenderer({
            canvas, context: ctx2, antialias: false, alpha: true, premultipliedAlpha: false
          });
        }
        
        return new THREE.WebGLRenderer({
          canvas, context: ctx, antialias: true, alpha: true, premultipliedAlpha: false
        });
      };

      let renderer = null;
      try { 
        renderer = makeRendererOn(this.canvas);
        // Verify renderer works
        if (renderer) renderer.getContext(); 
      } catch (e) {
        // try a sibling overlay canvas if the provided one is "busy"
        try {
          const alt = document.createElement("canvas");
          alt.className = this.hostCanvas.className || "ship3d-canvas";
          Object.assign(alt.style, {
            position: "absolute", inset: "0", width: "100%", height: "100%",
            display: "block", pointerEvents: "none", background: "transparent",
            zIndex: (this.hostCanvas.style.zIndex || "1")
          });
          this.hostCanvas.parentNode.insertBefore(alt, this.hostCanvas);
          this.canvas = alt;
          renderer = makeRendererOn(this.canvas);
        } catch (e2) {
          console.warn("[Ship3D] WebGL init failed:", e2);
          this.enabled = false;
          return; // give up gracefully
        }
      }
      
      if (!renderer) {
        this.enabled = false;
        return;
      }
      
      this.renderer = renderer;

      // color management (r0.157+)
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setClearAlpha(0);

      // DPI / device pixel ratio helpers
      this._setPixelRatio = () => {
        const pr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // clamp DPR for perf
        this.renderer.setPixelRatio(pr);
      };
      this._setPixelRatio();

      // ---- scene / camera (pixel ortho with Y-down) -------------------------
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera();

      // Use visualViewport (iOS address bar aware)
      this._sizeFromVV = () => {
        const vv = window.visualViewport;
        return {
          w: Math.floor(vv?.width || window.innerWidth),
          h: Math.floor(vv?.height || window.innerHeight)
        };
      };

      this._onResize = () => this.resize();
      addEventListener("resize", this._onResize, { passive: true });
      if (window.visualViewport) {
        this._onVV = () => this.resize();
        window.visualViewport.addEventListener("resize", this._onVV, { passive: true });
      }
      this.resize();

      // listen for DPI changes even without a resize
      try {
        this._onDppx = () => this._setPixelRatio();
        this._dppxMQ = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        this._dppxMQ.addEventListener?.("change", this._onDppx);
      } catch {}

      // ---- palette (matches the site design system: gold + cyan on navy) -----
      const PALETTE = {
        hull:   0xd9e0ef,  // starlight grey
        panel:  0x232c47,  // deep navy
        accent: 0xffd75e,  // gold
        glow:   0x8ad8ff,  // signal cyan
      };

      const hullMat = new THREE.MeshStandardMaterial({
        color: PALETTE.hull, metalness: 0.55, roughness: 0.35
      });
      const panelMat = new THREE.MeshStandardMaterial({
        color: PALETTE.panel, metalness: 0.5, roughness: 0.45
      });
      const accentMat = new THREE.MeshStandardMaterial({
        color: PALETTE.accent, metalness: 0.7, roughness: 0.3,
        emissive: PALETTE.accent, emissiveIntensity: 0.22
      });
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x0e1626, metalness: 0.3, roughness: 0.12,
        emissive: PALETTE.glow, emissiveIntensity: 0.35,
        transparent: true, opacity: 0.96
      });
      const nozzleMat = new THREE.MeshStandardMaterial({
        color: 0x11141d, metalness: 0.8, roughness: 0.35
      });

      // ---- build the ship (faces +X) ------------------------------------------
      this.ship = new THREE.Group();

      // sleek fuselage — smooth lathed profile, nose at +X
      const profile = [
        new THREE.Vector2(0.01, -54),
        new THREE.Vector2(6.5,  -52),
        new THREE.Vector2(9,    -42),
        new THREE.Vector2(11,   -16),
        new THREE.Vector2(11.4,   4),
        new THREE.Vector2(9.6,   22),
        new THREE.Vector2(6.6,   38),
        new THREE.Vector2(3.2,   50),
        new THREE.Vector2(0.01,  56)
      ];
      const fuselage = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), hullMat);
      fuselage.rotation.z = -Math.PI / 2; // lathe axis (+Y) -> nose (+X)

      // gold nose cap
      const nose = new THREE.Mesh(new THREE.ConeGeometry(3.4, 13, 16), accentMat);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(52.5, 0, 0);

      // glass cockpit bubble (faces the viewer in the top-down camera)
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(7, 18, 14), canopyMat);
      canopy.scale.set(2.0, 0.95, 0.85);
      canopy.position.set(17, 0, 7.5);

      // gold hull band
      const band = new THREE.Mesh(new THREE.TorusGeometry(11.4, 0.9, 8, 28), accentMat);
      band.rotation.y = Math.PI / 2;
      band.position.set(2, 0, 0);

      // swept delta wings (extruded silhouette instead of plain boxes)
      const wingShape = new THREE.Shape();
      wingShape.moveTo(16, 0);
      wingShape.lineTo(-10, 34);
      wingShape.lineTo(-19, 34);
      wingShape.lineTo(-24, 0);
      wingShape.closePath();
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
        depth: 2.4, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.7, bevelSegments: 1
      });
      const wingR = new THREE.Mesh(wingGeo, panelMat);
      wingR.position.set(-8, 0, -1.2);
      const wingL = wingR.clone();
      wingL.scale.y = -1;

      // gold wing-tip blades
      const tipGeo = new THREE.CylinderGeometry(1.5, 1.5, 12, 10);
      const tipR = new THREE.Mesh(tipGeo, accentMat);
      tipR.rotation.z = Math.PI / 2;
      tipR.position.set(-20, 34.5, 0);
      const tipL = tipR.clone();
      tipL.position.y = -34.5;

      // rear stabilizer fins
      const finShape = new THREE.Shape();
      finShape.moveTo(6, 0);
      finShape.lineTo(-6, 15);
      finShape.lineTo(-11, 15);
      finShape.lineTo(-13, 0);
      finShape.closePath();
      const finGeo = new THREE.ExtrudeGeometry(finShape, {
        depth: 2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1
      });
      const finR = new THREE.Mesh(finGeo, panelMat);
      finR.position.set(-38, 6, -1);
      const finL = finR.clone();
      finL.scale.y = -1;
      finL.position.y = -6;

      // engine nozzle
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 7.4, 11, 20), nozzleMat);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(-57, 0, 0);

      // flame assembly (grouped so it stretches/flickers as one)
      // NOTE: normal blending — additive doesn't composite reliably on a
      // transparent canvas (alpha stays ~0 and the flame disappears)
      // DoubleSide everywhere below: the Y-flipped ortho projection inverts
      // triangle winding, so single-sided planes get backface-culled away
      const mkFlameMat = (color, opacity) => new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide
      });
      this._flameMats = [];
      this.flame = new THREE.Group();
      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(6.4, 26, 14), mkFlameMat(0x9fdcff, 0.6));
      outerFlame.rotation.z = Math.PI / 2;   // cone tip trails behind (-X)
      outerFlame.position.set(-13, 0, 0);
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(3, 16, 12), mkFlameMat(0xeaffff, 0.9));
      innerFlame.rotation.z = Math.PI / 2;
      innerFlame.position.set(-8, 0, 0);
      this._glowTex = radialGlowTexture();
      this._glowPlaneGeo = new THREE.PlaneGeometry(1, 1);
      const engineGlow = new THREE.Mesh(this._glowPlaneGeo, new THREE.MeshBasicMaterial({
        map: this._glowTex, color: PALETTE.glow,
        transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide
      }));
      engineGlow.scale.set(42, 42, 1);
      this.flame.add(outerFlame, innerFlame, engineGlow);
      this.flame.position.set(-62, 0, 0);
      [outerFlame.material, innerFlame.material, engineGlow.material].forEach(m => {
        m.userData.baseOpacity = m.opacity;
        this._flameMats.push(m);
      });

      this.ship.add(
        fuselage, nose, canopy, band,
        wingR, wingL, tipR, tipL, finR, finL,
        nozzle, this.flame
      );
      this.scene.add(this.ship);

      // ---- trail sprites (cyan) w/ material pool ----------------------------
      this.trailGroup = new THREE.Group();
      this.scene.add(this.trailGroup);
      this.trails = [];
      this._trailCap = 64;

      // pool of glow planes w/ individual materials so opacity can vary independently
      this._trailPool = [];
      const baseTrailMat = new THREE.MeshBasicMaterial({
        map: this._glowTex, color: PALETTE.glow,
        transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide
      });
      const allocTrailSprite = () => {
        // clone to get an independent material instance (independent opacity)
        const s = new THREE.Mesh(this._glowPlaneGeo, baseTrailMat.clone());
        s.renderOrder = 2;
        return s;
      };
      for (let i = 0; i < this._trailCap; i++) this._trailPool.push(allocTrailSprite());

      // ---- lights -----------------------------------------------------------
      this.scene.add(new THREE.AmbientLight(0xcdd8f5, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(220, -160, 300);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(PALETTE.glow, 0.6); // cyan rim from "space"
      rim.position.set(-180, 120, -80);
      this.scene.add(rim);

      // context loss / restore
      this.canvas.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
      this.canvas.addEventListener("webglcontextrestored", () => {
        this._setPixelRatio();
        this.resize();
        try { this.renderer.compile(this.scene, this.camera); } catch {}
      }, false);

      // pause on hidden tab (saves battery)
      this._onVis = () => {
        this._paused = document.visibilityState === "hidden";
        if (!this._paused && !this._raf) this.loop();
      };
      document.addEventListener("visibilitychange", this._onVis, { passive: true });

      // small warm-up compile to avoid first-flight hitch
      try { this.renderer.compile(this.scene, this.camera); } catch {}

      this.enabled = true;
      this.loop();
    }

    resize() {
      if (!this.renderer) return;
      const { w, h } = this._sizeFromVV();
      this.w = w; this.h = h;
      this._setPixelRatio();
      this.renderer.setSize(w, h, false);

      // Ortho pixel space, top-left origin, Y down
      this.camera.left = 0; this.camera.right = w;
      this.camera.top = 0;  this.camera.bottom = h;
      this.camera.near = -1000; this.camera.far = 1000;
      this.camera.position.set(0, 0, 10);
      this.camera.up.set(0, -1, 0);
      this.camera.updateProjectionMatrix();
    }

    // x, y can be normalized (0..1) or pixels. angleDeg optional. scale optional.
    set(x, y, angleDeg, scale) {
      if (!this.enabled) return;

      const norm = typeof x === "number" && typeof y === "number" &&
                   x >= 0 && x <= 1 && y >= 0 && y <= 1;
      const px = norm ? (x * (this.w || window.innerWidth)) : x;
      const py = norm ? (y * (this.h || window.innerHeight)) : y;

      if (this._prev.x != null) {
        const moving = Math.hypot(px - this._prev.x, py - this._prev.y) > 0.6;
        if (this._engineManual === undefined) this.engineOn = moving;
      }
      this._prev.x = px; this._prev.y = py;

      this.ship.position.set(px, py, 0);

      if (typeof angleDeg === "number") {
        const rad = THREE.MathUtils.degToRad(angleDeg);
        if (this._lastHeading != null) {
          let d = rad - this._lastHeading;
          while (d >  Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          this._turnVel = THREE.MathUtils.lerp(this._turnVel, d, 0.5);
        }
        this._lastHeading = rad;
        this.ship.rotation.z = rad;
      }

      if (typeof scale === "number") this.ship.scale.setScalar(scale);
    }

    setEngine(on) { this.engineOn = !!on; this._engineManual = true; }

    _spawnPuff() {
      // reuse from pool when possible
      let s = this._trailPool.pop();
      if (!s) {
        // recycle the oldest if we're beyond cap
        const oldest = this.trails.shift();
        if (oldest) {
          this.trailGroup.remove(oldest.s);
          s = oldest.s; // reuse sprite & material
        } else {
          // absolute fallback (shouldn't hit often)
          s = new THREE.Mesh(this._glowPlaneGeo, new THREE.MeshBasicMaterial({
            map: this._glowTex, color: 0x8ad8ff,
            transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide
          }));
        }
      }

      if (this.trails.length >= this._trailCap && this.trails[0]) {
        const oldest = this.trails.shift();
        this.trailGroup.remove(oldest.s);
        this._trailPool.push(oldest.s);
      }

      const dir = new THREE.Vector2(Math.cos(this.ship.rotation.z), Math.sin(this.ship.rotation.z));
      const dist = 64 * this.ship.scale.x; // spawn puffs at the engine, not mid-hull
      s.position.set(this.ship.position.x - dir.x * dist, this.ship.position.y - dir.y * dist, 0);
      const base = 10 + Math.random() * 7;
      s.scale.set(base, base, 1);
      s.material.opacity = 0.5;
      this.trailGroup.add(s);
      this.trails.push({
        s, life: 0,
        max: 0.45 + Math.random() * 0.45,
        vx: -dir.x * (80 + Math.random() * 60),
        vy: -dir.y * (80 + Math.random() * 60)
      });
    }

    _updateTrail(dt) {
      for (let i = this.trails.length - 1; i >= 0; i--) {
        const p = this.trails[i];
        p.life += dt;
        const t = p.life / p.max;
        if (t >= 1) {
          this.trailGroup.remove(p.s);
          // return to pool instead of disposing
          this._trailPool.push(p.s);
          this.trails.splice(i, 1);
          continue;
        }
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        const sc = THREE.MathUtils.lerp(p.s.scale.x, p.s.scale.x * 1.05, dt * 8);
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = 0.46 * (1 - t);
      }
    }

    loop() {
      if (!this.enabled) return;
      if (this._paused) { this._raf = null; return; } // stop scheduling while hidden

      this._raf = requestAnimationFrame(() => this.loop());

      const now = performance.now();
      const dt = Math.min(0.05, (now - this._lastTs) / 1000);
      this._lastTs = now; this._time += dt;

      // gentle wobble + bank (for “alive” feel)
      const wobX = Math.sin(this._time * 1.3) * 0.02;
      const wobY = Math.cos(this._time * 1.1) * 0.02;
      // decay the perceived turn velocity slowly so banking returns to neutral
      this._turnVel *= 0.92;
      const bankTarget = THREE.MathUtils.clamp(-this._turnVel * 3.2, -0.5, 0.5);
      this._bank = THREE.MathUtils.lerp(this._bank, bankTarget, 0.15);
      this.ship.rotation.x = wobX + this._bank;
      this.ship.rotation.y = wobY;

      // engine flicker/visibility (group of additive cones + glow sprite)
      const base = this.engineOn ? 1.0 : 0.35;
      const flick = base + Math.sin(this._time * 34) * 0.08 + Math.sin(this._time * 9.7) * 0.04;
      if (this.flame) {
        const stretch = this.engineOn ? (1.0 + Math.sin(this._time * 18) * 0.1) : 0.55;
        this.flame.scale.set(stretch, this.engineOn ? 1 : 0.7, this.engineOn ? 1 : 0.7);
        this.flame.visible = flick > 0.28;
        const k = Math.max(0, Math.min(1, flick));
        for (const m of this._flameMats) m.opacity = m.userData.baseOpacity * k;
      }

      if (this.engineOn) {
        this._spawnTimer += dt;
        if (this._spawnTimer >= 0.032) { this._spawnPuff(); this._spawnTimer = 0; }
      }
      this._updateTrail(dt);

      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);

      // remove listeners
      removeEventListener("resize", this._onResize);
      this._dppxMQ?.removeEventListener?.("change", this._onDppx);
      if (this._onVV) window.visualViewport?.removeEventListener("resize", this._onVV);
      document.removeEventListener("visibilitychange", this._onVis);

      // cleanup trails in scene
      for (let i = this.trails.length - 1; i >= 0; i--) {
        const p = this.trails[i];
        this.trailGroup.remove(p.s);
      }
      this.trails.length = 0;

      // dispose scene graph (avoid double-dispose with sets)
      const disposedMaterials = new Set();
      const disposedGeoms = new Set();
      const disposedMaps = new Set();

      this.scene.traverse(obj => {
        const mats = obj.isMesh || obj.isSprite
          ? (Array.isArray(obj.material) ? obj.material : [obj.material])
          : [];
        mats.forEach(m => {
          if (!m) return;
          if (m.map && !disposedMaps.has(m.map)) { m.map.dispose?.(); disposedMaps.add(m.map); }
          if (m.emissiveMap && !disposedMaps.has(m.emissiveMap)) { m.emissiveMap.dispose?.(); disposedMaps.add(m.emissiveMap); }
          if (!disposedMaterials.has(m)) { m.dispose?.(); disposedMaterials.add(m); }
        });
        if (obj.geometry && !disposedGeoms.has(obj.geometry)) { obj.geometry.dispose?.(); disposedGeoms.add(obj.geometry); }
      });

      // also dispose pooled trail materials/textures
      for (const s of this._trailPool) {
        try {
          if (s.material?.map && !disposedMaps.has(s.material.map)) { s.material.map.dispose?.(); disposedMaps.add(s.material.map); }
          s.material?.dispose?.();
        } catch {}
      }
      this._trailPool.length = 0;

      try { this.renderer.dispose(); } catch {}

      this.enabled = false;
    }
  }

  // ---- singleton API --------------------------------------------------------
  let instance = null;

  window.initShip3D = function (canvasOrId) {
    try {
      if (instance) { instance.destroy(); instance = null; }
      instance = new Ship3D(canvasOrId);
    }
    catch (e) { console.warn("[Ship3D] init failed:", e); instance = null; }
  };

  // args: { x, y, angleDeg, engineOn, scale } — x/y may be normalized (0..1)
  window.updateShip3D = function (args) {
    if (!instance || !instance.enabled || !args) return;
    instance.set(args.x, args.y, args.angleDeg, args.scale);
    if (typeof args.engineOn === "boolean") instance.setEngine(args.engineOn);
  };

  window.destroyShip3D = function () {
    if (!instance) return;
    instance.destroy();
    instance = null;
  };
})();
