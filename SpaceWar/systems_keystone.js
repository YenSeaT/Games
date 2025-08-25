/* v2.0 keystones + heals + harvester */
(function(){
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  const U = Cosmic.util = Cosmic.util || {};
  Cosmic.keystones = { resetLevel, scheduleNext, update, spawnKeystone, tryBeamExtract };

  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

  function resetLevel(S){
    S.keystones = [];
    S.heals = [];
    S.shards = []; // resources (cosmetic/points)
    S.keystonesCollected = 0;
    S.keystonesGoal = calcGoalForLevel(S.level, S.CFG.KEYSTONE_GOAL_BAND);
    scheduleNext(S);
  }

  function calcGoalForLevel(level, band){
    // increases every 3 levels, capped by last band value
    const idx = Math.min(band.length-1, Math.floor((level-1)/3));
    return band[idx];
  }

  function scheduleNext(S){
    const d = isMobile() ? S.CFG.KEYSTONE_INTERVAL_MOBILE : S.CFG.KEYSTONE_INTERVAL_DESKTOP;
    S.nextKeystoneAt = performance.now() + U.rand(d[0], d[1]);
  }

  function spawnKeystone(S){
    // choose a lane different from current enemies cluster if possible
    const lanes = S.CFG.LANES_X.map(fr => (S.W*fr));
    let lane = 1; // middle default
    let best = 1e9;
    for (let i=0;i<3;i++){
      const lx = lanes[i];
      // score based on nearest enemy ahead distance
      let threat = 0;
      for (let j=0;j<S.enemies.length;j++){
        const e=S.enemies[j]; if (e.y < S.ship.y) continue; // below
        threat += 1/(Math.abs(e.x-lx)+60);
      }
      if (threat < best){ best=threat; lane=i; }
    }
    const x = lanes[lane] + U.rand(-30,30);
    const k = { x, y: -30, vx: U.rand(-20,20), vy: U.rand(50,90), rot: Math.random()*Math.PI*2, extract:0, rarity: (Math.random()<0.15?'rare':'common') };
    S.keystones.push(k);
  }

  function maybeSpawnHeals(S, dt){
    const hpFrac = (S.player.hull + S.player.shield) / (S.CFG.HULL_MAX + S.CFG.SHIELD_MAX);
    let chance = S.CFG.HEAL_SPAWN_CHANCE;
    if (hpFrac < 0.6) chance *= 2.0;
    if (hpFrac < 0.35) chance *= 2.0;
    if (Math.random() < chance * (dt/1000)){
      const x = S.W * (0.2 + Math.random()*0.6);
      const kind = (Math.random()<0.45?'large':'small');
      S.heals.push({ kind, x, y:-20, vx: U.rand(-15,15), vy: U.rand(40,80), rot: Math.random()*Math.PI*2 });
    }
  }

  function maybeSpawnShard(S, dt){
    if (Math.random() < S.CFG.RES_SPAWN_CHANCE * (dt/1000)){
      const x = S.W * (0.2 + Math.random()*0.6);
      S.shards.push({ x, y:-20, vx: U.rand(-20,20), vy: U.rand(40,80), rot: Math.random()*Math.PI*2 });
    }
  }

  function update(S, t, dt){
    // spawn keystone
    if (!S.boss && t >= S.nextKeystoneAt && S.keystonesCollected < S.keystonesGoal){
      spawnKeystone(S); scheduleNext(S);
    }
    if (!S.boss){
      maybeSpawnHeals(S, dt);
      maybeSpawnShard(S, dt);
    }

    const scroll = (S.CFG.BASE_SPEED || 210) * (dt/1000);

    // update keystones
    for (let i=S.keystones.length-1;i>=0;i--){
      const k=S.keystones[i];
      k.x += k.vx*(dt/1000); k.y += k.vy*(dt/1000) + scroll*0.35; k.rot += 0.02;
      // beam extraction
      tryBeamExtract(S, k, dt);
      // collected by harvester elsewhere
      if (k.y > S.H+40) S.keystones.splice(i,1);
    }

    // heals
    for (let i=S.heals.length-1;i>=0;i--){
      const h=S.heals[i];
      h.x += h.vx*(dt/1000); h.y += h.vy*(dt/1000) + scroll*0.4; h.rot += 0.02;
      if (Math.hypot(h.x-S.ship.x, h.y-S.ship.y) < 16){
        applyHeal(S, h.kind);
        S.heals.splice(i,1);
        continue;
      }
      if (h.y > S.H+40) S.heals.splice(i,1);
    }

    // resources
    for (let i=S.shards.length-1;i>=0;i--){
      const r=S.shards[i];
      r.x += r.vx*(dt/1000); r.y += r.vy*(dt/1000) + scroll*0.4; r.rot += 0.02;
      // ship beam can pull them in (visual)
      if (S.beamActiveVisual){
        const bx=S.ship.x, by=S.ship.y-8, dx=r.x-bx, dy=r.y-by;
        if (dy<0 && -dy<S.CFG.BEAM_LEN){
          const half=S.CFG.BEAM_HALF_W * (-dy/S.CFG.BEAM_LEN);
          if (Math.abs(dx)<half){ r.x=U.lerp(r.x,bx,0.18); r.y=U.lerp(r.y,by,0.18);
            if (Math.hypot(r.x-bx,r.y-by)<12){ S.shards.splice(i,1); S.score+=10; S.resources++; }
          }
        }
      }
      if (r.y > S.H+40) S.shards.splice(i,1);
    }
  }

  function tryBeamExtract(S, k, dt){
    // auto-beam when keystone in cone
    const bx=S.ship.x, by=S.ship.y-8, dx=k.x-bx, dy=k.y-by;
    if (dy<0 && -dy<S.CFG.BEAM_LEN){
      const half=S.CFG.BEAM_HALF_W * (-dy/S.CFG.BEAM_LEN);
      if (Math.abs(dx)<half){
        S.beamActiveVisual = true;
        const need = (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) ? S.CFG.KEYSTONE_BEAM_EXTRACT_MOBILE : S.CFG.KEYSTONE_BEAM_EXTRACT_DESKTOP;
        k.extract = (k.extract||0) + dt;
        if (k.extract >= need){
          // collect
          const idx=S.keystones.indexOf(k); if (idx!==-1) S.keystones.splice(idx,1);
          S.keystonesCollected++; S.score += (k.rarity==='rare'?60:40);
        }
      }
    }
  }

  function applyHeal(S, kind){
    const K = (kind==='large') ? S.CFG.HEAL_LARGE : S.CFG.HEAL_SMALL;
    S.player.hull   = Math.min(S.CFG.HULL_MAX, S.player.hull + K.hull);
    S.player.shield = Math.min(S.CFG.SHIELD_MAX, S.player.shield + K.shield);
  }

})();
