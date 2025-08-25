/* global window, document */
(function () {
  'use strict';

  // Namespace
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  Cosmic.render = { draw, ringStroke, setUIRefs, makeStickVisual };

  // UI refs (assigned on DOM ready by core)
  let UI = {};
  function setUIRefs(refs) { UI = refs || {}; }
  function makeStickVisual(nx, ny) {
    // nx,ny in [-1,1]; move the stick visually
    const pad = document.getElementById('pad');
    const stick = document.getElementById('stick');
    if (!pad || !stick) return;
    const R = 56;
    stick.style.transform = `translate(${nx * R}px, ${ny * R}px)`;
  }

  // ------- Drawing helpers -------
  function ringStroke(ctx, x1, y1, x2, y2, t) {
    // beam from (x1,y1) to (x2,y2), intensity t ∈ [0,1]
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, `rgba(150,242,255,${0.35 * t})`);
    g.addColorStop(1, 'rgba(150,242,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 8 * t;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawShip(ctx, x, y, rot, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    // exhaust glow
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(0, 28, 2, 0, 28, 22);
    eg.addColorStop(0, 'rgba(102,204,255,0.8)');
    eg.addColorStop(1, 'rgba(102,204,255,0)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(0, 28, 10, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // fuselage
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#c6d0e6';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 6);
    ctx.quadraticCurveTo(0, 12, -12, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // canopy
    ctx.fillStyle = '#90a8ff';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(6, -4, 0, 0);
    ctx.quadraticCurveTo(-6, -4, 0, -12);
    ctx.fill();

    // wings
    ctx.fillStyle = '#9aa7bb';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-2, 16);
    ctx.lineTo(-22, 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(6, 6);
    ctx.lineTo(2, 16);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fill();

    // fin
    ctx.fillStyle = '#6f6cf8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(3, 12);
    ctx.lineTo(-3, 12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawSaucer(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin((t + y) * 0.4) * 0.02);

    // glow
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 6, 2, 0, 6, 22);
    g.addColorStop(0, 'rgba(255,180,220,0.6)');
    g.addColorStop(1, 'rgba(255,180,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 12, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // dome
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe0ea';
    ctx.strokeStyle = 'rgba(120,30,60,0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -2, 10, 8, 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();

    // disk
    const diskGrad = ctx.createLinearGradient(-20, 0, 20, 0);
    diskGrad.addColorStop(0, '#7f2647');
    diskGrad.addColorStop(1, '#a63e63');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.ellipse(0, 6, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // lights
    ctx.globalCompositeOperation = 'lighter';
    for (let i = -2; i <= 2; i++) {
      const lx = -12 + i * 6;
      const ly = 8 + Math.sin(t * 2 + i) * 1.2;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 4);
      lg.addColorStop(0, 'rgba(255,100,150,0.9)');
      lg.addColorStop(1, 'rgba(255,100,150,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBlinkWingman(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // halo
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    halo.addColorStop(0, 'rgba(160,200,255,0.8)');
    halo.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#c7d2fe';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(9, 1);
    ctx.lineTo(0, 9);
    ctx.lineTo(-9, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8aa2ff';
    ctx.beginPath();
    ctx.arc(0, 1.5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawShard(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(-8, -8, 8, 8);
    grad.addColorStop(0, '#5eead4');
    grad.addColorStop(1, '#a7f3d0');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(16,94,84,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBike(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2.4) * 0.06);
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBullet(ctx, b) {
    // orbs only (wingmen fire)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6);
    rg.addColorStop(0, 'rgba(125,211,252,1)');
    rg.addColorStop(1, 'rgba(125,211,252,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ------- Frame draw -------
  function draw(ctx, S, CFG, t) {
    // Background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S.W, S.H);
    const bg = ctx.createLinearGradient(0, 0, 0, S.H);
    bg.addColorStop(0, '#050a1a');
    bg.addColorStop(1, '#020612');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S.W, S.H);

    // galaxies
    for (let i = 0; i < S.galaxies.length; i++) {
      const g = S.galaxies[i];
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.78;
      // quick soft circle core
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, g.r);
      core.addColorStop(0, 'rgba(255,255,255,0.2)');
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // nebulas
    for (let i = 0; i < S.nebulas.length; i++) {
      const nb = S.nebulas[i];
      const gg = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
      gg.addColorStop(0, 'rgba(100,180,255,0.1)');
      gg.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(nb.x, nb.y, nb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // planets
    for (let i = 0; i < S.planets.length; i++) {
      const p = S.planets[i];
      const gp = ctx.createRadialGradient(p.x, p.y, p.r * 0.1, p.x, p.y, p.r);
      gp.addColorStop(0, 'rgba(255,255,255,0.2)');
      gp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gp;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // stars
    ctx.fillStyle = 'rgba(150,170,230,0.5)';
    for (let i = 0; i < S.deep.length; i++) ctx.fillRect(S.deep[i].x | 0, S.deep[i].y | 0, 1, 1);
    for (let i = 0; i < S.bokeh.length; i++) {
      const bb = S.bokeh[i];
      ctx.save();
      ctx.shadowBlur = bb.blur;
      ctx.shadowColor = `rgba(170,190,255,${bb.a})`;
      ctx.beginPath();
      ctx.arc(bb.x, bb.y, bb.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(170,190,255,0)';
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(190,205,255,0.85)';
    for (let i = 0; i < S.mid.length; i++) ctx.fillRect(S.mid[i].x | 0, S.mid[i].y | 0, 1, 1);
    ctx.fillStyle = 'rgba(230,238,255,1)';
    for (let i = 0; i < S.near.length; i++) ctx.fillRect(S.near[i].x | 0, S.near[i].y | 0, 1, 1);

    // ring magnet beams + rings
    for (let i = 0; i < S.rings.length; i++) {
      const r = S.rings[i];
      if (r.mT) ringStroke(ctx, S.ship.x, S.ship.y - 8, r.x, r.y, r.mT);
      ctx.save();
      ctx.strokeStyle = 'rgba(150,242,255,0.95)';
      ctx.lineWidth = Math.max(5, r.r * 0.22);
      ctx.shadowBlur = r.r * 0.45;
      ctx.shadowColor = 'rgba(54,209,255,1)';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // shards
    for (let i = 0; i < S.shards.length; i++) {
      const sh = S.shards[i];
      drawShard(ctx, sh.x, sh.y, sh.rot);
    }

    // enemies
    const tt = t / 1000;
    for (let i = 0; i < S.enemies.length; i++) {
      const e = S.enemies[i];
      drawSaucer(ctx, e.x, e.y, tt);
    }

    // bullets
    for (let i = 0; i < S.bullets.length; i++) drawBullet(ctx, S.bullets[i]);

    // effects
    for (let i = 0; i < S.effects.length; i++) {
      const fx = S.effects[i];
      const k = fx.t / 260;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, 36);
      rg.addColorStop(0, `rgba(255,255,255,${0.6 * k})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 36 * (1.2 - k * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ship beam (visualized if active)
    if (S.beamActiveVisual) {
      const bx = S.ship.x, by = S.ship.y - 8, len = CFG.BEAM_LEN, half = CFG.BEAM_HALF_W;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad2 = ctx.createLinearGradient(bx, by, bx, by - len);
      grad2.addColorStop(0, 'rgba(125,211,252,0.45)');
      grad2.addColorStop(1, 'rgba(192,132,252,0.0)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - half, by - len);
      ctx.lineTo(bx + half, by - len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // harvester bike + tether/beam
    if (S.harvester.state !== 'dock') {
      const hx = S.harvester.x, hy = S.harvester.y;
      const sx = S.ship.x, sy = S.ship.y - 10;
      ctx.save();
      ctx.strokeStyle = 'rgba(186,230,253,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const mx = (sx + hx) * 0.5, my = (sy + hy) * 0.5 + 12;
      ctx.quadraticCurveTo(mx, my, hx, hy);
      ctx.stroke();
      ctx.restore();
      if (S.harvester.state === 'grab' || S.harvester.state === 'tow') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(hx, hy, hx, hy - 38);
        gr.addColorStop(0, 'rgba(167,243,208,0.6)');
        gr.addColorStop(1, 'rgba(167,243,208,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 14, hy - 38);
        ctx.lineTo(hx + 14, hy - 38);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    drawBike(ctx, S.harvester.x, S.harvester.y, tt);

    // wingmen + ship
    drawBlinkWingman(ctx, S.wingmen[0].x, S.wingmen[0].y);
    drawBlinkWingman(ctx, S.wingmen[1].x, S.wingmen[1].y);
    drawShip(ctx, S.ship.x, S.ship.y, S.ship.rot, 1);

    // Update HUD text (render side for simplicity)
    if (UI.uiScore) UI.uiScore.textContent = String(S.score);
    if (UI.uiLevel) UI.uiLevel.textContent = String(S.level);
    if (UI.uiRings) UI.uiRings.textContent = `${S.ringsCleared}/${S.ringsGoal}`;
    if (UI.uiEnemies) UI.uiEnemies.textContent = String(S.enemies.length);
    if (UI.uiKills) UI.uiKills.textContent = String(S.kills);
    if (UI.uiRes) UI.uiRes.textContent = String(S.resources);
    if (UI.uiBeam) UI.uiBeam.textContent = 'Auto';
  }
})();
