/* v2.0 config */
(function () {
  'use strict';
  const Cosmic = (window.Cosmic = window.Cosmic || {});
  Cosmic.cfg = Cosmic.cfg || {};

  const BASE = {
    VERSION: '2.0',
    BASE_SPEED: 210,

    STAR_DEEP: 140, STAR_MID: 160, STAR_NEAR: 220, BOKEH: 36,

    // Player
    SHIELD_MAX: 100, HULL_MAX: 100,
    SHIELD_REGEN_DELAY: 3000, // ms after damage
    SHIELD_REGEN_RATE_DESKTOP: 12, // per second
    SHIELD_REGEN_RATE_MOBILE: 10,

    // Damage
    DMG_BULLET: 10,
    DMG_CONTACT: 30,

    // Keystones & Healing Stones
    KEYSTONE_GOAL_BAND: [3,4,5,6,7], // increases every 3 levels, capped
    KEYSTONE_INTERVAL_DESKTOP: [8000, 12000],
    KEYSTONE_INTERVAL_MOBILE:  [9000, 13000],
    KEYSTONE_BEAM_EXTRACT_DESKTOP: 700, // ms hold-to-extract
    KEYSTONE_BEAM_EXTRACT_MOBILE:  900,
    HEAL_SPAWN_CHANCE: 0.02,      // baseline; increases when low HP
    HEAL_SMALL: { hull: 12, shield: 10 },
    HEAL_LARGE: { hull: 25, shield: 20 },

    // Resources (non-critical pickups)
    RES_SPAWN_CHANCE: 0.035,

    // Enemies
    ENEMY_WAVE_CHANCE: 0.1,
    ENEMY_WAVE_SIZE: [2,3],
    ENEMY_HP: 3,
    FIRE_COOLDOWN: 220,

    // Wingmen
    WING_OFFSET: 46,
    WING_COOLDOWN: 1000,

    // Harvester beam
    BEAM_LEN: 230,
    BEAM_HALF_W: 88,

    // Autopilot lanes
    LANES_X: [0.25, 0.5, 0.75], // as fraction of width

    // Visual perf
    DPR_MIN: 0.9,
    DPR_MAX: 1.25,
    BOKEH_OFF_IN_PERF: true
  };

  // Modes overlay
  const MODES = {
    A: { name:'A • Arcade', ENEMY_WAVE_CHANCE:0.14, ENEMY_WAVE_SIZE:[3,4], RES_SPAWN_CHANCE:0.04 },
    B: { name:'B • Balanced' },
    C: { name:'C • Chill', ENEMY_WAVE_CHANCE:0.06, ENEMY_WAVE_SIZE:[1,2], RES_SPAWN_CHANCE:0.02, BOKEH:28 },
    D: { name:'D • Performance', ENEMY_WAVE_CHANCE:0.08, ENEMY_WAVE_SIZE:[2,3], STAR_DEEP:120, STAR_MID:130, STAR_NEAR:160, BOKEH:0 }
  };

  Cosmic.cfg.BASE = BASE;
  Cosmic.cfg.MODES = MODES;
})();
