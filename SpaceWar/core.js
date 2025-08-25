/* global window, document, performance */
(function () {
  'use strict';

  // -----------------------------------------------------------------------------
  // Version / Namespace
  // -----------------------------------------------------------------------------
  const VERSION = 'Cosmic 2D v2.1 — Keystone Update';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  console.log('[Core]', VERSION);

  // -----------------------------------------------------------------------------
  // State container
  // -----------------------------------------------------------------------------
  const S = (Cosmic.state = {
    // canvas
    canvas: null, ctx: null, W: 1, H: 1, DPR: 1,

    // runtime config (merged from BASE + MODE)
    CFG: null,

    // progression
    level: 1,
    score: 0,
    kills: 0,
    resources: 0,

    // keystone progression (replaces rings)
    keystones: [],
    keystonesCollected: 0,
    keystonesGoal: 0,
    nextKeystoneAt: 0,

    // healing stones (two sizes)
    heals: [], // {x,y,vx,vy,kind:'S'|'L'}

    // entities
    enemies: [],
    eBullets: [],
    bullets: [],
    effects: [],
    shards: [], // generic resource shards (optional; used by harvester)

    // player & auxiliaries
    ship: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, warp: 0, shield: 100, hull: 100, lastHit: 0 },
    beamActiveVisual: false,
    harvester: { state:'dock', x:0, y:0, targetKey:-1, targetShard:-1, grab:false, cd:0, beamT:0 },

    // wingmen (left/right)
    wingmen: [
      { side:-1, state:'dock', cool:0, x:0, y:0, target:-1, fireCd:0, tpT:0 },
      { side: 1, state:'dock', cool:0, x:0, y:0, target:-1, fireCd:0, tpT:0 },
    ],
    wingCtl: { L:'auto', R:'auto' }, // simulated paddle toggles (auto/deploy/recall)
    harvCtl: 'auto',

    // targeting/objectives
    objective: null,                 // {type:'key'|'heal'|'shard', ref:Object}
    objectiveLockUntil: 0,

    // lanes / autopilot
    lanes: [0.25, 0.5, 0.75],        // normalized x positions
    laneTargetX: 0.5,                // current normalized target
    engageBandY: null,               // early-attack band for enemies

    // boss
    boss: null,                      // {hp,maxHp,x,y,vx,phase,timers,...}
    bossActive: false,
    bossSpawned: false,

    // HUD / overlays
    menuOpen: true, selectedMode: null, statsTimer: 0,

    // background layers
    bg: { deepPattern:null, midPattern:null, nearPattern:null, bokehPattern:null,
          offY_deep:0, offY_mid:0, offY_near:0, offY_bokeh:0, theme:'stars' },

    // perf
    fpsAcc: 0, fpsFrames: 0, lastT: performance.now(), fpsRolling: 58,

    // platform
    isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  });

  // -----------------------------------------------------------------------------
  // Config (BASE + MODES)
  // -----------------------------------------------------------------------------
  const BASE = {
    // scroll & background
    SPEED: 210,
    STAR_DEEP: 140, STAR_MID: 160, STAR_NEAR: 220, BOKEH: 44,

    // spawns
    ENEMY_WAVE_CHANCE: 0.10, ENEMY_WAVE_SIZE: [2,3], ENEMY_HP: 3,
    ENEMY_FIRE_CHANCE: 0.02, // per-second chance per enemy
    RES_SPAWN_CHANCE: 0.035,

    // keystones
    KEY_INTERVAL_DESKTOP: [8000, 12000],
    KEY_INTERVAL_MOBILE:  [9000, 13000],
    KEY_MAG_CONE_DESKTOP: 2.2,
    KEY_MAG_CONE_MOBILE:  2.7,
    KEY_EXTRACT_MS_DESKTOP: 700,
    KEY_EXTRACT_MS_MOBILE:  900,

    // heals
    HEAL_SMALL: { hull: +15, shield: +12 },
    HEAL_LARGE: { hull: +35, shield: +28 },
    HEAL_CHANCE_BASE: 0.015,
    HEAL_CHANCE_LOWHP_BONUS: 0.035,

    // player movement (lane autopilot)
    SHIP_ACC_X: 3.6, SHIP_ACC_Y: 2.8, SHIP_DAMP: 0.88,
    SHIP_MAX_VX: 640, SHIP_MAX_VY: 520,

    // player health & regen
    SHIELD_REGEN_DELAY_MS: 3000,
    SHIELD_REGEN_RATE_DESKTOP: 12, // per second
    SHIELD_REGEN_RATE_MOBILE:  10,

    // wingmen
    WING_OFFSET: 46, WING_COOLDOWN: 1000,
    FIRE_COOLDOWN: 220, MAX_FIRE_RANGE: 560,

    // harvester beam
    BEAM_LEN: 240, BEAM_HALF_W: 96, BEAM_COOLDOWN: 900,

    // boss
    BOSS_BASE_HP: 600,
    BOSS_HP_PER_LEVEL: 80,

    // UI
    USE_BOKEH: true
  };
  const MODES = {
    A: { name:'A • Arcade', ENEMY_WAVE_CHANCE:0.14, ENEMY_WAVE_SIZE:[2,4], RES_SPAWN_CHANCE:0.04, SHIP_ACC_X:4.0, SHIP_ACC_Y:3.2 },
    B: { name:'B • Balanced' },
    C: { name:'C • Chill', ENEMY_WAVE_CHANCE:0.07, ENEMY_WAVE_SIZE:[1,2], RES_SPAWN_CHANCE:0.02, SHIP_ACC_X:2.8, SHIP_ACC_Y:2.2 },
    D: { name:'D • Performance', ENEMY_WAVE_CHANCE:0.08, ENEMY_WAVE_SIZE:[2,3], STAR_DEEP:120, STAR_MID:130, STAR_NEAR:160, BOKEH:0 }
  };
  S.CFG = Object.assign({}, BASE, MODES.B);

  // -----------------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------------
  const R = () => Math.random();
  const rand = (a, b) => a + R() * (b - a);
  const rint = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // shared fire helpers (for wingmen & boss)
  function fireOrb(x,y,ang,speed,life=700){ if(S.bullets.length>160) S.bullets.shift(); S.bullets.push({x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,life}); }
  function fireRadial(x,y,count,speed,life=800){ for(let i=0;i<count;i++){ const a=(i/count)*Math.PI*2; fireOrb(x,y,a,speed,life);} }

  // -----------------------------------------------------------------------------
  // Canvas & Resize
  // -----------------------------------------------------------------------------
  const canvas = (S.canvas = document.getElementById('game'));
  const ctx = (S.ctx = canvas.getContext('2d', { alpha:false }));
  S.DPR = Math.min(window.devicePixelRatio || 1, S.isMobile ? 1.15 : 1.25);

  function resize() {
    S.W = canvas.width = Math.max(1, Math.floor(window.innerWidth * S.DPR));
    S.H = canvas.height = Math.max(1, Math.floor(window.innerHeight * S.DPR));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    buildBackgroundPatterns();
  }
  window.addEventListener('resize', resize, { passive:true });

  // -----------------------------------------------------------------------------
  // UI refs (all optional-safe)
  // -----------------------------------------------------------------------------
  const UI = {
    uiMode: document.getElementById('uiMode'),
    uiLevel: document.getElementById('uiLevel'),
    uiScore: document.getElementById('uiScore'),
    uiRings: document.getElementById('uiRings'),     // legacy slot; we also fill this with keystone progress
    uiKeys:  document.getElementById('uiKeys'),      // new slot if present
    uiEnemies: document.getElementById('uiEnemies'),
    uiKills: document.getElementById('uiKills'),
    uiRes: document.getElementById('uiRes'),
    uiBeam: document.getElementById('uiBeam'),
    uiFPS: document.getElementById('uiFPS'),
    bossBar: document.getElementById('bossHPFill'),
  };
  if (Cosmic.render && Cosmic.render.setUIRefs) Cosmic.render.setUIRefs({
    uiMode: UI.uiMode, uiLevel: UI.uiLevel, uiScore: UI.uiScore, uiRings: UI.uiRings,
    uiEnemies: UI.uiEnemies, uiKills: UI.uiKills, uiRes: UI.uiRes, uiBeam: UI.uiBeam, uiFPS: UI.uiFPS
  });

  // -----------------------------------------------------------------------------
  // Background patterns (offscreen)
  // -----------------------------------------------------------------------------
  function makePattern(w, h, painter) {
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const c = off.getContext('2d');
    painter(c, w, h);
    return ctx.createPattern(off, 'repeat');
  }
  function drawStarField(c, w, h, count, alpha) {
    c.fillStyle = `rgba(190,205,255,${alpha})`;
    for (let i = 0; i < count; i++) c.fillRect((R()*w)|0, (R()*h)|0, 1, 1);
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
        const x = R()*w, y = R()*h, r = rand(2, 4);
        c.beginPath(); c.ellipse(x, y, r, r*R()+1, R()*Math.PI, 0, Math.PI*2); c.fill();
      }
    } else if (theme === 'glyphs') {
      c.fillStyle = 'rgba(180,200,255,0.15)';
      c.font = '12px Inter, system-ui, sans-serif';
      for (let i = 0; i < 80; i++) c.fillText(String.fromCharCode(65 + (R()*26|0)), R()*w, R()*h);
    } else if (theme === 'shapes') {
      for (let i = 0; i < 60; i++) {
        const x = R()*w, y = R()*h, s = rand(3, 7);
        c.strokeStyle = `rgba(${100+R()*155|0}, ${100+R()*155|0}, ${100+R()*155|0}, 0.2)`;
        c.strokeRect(x, y, s, s);
      }
    }
  }
  function pickWorldTheme() {
    const themes = ['stars','asteroids','glyphs','shapes','mixed'];
    S.bg.theme = themes[(Math.random()*themes.length)|0];
  }
  function buildBackgroundPatterns() {
    const W = Math.max(320, S.W), H = Math.max(240, S.H);
    const theme = S.bg.theme || 'stars';
    const mixed = (theme==='mixed') ? (R()<.5?'asteroids':'shapes') : theme;
    const deepPat = makePattern(W, H, (c,w,h)=>{ drawStarField(c,w,h,S.CFG.STAR_DEEP,0.5); drawFieldTheme(c,w,h,mixed); });
    const midPat  = makePattern(W, H, (c,w,h)=> drawStarField(c,w,h,S.CFG.STAR_MID,0.85));
    const nearPat = makePattern(W, H, (c,w,h)=> drawStarField(c,w,h,S.CFG.STAR_NEAR,1));
    const bokehPat= (S.CFG.BOKEH>0 && S.CFG.USE_BOKEH) ? makePattern(W,H,(c,w,h)=> drawBokeh(c,w,h,S.CFG.BOKEH)) : null;
    S.bg.deepPattern = deepPat; S.bg.midPattern = midPat; S.bg.nearPattern = nearPat; S.bg.bokehPattern = bokehPat;
  }

  // -----------------------------------------------------------------------------
  // Level setup / reset
  // -----------------------------------------------------------------------------
  function keystoneGoalForLevel(lv) {
    // 3,4,5,6,7,7...
    const band = Math.floor((lv-1)/3);
    return clamp(3 + band, 3, 7);
  }
  function isBossLevel(lv){ return (lv % 5) === 0; }

  function resetLevel() {
    S.keystones.length = 0;
    S.heals.length = 0;
    S.enemies.length = 0;
    S.eBullets.length = 0;
    S.bullets.length = 0;
    S.effects.length = 0;
    S.shards.length = 0;

    S.keystonesCollected = 0;
    S.keystonesGoal = isBossLevel(S.level) ? 0 : keystoneGoalForLevel(S.level);
    S.nextKeystoneAt = performance.now() + keyInterval();
    S.engageBandY = S.H * rand(0.2, 0.6);

    S.objective = null; S.objectiveLockUntil = 0;

    pickWorldTheme(); buildBackgroundPatterns();

    // boss
    S.boss = null; S.bossActive = isBossLevel(S.level); S.bossSpawned = false;
  }

  // -----------------------------------------------------------------------------
  // Spawners
  // -----------------------------------------------------------------------------
  function keyInterval(){
    return (S.isMobile ? rand(...BASE.KEY_INTERVAL_MOBILE) : rand(...BASE.KEY_INTERVAL_DESKTOP));
  }
  function spawnKeystone() {
    const laneNorm = S.lanes[(Math.random()*S.lanes.length)|0];
    const x = S.W * clamp(laneNorm + rand(-0.06,0.06), 0.12, 0.88);
    const y = -30;
    const vx = rand(-18,18), vy = rand(40,70);
    S.keystones.push({ x, y, vx, vy, extract:0, rarity: (R()<0.12?'rare':'common') });
  }
  function spawnHeal() {
    const kind = (R()<0.35) ? 'L' : 'S';
    const x = S.W * clamp(S.lanes[(R()*S.lanes.length)|0] + rand(-0.12,0.12), 0.08, 0.92);
    const y = -20, vx = rand(-12,12), vy = rand(36,64);
    S.heals.push({ x,y,vx,vy, kind });
  }
  function spawnShard() {
    S.shards.push({ x: S.W*0.5 + rand(-S.W*0.2,S.W*0.2), y:-20, vx:rand(-16,16), vy:rand(40,80), rot:R()*Math.PI*2 });
  }
  function spawnEnemyWave() {
    const n = rint(S.CFG.ENEMY_WAVE_SIZE[0], S.CFG.ENEMY_WAVE_SIZE[1]);
    for (let i = 0; i < n; i++) {
      const lane = S.lanes[(R()*S.lanes.length)|0];
      const ex = S.W * clamp(lane + rand(-0.12,0.12), 0.06, 0.94);
      S.enemies.push({
        x: ex, y: -40 - i*30, vx: rand(-40,40), vy: rand(100,150),
        hp: S.CFG.ENEMY_HP, phase: rand(0,6.28), ttl: 12000, drift: rand(0.6,1.2)
      });
    }
    S.engageBandY = S.H * rand(0.2, 0.6);
  }
  function ensureBoss() {
    if (!S.bossActive || S.bossSpawned) return;
    const hp = BASE.BOSS_BASE_HP + (S.level * BASE.BOSS_HP_PER_LEVEL);
    S.boss = { hp, maxHp: hp, x: S.W*0.5, y: S.H*0.18, vx: 90, phase: 0, t:0, fireT:0, spawnT:0 };
    S.bossSpawned = true;
  }

  // -----------------------------------------------------------------------------
  // Objective selection (prefer keystone)
  // -----------------------------------------------------------------------------
  function objValid(o){ if(!o || !o.ref) return false; return (o.type==='key'? S.keystones.includes(o.ref) : (o.type==='shard'?S.shards.includes(o.ref):S.heals.includes(o.ref))); }
  function chooseObjective(t) {
    if (objValid(S.objective) && t < S.objectiveLockUntil) return;

    // Choose nearest ahead Keystone
    let bestK = null, bestDy = 1e9;
    for (let i = 0; i < S.keystones.length; i++) {
      const k = S.keystones[i]; const dy = S.ship.y - k.y;
      if (dy <= 0) continue; // ahead only
      if (dy < bestDy) { bestDy = dy; bestK = k; }
    }
    if (bestK) { S.objective = { type:'key', ref: bestK }; S.objectiveLockUntil = t + 900; return; }

    // else if low health, prefer heal
    if (S.ship.hull < 70 || S.ship.shield < 40) {
      let bestH=null, best=1e9;
      for (let i=0;i<S.heals.length;i++){ const h=S.heals[i]; const d=Math.hypot(h.x-S.ship.x, h.y-S.ship.y); if(d<best){ best=d; bestH=h; } }
      if (bestH){ S.objective = { type:'heal', ref: bestH }; S.objectiveLockUntil = t + 700; return; }
    }

    // else shard
    let bestS = null, bestD = 1e9;
    for (let i=0;i<S.shards.length;i++){ const s=S.shards[i]; const ahead = (s.y < S.ship.y - 10); if (!ahead) continue; const d=Math.hypot(s.x-S.ship.x, s.y-S.ship.y); if(d<bestD){ bestD=d; bestS=s; } }
    if (bestS){ S.objective = { type:'shard', ref: bestS }; S.objectiveLockUntil = t + 700; }
    else S.objective = null;
  }

  // -----------------------------------------------------------------------------
  // Autopilot (lanes + vertical band)
  // -----------------------------------------------------------------------------
  function evaluateLaneScore(normX) {
    const x = S.W * normX;
    // time-to-keystone heuristic
    let kScore = 4.0;
    for (let i=0;i<S.keystones.length;i++){ const k=S.keystones[i]; const dy=S.ship.y-k.y; if(dy<=0) continue; kScore = Math.min(kScore, Math.abs(k.x-x)/S.W + dy/(S.H*1.2)); }

    // threat (nearest enemy proximity around x)
    let threat = 0.0;
    for(let i=0;i<S.enemies.length;i++){ const e=S.enemies[i]; const dx=Math.abs(e.x-x); const wy=Math.max(12, Math.abs(S.ship.y-e.y)); const local= (dx/ S.W)*1.2 + (80/wy); threat = Math.max(threat, local); }

    // mild randomization to avoid stuck oscillations
    const noise = R()*0.05;

    return kScore*1.0 + threat*0.7 + noise;
  }

  // -----------------------------------------------------------------------------
  // Wingmen & Harvester
  // -----------------------------------------------------------------------------
  function updateWingman(w, dt, t) {
    const dockX=S.W*0.5 + w.side*S.CFG.WING_OFFSET, dockY=S.ship.y+8;
    const ctrl=(w.side<0? S.wingCtl.L : S.wingCtl.R);
    w.cool=Math.max(0,w.cool-dt); w.fireCd=Math.max(0,w.fireCd-dt); w.tpT=Math.max(0,w.tpT-dt);

    if(ctrl==='deploy' && (w.state==='dock'||w.state==='cool')) w.state='launch';
    if(ctrl==='recall' && w.state!=='dock') w.state='return';

    if(w.state==='dock'){ w.x=dockX; w.y=dockY; if(S.enemies.length>0 && w.cool<=0 && ctrl!=='recall') w.state='launch'; }
    else if(w.state==='launch'){ w.x=lerp(w.x||dockX,dockX,0.1); w.y=lerp(w.y||dockY,S.ship.y-60,0.1); if(Math.abs((w.y||dockY)-(S.ship.y-60))<5){ w.state='attack'; w.target=-1; w.tpT=0; } }
    else if(w.state==='attack'){
      if(S.enemies.length===0 || ctrl==='recall'){ w.state='return'; }
      else{
        // lock a side: left wingman prefers left targets, right prefers right
        if(w.target<0 || w.target>=S.enemies.length){
          let idx=-1,best=1e9;
          for(let j=0;j<S.enemies.length;j++){
            const e=S.enemies[j];
            if(!(e.y<S.engageBandY)) continue; // early engage window
            const lateral=e.x - (S.W*0.5);
            if(w.side<0 && lateral>-8) continue;
            if(w.side>0 && lateral< 8) continue;
            const score = Math.abs(lateral) + Math.max(0, S.ship.y - e.y)*0.1;
            if(score<best){ best=score; idx=j; }
          }
          // fallback to any ahead target
          if(idx===-1){ for(let j=0;j<S.enemies.length;j++){ if(S.enemies[j].y<S.ship.y) { idx=j; break; } } }
          w.target=idx;
        }
        const tar=S.enemies[w.target]; if(!tar){ w.state='return'; }
        else{
          if(w.tpT<=0){
            // blink orbit around the target
            const ang=(t*0.002 + (w.side>0?0:Math.PI))%(Math.PI*2); const radius=52;
            w.x=tar.x + Math.cos(ang)*radius; w.y=tar.y + Math.sin(ang)*radius; w.tpT=200;
            if(w.fireCd<=0){
              // mix of aimed burst and radial
              if(Math.random()<0.65){
                const tau = 0.18 + Math.random()*0.06;
                const a = Math.atan2((tar.y+tar.vy*tau)-w.y, (tar.x+tar.vx*tau)-w.x);
                fireOrb(w.x,w.y,a,300); fireOrb(w.x,w.y,a+0.12,280); fireOrb(w.x,w.y,a-0.12,280);
              } else {
                fireRadial(w.x,w.y,6,240);
              }
              w.fireCd=S.CFG.FIRE_COOLDOWN;
            }
          } else {
            w.x=lerp(w.x, tar.x + w.side*40, 0.10);
            w.y=lerp(w.y, tar.y, 0.10);
          }
          if(tar.y>S.ship.y+120) w.state='return';
        }
      }
    } else if(w.state==='return'){ w.x=lerp(w.x,dockX,0.12); w.y=lerp(w.y,dockY,0.12); if(Math.hypot(w.x-dockX,w.y-dockY)<4){ w.state='cool'; w.cool=S.CFG.WING_COOLDOWN; } }
    else if(w.state==='cool'){ w.x=dockX; w.y=dockY; if(w.cool<=0 && ctrl!=='recall') w.state='dock'; }
  }

  function updateHarvester(h, dt){
    h.cd=Math.max(0,h.cd-dt); h.beamT=Math.max(0,h.beamT-dt);
    const dockX=S.W*0.5, dockY=S.ship.y-16; const ctrl=S.harvCtl || 'auto';
    if(ctrl==='recall' && h.state!=='dock') h.state='return';

    if(h.state==='dock'){ h.x=dockX; h.y=dockY; h.grab=false;
      // priority: keystone ahead -> shard
      if((ctrl==='deploy' || (h.cd<=0 && ctrl!=='recall'))){
        // try keystone
        let idx=-1,bestDy=0;
        for(let i=0;i<S.keystones.length;i++){
          const k=S.keystones[i]; const ahead=k.y<S.ship.y-10; if(!ahead) continue;
          const lateral=Math.abs(k.x - S.ship.x); if(lateral>S.W*0.3) continue;
          const dy=S.ship.y-k.y; if(dy>bestDy){ bestDy=dy; idx=i; }
        }
        if(idx>=0){ h.targetKey=idx; h.targetShard=-1; h.state='seekKey'; }
        else {
          // shard
          let sIdx=-1, best=0;
          for(let i=0;i<S.shards.length;i++){
            const s=S.shards[i]; const ahead=s.y<S.ship.y-10; if(!ahead) continue;
            const dy=S.ship.y-s.y; if(dy>best){ best=dy; sIdx=i; }
          }
          if(sIdx>=0){ h.targetKey=-1; h.targetShard=sIdx; h.state='seekShard'; }
        }
      }
    } else if(h.state==='seekKey'){
      const k=S.keystones[h.targetKey]; if(!k){ h.state='return'; }
      else { h.x=lerp(h.x,k.x,0.16); h.y=lerp(h.y,k.y+24,0.16); if(Math.hypot(h.x-k.x,h.y-k.y)<18){ h.state='grabKey'; h.grab=true; h.beamT=600; } if(k.y>S.ship.y+60) h.state='return'; }
    } else if(h.state==='grabKey'){
      const k=S.keystones[h.targetKey]; if(!k){ h.state='return'; }
      else { k.x=lerp(k.x,h.x,0.6); k.y=lerp(k.y,h.y,0.6); if(h.beamT<=0){ h.state='towKey'; } }
    } else if(h.state==='towKey'){
      const k=S.keystones[h.targetKey]; if(!k){ h.state='return'; }
      else { h.x=lerp(h.x,dockX,0.14); h.y=lerp(h.y,dockY,0.14); k.x=lerp(k.x,dockX,0.18); k.y=lerp(k.y,dockY,0.18);
        if(Math.hypot(k.x-dockX,k.y-dockY)<12){ // collect
          const idx=S.keystones.indexOf(k); if(idx!==-1) S.keystones.splice(idx,1);
          S.keystonesCollected++; S.score += (k.rarity==='rare'?50:35);
          h.state='return'; h.cd=1000; h.grab=false;
        } }
    } else if(h.state==='seekShard'){
      const s=S.shards[h.targetShard]; if(!s){ h.state='return'; }
      else { h.x=lerp(h.x,s.x,0.16); h.y=lerp(h.y,s.y+20,0.16); if(Math.hypot(h.x-s.x,h.y-s.y)<16){ h.state='grabShard'; h.grab=true; h.beamT=600; } if(s.y>S.ship.y+60) h.state='return'; }
    } else if(h.state==='grabShard'){
      const s=S.shards[h.targetShard]; if(!s){ h.state='return'; } else { s.x=lerp(s.x,h.x,0.6); s.y=lerp(s.y,h.y,0.6); if(h.beamT<=0){ h.state='towShard'; } }
    } else if(h.state==='towShard'){
      const s=S.shards[h.targetShard]; if(!s){ h.state='return'; }
      else { h.x=lerp(h.x,dockX,0.14); h.y=lerp(h.y,dockY,0.14); s.x=lerp(s.x,dockX,0.18); s.y=lerp(s.y,dockY,0.18);
        if(Math.hypot(s.x-dockX,s.y-dockY)<12){ const idx=S.shards.indexOf(s); if(idx!==-1) S.shards.splice(idx,1); S.score+=25; S.resources++; h.state='return'; h.cd=1200; h.grab=false; } }
    } else if(h.state==='return'){
      h.x=lerp(h.x,dockX,0.14); h.y=lerp(h.y,dockY,0.14); if(Math.hypot(h.x-dockX,h.y-dockY)<4){ h.state='dock'; h.grab=false; }
    }
  }

  // -----------------------------------------------------------------------------
  // Menu (optional-safe)
  // -----------------------------------------------------------------------------
  const menuEl = document.getElementById('menu');
  const startBtn = document.getElementById('startBtn');
  document.querySelectorAll('.mode-card').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.mode-card').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      S.selectedMode = btn.getAttribute('data-mode');
      if (startBtn) startBtn.disabled = false;
    });
  });
  if (startBtn) startBtn.addEventListener('click', ()=>{
    const sel = S.selectedMode || (S.isMobile ? 'D':'B');
    applyMode(sel); S.menuOpen = false; if (menuEl) menuEl.style.display='none';
  });

  function applyMode(key) {
    const cfg = Object.assign({}, BASE, MODES[key] || MODES.B);
    if (key==='D') { S.DPR = Math.min(window.devicePixelRatio || 1, 1.15); }
    // mobile tuning
    if (S.isMobile) { cfg.STAR_DEEP=120; cfg.STAR_MID=140; cfg.STAR_NEAR=170; cfg.BOKEH = 0; cfg.USE_BOKEH=false; }
    S.CFG = cfg;
    if (UI.uiMode) UI.uiMode.textContent = ` ${cfg.name}`;

    resize();

    // ship reset
    S.ship.x = S.W * 0.5; S.ship.y = S.H * 0.78; S.ship.vx = S.ship.vy = 0; S.ship.rot = 0;
    S.ship.shield = 100; S.ship.hull = 100; S.ship.lastHit = 0;

    // wingmen docks
    S.wingmen[0].x = S.W*0.5 - S.CFG.WING_OFFSET; S.wingmen[0].y = S.ship.y + 8; S.wingmen[0].state='dock'; S.wingmen[0].cool=0;
    S.wingmen[1].x = S.W*0.5 + S.CFG.WING_OFFSET; S.wingmen[1].y = S.ship.y + 8; S.wingmen[1].state='dock'; S.wingmen[1].cool=0;

    S.score = 0; S.kills = 0; S.resources = 0;
    S.laneTargetX = 0.5;
    resetLevel();
  }

  // auto-select a sensible mode if no menu exists
  if (!menuEl || !startBtn) applyMode(S.isMobile ? 'D' : 'B');

  // -----------------------------------------------------------------------------
  // Damage / Healing / Regen
  // -----------------------------------------------------------------------------
  function damagePlayer(amount){
    const now = performance.now();
    S.ship.lastHit = now;
    let sh = S.ship.shield, hull = S.ship.hull;
    if (sh > 0) {
      sh -= amount;
      if (sh < 0) { hull += sh; sh = 0; } // spillover
    } else {
      hull -= amount;
    }
    S.ship.shield = clamp(sh, 0, 100);
    S.ship.hull = clamp(hull, 0, 100);
    if (S.ship.hull <= 0) { // soft fail: auto heal pulse and continue (arcade)
      S.ship.hull = 40; S.ship.shield = 40; S.score = Math.max(0, S.score - 150);
    }
  }
  function healPlayer(kind){
    const pack = (kind==='L') ? BASE.HEAL_LARGE : BASE.HEAL_SMALL;
    S.ship.hull = clamp(S.ship.hull + pack.hull, 0, 100);
    S.ship.shield = clamp(S.ship.shield + pack.shield, 0, 100);
  }
  function regenShield(dt){
    const since = performance.now() - S.ship.lastHit;
    if (since < BASE.SHIELD_REGEN_DELAY_MS) return;
    const rate = S.isMobile ? BASE.SHIELD_REGEN_RATE_MOBILE : BASE.SHIELD_REGEN_RATE_DESKTOP;
    S.ship.shield = clamp(S.ship.shield + rate * (dt/1000), 0, 100);
  }

  // -----------------------------------------------------------------------------
  // Boss logic
  // -----------------------------------------------------------------------------
  function updateBoss(dt, tSec) {
    if (!S.boss) return;
    const b=S.boss;

    // simple horizontal patrol
    b.x += b.vx * (dt/1000);
    if (b.x < S.W*0.15 || b.x > S.W*0.85) b.vx *= -1;

    // fire patterns
    b.fireT -= dt; b.spawnT -= dt; b.t += dt;
    if (b.fireT <= 0) {
      if ((b.hp / b.maxHp) > 0.35) {
        // sweeping triples
        const dir = (Math.sin(tSec*0.9) * 0.6);
        for (let i=-1;i<=1;i++){
          const a = Math.atan2(S.ship.y - b.y, S.ship.x - b.x) + dir + i*0.12;
          eFire(b.x, b.y, a, 200, 1400);
        }
        b.fireT = 500;
      } else {
        // radial bursts
        const cnt = 14;
        for (let i=0;i<cnt;i++){ const a=(i/cnt)*Math.PI*2 + (tSec*0.7); eFire(b.x, b.y, a, 180, 1800); }
        b.fireT = 900;
      }
    }
    if (b.spawnT <= 0) {
      // minion gate
      const n = (b.hp/b.maxHp>0.35)? 2 : 3;
      for (let i=0;i<n;i++){ S.enemies.push({ x: b.x + rand(-60,60), y: b.y+30+ i*10, vx: rand(-40,40), vy: rand(110,160), hp: 3, phase: rand(0,6.28), ttl: 12000, drift: rand(0.6,1.2)}); }
      b.spawnT = 2200;
    }

    // boss HP bar UI (if present)
    if (UI.bossBar) { const pct = clamp(b.hp/b.maxHp, 0, 1); UI.bossBar.style.width = (pct*100)+'%'; }

    if (b.hp <= 0) {
      S.effects.push({x:b.x,y:b.y,t:800});
      S.boss = null; S.bossActive=false;
      // level complete will be handled by completion check
    }
  }
  function eFire(x,y,a,speed,life=1200){
    if (S.eBullets.length>200) S.eBullets.shift();
    S.eBullets.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life});
  }

  // -----------------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------------
  resize(); // initial

  function tick() {
    const t = performance.now();
    let dt = t - S.lastT; if (dt > 64) dt = 64; S.lastT = t;
    const dtSec = dt / 1000;

    // if menu open, still draw bg (safe)
    if (S.menuOpen) {
      if (!S.bg || !S.bg.deepPattern) buildBackgroundPatterns();
      if (window.Cosmic.render && window.Cosmic.render.draw) window.Cosmic.render.draw(ctx, S, S.CFG, t);
      requestAnimationFrame(tick); return;
    }

    // determine boss mode and spawn if needed
    if (S.bossActive && !S.bossSpawned) ensureBoss();

    // SPAWNS (skip during intermission)
    const intermission = S.statsTimer > 0;
    if (!intermission) {
      if (!S.bossActive && t >= S.nextKeystoneAt) { spawnKeystone(); S.nextKeystoneAt = t + keyInterval(); }
      if (R() < S.CFG.ENEMY_WAVE_CHANCE * dtSec) spawnEnemyWave();

      // dynamic heal chance (more likely when low hp)
      const healChance = BASE.HEAL_CHANCE_BASE + ( (S.ship.hull<60 || S.ship.shield<30) ? BASE.HEAL_CHANCE_LOWHP_BONUS : 0 );
      if (R() < healChance * dtSec) spawnHeal();

      if (R() < S.CFG.RES_SPAWN_CHANCE * dtSec) spawnShard();
    }

    // AI hooks (if you wired any external ones)
    if (!intermission && Cosmic.hooks && Array.isArray(Cosmic.hooks.preUpdate)) {
      for (let i=0;i<Cosmic.hooks.preUpdate.length;i++) Cosmic.hooks.preUpdate[i](S, t, dt);
    }

    // OBJECTIVE & AUTOPILOT
    const bandTop = S.H * 0.70;   // 30% from bottom
    const bandBottom = S.H * 0.80; // 20% from bottom
    if (!intermission) {
      chooseObjective(t);

      // decide lane target by scoring
      let bestLane = S.laneTargetX, bestScore = 1e9;
      for (let i=0;i<S.lanes.length;i++){ const nx=S.lanes[i]; const sc = evaluateLaneScore(nx); if (sc < bestScore) { bestScore = sc; bestLane = nx; } }
      // gentle easing toward lane X
      const desiredX = S.W * bestLane;
      const sway = (Math.sin(t * 0.0018) * 0.5 + 0.5);
      const baselineY = bandTop + (bandBottom - bandTop) * sway;
      let desiredY = baselineY;
      if (S.objective && S.objective.ref) desiredY = clamp(lerp(baselineY, S.objective.ref.y + 24, 0.22), bandTop, bandBottom);

      // springy easing
      S.ship.vx += (desiredX - S.ship.x) * (S.CFG.SHIP_ACC_X*1.15) * dtSec;
      S.ship.vy += (desiredY - S.ship.y) * (S.CFG.SHIP_ACC_Y*1.2) * dtSec;

      S.ship.vx = clamp(S.ship.vx, -S.CFG.SHIP_MAX_VX, S.CFG.SHIP_MAX_VX);
      S.ship.vy = clamp(S.ship.vy, -S.CFG.SHIP_MAX_VY, S.CFG.SHIP_MAX_VY);

      S.ship.vx *= 0.86; S.ship.vy *= S.CFG.SHIP_DAMP;

      S.ship.x = clamp(S.ship.x + S.ship.vx * dtSec, S.W*0.06, S.W*0.94);
      S.ship.y = clamp(S.ship.y + S.ship.vy * dtSec, bandTop, bandBottom);
      S.ship.rot = lerp(S.ship.rot, clamp(S.ship.vx,-220,220)/1000, 0.18);
    }

    // SCROLL
    const scroll = (BASE.SPEED + (S.ship.warp?220:0)) * dtSec; S.ship.warp = 0;

    // BACKGROUND offsets
    S.bg.offY_deep += scroll * 0.18;
    S.bg.offY_mid  += scroll * 0.45;
    S.bg.offY_near += scroll * 0.9;
    S.bg.offY_bokeh+= scroll * 0.22;

    // ENTITIES UPDATE (only during play)
    if (!intermission) {
      // keystones
      const cone = S.isMobile ? BASE.KEY_MAG_CONE_MOBILE : BASE.KEY_MAG_CONE_DESKTOP;
      const extractMs = S.isMobile ? BASE.KEY_EXTRACT_MS_MOBILE : BASE.KEY_EXTRACT_MS_DESKTOP;
      for (let i=S.keystones.length-1;i>=0;i--){
        const k=S.keystones[i];
        k.x += k.vx * dtSec; k.y += (k.vy * dtSec) + scroll * 0.4;
        if (k.x < 20 || k.x > S.W-20) k.vx *= -1;

        // ship beam extraction cone
        const bx=S.ship.x, by=S.ship.y-8, dx=k.x-bx, dy=k.y-by;
        if (dy<0 && -dy<BASE.BEAM_LEN) {
          const half=BASE.BEAM_HALF_W * (-dy/BASE.BEAM_LEN);
          if (Math.abs(dx)<half) { k.extract += dt; if (k.extract >= extractMs) {
            // collected by beam
            S.keystones.splice(i,1);
            S.keystonesCollected++; S.score += (k.rarity==='rare'?50:35);
            continue;
          } }
          else k.extract = Math.max(0, k.extract - dt*0.6);
        } else k.extract = Math.max(0, k.extract - dt*0.6);

        if (k.y > S.H + 40) S.keystones.splice(i,1);
      }

      // heals
      for (let i=S.heals.length-1;i>=0;i--){
        const h=S.heals[i];
        h.x += h.vx * dtSec; h.y += (h.vy * dtSec) + scroll * 0.4;
        if (Math.hypot(h.x - S.ship.x, h.y - S.ship.y) < 18) {
          healPlayer(h.kind); S.heals.splice(i,1); S.score += 8;
          continue;
        }
        // beam assist
        const bx=S.ship.x, by=S.ship.y-8, dx=h.x-bx, dy=h.y-by;
        if (dy<0 && -dy<BASE.BEAM_LEN) {
          const half=BASE.BEAM_HALF_W * (-dy/BASE.BEAM_LEN);
          if (Math.abs(dx)<half){ h.x=lerp(h.x,bx,0.12); h.y=lerp(h.y,by,0.12); if(Math.hypot(h.x-bx,h.y-by)<12){ healPlayer(h.kind); S.heals.splice(i,1); } }
        }
        if (h.y > S.H + 40) S.heals.splice(i,1);
      }

      // shards
      for (let i=S.shards.length-1;i>=0;i--){
        const s=S.shards[i];
        s.x += s.vx * dtSec; s.y += (s.vy * dtSec) + scroll * 0.4; s.rot += 0.02;
        // beam pull
        const bx=S.ship.x, by=S.ship.y-8, dx=s.x-bx, dy=s.y-by;
        if (dy<0 && -dy<BASE.BEAM_LEN) {
          const half=BASE.BEAM_HALF_W * (-dy/BASE.BEAM_LEN);
          if (Math.abs(dx)<half){ s.x=lerp(s.x,bx,0.14); s.y=lerp(s.y,by,0.14); if(Math.hypot(s.x-bx,s.y-by)<12){ S.shards.splice(i,1); S.score+=25; S.resources++; } }
        }
        if (s.y > S.H + 40) S.shards.splice(i,1);
      }

      // enemies
      for (let i=S.enemies.length-1;i>=0;i--){
        const e=S.enemies[i];
        e.ttl -= dt;
        const swayX = Math.sin((t * 0.002 + e.phase) * 2.0) * 40 * e.drift;
        const swayY = Math.cos((t * 0.002 + e.phase) * 1.6) * 10 * e.drift;
        e.x += (e.vx * dtSec) + swayX * dtSec;
        e.y += (e.vy * dtSec) + (scroll * 0.25) + swayY * dtSec;
        if (e.x < 20 || e.x > S.W - 20) e.vx *= -1;
        if (e.y > S.H + 60 || e.ttl <= 0) { S.enemies.splice(i, 1); continue; }

        // chance to shoot (when above engage band)
        if (e.y < S.engageBandY && Math.random() < S.CFG.ENEMY_FIRE_CHANCE * dtSec) {
          const a = Math.atan2(S.ship.y - e.y, S.ship.x - e.x) + rand(-0.2,0.2);
          eFire(e.x, e.y, a, 200, 1400);
        }

        // collision (respect radius; still can bump)
        const d = Math.hypot(e.x - S.ship.x, e.y - S.ship.y);
        if (d < 18) { damagePlayer(30); e.vy += 120; e.vx += (e.x<S.ship.x?-60:60); }
      }

      // enemy bullets
      for (let i=S.eBullets.length-1;i>=0;i--){
        const b=S.eBullets[i];
        b.x += b.vx * dtSec; b.y += b.vy * dtSec; b.life -= dt;
        if (b.life<=0 || b.x<-80 || b.x>S.W+80 || b.y<-80 || b.y>S.H+80){ S.eBullets.splice(i,1); continue; }
        if (Math.hypot(b.x-S.ship.x, b.y-S.ship.y) < 14){ damagePlayer(10); S.eBullets.splice(i,1); }
      }

      // wingmen / harvester
      updateWingman(S.wingmen[0], dt, t);
      updateWingman(S.wingmen[1], dt, t);
      updateHarvester(S.harvester, dt);

      // our bullets vs enemies
      for (let i=S.bullets.length-1;i>=0;i--){
        const b=S.bullets[i];
        b.x += b.vx * dtSec; b.y += b.vy * dtSec - scroll * 0.05; b.life -= dt;
        if (b.life<=0 || b.x<-80 || b.x>S.W+80 || b.y<-120 || b.y>S.H+120) { S.bullets.splice(i,1); continue; }

        // boss hit?
        if (S.boss) {
          const d = Math.hypot(S.boss.x - b.x, S.boss.y - b.y);
          if (d < 36){ S.boss.hp -= 8; S.bullets.splice(i,1); S.score += 5; continue; }
        }

        // enemies
        for (let j=S.enemies.length-1;j>=0;j--){
          const en=S.enemies[j]; const hitR=18;
          const d2 = (en.x-b.x)*(en.x-b.x) + (en.y-b.y)*(en.y-b.y);
          if (d2 < hitR*hitR) {
            en.hp--; S.bullets.splice(i,1); S.score += 12;
            if (en.hp<=0){ S.enemies.splice(j,1); S.kills++; S.effects.push({x:en.x,y:en.y,t:260}); }
            break;
          }
        }
      }

      // effects fade
      for (let i=S.effects.length-1;i>=0;i--){ const fx=S.effects[i]; fx.t -= dt; if (fx.t<=0) S.effects.splice(i,1); }

      // boss update (if active)
      if (S.bossActive) updateBoss(dt, t/1000);

      // shield regen
      regenShield(dt);
    }

    // COMPLETION CHECK
    const completed = S.bossActive ? (!S.boss && S.bossSpawned) : (S.keystonesCollected >= S.keystonesGoal);
    if (!intermission && completed) {
      // clear clutter and show stats
      S.enemies.length=0; S.eBullets.length=0; S.bullets.length=0; S.effects.length=0;
      S.keystones.length=0; S.heals.length=0; S.shards.length=0;
      showLevelStats();
    }
    if (S.statsTimer > 0) {
      S.statsTimer -= dt;
      const nextIn = document.getElementById('nextIn');
      if (nextIn) nextIn.textContent = String(Math.max(1, Math.ceil(S.statsTimer / 1000)));
      if (S.statsTimer <= 0) {
        hideLevelStats();
        S.level++;
        resetLevel();
      }
    }

    // AI postUpdate
    if (!intermission && Cosmic.hooks && Array.isArray(Cosmic.hooks.postUpdate)) {
      for (let i=0;i<Cosmic.hooks.postUpdate.length;i++) Cosmic.hooks.postUpdate[i](S, t, dt);
    }

    // RENDER
    if (Cosmic.render && Cosmic.render.draw) Cosmic.render.draw(ctx, S, S.CFG, t);

    // HUD numbers
    if (UI.uiScore) UI.uiScore.textContent = String(S.score);
    if (UI.uiLevel) UI.uiLevel.textContent = String(S.level);
    if (UI.uiEnemies) UI.uiEnemies.textContent = String(S.enemies.length + (S.boss?1:0));
    if (UI.uiKills) UI.uiKills.textContent = String(S.kills);
    if (UI.uiRes) UI.uiRes.textContent = String(S.resources);
    if (UI.uiBeam) UI.uiBeam.textContent = 'Auto';
    const keysText = S.bossActive ? 'BOSS' : `${S.keystonesCollected}/${S.keystonesGoal}`;
    if (UI.uiKeys) UI.uiKeys.textContent = keysText;
    if (UI.uiRings) UI.uiRings.textContent = keysText; // legacy compatibility

    // FPS + adaptive DPR
    S.fpsAcc += dt; S.fpsFrames++;
    if (S.fpsAcc > 250) {
      const fps = 1000 / (S.fpsAcc / S.fpsFrames);
      S.fpsRolling = S.fpsRolling*0.8 + fps*0.2;
      if (UI.uiFPS) UI.uiFPS.textContent = String(Math.round(fps));
      S.fpsAcc = 0; S.fpsFrames = 0;

      const prev = S.DPR;
      if (S.fpsRolling < 48) S.DPR = Math.max(0.9, S.DPR - 0.05);
      else if (S.fpsRolling > 58) S.DPR = Math.min(S.isMobile ? 1.15 : 1.25, S.DPR + 0.05);
      if (Math.abs(S.DPR - prev) > 0.001) resize();
    }

    requestAnimationFrame(tick);
  }

  // -----------------------------------------------------------------------------
  // Intermission (Level Stats)
  // -----------------------------------------------------------------------------
  function showLevelStats() {
    const el = document.getElementById('levelStats');
    const body = document.getElementById('levelStatsBody');
    if (el && body) {
      body.innerHTML = `
        <div><b>Level:</b> ${S.level}</div>
        <div><b>Score:</b> ${S.score}</div>
        <div><b>Keystones:</b> ${S.keystonesCollected}${S.bossActive?' (Boss cleared)':''}</div>
        <div><b>Kills:</b> ${S.kills}</div>
        <div><b>Resources:</b> ${S.resources}</div>
        <div style="opacity:.75">Next in <span id="nextIn">3</span>s…</div>
      `;
      el.classList.remove('hidden');
      S.statsTimer = 3000;
    } else {
      // if overlay missing, still advance
      S.statsTimer = 1000;
    }
  }
  function hideLevelStats() {
    const el = document.getElementById('levelStats');
    if (el) el.classList.add('hidden');
  }

  // -----------------------------------------------------------------------------
  // Kick off loop (if menu exists, it’ll start after Start; else we already applied a mode)
  // -----------------------------------------------------------------------------
  requestAnimationFrame(tick);
})();
