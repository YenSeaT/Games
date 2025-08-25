/* v2.0 render + HUD */
(function () {
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  Cosmic.render = { draw, setUI, buildPatterns };

  let UI = {};
  function setUI(refs){ UI = refs || {}; }

  // Offscreen patterns
  function makePattern(ctx, w, h, painter){
    const off = document.createElement('canvas'); off.width=w; off.height=h;
    const c = off.getContext('2d');
    painter(c, w, h);
    return ctx.createPattern(off, 'repeat');
  }

  function drawStars(c, w, h, count, alpha){
    c.fillStyle = `rgba(190,205,255,${alpha})`;
    for(let i=0;i<count;i++){ c.fillRect((Math.random()*w)|0,(Math.random()*h)|0,1,1); }
  }
  function drawBokeh(c, w, h, count){
    for(let i=0;i<count;i++){
      const x=Math.random()*w, y=Math.random()*h, r=1.2+Math.random()*3.2, a=0.28+Math.random()*0.22;
      const g=c.createRadialGradient(x,y,0,x,y,r*3);
      g.addColorStop(0,`rgba(170,190,255,${a})`); g.addColorStop(1,'rgba(170,190,255,0)');
      c.fillStyle=g; c.beginPath(); c.arc(x,y,r*3,0,Math.PI*2); c.fill();
    }
  }

  function buildPatterns(S){
    const ctx = S.ctx, W = Math.max(320, S.W), H = Math.max(240, S.H);
    const deep = makePattern(ctx, W, H, (c,w,h)=>{ drawStars(c,w,h,S.CFG.STAR_DEEP,0.5); });
    const mid  = makePattern(ctx, W, H, (c,w,h)=>{ drawStars(c,w,h,S.CFG.STAR_MID,0.85); });
    const near = makePattern(ctx, W, H, (c,w,h)=>{ drawStars(c,w,h,S.CFG.STAR_NEAR,1.0); });
    const bokeh = (S.CFG.BOKEH>0) ? makePattern(ctx, W, H, (c,w,h)=>{ drawBokeh(c,w,h,S.CFG.BOKEH); }) : null;
    S.bg.deepPattern=deep; S.bg.midPattern=mid; S.bg.nearPattern=near; S.bg.bokehPattern=bokeh;
  }

  // Pre-made bullet glow
  const bulletCanvas = document.createElement('canvas');
  bulletCanvas.width = bulletCanvas.height = 24;
  (function(){
    const c=bulletCanvas.getContext('2d');
    const g=c.createRadialGradient(12,12,0,12,12,12);
    g.addColorStop(0,'rgba(125,211,252,1)'); g.addColorStop(1,'rgba(125,211,252,0)');
    c.fillStyle=g; c.beginPath(); c.arc(12,12,12,0,Math.PI*2); c.fill();
  })();

  // Ship
  function drawShip(ctx,x,y,rot,bank){
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot+bank);
    // body
    ctx.fillStyle='#c6d0e6'; ctx.strokeStyle='#0f172a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(13,6);
    ctx.quadraticCurveTo(0,14,-13,6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // panel line
    ctx.strokeStyle='rgba(15,23,42,0.6)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-10,2); ctx.lineTo(10,2); ctx.stroke();
    // canopy
    ctx.fillStyle='#90a8ff'; ctx.beginPath(); ctx.moveTo(0,-12);
    ctx.quadraticCurveTo(6,-4,0,0); ctx.quadraticCurveTo(-6,-4,0,-12); ctx.fill();
    // winglets
    ctx.fillStyle='#9aa7bb'; ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-6,4); ctx.lineTo(-16,8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(6,4); ctx.lineTo(16,8); ctx.closePath(); ctx.fill();
    // nav lights
    ctx.fillStyle='#60a5fa'; ctx.fillRect(-16,2,2,2); ctx.fillStyle='#fca5a5'; ctx.fillRect(14,2,2,2);
    // engines
    ctx.globalCompositeOperation='lighter';
    const eg=ctx.createRadialGradient(0,28,2,0,28,20);
    eg.addColorStop(0,'rgba(102,204,255,0.7)'); eg.addColorStop(1,'rgba(102,204,255,0)');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(-4,26,6,14,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4,26,6,14,0,0,Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.restore();
  }

  function drawSaucer(ctx, x, y, t){
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin((t+y)*0.4)*0.02);
    const grad=ctx.createLinearGradient(-20,0,20,0);
    grad.addColorStop(0,'#7f2647'); grad.addColorStop(1,'#a63e63');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.ellipse(0,6,22,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffe0ea'; ctx.strokeStyle='rgba(120,30,60,0.8)'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.ellipse(0,-2,10,8,0,0,Math.PI); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawWingman(ctx, x, y){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='#c7d2fe'; ctx.strokeStyle='#1e293b'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(10,0); ctx.lineTo(0,10); ctx.lineTo(-10,0); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawShard(ctx, x, y, rot, colA, colB){
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
    const g=ctx.createLinearGradient(-8,-8,8,8);
    g.addColorStop(0,colA); g.addColorStop(1,colB);
    ctx.fillStyle=g; ctx.strokeStyle='rgba(16,94,84,0.5)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(8,0); ctx.lineTo(0,10); ctx.lineTo(-8,0); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawBeamCone(ctx, x, y, len, half){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g=ctx.createLinearGradient(x,y,x,y-len);
    g.addColorStop(0,'rgba(125,211,252,0.45)'); g.addColorStop(1,'rgba(192,132,252,0.0)');
    ctx.fillStyle=g; ctx.beginPath();
    ctx.moveTo(x,y); ctx.lineTo(x-half,y-len); ctx.lineTo(x+half,y-len); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation='source-over'; ctx.restore();
  }

  function drawBackground(ctx,S){
    const W=S.W, H=S.H;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
    const paint=(pat,offY,alpha)=>{
      ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=pat?pat:'rgba(10,14,30,.4)';
      ctx.translate(0, (offY||0)%H); ctx.fillRect(0,-H,W,H*2); ctx.restore();
    };
    paint(S.bg.deepPattern, S.bg.offY_deep, .35);
    paint(S.bg.midPattern,  S.bg.offY_mid,  .6);
    paint(S.bg.nearPattern, S.bg.offY_near, .95);
    if (S.bg.bokehPattern){
      ctx.save(); ctx.globalAlpha=.9; ctx.fillStyle=S.bg.bokehPattern;
      ctx.translate(0,(S.bg.offY_bokeh||0)%H); ctx.fillRect(0,-H,W,H*2); ctx.restore();
    }
  }

  function drawHUD(S){
    if (!UI.ready) return;
    UI.uiLevel.textContent = String(S.level);
    UI.uiScore.textContent = String(S.score);
    UI.uiKills.textContent = String(S.kills);
    UI.uiRes.textContent = String(S.resources);
    UI.uiShield.textContent = String(Math.round(S.player.shield));
    UI.uiHull.textContent   = String(Math.round(S.player.hull));
    UI.barShield.style.width = `${(S.player.shield/S.CFG.SHIELD_MAX)*100|0}%`;
    UI.barHull.style.width   = `${(S.player.hull/S.CFG.HULL_MAX)*100|0}%`;

    // Keystone icons
    UI.kText.textContent = ` ${S.keystonesCollected}/${S.keystonesGoal}`;
    const want = S.keystonesGoal;
    if (UI.kIcons.childElementCount !== want){
      UI.kIcons.innerHTML = '';
      for(let i=0;i<want;i++){
        const d=document.createElement('div'); d.className='kdot'; d.style.opacity='.35'; UI.kIcons.appendChild(d);
      }
    }
    for(let i=0;i<want;i++){
      UI.kIcons.children[i].style.opacity = (i < S.keystonesCollected) ? '1' : '.35';
    }

    // Boss HUD
    if (S.boss){
      UI.bossHUD.style.display='';
      const pct = Math.max(0, Math.min(1, S.boss.hp/S.boss.maxHp));
      UI.bossHPFill.style.width = `${pct*100}%`;
      UI.bossHPText.textContent = `${Math.round(pct*100)}%`;
    } else UI.bossHUD.style.display='none';
  }

  function draw(S, t){
    const ctx=S.ctx;
    drawBackground(ctx,S);

    // Harvester tether
    if (S.harvester.state !== 'dock'){
      const hx=S.harvester.x, hy=S.harvester.y, sx=S.ship.x, sy=S.ship.y-10;
      ctx.save(); ctx.strokeStyle='rgba(186,230,253,.5)'; ctx.lineWidth=1.2; ctx.beginPath();
      ctx.moveTo(sx,sy); const mx=(sx+hx)*.5, my=(sy+hy)*.5+12; ctx.quadraticCurveTo(mx,my,hx,hy); ctx.stroke(); ctx.restore();
    }

    // Keystones
    for (let i=0;i<S.keystones.length;i++){
      const k=S.keystones[i];
      drawShard(ctx,k.x,k.y,k.rot,'#a78bfa','#6d28d9');
    }
    // Healing Stones (small/large)
    for (let i=0;i<S.heals.length;i++){
      const h=S.heals[i]; drawShard(ctx,h.x,h.y,h.rot, h.kind==='large'?'#34d399':'#86efac', h.kind==='large'?'#22c55e':'#4ade80');
    }
    // Resources
    for (let i=0;i<S.shards.length;i++){
      const r=S.shards[i]; drawShard(ctx,r.x,r.y,r.rot,'#5eead4','#a7f3d0');
    }

    // Enemies
    const et=t/1000;
    for (let i=0;i<S.enemies.length;i++){ const e=S.enemies[i]; drawSaucer(ctx,e.x,e.y,et); }

    // Bullets/effects
    for (let i=0;i<S.bullets.length;i++){
      const b=S.bullets[i]; ctx.globalCompositeOperation='lighter'; ctx.drawImage(bulletCanvas, b.x-12, b.y-12); ctx.globalCompositeOperation='source-over';
    }
    for (let i=0;i<S.effects.length;i++){
      const fx=S.effects[i]; const k=fx.t/260; ctx.globalCompositeOperation='lighter';
      ctx.drawImage(bulletCanvas, fx.x-16, fx.y-16, 32*(1.1-k*.2), 32*(1.1-k*.2)); ctx.globalCompositeOperation='source-over';
    }

    // Beam visual if active
    if (S.beamActiveVisual) drawBeamCone(ctx, S.ship.x, S.ship.y-8, S.CFG.BEAM_LEN, S.CFG.BEAM_HALF_W);

    // Wingmen + Ship
    for (let i=0;i<S.wingmen.length;i++){ const w=S.wingmen[i]; drawWingman(ctx,w.x,w.y); }

    // Ship bank based on vx
    const bank = Math.max(-0.18, Math.min(0.18, (S.ship.vx||0)/700));
    drawShip(ctx,S.ship.x,S.ship.y,S.ship.rot,bank);

    drawHUD(S);
  }

  Cosmic.render.draw = draw;
  Cosmic.render.buildPatterns = buildPatterns;

  // Wire HUD refs once
  document.addEventListener('DOMContentLoaded', ()=>{
    Cosmic.render.setUI({
      ready:true,
      uiMode:document.getElementById('uiMode'),
      uiLevel:document.getElementById('uiLevel'),
      uiScore:document.getElementById('uiScore'),
      uiFPS:document.getElementById('uiFPS'),
      uiKills:document.getElementById('uiKills'),
      uiRes:document.getElementById('uiRes'),
      uiShield:document.getElementById('uiShield'),
      uiHull:document.getElementById('uiHull'),
      barShield:document.getElementById('barShield'),
      barHull:document.getElementById('barHull'),
      kIcons:document.getElementById('kIcons'),
      kText:document.getElementById('kText'),
      bossHUD:document.getElementById('bossHUD'),
      bossHPFill:document.getElementById('bossHPFill'),
      bossHPText:document.getElementById('bossHPText')
    });
  });
})();
