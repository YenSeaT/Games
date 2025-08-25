/* global window, document, performance */
(function () {
  'use strict';

  const Cosmic = (window.Cosmic = window.Cosmic || {});
  const S = (Cosmic.state = {
    canvas: null, ctx: null, W: 1, H: 1, DPR: 1,
    CFG: null,

    // stats
    level: 1, score: 0, kills: 0, resources: 0,

    // progress
    distProgress: 0, ringsCleared: 0, ringsGoal: 0, nextRingAt: 0,

    // systems
    rings: [], shards: [], enemies: [], bullets: [], effects: [],

    // backgrounds
    bg: { deepPattern:null, midPattern:null, nearPattern:null, bokehPattern:null,
          offY_deep:0, offY_mid:0, offY_near:0, offY_bokeh:0, theme: 'stars' },

    // player
    ship: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, warp: 0 },

    // helpers
    wingmen: [
      { side: -1, state: 'dock', cool: 0, x: 0, y: 0, target: -1, fireCd: 0, tpT: 0 },
      { side: 1,  state: 'dock', cool: 0, x: 0, y: 0, target: -1, fireCd: 0, tpT: 0 }
    ],
    wingCtl: { L:'auto', R:'auto' },
    harvester: { state:'dock', x:0, y:0, target:-1, grab:false, cd:0, beamT:0 },

    // targeting
    objective: null, objectiveLockUntil: 0,

    // engagement band (random each wave)
    engageBandY: null,

    // flags
    beamActiveVisual: false,

    // perf
    fpsAcc: 0, fpsFrames: 0, lastT: performance.now(), fpsRolling: 58,

    // overlays
    menuOpen: true, selectedMode: null, statsTimer: 0
  });

  // Base + modes
  const BASE = {
    SPEED: 210,
    STAR_DEEP: 140, STAR_MID: 160, STAR_NEAR: 220, BOKEH: 44,

    ENEMY_WAVE_CHANCE: 0.1, ENEMY_WAVE_SIZE: [2,3], ENEMY_HP: 3,
    FIRE_COOLDOWN: 220, MAX_FIRE_RANGE: 560,

    RINGS_MIN: 15, RINGS_MAX: 30,
    RING_INTERVAL: [1.6, 2.8], RING_RADIUS: [30, 44],

    RES_SPAWN_CHANCE: 0.035,

    SHIP_ACC_X: 3.2, SHIP_ACC_Y: 2.6, SHIP_DAMP: 0.88,
    SHIP_MAX_VX: 620, SHIP_MAX_VY: 520, CATCHUP_DIST: 220, CATCHUP_BOOST: 1.25,

    WING_OFFSET: 46, WING_COOLDOWN: 1000,

    BEAM_LEN: 220, BEAM_HALF_W: 92, BEAM_COOLDOWN: 900,

    // NEW: line-lock the ship (center lane)
    SHIP_LINE_LOCK: true
  };
  const MODES = {
    A: { name:'A • Arcade', RING_INTERVAL:[1.2,2.2], SHIP_ACC_X:3.8, SHIP_ACC_Y:3.2, SHIP_MAX_VX:700, SHIP_MAX_VY:560, CATCHUP_BOOST:1.4, ENEMY_WAVE_CHANCE:0.14, ENEMY_WAVE_SIZE:[2,4], RES_SPAWN_CHANCE:0.04 },
    B: { name:'B • Balanced' },
    C: { name:'C • Chill', RING_INTERVAL:[2.4,4.0], SHIP_ACC_X:2.6, SHIP_ACC_Y:2.2, SHIP_MAX_VX:520, SHIP_MAX_VY:460, ENEMY_WAVE_CHANCE:0.06, ENEMY_WAVE_SIZE:[1,2], RES_SPAWN_CHANCE:0.02 },
    D: { name:'D • Performance', RING_INTERVAL:[1.8,3.0], ENEMY_WAVE_CHANCE:0.08, ENEMY_WAVE_SIZE:[2,3], STAR_DEEP:120, STAR_MID:130, STAR_NEAR:160, BOKEH:0 }
  };
  S.CFG = Object.assign({}, BASE, MODES.B);

  // Utils
  const R = () => Math.random();
  const rand = (a, b) => a + R() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function objValid(o){ if(!o || !o.ref) return false; return (o.type==='ring'? S.rings.includes(o.ref) : S.shards.includes(o.ref)); }

  // Hooks
  Cosmic.hooks = Cosmic.hooks || { preUpdate: [], postUpdate: [] };

  // Canvas
  const canvas = (S.canvas = document.getElementById('game'));
  const ctx = (S.ctx = canvas.getContext('2d', { alpha:false }));
  S.DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  function resize() {
    S.W = canvas.width = Math.max(1, Math.floor(window.innerWidth * S.DPR));
    S.H = canvas.height = Math.max(1, Math.floor(window.innerHeight * S.DPR));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    buildBackgroundPatterns(); // rebuild patterns to fit
  }
  window.addEventListener('resize', resize, { passive:true });

  // UI refs
  const UI = {
    uiMode: document.getElementById('uiMode'), uiLevel: document.getElementById('uiLevel'),
    uiScore: document.getElementById('uiScore'), uiRings: document.getElementById('uiRings'),
    uiEnemies: document.getElementById('uiEnemies'), uiKills: document.getElementById('uiKills'),
    uiRes: document.getElementById('uiRes'), uiBeam: document.getElementById('uiBeam'),
    uiFPS: document.getElementById('uiFPS')
  };
  if (Cosmic.render && Cosmic.render.setUIRefs) Cosmic.render.setUIRefs(UI);

  // Background patterns (offscreen)
  function makePattern(w, h, painter) {
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const c = off.getContext('2d');
    painter(c, w, h);
    return ctx.createPattern(off, 'repeat');
  }
  function drawStarField(c, w, h, count, alpha) {
    c.fillStyle = `rgba(190,205,255,${alpha})`;
    for (let i = 0; i < count; i++) {
      const x = (R() * w) | 0, y = (R() * h) | 0;
      c.fillRect(x, y, 1, 1);
    }
  }
  function drawBokeh(c, w, h, count) {
    for (let i = 0; i < count; i++) {
      const x = R() * w, y = R() * h, r = rand(1.2, 3.2), a = rand(0.28, 0.5);
      const g = c.createRadialGradient(x, y, 0, x, y, r*3);
      g.addColorStop(0, `rgba(170,190,255,${a})`); g.addColorStop(1, 'rgba(170,190,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r*3, 0, Math.PI*2); c.fill();
    }
  }
  function drawFieldTheme(c, w, h, theme) {
    if (theme === 'asteroids') {
      c.fillStyle = 'rgba(200,210,220,0.25)';
      for (let i = 0; i < 40; i++) {
        const x = R() * w, y = R() * h, r = rand(2, 4);
        c.beginPath(); c.ellipse(x, y, r, r*R()+1, R()*Math.PI, 0, Math.PI*2); c.fill();
      }
    } else if (theme === 'glyphs') {
      c.fillStyle = 'rgba(180,200,255,0.15)';
      for (let i = 0; i < 80; i++) {
        const x = R() * w, y = R() * h;
        c.fillText(String.fromCharCode(65 + (Math.random()*26|0)), x, y);
      }
    } else if (theme === 'shapes') {
      for (let i = 0; i < 60; i++) {
        const x = R() * w, y = R() * h, s = rand(3, 7);
        c.strokeStyle = `rgba(${100+R()*155|0}, ${100+R()*155|0}, ${100+R()*155|0}, 0.2)`;
        c.strokeRect(x, y, s, s);
      }
    }
  }
  function buildBackgroundPatterns() {
    const W = Math.max(320, S.W), H = Math.max(240, S.H);
    const theme = S.bg.theme || 'stars';

    const deepPat = makePattern(W, H, (c,w,h) => { drawStarField(c,w,h,S.CFG.STAR_DEEP,0.5); drawFieldTheme(c,w,h, theme==='mixed' ? (R()<.5?'asteroids':'shapes') : theme); });
    const midPat  = makePattern(W, H, (c,w,h) => drawStarField(c,w,h,S.CFG.STAR_MID,0.85));
    const nearPat = makePattern(W, H, (c,w,h) => drawStarField(c,w,h,S.CFG.STAR_NEAR,1));
    const bokehPat= (S.CFG.BOKEH>0) ? makePattern(W, H, (c,w,h)=> drawBokeh(c,w,h,S.CFG.BOKEH)) : null;

    S.bg.deepPattern = deepPat; S.bg.midPattern = midPat; S.bg.nearPattern = nearPat; S.bg.bokehPattern = bokehPat;
  }

  // Level setup
  function pickWorldTheme() {
    const themes = ['stars','asteroids','glyphs','shapes','mixed'];
    S.bg.theme = themes[(Math.random()*themes.length)|0];
  }
  function resetLevel() {
    // clear systems
    S.rings.length = 0; S.enemies.length = 0; S.bullets.length = 0; S.effects.length = 0; S.shards.length = 0;

    // reset counters
    S.ringsCleared = 0;
    S.ringsGoal = Math.floor(rand(S.CFG.RINGS_MIN, S.CFG.RINGS_MAX + 1));
    S.distProgress = 0;

    // timing
    S.nextRingAt = performance.now() + rand(S.CFG.RING_INTERVAL[0], S.CFG.RING_INTERVAL[1]) * 1000;

    // targeting/engagement
    S.objective = null; S.objectiveLockUntil = 0;
    S.engageBandY = S.H * rand(0.2, 0.6);

    if (UI.uiLevel) UI.uiLevel.textContent = String(S.level);

    // world visuals
    pickWorldTheme(); buildBackgroundPatterns();
  }

  // Spawners: Distance Progress with Lane Gates (R2) & Ring Chains (R3)
  function spawnLaneGate() {
    // If line-locked, bias to center lane (70%), otherwise equal lanes
    let lane = 0;
    if (S.CFG.SHIP_LINE_LOCK) {
      const r = R();
      lane = r < 0.15 ? -1 : r < 0.30 ? 1 : 0; // 70% center, 15% left, 15% right
    } else {
      const lanes = [-1,0,1];
      lane = lanes[(Math.random()*lanes.length)|0];
    }
    const laneX = S.W * (0.5 + lane * 0.28);
    const r = rand(S.CFG.RING_RADIUS[0], S.CFG.RING_RADIUS[1]);
    S.rings.push({ x: clamp(laneX, S.W*0.08, S.W*0.92), y: -r-20, r, kind:'gate', mT:0 });
  }
  function spawnRingChain() {
    const count = (Math.random()*3|0) + 3; // 3..5
    // If line-locked, start near center corridor
    const corridor = S.CFG.SHIP_LINE_LOCK ? S.W*0.1 : S.W*0.2;
    let x = clamp(S.W*0.5 + rand(-corridor, corridor), S.W*0.12, S.W*0.88);
    for (let i = 0; i < count; i++) {
      const r = rand(26, 40), y = -r - 20 - i * 40;
      S.rings.push({ x, y, r, kind:'chain', mT:0 });
      x = clamp(x + rand(-60, 60), S.W*0.1, S.W*0.9);
    }
  }
  function spawnEnemyWave() {
    const n = Math.floor(rand(S.CFG.ENEMY_WAVE_SIZE[0], S.CFG.ENEMY_WAVE_SIZE[1]+1));
    for (let i = 0; i < n; i++) {
      const side = R() < 0.5 ? -1 : 1;
      const ex = side < 0 ? rand(S.W*0.05, S.W*0.4) : rand(S.W*0.6, S.W*0.95);
      S.enemies.push({ x: ex, y: -40 - i*30, vx: rand(-40,40), vy: rand(100,150), hp: S.CFG.ENEMY_HP, phase: rand(0,6.28), ttl: 12000, drift: rand(0.6,1.2) });
    }
    // randomize engage band each wave (20–60% of screen)
    S.engageBandY = S.H * rand(0.2, 0.6);
  }
  function spawnShard() {
    // Line-locked: spawn closer to center so harvester/beam can reach without ship roaming
    const centerBias = S.CFG.SHIP_LINE_LOCK ? S.W*0.15 : S.W*0.25;
    S.shards.push({ x: S.W*0.5 + rand(-centerBias, centerBias), y: -20, vx: rand(-20,20), vy: rand(40,80), rot: R()*Math.PI*2 });
  }

  // Bullets
  function fireOrb(x,y,ang,speed){ if(S.bullets.length>120){ S.bullets.shift(); } S.bullets.push({ x,y, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, life:700 }); }
  function fireRadial(x,y,count,speed){ for(let i=0;i<count;i++){ const a=(i/count)*Math.PI*2; fireOrb(x,y,a,speed); } }
  Cosmic.util = { clamp, lerp, rand, R, fireOrb, fireRadial };

  // Objective selection by time-to-intercept (rings preferred)
  function chooseObjective(t) {
    if (objValid(S.objective) && t < S.objectiveLockUntil) {
      const ref = S.objective.ref;
      if (S.objective.type==='ring' && ref.y < S.ship.y + 60) return;
      if (S.objective.type==='shard' && ref.y < S.ship.y + 40) return;
    }
    let best = null, bestCost = 1e9;
    const scroll = BASE.SPEED*0.8;
    for (let i = 0; i < S.rings.length; i++) {
      const r = S.rings[i], dy = S.ship.y - r.y;
      if (dy <= 0) continue; // ahead only
      const t_ring = dy / scroll; if (t_ring <= 0) continue;
      // If line-locked, penalize lateral distance strongly to avoid jitter
      const dx = Math.abs(r.x - S.W*0.5);
      const lateralPenalty = S.CFG.SHIP_LINE_LOCK ? 1.2 : 0.6;
      const cost = t_ring + lateralPenalty * (dx / S.W);
      if (cost < bestCost) { bestCost = cost; best = r; }
    }
    // secondary: shard close-by and roughly centered
    let bestS = null, bestDS = 1e9;
    for (let i = 0; i < S.shards.length; i++) {
      const s = S.shards[i], dy2 = S.ship.y - s.y; if (dy2 <= 0 || dy2 > 260) continue;
      const dx = Math.abs(s.x - S.W*0.5); if (S.CFG.SHIP_LINE_LOCK && dx > S.W*0.18) continue;
      const d = Math.hypot(s.x - S.W*0.5, dy2); if (d < bestDS) { bestDS = d; bestS = s; }
    }
    if (bestS && bestDS < 140) { S.objective = { type:'shard', ref:bestS }; S.objectiveLockUntil = t + 900; }
    else if (best) { S.objective = { type:'ring', ref:best }; S.objectiveLockUntil = t + 1100; }
    else { S.objective = null; }
  }

  // Wingmen + Harvester
  function updateWingman(w, dt, t) {
    const CFG = S.CFG;
    w.cool=Math.max(0,w.cool-dt); w.fireCd=Math.max(0,w.fireCd-dt); w.tpT=Math.max(0,w.tpT-dt);
    const dockX=S.W*0.5 + w.side*CFG.WING_OFFSET; // dock at center line
    const dockY=S.ship.y+8;
    const ctrl=(w.side<0? S.wingCtl.L : S.wingCtl.R);

    if(ctrl==='deploy' && (w.state==='dock'||w.state==='cool')) w.state='launch';
    if(ctrl==='recall' && w.state!=='dock') w.state='return';

    if(w.state==='dock'){ w.x=dockX; w.y=dockY; if(S.enemies.length>=1 && w.cool<=0 && ctrl!=='recall') w.state='launch'; }
    else if(w.state==='launch'){ w.x=lerp(w.x||dockX,dockX,0.1); w.y=lerp(w.y||dockY,S.ship.y-60,0.1); if(Math.abs((w.y||dockY)-(S.ship.y-60))<5){ w.state='attack'; w.target=-1; w.tpT=0; } }
    else if(w.state==='attack'){
      if(S.enemies.length===0 || ctrl==='recall'){ w.state='return'; }
      else{
        if(w.target<0 || w.target>=S.enemies.length){
          let idx=-1,best=1e9;
          for(let j=0;j<S.enemies.length;j++){
            const e=S.enemies[j]; if(!(e.y<S.engageBandY)) continue; // early engage
            const lateral=e.x-(S.W*0.5); if(w.side<0 && lateral>-8) continue; if(w.side>0 && lateral<8) continue;
            const sscore=Math.abs(lateral) - Math.max(0, S.ship.y - e.y)*0.2;
            if(sscore<best){ best=sscore; idx=j; }
          }
          if(idx===-1){ best=1e9; for(let j=0;j<S.enemies.length;j++){ const e2=S.enemies[j]; if(e2.y<S.engageBandY){ const d=Math.hypot(e2.x-(w.x||dockX), e2.y-(w.y||dockY)); if(d<best){ best=d; idx=j; } } } }
          w.target=idx;
        }
        const tar=S.enemies[w.target]; if(!tar){ w.state='return'; }
        else{
          if(w.tpT<=0){
            const ang=(t*0.002 + (w.side>0?0:Math.PI))%(Math.PI*2); const radius=48; w.x=tar.x + Math.cos(ang)*radius; w.y=tar.y + Math.sin(ang)*radius; w.tpT=220;
            if(w.fireCd<=0){
              const tau = 0.18 + Math.random()*0.06;
              const a = Math.atan2((tar.y+tar.vy*tau)-w.y, (tar.x+tar.vx*tau)-w.x);
              if(Math.random()<0.6){ fireOrb(w.x,w.y,a,280); fireOrb(w.x,w.y,a+0.12,260); fireOrb(w.x,w.y,a-0.12,260); }
              else { fireRadial(w.x,w.y,6,220); }
              w.fireCd=CFG.FIRE_COOLDOWN;
            }
          } else { w.x=lerp(w.x, tar.x + w.side*36, 0.08); w.y=lerp(w.y, tar.y, 0.08); }
          if(tar.y>S.ship.y+120) w.state='return';
        }
      }
    } else if(w.state==='return'){ w.x=lerp(w.x,dockX,0.12); w.y=lerp(w.y,dockY,0.12); if(Math.hypot(w.x-dockX,w.y-dockY)<4){ w.state='cool'; w.cool=CFG.WING_COOLDOWN; } }
    else if(w.state==='cool'){ w.x=dockX; w.y=dockY; if(w.cool<=0 && ctrl!=='recall') w.state='dock'; }
  }
  function updateHarvester(h,dt){
    h.cd=Math.max(0,h.cd-dt); h.beamT=Math.max(0,h.beamT-dt);
    const dockX=S.W*0.5, dockY=S.ship.y-16; const ctrl=S.harvCtl || 'auto';
    if(ctrl==='recall' && h.state!=='dock') h.state='return';
    if(h.state==='dock'){ h.x=dockX; h.y=dockY; h.grab=false;
      if((ctrl==='deploy' || (S.shards.length>0 && h.cd<=0 && ctrl!=='recall'))){
        let idx=-1,bestDy=0;
        for(let i=0;i<S.shards.length;i++){
          const s=S.shards[i];
          const ahead=s.y<S.ship.y-10; if(!ahead) continue;
          const lateral=Math.abs(s.x - S.W*0.5); if(S.CFG.SHIP_LINE_LOCK && lateral>S.W*0.18) continue;
          const dy=S.ship.y-s.y; if(dy>bestDy){ bestDy=dy; idx=i; }
        }
        if(idx>=0){ h.target=idx; h.state='seek'; }
      }
    } else if(h.state==='seek'){ const s=S.shards[h.target]; if(!s){ h.state='return'; }
      else { h.x=lerp(h.x,s.x,0.16); h.y=lerp(h.y,s.y+20,0.16); if(Math.hypot(h.x-s.x,h.y-s.y)<16){ h.state='grab'; h.grab=true; h.beamT=600; } if(s.y>S.ship.y+60){ h.state='return'; } }
    } else if(h.state==='grab'){ const s2=S.shards[h.target]; if(!s2){ h.state='return'; } else { s2.x=lerp(s2.x,h.x,0.6); s2.y=lerp(s2.y,h.y,0.6); if(h.beamT<=0){ h.state='tow'; } } }
    else if(h.state==='tow'){ const s3=S.shards[h.target]; if(!s3){ h.state='return'; }
      else { h.x=lerp(h.x,dockX,0.14); h.y=lerp(h.y,dockY,0.14); s3.x=lerp(s3.x,dockX,0.18); s3.y=lerp(s3.y,dockY,0.18);
        if(Math.hypot(s3.x-dockX,s3.y-dockY)<12){ const idxS=S.shards.indexOf(s3); if(idxS!==-1) S.shards.splice(idxS,1); S.score+=25; S.resources++; h.state='return'; h.cd=1200; } }
    } else if(h.state==='return'){ h.x=lerp(h.x,dockX,0.14); h.y=lerp(h.y,dockY,0.14); if(Math.hypot(h.x-dockX,h.y-dockY)<4){ h.state='dock'; h.grab=false; } }
  }

  // Menu
  const menuEl = document.getElementById('menu');
  const startBtn = document.getElementById('startBtn');
  document.querySelectorAll('.mode-card').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.mode-card').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      S.selectedMode = btn.getAttribute('data-mode');
      startBtn.disabled = false;
    });
  });
  startBtn.addEventListener('click', ()=>{
    const sel = S.selectedMode || (isMobile()? 'D':'B');
    applyMode(sel); S.menuOpen = false; menuEl.style.display='none';
  });
  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  if (isMobile()) {
    const perf = document.querySelector('.mode-card.perf');
    if (perf) perf.click();
  }

  function applyMode(key) {
    const cfg = Object.assign({}, BASE, MODES[key] || MODES.B);
    if (key==='D') { S.DPR = Math.min(window.devicePixelRatio || 1, 1.15); }
    // keep ship line-locked across all modes per your request
    cfg.SHIP_LINE_LOCK = true;

    S.CFG = cfg;
    if (UI.uiMode) UI.uiMode.textContent = ` ${cfg.name}`;
    resize();

    // place ship on center line
    S.ship.x = S.W * 0.5; S.ship.y = S.H * 0.78; S.ship.vx = S.ship.vy = 0;
    S.kills = 0; S.score = 0; S.resources = 0;

    // dock wingmen relative to center
    S.wingmen[0].x = S.W*0.5 - S.CFG.WING_OFFSET; S.wingmen[0].y = S.ship.y + 8;
    S.wingmen[1].x = S.W*0.5 + S.CFG.WING_OFFSET; S.wingmen[1].y = S.ship.y + 8;

    resetLevel();
  }

  // First-time sizing
  resize();

  // Game loop
  function tick() {
    const t = performance.now();
    let dt = t - S.lastT; if (dt > 60) dt = 60; S.lastT = t;
    const dtSec = dt / 1000;

    // Skip updates if menu open (but allow background draw)
    if (S.menuOpen) {
      if (!S.bg || !S.bg.deepPattern) buildBackgroundPatterns();
      if (window.Cosmic.render && window.Cosmic.render.draw) window.Cosmic.render.draw(ctx, S, S.CFG, t);
      requestAnimationFrame(tick); return;
    }

    // === Intermission gate: freeze sim while stats overlay is shown ===
    const intermission = S.statsTimer > 0;

    // Spawns (only during play)
    if (!intermission) {
      if (t >= S.nextRingAt) {
        if (R() < 0.5) spawnLaneGate(); else spawnRingChain();
        S.nextRingAt = t + rand(S.CFG.RING_INTERVAL[0]*1000, S.CFG.RING_INTERVAL[1]*1000);
      }
      if (R() < S.CFG.ENEMY_WAVE_CHANCE * dtSec) spawnEnemyWave();
      if (R() < S.CFG.RES_SPAWN_CHANCE * dtSec) spawnShard();
    }

    // AI preUpdate
    if (!intermission) for (let i = 0; i < Cosmic.hooks.preUpdate.length; i++) Cosmic.hooks.preUpdate[i](S, t, dt);

    // Objective + ship (line-lock keeps X at center)
    const centerX = S.W * 0.5;
    if (!intermission) {
      chooseObjective(t);

      // vertical pursuit only; X stays centered
      const desiredX = centerX;
      const hasObj = objValid(S.objective);
      const desiredY = hasObj ? (S.objective.type==='ring'
            ? clamp(S.objective.ref.y + 40, S.H*0.35, S.H*0.85)
            : clamp(S.objective.ref.y + 20, S.H*0.35, S.H*0.85))
          : S.H * 0.7;

      const far = hasObj ? Math.abs(desiredY - S.ship.y) > S.CFG.CATCHUP_DIST*0.6 : false;
      const boost = far ? S.CFG.CATCHUP_BOOST : 1;

      // lock X to center with light spring, no lateral chasing
      S.ship.vx += (desiredX - S.ship.x) * (S.CFG.SHIP_ACC_X*1.1) * dtSec;
      S.ship.vy += (desiredY - S.ship.y) * S.CFG.SHIP_ACC_Y * boost * dtSec;

      S.ship.vx = clamp(S.ship.vx, -S.CFG.SHIP_MAX_VX*0.3, S.CFG.SHIP_MAX_VX*0.3); // narrow band
      S.ship.vy = clamp(S.ship.vy, -S.CFG.SHIP_MAX_VY*boost, S.CFG.SHIP_MAX_VY*boost);

      S.ship.vx *= 0.86; S.ship.vy *= S.CFG.SHIP_DAMP;

      S.ship.x = lerp(S.ship.x + S.ship.vx * dtSec, centerX, 0.2); // bias to exact center
      S.ship.y = clamp(S.ship.y + S.ship.vy * dtSec, S.H*0.2, S.H*0.9);
      S.ship.rot = lerp(S.ship.rot, clamp(S.ship.vx,-200,200)/1000, 0.18);
    }

    const scroll = (BASE.SPEED + (S.ship.warp?220:0)) * dtSec; S.ship.warp = 0;

    // Background offsets (still move in intermission to keep life)
    S.bg.offY_deep += scroll * 0.18;
    S.bg.offY_mid  += scroll * 0.45;
    S.bg.offY_near += scroll * 0.9;
    S.bg.offY_bokeh+= scroll * 0.22;

    // Rings with magnet & capture + Distance Progress (play only)
    if (!intermission) {
      for (let i = S.rings.length - 1; i >= 0; i--) {
        const r = S.rings[i]; r.y += scroll * 0.8;

        // expand magnet window so center-locked ship still captures
        const isObj = (objValid(S.objective) && S.objective.type==='ring' && S.objective.ref===r);
        if (isObj) {
          const d = Math.hypot(r.x - centerX, r.y - S.ship.y);
          if (d < r.r * 2.2) { // was 1.6
            r.mT = Math.min(1, (r.mT || 0) + dt / 220);
            r.x = lerp(r.x, centerX, 0.10); r.y = lerp(r.y, S.ship.y - 8, 0.12);
            if (d < 14) {
              S.rings.splice(i, 1);
              S.ringsCleared++; S.score += (r.kind==='chain'?12:10);
              S.distProgress = Math.min(1, S.distProgress + 1/Math.max(1,S.ringsGoal));
              if (R() < 0.6) spawnShard();
              S.objective = null; S.objectiveLockUntil = 0;
              continue;
            }
          } else r.mT = Math.max(0, (r.mT || 0) - dt / 350);
        }

        const d2 = Math.hypot(r.x - centerX, r.y - S.ship.y);
        if (d2 < r.r * 0.95) { // proximity capture (slightly wider)
          S.rings.splice(i, 1);
          S.ringsCleared++; S.score += (r.kind==='chain'?12:10);
          S.distProgress = Math.min(1, S.distProgress + 1/Math.max(1,S.ringsGoal));
          if (R() < 0.6) spawnShard();
          S.objective = null; S.objectiveLockUntil = 0;
        } else if (r.y - r.r > S.H + 60) {
          S.rings.splice(i, 1);
          if (objValid(S.objective) && S.objective.type==='ring' && S.objective.ref===r) { S.objective=null; S.objectiveLockUntil=0; }
        }
      }
    }

    // Enemies (play only)
    if (!intermission) {
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
    }

    // Auto call wingmen if ahead targets exist (play only)
    if (!intermission) {
      for (let i = 0; i < S.wingmen.length; i++) {
        const w = S.wingmen[i];
        if ((w.state==='dock'||w.state==='cool') && w.cool<=0) {
          for (let j = 0; j < S.enemies.length; j++) { if (S.enemies[j].y < S.engageBandY) { w.state='launch'; break; } }
        }
      }
    }

    // Wingmen + Harvester
    if (!intermission) {
      for (let i = 0; i < S.wingmen.length; i++) updateWingman(S.wingmen[i], dt, t);
      updateHarvester(S.harvester, dt);
    }

    // Bullets / effects (play only)
    if (!intermission) {
      for (let i = S.bullets.length - 1; i >= 0; i--) {
        const b = S.bullets[i];
        b.x += b.vx * dtSec; b.y += b.vy * dtSec - scroll * 0.05; b.life -= dt;
        if (b.life <= 0 || b.x < -80 || b.x > S.W + 80 || b.y < -120 || b.y > S.H + 120) { S.bullets.splice(i, 1); continue; }
        for (let j = S.enemies.length - 1; j >= 0; j--) {
          const en = S.enemies[j]; const hitR = 18;
          const d2 = (en.x - b.x)*(en.x - b.x) + (en.y - b.y)*(en.y - b.y);
          if (d2 < hitR*hitR) {
            en.hp--; S.bullets.splice(i, 1); S.score += 15; if (en.hp <= 0) { S.enemies.splice(j, 1); S.kills++; S.effects.push({ x: en.x, y: en.y, t: 260 }); }
            break;
          }
        }
      }
      for (let i = S.effects.length - 1; i >= 0; i--) { const fx = S.effects[i]; fx.t -= dt; if (fx.t <= 0) S.effects.splice(i, 1); }
    }

    // Ship-beam assisted shard pull (play only)
    if (!intermission) {
      for (let i = S.shards.length - 1; i >= 0; i--) {
        const s = S.shards[i]; if (S.harvester.grab && i===S.harvester.target) continue;
        s.x += s.vx * dtSec; s.y += s.vy * dtSec + scroll * 0.4; s.rot += 0.02;
        if (S.beamActiveVisual) {
          const bx=centerX, by=S.ship.y-8, dx=s.x-bx, dy=s.y-by;
          if (dy<0 && -dy<S.CFG.BEAM_LEN) {
            const half=S.CFG.BEAM_HALF_W * (-dy/S.CFG.BEAM_LEN);
            if (Math.abs(dx)<half) { s.x=lerp(s.x,bx,0.18); s.y=lerp(s.y,by,0.18); if (Math.hypot(s.x-bx,s.y-by)<12) { S.shards.splice(i,1); S.score+=25; S.resources++; } }
          }
        }
        if (s.y > S.H + 40) S.shards.splice(i, 1);
      }
    }

    // Level complete & intermission countdown
    if (!intermission && S.distProgress >= 1) {
      // stop active entities to avoid carry-over affecting next level counters
      S.enemies.length = 0; S.bullets.length = 0; S.effects.length = 0; S.rings.length = 0; S.shards.length = 0;
      showLevelStats();
    }
    if (S.statsTimer > 0) {
      S.statsTimer -= dt;
      const nextIn = document.getElementById('nextIn');
      if (nextIn) nextIn.textContent = String(Math.max(1, Math.ceil(S.statsTimer / 1000)));
      if (S.statsTimer <= 0) {
        hideLevelStats();
        S.level++;
        resetLevel(); // clean re-init (fixes ring counter at level 2+)
      }
    }

    // AI postUpdate
    if (!intermission) for (let i = 0; i < Cosmic.hooks.postUpdate.length; i++) Cosmic.hooks.postUpdate[i](S, t, dt);

    // Render
    if (Cosmic.render && Cosmic.render.draw) Cosmic.render.draw(ctx, S, S.CFG, t);

    // FPS + Adaptive DPR
    S.fpsAcc += dt; S.fpsFrames++;
    if (S.fpsAcc > 250) {
      const fps = 1000 / (S.fpsAcc / S.fpsFrames);
      S.fpsRolling = S.fpsRolling * 0.8 + fps * 0.2;
      if (UI.uiFPS) UI.uiFPS.textContent = String(Math.round(fps));
      S.fpsAcc = 0; S.fpsFrames = 0;

      // auto-tune DPR
      const prev = S.DPR;
      if (S.fpsRolling < 48) S.DPR = Math.max(0.9, S.DPR - 0.05);
      else if (S.fpsRolling > 58) S.DPR = Math.min(1.25, S.DPR + 0.05);
      if (Math.abs(S.DPR - prev) > 0.001) resize();
    }

    requestAnimationFrame(tick);
  }

  function showLevelStats() {
    const el = document.getElementById('levelStats');
    const body = document.getElementById('levelStatsBody');
    if (el && body) {
      body.innerHTML = `
        <div><b>Level:</b> ${S.level}</div>
        <div><b>Score:</b> ${S.score}</div>
        <div><b>Rings:</b> ${S.ringsCleared}/${S.ringsGoal}</div>
        <div><b>Kills:</b> ${S.kills}</div>
        <div><b>Resources:</b> ${S.resources}</div>
      `;
      el.classList.remove('hidden');
      S.statsTimer = 3000; // 3s intermission
    }
  }
  function hideLevelStats() {
    const el = document.getElementById('levelStats');
    if (el) el.classList.add('hidden');
  }

  // Start loop immediately
  requestAnimationFrame(tick);
})();
