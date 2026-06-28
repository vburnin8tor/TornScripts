// ==UserScript==
// @name         Lio Procedural Music Synth v2 — Torn PDA
// @namespace    qian751.torn.procedural.music.v2
// @version      2.0.0
// @description  Procedural music synth for Torn PDA — live visualizer, 10+ genres, custom genre builder, arpeggiator, chord mode, reverb, EQ, and more.
// @author       Qian751 (massively upgraded)
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-end
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/584693/Procedural%20Music%20Synth%20Panel%20for%20Torn%20PDA.user.js
// @updateURL https://update.greasyfork.org/scripts/584693/Procedural%20Music%20Synth%20Panel%20for%20Torn%20PDA.meta.js
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'lio-proc-music-v2';
  const STYLE_ID = 'lio-proc-music-v2-style';
  const STORE_KEY = 'lioProceduralMusicV2';

  if (window.__lioProceduralMusicV2Loaded) return;
  window.__lioProceduralMusicV2Loaded = true;

  // ─── SCALES ───────────────────────────────────────────────────────────────
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
  };

  const scaleNames = {
    minor: 'Minor', major: 'Major', dark: 'Dark/Phrygian', pentatonic: 'Pentatonic',
    dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian',
    blues: 'Blues', wholetone: 'Whole Tone', chromatic: 'Chromatic', japanese: 'Japanese'
  };

  // ─── BUILT-IN PRESETS ─────────────────────────────────────────────────────
  const builtinPresets = {
    neonwar: {
      name: 'Neon War Chain',
      root: 45, scale: 'minor', wave: 'sawtooth', bassWave: 'square',
      bpm: 124, swing: 0.04, chords: [0, 5, 3, 6],
      reverbWet: 0.18, filterCutoff: 0.5, arpMode: false, chordMode: true,
      drumPattern: 'standard', bassIntensity: 0.7, melodyDensity: 0.5,
      genre: 'cyberpunk'
    },
    island: {
      name: 'Private Island Chill',
      root: 48, scale: 'major', wave: 'triangle', bassWave: 'sine',
      bpm: 88, swing: 0.08, chords: [0, 4, 5, 3],
      reverbWet: 0.3, filterCutoff: 0.65, arpMode: false, chordMode: false,
      drumPattern: 'half', bassIntensity: 0.5, melodyDensity: 0.4,
      genre: 'lofi'
    },
    bazaar: {
      name: 'Bazaar Panic',
      root: 42, scale: 'dark', wave: 'square', bassWave: 'sawtooth',
      bpm: 138, swing: 0.02, chords: [0, 2, 5, 1],
      reverbWet: 0.1, filterCutoff: 0.55, arpMode: true, chordMode: false,
      drumPattern: 'standard', bassIntensity: 0.8, melodyDensity: 0.6,
      genre: 'electronic'
    },
    stealth: {
      name: 'Stealth Hospital Run',
      root: 43, scale: 'dark', wave: 'sine', bassWave: 'triangle',
      bpm: 104, swing: 0.12, chords: [0, 1, 3, 2],
      reverbWet: 0.45, filterCutoff: 0.35, arpMode: false, chordMode: false,
      drumPattern: 'sparse', bassIntensity: 0.4, melodyDensity: 0.25,
      genre: 'ambient'
    },
    lofi_beats: {
      name: 'Lo-Fi Study Hall',
      root: 50, scale: 'dorian', wave: 'triangle', bassWave: 'sine',
      bpm: 75, swing: 0.14, chords: [0, 3, 4, 5],
      reverbWet: 0.38, filterCutoff: 0.45, arpMode: false, chordMode: true,
      drumPattern: 'lofi', bassIntensity: 0.45, melodyDensity: 0.3,
      genre: 'lofi'
    },
    synthwave: {
      name: 'Retrowave Highway',
      root: 45, scale: 'minor', wave: 'sawtooth', bassWave: 'sawtooth',
      bpm: 116, swing: 0.0, chords: [0, 5, 3, 7],
      reverbWet: 0.25, filterCutoff: 0.7, arpMode: true, chordMode: true,
      drumPattern: 'disco', bassIntensity: 0.75, melodyDensity: 0.55,
      genre: 'synthwave'
    },
    jazz: {
      name: 'Back Alley Jazz',
      root: 53, scale: 'dorian', wave: 'sine', bassWave: 'triangle',
      bpm: 95, swing: 0.2, chords: [0, 2, 4, 1],
      reverbWet: 0.35, filterCutoff: 0.55, arpMode: false, chordMode: true,
      drumPattern: 'jazz', bassIntensity: 0.55, melodyDensity: 0.65,
      genre: 'jazz'
    },
    trap: {
      name: 'Faction Trap Drop',
      root: 41, scale: 'minor', wave: 'sawtooth', bassWave: 'sine',
      bpm: 140, swing: 0.0, chords: [0, 0, 5, 3],
      reverbWet: 0.15, filterCutoff: 0.6, arpMode: false, chordMode: false,
      drumPattern: 'trap', bassIntensity: 0.9, melodyDensity: 0.2,
      genre: 'trap'
    },
    ambient: {
      name: 'Offshore Drone',
      root: 48, scale: 'lydian', wave: 'sine', bassWave: 'sine',
      bpm: 60, swing: 0.0, chords: [0, 4, 2, 6],
      reverbWet: 0.65, filterCutoff: 0.3, arpMode: false, chordMode: true,
      drumPattern: 'none', bassIntensity: 0.25, melodyDensity: 0.2,
      genre: 'ambient'
    },
    blues_rock: {
      name: 'Torn Street Blues',
      root: 45, scale: 'blues', wave: 'sawtooth', bassWave: 'square',
      bpm: 100, swing: 0.1, chords: [0, 3, 0, 4],
      reverbWet: 0.2, filterCutoff: 0.65, arpMode: false, chordMode: false,
      drumPattern: 'rock', bassIntensity: 0.7, melodyDensity: 0.6,
      genre: 'blues'
    },
    japanese_city: {
      name: 'City Pop Nights',
      root: 52, scale: 'japanese', wave: 'triangle', bassWave: 'sine',
      bpm: 102, swing: 0.06, chords: [0, 4, 2, 5],
      reverbWet: 0.3, filterCutoff: 0.6, arpMode: true, chordMode: false,
      drumPattern: 'standard', bassIntensity: 0.55, melodyDensity: 0.5,
      genre: 'citypop'
    },
    dungeon: {
      name: 'Dungeon Raid',
      root: 40, scale: 'phrygian', wave: 'square', bassWave: 'sawtooth',
      bpm: 150, swing: 0.0, chords: [0, 1, 3, 0],
      reverbWet: 0.12, filterCutoff: 0.8, arpMode: true, chordMode: false,
      drumPattern: 'metal', bassIntensity: 0.85, melodyDensity: 0.45,
      genre: 'metal'
    }
  };

  // ─── DRUM PATTERNS ────────────────────────────────────────────────────────
  const drumPatterns = {
    standard: {
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      ohat:  [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    },
    lofi: {
      kick:  [1,0,0,0, 0,0,0,0, 0,1,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,1, 0,1,1,0, 1,1,0,1, 0,1,0,0],
      ohat:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
    },
    trap: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      ohat:  [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    },
    jazz: {
      kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      hat:   [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0],
      ohat:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    },
    disco: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      ohat:  [0,0,0,1, 0,0,0,1, 0,0,0,1, 0,0,0,1],
    },
    rock: {
      kick:  [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
      hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      ohat:  [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0],
    },
    metal: {
      kick:  [1,0,1,1, 0,0,1,0, 1,1,0,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      ohat:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },
    half: {
      kick:  [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hat:   [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      ohat:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },
    sparse: {
      kick:  [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hat:   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      ohat:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },
    none: {
      kick:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      hat:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      ohat:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    }
  };

  // ─── CHORD VOICINGS ───────────────────────────────────────────────────────
  const chordVoicings = {
    triad:   [0, 2, 4],
    seventh: [0, 2, 4, 6],
    sus2:    [0, 1, 4],
    sus4:    [0, 3, 4],
    power:   [0, 4],
    shell:   [0, 2, 6],
  };

  // ─── DEFAULT STATE ─────────────────────────────────────────────────────────
  const defaultState = {
    collapsed: false, x: null, y: null,
    preset: 'neonwar', bpm: 124, energy: 0.62, volume: 0.34,
    seed: 'torn-war-777',
    drums: true, bass: true, melody: true, fx: true,
    reverb: true, reverbWet: 0.18,
    visualizer: true,
    arpMode: false, arpRate: 2,
    chordMode: true, chordVoicing: 'triad',
    filterCutoff: 0.5,
    eqBass: 0.5, eqMid: 0.5, eqHigh: 0.5,
    drumPattern: 'standard',
    bassIntensity: 0.7,
    melodyDensity: 0.5,
    activeTab: 'play',
    customGenres: {},
  };

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Object.assign({}, defaultState, stored);
    } catch { return Object.assign({}, defaultState); }
  }

  const state = loadState();

  // Merge builtins + customs
  function getAllPresets() {
    const customs = {};
    Object.entries(state.customGenres || {}).forEach(([k, v]) => {
      customs['custom_' + k] = v;
    });
    return Object.assign({}, builtinPresets, customs);
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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

  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // ─── CSS ───────────────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        width: 360px;
        max-width: calc(100vw - 12px);
        z-index: 999999;
        color: #e8e8f0;
        background: rgba(10, 10, 18, 0.96);
        border: 1px solid rgba(200, 160, 255, 0.2);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 0 0 1px rgba(255,80,200,0.08), 0 24px 60px rgba(0,0,0,0.65);
        font-family: 'SF Pro Display', system-ui, -apple-system, sans-serif;
        backdrop-filter: blur(18px);
        transition: transform 0.25s cubic-bezier(.4,0,.2,1);
      }
      #${PANEL_ID}.lio-collapsed { transform: translateX(calc(100% - 48px)); }
      #${PANEL_ID} * { box-sizing: border-box; }

      #${PANEL_ID} .lio-handle {
        position: absolute; left: 0; top: 0;
        width: 48px; height: 100%;
        display: grid; place-items: center;
        background: linear-gradient(180deg,
          rgba(255,60,180,0.95) 0%,
          rgba(140,60,255,0.95) 50%,
          rgba(60,140,255,0.95) 100%);
        font-size: 20px; cursor: pointer; user-select: none;
        writing-mode: vertical-rl;
        letter-spacing: 2px;
      }
      #${PANEL_ID} .lio-handle span {
        transform: rotate(180deg); font-size: 10px;
        font-weight: 800; letter-spacing: 2px;
        text-shadow: 0 0 8px rgba(255,255,255,0.5);
        color: rgba(255,255,255,0.95);
      }

      #${PANEL_ID} .lio-inner { padding: 10px 10px 10px 58px; }

      #${PANEL_ID} .lio-topbar {
        display: flex; align-items: center; gap: 6px;
        margin-bottom: 8px; cursor: grab; user-select: none;
      }
      #${PANEL_ID} .lio-topbar-title {
        flex: 1; font-size: 12px; font-weight: 700;
        background: linear-gradient(90deg, #ff60c0, #a060ff, #60a0ff);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      #${PANEL_ID} .lio-topbar-status {
        font-size: 9px; color: #7070a0; width: 80px;
        text-overflow: ellipsis; overflow: hidden; white-space: nowrap;
        text-align: right;
      }

      /* TABS */
      #${PANEL_ID} .lio-tabs {
        display: flex; gap: 3px; margin-bottom: 8px;
      }
      #${PANEL_ID} .lio-tab {
        flex: 1; padding: 5px 4px; font-size: 9px; font-weight: 700;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; color: #8080aa; cursor: pointer; text-align: center;
        transition: all 0.15s; letter-spacing: 0.5px; text-transform: uppercase;
      }
      #${PANEL_ID} .lio-tab.active {
        background: rgba(180,80,255,0.2); border-color: rgba(180,80,255,0.5);
        color: #d090ff;
      }
      #${PANEL_ID} .lio-tab:hover:not(.active) { background: rgba(255,255,255,0.08); color: #a0a0cc; }

      #${PANEL_ID} .lio-pane { display: none; }
      #${PANEL_ID} .lio-pane.active { display: block; }

      /* CANVAS */
      #${PANEL_ID} .lio-viz-wrap {
        border-radius: 10px; overflow: hidden;
        background: #050508; margin-bottom: 8px;
        border: 1px solid rgba(255,255,255,0.06);
      }
      #${PANEL_ID} canvas { display: block; width: 100%; height: 68px; }

      /* CONTROLS */
      #${PANEL_ID} .lio-row { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px; }
      #${PANEL_ID} .lio-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 5px; }
      #${PANEL_ID} .lio-row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin-bottom: 5px; }
      #${PANEL_ID} .lio-stack { display: grid; gap: 5px; }

      #${PANEL_ID} .lio-sep {
        height: 1px; background: rgba(255,255,255,0.08); margin: 7px 0;
      }

      #${PANEL_ID} button {
        padding: 7px 8px; font-size: 10px; font-weight: 700;
        border: 1px solid rgba(255,255,255,0.12); border-radius: 9px;
        background: rgba(255,255,255,0.07); color: #d0d0ee;
        cursor: pointer; transition: all 0.15s; outline: none;
        letter-spacing: 0.3px;
      }
      #${PANEL_ID} button:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.22); }
      #${PANEL_ID} button.lio-play-btn {
        background: linear-gradient(135deg, rgba(255,60,180,0.3), rgba(100,60,255,0.3));
        border-color: rgba(200,80,255,0.5); color: #fff; font-size: 11px;
      }
      #${PANEL_ID} button.lio-play-btn.playing {
        background: linear-gradient(135deg, rgba(255,60,60,0.35), rgba(180,40,200,0.35));
        border-color: rgba(255,80,80,0.6);
        box-shadow: 0 0 12px rgba(255,60,60,0.25);
      }
      #${PANEL_ID} button.lio-danger {
        background: rgba(255,60,60,0.12); border-color: rgba(255,80,80,0.3);
        color: #ff9090;
      }
      #${PANEL_ID} button.lio-accent {
        background: rgba(80,180,255,0.12); border-color: rgba(80,180,255,0.3);
        color: #80c0ff;
      }
      #${PANEL_ID} button.active {
        background: rgba(180,80,255,0.25); border-color: rgba(180,80,255,0.6);
        color: #d090ff; box-shadow: 0 0 8px rgba(180,80,255,0.2);
      }

      #${PANEL_ID} select, #${PANEL_ID} input[type="text"] {
        width: 100%; padding: 6px 8px; font-size: 10px;
        border: 1px solid rgba(255,255,255,0.1); border-radius: 9px;
        background: rgba(255,255,255,0.06); color: #d0d0ee; outline: none;
      }
      #${PANEL_ID} select option { color: #111; background: #222; }
      #${PANEL_ID} input[type="text"]::placeholder { color: #606080; }

      #${PANEL_ID} .lio-label {
        font-size: 9px; color: #7070a0; margin-bottom: 2px;
        font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
      }
      #${PANEL_ID} .lio-labeled { display: grid; gap: 2px; }

      /* SLIDERS */
      #${PANEL_ID} .lio-slider-row {
        display: grid; grid-template-columns: 1fr; gap: 2px; margin-bottom: 4px;
      }
      #${PANEL_ID} .lio-slider-header {
        display: flex; justify-content: space-between; align-items: center;
      }
      #${PANEL_ID} .lio-slider-name { font-size: 9px; color: #8080aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      #${PANEL_ID} .lio-slider-val { font-size: 9px; color: #d090ff; font-weight: 700; min-width: 30px; text-align: right; }
      #${PANEL_ID} input[type="range"] {
        width: 100%; height: 4px; margin: 0;
        -webkit-appearance: none; appearance: none;
        background: rgba(255,255,255,0.1); border-radius: 2px; outline: none;
        border: none; padding: 0; cursor: pointer;
      }
      #${PANEL_ID} input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
        background: linear-gradient(135deg, #ff60c0, #a060ff); cursor: pointer;
        box-shadow: 0 0 6px rgba(200,80,255,0.5);
      }
      #${PANEL_ID} input[type="range"].green::-webkit-slider-thumb { background: linear-gradient(135deg, #40ff80, #00c060); }
      #${PANEL_ID} input[type="range"].blue::-webkit-slider-thumb { background: linear-gradient(135deg, #40a0ff, #0060e0); }

      /* TOGGLE SWITCHES */
      #${PANEL_ID} .lio-toggle-group {
        display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 5px;
      }
      #${PANEL_ID} .lio-toggle-group.four { grid-template-columns: 1fr 1fr 1fr 1fr; }
      #${PANEL_ID} .lio-toggle {
        display: flex; align-items: center; gap: 5px;
        padding: 5px 7px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04); cursor: pointer;
      }
      #${PANEL_ID} .lio-toggle input { display: none; }
      #${PANEL_ID} .lio-toggle-dot {
        width: 22px; height: 12px; border-radius: 6px;
        background: rgba(255,255,255,0.12); position: relative;
        transition: background 0.2s; flex-shrink: 0;
      }
      #${PANEL_ID} .lio-toggle-dot::after {
        content: ''; position: absolute; width: 8px; height: 8px;
        border-radius: 50%; background: #fff;
        top: 2px; left: 2px; transition: transform 0.2s;
        box-shadow: 0 0 4px rgba(0,0,0,0.4);
      }
      #${PANEL_ID} .lio-toggle.on .lio-toggle-dot { background: rgba(180,80,255,0.7); }
      #${PANEL_ID} .lio-toggle.on .lio-toggle-dot::after { transform: translateX(10px); }
      #${PANEL_ID} .lio-toggle-label { font-size: 9px; font-weight: 700; color: #9090bb; letter-spacing: 0.3px; }
      #${PANEL_ID} .lio-toggle.on .lio-toggle-label { color: #c0a0ff; }

      /* STEP SEQUENCER */
      #${PANEL_ID} .lio-seq { margin-bottom: 5px; }
      #${PANEL_ID} .lio-seq-row { display: flex; gap: 2px; margin-bottom: 2px; align-items: center; }
      #${PANEL_ID} .lio-seq-name { font-size: 8px; color: #6060a0; font-weight: 700; width: 30px; flex-shrink: 0; }
      #${PANEL_ID} .lio-seq-cell {
        flex: 1; height: 14px; border-radius: 3px;
        background: rgba(255,255,255,0.06); cursor: pointer;
        border: 1px solid rgba(255,255,255,0.04);
        transition: background 0.1s;
      }
      #${PANEL_ID} .lio-seq-cell.on { background: rgba(200,80,255,0.65); border-color: rgba(200,80,255,0.4); }
      #${PANEL_ID} .lio-seq-cell.kick.on { background: rgba(255,80,80,0.7); }
      #${PANEL_ID} .lio-seq-cell.snare.on { background: rgba(255,180,40,0.7); }
      #${PANEL_ID} .lio-seq-cell.hat.on { background: rgba(40,200,255,0.7); }
      #${PANEL_ID} .lio-seq-cell.ohat.on { background: rgba(100,255,180,0.7); }
      #${PANEL_ID} .lio-seq-cell.active-step { box-shadow: 0 0 0 1px rgba(255,255,255,0.5); }

      /* CHORD BUILDER */
      #${PANEL_ID} .lio-chord-keys {
        display: grid; grid-template-columns: repeat(12,1fr); gap: 2px; margin-bottom: 5px;
      }
      #${PANEL_ID} .lio-key {
        height: 28px; border-radius: 4px; cursor: pointer;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
        position: relative; transition: background 0.1s;
      }
      #${PANEL_ID} .lio-key.black {
        background: rgba(80,80,120,0.6); height: 20px;
      }
      #${PANEL_ID} .lio-key.active { background: rgba(200,80,255,0.7); }

      /* EQ */
      #${PANEL_ID} .lio-eq { display: flex; gap: 5px; align-items: flex-end; height: 48px; margin-bottom: 5px; }
      #${PANEL_ID} .lio-eq-band { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; height: 100%; }
      #${PANEL_ID} .lio-eq-band input[type="range"] { writing-mode: vertical-lr; direction: rtl; width: 4px; flex: 1; }
      #${PANEL_ID} .lio-eq-band span { font-size: 8px; color: #6060a0; }

      /* CUSTOM GENRE FORM */
      #${PANEL_ID} .lio-field { display: grid; gap: 2px; margin-bottom: 5px; }
      #${PANEL_ID} .lio-field label { font-size: 9px; color: #7070a0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      #${PANEL_ID} .lio-field select, #${PANEL_ID} .lio-field input { width: 100%; }

      #${PANEL_ID} .lio-status-bar {
        margin-top: 6px; padding: 4px 8px;
        background: rgba(255,255,255,0.03); border-radius: 7px;
        font-size: 9px; color: #6060a0; min-height: 24px;
        border: 1px solid rgba(255,255,255,0.05);
        display: flex; align-items: center; gap: 5px;
      }
      #${PANEL_ID} .lio-status-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: #404060; flex-shrink: 0; transition: background 0.3s;
      }
      #${PANEL_ID} .lio-status-dot.playing {
        background: #40ff80;
        box-shadow: 0 0 6px rgba(64,255,128,0.6);
        animation: liopulse 1s ease-in-out infinite;
      }
      @keyframes liopulse {
        0%,100% { opacity: 1; } 50% { opacity: 0.4; }
      }

      /* SCROLLABLE PANE */
      #${PANEL_ID} .lio-scroll { max-height: 320px; overflow-y: auto; padding-right: 2px; }
      #${PANEL_ID} .lio-scroll::-webkit-scrollbar { width: 3px; }
      #${PANEL_ID} .lio-scroll::-webkit-scrollbar-thumb { background: rgba(180,80,255,0.3); border-radius: 2px; }

      /* PRESET CARDS */
      #${PANEL_ID} .lio-preset-card {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 8px; border-radius: 9px; margin-bottom: 4px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
        cursor: pointer; transition: all 0.15s;
      }
      #${PANEL_ID} .lio-preset-card:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
      #${PANEL_ID} .lio-preset-card.active { background: rgba(180,80,255,0.12); border-color: rgba(180,80,255,0.4); }
      #${PANEL_ID} .lio-preset-card-icon { font-size: 18px; flex-shrink: 0; }
      #${PANEL_ID} .lio-preset-card-info { flex: 1; min-width: 0; }
      #${PANEL_ID} .lio-preset-card-name { font-size: 10px; font-weight: 700; color: #d0d0ee; }
      #${PANEL_ID} .lio-preset-card-meta { font-size: 8px; color: #6060a0; }
      #${PANEL_ID} .lio-preset-card-bpm { font-size: 9px; color: #9080cc; font-weight: 700; }
      #${PANEL_ID} .lio-preset-badge {
        font-size: 7px; padding: 2px 5px; border-radius: 4px;
        background: rgba(255,255,255,0.08); color: #8080aa;
        text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── GENRE ICONS ──────────────────────────────────────────────────────────
  const genreIcons = {
    cyberpunk: '🔮', lofi: '☕', electronic: '⚡', ambient: '🌊',
    synthwave: '🌆', jazz: '🎷', trap: '🔊', blues: '🎸',
    citypop: '🌸', metal: '💀', custom: '🎨', default: '🎵'
  };

  function genreIcon(g) { return genreIcons[g] || genreIcons.default; }

  // ─── BUILD UI ─────────────────────────────────────────────────────────────
  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function init() {
    if (document.getElementById(PANEL_ID)) return;
    injectCss();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    if (state.collapsed) panel.classList.add('lio-collapsed');

    panel.innerHTML = `
      <div class="lio-handle"><span>LIO SYNTH</span></div>
      <div class="lio-inner">
        <div class="lio-topbar" id="lioDragBar">
          <div class="lio-topbar-title">🎛 Lio Synth v2</div>
          <div class="lio-topbar-status" id="lioTopStatus">Ready</div>
          <button id="lioCollapseBtn" style="padding:4px 8px;font-size:10px;min-width:28px">⇄</button>
        </div>

        <div class="lio-tabs" id="lioTabs">
          <div class="lio-tab active" data-tab="play">▶ Play</div>
          <div class="lio-tab" data-tab="sound">🔊 Sound</div>
          <div class="lio-tab" data-tab="seq">🥁 Seq</div>
          <div class="lio-tab" data-tab="presets">🎵 Genres</div>
          <div class="lio-tab" data-tab="build">🔧 Build</div>
        </div>

        <!-- PLAY TAB -->
        <div class="lio-pane active" id="lioPane-play">
          <div class="lio-viz-wrap" id="lioVizWrap">
            <canvas id="lioCanvas" height="68"></canvas>
          </div>

          <div class="lio-row" style="margin-bottom:6px">
            <button id="lioPlayBtn" class="lio-play-btn">▶ START</button>
            <button id="lioPanicBtn" class="lio-danger">⛔ PANIC</button>
          </div>

          <div class="lio-labeled" style="margin-bottom:5px">
            <div class="lio-label">Preset</div>
            <select id="lioPresetSel"></select>
          </div>

          <div class="lio-slider-row">
            <div class="lio-slider-header">
              <span class="lio-slider-name">BPM</span>
              <span class="lio-slider-val" id="lioBpmVal">124</span>
            </div>
            <input type="range" id="lioBpm" min="50" max="200" step="1">
          </div>
          <div class="lio-slider-row">
            <div class="lio-slider-header">
              <span class="lio-slider-name">Energy</span>
              <span class="lio-slider-val" id="lioEnergyVal">62%</span>
            </div>
            <input type="range" id="lioEnergy" min="0" max="1" step="0.01" class="green">
          </div>
          <div class="lio-slider-row">
            <div class="lio-slider-header">
              <span class="lio-slider-name">Volume</span>
              <span class="lio-slider-val" id="lioVolVal">34%</span>
            </div>
            <input type="range" id="lioVolume" min="0" max="1" step="0.01" class="blue">
          </div>

          <div class="lio-sep"></div>

          <div class="lio-labeled" style="margin-bottom:5px">
            <div class="lio-label">Seed (controls pattern)</div>
            <input type="text" id="lioSeed" placeholder="e.g. torn-war-777">
          </div>

          <div class="lio-row">
            <button id="lioNewSeedBtn">🎲 New Seed</button>
            <button id="lioRandomizeBtn" class="lio-accent">✨ Randomize All</button>
          </div>

          <div class="lio-status-bar">
            <div class="lio-status-dot" id="lioStatusDot"></div>
            <span id="lioStatus">Tap START to play</span>
          </div>
        </div>

        <!-- SOUND TAB -->
        <div class="lio-pane" id="lioPane-sound">
          <div class="lio-scroll">
            <div class="lio-label" style="margin-bottom:3px">Layers</div>
            <div class="lio-toggle-group four" id="lioLayerToggles">
              <label class="lio-toggle" id="ltDrums">
                <input type="checkbox" id="lioDrums"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Drums</span>
              </label>
              <label class="lio-toggle" id="ltBass">
                <input type="checkbox" id="lioBass"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Bass</span>
              </label>
              <label class="lio-toggle" id="ltMelody">
                <input type="checkbox" id="lioMelody"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Lead</span>
              </label>
              <label class="lio-toggle" id="ltFx">
                <input type="checkbox" id="lioFx"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">FX</span>
              </label>
            </div>

            <div class="lio-sep"></div>

            <div class="lio-slider-row">
              <div class="lio-slider-header">
                <span class="lio-slider-name">Bass Intensity</span>
                <span class="lio-slider-val" id="lioBassIntVal">70%</span>
              </div>
              <input type="range" id="lioBassInt" min="0" max="1" step="0.01">
            </div>
            <div class="lio-slider-row">
              <div class="lio-slider-header">
                <span class="lio-slider-name">Melody Density</span>
                <span class="lio-slider-val" id="lioMelDensVal">50%</span>
              </div>
              <input type="range" id="lioMelDens" min="0" max="1" step="0.01">
            </div>
            <div class="lio-slider-row">
              <div class="lio-slider-header">
                <span class="lio-slider-name">Filter Cutoff</span>
                <span class="lio-slider-val" id="lioFilterVal">50%</span>
              </div>
              <input type="range" id="lioFilter" min="0" max="1" step="0.01">
            </div>

            <div class="lio-sep"></div>
            <div class="lio-label" style="margin-bottom:3px">EQ</div>
            <div class="lio-eq">
              <div class="lio-eq-band">
                <input type="range" id="lioEqBass" min="0" max="1" step="0.01" orient="vertical">
                <span>Bass</span>
              </div>
              <div class="lio-eq-band">
                <input type="range" id="lioEqLow" min="0" max="1" step="0.01" orient="vertical">
                <span>Low</span>
              </div>
              <div class="lio-eq-band">
                <input type="range" id="lioEqMid" min="0" max="1" step="0.01" orient="vertical">
                <span>Mid</span>
              </div>
              <div class="lio-eq-band">
                <input type="range" id="lioEqHigh" min="0" max="1" step="0.01" orient="vertical">
                <span>High</span>
              </div>
              <div class="lio-eq-band">
                <input type="range" id="lioEqAir" min="0" max="1" step="0.01" orient="vertical">
                <span>Air</span>
              </div>
            </div>

            <div class="lio-sep"></div>
            <div class="lio-label" style="margin-bottom:3px">FX Chain</div>
            <div class="lio-toggle-group">
              <label class="lio-toggle" id="ltReverb">
                <input type="checkbox" id="lioReverb"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Reverb</span>
              </label>
              <label class="lio-toggle" id="ltViz">
                <input type="checkbox" id="lioViz"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Visualizer</span>
              </label>
            </div>
            <div class="lio-slider-row" style="margin-top:5px">
              <div class="lio-slider-header">
                <span class="lio-slider-name">Reverb Wet</span>
                <span class="lio-slider-val" id="lioRevVal">18%</span>
              </div>
              <input type="range" id="lioRevWet" min="0" max="1" step="0.01">
            </div>

            <div class="lio-sep"></div>
            <div class="lio-label" style="margin-bottom:3px">Arpeggiator / Chords</div>
            <div class="lio-toggle-group">
              <label class="lio-toggle" id="ltArp">
                <input type="checkbox" id="lioArp"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Arp On</span>
              </label>
              <label class="lio-toggle" id="ltChord">
                <input type="checkbox" id="lioChord"><div class="lio-toggle-dot"></div>
                <span class="lio-toggle-label">Chord On</span>
              </label>
            </div>
            <div class="lio-row" style="margin-top:5px">
              <div class="lio-labeled">
                <div class="lio-label">Arp Rate</div>
                <select id="lioArpRate">
                  <option value="1">1/16</option>
                  <option value="2">1/8</option>
                  <option value="4">1/4</option>
                  <option value="0.5">1/32</option>
                </select>
              </div>
              <div class="lio-labeled">
                <div class="lio-label">Voicing</div>
                <select id="lioVoicing">
                  <option value="triad">Triad</option>
                  <option value="seventh">7th</option>
                  <option value="sus2">Sus2</option>
                  <option value="sus4">Sus4</option>
                  <option value="power">Power</option>
                  <option value="shell">Shell</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- SEQUENCER TAB -->
        <div class="lio-pane" id="lioPane-seq">
          <div class="lio-label" style="margin-bottom:3px">Drum Pattern</div>
          <select id="lioPatternSel" style="margin-bottom:6px;width:100%"></select>

          <div class="lio-seq" id="lioSeqEdit">
            <div class="lio-seq-row" id="lioSeqKick">
              <span class="lio-seq-name">Kick</span>
            </div>
            <div class="lio-seq-row" id="lioSeqSnare">
              <span class="lio-seq-name">Snare</span>
            </div>
            <div class="lio-seq-row" id="lioSeqHat">
              <span class="lio-seq-name">HiHat</span>
            </div>
            <div class="lio-seq-row" id="lioSeqOhat">
              <span class="lio-seq-name">OHat</span>
            </div>
          </div>

          <div class="lio-row">
            <button id="lioSeqSaveBtn" class="lio-accent">💾 Save Pattern</button>
            <button id="lioSeqRandBtn">🎲 Randomize</button>
          </div>
          <div class="lio-slider-row" style="margin-top:8px">
            <div class="lio-slider-header">
              <span class="lio-slider-name">Swing</span>
              <span class="lio-slider-val" id="lioSwingVal">4%</span>
            </div>
            <input type="range" id="lioSwing" min="0" max="0.4" step="0.01">
          </div>
        </div>

        <!-- GENRES TAB -->
        <div class="lio-pane" id="lioPane-presets">
          <div class="lio-scroll" id="lioPresetCards"></div>
        </div>

        <!-- BUILD TAB -->
        <div class="lio-pane" id="lioPane-build">
          <div class="lio-scroll">
            <div style="font-size:9px;color:#7070a0;margin-bottom:6px">Create a custom genre / sound profile and save it.</div>
            <div class="lio-field">
              <label>Genre Name</label>
              <input type="text" id="cbName" placeholder="e.g. My Rave Banger">
            </div>
            <div class="lio-row">
              <div class="lio-field">
                <label>Root Note</label>
                <select id="cbRoot"></select>
              </div>
              <div class="lio-field">
                <label>Scale</label>
                <select id="cbScale"></select>
              </div>
            </div>
            <div class="lio-row">
              <div class="lio-field">
                <label>BPM</label>
                <input type="text" id="cbBpm" placeholder="120">
              </div>
              <div class="lio-field">
                <label>Swing (0–0.4)</label>
                <input type="text" id="cbSwing" placeholder="0.05">
              </div>
            </div>
            <div class="lio-row">
              <div class="lio-field">
                <label>Lead Wave</label>
                <select id="cbWave">
                  <option value="sine">Sine</option>
                  <option value="sawtooth">Sawtooth</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                </select>
              </div>
              <div class="lio-field">
                <label>Bass Wave</label>
                <select id="cbBassWave">
                  <option value="sine">Sine</option>
                  <option value="sawtooth">Sawtooth</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                </select>
              </div>
            </div>
            <div class="lio-field">
              <label>Chord Progression (0–7 degrees, comma-sep)</label>
              <input type="text" id="cbChords" placeholder="0,5,3,6">
            </div>
            <div class="lio-row">
              <div class="lio-field">
                <label>Drum Pattern</label>
                <select id="cbDrum"></select>
              </div>
              <div class="lio-field">
                <label>Genre Tag</label>
                <select id="cbGenre">
                  <option value="custom">Custom</option>
                  <option value="cyberpunk">Cyberpunk</option>
                  <option value="lofi">Lo-Fi</option>
                  <option value="electronic">Electronic</option>
                  <option value="ambient">Ambient</option>
                  <option value="synthwave">Synthwave</option>
                  <option value="jazz">Jazz</option>
                  <option value="trap">Trap</option>
                  <option value="blues">Blues</option>
                  <option value="citypop">City Pop</option>
                  <option value="metal">Metal</option>
                </select>
              </div>
            </div>
            <div class="lio-row">
              <div class="lio-field">
                <label>Reverb Wet (0–1)</label>
                <input type="text" id="cbReverb" placeholder="0.2">
              </div>
              <div class="lio-field">
                <label>Filter (0–1)</label>
                <input type="text" id="cbFilter" placeholder="0.5">
              </div>
            </div>
            <div class="lio-row">
              <div class="lio-field">
                <label>Bass Intensity</label>
                <input type="text" id="cbBassInt" placeholder="0.7">
              </div>
              <div class="lio-field">
                <label>Melody Density</label>
                <input type="text" id="cbMelDens" placeholder="0.5">
              </div>
            </div>
            <div class="lio-row">
              <button id="cbSaveBtn" class="lio-accent">💾 Save Genre</button>
              <button id="cbLoadCurrentBtn">⬆ Load Current</button>
            </div>
            <div id="cbStatus" style="font-size:9px;color:#7070a0;margin-top:4px;min-height:16px"></div>

            <div class="lio-sep"></div>
            <div class="lio-label" style="margin-bottom:3px">My Custom Genres</div>
            <div id="lioCustomGenreList"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // ─── DOM refs ────────────────────────────────────────────────────────────
    const handle       = panel.querySelector('.lio-handle');
    const dragBar      = panel.querySelector('#lioDragBar');
    const collapseBtn  = panel.querySelector('#lioCollapseBtn');
    const tabs         = panel.querySelectorAll('.lio-tab');
    const playBtn      = panel.querySelector('#lioPlayBtn');
    const panicBtn     = panel.querySelector('#lioPanicBtn');
    const presetSel    = panel.querySelector('#lioPresetSel');
    const bpmInput     = panel.querySelector('#lioBpm');
    const bpmVal       = panel.querySelector('#lioBpmVal');
    const energyInput  = panel.querySelector('#lioEnergy');
    const energyVal    = panel.querySelector('#lioEnergyVal');
    const volumeInput  = panel.querySelector('#lioVolume');
    const volVal       = panel.querySelector('#lioVolVal');
    const seedInput    = panel.querySelector('#lioSeed');
    const newSeedBtn   = panel.querySelector('#lioNewSeedBtn');
    const randomizeBtn = panel.querySelector('#lioRandomizeBtn');
    const statusEl     = panel.querySelector('#lioStatus');
    const statusDot    = panel.querySelector('#lioStatusDot');
    const topStatus    = panel.querySelector('#lioTopStatus');
    const canvas       = panel.querySelector('#lioCanvas');
    const vizWrap      = panel.querySelector('#lioVizWrap');
    const ctx2d        = canvas.getContext('2d');

    // Sound controls
    const drumsChk     = panel.querySelector('#lioDrums');
    const bassChk      = panel.querySelector('#lioBass');
    const melodyChk    = panel.querySelector('#lioMelody');
    const fxChk        = panel.querySelector('#lioFx');
    const reverbChk    = panel.querySelector('#lioReverb');
    const vizChk       = panel.querySelector('#lioViz');
    const bassIntInput = panel.querySelector('#lioBassInt');
    const bassIntVal   = panel.querySelector('#lioBassIntVal');
    const melDensInput = panel.querySelector('#lioMelDens');
    const melDensVal   = panel.querySelector('#lioMelDensVal');
    const filterInput  = panel.querySelector('#lioFilter');
    const filterVal    = panel.querySelector('#lioFilterVal');
    const revWetInput  = panel.querySelector('#lioRevWet');
    const revVal       = panel.querySelector('#lioRevVal');
    const arpChk       = panel.querySelector('#lioArp');
    const chordChk     = panel.querySelector('#lioChord');
    const arpRateSel   = panel.querySelector('#lioArpRate');
    const voicingSel   = panel.querySelector('#lioVoicing');
    const eqBassIn     = panel.querySelector('#lioEqBass');
    const eqLowIn      = panel.querySelector('#lioEqLow');
    const eqMidIn      = panel.querySelector('#lioEqMid');
    const eqHighIn     = panel.querySelector('#lioEqHigh');
    const eqAirIn      = panel.querySelector('#lioEqAir');

    // Sequencer
    const patternSel   = panel.querySelector('#lioPatternSel');
    const swingInput   = panel.querySelector('#lioSwing');
    const swingVal     = panel.querySelector('#lioSwingVal');
    const seqSaveBtn   = panel.querySelector('#lioSeqSaveBtn');
    const seqRandBtn   = panel.querySelector('#lioSeqRandBtn');

    // Builder
    const cbName       = panel.querySelector('#cbName');
    const cbRoot       = panel.querySelector('#cbRoot');
    const cbScale      = panel.querySelector('#cbScale');
    const cbBpm        = panel.querySelector('#cbBpm');
    const cbSwing      = panel.querySelector('#cbSwing');
    const cbWave       = panel.querySelector('#cbWave');
    const cbBassWave   = panel.querySelector('#cbBassWave');
    const cbChords     = panel.querySelector('#cbChords');
    const cbDrum       = panel.querySelector('#cbDrum');
    const cbGenre      = panel.querySelector('#cbGenre');
    const cbReverb     = panel.querySelector('#cbReverb');
    const cbFilter     = panel.querySelector('#cbFilter');
    const cbBassInt    = panel.querySelector('#cbBassInt');
    const cbMelDens    = panel.querySelector('#cbMelDens');
    const cbSaveBtn    = panel.querySelector('#cbSaveBtn');
    const cbLoadBtn    = panel.querySelector('#cbLoadCurrentBtn');
    const cbStatus     = panel.querySelector('#cbStatus');
    const customList   = panel.querySelector('#lioCustomGenreList');
    const presetCards  = panel.querySelector('#lioPresetCards');

    // Live custom pattern (copied from drumPatterns on load)
    let livePattern = JSON.parse(JSON.stringify(drumPatterns[state.drumPattern] || drumPatterns.standard));

    // ─── AUDIO ENGINE ────────────────────────────────────────────────────────
    let audioCtx = null, master = null, analyser = null, analyserData = null;
    let convolver = null, reverbWet = null, reverbDry = null;
    let eqFilters = []; // [bass, low, mid, high, air]
    let noiseBuffer = null;
    let isPlaying = false, timer = null, currentStep = 0, nextNoteTime = 0;
    let rng = mulberry32(hashString(state.seed + state.preset));
    let arpPhase = 0;

    function setStatus(txt) {
      statusEl.textContent = txt;
      topStatus.textContent = txt.slice(0, 22);
    }

    function secondsPerStep() {
      return (60 / clamp(Number(state.bpm) || 120, 40, 240)) / 4;
    }

    function makeNoiseBuffer() {
      const length = Math.floor(audioCtx.sampleRate * 2);
      const buf = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    // Impulse response for convolver reverb
    function makeImpulse(dur, decay) {
      const len = Math.floor(audioCtx.sampleRate * dur);
      const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    }

    function ensureAudio() {
      if (audioCtx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { setStatus('No Web Audio API, sorry!'); return; }

      audioCtx = new AC();

      // Master gain
      master = audioCtx.createGain();
      master.gain.value = 0.0001;

      // Analyser for visualizer
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      analyserData = new Uint8Array(analyser.frequencyBinCount);

      // 5-band EQ
      const eqFreqs = [80, 250, 1000, 4000, 12000];
      const eqTypes = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
      eqFilters = eqFreqs.map((freq, i) => {
        const f = audioCtx.createBiquadFilter();
        f.type = eqTypes[i];
        f.frequency.value = freq;
        f.gain.value = 0;
        f.Q.value = 1.2;
        return f;
      });

      // Chain EQ filters
      for (let i = 0; i < eqFilters.length - 1; i++) {
        eqFilters[i].connect(eqFilters[i + 1]);
      }

      // Compressor
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14;
      comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;

      // Delay/echo
      const delay = audioCtx.createDelay(1.0);
      delay.delayTime.value = 0.21;
      const feedGain = audioCtx.createGain();
      feedGain.gain.value = 0.18;
      const wetGain = audioCtx.createGain();
      wetGain.gain.value = state.fx ? 0.14 : 0.0;

      // Convolver reverb
      convolver = audioCtx.createConvolver();
      convolver.buffer = makeImpulse(2.4, 2.5);
      reverbWet = audioCtx.createGain();
      reverbWet.gain.value = state.reverb ? state.reverbWet : 0;
      reverbDry = audioCtx.createGain();
      reverbDry.gain.value = 1;

      // Routing: master → eq[0] → ... → eq[last] → reverb split → comp → analyser → dest
      master.connect(eqFilters[0]);
      const eqOut = eqFilters[eqFilters.length - 1];

      eqOut.connect(reverbDry);
      eqOut.connect(convolver);
      convolver.connect(reverbWet);

      reverbDry.connect(comp);
      reverbWet.connect(comp);

      // Echo side chain
      master.connect(delay);
      delay.connect(feedGain);
      feedGain.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(comp);

      comp.connect(analyser);
      analyser.connect(audioCtx.destination);

      noiseBuffer = makeNoiseBuffer();
      updateEq();
    }

    function updateEq() {
      if (!eqFilters.length) return;
      const vals = [
        (state.eqBass || 0.5) * 2 - 1,
        (state.eqLow  || 0.5) * 2 - 1,
        (state.eqMid  || 0.5) * 2 - 1,
        (state.eqHigh || 0.5) * 2 - 1,
        (state.eqAir  || 0.5) * 2 - 1,
      ];
      const now = audioCtx ? audioCtx.currentTime : 0;
      eqFilters.forEach((f, i) => {
        if (audioCtx) f.gain.setTargetAtTime(vals[i] * 12, now, 0.05);
      });
    }

    function updateAudio() {
      if (!audioCtx || !master) return;
      const now = audioCtx.currentTime;
      const vol = isPlaying ? clamp(state.volume, 0, 1) : 0.0001;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(vol, now, 0.03);
      if (reverbWet) reverbWet.gain.setTargetAtTime(state.reverb ? (state.reverbWet || 0.18) : 0, now, 0.05);
    }

    // ─── SYNTHESIS ───────────────────────────────────────────────────────────
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

      if (o.filter) {
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
      for (let i = 0; i < 3; i++) {
        playNoise({ time: time + i * 0.01, dur: 0.06, vol: 0.12 * power, filterType: 'bandpass', filter: 1200, q: 1.2 });
      }
    }

    function playChord(time, midiRoot, scaleArr, voicing, waveType, vol, dur, filterFreq) {
      const degrees = chordVoicings[voicing] || chordVoicings.triad;
      degrees.forEach((deg, idx) => {
        const note = midiRoot + (scaleArr[deg % scaleArr.length] || 0);
        playTone({
          time: time + idx * 0.012,
          freq: midiToFreq(note),
          dur,
          type: waveType,
          vol: vol * (0.6 - idx * 0.05),
          attack: 0.025, release: 0.1,
          filter: filterFreq, q: 0.7,
          detune: (Math.random() - 0.5) * 6
        });
      });
    }

    // ─── SCHEDULE STEP ───────────────────────────────────────────────────────
    function scheduleStep(step, rawTime) {
      const allPresets = getAllPresets();
      const preset = allPresets[state.preset] || builtinPresets.neonwar;
      const scale = scales[preset.scale] || scales.minor;
      const step16 = step % 16;
      const bar = Math.floor(step / 16);
      const stepDur = secondsPerStep();
      const swing = preset.swing !== undefined ? preset.swing : 0.06;
      const swingOffset = step16 % 2 === 1 ? stepDur * swing : 0;
      const time = rawTime + swingOffset;

      const chordIndex = (preset.chords || [0,5,3,6])[bar % (preset.chords || [0,5,3,6]).length] || 0;
      const chordOffset = scale[chordIndex % scale.length] || 0;
      const baseMidi = (preset.root || 45) + chordOffset;

      const energy = clamp(Number(state.energy) || 0, 0, 1);
      const bassInt = clamp(Number(state.bassIntensity !== undefined ? state.bassIntensity : preset.bassIntensity || 0.7), 0, 1);
      const melDens = clamp(Number(state.melodyDensity !== undefined ? state.melodyDensity : preset.melodyDensity || 0.5), 0, 1);
      const filterFreq = 200 + (clamp(Number(state.filterCutoff !== undefined ? state.filterCutoff : preset.filterCutoff || 0.5), 0, 1)) * 7000;
      const power = 0.6 + energy * 0.6;

      // ── Drums ──
      if (state.drums) {
        if (livePattern.kick[step16]) playKick(time, power);
        if (livePattern.snare[step16]) playSnare(time, power);
        if (livePattern.hat[step16]) playHat(time, power, false);
        if (livePattern.ohat[step16]) playHat(time, power, true);

        // Ghost snare on high energy
        if (energy > 0.75 && step16 % 4 === 2 && rng() < 0.3) {
          playSnare(time + stepDur * 0.5, power * 0.3);
        }
        // Clap layering
        if (energy > 0.6 && livePattern.snare[step16] && rng() < 0.4) {
          playClap(time, power * 0.4);
        }
      }

      // ── Bass ──
      if (state.bass) {
        const bassRate = bassInt > 0.7 ? [0,3,6,8,10,14] : bassInt > 0.4 ? [0,6,8,14] : [0, 8];
        if (bassRate.includes(step16)) {
          const bassScale = [0, 0, 2, 4];
          const bassNote = baseMidi - 12 + (scale[bassScale[Math.floor(rng() * bassScale.length)] % scale.length] || 0);
          const longNote = rng() < 0.28;
          playTone({
            time, freq: midiToFreq(bassNote),
            dur: stepDur * (longNote ? 1.8 : 0.9),
            type: preset.bassWave || 'square',
            vol: 0.14 + bassInt * 0.12 + energy * 0.06,
            attack: 0.008, release: 0.09,
            filter: filterFreq * 0.6, filterEnd: filterFreq * 0.3, q: 0.7
          });
        }
      }

      // ── Chord Layer ──
      if (state.melody && state.chordMode && step16 % 4 === 0 && rng() < 0.55 + energy * 0.25) {
        playChord(
          time, baseMidi + 12, scale,
          state.chordVoicing || 'triad',
          preset.wave || 'sawtooth',
          (0.04 + melDens * 0.05) * (0.5 + energy * 0.5),
          stepDur * (1.8 + rng() * 1.2),
          filterFreq
        );
      }

      // ── Arpeggiator ──
      if (state.melody && state.arpMode) {
        const arpSteps = chordVoicings[state.chordVoicing || 'triad'];
        const arpRate = Number(state.arpRate) || 2;
        if (step16 % arpRate === 0) {
          const deg = arpSteps[arpPhase % arpSteps.length];
          const arpMidi = baseMidi + 12 + (scale[deg % scale.length] || 0) + (rng() < 0.15 ? 12 : 0);
          playTone({
            time, freq: midiToFreq(arpMidi),
            dur: stepDur * (0.4 + rng() * 0.4),
            type: preset.wave || 'sawtooth',
            vol: 0.05 + melDens * 0.06 + energy * 0.04,
            attack: 0.008, release: 0.07,
            filter: filterFreq * 1.2, q: 1.1
          });
          arpPhase++;
        }
      }

      // ── Free Melody ──
      if (state.melody && !state.arpMode) {
        const chance = 0.08 + melDens * 0.55 + energy * 0.2;
        const allowed = energy > 0.7 || step16 % 2 === 0 || [3,7,11,15].includes(step16);
        if (allowed && rng() < chance) {
          const degPool = [0, 0, 1, 2, 3, 4, 5, 6];
          const deg = (chordIndex + degPool[Math.floor(rng() * degPool.length)]) % scale.length;
          const oct = rng() < 0.22 ? 12 : 0;
          const melMidi = (preset.root || 45) + 24 + (scale[deg] || 0) + oct;
          playTone({
            time, freq: midiToFreq(melMidi),
            dur: stepDur * (0.4 + rng() * 1.2),
            type: preset.wave || 'sine',
            vol: 0.045 + melDens * 0.07 + energy * 0.05,
            attack: 0.014, release: 0.1,
            filter: filterFreq * 1.5, filterEnd: filterFreq * 0.8, q: 0.9
          });
        }
      }

      // ── Ambient Pad on bar start ──
      if (state.melody && state.reverb && step16 === 0 && rng() < 0.3 + melDens * 0.4) {
        const padMidi = baseMidi + 12 + (scale[chordIndex % scale.length] || 0);
        playTone({
          time, freq: midiToFreq(padMidi),
          dur: stepDur * 14,
          type: 'sine',
          vol: 0.018 + melDens * 0.02,
          attack: 0.3, release: 0.8,
          filter: 1800, q: 0.5
        });
      }

      if (step16 === 0) {
        const allP = getAllPresets();
        setStatus(`${(allP[state.preset] || {}).name || 'Unknown'} | Bar ${bar+1} | ${state.seed}`);
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

    async function startMusic() {
      ensureAudio();
      if (!audioCtx) return;
      try {
        if (audioCtx.state === 'suspended') await audioCtx.resume();
      } catch {
        setStatus('Tap START again to unlock audio.'); return;
      }
      rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio2`));
      arpPhase = 0; currentStep = 0;
      nextNoteTime = audioCtx.currentTime + 0.06;
      isPlaying = true;
      updateAudio();
      if (timer) clearInterval(timer);
      timer = setInterval(scheduler, 22);
      playBtn.textContent = '⏹ STOP';
      playBtn.classList.add('playing');
      statusDot.classList.add('playing');
      setStatus(`Playing: ${getAllPresets()[state.preset]?.name || 'Unknown'}`);
    }

    function stopMusic() {
      isPlaying = false;
      if (timer) { clearInterval(timer); timer = null; }
      updateAudio();
      playBtn.textContent = '▶ START';
      playBtn.classList.remove('playing');
      statusDot.classList.remove('playing');
      setStatus('Stopped.');
    }

    function panicStop() {
      isPlaying = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (audioCtx && master) {
        const now = audioCtx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0.0001, now);
      }
      playBtn.textContent = '▶ START';
      playBtn.classList.remove('playing');
      statusDot.classList.remove('playing');
      setStatus('⛔ Panic stop!');
    }

    // ─── VISUALIZER ──────────────────────────────────────────────────────────
    let vizRaf = null;

    function resizeCanvas() {
      canvas.width = vizWrap.clientWidth * window.devicePixelRatio;
      canvas.height = 68 * window.devicePixelRatio;
    }

    function drawViz() {
      vizRaf = requestAnimationFrame(drawViz);
      resizeCanvas();
      const W = canvas.width, H = canvas.height;
      ctx2d.clearRect(0, 0, W, H);

      if (!state.visualizer) {
        ctx2d.fillStyle = 'rgba(20,20,40,0.5)';
        ctx2d.fillRect(0, 0, W, H);
        ctx2d.fillStyle = 'rgba(120,80,200,0.3)';
        ctx2d.font = `${10 * window.devicePixelRatio}px system-ui`;
        ctx2d.textAlign = 'center';
        ctx2d.fillText('Visualizer off', W / 2, H / 2 + 4 * window.devicePixelRatio);
        return;
      }

      if (!analyser || !isPlaying) {
        // Idle animation
        const t = Date.now() / 1000;
        for (let i = 0; i < W; i++) {
          const y = H / 2 + Math.sin(i / W * Math.PI * 3 + t * 1.5) * H * 0.12;
          ctx2d.fillStyle = `hsla(${260 + i / W * 80}, 70%, 55%, 0.25)`;
          ctx2d.fillRect(i, y, 1, H - y);
        }
        return;
      }

      analyser.getByteFrequencyData(analyserData);
      const bins = analyserData.length;
      const barW = W / bins;

      for (let i = 0; i < bins; i++) {
        const v = analyserData[i] / 255;
        const h = v * H;
        const hue = 280 - v * 120;
        const sat = 70 + v * 30;
        const lit = 40 + v * 30;
        ctx2d.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.7 + v * 0.3})`;
        ctx2d.fillRect(i * barW, H - h, barW - 1, h);

        // Glow top
        ctx2d.fillStyle = `hsla(${hue + 30}, 100%, 80%, ${v * 0.5})`;
        ctx2d.fillRect(i * barW, H - h - 2, barW - 1, 3);
      }

      // Waveform overlay
      analyser.getByteTimeDomainData(analyserData);
      ctx2d.beginPath();
      ctx2d.strokeStyle = 'rgba(255,200,255,0.35)';
      ctx2d.lineWidth = 1.5 * window.devicePixelRatio;
      for (let i = 0; i < bins; i++) {
        const x = i / bins * W;
        const y = ((analyserData[i] / 128) - 1) * H * 0.38 + H / 2;
        i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();
    }

    drawViz();

    // ─── SEQUENCER UI ────────────────────────────────────────────────────────
    function buildSeqRows() {
      ['kick','snare','hat','ohat'].forEach(type => {
        const row = panel.querySelector(`#lioSeq${type.charAt(0).toUpperCase() + type.slice(1)}`);
        // Remove old cells (keep the name span)
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

    function highlightSeqStep(step16) {
      panel.querySelectorAll('.lio-seq-cell').forEach((c, i) => {
        const cellStep = i % 16;
        c.classList.toggle('active-step', cellStep === step16);
      });
    }

    setInterval(() => {
      if (isPlaying) highlightSeqStep(currentStep % 16);
    }, 40);

    // Pattern select
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
      state.drumPattern = '_custom';
      // We store the custom live pattern in the state
      state._customPattern = JSON.parse(JSON.stringify(livePattern));
      saveState();
      setStatus('Custom drum pattern saved!');
    });

    seqRandBtn.addEventListener('click', () => {
      ['kick','snare','hat','ohat'].forEach(type => {
        for (let i = 0; i < 16; i++) {
          const chances = { kick: 0.2, snare: 0.15, hat: 0.5, ohat: 0.08 };
          livePattern[type][i] = Math.random() < chances[type] ? 1 : 0;
        }
      });
      buildSeqRows();
    });

    buildSeqRows();

    // ─── PRESET CARDS ────────────────────────────────────────────────────────
    function buildPresetCards() {
      presetCards.innerHTML = '';
      const all = getAllPresets();
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
          <div class="lio-preset-card-bpm">${p.bpm || '?'}BPM</div>
          ${isCustom ? '<div class="lio-preset-badge">Custom</div>' : `<div class="lio-preset-badge">${p.genre || ''}</div>`}
        `;
        card.addEventListener('click', () => {
          applyPreset(key);
          buildPresetCards();
        });
        presetCards.appendChild(card);
      });
    }

    // ─── APPLY PRESET ────────────────────────────────────────────────────────
    function applyPreset(key) {
      const all = getAllPresets();
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

      livePattern = JSON.parse(JSON.stringify(drumPatterns[state.drumPattern] || drumPatterns.standard));

      presetSel.value = key;
      bpmInput.value = state.bpm; bpmVal.textContent = state.bpm;
      revWetInput.value = state.reverbWet; revVal.textContent = Math.round(state.reverbWet * 100) + '%';
      filterInput.value = state.filterCutoff; filterVal.textContent = Math.round(state.filterCutoff * 100) + '%';
      bassIntInput.value = state.bassIntensity; bassIntVal.textContent = Math.round(state.bassIntensity * 100) + '%';
      melDensInput.value = state.melodyDensity; melDensVal.textContent = Math.round(state.melodyDensity * 100) + '%';
      patternSel.value = state.drumPattern;
      updateToggle('ltArp', arpChk, state.arpMode);
      updateToggle('ltChord', chordChk, state.chordMode);
      buildSeqRows();

      if (isPlaying && audioCtx) {
        rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio2`));
        currentStep = 0; nextNoteTime = audioCtx.currentTime + 0.05;
      }
      saveState();
      setStatus(`Loaded: ${p.name}`);
    }

    // ─── POPULATE DROPDOWNS ──────────────────────────────────────────────────
    function buildPresetSel() {
      presetSel.innerHTML = '';
      const all = getAllPresets();
      Object.entries(all).forEach(([key, p]) => {
        const opt = document.createElement('option');
        opt.value = key; opt.textContent = p.name;
        presetSel.appendChild(opt);
      });
      presetSel.value = state.preset;
    }

    // Root note names
    const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for (let midi = 36; midi <= 72; midi++) {
      const opt = document.createElement('option');
      const oct = Math.floor(midi / 12) - 1;
      opt.value = midi; opt.textContent = `${noteNames[midi % 12]}${oct} (${midi})`;
      cbRoot.appendChild(opt);
    }
    cbRoot.value = 45;

    Object.entries(scaleNames).forEach(([key, name]) => {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = name;
      cbScale.appendChild(opt);
    });
    cbScale.value = 'minor';

    Object.keys(drumPatterns).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      cbDrum.appendChild(opt);
    });

    // ─── TOGGLE HELPER ────────────────────────────────────────────────────────
    function updateToggle(labelId, checkbox, val) {
      checkbox.checked = !!val;
      const lbl = panel.querySelector('#' + labelId);
      if (lbl) lbl.classList.toggle('on', !!val);
    }

    function bindToggle(labelId, checkboxId, stateKey, callback) {
      const lbl = panel.querySelector('#' + labelId);
      const chk = panel.querySelector('#' + checkboxId);
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

    // ─── RENDER ALL VALUES ────────────────────────────────────────────────────
    function renderAll() {
      bpmInput.value = state.bpm; bpmVal.textContent = state.bpm;
      energyInput.value = state.energy; energyVal.textContent = Math.round(state.energy * 100) + '%';
      volumeInput.value = state.volume; volVal.textContent = Math.round(state.volume * 100) + '%';
      seedInput.value = state.seed;
      revWetInput.value = state.reverbWet || 0.18; revVal.textContent = Math.round((state.reverbWet || 0.18) * 100) + '%';
      filterInput.value = state.filterCutoff || 0.5; filterVal.textContent = Math.round((state.filterCutoff || 0.5) * 100) + '%';
      bassIntInput.value = state.bassIntensity || 0.7; bassIntVal.textContent = Math.round((state.bassIntensity || 0.7) * 100) + '%';
      melDensInput.value = state.melodyDensity || 0.5; melDensVal.textContent = Math.round((state.melodyDensity || 0.5) * 100) + '%';

      const swingVal2 = getAllPresets()[state.preset]?.swing || 0.06;
      swingInput.value = swingVal2; swingVal.textContent = Math.round(swingVal2 * 100) + '%';

      eqBassIn.value = state.eqBass || 0.5;
      eqLowIn.value  = state.eqLow  || 0.5;
      eqMidIn.value  = state.eqMid  || 0.5;
      eqHighIn.value = state.eqHigh || 0.5;
      eqAirIn.value  = state.eqAir  || 0.5;

      arpRateSel.value = String(state.arpRate || 2);
      voicingSel.value = state.chordVoicing || 'triad';

      updateToggle('ltDrums', drumsChk, state.drums);
      updateToggle('ltBass', bassChk, state.bass);
      updateToggle('ltMelody', melodyChk, state.melody);
      updateToggle('ltFx', fxChk, state.fx);
      updateToggle('ltReverb', reverbChk, state.reverb);
      updateToggle('ltViz', vizChk, state.visualizer);
      updateToggle('ltArp', arpChk, state.arpMode);
      updateToggle('ltChord', chordChk, state.chordMode);
    }

    // ─── TAB SWITCHING ───────────────────────────────────────────────────────
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.lio-pane').forEach(p2 => p2.classList.remove('active'));
        tab.classList.add('active');
        const pane = panel.querySelector(`#lioPane-${tab.dataset.tab}`);
        if (pane) pane.classList.add('active');
        state.activeTab = tab.dataset.tab;
        if (tab.dataset.tab === 'presets') buildPresetCards();
        if (tab.dataset.tab === 'build') buildCustomList();
      });
    });

    // ─── DRAG ────────────────────────────────────────────────────────────────
    let drag = null;
    [dragBar, handle].forEach(el => {
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('button,input,select')) return;
        state.collapsed = false; panel.classList.remove('lio-collapsed');
        drag = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
        el.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      el.addEventListener('pointermove', e => {
        if (!drag) return;
        state.x = clamp(e.clientX - drag.dx, 6, Math.max(6, innerWidth - panel.offsetWidth - 6));
        state.y = clamp(e.clientY - drag.dy, 6, Math.max(6, innerHeight - panel.offsetHeight - 6));
        panel.style.left = state.x + 'px'; panel.style.top = state.y + 'px';
      });
      el.addEventListener('pointerup', () => { if (drag) { drag = null; saveState(); } });
      el.addEventListener('pointercancel', () => { drag = null; });
    });

    handle.addEventListener('click', () => {
      if (drag) return;
      state.collapsed = !state.collapsed;
      panel.classList.toggle('lio-collapsed', state.collapsed);
      saveState();
    });
    collapseBtn.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      panel.classList.toggle('lio-collapsed', state.collapsed);
      saveState();
    });

    // ─── PLAY CONTROLS ────────────────────────────────────────────────────────
    playBtn.addEventListener('click', () => { isPlaying ? stopMusic() : startMusic(); });
    panicBtn.addEventListener('click', panicStop);

    presetSel.addEventListener('change', () => { applyPreset(presetSel.value); });

    bpmInput.addEventListener('input', () => {
      state.bpm = Number(bpmInput.value);
      bpmVal.textContent = state.bpm; saveState();
    });
    energyInput.addEventListener('input', () => {
      state.energy = Number(energyInput.value);
      energyVal.textContent = Math.round(state.energy * 100) + '%'; saveState();
    });
    volumeInput.addEventListener('input', () => {
      state.volume = Number(volumeInput.value);
      volVal.textContent = Math.round(state.volume * 100) + '%';
      updateAudio(); saveState();
    });
    seedInput.addEventListener('change', () => {
      state.seed = seedInput.value.trim() || 'torn-war-777';
      seedInput.value = state.seed;
      if (isPlaying && audioCtx) {
        rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio2`));
        currentStep = 0; nextNoteTime = audioCtx.currentTime + 0.05;
      }
      saveState(); setStatus(`Seed: ${state.seed}`);
    });

    newSeedBtn.addEventListener('click', () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = 'torn-'; for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
      state.seed = s; seedInput.value = s;
      if (isPlaying && audioCtx) {
        rng = mulberry32(hashString(`${state.seed}|${state.preset}|lio2`));
        currentStep = 0; nextNoteTime = audioCtx.currentTime + 0.05;
      }
      saveState(); setStatus(`New seed: ${state.seed}`);
    });

    randomizeBtn.addEventListener('click', () => {
      const keys = Object.keys(getAllPresets());
      const key = keys[Math.floor(Math.random() * keys.length)];
      applyPreset(key);
      state.energy = Number((0.3 + Math.random() * 0.65).toFixed(2));
      energyInput.value = state.energy;
      energyVal.textContent = Math.round(state.energy * 100) + '%';
      newSeedBtn.click();
      saveState(); setStatus(`Randomized! ${getAllPresets()[key]?.name}`);
    });

    // ─── SOUND TAB BINDINGS ──────────────────────────────────────────────────
    bindToggle('ltDrums', 'lioDrums', 'drums');
    bindToggle('ltBass', 'lioBass', 'bass');
    bindToggle('ltMelody', 'lioMelody', 'melody');
    bindToggle('ltFx', 'lioFx', 'fx', (v) => {
      if (audioCtx) updateAudio();
    });
    bindToggle('ltReverb', 'lioReverb', 'reverb', () => updateAudio());
    bindToggle('ltViz', 'lioViz', 'visualizer');
    bindToggle('ltArp', 'lioArp', 'arpMode');
    bindToggle('ltChord', 'lioChord', 'chordMode');

    revWetInput.addEventListener('input', () => {
      state.reverbWet = Number(revWetInput.value);
      revVal.textContent = Math.round(state.reverbWet * 100) + '%';
      updateAudio(); saveState();
    });
    filterInput.addEventListener('input', () => {
      state.filterCutoff = Number(filterInput.value);
      filterVal.textContent = Math.round(state.filterCutoff * 100) + '%'; saveState();
    });
    bassIntInput.addEventListener('input', () => {
      state.bassIntensity = Number(bassIntInput.value);
      bassIntVal.textContent = Math.round(state.bassIntensity * 100) + '%'; saveState();
    });
    melDensInput.addEventListener('input', () => {
      state.melodyDensity = Number(melDensInput.value);
      melDensVal.textContent = Math.round(state.melodyDensity * 100) + '%'; saveState();
    });

    // EQ
    [
      [eqBassIn, 'eqBass'],
      [eqLowIn,  'eqLow'],
      [eqMidIn,  'eqMid'],
      [eqHighIn, 'eqHigh'],
      [eqAirIn,  'eqAir'],
    ].forEach(([el, key]) => {
      el.addEventListener('input', () => {
        state[key] = Number(el.value);
        updateEq(); saveState();
      });
    });

    arpRateSel.addEventListener('change', () => { state.arpRate = Number(arpRateSel.value); saveState(); });
    voicingSel.addEventListener('change', () => { state.chordVoicing = voicingSel.value; saveState(); });

    swingInput.addEventListener('input', () => {
      // Live swing per-step override
      const preset = getAllPresets()[state.preset];
      if (preset) preset.swing = Number(swingInput.value);
      swingVal.textContent = Math.round(Number(swingInput.value) * 100) + '%';
    });

    // ─── CUSTOM GENRE BUILDER ────────────────────────────────────────────────
    cbLoadBtn.addEventListener('click', () => {
      const p = getAllPresets()[state.preset];
      if (!p) return;
      cbName.value = p.name + ' Copy';
      cbRoot.value = p.root || 45;
      cbScale.value = p.scale || 'minor';
      cbBpm.value = p.bpm || 120;
      cbSwing.value = p.swing || 0.05;
      cbWave.value = p.wave || 'sawtooth';
      cbBassWave.value = p.bassWave || 'sine';
      cbChords.value = (p.chords || [0,5,3,6]).join(',');
      cbDrum.value = p.drumPattern || 'standard';
      cbGenre.value = p.genre || 'custom';
      cbReverb.value = p.reverbWet || 0.2;
      cbFilter.value = p.filterCutoff || 0.5;
      cbBassInt.value = p.bassIntensity || 0.7;
      cbMelDens.value = p.melodyDensity || 0.5;
      cbStatus.textContent = 'Loaded from: ' + p.name;
    });

    cbSaveBtn.addEventListener('click', () => {
      const name = cbName.value.trim();
      if (!name) { cbStatus.textContent = '⚠ Enter a name!'; return; }
      const chordsRaw = cbChords.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (!chordsRaw.length) { cbStatus.textContent = '⚠ Enter chord degrees!'; return; }
      const key = name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,24);
      const genre = {
        name, genre: cbGenre.value,
        root: Number(cbRoot.value) || 45,
        scale: cbScale.value,
        bpm: clamp(Number(cbBpm.value) || 120, 40, 240),
        swing: clamp(Number(cbSwing.value) || 0.05, 0, 0.4),
        wave: cbWave.value, bassWave: cbBassWave.value,
        chords: chordsRaw,
        drumPattern: cbDrum.value,
        reverbWet: clamp(Number(cbReverb.value) || 0.2, 0, 1),
        filterCutoff: clamp(Number(cbFilter.value) || 0.5, 0, 1),
        bassIntensity: clamp(Number(cbBassInt.value) || 0.7, 0, 1),
        melodyDensity: clamp(Number(cbMelDens.value) || 0.5, 0, 1),
        arpMode: false, chordMode: true,
      };
      if (!state.customGenres) state.customGenres = {};
      state.customGenres[key] = genre;
      saveState();
      buildPresetSel(); buildCustomList();
      cbStatus.textContent = `✓ Saved: ${name}`;
      setStatus(`Custom genre saved: ${name}`);
    });

    function buildCustomList() {
      customList.innerHTML = '';
      const customs = state.customGenres || {};
      if (!Object.keys(customs).length) {
        customList.innerHTML = '<div style="font-size:9px;color:#5050808;padding:4px">No custom genres yet.</div>';
        return;
      }
      Object.entries(customs).forEach(([key, p]) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px;padding:5px 7px;background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.07)';
        row.innerHTML = `
          <span style="font-size:16px">${genreIcon(p.genre)}</span>
          <span style="flex:1;font-size:10px;color:#c0c0e0;font-weight:700">${p.name}</span>
          <span style="font-size:9px;color:#8080a0">${p.bpm}BPM</span>
        `;
        const useBtn = document.createElement('button');
        useBtn.textContent = 'Use'; useBtn.style.cssText = 'padding:3px 7px;font-size:9px;min-width:0';
        useBtn.addEventListener('click', () => { applyPreset('custom_' + key); buildPresetSel(); });
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕'; delBtn.style.cssText = 'padding:3px 7px;font-size:9px;min-width:0;color:#ff8080;border-color:rgba(255,80,80,0.3)';
        delBtn.addEventListener('click', () => {
          if (!confirm(`Delete "${p.name}"?`)) return;
          delete state.customGenres[key];
          saveState(); buildCustomList(); buildPresetSel();
        });
        row.appendChild(useBtn); row.appendChild(delBtn);
        customList.appendChild(row);
      });
    }

    // ─── PLACE PANEL ─────────────────────────────────────────────────────────
    function placePanel() {
      const W = panel.offsetWidth || 360, H2 = panel.offsetHeight || 500;
      if (state.x === null) state.x = innerWidth - W - 10;
      if (state.y === null) state.y = innerHeight - H2 - 80;
      state.x = clamp(state.x, 6, Math.max(6, innerWidth - W - 6));
      state.y = clamp(state.y, 6, Math.max(6, innerHeight - H2 - 6));
      panel.style.left = state.x + 'px'; panel.style.top = state.y + 'px';
      saveState();
    }

    // ─── INIT ────────────────────────────────────────────────────────────────
    buildPresetSel();
    renderAll();
    buildCustomList();
    setTimeout(placePanel, 60);
    window.addEventListener('resize', placePanel);

    // Handle custom pattern on load
    if (state._customPattern && state.drumPattern === '_custom') {
      livePattern = JSON.parse(JSON.stringify(state._customPattern));
      buildSeqRows();
    }

    setStatus('Tap ▶ START to play · v2.0');
  });
})();
