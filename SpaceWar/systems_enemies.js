/* v2.0 enemies, wingmen, bullets, collisions */
(function(){
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  const U = Cosmic.util = Cosmic.util || {};
  Cosmic.enemies = { spawnWave, updateAll, updateWingman, fireOrb, fireRadial, damagePlayer };

  function fireOrb(S, x,y,ang,speed){ if(S.bullets.length>140) S.bullets.shift(); S.bullets.push({x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,life:700}); }
  function fireRadial(S, x,y,count,speed){ for(let i=0;i<count;i++){ const a=(i/count)*Math.PI*2; fireOrb(S,x,y,a,speed); } }
  Cosmic.util.fireOrb = (x,y,a,s)=>fireOrb(Cosmic.state,x,y,a,s);
  Cosmic.util.fireRadial = (x,y,c,s)=>fireRadial(Cosmic.state,x,y,c,s);

  function spawnWave(S){
    const n = Math.floor(U.rand(S.CFG.ENEMY_WAVE_SIZE[0], S.CFG.ENEMY_WAVE_SIZE[1]+1));
    for (let i=0;i<n;i++){
      const side = Math.random()<0.5 ? -1 : 1;
      const ex = side<0 ? U.rand(S.W*0.05,S.W*0.4) : U.rand(S.W*0.6,S.W*0.95);
      S.enemies.push({ x: ex, y: -40 - i*30, vx: U.rand(-40,40), vy: U.rand(100,150), hp: S.CFG.ENEMY_HP, phase: U.rand(0,6.28), ttl: 12000, drift: U.rand(0.6,1.2) });
    }
    // early engage band 20–60%
    S.engageBandY = S.H * U.rand(0.2, 0.6);
  }

  function updateAll(S, t, dt){
    const dtSec=dt/1000, scroll=(S.CFG.BASE_SPEED||210)*dtSec;
    // enemies motion + avoidance near player
    for (let i=S.enemies.length-1;i>=0;i--){
      const e=S.enemies[i];
      e.ttl -= dt;
      const swayX = Math.sin((t*0.002 + e.phase)*2.0)*40*e.drift;
      const swayY = Math.cos((t*0.002 + e.phase)*1.6)*10*e.drift;
      e.x += (e.vx*dtSec) + swayX*dtSec;
      e.y += (e.vy*dtSec) + (scroll*0.25) + swayY*dtSec;

      // respect radius around ship
      const dx=e.x-S.ship.x, dy=e.y-S.ship.y, d2=dx*dx+dy*dy;
      if (d2 < 60*60) { e.x += (dx/Math.sqrt(d2||1))*20*dtSec; e.y += (dy/Math.sqrt(d2||1))*20*dtSec; }

      if (e.x<20 || e.x>S.W-20) e.vx*=-1;
      if (e.y > S.H+60 || e.ttl<=0) { S.enemies.splice(i,1); continue; }

      // collision damage to player
      if (Math.hypot(dx,dy) < 18){
        damagePlayer(S, S.CFG.DMG_CONTACT);
        // slight knock
        S.ship.vx += (dx>0?40:-40);
        S.ship.vy += -60;
        S.enemies.splice(i,1);
      }
    }

    // wingmen
    for (let i=0;i<S.wingmen.length;i++) updateWingman(S, S.wingmen[i], dt, t);

    // bullets
    for (let i=S.bullets.length-1;i>=0;i--){
      const b=S.bullets[i];
      b.x += b.vx*dtSec; b.y += b.vy*dtSec - scroll*0.05; b.life -= dt;
      if (b.life<=0 || b.x<-80 || b.x>S.W+80 || b.y<-120 || b.y>S.H+120){ S.bullets.splice(i,1); continue; }
      // hit enemies
      for (let j=S.enemies.length-1;j>=0;j--){
        const en=S.enemies[j]; const r=18;
        const d2=(en.x-b.x)*(en.x-b.x)+(en.y-b.y)*(en.y-b.y);
        if (d2 < r*r){
          en.hp--; S.bullets.splice(i,1); S.score+=12;
          if (en.hp<=0){ S.enemies.splice(j,1); S.kills++; S.effects.push({x:en.x,y:en.y,t:260}); }
          break;
        }
      }
      // boss gets hit
      if (S.boss){
        const d2=(S.boss.x-b.x)*(S.boss.x-b.x)+(S.boss.y-b.y)*(S.boss.y-b.y);
        if (d2 < (28*28)){ S.bullets.splice(i,1); S.boss.hp -= 6; S.score+=4; if (S.boss.hp<0) S.boss.hp=0; }
      }
    }

    // effects decay
    for (let i=S.effects.length-1;i>=0;i--){ const fx=S.effects[i]; fx.t-=dt; if (fx.t<=0) S.effects.splice(i,1); }
  }

  function sideFilter(S, w, e){
    const left = (e.x < S.ship.x);
    return (w.side<0 ? left : !left);
  }

  function updateWingman(S, w, dt, t){
    const Ulerp=U.lerp, cfg=S.CFG;
    w.cool=Math.max(0,w.cool-dt); w.fireCd=Math.max(0,w.fireCd-dt); w.tpT=Math.max(0,w.tpT-dt);
    const dockX=S.W*0.5 + w.side*cfg.WING_OFFSET, dockY=S.ship.y+8;

    // Simulated controls
    const ctl = (w.side<0 ? S.wingCtl.L : S.wingCtl.R) || 'auto';
    if (ctl==='deploy' && (w.state==='dock'||w.state==='cool')) w.state='launch';
    if (ctl==='recall' && w.state!=='dock') w.state='return';

    if (w.state==='dock'){ w.x=dockX; w.y=dockY; if (S.enemies.some(e=>e.y<S.engageBandY) && w.cool<=0 && ctl!=='recall') w.state='launch'; }
    else if (w.state==='launch'){ w.x=Ulerp(w.x||dockX,dockX,0.1); w.y=Ulerp(w.y||dockY,S.ship.y-60,0.1); if (Math.abs((w.y||dockY)-(S.ship.y-60))<5){ w.state='attack'; w.target=-1; w.tpT=0; } }
    else if (w.state==='attack'){
      if (S.enemies.length===0 || ctl==='recall'){ w.state='return'; }
      else{
        if (w.target<0 || w.target>=S.enemies.length || !sideFilter(S,w,S.enemies[w.target])){
          let idx=-1,best=1e9;
          for(let j=0;j<S.enemies.length;j++){
            const e=S.enemies[j]; if(!(e.y<S.engageBandY)) continue;
            if (!sideFilter(S,w,e)) continue;
            const sscore=Math.abs(e.x - (S.W*0.5 + w.side*40)) - Math.max(0,S.ship.y - e.y)*0.2;
            if (sscore<best){ best=sscore; idx=j; }
          }
          // fallback: any ahead
          if (idx===-1){ best=1e9; for(let j=0;j<S.enemies.length;j++){ const e=S.enemies[j]; if(e.y<S.engageBandY){ const d=Math.hypot(e.x-(w.x||dockX), e.y-(w.y||dockY)); if(d<best){best=d; idx=j;} } } }
          w.target=idx;
        }
        const tar=S.enemies[w.target];
        if (!tar){ w.state='return'; }
        else{
          if (w.tpT<=0){
            const ang=(t*0.002 + (w.side>0?0:Math.PI))%(Math.PI*2), radius=46;
            w.x=tar.x + Math.cos(ang)*radius; w.y=tar.y + Math.sin(ang)*radius; w.tpT=220;
            if (w.fireCd<=0){
              const tau = 0.18 + Math.random()*0.06;
              const a = Math.atan2((tar.y+tar.vy*tau)-w.y, (tar.x+tar.vx*tau)-w.x);
              if(Math.random()<0.6){ fireOrb(S,w.x,w.y,a,280); fireOrb(S,w.x,w.y,a+0.12,260); fireOrb(S,w.x,w.y,a-0.12,260); }
              else { fireRadial(S,w.x,w.y,6,220); }
              w.fireCd=cfg.FIRE_COOLDOWN;
            }
          } else { w.x=Ulerp(w.x, tar.x + w.side*36, 0.08); w.y=Ulerp(w.y, tar.y, 0.08); }
          if (tar.y>S.ship.y+120) w.state='return';
        }
      }
    } else if (w.state==='return'){ w.x=Ulerp(w.x,dockX,0.12); w.y=Ulerp(w.y,dockY,0.12); if (Math.hypot(w.x-dockX,w.y-dockY)<4){ w.state='cool'; w.cool=cfg.WING_COOLDOWN; } }
    else if (w.state==='cool'){ w.x=dockX; w.y=dockY; if(w.cool<=0 && ctl!=='recall') w.state='dock'; }
  }

  function damagePlayer(S, dmg){
    // shield first then hull
    const sd = Math.min(S.player.shield, dmg);
    S.player.shield -= sd; dmg -= sd;
    if (dmg>0) S.player.hull = Math.max(0, S.player.hull - dmg);
    S.player.shieldTimer = S.CFG.SHIELD_REGEN_DELAY;
  }

  Cosmic.enemies.fireOrb = fireOrb;
  Cosmic.enemies.fireRadial = fireRadial;
  Cosmic.enemies.damagePlayer = damagePlayer;

})();
