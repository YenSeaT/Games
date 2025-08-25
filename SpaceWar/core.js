/* global window, document, performance */
(function () {
  'use strict';

  const Cosmic = (window.Cosmic = window.Cosmic || {});
  const S = (Cosmic.state = {
    // canvas
    canvas: null, ctx: null, W: 1, H: 1, DPR: Math.min(window.devicePixelRatio || 1, 2),

    // config (filled below)
    CFG: null,

    // stats
    level: 1, score: 0, kills: 0, resources: 0,

    // systems
    rings: [], shards: [], enemies: [], bullets: [], effects: [],
    deep: [], mid: [], near: [], bokeh: [], galaxies: [], nebulas: [], planets: [],

    // player & helpers
    ship: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, warp: 0 },
    wingmen: [
      { side: -1, state: 'dock', cool: 0, x: 0, y: 0, target: -1, fireCd: 0, tpT: 0 },
      { side: 1, state: 'dock', cool: 0, x: 0, y: 0, target: -1, fireCd: 0, tpT: 0 }
    ],
    wingCtl: { L: 'auto', R: 'auto' },
    harvester: { state: 'dock', x: 0, y: 0, target: -1, grab: false, cd: 0, beamT: 0 },

    // objectives
    ringsCleared: 0, ringsGoal: 0, nextRingAt: 0, objective: null, objectiveLockUntil: 0,

    // beam visual flag
    beamActiveVisual: false,

    // perf
    fpsAcc: 0, fpsFrames: 0, lastT: performance.now()
  });

  // Base settings + modes
  const BASE = {
    SPEED: 210,
    STAR_DEEP: 140, STAR_MID: 160, STAR_NEAR: 220, BOKEH: 44, GALAXIES: 3,
    ENEMY_WAVE_CHANCE: 0.08, ENEMY_WAVE_SIZE: [2, 3], ENEMY_HP: 3,
    FIRE_COOLDOWN: 220, MAX_FIRE_RANGE: 560,
    RINGS_MIN: 15, RINGS_MAX: 30, RING_INTERVAL: [1.6, 3.0], RING_RADIUS: [30, 44],
    RES_SPAWN_CHANCE: 0.035,
    SHIP_ACC_X: 3.2, SHIP_ACC_Y: 2.6, SHIP_DAMP: 0.88,
    SHIP_MAX_VX: 620, SHIP_MAX_VY: 520, CATCHUP_DIST: 220, CATCHUP_BOOST: 1.25,
    WING_OFFSET: 46, WING_COOLDOWN: 1000,
    BEAM_LEN: 220, BEAM_HALF_W: 92, BEAM_COOLDOWN: 900
  };
  const MODES = {
    A: { name: 'A • Arcade', RING_INTERVAL: [1.2, 2.4], SHIP_ACC_X: 3.8, SHIP_ACC_Y: 3.2, SHIP_MAX_VX: 700, SHIP_MAX_VY: 560, CATCHUP_BOOST: 1.35, ENEMY_WAVE_CHANCE: 0.12, ENEMY_WAVE_SIZE: [2, 4], RES_SPAWN_CHANCE: 0.04 },
    B: { name: 'B • Balanced' },
    C: { name: 'C • Chill', RING_INTERVAL: [2.2, 3.8], SHIP_ACC_X: 2.6, SHIP_ACC_Y: 2.2, SHIP_MAX_VX: 520, SHIP_MAX_VY: 460, ENEMY_WAVE_CHANCE: 0.06, ENEMY_WAVE_SIZE: [1, 2], RES_SPAWN_CHANCE: 0.02 }
  };
  S.CFG = Object.assign({}, BASE, MODES.B);

  // Helpers
  const R = () => Math.random();
  const rand = (a, b) => a + R() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Hooks for AI (ai.js plugs into these)
  Cosmic.hooks = Cosmic.hooks || { preUpdate: [], postUpdate: [] };

  // Canvas
  const canvas = (S.canvas = document.getElementById('game'));
  const ctx = (S.ctx = canvas.getContext('2d', { alpha: false }));
  function resize() {
    S.W = canvas.width = Math.max(1, Math.floor(window.innerWidth * S.DPR));
    S.H = canvas.height = Math.max(1, Math.floor(window.innerHeight * S.DPR));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // UI refs to render
  const UI = {
    uiMode: document.getElementById('uiMode'),
    uiLevel: document.getElementById('uiLevel'),
    uiScore: document.getElementById('uiScore'),
    uiRings: document.getElementById('uiRings'),
    uiEnemies: document.getElementById('uiEnemies'),
    uiKills: document.getElementById('uiKills'),
    uiRes: document.getElementById('uiRes'),
    uiBeam: document.getElementById('uiBeam'),
    uiFPS: document.getElementById('uiFPS'),
    warpBtn: document.getElementById('warpBtn'),
    beamBtn: document.getElementById('beamBtn'),
    wingLBtn: document.getElementById('wingLBtn'),
    wingRBtn: document.getElementById('wingRBtn'),
    harvBtn: document.getElementById('harvBtn')
  };
  if (Cosmic.render && Cosmic.render.setUIRefs) Cosmic.render.setUIRefs(UI);

  // Sky generators
  function makeStars(arr, count) {
    arr.length = 0;
    for (let i = 0; i < count; i++) arr.push({ x: R() * S.W, y: R() * S.H });
  }
  function makeBokeh(arr, count) {
    arr.length = 0;
    for (let i = 0; i < count; i++)
      arr.push({ x: R() * S.W, y: R() * S.H, r: rand(1.2, 3.2), blur: rand(3, 10), a: rand(0.28, 0.55) });
  }
  function makeGalaxies(arr, count) {
    arr.length = 0;
    for (let i = 0; i < count; i++) arr.push({ x: R() * S.W, y: R() * S.H, r: rand(80, 130), rot: R() * Math.PI * 2, s: rand(8, 18) });
  }
  function regenSky() {
    makeStars(S.deep, S.CFG.STAR_DEEP);
    makeStars(S.mid, S.CFG.STAR_MID);
    makeStars(S.near, S.CFG.STAR_NEAR);
    makeBokeh(S.bokeh, S.CFG.BOKEH);
    makeGalaxies(S.galaxies, S.CFG.GALAXIES);
  }
  regenSky();

  // Level / HUD
  function resetLevel() {
    S.ringsCleared = 0;
    S.ringsGoal = Math.floor(rand(S.CFG.RINGS_MIN, S.CFG.RINGS_MAX + 1));
    S.nextRingAt = performance.now() + rand(S.CFG.RING_INTERVAL[0], S.CFG.RING_INTERVAL[1]) * 1000;
    S.rings.length = 0; S.enemies.length = 0; S.bullets.length = 0; S.effects.length = 0; S.shards.length = 0;
    S.objective = null; S.objectiveLockUntil = 0;
    if (UI.uiLevel) UI.uiLevel.textContent = String(S.level);
  }

  // Spawners
  function spawnRing() {
    const r = rand(S.CFG.RING_RADIUS[0], S.CFG.RING_RADIUS[1]);
    const bias = clamp(S.ship.x + rand(-S.W * 0.35, S.W * 0.35), S.W * 0.08, S.W * 0.92);
    S.rings.push({ x: bias, y: -r - 20, r, mT: 0 });
  }
  function spawnEnemyWave() {
    const n = Math.floor(rand(S.CFG.ENEMY_WAVE_SIZE[0], S.CFG.ENEMY_WAVE_SIZE[1] + 1));
    for (let i = 0; i < n; i++) {
      const side = R() < 0.5 ? -1 : 1;
      const ex = side < 0 ? rand(S.W * 0.05, S.W * 0.4) : rand(S.W * 0.6, S.W * 0.95);
      S.enemies.push({ x: ex, y: -40 - i * 30, vx: rand(-40, 40), vy: rand(100, 150), hp: 3, phase: rand(0, 6.28), ttl: 12000, drift: rand(0.6, 1.2) });
    }
  }
  function spawnShard() {
    S.shards.push({ x: rand(S.W * 0.25, S.W * 0.75), y: -20, vx: rand(-20, 20), vy: rand(40, 80), rot: R() * Math.PI * 2 });
  }

  // Bullets
  function fireOrb(x, y, ang, speed) { S.bullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 700 }); }
  function fireRadial(x, y, count, speed) { for (let i = 0; i < count; i++) { const a = (i / count) * Math.PI * 2; fireOrb(x, y, a, speed); } }

  // Objective selection
  function ringValid(r) { return r && S.rings.indexOf(r) !== -1; }
  function shardValid(s) { return s && S.shards.indexOf(s) !== -1; }
  function chooseObjective(t) {
    if (S.objective && t < S.objectiveLockUntil) {
      if (S.objective.type === 'ring' && ringValid(S.objective.ref) && S.objective.ref.y < S.ship.y + 60) return;
      if (S.objective.type === 'shard' && shardValid(S.objective.ref) && S.objective.ref.y < S.ship.y + 40) return;
    }
    // prefer nearest-ahead ring
    let bestR = null, bestDy = 1e9;
    for (let i = 0; i < S.rings.length; i++) {
      const r = S.rings[i], dy = r.y - S.ship.y;
      if (dy > -80 && dy < bestDy) { bestDy = dy; bestR = r; }
    }
    // shard as secondary if very close
    let bestS = null, bestDist = 1e9;
    for (let i = 0; i < S.shards.length; i++) {
      const s = S.shards[i], dy2 = s.y - S.ship.y;
      if (dy2 > -60 && dy2 < 260) {
        const d = Math.hypot(s.x - S.ship.x, dy2);
        if (d < bestDist) { bestDist = d; bestS = s; }
      }
    }
    if (bestS && bestDist < 140) { S.objective = { type: 'shard', ref: bestS }; S.objectiveLockUntil = t + 900; }
    else if (bestR) { S.objective = { type: 'ring', ref: bestR }; S.objectiveLockUntil = t + 1100; }
    else S.objective = null;
  }

  // Wingmen AI (blink teleports + firing)
  function updateWingman(w, dt, t) {
    w.cool = Math.max(0, w.cool - dt);
    w.fireCd = Math.max(0, w.fireCd - dt);
    w.tpT = Math.max(0, w.tpT - dt);
    const dockX = S.ship.x + w.side * S.CFG.WING_OFFSET, dockY = S.ship.y + 8;
    const ctrl = (w.side < 0 ? S.wingCtl.L : S.wingCtl.R);

    if (ctrl === 'deploy' && (w.state === 'dock' || w.state === 'cool')) w.state = 'launch';
    if (ctrl === 'recall' && w.state !== 'dock') w.state = 'return';

    if (w.state === 'dock') {
      w.x = dockX; w.y = dockY;
      if (S.enemies.length >= 1 && w.cool <= 0 && ctrl !== 'recall') w.state = 'launch';
    } else if (w.state === 'launch') {
      w.x = lerp(w.x || dockX, dockX, 0.1);
      w.y = lerp(w.y || dockY, S.ship.y - 60, 0.1);
      if (Math.abs((w.y || dockY) - (S.ship.y - 60)) < 5) { w.state = 'attack'; w.target = -1; w.tpT = 0; }
    } else if (w.state === 'attack') {
      if (S.enemies.length === 0 || ctrl === 'recall') {
        w.state = 'return';
      } else {
        if (w.target < 0 || w.target >= S.enemies.length) {
          // prefer own side, enemies ahead
          let idx = -1, best = 1e9;
          for (let j = 0; j < S.enemies.length; j++) {
            const e = S.enemies[j]; if (!(e.y < S.ship.y - 6)) continue;
            const lateral = e.x - S.ship.x;
            if (w.side < 0 && lateral > -8) continue;
            if (w.side > 0 && lateral < 8) continue;
            const sscore = Math.abs(lateral) - Math.max(0, S.ship.y - e.y) * 0.2;
            if (sscore < best) { best = sscore; idx = j; }
          }
          if (idx === -1) {
            best = 1e9;
            for (let j = 0; j < S.enemies.length; j++) {
              const e2 = S.enemies[j]; if (e2.y < S.ship.y - 6) {
                const d = Math.hypot(e2.x - (w.x || dockX), e2.y - (w.y || dockY));
                if (d < best) { best = d; idx = j; }
              }
            }
          }
          w.target = idx;
        }
        const tar = S.enemies[w.target];
        if (!tar) { w.state = 'return'; }
        else {
          if (w.tpT <= 0) {
            const ang = (t * 0.002 + (w.side > 0 ? 0 : Math.PI)) % (Math.PI * 2);
            const radius = 48; w.x = tar.x + Math.cos(ang) * radius; w.y = tar.y + Math.sin(ang) * radius; w.tpT = 220;
            if (w.fireCd <= 0) {
              if (R() < 0.5) fireRadial(w.x, w.y, 6, 220);
              else {
                const a = Math.atan2(tar.y - w.y, tar.x - w.x);
                fireOrb(w.x, w.y, a, 280); fireOrb(w.x, w.y, a + 0.12, 260); fireOrb(w.x, w.y, a - 0.12, 260);
              }
              w.fireCd = S.CFG.FIRE_COOLDOWN;
            }
          } else {
            w.x = lerp(w.x, tar.x + w.side * 36, 0.08);
            w.y = lerp(w.y, tar.y, 0.08);
          }
          if (tar.y > S.ship.y + 120) w.state = 'return';
        }
      }
    } else if (w.state === 'return') {
      w.x = lerp(w.x, dockX, 0.12); w.y = lerp(w.y, dockY, 0.12);
      if (Math.hypot(w.x - dockX, w.y - dockY) < 4) { w.state = 'cool'; w.cool = S.CFG.WING_COOLDOWN; }
    } else if (w.state === 'cool') {
      w.x = dockX; w.y = dockY; if (w.cool <= 0 && ctrl !== 'recall') w.state = 'dock';
    }
  }

  // Harvester (bike + tether, guaranteed pickup)
  function updateHarvester(h, dt) {
    h.cd = Math.max(0, h.cd - dt); h.beamT = Math.max(0, h.beamT - dt);
    const dockX = S.ship.x, dockY = S.ship.y - 16;
    const ctrl = S.harvCtl || 'auto';

    if (ctrl === 'recall' && h.state !== 'dock') h.state = 'return';

    if (h.state === 'dock') {
      h.x = dockX; h.y = dockY; h.grab = false;
      if ((ctrl === 'deploy' || (S.shards.length > 0 && h.cd <= 0 && ctrl !== 'recall'))) {
        let idx = -1, bestDy = 0;
        for (let i = 0; i < S.shards.length; i++) {
          const s = S.shards[i]; const ahead = s.y < S.ship.y - 10; if (!ahead) continue;
          const dy = S.ship.y - s.y; if (dy > bestDy) { bestDy = dy; idx = i; }
        }
        if (idx >= 0) { h.target = idx; h.state = 'seek'; }
      }
    } else if (h.state === 'seek') {
      const s = S.shards[h.target];
      if (!s) h.state = 'return';
      else {
        h.x = lerp(h.x, s.x, 0.16); h.y = lerp(h.y, s.y + 20, 0.16);
        if (Math.hypot(h.x - s.x, h.y - s.y) < 16) { h.state = 'grab'; h.grab = true; h.beamT = 600; }
        if (s.y > S.ship.y + 60) h.state = 'return';
      }
    } else if (h.state === 'grab') {
      const s2 = S.shards[h.target]; if (!s2) h.state = 'return';
      else { s2.x = lerp(s2.x, h.x, 0.6); s2.y = lerp(s2.y, h.y, 0.6); if (h.beamT <= 0) h.state = 'tow'; }
    } else if (h.state === 'tow') {
      const s3 = S.shards[h.target]; if (!s3) h.state = 'return';
      else {
        h.x = lerp(h.x, dockX, 0.14); h.y = lerp(h.y, dockY, 0.14);
        s3.x = lerp(s3.x, dockX, 0.18); s3.y = lerp(s3.y, dockY, 0.18);
        if (Math.hypot(s3.x - dockX, s3.y - dockY) < 12) {
          const idxS = S.shards.indexOf(s3);
          if (idxS !== -1) S.shards.splice(idxS, 1);
          S.score += 25; S.resources += 1; h.state = 'return'; h.cd = 1200;
        }
      }
    } else if (h.state === 'return') {
      h.x = lerp(h.x, dockX, 0.14); h.y = lerp(h.y, dockY, 0.14);
      if (Math.hypot(h.x - dockX, h.y - dockY) < 4) { h.state = 'dock'; h.grab = false; }
    }
  }

  // Init ship + dock positions
  S.ship.x = S.W * 0.5; S.ship.y = S.H * 0.78;
  S.wingmen[0].x = S.ship.x - S.CFG.WING_OFFSET; S.wingmen[0].y = S.ship.y + 8;
  S.wingmen[1].x = S.ship.x + S.CFG.WING_OFFSET; S.wingmen[1].y = S.ship.y + 8;
  resetLevel();

  // Game loop
  function tick() {
    const t = performance.now();
    let dt = t - S.lastT; if (dt > 60) dt = 60; S.lastT = t;
    const dtSec = dt / 1000;

    // Spawns
    if (t >= S.nextRingAt) {
      spawnRing();
      S.nextRingAt = t + rand(S.CFG.RING_INTERVAL[0] * 1000, S.CFG.RING_INTERVAL[1] * 1000);
    }
    if (R() < S.CFG.ENEMY_WAVE_CHANCE * dtSec) spawnEnemyWave();
    if (R() < S.CFG.RES_SPAWN_CHANCE * dtSec) spawnShard();

    // AI preUpdate hooks (autopilot director)
    for (let i = 0; i < Cosmic.hooks.preUpdate.length; i++) Cosmic.hooks.preUpdate[i](S, t, dt);

    // Objective + ship steering (no manual input)
    chooseObjective(t);
    const desiredX = S.objective ? S.objective.ref.x : S.W * 0.5;
    const desiredY = S.objective ? (S.objective.type === 'ring' ? clamp(S.objective.ref.y + 40, S.H * 0.35, S.H * 0.85) : clamp(S.objective.ref.y + 20, S.H * 0.35, S.H * 0.85)) : S.H * 0.7;
    const far = S.objective ? Math.hypot(desiredX - S.ship.x, desiredY - S.ship.y) > S.CFG.CATCHUP_DIST : false;
    const boost = far ? S.CFG.CATCHUP_BOOST : 1;

    S.ship.vx += (desiredX - S.ship.x) * S.CFG.SHIP_ACC_X * boost * dtSec;
    S.ship.vy += (desiredY - S.ship.y) * S.CFG.SHIP_ACC_Y * boost * dtSec;
    S.ship.vx = clamp(S.ship.vx, -S.CFG.SHIP_MAX_VX * boost, S.CFG.SHIP_MAX_VX * boost);
    S.ship.vy = clamp(S.ship.vy, -S.CFG.SHIP_MAX_VY * boost, S.CFG.SHIP_MAX_VY * boost);
    S.ship.vx *= S.CFG.SHIP_DAMP; S.ship.vy *= S.CFG.SHIP_DAMP;
    S.ship.x = clamp(S.ship.x + S.ship.vx * dtSec, S.W * 0.08, S.W * 0.92);
    S.ship.y = clamp(S.ship.y + S.ship.vy * dtSec, S.H * 0.2, S.H * 0.9);
    S.ship.rot = lerp(S.ship.rot, clamp(S.ship.vx, -260, 260) / 1000, 0.2);

    const scroll = (BASE.SPEED + (S.ship.warp ? 220 : 0)) * dtSec; S.ship.warp = 0;

    // Parallax fields
    for (let i = 0; i < S.deep.length; i++) { const sd = S.deep[i]; sd.y += scroll * 0.18; if (sd.y > S.H) { sd.y = 0; sd.x = R() * S.W; } }
    for (let i = 0; i < S.mid.length; i++) { const sm = S.mid[i]; sm.y += scroll * 0.45; if (sm.y > S.H) { sm.y = 0; sm.x = R() * S.W; } }
    for (let i = 0; i < S.near.length; i++) { const sn = S.near[i]; sn.y += scroll * 0.9; if (sn.y > S.H) { sn.y = 0; sn.x = R() * S.W; } }
    for (let i = 0; i < S.bokeh.length; i++) { const bk = S.bokeh[i]; bk.y += scroll * 0.22; if (bk.y > S.H) { bk.y = 0; bk.x = R() * S.W; } }
    for (let i = 0; i < S.galaxies.length; i++) { const g = S.galaxies[i]; g.y += scroll * 0.12 + g.s * dtSec * 0.02; g.rot += 0.0007; if (g.y - g.r > S.H + 60) { g.y = -g.r; g.x = R() * S.W; } }

    // Nebulas / planets (low freq)
    if (S.nebulas.length < 2 && R() < 0.002 * dt) S.nebulas.push({ x: rand(S.W * 0.1, S.W * 0.9), y: -200, r: rand(180, 280), s: rand(10, 20) });
    for (let i = S.nebulas.length - 1; i >= 0; i--) { const nb = S.nebulas[i]; nb.y += (scroll * 0.1) + nb.s * (dtSec * 0.2); if (nb.y - nb.r > S.H) S.nebulas.splice(i, 1); }
    if (S.planets.length < 1 && R() < 0.0015 * dt) S.planets.push({ x: rand(S.W * 0.2, S.W * 0.8), y: -160, r: rand(60, 120), s: rand(18, 28) });
    for (let i = S.planets.length - 1; i >= 0; i--) { const p = S.planets[i]; p.y += (scroll * 0.15) + p.s * dtSec; if (p.y - p.r > S.H + 80) S.planets.splice(i, 1); }

    // Rings (with proximity magnet if targeted)
    for (let i = S.rings.length - 1; i >= 0; i--) {
      const r = S.rings[i]; r.y += scroll * 0.8;
      const isObj = (S.objective && S.objective.type === 'ring' && S.objective.ref === r);
      if (isObj) {
        const d = Math.hypot(r.x - S.ship.x, r.y - S.ship.y);
        if (d < r.r * 1.6) {
          r.mT = Math.min(1, (r.mT || 0) + dt / 250);
          r.x = lerp(r.x, S.ship.x, 0.12); r.y = lerp(r.y, S.ship.y - 8, 0.12);
          if (d < 14) {
            S.rings.splice(i, 1); S.ringsCleared++; S.score += 10; if (R() < 0.6) spawnShard();
            S.objective = null; S.objectiveLockUntil = 0;
            if (S.ringsCleared >= S.ringsGoal) { S.level++; resetLevel(); }
            continue;
          }
        } else r.mT = Math.max(0, (r.mT || 0) - dt / 350);
      }
      const d2 = Math.hypot(r.x - S.ship.x, r.y - S.ship.y);
      if (d2 < r.r * 0.85) {
        S.rings.splice(i, 1); S.ringsCleared++; S.score += 10; if (R() < 0.6) spawnShard();
        S.objective = null; S.objectiveLockUntil = 0;
        if (S.ringsCleared >= S.ringsGoal) { S.level++; resetLevel(); }
      } else if (r.y - r.r > S.H + 60) {
        S.rings.splice(i, 1);
        if (S.objective && S.objective.type === 'ring' && S.objective.ref === r) { S.objective = null; S.objectiveLockUntil = 0; }
      }
    }

    // Enemies (saucer float)
    for (let i = S.enemies.length - 1; i >= 0; i--) {
      const e = S.enemies[i];
      e.ttl -= dt;
      const swayX = Math.sin((t * 0.002 + e.phase) * 2.0) * 40 * e.drift;
      const swayY = Math.cos((t * 0.002 + e.phase) * 1.6) * 10 * e.drift;
      e.x += (e.vx * dtSec) + swayX * dtSec;
      e.y += (e.vy * dtSec) + (scroll * 0.25) + swayY * dtSec;
      if (e.x < 20 || e.x > S.W - 20) e.vx *= -1;
      if (e.y > S.H + 60 || e.ttl <= 0) S.enemies.splice(i, 1);
    }

    // Wingmen auto-call (ahead)
    for (let i = 0; i < S.wingmen.length; i++) {
      const w = S.wingmen[i];
      if ((w.state === 'dock' || w.state === 'cool') && w.cool <= 0) {
        for (let j = 0; j < S.enemies.length; j++) { if (S.enemies[j].y < S.ship.y - 6) { w.state = 'launch'; break; } }
      }
    }

    // Wingmen / Harvester
    for (let i = 0; i < S.wingmen.length; i++) updateWingman(S.wingmen[i], dt, t);
    updateHarvester(S.harvester, dt);

    // Bullets
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.x += b.vx * dtSec; b.y += b.vy * dtSec - scroll * 0.05; b.life -= dt;
      if (b.life <= 0 || b.x < -80 || b.x > S.W + 80 || b.y < -120 || b.y > S.H + 120) { S.bullets.splice(i, 1); continue; }
      for (let j = S.enemies.length - 1; j >= 0; j--) {
        const en = S.enemies[j]; const hitR = 18;
        const d2 = (en.x - b.x) * (en.x - b.x) + (en.y - b.y) * (en.y - b.y);
        if (d2 < hitR * hitR) {
          en.hp--; S.bullets.splice(i, 1); S.score += 15;
          if (en.hp <= 0) { S.enemies.splice(j, 1); S.kills++; S.effects.push({ x: en.x, y: en.y, t: 260 }); }
          break;
        }
      }
    }

    // Shards + ship beam (auto visual trigger happens in AI)
    for (let i = S.shards.length - 1; i >= 0; i--) {
      const s = S.shards[i];
      if (S.harvester.grab && i === S.harvester.target) continue; // handled by harvester
      s.x += s.vx * dtSec; s.y += s.vy * dtSec + scroll * 0.4; s.rot += 0.02;
      // Ship beam pull (visual flag handled by AI)
      if (S.beamActiveVisual) {
        const bx = S.ship.x, by = S.ship.y - 8;
        const dx3 = s.x - bx, dy3 = s.y - by;
        if (dy3 < 0 && -dy3 < S.CFG.BEAM_LEN) {
          const half = S.CFG.BEAM_HALF_W * (-dy3 / S.CFG.BEAM_LEN);
          if (Math.abs(dx3) < half) {
            s.x = lerp(s.x, bx, 0.18); s.y = lerp(s.y, by, 0.18);
            if (Math.hypot(s.x - bx, s.y - by) < 12) { S.shards.splice(i, 1); S.score += 25; S.resources++; }
          }
        }
      }
      if (s.y > S.H + 40) S.shards.splice(i, 1);
    }

    // Post hooks
    for (let i = 0; i < Cosmic.hooks.postUpdate.length; i++) Cosmic.hooks.postUpdate[i](S, t, dt);

    // Render
    if (Cosmic.render && Cosmic.render.draw) Cosmic.render.draw(ctx, S, S.CFG, t);

    // FPS
    S.fpsAcc += dt; S.fpsFrames++;
    if (S.fpsAcc > 250 && UI.uiFPS) { UI.uiFPS.textContent = String(Math.round(1000 / (S.fpsAcc / S.fpsFrames))); S.fpsAcc = 0; S.fpsFrames = 0; }

    requestAnimationFrame(tick);
  }

  // First paint
  ctx.fillStyle = '#070a18'; ctx.fillRect(0, 0, S.W, S.H);

  // Start loop
  requestAnimationFrame(tick);

  // Expose bits used by AI
  Cosmic.util = { clamp, lerp, rand, R };
})();
