/* global window, document */
(function () {
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  Cosmic.render = { draw, setUIRefs, makeStickVisual };

  let UI = {};
  function setUIRefs(refs) { UI = refs || {}; }

  function makeStickVisual(nx, ny) {
    const stick = document.getElementById('stick');
    if (!stick) return;
    const RX = 36, RY = 18; // in paddle bar
    stick.style.transform = `translate(${nx * RX}px, ${ny * RY}px)`;
  }

  // Simple cached gradient for bullets
  const bulletCanvas = document.createElement('canvas');
  bulletCanvas.width = bulletCanvas.height = 24;
  (function () {
    const c = bulletCanvas.getContext('2d');
    const g = c.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(125,211,252,1)');
    g.addColorStop(1, 'rgba(125,211,252,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(12, 12, 12, 0, Math.PI * 2);
    c.fill();
  })();

  function drawBullet(ctx, b) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(bulletCanvas, b.x - 12, b.y - 12);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawShip(ctx, x, y, rot, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    // fuselage
    ctx.fillStyle = '#c6d0e6';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 6);
    ctx.quadraticCurveTo(0, 12, -12, 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // canopy
    ctx.fillStyle = '#90a8ff';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(6, -4, 0, 0);
    ctx.quadraticCurveTo(-6, -4, 0, -12);
    ctx.fill();

    // exhaust glow
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(0, 28, 2, 0, 28, 20);
    eg.addColorStop(0, 'rgba(102,204,255,0.7)');
    eg.addColorStop(1, 'rgba(102,204,255,0)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(0, 26, 8, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }

  function drawSaucer(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin((t + y) * 0.4) * 0.02);

    // disk
    const diskGrad = ctx.createLinearGradient(-20, 0, 20, 0);
    diskGrad.addColorStop(0, '#7f2647');
    diskGrad.addColorStop(1, '#a63e63');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.ellipse(0, 6, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // dome
    ctx.fillStyle = '#ffe0ea';
    ctx.strokeStyle = 'rgba(120,30,60,0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -2, 10, 8, 0, 0, Math.PI);
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  function drawBlinkWingman(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#c7d2fe';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(9, 1);
    ctx.lineTo(0, 9);
    ctx.lineTo(-9, 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawShard(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    const grad = ctx.createLinearGradient(-8, -8, 8, 8);
    grad.addColorStop(0, '#5eead4'); grad.addColorStop(1, '#a7f3d0');
    ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(16,94,84,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function ringBeam(ctx, x1, y1, x2, y2, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, `rgba(150,242,255,${0.35 * t})`);
    g.addColorStop(1, 'rgba(150,242,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 8 * t;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  // DEFENSIVE: background draw safe when patterns are not built yet
  function drawBackground(ctx, S) {
    if (!S || !S.bg) {
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle = '#050a1a';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }
    const W = S.W, H = S.H;
    const deep  = S.bg.deepPattern  || null;
    const mid   = S.bg.midPattern   || null;
    const near  = S.bg.nearPattern  || null;
    const bokeh = S.bg.bokehPattern || null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const paintLayer = (pattern, offY, alpha) => {
      ctx.save();
      ctx.fillStyle = pattern ? pattern : `rgba(10,14,30,${alpha})`;
      ctx.translate(0, (offY || 0) % H);
      ctx.fillRect(0, -H, W, H * 2);
      ctx.restore();
    };

    paintLayer(deep,  S.bg.offY_deep, 0.35);
    paintLayer(mid,   S.bg.offY_mid,  0.55);
    paintLayer(near,  S.bg.offY_near, 0.75);

    if (bokeh) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = bokeh;
      ctx.translate(0, (S.bg.offY_bokeh || 0) % H);
      ctx.fillRect(0, -H, W, H * 2);
      ctx.restore();
    }
  }

  function draw(ctx, S, CFG, t) {
    drawBackground(ctx, S);

    // Rings
    for (let i = 0; i < S.rings.length; i++) {
      const r = S.rings[i];
      if (r.mT) ringBeam(ctx, S.ship.x, S.ship.y - 8, r.x, r.y, r.mT);
      ctx.save();
      ctx.strokeStyle = r.kind === 'gate' ? 'rgba(180,235,255,0.95)' : 'rgba(150,242,255,0.95)';
      ctx.lineWidth = Math.max(5, r.r * 0.22);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Shards
    for (let i = 0; i < S.shards.length; i++) drawShard(ctx, S.shards[i].x, S.shards[i].y, S.shards[i].rot);

    // Enemies
    const tt = t / 1000;
    for (let i = 0; i < S.enemies.length; i++) drawSaucer(ctx, S.enemies[i].x, S.enemies[i].y, tt);

    // Bullets / effects
    for (let i = 0; i < S.bullets.length; i++) drawBullet(ctx, S.bullets[i]);
    for (let i = 0; i < S.effects.length; i++) {
      const fx = S.effects[i]; const k = fx.t / 260;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bulletCanvas, fx.x - 18, fx.y - 18, 36 * (1.2 - k * 0.2), 36 * (1.2 - k * 0.2));
      ctx.globalCompositeOperation = 'source-over';
    }

    // Ship beam visual
    if (S.beamActiveVisual) {
      const bx = S.ship.x, by = S.ship.y - 8, len = CFG.BEAM_LEN, half = CFG.BEAM_HALF_W;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const grad2 = ctx.createLinearGradient(bx, by, bx, by - len);
      grad2.addColorStop(0, 'rgba(125,211,252,0.45)'); grad2.addColorStop(1, 'rgba(192,132,252,0.0)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx - half, by - len); ctx.lineTo(bx + half, by - len);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // Harvester tether & bike
    if (S.harvester.state !== 'dock') {
      const hx = S.harvester.x, hy = S.harvester.y, sx = S.ship.x, sy = S.ship.y - 10;
      ctx.save(); ctx.strokeStyle = 'rgba(186,230,253,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const mx = (sx + hx) * 0.5, my = (sy + hy) * 0.5 + 12;
      ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke(); ctx.restore();
    }
    // Bike
    ctx.save();
    ctx.translate(S.harvester.x, S.harvester.y);
    ctx.fillStyle = '#e2e8f0'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#93c5fd'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Wingmen + Ship
    for (let i = 0; i < S.wingmen.length; i++) drawBlinkWingman(ctx, S.wingmen[i].x, S.wingmen[i].y);
    drawShip(ctx, S.ship.x, S.ship.y, S.ship.rot, 1);

    // HUD text & progress
    if (UI.uiScore) UI.uiScore.textContent = String(S.score);
    if (UI.uiLevel) UI.uiLevel.textContent = String(S.level);
    if (UI.uiRings) UI.uiRings.textContent = `${S.ringsCleared}/${S.ringsGoal}`;
    if (UI.uiEnemies) UI.uiEnemies.textContent = String(S.enemies.length);
    if (UI.uiKills) UI.uiKills.textContent = String(S.kills);
    if (UI.uiRes) UI.uiRes.textContent = String(S.resources);
    if (UI.uiBeam) UI.uiBeam.textContent = 'Auto';
    const progBar = document.getElementById('progBar');
    if (progBar) progBar.style.width = `${Math.max(0, Math.min(100, S.distProgress * 100))}%`;
  }
})();
