/* global window, document */
(function () {
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  Cosmic.render = { draw, setUIRefs };

  let UI = {};
  function setUIRefs(refs) { UI = refs || {}; }

  // --- Shared little sprite for bullets/glows
  const orb = document.createElement('canvas');
  orb.width = orb.height = 28;
  (function () {
    const c = orb.getContext('2d');
    const g = c.createRadialGradient(14, 14, 0, 14, 14, 14);
    g.addColorStop(0, 'rgba(150,242,255,1)');
    g.addColorStop(1, 'rgba(150,242,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(14,14,14,0,Math.PI*2); c.fill();
  })();
  const orbRed = document.createElement('canvas');
  orbRed.width = orbRed.height = 26;
  (function () {
    const c = orbRed.getContext('2d');
    const g = c.createRadialGradient(13, 13, 0, 13, 13, 13);
    g.addColorStop(0, 'rgba(255,150,150,1)');
    g.addColorStop(1, 'rgba(255,150,150,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(13,13,13,0,Math.PI*2); c.fill();
  })();

  function drawSaucer(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin((t + y) * 0.3) * 0.02);

    const diskGrad = ctx.createLinearGradient(-20, 0, 20, 0);
    diskGrad.addColorStop(0, '#7f2647');
    diskGrad.addColorStop(1, '#a63e63');
    ctx.fillStyle = diskGrad;
    ctx.beginPath(); ctx.ellipse(0,6,22,10,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#ffe0ea';
    ctx.strokeStyle = 'rgba(120,30,60,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0,-2,10,8,0,0,Math.PI); ctx.fill(); ctx.stroke();

    // glow ring
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(orb, -12, 0, 24, 24);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawShip(ctx, x, y, rot, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // fuselage
    ctx.fillStyle = '#c6d0e6';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 6);
    ctx.quadraticCurveTo(0, 12, -14, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // winglets
    ctx.fillStyle = '#9fb3d2';
    ctx.beginPath();
    ctx.moveTo(-14, 6); ctx.lineTo(-24, 10); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 6); ctx.lineTo(24, 10); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill();

    // panel line
    ctx.strokeStyle = 'rgba(20,30,50,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6,2); ctx.lineTo(6,2); ctx.stroke();

    // canopy
    ctx.fillStyle = '#90a8ff';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(6, -4, 0, 0);
    ctx.quadraticCurveTo(-6, -4, 0, -12);
    ctx.fill();

    // nav lights
    ctx.globalCompositeOperation = 'lighter';
    const blink = (Math.sin(t*3) > 0.2);
    if (blink) { ctx.drawImage(orb, -28, 6, 12, 12); ctx.drawImage(orb, 16, 6, 12, 12); }
    // exhaust glow
    ctx.drawImage(orb, -12, 22, 24, 24);
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }

  function drawWing(ctx, x, y) {
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle = '#c7d2fe'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(9,1); ctx.lineTo(0,9); ctx.lineTo(-9,1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawDiamond(ctx, x, y, rare, t) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(t*2 + y*0.02)*0.15);
    const g = ctx.createLinearGradient(-10,-10,10,10);
    g.addColorStop(0, rare ? '#e879f9' : '#5eead4');
    g.addColorStop(1, rare ? '#a78bfa' : '#a7f3d0');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(16,94,84,0.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(10,0); ctx.lineTo(0,12); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(orb, -16,-16,32,32);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawHeal(ctx, x, y, kind) {
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle = (kind==='L') ? '#34d399' : '#93c5fd';
    ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(-1, -5, 2, 10);
    ctx.fillRect(-5, -1, 10, 2);
    ctx.restore();
  }

  function drawShard(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
    const g = ctx.createLinearGradient(-8,-8,8,8);
    g.addColorStop(0, '#5eead4'); g.addColorStop(1, '#a7f3d0');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(16,94,84,0.5)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(8,0); ctx.lineTo(0,10); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawBackground(ctx, S) {
    if (!S || !S.bg) {
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle = '#050a1a';
      ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height);
      return;
    }
    const W = S.W, H = S.H;
    const deep=S.bg.deepPattern, mid=S.bg.midPattern, near=S.bg.nearPattern, bokeh=S.bg.bokehPattern;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

    const layer = (pat, offY, alpha) => {
      ctx.save();
      if (pat) ctx.fillStyle = pat; else { ctx.fillStyle = `rgba(12,16,30,${alpha})`; }
      ctx.translate(0, (offY||0) % H);
      ctx.fillRect(0, -H, W, H*2);
      ctx.restore();
    };
    layer(deep,  S.bg.offY_deep, 0.35);
    layer(mid,   S.bg.offY_mid,  0.55);
    layer(near,  S.bg.offY_near, 0.75);
    if (bokeh) layer(bokeh, S.bg.offY_bokeh, 0.6);
  }

  function drawBeamCone(ctx, shipX, shipY, len, half, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(shipX, shipY, shipX, shipY - len);
    g.addColorStop(0, `rgba(125,211,252,${alpha})`);
    g.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(shipX, shipY);
    ctx.lineTo(shipX - half, shipY - len);
    ctx.lineTo(shipX + half, shipY - len);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function draw(ctx, S, CFG, tMs) {
    const t = tMs / 1000;
    drawBackground(ctx, S);

    // Soft beam visual when something is extractable
    let beamVis = false;
    for (let i=0;i<S.keystones.length;i++){ const k=S.keystones[i]; const dx=k.x-S.ship.x, dy=(k.y-(S.ship.y-8)); if (dy<0 && -dy<CFG.BEAM_LEN){ const half=CFG.BEAM_HALF_W*(-dy/CFG.BEAM_LEN); if(Math.abs(dx)<half){ beamVis=true; break; } } }
    if (!beamVis) {
      for (let i=0;i<S.heals.length;i++){ const h=S.heals[i]; const dx=h.x-S.ship.x, dy=(h.y-(S.ship.y-8)); if (dy<0 && -dy<CFG.BEAM_LEN){ const half=CFG.BEAM_HALF_W*(-dy/CFG.BEAM_LEN); if(Math.abs(dx)<half){ beamVis=true; break; } } }
    }
    if (!beamVis) {
      for (let i=0;i<S.shards.length;i++){ const s=S.shards[i]; const dx=s.x-S.ship.x, dy=(s.y-(S.ship.y-8)); if (dy<0 && -dy<CFG.BEAM_LEN){ const half=CFG.BEAM_HALF_W*(-dy/CFG.BEAM_LEN); if(Math.abs(dx)<half){ beamVis=true; break; } } }
    }
    if (beamVis) drawBeamCone(ctx, S.ship.x, S.ship.y-8, CFG.BEAM_LEN, CFG.BEAM_HALF_W, 0.45);

    // Keystones
    for (let i=0;i<S.keystones.length;i++) {
      const k = S.keystones[i];
      drawDiamond(ctx, k.x, k.y, k.rarity==='rare', t);
      if (k.extract>0) { // extraction halo
        const amt = Math.min(1, k.extract / (S.isMobile ? 900 : 700));
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(orb, k.x-18, k.y-18, 36+amt*12, 36+amt*12);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // Heals
    for (let i=0;i<S.heals.length;i++) drawHeal(ctx, S.heals[i].x, S.heals[i].y, S.heals[i].kind);

    // Shards
    for (let i=0;i<S.shards.length;i++) drawShard(ctx, S.shards[i].x, S.shards[i].y, S.shards[i].rot);

    // Enemies
    for (let i=0;i<S.enemies.length;i++) drawSaucer(ctx, S.enemies[i].x, S.enemies[i].y, t);

    // Enemy bullets
    for (let i=0;i<S.eBullets.length;i++) {
      const b = S.eBullets[i];
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(orbRed, b.x-13, b.y-13);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Our bullets + effects
    for (let i=0;i<S.bullets.length;i++) { const b=S.bullets[i]; ctx.globalCompositeOperation='lighter'; ctx.drawImage(orb, b.x-14, b.y-14); ctx.globalCompositeOperation='source-over'; }
    for (let i=0;i<S.effects.length;i++) {
      const fx = S.effects[i]; const k = 1 - Math.max(0, Math.min(1, fx.t/800));
      ctx.globalCompositeOperation='lighter';
      ctx.drawImage(orbRed, fx.x-18-k*6, fx.y-18-k*6, 36+k*12, 36+k*12);
      ctx.globalCompositeOperation='source-over';
    }

    // Harvester tether & bike
    if (S.harvester.state !== 'dock') {
      const hx=S.harvester.x, hy=S.harvester.y, sx=S.ship.x, sy=S.ship.y-10;
      ctx.save(); ctx.strokeStyle='rgba(186,230,253,0.55)'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy); const mx=(sx+hx)*0.5, my=(sy+hy)*0.5 + 12; ctx.quadraticCurveTo(mx,my,hx,hy); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(S.harvester.x, S.harvester.y);
    ctx.fillStyle='#e2e8f0'; ctx.strokeStyle='#0f172a'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.ellipse(0,0,10,6,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#93c5fd'; ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4,0); ctx.lineTo(0,6); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Wingmen
    for (let i=0;i<S.wingmen.length;i++) drawWing(ctx, S.wingmen[i].x, S.wingmen[i].y);

    // Ship last so it’s on top
    drawShip(ctx, S.ship.x, S.ship.y, S.ship.rot, t);

    // HUD updates (bars + progress)
    const shield = Math.max(0, Math.min(100, S.ship.shield));
    const hull   = Math.max(0, Math.min(100, S.ship.hull));
    const f1 = document.getElementById('shieldFill'); if (f1) f1.style.width = shield + '%';
    const f2 = document.getElementById('hullFill');   if (f2) f2.style.width = hull + '%';

    // progress: keystones or BOSS
    const progBar = document.getElementById('progBar');
    if (progBar) {
      let pct = 0;
      if (S.bossActive && S.boss) pct = (1 - Math.max(0, Math.min(1, S.boss.hp / S.boss.maxHp))) * 100;
      else if (!S.bossActive && S.keystonesGoal>0) pct = Math.max(0, Math.min(100, (S.keystonesCollected / S.keystonesGoal) * 100));
      progBar.style.width = pct + '%';
    }

    // Numbers (fallback if core didn't set)
    if (UI.uiScore && !UI.uiScore.textContent) UI.uiScore.textContent = '0';
  }
})();
