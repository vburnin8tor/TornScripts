// ==UserScript==
// @name         Lio Procedural Music Synth v3 — Torn PDA
// @namespace    qian751.torn.procedural.music.v3
// @version      3.0.0
// @description  Procedural music generator for Torn PDA. Song mode, themes, miniplayer, visualizer, custom genres, color picker. No URLs, all live.
// @author       Qian751 (v3 rewrite)
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-end
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/584693/Procedural%20Music%20Synth%20Panel%20for%20Torn%20PDA.user.js
// @updateURL https://update.greasyfork.org/scripts/584693/Procedural%20Music%20Synth%20Panel%20for%20Torn%20PDA.meta.js
// ==/UserScript==

/*
 *  Lio Proc Synth v3
 *  -----------------
 *  v1 had charm but no features.
 *  v2 had features but no charm.
 *  v3 is me trying to get both.
 *
 *  New in v3:
 *    - Song mode: knobs drift on their own over time (like mynoise.net)
 *    - Themes: matrix, oldschool, torn, ocean, lava, custom color picker
 *    - Miniplayer: collapsed strip still shows viz + controls
 *    - Better visualizer: bars, waveform, circular, or off
 *    - 16 built-in genres (up from 12)
 *    - Sleep timer with fade-out
 *    - "Jam" button: nudges one random parameter for happy accidents
 *    - Export/import custom genres as JSON
 *    - Comments that sound like a person wrote them at 2am
 */

(function () {
  'use strict';

  const PANEL_ID = 'lio-proc-music-v3';
  const STYLE_ID = 'lio-proc-music-v3-style';
  const STORE_KEY = 'lioProceduralMusicV3';

  if (window.__lioProceduralMusicV3Loaded) return;
  window.__lioProceduralMusicV3Loaded = true;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCALES — the building blocks. each is semitones from root.
  // ═══════════════════════════════════════════════════════════════════════════
  const scales = {
    minor:      [0, 2, 3, 5, 7, 8, 10, 12],
    major:      [0, 2, 4, 5, 7, 9, 11, 12],
    dark:       [0, 1, 3, 5, 7, 8, 10, 12],
    pentatonic: [0, 3, 5, 7, 10, 12, 15, 17],
    dorian:     [0, 2, 3, 5, 7, 9, 10, 12],
    phrygian:   [0, 1, 3, 5, 7, 8, 10, 12],
    lydian:     [0, 2, 4, 6, 7, 9, 11, 12],
    mixolydian: [0, 2, 4, 5, 7, 9, 10, 12],
    blues:      [0, 3, 5, 6, 7, 10, 12, 15],
    wholetone:  [0, 2, 4, 6, 8, 10, 12, 14],
    chromatic:  [0, 1, 2, 3, 4, 5, 6, 7],
    japanese:   [0, 1, 5, 7, 8, 12, 13, 17],
    arabic:     [0, 1, 4, 5, 7, 8, 11, 12],
    flamenco:   [0, 1, 4, 5, 7, 8, 11, 12],
    hungarian:  [0, 2, 3, 6, 7, 8, 11, 12],
    enigmatic:  [0, 1, 4, 6, 8, 10, 11, 12],
  };

  const scaleNames = {
    minor: 'Minor', major: 'Major', dark: 'Dark', pentatonic: 'Pentatonic',
    dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian',
    blues: 'Blues', wholetone: 'Whole Tone', chromatic: 'Chromatic', japanese: 'Japanese',
    arabic: 'Arabic', flamenco: 'Flamenco', hungarian: 'Hungarian', enigmatic: 'Enigmatic',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DRUM PATTERNS — 16 steps each. 1 = hit, 0 = rest.
  // ═══════════════════════════════════════════════════════════════════════════
  const drumPatterns = {
    standard: { kick:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], ohat:[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0] },
    lofi:      { kick:[1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0], hat:[1,0,1,1,0,1,1,0,1,1,0,1,0,1,0,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0] },
    trap:      { kick:[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], ohat:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] },
    jazz:      { kick:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], snare:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], hat:[1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0], ohat:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
    disco:     { kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], hat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], ohat:[0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1] },
    rock:      { kick:[1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0], hat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], ohat:[0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0] },
    metal:     { kick:[1,0,1,1,0,0,1,0,1,1,0,0,1,0,1,0], snare:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1], hat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    half:      { kick:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hat:[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    sparse:    { kick:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hat:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    breakbeat: { kick:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1], hat:[1,0,1,0,1,1,0,1,0,1,0,1,1,0,1,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1] },
    reggaeton: { kick:[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat:[1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1], ohat:[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0] },
    none:      { kick:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], hat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CHORD VOICINGS — which scale degrees to stack
  // ═══════════════════════════════════════════════════════════════════════════
  const chordVoicings = {
    triad:   [0, 2, 4],
    seventh: [0, 2, 4, 6],
    sus2:    [0, 1, 4],
    sus4:    [0, 3, 4],
    power:   [0, 4],
    shell:   [0, 2, 6],
    ninth:   [0, 2, 4, 6, 8],
    add9:    [0, 2, 4, 8],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // THEMES — color schemes. the big new thing in v3.
  // each theme defines: bg, panel bg, border, text, accent, accent2, viz gradient
  // ═══════════════════════════════════════════════════════════════════════════
  const themes = {
    matrix: {
      name: 'Matrix',
      bg: '#020204',
      panelBg: 'rgba(2, 4, 2, 0.94)',
      border: 'rgba(34, 180, 85, 0.3)',
      text: '#c0e8c8',
      dim: '#4a7a55',
      accent: '#22b455',
      accent2: '#80ce87',
      vizHi: '#92e5a1',
      vizLo: '#204829',
      handleBg: 'linear-gradient(180deg, #0a1a0e, #050d07)',
      font: '"Courier New", Courier, monospace',
    },
    oldschool: {
      name: 'Old School',
      bg: '#1a1410',
      panelBg: 'rgba(26, 20, 16, 0.95)',
      border: 'rgba(200, 160, 80, 0.3)',
      text: '#e8d8b8',
      dim: '#8a7a5a',
      accent: '#d4a040',
      accent2: '#e8c878',
      vizHi: '#f0d890',
      vizLo: '#8a6020',
      handleBg: 'linear-gradient(180deg, #2a2018, #1a1410)',
      font: '"VT323", "Courier New", monospace',
    },
    torn: {
      name: 'Torn City',
      bg: '#0a0a0e',
      panelBg: 'rgba(10, 10, 16, 0.95)',
      border: 'rgba(180, 60, 60, 0.3)',
      text: '#e0d8d8',
      dim: '#7a6a6a',
      accent: '#cc3030',
      accent2: '#ff6868',
      vizHi: '#ff8080',
      vizLo: '#602020',
      handleBg: 'linear-gradient(180deg, #1a0a0a, #0e0505)',
      font: '"Segoe UI", system-ui, sans-serif',
    },
    ocean: {
      name: 'Deep Ocean',
      bg: '#040810',
      panelBg: 'rgba(4, 10, 20, 0.95)',
      border: 'rgba(40, 140, 220, 0.3)',
      text: '#b0d0e8',
      dim: '#50708a',
      accent: '#288cdc',
      accent2: '#60b0e8',
      vizHi: '#80d0f8',
      vizLo: '#184868',
      handleBg: 'linear-gradient(180deg, #081828, #040c18)',
      font: '"Segoe UI", system-ui, sans-serif',
    },
    lava: {
      name: 'Lava Lamp',
      bg: '#140404',
      panelBg: 'rgba(20, 6, 4, 0.95)',
      border: 'rgba(255, 100, 20, 0.35)',
      text: '#f0d0b0',
      dim: '#8a5a3a',
      accent: '#ff6820',
      accent2: '#ffa040',
      vizHi: '#ffc060',
      vizLo: '#802010',
      handleBg: 'linear-gradient(180deg, #280a04, #140402)',
      font: '"Segoe UI", system-ui, sans-serif',
    },
    ghost: {
      name: 'Ghost',
      bg: '#08080c',
      panelBg: 'rgba(12, 12, 18, 0.93)',
      border: 'rgba(140, 140, 180, 0.25)',
      text: '#c8c8d8',
      dim: '#6a6a80',
      accent: '#8080c0',
      accent2: '#a0a0e0',
      vizHi: '#c0c0f0',
      vizLo: '#404060',
      handleBg: 'linear-gradient(180deg, #14141e, #08080c)',
      font: '"Segoe UI", system-ui, sans-serif',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILT-IN GENRES — 16 of them. each is a full sound profile.
  // ═══════════════════════════════════════════════════════════════════════════
  const builtinGenres = {
    neonwar: {
      name: 'Neon War Chain', genre: 'cyberpunk',
      root: 45, scale: 'minor', wave: 'sawtooth', bassWave: 'square',
      bpm: 124, swing: 0.04, chords: [0, 5, 3, 6],
      reverbWet: 0.18, filterCutoff: 0.5, arpMode: false, chordMode: true,
      drumPattern: 'standard', bassIntensity: 0.7, melodyDensity: 0.5,
    },
    island: {
      name: 'Private Island Chill', genre: 'lofi',
      root: 48, scale: 'major', wave: 'triangle', bassWave: 'sine',
      bpm: 88, swing: 0.08, chords: [0, 4, 5, 3],
      reverbWet: 0.3, filterCutoff: 0.65, arpMode: false, chordMode: false,
      drumPattern: 'half', bassIntensity: 0.5, melodyDensity: 0.4,
    },
    bazaar: {
      name: 'Bazaar Panic', genre: 'electronic',
      root: 42, scale: 'dark', wave: 'square', bassWave: 'sawtooth',
      bpm: 138, swing: 0.02, chords: [0, 2, 5, 1],
      reverbWet: 0.1, filterCutoff: 0.55, arpMode: true, chordMode: false,
      drumPattern: 'standard', bassIntensity: 0.8, melodyDensity: 0.6,
    },
    stealth: {
      name: 'Stealth Hospital Run', genre: 'ambient',
      root: 43, scale: 'dark', wave: 'sine', bassWave: 'triangle',
      bpm: 104, swing: 0.12, chords: [0, 1, 3, 2],
      reverbWet: 0.45, filterCutoff: 0.35, arpMode: false, chordMode: false,
      drumPattern: 'sparse', bassIntensity: 0.4, melodyDensity: 0.25,
    },
    lofi_beats: {
      name: 'Lo-Fi Study Hall', genre: 'lofi',
      root: 50, scale: 'dorian', wave: 'triangle', bassWave: 'sine',
      bpm: 75, swing: 0.14, chords: [0, 3, 4, 5],
      reverbWet: 0.38, filterCutoff: 0.45, arpMode: false, chordMode: true,
      drumPattern: 'lofi', bassIntensity: 0.45, melodyDensity: 0.3,
    },
    synthwave: {
      name: 'Retrowave Highway', genre: 'synthwave',
      root: 45, scale: 'minor', wave: 'sawtooth', bassWave: 'sawtooth',
      bpm: 116, swing: 0.0, chords: [0, 5, 3, 7],
      reverbWet: 0.25, filterCutoff: 0.7, arpMode: true, chordMode: true,
      drumPattern: 'disco', bassIntensity: 0.75, melodyDensity: 0.55,
    },
    jazz_club: {
      name: 'Back Alley Jazz', genre: 'jazz',
      root: 53, scale: 'dorian', wave: 'sine', bassWave: 'triangle',
      bpm: 95, swing: 0.2, chords: [0, 2, 4, 1],
      reverbWet: 0.35, filterCutoff: 0.55, arpMode: false, chordMode: true,
      drumPattern: 'jazz', bassIntensity: 0.55, melodyDensity: 0.65,
    },
    trap_drop: {
      name: 'Faction Trap Drop', genre: 'trap',
      root: 41, scale: 'minor', wave: 'sawtooth', bassWave: 'sine',
      bpm: 140, swing: 0.0, chords: [0, 0, 5, 3],
      reverbWet: 0.15, filterCutoff: 0.6, arpMode: false, chordMode: false,
      drumPattern: 'trap', bassIntensity: 0.9, melodyDensity: 0.2,
    },
    offshore: {
      name: 'Offshore Drone', genre: 'ambient',
      root: 48, scale: 'lydian', wave: 'sine', bassWave: 'sine',
      bpm: 60, swing: 0.0, chords: [0, 4, 2, 6],
      reverbWet: 0.65, filterCutoff: 0.3, arpMode: false, chordMode: true,
      drumPattern: 'none', bassIntensity: 0.25, melodyDensity: 0.2,
    },
    torn_blues: {
      name: 'Torn Street Blues', genre: 'blues',
      root: 45, scale: 'blues', wave: 'sawtooth', bassWave: 'square',
      bpm: 100, swing: 0.1, chords: [0, 3, 0, 4],
      reverbWet: 0.2, filterCutoff: 0.65, arpMode: false, chordMode: false,
      drumPattern: 'rock', bassIntensity: 0.7, melodyDensity: 0.6,
    },
    city_pop: {
      name: 'City Pop Nights', genre: 'citypop',
      root: 52, scale: 'japanese', wave: 'triangle', bassWave: 'sine',
      bpm: 102, swing: 0.06, chords: [0, 4, 2, 5],
      reverbWet: 0.3, filterCutoff: 0.6, arpMode: true, chordMode: false,
      drumPattern: 'standard', bassIntensity: 0.55, melodyDensity: 0.5,
    },
    dungeon: {
      name: 'Dungeon Raid', genre: 'metal',
      root: 40, scale: 'phrygian', wave: 'square', bassWave: 'sawtooth',
      bpm: 150, swing: 0.0, chords: [0, 1, 3, 0],
      reverbWet: 0.12, filterCutoff: 0.8, arpMode: true, chordMode: false,
      drumPattern: 'metal', bassIntensity: 0.85, melodyDensity: 0.45,
    },
    flamenco_nights: {
      name: 'Flamenco Nights', genre: 'world',
      root: 45, scale: 'flamenco', wave: 'triangle', bassWave: 'sine',
      bpm: 110, swing: 0.05, chords: [0, 3, 5, 3],
      reverbWet: 0.28, filterCutoff: 0.55, arpMode: true, chordMode: false,
      drumPattern: 'half', bassIntensity: 0.6, melodyDensity: 0.7,
    },
    arabic_souk: {
      name: 'Arabic Souk', genre: 'world',
      root: 43, scale: 'arabic', wave: 'triangle', bassWave: 'sine',
      bpm: 92, swing: 0.08, chords: [0, 1, 4, 3],
      reverbWet: 0.32, filterCutoff: 0.45, arpMode: true, chordMode: false,
      drumPattern: 'sparse', bassIntensity: 0.5, melodyDensity: 0.65,
    },
    enigmatic_dream: {
      name: 'Enigmatic Dream', genre: 'experimental',
      root: 48, scale: 'enigmatic', wave: 'sine', bassWave: 'triangle',
      bpm: 70, swing: 0.15, chords: [0, 4, 2, 6],
      reverbWet: 0.5, filterCutoff: 0.4, arpMode: false, chordMode: true,
      drumPattern: 'none', bassIntensity: 0.35, melodyDensity: 0.35,
    },
    reggaeton_heist: {
      name: 'Reggaeton Heist', genre: 'latin',
      root: 41, scale: 'minor', wave: 'sawtooth', bassWave: 'sine',
      bpm: 96, swing: 0.03, chords: [0, 5, 3, 5],
      reverbWet: 0.15, filterCutoff: 0.6, arpMode: false, chordMode: false,
      drumPattern: 'reggaeton', bassIntensity: 0.8, melodyDensity: 0.35,
    },
  };

  const genreIcons = {
    cyberpunk: '🔮', lofi: '☕', electronic: '⚡', ambient: '🌊',
    synthwave: '🌆', jazz: '🎷', trap: '🔊', blues: '🎸',
    citypop: '🌸', metal: '💀', world: '🪕', experimental: '🔬',
    latin: '🔥', custom: '🎨', default: '🎵',
  };

  function genreIcon(g) { return genreIcons[g] || genreIcons.default; }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const defaultState = {
    collapsed: false, miniplayer: false, x: null, y: null,
    preset: 'neonwar', bpm: 124, energy: 0.62, volume: 0.34,
    seed: 'torn-war-777',
    drums: true, bass: true, melody: true, fx: true,
    reverb: true, reverbWet: 0.18,
    visualizer: true, vizMode: 'bars',
    arpMode: false, arpRate: 2,
    chordMode: true, chordVoicing: 'triad',
    filterCutoff: 0.5,
    eqBass: 0.5, eqLow: 0.5, eqMid: 0.5, eqHigh: 0.5, eqAir: 0.5,
    drumPattern: 'standard',
    bassIntensity: 0.7, melodyDensity: 0.5,
    activeTab: 'play',
    customGenres: {},
    // v3 additions
    theme: 'matrix',
    customColor: '#22b455',
    songMode: false, songModeSpeed: 0.5,
    sleepTimer: 0, // minutes, 0 = off
    swing: 0.04,
  };

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Object.assign({}, defaultState, stored);
    } catch { return Object.assign({}, defaultState); }
  }

  const state = loadState();

  function getAllGenres() {
    const customs = {};
    Object.entries(state.customGenres || {}).forEach(([k, v]) => {
      customs['custom_' + k] = v;
    });
    return Object.assign({}, builtinGenres, customs);
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEEDED RNG — mulberry32. deterministic from a string seed.
  // ═══════════════════════════════════════════════════════════════════════════
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS INJECTION — themed via CSS custom properties.
  // the theme object gets flattened into --vars at runtime.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ── base panel ── */
      #${PANEL_ID} {
        position: fixed;
        width: 350px;
        max-width: calc(100vw - 12px);
        z-index: 999999;
        color: var(--lio-text);
        background: var(--lio-panelBg);
        border: 1px solid var(--lio-border);
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: var(--lio-font);
        transition: transform 0.2s ease, width 0.2s ease;
      }
      #${PANEL_ID}.lio-collapsed { transform: translateX(calc(100% - 42px)); }
      #${PANEL_ID}.lio-mini { width: 240px; }
      #${PANEL_ID} * { box-sizing: border-box; }

      /* ── handle (the grab strip on the left) ── */
      #${PANEL_ID} .lio-handle {
        position: absolute; left: 0; top: 0;
        width: 42px; height: 100%;
        display: grid; place-items: center;
        background: var(--lio-handleBg);
        cursor: pointer; user-select: none;
        border-right: 1px solid var(--lio-border);
      }
      #${PANEL_ID} .lio-handle-label {
        writing-mode: vertical-rl; transform: rotate(180deg);
        font-size: 11px; font-weight: 700; letter-spacing: 2px;
        color: var(--lio-accent); opacity: 0.7;
      }

      /* ── inner content ── */
      #${PANEL_ID} .lio-inner { padding: 8px 8px 8px 50px; }

      /* ── top bar ── */
      #${PANEL_ID} .lio-topbar {
        display: flex; align-items: center; gap: 6px;
        margin-bottom: 6px; cursor: grab; user-select: none;
      }
      #${PANEL_ID} .lio-topbar-title {
        flex: 1; font-size: 14px; font-weight: 700;
        color: var(--lio-accent);
      }
      #${PANEL_ID} .lio-topbar-status {
        font-size: 10px; color: var(--lio-dim); max-width: 90px;
        text-overflow: ellipsis; overflow: hidden; white-space: nowrap;
        text-align: right;
      }

      /* ── tabs ── */
      #${PANEL_ID} .lio-tabs { display: flex; gap: 2px; margin-bottom: 6px; }
      #${PANEL_ID} .lio-tab {
        flex: 1; padding: 5px 3px; font-size: 10px; font-weight: 700;
        background: rgba(128,128,128,0.08); border: 1px solid rgba(128,128,128,0.1);
        border-radius: 6px; color: var(--lio-dim); cursor: pointer;
        text-align: center; transition: all 0.12s;
        text-transform: uppercase; letter-spacing: 0.3px;
      }
      #${PANEL_ID} .lio-tab.active { background: var(--lio-accent); color: var(--lio-bg); border-color: var(--lio-accent); }
      #${PANEL_ID} .lio-tab:hover:not(.active) { color: var(--lio-text); background: rgba(128,128,128,0.15); }

      #${PANEL_ID} .lio-pane { display: none; }
      #${PANEL_ID} .lio-pane.active { display: block; }

      /* ── visualizer canvas ── */
      #${PANEL_ID} .lio-viz-wrap {
        border-radius: 8px; overflow: hidden;
        background: var(--lio-bg); margin-bottom: 6px;
        border: 1px solid var(--lio-border);
      }
      #${PANEL_ID} canvas { display: block; width: 100%; height: 56px; }

      /* ── buttons ── */
      #${PANEL_ID} button {
        padding: 6px 7px; font-size: 11px; font-weight: 700;
        border: 1px solid rgba(128,128,128,0.15); border-radius: 7px;
        background: rgba(128,128,128,0.08); color: var(--lio-text);
        cursor: pointer; transition: all 0.12s; outline: none;
      }
      #${PANEL_ID} button:hover { background: rgba(128,128,128,0.18); }
      #${PANEL_ID} button.lio-play-btn {
        background: var(--lio-accent); color: var(--lio-bg);
        border-color: var(--lio-accent); font-size: 12px;
      }
      #${PANEL_ID} button.lio-play-btn.playing {
        background: var(--lio-accent2); animation: lio-pulse 1.5s ease-in-out infinite;
      }
      @keyframes lio-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.75; } }
      #${PANEL_ID} button.lio-danger { color: #ff6060; border-color: rgba(255,80,80,0.3); }
      #${PANEL_ID} button.lio-accent { color: var(--lio-accent); border-color: var(--lio-accent); }
      #${PANEL_ID} button.active { background: var(--lio-accent); color: var(--lio-bg); }

      /* ── selects & inputs ── */
      #${PANEL_ID} select, #${PANEL_ID} input[type="text"], #${PANEL_ID} input[type="number"] {
        width: 100%; padding: 5px 7px; font-size: 11px;
        border: 1px solid rgba(128,128,128,0.15); border-radius: 7px;
        background: rgba(128,128,128,0.06); color: var(--lio-text); outline: none;
        font-family: var(--lio-font);
      }
      #${PANEL_ID} select option { color: #111; }

      /* ── labels ── */
      #${PANEL_ID} .lio-label {
        font-size: 10px; color: var(--lio-dim); margin-bottom: 2px;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
      }
      #${PANEL_ID} .lio-labeled { display: grid; gap: 2px; }

      /* ── sliders ── */
      #${PANEL_ID} .lio-slider-row { display: grid; gap: 1px; margin-bottom: 4px; }
      #${PANEL_ID} .lio-slider-header { display: flex; justify-content: space-between; align-items: center; }
      #${PANEL_ID} .lio-slider-name { font-size: 10px; color: var(--lio-dim); font-weight: 600; text-transform: uppercase; }
      #${PANEL_ID} .lio-slider-val { font-size: 10px; color: var(--lio-accent); font-weight: 700; min-width: 28px; text-align: right; }
      #${PANEL_ID} input[type="range"] {
        width: 100%; height: 3px; margin: 0;
        -webkit-appearance: none; appearance: none;
        background: rgba(128,128,128,0.2); border-radius: 2px; outline: none;
        border: none; padding: 0; cursor: pointer;
      }
      #${PANEL_ID} input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%;
        background: var(--lio-accent); cursor: pointer;
      }

      /* ── toggle switches ── */
      #${PANEL_ID} .lio-toggle-group { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-bottom: 4px; }
      #${PANEL_ID} .lio-toggle-group.three { grid-template-columns: 1fr 1fr 1fr; }
      #${PANEL_ID} .lio-toggle-group.four { grid-template-columns: 1fr 1fr 1fr 1fr; }
      #${PANEL_ID} .lio-toggle {
        display: flex; align-items: center; gap: 4px;
        padding: 3px 5px; border-radius: 6px;
        border: 1px solid rgba(128,128,128,0.1);
        background: rgba(128,128,128,0.05); cursor: pointer;
      }
      #${PANEL_ID} .lio-toggle input { display: none; }
      #${PANEL_ID} .lio-toggle-dot {
        width: 18px; height: 10px; border-radius: 5px;
        background: rgba(128,128,128,0.2); position: relative;
        transition: background 0.15s; flex-shrink: 0;
      }
      #${PANEL_ID} .lio-toggle-dot::after {
        content: ''; position: absolute; width: 7px; height: 7px;
        border-radius: 50%; background: #fff;
        top: 1.5px; left: 1.5px; transition: transform 0.15s;
      }
      #${PANEL_ID} .lio-toggle.on .lio-toggle-dot { background: var(--lio-accent); }
      #${PANEL_ID} .lio-toggle.on .lio-toggle-dot::after { transform: translateX(8px); }
      #${PANEL_ID} .lio-toggle-label { font-size: 10px; font-weight: 700; color: var(--lio-dim); }
      #${PANEL_ID} .lio-toggle.on .lio-toggle-label { color: var(--lio-accent); }

      /* ── sequencer ── */
      #${PANEL_ID} .lio-seq { margin-bottom: 4px; }
      #${PANEL_ID} .lio-seq-row { display: flex; gap: 2px; margin-bottom: 2px; align-items: center; }
      #${PANEL_ID} .lio-seq-name { font-size: 9px; color: var(--lio-dim); font-weight: 700; width: 26px; flex-shrink: 0; }
      #${PANEL_ID} .lio-seq-cell {
        flex: 1; height: 12px; border-radius: 2px;
        background: rgba(128,128,128,0.1); cursor: pointer;
        border: 1px solid rgba(128,128,128,0.06); transition: background 0.08s;
      }
      #${PANEL_ID} .lio-seq-cell.on { background: var(--lio-accent); }
      #${PANEL_ID} .lio-seq-cell.active-step { box-shadow: 0 0 0 1px var(--lio-text); }

      /* ── status bar ── */
      #${PANEL_ID} .lio-status-bar {
        margin-top: 5px; padding: 3px 6px;
        background: rgba(128,128,128,0.05); border-radius: 5px;
        font-size: 10px; color: var(--lio-dim); min-height: 20px;
        border: 1px solid rgba(128,128,128,0.08);
        display: flex; align-items: center; gap: 4px;
      }
      #${PANEL_ID} .lio-status-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--lio-dim); flex-shrink: 0; transition: background 0.3s;
      }
      #${PANEL_ID} .lio-status-dot.playing { background: var(--lio-accent); box-shadow: 0 0 4px var(--lio-accent); }

      /* ── scrollable panes ── */
      #${PANEL_ID} .lio-scroll { max-height: 280px; overflow-y: auto; padding-right: 2px; }
      #${PANEL_ID} .lio-scroll::-webkit-scrollbar { width: 3px; }
      #${PANEL_ID} .lio-scroll::-webkit-scrollbar-thumb { background: var(--lio-accent); border-radius: 2px; opacity: 0.4; }

      /* ── preset cards ── */
      #${PANEL_ID} .lio-preset-card {
        display: flex; align-items: center; gap: 5px;
        padding: 5px 7px; border-radius: 7px; margin-bottom: 3px;
        background: rgba(128,128,128,0.05); border: 1px solid rgba(128,128,128,0.1);
        cursor: pointer; transition: all 0.12s;
      }
      #${PANEL_ID} .lio-preset-card:hover { background: rgba(128,128,128,0.12); }
      #${PANEL_ID} .lio-preset-card.active { border-color: var(--lio-accent); background: rgba(128,128,128,0.1); }
      #${PANEL_ID} .lio-preset-card-icon { font-size: 14px; flex-shrink: 0; }
      #${PANEL_ID} .lio-preset-card-info { flex: 1; min-width: 0; }
      #${PANEL_ID} .lio-preset-card-name { font-size: 11px; font-weight: 700; color: var(--lio-text); }
      #${PANEL_ID} .lio-preset-card-meta { font-size: 9px; color: var(--lio-dim); }
      #${PANEL_ID} .lio-preset-card-bpm { font-size: 10px; color: var(--lio-accent); font-weight: 700; }
      #${PANEL_ID} .lio-preset-badge {
        font-size: 9px; padding: 2px 5px; border-radius: 3px;
        background: rgba(128,128,128,0.1); color: var(--lio-dim);
        text-transform: uppercase; font-weight: 700; letter-spacing: 0.3px;
      }

      /* ── miniplayer ── */
      #${PANEL_ID} .lio-mini-content { display: none; }
      #${PANEL_ID}.lio-mini .lio-mini-content { display: block; }
      #${PANEL_ID}.lio-mini .lio-full-content { display: none; }
      #${PANEL_ID} .lio-mini-viz { border-radius: 6px; overflow: hidden; background: var(--lio-bg); margin-bottom: 4px; border: 1px solid var(--lio-border); }
      #${PANEL_ID} .lio-mini-viz canvas { display: block; width: 100%; height: 32px; }

      /* ── color picker row ── */
      #${PANEL_ID} .lio-color-row { display: flex; gap: 3px; align-items: center; margin-bottom: 4px; }
      #${PANEL_ID} .lio-color-swatch {
        width: 16px; height: 16px; border-radius: 4px; cursor: pointer;
        border: 2px solid rgba(128,128,128,0.2); transition: border-color 0.12s;
      }
      #${PANEL_ID} .lio-color-swatch:hover { border-color: var(--lio-text); }
      #${PANEL_ID} .lio-color-swatch.active { border-color: var(--lio-accent); }
      #${PANEL_ID} input[type="color"] { width: 24px; height: 18px; border: none; background: none; cursor: pointer; padding: 0; }

      /* ── grid helpers ── */
      #${PANEL_ID} .lio-row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px; }
      #${PANEL_ID} .lio-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 4px; }
      #${PANEL_ID} .lio-sep { height: 1px; background: rgba(128,128,128,0.1); margin: 5px 0; }
    `;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APPLY THEME — flatten theme object into CSS vars on the panel element
  // ═══════════════════════════════════════════════════════════════════════════
  function applyThemeToPanel(panel) {
    const theme = themes[state.theme] || themes.matrix;
    const accent = state.theme === 'custom' ? state.customColor : theme.accent;
    const accent2 = state.theme === 'custom' ? state.customColor : theme.accent2;

    panel.style.setProperty('--lio-bg', theme.bg);
    panel.style.setProperty('--lio-panelBg', theme.panelBg);
    panel.style.setProperty('--lio-border', theme.border);
    panel.style.setProperty('--lio-text', theme.text);
    panel.style.setProperty('--lio-dim', theme.dim);
    panel.style.setProperty('--lio-accent', accent);
    panel.style.setProperty('--lio-accent2', accent2);
    panel.style.setProperty('--lio-vizHi', theme.vizHi);
    panel.style.setProperty('--lio-vizLo', theme.vizLo);
    panel.style.setProperty('--lio-handleBg', theme.handleBg);
    panel.style.setProperty('--lio-font', theme.font);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READY CHECK — wait for body before building UI
  // ═══════════════════════════════════════════════════════════════════════════
  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function init() {
    if (document.getElementById(PANEL_ID)) return;
    injectCss();

    // ── build the panel DOM ──
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    if (state.collapsed) panel.classList.add('lio-collapsed');
    if (state.miniplayer) panel.classList.add('lio-mini');
    applyThemeToPanel(panel);

    panel.innerHTML = `
      <div class="lio-handle"><span class="lio-handle-label">LIO SYNTH</span></div>
      <div class="lio-inner">

        <!-- ── FULL CONTENT (hidden in mini mode) ── -->
        <div class="lio-full-content">
          <div class="lio-topbar" id="lioDragBar">
            <div class="lio-topbar-title">Lio Synth v3</div>
            <div class="lio-topbar-status" id="lioTopStatus">ready</div>
            <button id="lioMiniBtn" style="padding:2px 6px;font-size:9px;min-width:24px" title="Miniplayer">▢</button>
            <button id="lioCollapseBtn" style="padding:2px 6px;font-size:9px;min-width:24px" title="Collapse">⇄</button>
          </div>

          <div class="lio-tabs" id="lioTabs">
            <div class="lio-tab active" data-tab="play">Play</div>
            <div class="lio-tab" data-tab="sound">Sound</div>
            <div class="lio-tab" data-tab="seq">Seq</div>
            <div class="lio-tab" data-tab="genres">Genres</div>
            <div class="lio-tab" data-tab="build">Build</div>
            <div class="lio-tab" data-tab="theme">Look</div>
          </div>

          <!-- ═══ PLAY TAB ═══ -->
          <div class="lio-pane active" id="lioPane-play">
            <div class="lio-viz-wrap"><canvas id="lioCanvas" height="56"></canvas></div>
            <div class="lio-row" style="margin-bottom:5px">
              <button id="lioPlayBtn" class="lio-play-btn">▶ START</button>
              <button id="lioPanicBtn" class="lio-danger">⛔ PANIC</button>
            </div>
            <div class="lio-labeled" style="margin-bottom:4px">
              <div class="lio-label">Genre</div>
              <select id="lioPresetSel"></select>
            </div>
            <div class="lio-slider-row">
              <div class="lio-slider-header"><span class="lio-slider-name">BPM</span><span class="lio-slider-val" id="lioBpmVal">124</span></div>
              <input type="range" id="lioBpm" min="40" max="200" step="1">
            </div>
            <div class="lio-slider-row">
              <div class="lio-slider-header"><span class="lio-slider-name">Energy</span><span class="lio-slider-val" id="lioEnergyVal">62%</span></div>
              <input type="range" id="lioEnergy" min="0" max="1" step="0.01">
            </div>
            <div class="lio-slider-row">
              <div class="lio-slider-header"><span class="lio-slider-name">Volume</span><span class="lio-slider-val" id="lioVolVal">34%</span></div>
              <input type="range" id="lioVolume" min="0" max="1" step="0.01">
            </div>
            <div class="lio-sep"></div>
            <div class="lio-labeled" style="margin-bottom:4px">
              <div class="lio-label">Seed (controls the pattern)</div>
              <input type="text" id="lioSeed" placeholder="e.g. torn-war-777">
            </div>
            <div class="lio-row">
              <button id="lioNewSeedBtn">🎲 New Seed</button>
              <button id="lioRandomizeBtn" class="lio-accent">✨ Randomize</button>
            </div>
            <div class="lio-row" style="margin-top:4px">
              <button id="lioJamBtn">🎱 Jam</button>
              <button id="lioSleepBtn" class="lio-accent">💤 Sleep</button>
            </div>
            <div class="lio-status-bar">
              <div class="lio-status-dot" id="lioStatusDot"></div>
              <span id="lioStatus">tap START to play</span>
            </div>
          </div>

          <!-- ═══ SOUND TAB ═══ -->
          <div class="lio-pane" id="lioPane-sound">
            <div class="lio-scroll">
              <div class="lio-label" style="margin-bottom:3px">Layers</div>
              <div class="lio-toggle-group four" id="lioLayerToggles">
                <label class="lio-toggle" id="ltDrums"><input type="checkbox" id="lioDrums"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Drums</span></label>
                <label class="lio-toggle" id="ltBass"><input type="checkbox" id="lioBass"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Bass</span></label>
                <label class="lio-toggle" id="ltMelody"><input type="checkbox" id="lioMelody"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Lead</span></label>
                <label class="lio-toggle" id="ltFx"><input type="checkbox" id="lioFx"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">FX</span></label>
              </div>
              <div class="lio-sep"></div>
              <div class="lio-slider-row">
                <div class="lio-slider-header"><span class="lio-slider-name">Bass Intensity</span><span class="lio-slider-val" id="lioBassIntVal">70%</span></div>
                <input type="range" id="lioBassInt" min="0" max="1" step="0.01">
              </div>
              <div class="lio-slider-row">
                <div class="lio-slider-header"><span class="lio-slider-name">Melody Density</span><span class="lio-slider-val" id="lioMelDensVal">50%</span></div>
                <input type="range" id="lioMelDens" min="0" max="1" step="0.01">
              </div>
              <div class="lio-slider-row">
                <div class="lio-slider-header"><span class="lio-slider-name">Filter Cutoff</span><span class="lio-slider-val" id="lioFilterVal">50%</span></div>
                <input type="range" id="lioFilter" min="0" max="1" step="0.01">
              </div>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">EQ</div>
              <div class="lio-eq" style="display:flex;gap:4px;align-items:flex-end;height:40px;margin-bottom:5px">
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;height:100%">
                  <input type="range" id="lioEqBass" min="0" max="1" step="0.01" style="writing-mode:vertical-lr;direction:rtl;width:3px;flex:1">
                  <span style="font-size:7px;color:var(--lio-dim)">B</span>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;height:100%">
                  <input type="range" id="lioEqLow" min="0" max="1" step="0.01" style="writing-mode:vertical-lr;direction:rtl;width:3px;flex:1">
                  <span style="font-size:7px;color:var(--lio-dim)">L</span>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;height:100%">
                  <input type="range" id="lioEqMid" min="0" max="1" step="0.01" style="writing-mode:vertical-lr;direction:rtl;width:3px;flex:1">
                  <span style="font-size:7px;color:var(--lio-dim)">M</span>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;height:100%">
                  <input type="range" id="lioEqHigh" min="0" max="1" step="0.01" style="writing-mode:vertical-lr;direction:rtl;width:3px;flex:1">
                  <span style="font-size:7px;color:var(--lio-dim)">H</span>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;height:100%">
                  <input type="range" id="lioEqAir" min="0" max="1" step="0.01" style="writing-mode:vertical-lr;direction:rtl;width:3px;flex:1">
                  <span style="font-size:7px;color:var(--lio-dim)">A</span>
                </div>
              </div>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">FX Chain</div>
              <div class="lio-toggle-group">
                <label class="lio-toggle" id="ltReverb"><input type="checkbox" id="lioReverb"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Reverb</span></label>
                <label class="lio-toggle" id="ltViz"><input type="checkbox" id="lioViz"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Visualizer</span></label>
              </div>
              <div class="lio-slider-row" style="margin-top:4px">
                <div class="lio-slider-header"><span class="lio-slider-name">Reverb Wet</span><span class="lio-slider-val" id="lioRevVal">18%</span></div>
                <input type="range" id="lioRevWet" min="0" max="1" step="0.01">
              </div>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">Arp / Chords</div>
              <div class="lio-toggle-group">
                <label class="lio-toggle" id="ltArp"><input type="checkbox" id="lioArp"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Arp</span></label>
                <label class="lio-toggle" id="ltChord"><input type="checkbox" id="lioChord"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Chord</span></label>
              </div>
              <div class="lio-row" style="margin-top:4px">
                <div class="lio-labeled">
                  <div class="lio-label">Arp Rate</div>
                  <select id="lioArpRate"><option value="1">1/16</option><option value="2">1/8</option><option value="4">1/4</option><option value="0.5">1/32</option></select>
                </div>
                <div class="lio-labeled">
                  <div class="lio-label">Voicing</div>
                  <select id="lioVoicing"></select>
                </div>
              </div>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">Song Mode</div>
              <div class="lio-toggle-group">
                <label class="lio-toggle" id="ltSong"><input type="checkbox" id="lioSongMode"><div class="lio-toggle-dot"></div><span class="lio-toggle-label">Song Mode</span></label>
                <div class="lio-labeled"><div class="lio-label">Drift Speed</div>
                  <select id="lioSongSpeed"><option value="0.2">Slow</option><option value="0.5">Med</option><option value="1">Fast</option></select>
                </div>
              </div>
              <div style="font-size:7px;color:var(--lio-dim);margin-top:3px">knobs drift on their own over time</div>
            </div>
          </div>

          <!-- ═══ SEQUENCER TAB ═══ -->
          <div class="lio-pane" id="lioPane-seq">
            <div class="lio-label" style="margin-bottom:3px">Drum Pattern</div>
            <select id="lioPatternSel" style="margin-bottom:5px;width:100%"></select>
            <div class="lio-seq" id="lioSeqEdit">
              <div class="lio-seq-row" id="lioSeqKick"><span class="lio-seq-name">Kick</span></div>
              <div class="lio-seq-row" id="lioSeqSnare"><span class="lio-seq-name">Snare</span></div>
              <div class="lio-seq-row" id="lioSeqHat"><span class="lio-seq-name">Hat</span></div>
              <div class="lio-seq-row" id="lioSeqOhat"><span class="lio-seq-name">OHat</span></div>
            </div>
            <div class="lio-row">
              <button id="lioSeqSaveBtn" class="lio-accent">💾 Save</button>
              <button id="lioSeqRandBtn">🎲 Random</button>
            </div>
            <div class="lio-slider-row" style="margin-top:6px">
              <div class="lio-slider-header"><span class="lio-slider-name">Swing</span><span class="lio-slider-val" id="lioSwingVal">4%</span></div>
              <input type="range" id="lioSwing" min="0" max="0.4" step="0.01">
            </div>
          </div>

          <!-- ═══ GENRES TAB ═══ -->
          <div class="lio-pane" id="lioPane-genres">
            <div class="lio-scroll" id="lioPresetCards"></div>
          </div>

          <!-- ═══ BUILD TAB ═══ -->
          <div class="lio-pane" id="lioPane-build">
            <div class="lio-scroll">
              <div style="font-size:8px;color:var(--lio-dim);margin-bottom:5px">Create your own genre. Save it, use it, delete it.</div>
              <div class="lio-labeled" style="margin-bottom:4px"><div class="lio-label">Name</div><input type="text" id="cbName" placeholder="My Genre"></div>
              <div class="lio-row">
                <div class="lio-labeled"><div class="lio-label">Root</div><select id="cbRoot"></select></div>
                <div class="lio-labeled"><div class="lio-label">Scale</div><select id="cbScale"></select></div>
              </div>
              <div class="lio-row">
                <div class="lio-labeled"><div class="lio-label">BPM</div><input type="number" id="cbBpm" placeholder="120" min="40" max="200"></div>
                <div class="lio-labeled"><div class="lio-label">Swing</div><input type="text" id="cbSwing" placeholder="0.05"></div>
              </div>
              <div class="lio-row">
                <div class="lio-labeled"><div class="lio-label">Lead Wave</div>
                  <select id="cbWave"><option value="sine">Sine</option><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Tri</option></select>
                </div>
                <div class="lio-labeled"><div class="lio-label">Bass Wave</div>
                  <select id="cbBassWave"><option value="sine">Sine</option><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Tri</option></select>
                </div>
              </div>
              <div class="lio-labeled" style="margin-bottom:4px"><div class="lio-label">Chords (degrees, comma-sep)</div><input type="text" id="cbChords" placeholder="0,5,3,6"></div>
              <div class="lio-row">
                <div class="lio-labeled"><div class="lio-label">Drums</div><select id="cbDrum"></select></div>
                <div class="lio-labeled"><div class="lio-label">Tag</div><select id="cbGenre"></select></div>
              </div>
              <div class="lio-row">
                <div class="lio-labeled"><div class="lio-label">Reverb</div><input type="text" id="cbReverb" placeholder="0.2"></div>
                <div class="lio-labeled"><div class="lio-label">Filter</div><input type="text" id="cbFilter" placeholder="0.5"></div>
              </div>
              <div class="lio-row">
                <div class="lio-labeled"><div class="lio-label">Bass Int</div><input type="text" id="cbBassInt" placeholder="0.7"></div>
                <div class="lio-labeled"><div class="lio-label">Mel Density</div><input type="text" id="cbMelDens" placeholder="0.5"></div>
              </div>
              <div class="lio-row" style="margin-top:4px">
                <button id="cbSaveBtn" class="lio-accent">💾 Save</button>
                <button id="cbLoadBtn">⬆ Load Current</button>
              </div>
              <div id="cbStatus" style="font-size:8px;color:var(--lio-dim);margin-top:3px;min-height:14px"></div>
              <div class="lio-sep"></div>
              <div class="lio-row">
                <button id="cbExportBtn">📤 Export All</button>
                <button id="cbImportBtn">📥 Import</button>
              </div>
              <div id="cbImportArea" style="display:none;margin-top:4px">
                <textarea id="cbImportText" style="width:100%;height:60px;font-size:8px;background:rgba(128,128,128,0.06);border:1px solid rgba(128,128,128,0.15);border-radius:5px;color:var(--lio-text);padding:4px;resize:vertical" placeholder="paste JSON here"></textarea>
                <button id="cbImportDoBtn" class="lio-accent" style="margin-top:3px">Import Now</button>
              </div>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">My Genres</div>
              <div id="lioCustomGenreList"></div>
            </div>
          </div>

          <!-- ═══ THEME TAB ═══ -->
          <div class="lio-pane" id="lioPane-theme">
            <div class="lio-scroll">
              <div class="lio-label" style="margin-bottom:3px">Theme</div>
              <div class="lio-color-row" id="lioThemeSwatches"></div>
              <div class="lio-label" style="margin-bottom:3px;margin-top:6px">Custom Color</div>
              <div class="lio-color-row">
                <input type="color" id="lioCustomColor" value="${state.customColor}">
                <button id="lioApplyCustomBtn" class="lio-accent" style="flex:1">Apply Custom</button>
              </div>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">Visualizer Mode</div>
              <select id="lioVizMode">
                <option value="bars">Bars</option>
                <option value="wave">Waveform</option>
                <option value="circle">Circular</option>
                <option value="off">Off</option>
              </select>
              <div class="lio-sep"></div>
              <div class="lio-label" style="margin-bottom:3px">Sleep Timer (minutes)</div>
              <select id="lioSleepSel">
                <option value="0">Off</option>
                <option value="5">5 min</option>
                <option value="10">10 min</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
              </select>
              <div id="lioSleepStatus" style="font-size:7px;color:var(--lio-dim);margin-top:3px"></div>
            </div>
          </div>
        </div>

        <!-- ── MINI PLAYER CONTENT ── -->
        <div class="lio-mini-content">
          <div class="lio-mini-viz"><canvas id="lioMiniCanvas" height="32"></canvas></div>
          <div class="lio-row">
            <button id="lioMiniPlayBtn" class="lio-play-btn" style="flex:1">▶</button>
            <button id="lioMiniExpandBtn" style="padding:3px 8px;font-size:10px">⇔</button>
          </div>
          <div id="lioMiniStatus" style="font-size:7px;color:var(--lio-dim);text-align:center;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
        </div>

      </div>
    `;

    document.body.appendChild(panel);

    // ── grab DOM refs ──
    const el = (id) => panel.querySelector(id);
    const dragBar = el('#lioDragBar');
    const collapseBtn = el('#lioCollapseBtn');
    const miniBtn = el('#lioMiniBtn');
    const tabs = panel.querySelectorAll('.lio-tab');
    const playBtn = el('#lioPlayBtn');
    const panicBtn = el('#lioPanicBtn');
    const presetSel = el('#lioPresetSel');
    const bpmInput = el('#lioBpm');
    const energyInput = el('#lioEnergy');
    const volumeInput = el('#lioVolume');
    const seedInput = el('#lioSeed');
    const newSeedBtn = el('#lioNewSeedBtn');
    const randomizeBtn = el('#lioRandomizeBtn');
    const jamBtn = el('#lioJamBtn');
    const sleepBtn = el('#lioSleepBtn');
    const statusEl = el('#lioStatus');
    const statusDot = el('#lioStatusDot');
    const topStatus = el('#lioTopStatus');
    const canvas = el('#lioCanvas');
    const ctx2d = canvas.getContext('2d');
    const miniCanvas = el('#lioMiniCanvas');
    const miniCtx = miniCanvas.getContext('2d');
    const miniPlayBtn = el('#lioMiniPlayBtn');
    const miniExpandBtn = el('#lioMiniExpandBtn');
    const miniStatus = el('#lioMiniStatus');

    // sound tab
    const drumsChk = el('#lioDrums'), bassChk = el('#lioBass'), melodyChk = el('#lioMelody'), fxChk = el('#lioFx');
    const reverbChk = el('#lioReverb'), vizChk = el('#lioViz');
    const bassIntInput = el('#lioBassInt'), melDensInput = el('#lioMelDens'), filterInput = el('#lioFilter');
    const revWetInput = el('#lioRevWet'), arpChk = el('#lioArp'), chordChk = el('#lioChord');
    const arpRateSel = el('#lioArpRate'), voicingSel = el('#lioVoicing');
    const eqBassIn = el('#lioEqBass'), eqLowIn = el('#lioEqLow'), eqMidIn = el('#lioEqMid'), eqHighIn = el('#lioEqHigh'), eqAirIn = el('#lioEqAir');
    const songModeChk = el('#lioSongMode'), songSpeedSel = el('#lioSongSpeed');

    // sequencer
    const patternSel = el('#lioPatternSel');
    const swingInput = el('#lioSwing');
    const seqSaveBtn = el('#lioSeqSaveBtn'), seqRandBtn = el('#lioSeqRandBtn');

    // builder
    const cbName = el('#cbName'), cbRoot = el('#cbRoot'), cbScale = el('#cbScale');
    const cbBpm = el('#cbBpm'), cbSwing = el('#cbSwing'), cbWave = el('#cbWave'), cbBassWave = el('#cbBassWave');
    const cbChords = el('#cbChords'), cbDrum = el('#cbDrum'), cbGenre = el('#cbGenre');
    const cbReverb = el('#cbReverb'), cbFilter = el('#cbFilter'), cbBassInt = el('#cbBassInt'), cbMelDens = el('#cbMelDens');
    const cbSaveBtn = el('#cbSaveBtn'), cbLoadBtn = el('#cbLoadBtn'), cbStatus = el('#cbStatus');
    const cbExportBtn = el('#cbExportBtn'), cbImportBtn = el('#cbImportBtn');
    const cbImportArea = el('#cbImportArea'), cbImportText = el('#cbImportText'), cbImportDoBtn = el('#cbImportDoBtn');

    // theme
    const themeSwatches = el('#lioThemeSwatches');
    const customColorInput = el('#lioCustomColor');
    const applyCustomBtn = el('#lioApplyCustomBtn');
    const vizModeSel = el('#lioVizMode');
    const sleepSel = el('#lioSleepSel');
    const sleepStatus = el('#lioSleepStatus');

    const customListEl = el('#lioCustomGenreList');
    const presetCardsEl = el('#lioPresetCards');

    // live drum pattern (copied from built-in on load)
    let livePattern = JSON.parse(JSON.stringify(drumPatterns[state.drumPattern] || drumPatterns.standard));

    // ═══════════════════════════════════════════════════════════════════════════
    // AUDIO ENGINE
    // ═══════════════════════════════════════════════════════════════════════════
    let audioCtx = null, master = null, analyser = null, analyserData = null;
    let convolver = null, reverbWet = null, reverbDry = null;
    let eqFilters = [];
    let noiseBuffer = null;
    let isPlaying = false, timer = null, currentStep = 0, nextNoteTime = 0;
    let rng = mulberry32(hashString(state.seed + state.preset));
    let arpPhase = 0;
    let sleepTimerId = null, sleepFadeInterval = null;

    // song mode state — target values that we lerp toward
    let songTargets = {};
    let songPhase = 0;

    function setStatus(txt) {
      statusEl.textContent = txt;
      topStatus.textContent = txt.slice(0, 20);
      miniStatus.textContent = txt.slice(0, 28);
    }

    function secondsPerStep() {
      return (60 / clamp(Number(state.bpm) || 120, 40, 240)) / 4;
    }

    function makeNoiseBuffer() {
      const len = Math.floor(audioCtx.sampleRate * 2);
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    function makeImpulse(dur, decay) {
      const len = Math.floor(audioCtx.sampleRate * dur);
      const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function ensureAudio() {
      if (audioCtx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { setStatus('no web audio :/'); return; }

      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = 0.0001;

      // analyser for the visualizer
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserData = new Uint8Array(analyser.frequencyBinCount);

      // 5-band EQ
      const eqFreqs = [80, 250, 1000, 4000, 12000];
      const eqTypes = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
      eqFilters = eqFreqs.map((freq, i) => {
        const f = audioCtx.createBiquadFilter();
        f.type = eqTypes[i]; f.frequency.value = freq; f.gain.value = 0; f.Q.value = 1.2;
        return f;
      });
      for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);

      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.15;

      // echo
      const delay = audioCtx.createDelay(1.0);
      delay.delayTime.value = 0.21;
      const feedGain = audioCtx.createGain(); feedGain.gain.value = 0.18;
      const wetGain = audioCtx.createGain(); wetGain.gain.value = state.fx ? 0.14 : 0;

      // convolver reverb
      convolver = audioCtx.createConvolver();
      convolver.buffer = makeImpulse(2.4, 2.5);
      reverbWet = audioCtx.createGain(); reverbWet.gain.value = state.reverb ? state.reverbWet : 0;
      reverbDry = audioCtx.createGain(); reverbDry.gain.value = 1;

      // routing
      master.connect(eqFilters[0]);
      const eqOut = eqFilters[eqFilters.length - 1];
      eqOut.connect(reverbDry);
      eqOut.connect(convolver);
      convolver.connect(reverbWet);
      reverbDry.connect(comp);
      reverbWet.connect(comp);
      master.connect(delay);
      delay.connect(feedGain); feedGain.connect(delay);
      delay.connect(wetGain); wetGain.connect(comp);
      comp.connect(analyser);
      analyser.connect(audioCtx.destination);

      noiseBuffer = makeNoiseBuffer();
      updateEq();
    }

    function updateEq() {
      if (!eqFilters.length || !audioCtx) return;
      const vals = [(state.eqBass || 0.5) * 2 - 1, (state.eqLow || 0.5) * 2 - 1, (state.eqMid || 0.5) * 2 - 1, (state.eqHigh || 0.5) * 2 - 1, (state.eqAir || 0.5) * 2 - 1];
      const now = audioCtx.currentTime;
      eqFilters.forEach((f, i) => f.gain.setTargetAtTime(vals[i] * 12, now, 0.05));
    }

    function updateAudio() {
      if (!audioCtx || !master) return;
      const now = audioCtx.currentTime;
      const vol = isPlaying ? clamp(state.volume, 0, 1) : 0.0001;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(vol, now, 0.03);
      if (reverbWet) reverbWet.gain.setTargetAtTime(state.reverb ? (state.reverbWet || 0.18) : 0, now, 0.05);
    }

    // ── synth voices ──
    function playTone(o) {
      if (!audioCtx || !master) return;
      const t = o.time, dur = Math.max(0.02, o.dur || 0.12);
      const vol = clamp(o.vol || 0.1, 0.001, 0.85);
      const att = Math.max(0.002, o.attack || 0.01);
      const rel = Math.max(0.02, o.release || 0.08);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + dur * 0.55);
      if (o.detune) osc.detune.value = o.detune;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + att);
      gain.gain.setValueAtTime(vol, t + dur);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
      if (o.filter !== undefined) {
        const filt = audioCtx.createBiquadFilter();
        filt.type = o.filterType || 'lowpass';
        filt.frequency.setValueAtTime(o.filter, t);
        if (o.filterEnd) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.filterEnd), t + dur);
        filt.Q.value = o.q || 0.8;
        osc.connect(filt); filt.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(master);
      osc.start(t); osc.stop(t + dur + rel + 0.05);
    }

    function playNoise(o) {
      if (!audioCtx || !master || !noiseBuffer) return;
      const t = o.time, dur = Math.max(0.01, o.dur || 0.08);
      const vol = clamp(o.vol || 0.1, 0.001, 0.85);
      const src = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      const filt = audioCtx.createBiquadFilter();
      src.buffer = noiseBuffer; src.loop = true;
      filt.type = o.filterType || 'highpass';
      filt.frequency.setValueAtTime(o.filter || 7000, t);
      filt.Q.value = o.q || 0.7;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(gain); gain.connect(master);
      src.start(t); src.stop(t + dur + 0.02);
    }

    function playKick(time, power) {
      playTone({ time, freq: 150, freqEnd: 40, dur: 0.2, type: 'sine', vol: 0.38 * power, attack: 0.003, release: 0.07 });
      playNoise({ time, dur: 0.022, vol: 0.06 * power, filterType: 'lowpass', filter: 850 });
    }

    function playSnare(time, power) {
      playNoise({ time, dur: 0.12, vol: 0.2 * power, filterType: 'bandpass', filter: 1900, q: 0.85 });
      playTone({ time, freq: 190, dur: 0.07, type: 'triangle', vol: 0.07 * power, attack: 0.003, release: 0.04 });
    }

    function playHat(time, power, open) {
      playNoise({ time, dur: open ? 0.18 : 0.04, vol: (open ? 0.09 : 0.06) * power, filterType: 'highpass', filter: open ? 6000 : 9000, q: 0.5 });
    }

    function playClap(time, power) {
      for (let i = 0; i < 3; i++) playNoise({ time: time + i * 0.01, dur: 0.06, vol: 0.12 * power, filterType: 'bandpass', filter: 1200, q: 1.2 });
    }

    function playChord(time, midiRoot, scaleArr, voicing, waveType, vol, dur, filterFreq) {
      const degrees = chordVoicings[voicing] || chordVoicings.triad;
      degrees.forEach((deg, idx) => {
        const note = midiRoot + (scaleArr[deg % scaleArr.length] || 0);
        playTone({ time: time + idx * 0.012, freq: midiToFreq(note), dur, type: waveType, vol: vol * (0.6 - idx * 0.05), attack: 0.025, release: 0.1, filter: filterFreq, q: 0.7, detune: (Math.random() - 0.5) * 6 });
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SCHEDULER — the heart. called by timer, schedules notes ahead of time.
    // ═══════════════════════════════════════════════════════════════════════════
    function scheduleStep(step, rawTime) {
      const allGenres = getAllGenres();
      const genre = allGenres[state.preset] || builtinGenres.neonwar;
      const scale = scales[genre.scale] || scales.minor;
      const step16 = step % 16;
      const bar = Math.floor(step / 16);
      const stepDur = secondsPerStep();
      const swing = genre.swing !== undefined ? genre.swing : state.swing || 0.06;
      const swingOffset = step16 % 2 === 1 ? stepDur * swing : 0;
      const time = rawTime + swingOffset;

      const chordIndex = (genre.chords || [0, 5, 3, 6])[bar % (genre.chords || [0, 5, 3, 6]).length] || 0;
      const chordOffset = scale[chordIndex % scale.length] || 0;
      const baseMidi = (genre.root || 45) + chordOffset;

      const energy = clamp(Number(state.energy) || 0, 0, 1);
      const bassInt = clamp(Number(state.bassIntensity !== undefined ? state.bassIntensity : genre.bassIntensity || 0.7), 0, 1);
      const melDens = clamp(Number(state.melodyDensity !== undefined ? state.melodyDensity : genre.melodyDensity || 0.5), 0, 1);
      const filterFreq = 200 + clamp(Number(state.filterCutoff !== undefined ? state.filterCutoff : genre.filterCutoff || 0.5), 0, 1) * 7000;
      const power = 0.6 + energy * 0.6;

      // drums
      if (state.drums) {
        if (livePattern.kick[step16]) playKick(time, power);
        if (livePattern.snare[step16]) playSnare(time, power);
        if (livePattern.hat[step16]) playHat(time, power, false);
        if (livePattern.ohat[step16]) playHat(time, power, true);
        if (energy > 0.75 && step16 % 4 === 2 && rng() < 0.3) playSnare(time + stepDur * 0.5, power * 0.3);
        if (energy > 0.6 && livePattern.snare[step16] && rng() < 0.4) playClap(time, power * 0.4);
      }

      // bass
      if (state.bass) {
        const bassRate = bassInt > 0.7 ? [0, 3, 6, 8, 10, 14] : bassInt > 0.4 ? [0, 6, 8, 14] : [0, 8];
        if (bassRate.includes(step16)) {
          const bassChoices = [0, 0, 2, 4];
          const bassNote = baseMidi - 12 + (scale[bassChoices[Math.floor(rng() * bassChoices.length)] % scale.length] || 0);
          playTone({ time, freq: midiToFreq(bassNote), dur: stepDur * (rng() < 0.28 ? 1.8 : 0.9), type: genre.bassWave || 'square', vol: 0.14 + bassInt * 0.12 + energy * 0.06, attack: 0.008, release: 0.09, filter: filterFreq * 0.6, filterEnd: filterFreq * 0.3, q: 0.7 });
        }
      }

      // chord stab
      if (state.melody && state.chordMode && step16 % 4 === 0 && rng() < 0.55 + energy * 0.25) {
        playChord(time, baseMidi + 12, scale, state.chordVoicing || 'triad', genre.wave || 'sawtooth', (0.04 + melDens * 0.05) * (0.5 + energy * 0.5), stepDur * (1.8 + rng() * 1.2), filterFreq);
      }

      // arpeggiator
      if (state.melody && state.arpMode) {
        const arpSteps = chordVoicings[state.chordVoicing || 'triad'];
        const arpRate = Number(state.arpRate) || 2;
        if (step16 % arpRate === 0) {
          const deg = arpSteps[arpPhase % arpSteps.length];
          const arpMidi = baseMidi + 12 + (scale[deg % scale.length] || 0) + (rng() < 0.15 ? 12 : 0);
          playTone({ time, freq: midiToFreq(arpMidi), dur: stepDur * (0.4 + rng() * 0.4), type: genre.wave || 'sawtooth', vol: 0.05 + melDens * 0.06 + energy * 0.04, attack: 0.008, release: 0.07, filter: filterFreq * 1.2, q: 1.1 });
          arpPhase++;
        }
      }

      // free melody (only if arp is off)
      if (state.melody && !state.arpMode) {
        const chance = 0.08 + melDens * 0.55 + energy * 0.2;
        const allowed = energy > 0.7 || step16 % 2 === 0 || [3, 7, 11, 15].includes(step16);
        if (allowed && rng() < chance) {
          const degPool = [0, 0, 1, 2, 3, 4, 5, 6];
          const deg = (chordIndex + degPool[Math.floor(rng() * degPool.length)]) % scale.length;
          playTone({ time, freq: midiToFreq((genre.root || 45) + 24 + (scale[deg] || 0) + (rng() < 0.22 ? 12 : 0)), dur: stepDur * (0.4 + rng() * 1.2), type: genre.wave || 'sine', vol: 0.045 + melDens * 0.07 + energy * 0.05, attack: 0.014, release: 0.1, filter: filterFreq * 1.5, filterEnd: filterFreq * 0.8, q: 0.9 });
        }
      }

      // ambient pad at bar start
      if (state.melody && state.reverb && step16 === 0 && rng() < 0.3 + melDens * 0.4) {
        playTone({ time, freq: midiToFreq(baseMidi + 12 + (scale[chordIndex % scale.length] || 0)), dur: stepDur * 14, type: 'sine', vol: 0.018 + melDens * 0.02, attack: 0.3, release: 0.8, filter: 1800, q: 0.5 });
      }

      if (step16 === 0) {
        const g = getAllGenres()[state.preset];
        setStatus(`${(g || {}).name || '?'} · bar ${bar + 1} · ${state.seed}`);
      }
    }

    function scheduler() {
      if (!isPlaying || !audioCtx) return;
      while (nextNoteTime < audioCtx.currentTime + 0.15) {
        scheduleStep(currentStep, nextNoteTime);
        nextNoteTime += secondsPerStep();
        currentStep++;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SONG MODE — slowly drift parameters over time. the mynoise.net vibe.
    // ═══════════════════════════════════════════════════════════════════════════
    function pickSongTargets() {
      songTargets = {
        energy: 0.2 + rng() * 0.7,
        filterCutoff: 0.1 + rng() * 0.8,
        reverbWet: rng() * 0.6,
        bassIntensity: 0.2 + rng() * 0.7,
        melodyDensity: 0.1 + rng() * 0.7,
      };
    }

    function songModeTick() {
      if (!state.songMode || !isPlaying) return;
      const speed = Number(state.songModeSpeed) || 0.5;
      songPhase += 0.01 * speed;

      // lerp current values toward targets
      const lerpRate = 0.02 * speed;
      const params = ['energy', 'filterCutoff', 'reverbWet', 'bassIntensity', 'melodyDensity'];
      params.forEach(p => {
        if (songTargets[p] !== undefined) {
          const diff = songTargets[p] - (state[p] || 0.5);
          state[p] = (state[p] || 0.5) + diff * lerpRate;
        }
      });

      // occasionally pick new targets
      if (rng() < 0.003 * speed) pickSongTargets();

      // update sliders to reflect drift
      energyInput.value = state.energy;
      energyEl().textContent = Math.round(state.energy * 100) + '%';
      filterInput.value = state.filterCutoff;
      filterVal().textContent = Math.round(state.filterCutoff * 100) + '%';
      revWetInput.value = state.reverbWet;
      revVal().textContent = Math.round(state.reverbWet * 100) + '%';
      bassIntInput.value = state.bassIntensity;
      bassIntVal().textContent = Math.round(state.bassIntensity * 100) + '%';
      melDensInput.value = state.melodyDensity;
      melDensVal().textContent = Math.round(state.melodyDensity * 100) + '%';

      updateAudio();
    }

    // helper to get val elements (they're siblings of inputs)
    function energyEl() { return el('#lioEnergyVal'); }
    function filterVal() { return el('#lioFilterVal'); }
    function revVal() { return el('#lioRevVal'); }
    function bassIntVal() { return el('#lioBassIntVal'); }
    function melDensVal() { return el('#lioMelDensVal'); }

    // ═══════════════════════════════════════════════════════════════════════════
    // PLAY / STOP
    // ═══════════════════════════════════════════════════════════════════════════
    async function startMusic() {
      ensureAudio();
      if (!audioCtx) return;
      try { if (audioCtx.state === 'suspended') await audioCtx.resume(); } catch { return; }

      rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio3`));
      arpPhase = 0; currentStep = 0;
      nextNoteTime = audioCtx.currentTime + 0.06;
      isPlaying = true;
      songPhase = 0;
      pickSongTargets();
      updateAudio();

      if (timer) clearInterval(timer);
      timer = setInterval(scheduler, 22);
      // song mode ticker (slower)
      if (window._lioSongInterval) clearInterval(window._lioSongInterval);
      if (state.songMode) window._lioSongInterval = setInterval(songModeTick, 200);

      playBtn.textContent = '⏹ STOP';
      playBtn.classList.add('playing');
      statusDot.classList.add('playing');
      miniPlayBtn.textContent = '⏹';
      miniPlayBtn.classList.add('playing');
      setStatus(`playing: ${getAllGenres()[state.preset]?.name || '?'}`);
    }

    function stopMusic() {
      isPlaying = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (window._lioSongInterval) { clearInterval(window._lioSongInterval); window._lioSongInterval = null; }
      updateAudio();
      playBtn.textContent = '▶ START';
      playBtn.classList.remove('playing');
      statusDot.classList.remove('playing');
      miniPlayBtn.textContent = '▶';
      miniPlayBtn.classList.remove('playing');
      setStatus('stopped.');
    }

    function panicStop() {
      stopMusic();
      if (audioCtx && master) {
        const now = audioCtx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0.0001, now);
      }
      setStatus('panic! silenced.');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SLEEP TIMER — fade out over 30s then stop
    // ═══════════════════════════════════════════════════════════════════════════
    function startSleepTimer(minutes) {
      clearSleepTimer();
      if (!minutes || minutes <= 0) return;
      const ms = minutes * 60 * 1000;
      sleepStatus.textContent = `sleep: ${minutes}min`;
      sleepTimerId = setTimeout(() => {
        // fade out over 30s
        if (!isPlaying) { clearSleepTimer(); return; }
        const startVol = state.volume;
        let fadeProgress = 0;
        sleepFadeInterval = setInterval(() => {
          fadeProgress += 0.033;
          const fade = Math.max(0, 1 - fadeProgress / 30);
          state.volume = startVol * fade;
          if (audioCtx && master) master.gain.setTargetAtTime(state.volume > 0.0001 ? state.volume : 0.0001, audioCtx.currentTime, 0.1);
          if (fadeProgress >= 30) {
            clearInterval(sleepFadeInterval); sleepFadeInterval = null;
            stopMusic();
            state.volume = startVol;
            clearSleepTimer();
          }
        }, 1000);
      }, ms);
    }

    function clearSleepTimer() {
      if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
      if (sleepFadeInterval) { clearInterval(sleepFadeInterval); sleepFadeInterval = null; }
      sleepStatus.textContent = '';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VISUALIZER — bars, waveform, or circular. runs on requestAnimationFrame.
    // ═══════════════════════════════════════════════════════════════════════════
    let vizRaf = null;

    function resizeCanvas(c, ctx) {
      const wrap = c.parentElement;
      if (!wrap) return;
      c.width = wrap.clientWidth * window.devicePixelRatio;
      c.height = parseInt(c.getAttribute('height') || '56') * window.devicePixelRatio;
    }

    function drawViz() {
      vizRaf = requestAnimationFrame(drawViz);

      // pick the right canvas (mini or main)
      const isMini = state.miniplayer;
      const c = isMini ? miniCanvas : canvas;
      const ctx = isMini ? miniCtx : ctx2d;
      if (!c || !ctx) return;

      resizeCanvas(c, ctx);
      const W = c.width, H = c.height;
      const dpr = window.devicePixelRatio;

      ctx.clearRect(0, 0, W, H);

      if (!state.visualizer || state.vizMode === 'off') {
        ctx.fillStyle = 'rgba(40,40,60,0.3)';
        ctx.fillRect(0, 0, W, H);
        return;
      }

      if (!analyser || !isPlaying) {
        // idle animation — gentle sine wave
        const t = Date.now() / 1000;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(128,128,180,0.2)';
        ctx.lineWidth = 1.5 * dpr;
        for (let i = 0; i < W; i += 2 * dpr) {
          const y = H / 2 + Math.sin(i / W * Math.PI * 3 + t * 1.5) * H * 0.15;
          i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
        }
        ctx.stroke();
        return;
      }

      analyser.getByteFrequencyData(analyserData);
      const bins = analyserData.length;

      if (state.vizMode === 'bars') {
        const barW = W / bins;
        for (let i = 0; i < bins; i++) {
          const v = analyserData[i] / 255;
          const h = v * H;
          const hue = 120 + v * 180; // green to blue (matrix-ish)
          ctx.fillStyle = `hsla(${hue}, 70%, ${40 + v * 30}%, ${0.6 + v * 0.4})`;
          ctx.fillRect(i * barW, H - h, Math.max(1, barW - 1), h);
          // glow cap
          if (v > 0.3) {
            ctx.fillStyle = `hsla(${hue + 40}, 100%, 75%, ${v * 0.6})`;
            ctx.fillRect(i * barW, H - h - 2 * dpr, Math.max(1, barW - 1), 2 * dpr);
          }
        }
      } else if (state.vizMode === 'wave') {
        analyser.getByteTimeDomainData(analyserData);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100,255,140,0.7)';
        ctx.lineWidth = 2 * dpr;
        for (let i = 0; i < bins; i++) {
          const x = i / bins * W;
          const y = ((analyserData[i] / 128) - 1) * H * 0.4 + H / 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        // second pass dimmer
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100,255,140,0.2)';
        ctx.lineWidth = 6 * dpr;
        for (let i = 0; i < bins; i++) {
          const x = i / bins * W;
          const y = ((analyserData[i] / 128) - 1) * H * 0.4 + H / 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (state.vizMode === 'circle') {
        const cx = W / 2, cy = H / 2;
        const radius = Math.min(W, H) * 0.3;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100,255,140,0.5)';
        ctx.lineWidth = 2 * dpr;
        for (let i = 0; i < bins; i++) {
          const angle = (i / bins) * Math.PI * 2 - Math.PI / 2;
          const v = analyserData[i] / 255;
          const r = radius + v * radius * 0.8;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        // inner glow
        ctx.beginPath();
        ctx.fillStyle = 'rgba(100,255,140,0.08)';
        ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawViz();

    // ═══════════════════════════════════════════════════════════════════════════
    // SEQUENCER UI
    // ═══════════════════════════════════════════════════════════════════════════
    function buildSeqRows() {
      ['kick', 'snare', 'hat', 'ohat'].forEach(type => {
        const row = el(`#lioSeq${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (!row) return;
        while (row.children.length > 1) row.removeChild(row.lastChild);
        for (let i = 0; i < 16; i++) {
          const cell = document.createElement('div');
          cell.className = `lio-seq-cell ${type}${livePattern[type][i] ? ' on' : ''}`;
          cell.dataset.type = type; cell.dataset.idx = i;
          cell.addEventListener('click', () => {
            livePattern[type][i] = livePattern[type][i] ? 0 : 1;
            cell.classList.toggle('on', !!livePattern[type][i]);
          });
          row.appendChild(cell);
        }
      });
    }

    setInterval(() => {
      if (isPlaying) {
        panel.querySelectorAll('.lio-seq-cell').forEach((c) => {
          const idx = parseInt(c.dataset.idx);
          c.classList.toggle('active-step', idx === currentStep % 16);
        });
      }
    }, 50);

    // populate pattern select
    Object.keys(drumPatterns).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      patternSel.appendChild(opt);
    });
    patternSel.value = state.drumPattern || 'standard';
    patternSel.addEventListener('change', () => {
      state.drumPattern = patternSel.value;
      livePattern = JSON.parse(JSON.stringify(drumPatterns[state.drumPattern]));
      buildSeqRows(); saveState();
    });

    seqSaveBtn.addEventListener('click', () => {
      state._customPattern = JSON.parse(JSON.stringify(livePattern));
      state.drumPattern = '_custom';
      saveState(); setStatus('pattern saved');
    });

    seqRandBtn.addEventListener('click', () => {
      ['kick', 'snare', 'hat', 'ohat'].forEach(type => {
        const chances = { kick: 0.2, snare: 0.15, hat: 0.5, ohat: 0.08 };
        for (let i = 0; i < 16; i++) livePattern[type][i] = Math.random() < chances[type] ? 1 : 0;
      });
      buildSeqRows();
    });

    buildSeqRows();

    // ═══════════════════════════════════════════════════════════════════════════
    // PRESET CARDS
    // ═══════════════════════════════════════════════════════════════════════════
    function buildPresetCards() {
      presetCardsEl.innerHTML = '';
      const all = getAllGenres();
      Object.entries(all).forEach(([key, p]) => {
        const isCustom = key.startsWith('custom_');
        const card = document.createElement('div');
        card.className = `lio-preset-card${state.preset === key ? ' active' : ''}`;
        card.innerHTML = `
          <div class="lio-preset-card-icon">${genreIcon(p.genre)}</div>
          <div class="lio-preset-card-info">
            <div class="lio-preset-card-name">${p.name}</div>
            <div class="lio-preset-card-meta">${p.scale || ''} · ${p.wave || ''}</div>
          </div>
          <div class="lio-preset-card-bpm">${p.bpm || '?'}</div>
          <div class="lio-preset-badge">${isCustom ? 'custom' : (p.genre || '')}</div>
        `;
        card.addEventListener('click', () => { applyPreset(key); buildPresetCards(); });
        presetCardsEl.appendChild(card);
      });
    }

    function applyPreset(key) {
      const all = getAllGenres();
      const p = all[key];
      if (!p) return;
      state.preset = key;
      state.bpm = p.bpm || 120;
      state.reverbWet = p.reverbWet !== undefined ? p.reverbWet : 0.2;
      state.filterCutoff = p.filterCutoff !== undefined ? p.filterCutoff : 0.5;
      state.arpMode = !!p.arpMode;
      state.chordMode = p.chordMode !== undefined ? p.chordMode : true;
      state.drumPattern = p.drumPattern || 'standard';
      state.bassIntensity = p.bassIntensity !== undefined ? p.bassIntensity : 0.7;
      state.melodyDensity = p.melodyDensity !== undefined ? p.melodyDensity : 0.5;
      state.swing = p.swing !== undefined ? p.swing : 0.06;
      livePattern = JSON.parse(JSON.stringify(drumPatterns[state.drumPattern] || drumPatterns.standard));
      presetSel.value = key;
      renderAll();
      buildSeqRows();
      if (isPlaying && audioCtx) {
        rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio3`));
        currentStep = 0; nextNoteTime = audioCtx.currentTime + 0.05;
      }
      saveState();
      setStatus(`loaded: ${p.name}`);
    }

    // populate main preset select
    function buildPresetSel() {
      presetSel.innerHTML = '';
      const all = getAllGenres();
      Object.entries(all).forEach(([key, p]) => {
        const opt = document.createElement('option');
        opt.value = key; opt.textContent = p.name;
        presetSel.appendChild(opt);
      });
      presetSel.value = state.preset;
    }

    // populate voicing select
    Object.keys(chordVoicings).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      voicingSel.appendChild(opt);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TOGGLE BINDING HELPER
    // ═══════════════════════════════════════════════════════════════════════════
    function updateToggle(labelId, checkbox, val) {
      checkbox.checked = !!val;
      const lbl = el('#' + labelId);
      if (lbl) lbl.classList.toggle('on', !!val);
    }

    function bindToggle(labelId, checkboxId, stateKey, callback) {
      const lbl = el('#' + labelId);
      const chk = el('#' + checkboxId);
      if (!lbl || !chk) return;
      lbl.addEventListener('click', () => {
        const newVal = !chk.checked;
        chk.checked = newVal;
        state[stateKey] = newVal;
        lbl.classList.toggle('on', newVal);
        if (callback) callback(newVal);
        saveState();
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER ALL VALUES — sync UI to state
    // ═══════════════════════════════════════════════════════════════════════════
    function renderAll() {
      bpmInput.value = state.bpm; el('#lioBpmVal').textContent = state.bpm;
      energyInput.value = state.energy; el('#lioEnergyVal').textContent = Math.round(state.energy * 100) + '%';
      volumeInput.value = state.volume; el('#lioVolVal').textContent = Math.round(state.volume * 100) + '%';
      seedInput.value = state.seed;
      revWetInput.value = state.reverbWet || 0.18; el('#lioRevVal').textContent = Math.round((state.reverbWet || 0.18) * 100) + '%';
      filterInput.value = state.filterCutoff || 0.5; el('#lioFilterVal').textContent = Math.round((state.filterCutoff || 0.5) * 100) + '%';
      bassIntInput.value = state.bassIntensity || 0.7; el('#lioBassIntVal').textContent = Math.round((state.bassIntensity || 0.7) * 100) + '%';
      melDensInput.value = state.melodyDensity || 0.5; el('#lioMelDensVal').textContent = Math.round((state.melodyDensity || 0.5) * 100) + '%';
      swingInput.value = state.swing || 0.06; el('#lioSwingVal').textContent = Math.round((state.swing || 0.06) * 100) + '%';
      eqBassIn.value = state.eqBass || 0.5; eqLowIn.value = state.eqLow || 0.5;
      eqMidIn.value = state.eqMid || 0.5; eqHighIn.value = state.eqHigh || 0.5; eqAirIn.value = state.eqAir || 0.5;
      arpRateSel.value = String(state.arpRate || 2);
      voicingSel.value = state.chordVoicing || 'triad';
      vizModeSel.value = state.vizMode || 'bars';
      sleepSel.value = String(state.sleepTimer || 0);
      updateToggle('ltDrums', drumsChk, state.drums);
      updateToggle('ltBass', bassChk, state.bass);
      updateToggle('ltMelody', melodyChk, state.melody);
      updateToggle('ltFx', fxChk, state.fx);
      updateToggle('ltReverb', reverbChk, state.reverb);
      updateToggle('ltViz', vizChk, state.visualizer);
      updateToggle('ltArp', arpChk, state.arpMode);
      updateToggle('ltChord', chordChk, state.chordMode);
      updateToggle('ltSong', songModeChk, state.songMode);
      songSpeedSel.value = String(state.songModeSpeed || 0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TAB SWITCHING
    // ═══════════════════════════════════════════════════════════════════════════
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.lio-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const pane = el(`#lioPane-${tab.dataset.tab}`);
        if (pane) pane.classList.add('active');
        state.activeTab = tab.dataset.tab;
        if (tab.dataset.tab === 'genres') buildPresetCards();
        if (tab.dataset.tab === 'build') buildCustomList();
        if (tab.dataset.tab === 'theme') buildThemeSwatches();
        saveState();
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DRAG TO MOVE
    // ═══════════════════════════════════════════════════════════════════════════
    let drag = null;
    [dragBar, panel.querySelector('.lio-handle')].forEach(dragEl => {
      if (!dragEl) return;
      dragEl.addEventListener('pointerdown', e => {
        if (e.target.closest('button,input,select,label')) return;
        state.collapsed = false; panel.classList.remove('lio-collapsed');
        drag = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
        dragEl.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      dragEl.addEventListener('pointermove', e => {
        if (!drag) return;
        state.x = clamp(e.clientX - drag.dx, 6, Math.max(6, innerWidth - panel.offsetWidth - 6));
        state.y = clamp(e.clientY - drag.dy, 6, Math.max(6, innerHeight - panel.offsetHeight - 6));
        panel.style.left = state.x + 'px'; panel.style.top = state.y + 'px';
      });
      dragEl.addEventListener('pointerup', () => { if (drag) { drag = null; saveState(); } });
      dragEl.addEventListener('pointercancel', () => { drag = null; });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // COLLAPSE / MINI
    // ═══════════════════════════════════════════════════════════════════════════
    collapseBtn.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      panel.classList.toggle('lio-collapsed', state.collapsed);
      saveState();
    });
    miniBtn.addEventListener('click', () => {
      state.miniplayer = !state.miniplayer;
      panel.classList.toggle('lio-mini', state.miniplayer);
      saveState();
    });
    miniExpandBtn.addEventListener('click', () => {
      state.miniplayer = false;
      panel.classList.remove('lio-mini');
      saveState();
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PLAY CONTROLS
    // ═══════════════════════════════════════════════════════════════════════════
    playBtn.addEventListener('click', () => { isPlaying ? stopMusic() : startMusic(); });
    miniPlayBtn.addEventListener('click', () => { isPlaying ? stopMusic() : startMusic(); });
    panicBtn.addEventListener('click', panicStop);

    presetSel.addEventListener('change', () => applyPreset(presetSel.value));

    bpmInput.addEventListener('input', () => { state.bpm = Number(bpmInput.value); el('#lioBpmVal').textContent = state.bpm; saveState(); });
    energyInput.addEventListener('input', () => { state.energy = Number(energyInput.value); el('#lioEnergyVal').textContent = Math.round(state.energy * 100) + '%'; saveState(); });
    volumeInput.addEventListener('input', () => { state.volume = Number(volumeInput.value); el('#lioVolVal').textContent = Math.round(state.volume * 100) + '%'; updateAudio(); saveState(); });
    seedInput.addEventListener('change', () => {
      state.seed = seedInput.value.trim() || 'torn-war-777';
      seedInput.value = state.seed;
      if (isPlaying && audioCtx) { rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio3`)); currentStep = 0; nextNoteTime = audioCtx.currentTime + 0.05; }
      saveState(); setStatus(`seed: ${state.seed}`);
    });

    newSeedBtn.addEventListener('click', () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = 'torn-'; for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
      state.seed = s; seedInput.value = s;
      if (isPlaying && audioCtx) { rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio3`)); currentStep = 0; nextNoteTime = audioCtx.currentTime + 0.05; }
      saveState(); setStatus(`new seed: ${s}`);
    });

    randomizeBtn.addEventListener('click', () => {
      const keys = Object.keys(getAllGenres());
      applyPreset(keys[Math.floor(Math.random() * keys.length)]);
      state.energy = Number((0.3 + Math.random() * 0.65).toFixed(2));
      energyInput.value = state.energy; el('#lioEnergyVal').textContent = Math.round(state.energy * 100) + '%';
      newSeedBtn.click();
      saveState();
    });

    // 🎱 Jam button — nudge one random parameter for a happy accident
    jamBtn.addEventListener('click', () => {
      const params = ['energy', 'filterCutoff', 'reverbWet', 'bassIntensity', 'melodyDensity', 'swing'];
      const p = params[Math.floor(Math.random() * params.length)];
      const delta = (Math.random() - 0.5) * 0.3;
      state[p] = clamp((state[p] || 0.5) + delta, 0, p === 'swing' ? 0.4 : 1);
      renderAll();
      updateAudio();
      saveState();
      setStatus(`jam: ${p} nudged`);
    });

    // 💤 Sleep button — cycle through timer options
    sleepBtn.addEventListener('click', () => {
      const options = [0, 5, 10, 15, 30, 60];
      const current = state.sleepTimer || 0;
      const idx = options.indexOf(current);
      const next = options[(idx + 1) % options.length];
      state.sleepTimer = next;
      sleepSel.value = String(next);
      if (next > 0) {
        startSleepTimer(next);
        setStatus(`sleep: ${next}min`);
      } else {
        clearSleepTimer();
        setStatus('sleep off');
      }
      saveState();
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SOUND TAB BINDINGS
    // ═══════════════════════════════════════════════════════════════════════════
    bindToggle('ltDrums', 'lioDrums', 'drums');
    bindToggle('ltBass', 'lioBass', 'bass');
    bindToggle('ltMelody', 'lioMelody', 'melody');
    bindToggle('ltFx', 'lioFx', 'fx', () => updateAudio());
    bindToggle('ltReverb', 'lioReverb', 'reverb', () => updateAudio());
    bindToggle('ltViz', 'lioViz', 'visualizer');
    bindToggle('ltArp', 'lioArp', 'arpMode');
    bindToggle('ltChord', 'lioChord', 'chordMode');
    bindToggle('ltSong', 'lioSongMode', 'songMode', (v) => {
      if (v && isPlaying) {
        if (window._lioSongInterval) clearInterval(window._lioSongInterval);
        window._lioSongInterval = setInterval(songModeTick, 200);
        pickSongTargets();
      } else if (!v && window._lioSongInterval) {
        clearInterval(window._lioSongInterval);
        window._lioSongInterval = null;
      }
    });

    revWetInput.addEventListener('input', () => { state.reverbWet = Number(revWetInput.value); el('#lioRevVal').textContent = Math.round(state.reverbWet * 100) + '%'; updateAudio(); saveState(); });
    filterInput.addEventListener('input', () => { state.filterCutoff = Number(filterInput.value); el('#lioFilterVal').textContent = Math.round(state.filterCutoff * 100) + '%'; saveState(); });
    bassIntInput.addEventListener('input', () => { state.bassIntensity = Number(bassIntInput.value); el('#lioBassIntVal').textContent = Math.round(state.bassIntensity * 100) + '%'; saveState(); });
    melDensInput.addEventListener('input', () => { state.melodyDensity = Number(melDensInput.value); el('#lioMelDensVal').textContent = Math.round(state.melodyDensity * 100) + '%'; saveState(); });
    swingInput.addEventListener('input', () => { state.swing = Number(swingInput.value); el('#lioSwingVal').textContent = Math.round(state.swing * 100) + '%'; saveState(); });

    // EQ
    [[eqBassIn, 'eqBass'], [eqLowIn, 'eqLow'], [eqMidIn, 'eqMid'], [eqHighIn, 'eqHigh'], [eqAirIn, 'eqAir']].forEach(([el2, key]) => {
      el2.addEventListener('input', () => { state[key] = Number(el2.value); updateEq(); saveState(); });
    });

    arpRateSel.addEventListener('change', () => { state.arpRate = Number(arpRateSel.value); saveState(); });
    voicingSel.addEventListener('change', () => { state.chordVoicing = voicingSel.value; saveState(); });
    songSpeedSel.addEventListener('change', () => { state.songModeSpeed = Number(songSpeedSel.value); saveState(); });

    // ═══════════════════════════════════════════════════════════════════════════
    // CUSTOM GENRE BUILDER
    // ═══════════════════════════════════════════════════════════════════════════
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    for (let midi = 36; midi <= 72; midi++) {
      const opt = document.createElement('option');
      opt.value = midi; opt.textContent = `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1} (${midi})`;
      cbRoot.appendChild(opt);
    }
    cbRoot.value = 45;

    Object.entries(scaleNames).forEach(([key, name]) => {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = name;
      cbScale.appendChild(opt);
    });

    Object.keys(drumPatterns).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      cbDrum.appendChild(opt);
    });

    const genreTags = ['custom', 'cyberpunk', 'lofi', 'electronic', 'ambient', 'synthwave', 'jazz', 'trap', 'blues', 'citypop', 'metal', 'world', 'experimental', 'latin'];
    genreTags.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g.charAt(0).toUpperCase() + g.slice(1);
      cbGenre.appendChild(opt);
    });

    cbLoadBtn.addEventListener('click', () => {
      const p = getAllGenres()[state.preset];
      if (!p) return;
      cbName.value = p.name + ' copy';
      cbRoot.value = p.root || 45; cbScale.value = p.scale || 'minor';
      cbBpm.value = p.bpm || 120; cbSwing.value = p.swing || 0.05;
      cbWave.value = p.wave || 'sawtooth'; cbBassWave.value = p.bassWave || 'sine';
      cbChords.value = (p.chords || [0, 5, 3, 6]).join(',');
      cbDrum.value = p.drumPattern || 'standard'; cbGenre.value = p.genre || 'custom';
      cbReverb.value = p.reverbWet || 0.2; cbFilter.value = p.filterCutoff || 0.5;
      cbBassInt.value = p.bassIntensity || 0.7; cbMelDens.value = p.melodyDensity || 0.5;
      cbStatus.textContent = 'loaded from: ' + p.name;
    });

    cbSaveBtn.addEventListener('click', () => {
      const name = cbName.value.trim();
      if (!name) { cbStatus.textContent = 'need a name'; return; }
      const chordsRaw = cbChords.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (!chordsRaw.length) { cbStatus.textContent = 'need chord degrees'; return; }
      const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 24);
      state.customGenres[key] = {
        name, genre: cbGenre.value,
        root: Number(cbRoot.value) || 45, scale: cbScale.value,
        bpm: clamp(Number(cbBpm.value) || 120, 40, 240),
        swing: clamp(Number(cbSwing.value) || 0.05, 0, 0.4),
        wave: cbWave.value, bassWave: cbBassWave.value,
        chords: chordsRaw, drumPattern: cbDrum.value,
        reverbWet: clamp(Number(cbReverb.value) || 0.2, 0, 1),
        filterCutoff: clamp(Number(cbFilter.value) || 0.5, 0, 1),
        bassIntensity: clamp(Number(cbBassInt.value) || 0.7, 0, 1),
        melodyDensity: clamp(Number(cbMelDens.value) || 0.5, 0, 1),
        arpMode: false, chordMode: true,
      };
      saveState(); buildPresetSel(); buildCustomList();
      cbStatus.textContent = 'saved: ' + name;
      setStatus('genre saved: ' + name);
    });

    // export/import
    cbExportBtn.addEventListener('click', () => {
      const data = JSON.stringify(state.customGenres || {}, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'lio-genres.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    cbImportBtn.addEventListener('click', () => {
      cbImportArea.style.display = cbImportArea.style.display === 'none' ? 'block' : 'none';
    });

    cbImportDoBtn.addEventListener('click', () => {
      try {
        const data = JSON.parse(cbImportText.value);
        if (typeof data === 'object') {
          Object.assign(state.customGenres, data);
          saveState(); buildPresetSel(); buildCustomList();
          cbStatus.textContent = 'imported!';
        }
      } catch { cbStatus.textContent = 'invalid JSON'; }
    });

    function buildCustomList() {
      customListEl.innerHTML = '';
      const customs = state.customGenres || {};
      if (!Object.keys(customs).length) {
        customListEl.innerHTML = '<div style="font-size:8px;color:var(--lio-dim);padding:4px">no custom genres yet. make one above.</div>';
        return;
      }
      Object.entries(customs).forEach(([key, p]) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:4px 6px;background:rgba(128,128,128,0.05);border-radius:6px;border:1px solid rgba(128,128,128,0.08)';
        row.innerHTML = `
          <span style="font-size:12px">${genreIcon(p.genre)}</span>
          <span style="flex:1;font-size:9px;color:var(--lio-text);font-weight:700">${p.name}</span>
          <span style="font-size:8px;color:var(--lio-dim)">${p.bpm}bpm</span>
        `;
        const useBtn = document.createElement('button');
        useBtn.textContent = 'use'; useBtn.style.cssText = 'padding:2px 6px;font-size:8px;min-width:0';
        useBtn.addEventListener('click', () => { applyPreset('custom_' + key); buildPresetSel(); });
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕'; delBtn.style.cssText = 'padding:2px 6px;font-size:8px;min-width:0;color:#ff8080';
        delBtn.addEventListener('click', () => {
          delete state.customGenres[key]; saveState(); buildCustomList(); buildPresetSel();
        });
        row.appendChild(useBtn); row.appendChild(delBtn);
        customListEl.appendChild(row);
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // THEME TAB
    // ═══════════════════════════════════════════════════════════════════════════
    function buildThemeSwatches() {
      themeSwatches.innerHTML = '';
      Object.entries(themes).forEach(([key, t]) => {
        const sw = document.createElement('div');
        sw.className = `lio-color-swatch${state.theme === key ? ' active' : ''}`;
        sw.style.background = t.accent;
        sw.title = t.name;
        sw.addEventListener('click', () => {
          state.theme = key;
          applyThemeToPanel(panel);
          buildThemeSwatches();
          saveState();
        });
        themeSwatches.appendChild(sw);
      });
    }

    customColorInput.addEventListener('input', () => { state.customColor = customColorInput.value; });
    applyCustomBtn.addEventListener('click', () => {
      state.theme = 'custom';
      applyThemeToPanel(panel);
      buildThemeSwatches();
      saveState();
      setStatus('custom color applied');
    });

    vizModeSel.addEventListener('change', () => { state.vizMode = vizModeSel.value; saveState(); });
    sleepSel.addEventListener('change', () => {
      const val = Number(sleepSel.value);
      state.sleepTimer = val;
      if (val > 0) startSleepTimer(val);
      else clearSleepTimer();
      saveState();
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PLACE PANEL — position on screen
    // ═══════════════════════════════════════════════════════════════════════════
    function placePanel() {
      const W = panel.offsetWidth || 350, H = panel.offsetHeight || 450;
      if (state.x === null) state.x = innerWidth - W - 10;
      if (state.y === null) state.y = innerHeight - H - 80;
      state.x = clamp(state.x, 6, Math.max(6, innerWidth - W - 6));
      state.y = clamp(state.y, 6, Math.max(6, innerHeight - H - 6));
      panel.style.left = state.x + 'px'; panel.style.top = state.y + 'px';
      saveState();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════════════════
    buildPresetSel();
    renderAll();
    buildCustomList();
    buildThemeSwatches();
    setTimeout(placePanel, 60);
    window.addEventListener('resize', placePanel);

    // restore custom pattern if saved
    if (state._customPattern && state.drumPattern === '_custom') {
      livePattern = JSON.parse(JSON.stringify(state._customPattern));
      buildSeqRows();
    }

    setStatus('v3 ready · tap START');

  }); // end ready/init
})(); // end IIFE
