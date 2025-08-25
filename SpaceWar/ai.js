/* global window, document */
(function () {
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  const S = Cosmic.state;

  // UI mirrors (non-interactive)
  const UI = {
    pad: document.getElementById('pad'),
    stick: document.getElementById('stick'),
    wingLBtn: document.getElementById('wingLBtn'),
    wingRBtn: document.getElementById('wingRBtn'),
    harvBtn: document.getElementById('harvBtn'),
    beamBtn: document.getElementById('beamBtn'),
    warpBtn: document.getElementById('warpBtn'),
    paddlebar: document.getElementById('paddlebar')
  };
  if (UI.paddlebar) UI.paddlebar.classList.add('disabled'); // simulate-only

  function cap(s){ return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }

  // Pre-update director
  Cosmic.hooks.preUpdate.push(function director(state, t, dt) {
    // Wingmen: decide by enemies above engage band, split left/right
    let leftAhead=false,rightAhead=false;
    for (let i=0;i<state.enemies.length;i++){
      const e=state.enemies[i];
      if (e.y < state.engageBandY) { if (e.x < state.ship.x) leftAhead=true; else rightAhead=true; }
    }
    state.wingCtl.L = leftAhead ? 'deploy' : 'recall';
    state.wingCtl.R = rightAhead ? 'deploy' : 'recall';

    // Harvester when shard ahead
    let anyShardAhead=false;
    for (let i=0;i<state.shards.length;i++){ if (state.shards[i].y < state.ship.y - 10) { anyShardAhead=true; break; } }
    state.harvCtl = anyShardAhead ? 'deploy' : 'recall';

    // Beam visuals pulse; occasional warp blip
    state.beamActiveVisual = (Math.random() < 0.04);
    if (Math.random() < 0.0012) {
      state.ship.warp = 1;
      if (UI.warpBtn) { UI.warpBtn.classList.add('hot'); setTimeout(()=>UI.warpBtn && UI.warpBtn.classList.remove('hot'), 260); }
    }

    // Simulated joystick: aim to current objective
    const hasObj = state.objective && state.objective.ref && (state.objective.type==='ring' ? state.rings.includes(state.objective.ref) : state.shards.includes(state.objective.ref));
    const desiredX = hasObj ? state.objective.ref.x : state.W*0.5;
    const desiredY = hasObj ? (state.objective.type==='ring' ? Math.max(state.H*0.35, Math.min(state.H*0.85, state.objective.ref.y+40)) : Math.max(state.H*0.35, Math.min(state.H*0.85, state.objective.ref.y+20))) : state.H*0.7;
    const nx = Math.max(-1, Math.min(1, (desiredX - state.ship.x)/state.W*3));
    const ny = Math.max(-1, Math.min(1, (desiredY - state.ship.y)/state.H*3));
    if (Cosmic.render && Cosmic.render.makeStickVisual) Cosmic.render.makeStickVisual(nx, ny);

    // Mirror control states (visual only)
    if (UI.wingLBtn) { UI.wingLBtn.textContent = `⟵ Wing L: ${cap(state.wingCtl.L)}`; UI.wingLBtn.classList.toggle('hot', state.wingCtl.L!=='auto'); }
    if (UI.wingRBtn) { UI.wingRBtn.textContent = `Wing R: ${cap(state.wingCtl.R)} ⟶`; UI.wingRBtn.classList.toggle('hot', state.wingCtl.R!=='auto'); }
    if (UI.harvBtn)  { UI.harvBtn.textContent  = `🚜 Harvester: ${cap(state.harvCtl)}`; UI.harvBtn.classList.toggle('hot', state.harvCtl!=='auto'); }
    if (UI.beamBtn)  { UI.beamBtn.textContent  = '🧲 Beam: Auto'; UI.beamBtn.classList.add('hot'); }
  });

  // Post-update: damp beam flicker
  Cosmic.hooks.postUpdate.push(function post(_, t, dt) {
    if (Math.random() < 0.6) S.beamActiveVisual = false;
  });
})();
