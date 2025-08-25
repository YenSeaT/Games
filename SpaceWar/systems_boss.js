/* v2.0 boss manager */
(function(){
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  const U = Cosmic.util = Cosmic.util || {};
  const EN = Cosmic.enemies;

  Cosmic.boss = { maybeStart, update, isBossLevel };

  function isBossLevel(level){ return level>0 && (level % 5) === 0; }

  function maybeStart(S){
    if (S.boss) return;
    if (!isBossLevel(S.level)) return;
    // Spawn boss
    const maxHp = 600 + S.level*80;
    S.boss = { x: S.W*0.5, y: S.H*0.25, vx: 80, phase: 0, hp: maxHp, maxHp, tBurst: 1200, tSweep: 2200, tMinions: 1800, thresh1: .7, thresh2: .35, enraged:false };
    // No keystones during boss
    S.keystones.length=0; S.heals.length=0; S.shards.length=0;
  }

  function update(S, t, dt){
    if (!S.boss) return;
    const b=S.boss, dtSec=dt/1000;
    // Move across lanes
    b.x += b.vx*dtSec;
    if (b.x < S.W*0.2 || b.x > S.W*0.8) b.vx *= -1;
    // mild vertical bob
    b.y = S.H*0.25 + Math.sin(t*0.002)*10;

    b.tBurst -= dt; b.tSweep -= dt; b.tMinions -= dt;

    if (b.tBurst<=0){ // radial burst
      EN.fireRadial(S, b.x,b.y, 12, 200);
      b.tBurst = 1200 - Math.min(700, (S.level*15));
    }
    if (b.tSweep<=0){ // sweeping arc (emit line of bullets)
      const dir = (Math.random()<0.5 ? -1 : 1);
      for (let i=0;i<10;i++){
        const a = (-Math.PI/2) + dir*(i*0.08);
        EN.fireOrb(S, b.x, b.y, a, 220);
      }
      b.tSweep = 2200 - Math.min(1200, (S.level*20));
    }
    if (b.tMinions<=0){
      // spawn a small gate
      for (let i=0;i<3;i++){
        const ex = S.W*(0.2+Math.random()*0.6);
        S.enemies.push({ x: ex, y: b.y+40+i*20, vx: U.rand(-30,30), vy: U.rand(120,160), hp: 2, phase: U.rand(0,6.28), ttl: 10000, drift: U.rand(0.6,1.2) });
      }
      b.tMinions = 1800;
    }

    // Threshold spawns
    const frac = b.hp/b.maxHp;
    if (!b.enraged && frac < b.thresh2){
      b.enraged = true; b.vx *= 1.2; // speed up
      // quick minion burst
      for (let i=0;i<5;i++){
        const ex = S.W*(0.2+Math.random()*0.6);
        S.enemies.push({ x: ex, y: b.y+40+i*16, vx: U.rand(-40,40), vy: U.rand(140,180), hp: 3, phase: U.rand(0,6.28), ttl: 12000, drift: U.rand(0.6,1.2) });
      }
    }

    // Death
    if (b.hp<=0){
      S.effects.push({x:b.x,y:b.y,t:520});
      S.score += 300;
      S.kills += 10;
      S.boss = null;
      // Treat as level complete
      S.levelComplete = true;
    }
  }

})();
