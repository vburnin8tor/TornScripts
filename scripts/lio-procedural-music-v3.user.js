// ==UserScript==
// @name         Lio Procedural Music Synth v3 — Torn PDA
// @namespace    qian751.torn.procedural.music.v3
// @version      3.0.0
// @description  Procedural music synth — themes, miniplayer, song mode (LFO modulation), visualizer, custom genres, step sequencer.
// @author       Qian751
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID  = 'lio-synth-v3';
  const MINI_ID   = 'lio-synth-v3-mini';
  const STYLE_ID  = 'lio-synth-v3-style';
  const STORE_KEY = 'lioSynthV3';

  if (window.__lioSynthV3) return;
  window.__lioSynthV3 = true;

  // ── SCALES ──────────────────────────────────────────────────────────────────
  const SCALES = {
    minor:      [0,2,3,5,7,8,10,12],
    major:      [0,2,4,5,7,9,11,12],
    dark:       [0,1,3,5,7,8,10,12],
    pentatonic: [0,3,5,7,10,12,15,17],
    dorian:     [0,2,3,5,7,9,10,12],
    phrygian:   [0,1,3,5,7,8,10,12],
    lydian:     [0,2,4,6,7,9,11,12],
    mixolydian: [0,2,4,5,7,9,10,12],
    blues:      [0,3,5,6,7,10,12,15],
    wholetone:  [0,2,4,6,8,10,12,14],
    japanese:   [0,1,5,7,8,12,13,17],
  };
  const SCALE_NAMES = {
    minor:'Minor', major:'Major', dark:'Dark', pentatonic:'Pentatonic',
    dorian:'Dorian', phrygian:'Phrygian', lydian:'Lydian',
    mixolydian:'Mixolydian', blues:'Blues', wholetone:'Whole Tone', japanese:'Japanese'
  };

  // ── BUILT-IN PRESETS ────────────────────────────────────────────────────────
  const PRESETS = {
    neonwar:     { name:'Neon War Chain',      root:45, scale:'minor',      wave:'sawtooth', bassWave:'square',   bpm:124, swing:0.04, chords:[0,5,3,6], rev:0.18, filter:0.5,  arp:false, chord:true,  drum:'standard', bassInt:0.7, melDens:0.5, genre:'cyberpunk' },
    island:      { name:'Private Island Chill',root:48, scale:'major',      wave:'triangle', bassWave:'sine',     bpm:88,  swing:0.08, chords:[0,4,5,3], rev:0.3,  filter:0.65, arp:false, chord:false, drum:'half',     bassInt:0.5, melDens:0.4, genre:'lofi' },
    bazaar:      { name:'Bazaar Panic',         root:42, scale:'dark',       wave:'square',   bassWave:'sawtooth', bpm:138, swing:0.02, chords:[0,2,5,1], rev:0.1,  filter:0.55, arp:true,  chord:false, drum:'standard', bassInt:0.8, melDens:0.6, genre:'electronic' },
    stealth:     { name:'Stealth Hospital Run', root:43, scale:'dark',       wave:'sine',     bassWave:'triangle', bpm:104, swing:0.12, chords:[0,1,3,2], rev:0.45, filter:0.35, arp:false, chord:false, drum:'sparse',   bassInt:0.4, melDens:0.25,genre:'ambient' },
    lofi_beats:  { name:'Lo-Fi Study Hall',     root:50, scale:'dorian',     wave:'triangle', bassWave:'sine',     bpm:75,  swing:0.14, chords:[0,3,4,5], rev:0.38, filter:0.45, arp:false, chord:true,  drum:'lofi',     bassInt:0.45,melDens:0.3, genre:'lofi' },
    synthwave:   { name:'Retrowave Highway',    root:45, scale:'minor',      wave:'sawtooth', bassWave:'sawtooth', bpm:116, swing:0.0,  chords:[0,5,3,7], rev:0.25, filter:0.7,  arp:true,  chord:true,  drum:'disco',    bassInt:0.75,melDens:0.55,genre:'synthwave' },
    jazz:        { name:'Back Alley Jazz',      root:53, scale:'dorian',     wave:'sine',     bassWave:'triangle', bpm:95,  swing:0.2,  chords:[0,2,4,1], rev:0.35, filter:0.55, arp:false, chord:true,  drum:'jazz',     bassInt:0.55,melDens:0.65,genre:'jazz' },
    trap:        { name:'Faction Trap Drop',    root:41, scale:'minor',      wave:'sawtooth', bassWave:'sine',     bpm:140, swing:0.0,  chords:[0,0,5,3], rev:0.15, filter:0.6,  arp:false, chord:false, drum:'trap',     bassInt:0.9, melDens:0.2, genre:'trap' },
    ambient:     { name:'Offshore Drone',       root:48, scale:'lydian',     wave:'sine',     bassWave:'sine',     bpm:60,  swing:0.0,  chords:[0,4,2,6], rev:0.65, filter:0.3,  arp:false, chord:true,  drum:'none',     bassInt:0.25,melDens:0.2, genre:'ambient' },
    blues_rock:  { name:'Torn Street Blues',    root:45, scale:'blues',      wave:'sawtooth', bassWave:'square',   bpm:100, swing:0.1,  chords:[0,3,0,4], rev:0.2,  filter:0.65, arp:false, chord:false, drum:'rock',     bassInt:0.7, melDens:0.6, genre:'blues' },
    city_pop:    { name:'City Pop Nights',      root:52, scale:'japanese',   wave:'triangle', bassWave:'sine',     bpm:102, swing:0.06, chords:[0,4,2,5], rev:0.3,  filter:0.6,  arp:true,  chord:false, drum:'standard', bassInt:0.55,melDens:0.5, genre:'citypop' },
    dungeon:     { name:'Dungeon Raid',         root:40, scale:'phrygian',   wave:'square',   bassWave:'sawtooth', bpm:150, swing:0.0,  chords:[0,1,3,0], rev:0.12, filter:0.8,  arp:true,  chord:false, drum:'metal',    bassInt:0.85,melDens:0.45,genre:'metal' },
  };

  // ── DRUM PATTERNS ───────────────────────────────────────────────────────────
  const DRUM_PATTERNS = {
    standard: { kick:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], ohat:[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0] },
    lofi:     { kick:[1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0], hat:[1,0,1,1,0,1,1,0,1,1,0,1,0,1,0,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0] },
    trap:     { kick:[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], ohat:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] },
    jazz:     { kick:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], snare:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], hat:[1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0], ohat:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
    disco:    { kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], hat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], ohat:[0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1] },
    rock:     { kick:[1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0], hat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], ohat:[0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0] },
    metal:    { kick:[1,0,1,1,0,0,1,0,1,1,0,0,1,0,1,0], snare:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1], hat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    half:     { kick:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hat:[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    sparse:   { kick:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hat:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    none:     { kick:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], hat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], ohat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  };

  const CHORD_VOICINGS = {
    triad:[0,2,4], seventh:[0,2,4,6], sus2:[0,1,4], sus4:[0,3,4], power:[0,4], shell:[0,2,6]
  };

  const GENRE_ICONS = {
    cyberpunk:'🔮', lofi:'☕', electronic:'⚡', ambient:'🌊', synthwave:'🌆',
    jazz:'🎷', trap:'🔊', blues:'🎸', citypop:'🌸', metal:'💀', custom:'🎨', default:'🎵'
  };

  // ── THEMES ──────────────────────────────────────────────────────────────────
  const THEMES = {
    default: {
      name: 'Default',
      '--lio-bg':          'rgba(10,10,18,0.96)',
      '--lio-border':      'rgba(200,160,255,0.18)',
      '--lio-accent1':     '#ff60c0',
      '--lio-accent2':     '#a060ff',
      '--lio-accent3':     '#60a0ff',
      '--lio-handle-a':    '#ff3cb4',
      '--lio-handle-b':    '#8c3cff',
      '--lio-handle-c':    '#3c8cff',
      '--lio-text':        '#e0e0f0',
      '--lio-text-dim':    '#6868a0',
      '--lio-tab-active-bg': 'rgba(180,80,255,0.2)',
      '--lio-tab-active-border': 'rgba(180,80,255,0.5)',
      '--lio-tab-active-color': '#d090ff',
      '--lio-btn-play-bg': 'linear-gradient(135deg,rgba(255,60,180,0.3),rgba(100,60,255,0.3))',
      '--lio-slider-thumb':'linear-gradient(135deg,#ff60c0,#a060ff)',
      '--lio-toggle-on':   'rgba(180,80,255,0.7)',
      '--lio-val-color':   '#d090ff',
      '--lio-viz-bg':      '#050508',
      '--lio-mini-bg':     'rgba(10,10,22,0.97)',
    },
    matrix: {
      name: 'Matrix',
      '--lio-bg':          'rgba(0,8,0,0.97)',
      '--lio-border':      'rgba(0,255,60,0.2)',
      '--lio-accent1':     '#00ff41',
      '--lio-accent2':     '#00cc33',
      '--lio-accent3':     '#00ff80',
      '--lio-handle-a':    '#003300',
      '--lio-handle-b':    '#005500',
      '--lio-handle-c':    '#00aa22',
      '--lio-text':        '#a0ffb0',
      '--lio-text-dim':    '#2a7a3a',
      '--lio-tab-active-bg': 'rgba(0,255,60,0.12)',
      '--lio-tab-active-border': 'rgba(0,255,60,0.5)',
      '--lio-tab-active-color': '#00ff60',
      '--lio-btn-play-bg': 'linear-gradient(135deg,rgba(0,180,40,0.3),rgba(0,80,20,0.4))',
      '--lio-slider-thumb':'linear-gradient(135deg,#00ff41,#00aa22)',
      '--lio-toggle-on':   'rgba(0,200,60,0.8)',
      '--lio-val-color':   '#00ff80',
      '--lio-viz-bg':      '#000800',
      '--lio-mini-bg':     'rgba(0,6,0,0.98)',
    },
    oldschool: {
      name: 'Oldschool',
      '--lio-bg':          'rgba(12,8,0,0.97)',
      '--lio-border':      'rgba(255,160,0,0.22)',
      '--lio-accent1':     '#ffaa00',
      '--lio-accent2':     '#ff8800',
      '--lio-accent3':     '#ffcc44',
      '--lio-handle-a':    '#3a2000',
      '--lio-handle-b':    '#5a3000',
      '--lio-handle-c':    '#aa6000',
      '--lio-text':        '#ffe0a0',
      '--lio-text-dim':    '#7a5020',
      '--lio-tab-active-bg': 'rgba(255,160,0,0.15)',
      '--lio-tab-active-border': 'rgba(255,160,0,0.5)',
      '--lio-tab-active-color': '#ffcc44',
      '--lio-btn-play-bg': 'linear-gradient(135deg,rgba(255,140,0,0.3),rgba(180,80,0,0.35))',
      '--lio-slider-thumb':'linear-gradient(135deg,#ffaa00,#ff6600)',
      '--lio-toggle-on':   'rgba(220,140,0,0.8)',
      '--lio-val-color':   '#ffcc44',
      '--lio-viz-bg':      '#0a0500',
      '--lio-mini-bg':     'rgba(10,6,0,0.98)',
    },
    torn: {
      name: 'Torn',
      '--lio-bg':          'rgba(14,4,4,0.97)',
      '--lio-border':      'rgba(200,40,40,0.2)',
      '--lio-accent1':     '#cc2222',
      '--lio-accent2':     '#ee4444',
      '--lio-accent3':     '#ff8888',
      '--lio-handle-a':    '#3a0000',
      '--lio-handle-b':    '#660000',
      '--lio-handle-c':    '#990000',
      '--lio-text':        '#f0d0d0',
      '--lio-text-dim':    '#7a3030',
      '--lio-tab-active-bg': 'rgba(200,40,40,0.18)',
      '--lio-tab-active-border': 'rgba(200,40,40,0.55)',
      '--lio-tab-active-color': '#ff8888',
      '--lio-btn-play-bg': 'linear-gradient(135deg,rgba(200,30,30,0.35),rgba(120,10,10,0.4))',
      '--lio-slider-thumb':'linear-gradient(135deg,#ee4444,#aa0000)',
      '--lio-toggle-on':   'rgba(200,40,40,0.8)',
      '--lio-val-color':   '#ff9090',
      '--lio-viz-bg':      '#0a0000',
      '--lio-mini-bg':     'rgba(12,2,2,0.98)',
    },
    ice: {
      name: 'Ice',
      '--lio-bg':          'rgba(4,12,22,0.97)',
      '--lio-border':      'rgba(80,200,255,0.2)',
      '--lio-accent1':     '#40d0ff',
      '--lio-accent2':     '#60a0ff',
      '--lio-accent3':     '#a0f0ff',
      '--lio-handle-a':    '#001830',
      '--lio-handle-b':    '#003060',
      '--lio-handle-c':    '#005090',
      '--lio-text':        '#c0e8ff',
      '--lio-text-dim':    '#306080',
      '--lio-tab-active-bg': 'rgba(60,180,255,0.14)',
      '--lio-tab-active-border': 'rgba(60,180,255,0.5)',
      '--lio-tab-active-color': '#80d8ff',
      '--lio-btn-play-bg': 'linear-gradient(135deg,rgba(40,160,255,0.3),rgba(20,80,200,0.35))',
      '--lio-slider-thumb':'linear-gradient(135deg,#40d0ff,#2060cc)',
      '--lio-toggle-on':   'rgba(40,160,255,0.8)',
      '--lio-val-color':   '#80d8ff',
      '--lio-viz-bg':      '#020810',
      '--lio-mini-bg':     'rgba(2,8,18,0.98)',
    },
    custom: {
      name: 'Custom',
      // filled dynamically from state.customTheme
    }
  };

  // ── DEFAULT STATE ────────────────────────────────────────────────────────────
  const DEF = {
    collapsed:false, x:null, y:null,
    preset:'neonwar', bpm:124, energy:0.62, volume:0.34, seed:'torn-war-777',
    drums:true, bass:true, melody:true, fx:true, reverb:true,
    reverbWet:0.18, visualizer:true,
    arpMode:false, arpRate:2, chordMode:true, chordVoicing:'triad',
    filterCutoff:0.5,
    eqBass:0.5, eqLow:0.5, eqMid:0.5, eqHigh:0.5, eqAir:0.5,
    drumPattern:'standard', bassIntensity:0.7, melodyDensity:0.5,
    activeTab:'play',
    customGenres:{},
    theme:'default',
    customThemeAccent:'#9060ff',
    customThemeBg:'rgba(8,8,16,0.97)',
    // Song Mode
    songMode:false,
    songSpeed:30,      // seconds for a full LFO cycle
    songDepth:0.35,    // 0..1 how wide the modulation swings
    songTurbulence:0.2,// 0..1 amount of random jitter on top
  };

  function loadState() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
    catch { return Object.assign({}, DEF); }
  }
  const state = loadState();
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }

  function allPresets() {
    const c = {};
    Object.entries(state.customGenres||{}).forEach(([k,v]) => { c['custom_'+k] = v; });
    return Object.assign({}, PRESETS, c);
  }

  function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }
  function lerp(a,b,t) { return a + (b-a)*t; }
  function hashStr(s) {
    let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  function mulberry32(seed) {
    return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  }
  function midiToFreq(m) { return 440*Math.pow(2,(m-69)/12); }
  function iconForGenre(g) { return GENRE_ICONS[g]||GENRE_ICONS.default; }

  // ── CSS ─────────────────────────────────────────────────────────────────────
  function buildThemeVars(themeKey) {
    const t = THEMES[themeKey] || THEMES.default;
    if (themeKey === 'custom') {
      const a = state.customThemeAccent || '#9060ff';
      // derive variants from accent hex
      const bg = state.customThemeBg || 'rgba(8,8,16,0.97)';
      return {
        '--lio-bg': bg,
        '--lio-border': a+'33',
        '--lio-accent1': a,
        '--lio-accent2': a,
        '--lio-accent3': a+'cc',
        '--lio-handle-a': '#111',
        '--lio-handle-b': '#1a1a1a',
        '--lio-handle-c': a+'88',
        '--lio-text': '#e8e8f0',
        '--lio-text-dim': '#606080',
        '--lio-tab-active-bg': a+'22',
        '--lio-tab-active-border': a+'88',
        '--lio-tab-active-color': a,
        '--lio-btn-play-bg': `linear-gradient(135deg,${a}44,${a}22)`,
        '--lio-slider-thumb': `linear-gradient(135deg,${a},${a}88)`,
        '--lio-toggle-on': a+'cc',
        '--lio-val-color': a,
        '--lio-viz-bg': '#030305',
        '--lio-mini-bg': 'rgba(6,6,14,0.98)',
      };
    }
    return t;
  }

  function applyTheme(themeKey) {
    const vars = buildThemeVars(themeKey);
    const panel = document.getElementById(PANEL_ID);
    const mini  = document.getElementById(MINI_ID);
    [panel, mini].forEach(el => {
      if (!el) return;
      Object.entries(vars).forEach(([k,v]) => el.style.setProperty(k, v));
    });
  }

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${PANEL_ID} {
        position:fixed; width:358px; max-width:calc(100vw - 12px);
        z-index:999998; border-radius:18px; overflow:hidden;
        background:var(--lio-bg,rgba(10,10,18,0.96));
        border:1px solid var(--lio-border,rgba(200,160,255,0.18));
        box-shadow:0 0 0 1px rgba(0,0,0,0.3), 0 20px 55px rgba(0,0,0,0.6);
        font-family:ui-monospace,'Cascadia Code','SF Mono',monospace;
        backdrop-filter:blur(16px); color:var(--lio-text,#e0e0f0);
        transition:transform 0.22s cubic-bezier(.4,0,.2,1);
      }
      #${PANEL_ID}.collapsed { transform:translateX(calc(100% - 46px)); }
      #${PANEL_ID} * { box-sizing:border-box; }

      #${PANEL_ID} .handle {
        position:absolute; left:0; top:0; width:46px; height:100%;
        display:grid; place-items:center; cursor:pointer; user-select:none;
        background:linear-gradient(180deg,
          var(--lio-handle-a,#330033) 0%,
          var(--lio-handle-b,#220055) 50%,
          var(--lio-handle-c,#003388) 100%);
        writing-mode:vertical-rl;
      }
      #${PANEL_ID} .handle-label {
        transform:rotate(180deg); font-size:9px; font-weight:700;
        letter-spacing:3px; color:rgba(255,255,255,0.8);
        text-shadow:0 0 10px rgba(255,255,255,0.4);
      }

      #${PANEL_ID} .inner { padding:10px 10px 10px 56px; }

      #${PANEL_ID} .topbar {
        display:flex; align-items:center; gap:6px; margin-bottom:7px;
        cursor:grab; user-select:none;
      }
      #${PANEL_ID} .topbar-title {
        flex:1; font-size:11px; font-weight:700;
        background:linear-gradient(90deg,var(--lio-accent1),var(--lio-accent2),var(--lio-accent3));
        -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        letter-spacing:1px;
      }
      #${PANEL_ID} .topbar-status {
        font-size:8px; color:var(--lio-text-dim); max-width:90px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right;
      }
      #${PANEL_ID} .topbar-btn {
        padding:3px 7px; font-size:9px; border-radius:6px; cursor:pointer;
        border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.06);
        color:var(--lio-text-dim); transition:background 0.15s;
      }
      #${PANEL_ID} .topbar-btn:hover { background:rgba(255,255,255,0.12); }

      /* TABS */
      #${PANEL_ID} .tabs { display:flex; gap:2px; margin-bottom:8px; }
      #${PANEL_ID} .tab {
        flex:1; padding:5px 2px; font-size:8px; font-weight:700; text-align:center;
        border:1px solid rgba(255,255,255,0.07); border-radius:7px; cursor:pointer;
        color:var(--lio-text-dim); background:rgba(255,255,255,0.04);
        transition:all 0.14s; letter-spacing:0.3px; text-transform:uppercase;
        user-select:none;
      }
      #${PANEL_ID} .tab.on {
        background:var(--lio-tab-active-bg); border-color:var(--lio-tab-active-border);
        color:var(--lio-tab-active-color);
      }
      #${PANEL_ID} .tab:hover:not(.on) { background:rgba(255,255,255,0.08); color:var(--lio-text); }

      #${PANEL_ID} .pane { display:none; }
      #${PANEL_ID} .pane.on { display:block; }

      /* SCROLL */
      #${PANEL_ID} .scroll { max-height:310px; overflow-y:auto; padding-right:2px; }
      #${PANEL_ID} .scroll::-webkit-scrollbar { width:2px; }
      #${PANEL_ID} .scroll::-webkit-scrollbar-thumb { background:var(--lio-accent2); border-radius:2px; opacity:0.4; }

      /* VIZ */
      #${PANEL_ID} .viz-wrap {
        border-radius:9px; overflow:hidden; margin-bottom:7px;
        background:var(--lio-viz-bg,#050508);
        border:1px solid rgba(255,255,255,0.05);
      }
      #${PANEL_ID} canvas { display:block; width:100%; height:60px; }

      /* BUTTONS */
      #${PANEL_ID} button {
        padding:6px 8px; font-size:9px; font-weight:700; letter-spacing:0.4px;
        border:1px solid rgba(255,255,255,0.1); border-radius:8px;
        background:rgba(255,255,255,0.06); color:var(--lio-text);
        cursor:pointer; transition:all 0.14s; outline:none; font-family:inherit;
      }
      #${PANEL_ID} button:hover { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.2); }
      #${PANEL_ID} .btn-play {
        background:var(--lio-btn-play-bg); border-color:var(--lio-accent2);
        color:#fff; font-size:10px; text-align:center;
      }
      #${PANEL_ID} .btn-play.playing {
        background:linear-gradient(135deg,rgba(255,50,50,0.3),rgba(180,20,80,0.3));
        border-color:rgba(255,80,80,0.55);
        box-shadow:0 0 10px rgba(255,60,60,0.2);
      }
      #${PANEL_ID} .btn-danger { background:rgba(255,50,50,0.1); border-color:rgba(255,80,80,0.28); color:#ff9090; }
      #${PANEL_ID} .btn-accent { background:rgba(60,160,255,0.1); border-color:rgba(60,160,255,0.28); color:#70b8ff; }
      #${PANEL_ID} .btn-song {
        background:rgba(255,200,40,0.1); border-color:rgba(255,200,40,0.3); color:#ffe060;
      }
      #${PANEL_ID} .btn-song.on {
        background:rgba(255,200,40,0.22); border-color:rgba(255,200,40,0.65);
        color:#ffe060; box-shadow:0 0 10px rgba(255,200,40,0.2);
        animation:lio-song-glow 2s ease-in-out infinite;
      }
      @keyframes lio-song-glow { 0%,100%{box-shadow:0 0 6px rgba(255,200,40,0.2)} 50%{box-shadow:0 0 14px rgba(255,200,40,0.45)} }

      /* SELECTS / TEXT INPUTS */
      #${PANEL_ID} select, #${PANEL_ID} input[type=text] {
        width:100%; padding:5px 7px; font-size:9px; font-family:inherit;
        border:1px solid rgba(255,255,255,0.09); border-radius:8px;
        background:rgba(255,255,255,0.05); color:var(--lio-text); outline:none;
      }
      #${PANEL_ID} select option { color:#111; background:#222; }
      #${PANEL_ID} input[type=text]::placeholder { color:var(--lio-text-dim); }
      #${PANEL_ID} input[type=color] {
        width:28px; height:22px; border-radius:5px; border:1px solid rgba(255,255,255,0.12);
        background:transparent; padding:1px; cursor:pointer;
      }

      /* LABELS */
      #${PANEL_ID} .lbl {
        font-size:8px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase;
        color:var(--lio-text-dim); margin-bottom:3px;
      }
      #${PANEL_ID} .field { display:grid; gap:2px; margin-bottom:4px; }

      /* GRIDS */
      #${PANEL_ID} .g2 { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:4px; }
      #${PANEL_ID} .g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:4px; }
      #${PANEL_ID} .sep { height:1px; background:rgba(255,255,255,0.07); margin:7px 0; }

      /* SLIDERS */
      #${PANEL_ID} .sr { margin-bottom:5px; }
      #${PANEL_ID} .sr-head { display:flex; justify-content:space-between; margin-bottom:2px; }
      #${PANEL_ID} .sr-name { font-size:8px; font-weight:700; color:var(--lio-text-dim); text-transform:uppercase; letter-spacing:0.5px; }
      #${PANEL_ID} .sr-val  { font-size:8px; font-weight:700; color:var(--lio-val-color,#d090ff); min-width:28px; text-align:right; }
      #${PANEL_ID} .sr-val.modulated { color:var(--lio-accent3) !important; }
      #${PANEL_ID} input[type=range] {
        width:100%; height:3px; -webkit-appearance:none; appearance:none;
        background:rgba(255,255,255,0.1); border-radius:2px;
        border:none; padding:0; cursor:pointer; outline:none; margin:0;
      }
      #${PANEL_ID} input[type=range]::-webkit-slider-thumb {
        -webkit-appearance:none; width:11px; height:11px; border-radius:50%;
        background:var(--lio-slider-thumb); cursor:pointer;
        box-shadow:0 0 5px rgba(0,0,0,0.5);
        transition:transform 0.1s;
      }
      #${PANEL_ID} input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.2); }
      #${PANEL_ID} input[type=range].modulated { background:rgba(255,200,40,0.25); }

      /* TOGGLES */
      #${PANEL_ID} .tg-group { display:grid; grid-template-columns:1fr 1fr; gap:3px; margin-bottom:4px; }
      #${PANEL_ID} .tg-group.four { grid-template-columns:1fr 1fr 1fr 1fr; }
      #${PANEL_ID} .tg {
        display:flex; align-items:center; gap:4px; padding:5px 6px;
        border-radius:7px; border:1px solid rgba(255,255,255,0.07);
        background:rgba(255,255,255,0.03); cursor:pointer; user-select:none;
      }
      #${PANEL_ID} .tg input { display:none; }
      #${PANEL_ID} .tg-dot {
        width:20px; height:11px; border-radius:6px;
        background:rgba(255,255,255,0.1); position:relative;
        transition:background 0.18s; flex-shrink:0;
      }
      #${PANEL_ID} .tg-dot::after {
        content:''; position:absolute; width:7px; height:7px; border-radius:50%;
        background:#fff; top:2px; left:2px; transition:transform 0.18s;
      }
      #${PANEL_ID} .tg.on .tg-dot { background:var(--lio-toggle-on,rgba(180,80,255,0.7)); }
      #${PANEL_ID} .tg.on .tg-dot::after { transform:translateX(9px); }
      #${PANEL_ID} .tg-lbl { font-size:8px; font-weight:700; color:var(--lio-text-dim); }
      #${PANEL_ID} .tg.on .tg-lbl { color:var(--lio-val-color); }

      /* STATUS BAR */
      #${PANEL_ID} .status-bar {
        margin-top:5px; padding:4px 7px; background:rgba(255,255,255,0.03);
        border-radius:6px; font-size:8px; color:var(--lio-text-dim); min-height:22px;
        border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:5px;
      }
      #${PANEL_ID} .status-dot {
        width:5px; height:5px; border-radius:50%; background:#303050; flex-shrink:0; transition:background 0.3s;
      }
      #${PANEL_ID} .status-dot.on {
        background:#40ff80; box-shadow:0 0 5px rgba(64,255,128,0.5);
        animation:lio-pulse 1.1s ease-in-out infinite;
      }
      @keyframes lio-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

      /* STEP SEQ */
      #${PANEL_ID} .seq-row { display:flex; gap:2px; margin-bottom:2px; align-items:center; }
      #${PANEL_ID} .seq-name { font-size:7px; color:var(--lio-text-dim); font-weight:700; width:28px; flex-shrink:0; }
      #${PANEL_ID} .seq-cell {
        flex:1; height:13px; border-radius:3px;
        background:rgba(255,255,255,0.05); cursor:pointer;
        border:1px solid rgba(255,255,255,0.03); transition:background 0.08s;
      }
      #${PANEL_ID} .seq-cell.on.kick  { background:rgba(255,80,80,0.7); border-color:rgba(255,80,80,0.4); }
      #${PANEL_ID} .seq-cell.on.snare { background:rgba(255,180,40,0.7); border-color:rgba(255,180,40,0.4); }
      #${PANEL_ID} .seq-cell.on.hat   { background:rgba(40,200,255,0.7); border-color:rgba(40,200,255,0.4); }
      #${PANEL_ID} .seq-cell.on.ohat  { background:rgba(100,255,180,0.7); border-color:rgba(100,255,180,0.4); }
      #${PANEL_ID} .seq-cell.cur { box-shadow:0 0 0 1px rgba(255,255,255,0.45); }

      /* EQ */
      #${PANEL_ID} .eq { display:flex; gap:4px; align-items:flex-end; height:44px; margin-bottom:4px; }
      #${PANEL_ID} .eq-band { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; height:100%; }
      #${PANEL_ID} .eq-band input[type=range] { writing-mode:vertical-lr; direction:rtl; width:3px; flex:1; }
      #${PANEL_ID} .eq-band span { font-size:7px; color:var(--lio-text-dim); }

      /* PRESET CARDS */
      #${PANEL_ID} .pcard {
        display:flex; align-items:center; gap:6px; padding:5px 7px;
        border-radius:8px; margin-bottom:3px;
        background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);
        cursor:pointer; transition:all 0.13s;
      }
      #${PANEL_ID} .pcard:hover { background:rgba(255,255,255,0.07); border-color:rgba(255,255,255,0.13); }
      #${PANEL_ID} .pcard.on { background:var(--lio-tab-active-bg); border-color:var(--lio-tab-active-border); }
      #${PANEL_ID} .pcard-icon { font-size:16px; flex-shrink:0; }
      #${PANEL_ID} .pcard-info { flex:1; min-width:0; }
      #${PANEL_ID} .pcard-name { font-size:9px; font-weight:700; color:var(--lio-text); }
      #${PANEL_ID} .pcard-meta { font-size:7px; color:var(--lio-text-dim); }
      #${PANEL_ID} .pcard-bpm  { font-size:8px; font-weight:700; color:var(--lio-val-color); }
      #${PANEL_ID} .pcard-tag  {
        font-size:6px; padding:2px 4px; border-radius:3px;
        background:rgba(255,255,255,0.07); color:var(--lio-text-dim);
        text-transform:uppercase; font-weight:700;
      }

      /* SONG MODE PANEL */
      #${PANEL_ID} .song-panel {
        padding:8px; border-radius:9px; margin-bottom:5px;
        background:rgba(255,200,40,0.06); border:1px solid rgba(255,200,40,0.18);
      }
      #${PANEL_ID} .song-panel .lbl { color:#aa9020; }
      #${PANEL_ID} .song-panel .sr-name { color:#aa9020; }
      #${PANEL_ID} .song-vis {
        height:18px; border-radius:4px; overflow:hidden; margin-bottom:6px;
        background:rgba(0,0,0,0.3); position:relative;
      }
      #${PANEL_ID} .song-vis canvas { width:100% !important; height:18px !important; }

      /* THEME SWATCHES */
      #${PANEL_ID} .swatches { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:6px; }
      #${PANEL_ID} .swatch {
        width:28px; height:20px; border-radius:5px; cursor:pointer;
        border:2px solid transparent; transition:border-color 0.14s;
        font-size:9px; display:grid; place-items:center; font-weight:700;
      }
      #${PANEL_ID} .swatch.on { border-color:rgba(255,255,255,0.7); }

      /* ─── MINIPLAYER ────────────────────────────────────────────────── */
      #${MINI_ID} {
        position:fixed; z-index:999999;
        display:flex; align-items:center; gap:6px;
        padding:6px 10px 6px 8px; border-radius:50px;
        background:var(--lio-mini-bg,rgba(8,8,20,0.97));
        border:1px solid var(--lio-border,rgba(200,160,255,0.18));
        box-shadow:0 4px 20px rgba(0,0,0,0.5);
        backdrop-filter:blur(14px);
        font-family:ui-monospace,'Cascadia Code',monospace;
        cursor:pointer; user-select:none; transition:opacity 0.2s;
        min-width:160px;
      }
      #${MINI_ID}:hover { opacity:0.9; }
      #${MINI_ID} .mini-dot {
        width:8px; height:8px; border-radius:50%; background:#303050; flex-shrink:0;
      }
      #${MINI_ID} .mini-dot.on {
        background:var(--lio-accent1,#ff60c0);
        box-shadow:0 0 7px var(--lio-accent1,#ff60c0);
        animation:lio-pulse 1.1s ease-in-out infinite;
      }
      #${MINI_ID} .mini-canvas-wrap { flex:1; height:20px; overflow:hidden; border-radius:3px; }
      #${MINI_ID} canvas { display:block; width:100%; height:20px; }
      #${MINI_ID} .mini-name {
        font-size:8px; font-weight:700; color:var(--lio-text,#e0e0f0);
        max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${MINI_ID} .mini-play {
        font-size:10px; padding:3px 7px; border-radius:20px; cursor:pointer;
        border:1px solid var(--lio-accent2,#a060ff); background:transparent;
        color:var(--lio-accent2,#a060ff); font-family:inherit; transition:all 0.14s;
      }
      #${MINI_ID} .mini-play:hover { background:var(--lio-accent2,#a060ff); color:#fff; }
      #${MINI_ID} .mini-expand {
        font-size:9px; color:var(--lio-text-dim,#6060a0); padding:0 2px; flex-shrink:0;
      }
    `;
    document.head.appendChild(s);
  }

  // ── READY ────────────────────────────────────────────────────────────────────
  function domReady(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn, {once:true});
  }

  domReady(function init() {
    if (document.getElementById(PANEL_ID)) return;
    injectCss();

    // ── BUILD PANEL ───────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    if (state.collapsed) panel.classList.add('collapsed');

    panel.innerHTML = `
      <div class="handle"><span class="handle-label">LIO SYNTH</span></div>
      <div class="inner">
        <div class="topbar" id="lDrag">
          <div class="topbar-title">LIO SYNTH v3</div>
          <div class="topbar-status" id="lTopSt">Ready</div>
          <button class="topbar-btn" id="lCollBtn">⇄</button>
        </div>

        <div class="tabs" id="lTabs">
          <div class="tab on"  data-tab="play">▶ Play</div>
          <div class="tab"     data-tab="sound">Sound</div>
          <div class="tab"     data-tab="seq">Seq</div>
          <div class="tab"     data-tab="genres">Genres</div>
          <div class="tab"     data-tab="build">Build</div>
          <div class="tab"     data-tab="theme">Theme</div>
        </div>

        <!-- PLAY -->
        <div class="pane on" id="lPane-play">
          <div class="viz-wrap"><canvas id="lCanvas" height="60"></canvas></div>

          <div class="g2" style="margin-bottom:6px">
            <button id="lPlayBtn" class="btn-play">▶ START</button>
            <button id="lSongBtn" class="btn-song">♾ Song Mode</button>
          </div>

          <div class="field">
            <div class="lbl">Preset</div>
            <select id="lPresetSel"></select>
          </div>

          <div class="sr">
            <div class="sr-head"><span class="sr-name">BPM</span><span class="sr-val" id="lBpmVal">124</span></div>
            <input type="range" id="lBpm" min="50" max="200" step="1">
          </div>
          <div class="sr">
            <div class="sr-head"><span class="sr-name">Energy</span><span class="sr-val" id="lEnVal">62%</span></div>
            <input type="range" id="lEnergy" min="0" max="1" step="0.01">
          </div>
          <div class="sr">
            <div class="sr-head"><span class="sr-name">Volume</span><span class="sr-val" id="lVolVal">34%</span></div>
            <input type="range" id="lVolume" min="0" max="1" step="0.01">
          </div>

          <div class="sep"></div>

          <div class="field">
            <div class="lbl">Seed</div>
            <input type="text" id="lSeed" placeholder="torn-war-777">
          </div>

          <div class="g2">
            <button id="lNewSeed">🎲 New Seed</button>
            <button id="lRandomize" class="btn-accent">✨ Randomize</button>
          </div>
          <div class="g2" style="margin-top:3px">
            <button id="lPanicBtn" class="btn-danger">⛔ Panic</button>
            <button id="lMiniToggle" class="btn-accent">⊟ Miniplayer</button>
          </div>

          <div class="status-bar">
            <div class="status-dot" id="lDot"></div>
            <span id="lStatus">Tap ▶ START to play</span>
          </div>
        </div>

        <!-- SOUND -->
        <div class="pane" id="lPane-sound">
          <div class="scroll">
            <div class="lbl">Layers</div>
            <div class="tg-group four">
              <label class="tg" id="tDrums"><input type="checkbox" id="lDrums"><div class="tg-dot"></div><span class="tg-lbl">Drums</span></label>
              <label class="tg" id="tBass"><input type="checkbox" id="lBass"><div class="tg-dot"></div><span class="tg-lbl">Bass</span></label>
              <label class="tg" id="tMelody"><input type="checkbox" id="lMelody"><div class="tg-dot"></div><span class="tg-lbl">Lead</span></label>
              <label class="tg" id="tFx"><input type="checkbox" id="lFx"><div class="tg-dot"></div><span class="tg-lbl">FX</span></label>
            </div>
            <div class="sep"></div>
            <div class="sr">
              <div class="sr-head"><span class="sr-name">Bass Intensity</span><span class="sr-val" id="lBassIntVal">70%</span></div>
              <input type="range" id="lBassInt" min="0" max="1" step="0.01">
            </div>
            <div class="sr">
              <div class="sr-head"><span class="sr-name">Melody Density</span><span class="sr-val" id="lMelDVal">50%</span></div>
              <input type="range" id="lMelDens" min="0" max="1" step="0.01">
            </div>
            <div class="sr">
              <div class="sr-head"><span class="sr-name">Filter Cutoff</span><span class="sr-val" id="lFiltVal">50%</span></div>
              <input type="range" id="lFilter" min="0" max="1" step="0.01">
            </div>
            <div class="sep"></div>
            <div class="lbl">5-Band EQ</div>
            <div class="eq">
              <div class="eq-band"><input type="range" id="lEqB" min="0" max="1" step="0.01" orient="vertical"><span>Bass</span></div>
              <div class="eq-band"><input type="range" id="lEqL" min="0" max="1" step="0.01" orient="vertical"><span>Low</span></div>
              <div class="eq-band"><input type="range" id="lEqM" min="0" max="1" step="0.01" orient="vertical"><span>Mid</span></div>
              <div class="eq-band"><input type="range" id="lEqH" min="0" max="1" step="0.01" orient="vertical"><span>High</span></div>
              <div class="eq-band"><input type="range" id="lEqA" min="0" max="1" step="0.01" orient="vertical"><span>Air</span></div>
            </div>
            <div class="sep"></div>
            <div class="lbl">FX</div>
            <div class="tg-group">
              <label class="tg" id="tRev"><input type="checkbox" id="lRev"><div class="tg-dot"></div><span class="tg-lbl">Reverb</span></label>
              <label class="tg" id="tViz"><input type="checkbox" id="lViz"><div class="tg-dot"></div><span class="tg-lbl">Visualizer</span></label>
            </div>
            <div class="sr" style="margin-top:4px">
              <div class="sr-head"><span class="sr-name">Reverb Wet</span><span class="sr-val" id="lRevVal">18%</span></div>
              <input type="range" id="lRevWet" min="0" max="1" step="0.01">
            </div>
            <div class="sep"></div>
            <div class="lbl">Arp / Chord</div>
            <div class="tg-group">
              <label class="tg" id="tArp"><input type="checkbox" id="lArp"><div class="tg-dot"></div><span class="tg-lbl">Arp</span></label>
              <label class="tg" id="tChord"><input type="checkbox" id="lChord"><div class="tg-dot"></div><span class="tg-lbl">Chords</span></label>
            </div>
            <div class="g2" style="margin-top:4px">
              <div class="field"><div class="lbl">Arp Rate</div>
                <select id="lArpRate">
                  <option value="0.5">1/32</option><option value="1">1/16</option>
                  <option value="2">1/8</option><option value="4">1/4</option>
                </select>
              </div>
              <div class="field"><div class="lbl">Voicing</div>
                <select id="lVoicing">
                  <option value="triad">Triad</option><option value="seventh">7th</option>
                  <option value="sus2">Sus2</option><option value="sus4">Sus4</option>
                  <option value="power">Power</option><option value="shell">Shell</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- SEQ -->
        <div class="pane" id="lPane-seq">
          <div class="field">
            <div class="lbl">Pattern</div>
            <select id="lPatSel"></select>
          </div>
          <div id="lSeq" style="margin-bottom:5px">
            <div class="seq-row" id="lSeqKick"><span class="seq-name">Kick</span></div>
            <div class="seq-row" id="lSeqSnare"><span class="seq-name">Snare</span></div>
            <div class="seq-row" id="lSeqHat"><span class="seq-name">HiHat</span></div>
            <div class="seq-row" id="lSeqOhat"><span class="seq-name">OHat</span></div>
          </div>
          <div class="g2">
            <button id="lSeqSave" class="btn-accent">💾 Save Pattern</button>
            <button id="lSeqRand">🎲 Randomize</button>
          </div>
          <div class="sr" style="margin-top:7px">
            <div class="sr-head"><span class="sr-name">Swing</span><span class="sr-val" id="lSwingVal">4%</span></div>
            <input type="range" id="lSwing" min="0" max="0.4" step="0.01">
          </div>
        </div>

        <!-- GENRES -->
        <div class="pane" id="lPane-genres">
          <div class="scroll" id="lPCards"></div>
        </div>

        <!-- BUILD -->
        <div class="pane" id="lPane-build">
          <div class="scroll">
            <div style="font-size:8px;color:var(--lio-text-dim);margin-bottom:5px">Design a custom genre and save it permanently.</div>
            <div class="field"><div class="lbl">Name</div><input type="text" id="cName" placeholder="My Banger"></div>
            <div class="g2">
              <div class="field"><div class="lbl">Root Note</div><select id="cRoot"></select></div>
              <div class="field"><div class="lbl">Scale</div><select id="cScale"></select></div>
            </div>
            <div class="g2">
              <div class="field"><div class="lbl">BPM</div><input type="text" id="cBpm" placeholder="120"></div>
              <div class="field"><div class="lbl">Swing</div><input type="text" id="cSwing" placeholder="0.05"></div>
            </div>
            <div class="g2">
              <div class="field"><div class="lbl">Lead Wave</div>
                <select id="cWave"><option value="sine">Sine</option><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option></select>
              </div>
              <div class="field"><div class="lbl">Bass Wave</div>
                <select id="cBassWave"><option value="sine">Sine</option><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option></select>
              </div>
            </div>
            <div class="field"><div class="lbl">Chord Degrees (comma-sep)</div><input type="text" id="cChords" placeholder="0,5,3,6"></div>
            <div class="g2">
              <div class="field"><div class="lbl">Drum Pattern</div><select id="cDrum"></select></div>
              <div class="field"><div class="lbl">Genre Tag</div>
                <select id="cGenre"><option value="custom">Custom</option><option value="cyberpunk">Cyberpunk</option><option value="lofi">Lo-Fi</option><option value="electronic">Electronic</option><option value="ambient">Ambient</option><option value="synthwave">Synthwave</option><option value="jazz">Jazz</option><option value="trap">Trap</option><option value="blues">Blues</option><option value="citypop">City Pop</option><option value="metal">Metal</option></select>
              </div>
            </div>
            <div class="g2">
              <div class="field"><div class="lbl">Reverb (0–1)</div><input type="text" id="cRev" placeholder="0.2"></div>
              <div class="field"><div class="lbl">Filter (0–1)</div><input type="text" id="cFilt" placeholder="0.5"></div>
            </div>
            <div class="g2">
              <div class="field"><div class="lbl">Bass Int.</div><input type="text" id="cBassInt" placeholder="0.7"></div>
              <div class="field"><div class="lbl">Melody Dens.</div><input type="text" id="cMelD" placeholder="0.5"></div>
            </div>
            <div class="g2">
              <button id="cSave" class="btn-accent">💾 Save Genre</button>
              <button id="cLoad">⬆ Load Current</button>
            </div>
            <div id="cStatus" style="font-size:8px;color:var(--lio-text-dim);margin-top:3px;min-height:14px"></div>
            <div class="sep"></div>
            <div class="lbl">My Custom Genres</div>
            <div id="lCustomList"></div>
          </div>
        </div>

        <!-- THEME -->
        <div class="pane" id="lPane-theme">
          <div class="scroll">
            <div class="lbl">Theme</div>
            <div class="swatches" id="lSwatches"></div>

            <div id="lCustomThemeFields" style="display:none">
              <div class="g2">
                <div class="field">
                  <div class="lbl">Accent Color</div>
                  <div style="display:flex;gap:5px;align-items:center">
                    <input type="color" id="lAccentColor" value="#9060ff">
                    <input type="text" id="lAccentHex" placeholder="#9060ff" style="flex:1">
                  </div>
                </div>
                <div class="field">
                  <div class="lbl">BG Opacity</div>
                  <div class="sr" style="margin-bottom:0">
                    <div class="sr-head"><span class="sr-name"></span><span class="sr-val" id="lBgOpVal">97%</span></div>
                    <input type="range" id="lBgOp" min="0.5" max="1" step="0.01">
                  </div>
                </div>
              </div>
              <button id="lApplyCustomTheme" class="btn-accent" style="width:100%;margin-top:3px">Apply Custom Theme</button>
            </div>

            <div class="sep"></div>

            <!-- SONG MODE in Theme tab (separate section) -->
            <div class="lbl">♾ Song Mode</div>
            <div class="song-panel">
              <div style="font-size:8px;color:#9a8030;margin-bottom:6px;line-height:1.4">
                When on, all sliders drift slowly on their own — like a living soundscape. Inspired by mynoise.net. You can still grab any slider to override it; it resumes modulating after 8 seconds.
              </div>
              <div class="song-vis"><canvas id="lSongCanvas" height="18"></canvas></div>
              <div class="g2">
                <button id="lSongToggle2" class="btn-song">♾ Song Mode</button>
                <div></div>
              </div>
              <div class="sep" style="border-color:rgba(255,200,40,0.1)"></div>
              <div class="sr">
                <div class="sr-head"><span class="sr-name">Speed (cycle secs)</span><span class="sr-val" id="lSongSpVal">30s</span></div>
                <input type="range" id="lSongSp" min="5" max="120" step="1">
              </div>
              <div class="sr">
                <div class="sr-head"><span class="sr-name">Depth</span><span class="sr-val" id="lSongDepVal">35%</span></div>
                <input type="range" id="lSongDep" min="0" max="1" step="0.01">
              </div>
              <div class="sr">
                <div class="sr-head"><span class="sr-name">Turbulence</span><span class="sr-val" id="lSongTurbVal">20%</span></div>
                <input type="range" id="lSongTurb" min="0" max="1" step="0.01">
              </div>
              <div class="lbl" style="margin-top:4px">Modulate</div>
              <div class="tg-group four" id="lSongToggles">
                <label class="tg on" id="stEnergy"><input type="checkbox" checked><div class="tg-dot"></div><span class="tg-lbl">Energy</span></label>
                <label class="tg on" id="stFilter"><input type="checkbox" checked><div class="tg-dot"></div><span class="tg-lbl">Filter</span></label>
                <label class="tg on" id="stRev"><input type="checkbox" checked><div class="tg-dot"></div><span class="tg-lbl">Reverb</span></label>
                <label class="tg on" id="stBassInt"><input type="checkbox" checked><div class="tg-dot"></div><span class="tg-lbl">Bass</span></label>
                <label class="tg on" id="stMelDens"><input type="checkbox" checked><div class="tg-dot"></div><span class="tg-lbl">Melody</span></label>
                <label class="tg"   id="stBpm"><input type="checkbox"><div class="tg-dot"></div><span class="tg-lbl">BPM</span></label>
                <label class="tg on" id="stEq"><input type="checkbox" checked><div class="tg-dot"></div><span class="tg-lbl">EQ</span></label>
                <label class="tg"   id="stVol"><input type="checkbox"><div class="tg-dot"></div><span class="tg-lbl">Volume</span></label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // ── BUILD MINIPLAYER ──────────────────────────────────────────────────────
    const mini = document.createElement('div');
    mini.id = MINI_ID;
    mini.innerHTML = `
      <div class="mini-dot" id="lMiniDot"></div>
      <div class="mini-canvas-wrap"><canvas id="lMiniCanvas" height="20"></canvas></div>
      <span class="mini-name" id="lMiniName">Neon War Chain</span>
      <button class="mini-play" id="lMiniPlay">▶</button>
      <span class="mini-expand">⊞</span>
    `;
    document.body.appendChild(mini);

    // ── DOM REFS ─────────────────────────────────────────────────────────────
    const $ = id => panel.querySelector('#'+id);
    const handle    = panel.querySelector('.handle');
    const dragBar   = $('lDrag');
    const tabs      = panel.querySelectorAll('.tab');
    const playBtn   = $('lPlayBtn');
    const songBtn   = $('lSongBtn');
    const panicBtn  = $('lPanicBtn');
    const presetSel = $('lPresetSel');
    const bpmIn     = $('lBpm');  const bpmVal   = $('lBpmVal');
    const enIn      = $('lEnergy'); const enVal  = $('lEnVal');
    const volIn     = $('lVolume'); const volVal  = $('lVolVal');
    const seedIn    = $('lSeed');
    const newSeedB  = $('lNewSeed');
    const randB     = $('lRandomize');
    const statusEl  = $('lStatus');
    const statusDot = $('lDot');
    const topSt     = $('lTopSt');
    const canvas    = $('lCanvas');
    const ctx2d     = canvas.getContext('2d');
    const miniBtn   = $('lMiniToggle');
    const colBtn    = $('lCollBtn');

    // Sound
    const drumsChk  = $('lDrums'); const bassChk = $('lBass');
    const melChk    = $('lMelody'); const fxChk  = $('lFx');
    const revChk    = $('lRev');    const vizChk  = $('lViz');
    const arpChk    = $('lArp');    const chordChk= $('lChord');
    const bassIntIn = $('lBassInt'); const bassIntV= $('lBassIntVal');
    const melDIn    = $('lMelDens'); const melDV  = $('lMelDVal');
    const filtIn    = $('lFilter');  const filtV   = $('lFiltVal');
    const revWetIn  = $('lRevWet');  const revV    = $('lRevVal');
    const arpRateS  = $('lArpRate'); const voicS   = $('lVoicing');
    const eqBIn=$('lEqB'); const eqLIn=$('lEqL'); const eqMIn=$('lEqM');
    const eqHIn=$('lEqH'); const eqAIn=$('lEqA');

    // Seq
    const patSel    = $('lPatSel');
    const swingIn   = $('lSwing');   const swingV   = $('lSwingVal');
    const seqSave   = $('lSeqSave'); const seqRand  = $('lSeqRand');

    // Build
    const cName=$('cName'); const cRoot=$('cRoot'); const cScale=$('cScale');
    const cBpm=$('cBpm'); const cSwing=$('cSwing'); const cWave=$('cWave');
    const cBassWave=$('cBassWave'); const cChords=$('cChords');
    const cDrum=$('cDrum'); const cGenre=$('cGenre');
    const cRev=$('cRev'); const cFilt=$('cFilt');
    const cBassInt=$('cBassInt'); const cMelD=$('cMelD');
    const cSave=$('cSave'); const cLoad=$('cLoad');
    const cStatus=$('cStatus'); const customList=$('lCustomList');

    // Theme
    const swatchCont=$('lSwatches');
    const customFields=$('lCustomThemeFields');
    const accentColor=$('lAccentColor'); const accentHex=$('lAccentHex');
    const bgOpIn=$('lBgOp'); const bgOpV=$('lBgOpVal');
    const applyCustom=$('lApplyCustomTheme');

    // Song mode
    const songSp=$('lSongSp'); const songSpV=$('lSongSpVal');
    const songDep=$('lSongDep'); const songDepV=$('lSongDepVal');
    const songTurb=$('lSongTurb'); const songTurbV=$('lSongTurbVal');
    const songTgl2=$('lSongToggle2');
    const songCanvas=$('lSongCanvas');
    const songCtx=songCanvas.getContext('2d');

    // Miniplayer
    const miniDot=mini.querySelector('#lMiniDot');
    const miniName=mini.querySelector('#lMiniName');
    const miniPlay=mini.querySelector('#lMiniPlay');
    const miniCanvas=mini.querySelector('#lMiniCanvas');
    const miniCtx=miniCanvas.getContext('2d');

    // Live pattern
    let livePat = JSON.parse(JSON.stringify(DRUM_PATTERNS[state.drumPattern] || DRUM_PATTERNS.standard));

    // ── AUDIO ────────────────────────────────────────────────────────────────
    let audioCtx=null, masterG=null, analyser=null, analyserData=null;
    let convolver=null, revWetG=null, revDryG=null, eqFilters=[];
    let noiseBuf=null;
    let playing=false, schedTimer=null, step=0, nextT=0;
    let rng=mulberry32(hashStr(state.seed+state.preset));
    let arpPh=0;

    function setStatus(txt) {
      statusEl.textContent=txt;
      topSt.textContent=txt.slice(0,24);
    }

    function spStep() {
      return (60/clamp(state.bpm||120,40,240))/4;
    }

    function makeNoise() {
      const len=Math.floor(audioCtx.sampleRate*2);
      const b=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
      const d=b.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
      return b;
    }

    function makeImpulse(dur,decay) {
      const len=Math.floor(audioCtx.sampleRate*dur);
      const b=audioCtx.createBuffer(2,len,audioCtx.sampleRate);
      for(let c=0;c<2;c++){
        const d=b.getChannelData(c);
        for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
      }
      return b;
    }

    function ensureAudio() {
      if(audioCtx) return;
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC){setStatus('No Web Audio');return;}
      audioCtx=new AC();
      masterG=audioCtx.createGain(); masterG.gain.value=0.0001;
      analyser=audioCtx.createAnalyser();
      analyser.fftSize=512; analyser.smoothingTimeConstant=0.82;
      analyserData=new Uint8Array(analyser.frequencyBinCount);
      const eqFreqs=[80,250,1000,4000,12000];
      const eqTypes=['lowshelf','peaking','peaking','peaking','highshelf'];
      eqFilters=eqFreqs.map((f,i)=>{
        const n=audioCtx.createBiquadFilter();
        n.type=eqTypes[i]; n.frequency.value=f; n.gain.value=0; n.Q.value=1.2;
        return n;
      });
      for(let i=0;i<eqFilters.length-1;i++) eqFilters[i].connect(eqFilters[i+1]);
      const comp=audioCtx.createDynamicsCompressor();
      comp.threshold.value=-16; comp.knee.value=14; comp.ratio.value=4;
      comp.attack.value=0.003; comp.release.value=0.15;
      const del=audioCtx.createDelay(1.0); del.delayTime.value=0.21;
      const feedG=audioCtx.createGain(); feedG.gain.value=0.18;
      const wetG=audioCtx.createGain(); wetG.gain.value=state.fx?0.14:0;
      convolver=audioCtx.createConvolver(); convolver.buffer=makeImpulse(2.4,2.5);
      revWetG=audioCtx.createGain(); revWetG.gain.value=state.reverb?state.reverbWet:0;
      revDryG=audioCtx.createGain(); revDryG.gain.value=1;
      masterG.connect(eqFilters[0]);
      const eqOut=eqFilters[eqFilters.length-1];
      eqOut.connect(revDryG); eqOut.connect(convolver);
      convolver.connect(revWetG);
      revDryG.connect(comp); revWetG.connect(comp);
      masterG.connect(del); del.connect(feedG); feedG.connect(del);
      del.connect(wetG); wetG.connect(comp);
      comp.connect(analyser); analyser.connect(audioCtx.destination);
      noiseBuf=makeNoise();
      updateEq();
    }

    function updateEq() {
      if(!eqFilters.length) return;
      const keys=['eqBass','eqLow','eqMid','eqHigh','eqAir'];
      const now=audioCtx?audioCtx.currentTime:0;
      eqFilters.forEach((f,i)=>{
        if(audioCtx) f.gain.setTargetAtTime(((state[keys[i]]||0.5)*2-1)*12,now,0.05);
      });
    }

    function updateAudio() {
      if(!audioCtx||!masterG) return;
      const now=audioCtx.currentTime;
      masterG.gain.cancelScheduledValues(now);
      masterG.gain.setTargetAtTime(playing?clamp(state.volume,0,1):0.0001,now,0.03);
      if(revWetG) revWetG.gain.setTargetAtTime(state.reverb?(state.reverbWet||0.18):0,now,0.05);
    }

    function tone(o) {
      if(!audioCtx||!masterG) return;
      const t=o.time, dur=Math.max(0.02,o.dur||0.12);
      const vol=clamp(o.vol||0.1,0.001,0.85);
      const att=Math.max(0.002,o.attack||0.01), rel=Math.max(0.02,o.release||0.08);
      const osc=audioCtx.createOscillator();
      const g=audioCtx.createGain();
      osc.type=o.type||'sine'; osc.frequency.setValueAtTime(o.freq,t);
      if(o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20,o.freqEnd),t+dur*0.55);
      if(o.detune) osc.detune.value=o.detune;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(vol,t+att);
      g.gain.setValueAtTime(vol,t+dur);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur+rel);
      if(o.filter){
        const fl=audioCtx.createBiquadFilter();
        fl.type=o.filterType||'lowpass'; fl.frequency.setValueAtTime(o.filter,t);
        if(o.filterEnd) fl.frequency.exponentialRampToValueAtTime(Math.max(20,o.filterEnd),t+dur);
        fl.Q.value=o.q||0.8; osc.connect(fl); fl.connect(g);
      } else { osc.connect(g); }
      g.connect(masterG); osc.start(t); osc.stop(t+dur+rel+0.05);
    }

    function noise(o) {
      if(!audioCtx||!masterG||!noiseBuf) return;
      const t=o.time, dur=Math.max(0.01,o.dur||0.08);
      const vol=clamp(o.vol||0.1,0.001,0.85);
      const src=audioCtx.createBufferSource();
      const g=audioCtx.createGain(); const fl=audioCtx.createBiquadFilter();
      src.buffer=noiseBuf; src.loop=true;
      fl.type=o.filterType||'highpass'; fl.frequency.setValueAtTime(o.filter||7000,t);
      fl.Q.value=o.q||0.7;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(vol,t+0.006);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      src.connect(fl); fl.connect(g); g.connect(masterG);
      src.start(t); src.stop(t+dur+0.02);
    }

    function kick(t,pw) {
      tone({time:t,freq:150,freqEnd:40,dur:0.2,type:'sine',vol:0.38*pw,attack:0.003,release:0.07});
      noise({time:t,dur:0.022,vol:0.06*pw,filterType:'lowpass',filter:850});
    }
    function snare(t,pw) {
      noise({time:t,dur:0.12,vol:0.2*pw,filterType:'bandpass',filter:1900,q:0.85});
      tone({time:t,freq:190,dur:0.07,type:'triangle',vol:0.07*pw,attack:0.003,release:0.04});
    }
    function hat(t,pw,open) {
      noise({time:t,dur:open?0.18:0.04,vol:(open?0.09:0.06)*pw,filterType:'highpass',filter:open?6000:9000,q:0.5});
    }
    function clap(t,pw) {
      for(let i=0;i<3;i++) noise({time:t+i*0.01,dur:0.06,vol:0.12*pw,filterType:'bandpass',filter:1200,q:1.2});
    }
    function chord(t,root,sc,voicing,wave,vol,dur,flt) {
      const degs=CHORD_VOICINGS[voicing]||CHORD_VOICINGS.triad;
      degs.forEach((d,i)=>{
        tone({time:t+i*0.012,freq:midiToFreq(root+(sc[d%sc.length]||0)),dur,
              type:wave,vol:vol*(0.6-i*0.05),attack:0.025,release:0.1,
              filter:flt,q:0.7,detune:(Math.random()-0.5)*6});
      });
    }

    // ── STEP SCHEDULER ───────────────────────────────────────────────────────
    function schedStep(stepN,rawT) {
      const ap=allPresets(); const p=ap[state.preset]||PRESETS.neonwar;
      const sc=SCALES[p.scale]||SCALES.minor;
      const s16=stepN%16, bar=Math.floor(stepN/16);
      const sd=spStep();
      const sw=p.swing!==undefined?p.swing:0.06;
      const t=rawT+(s16%2===1?sd*sw:0);
      const chords=p.chords||[0,5,3,6];
      const ci=chords[bar%chords.length]||0;
      const co=sc[ci%sc.length]||0;
      const baseMidi=(p.root||45)+co;
      const en=clamp(state.energy||0,0,1);
      const bi=clamp(state.bassIntensity!==undefined?state.bassIntensity:p.bassInt||0.7,0,1);
      const md=clamp(state.melodyDensity!==undefined?state.melodyDensity:p.melDens||0.5,0,1);
      const ff=200+clamp(state.filterCutoff!==undefined?state.filterCutoff:p.filter||0.5,0,1)*7000;
      const pw=0.6+en*0.6;

      if(state.drums){
        if(livePat.kick[s16])  kick(t,pw);
        if(livePat.snare[s16]) snare(t,pw);
        if(livePat.hat[s16])   hat(t,pw,false);
        if(livePat.ohat[s16])  hat(t,pw,true);
        if(en>0.75&&s16%4===2&&rng()<0.3) snare(t+sd*0.5,pw*0.3);
        if(en>0.6&&livePat.snare[s16]&&rng()<0.4) clap(t,pw*0.4);
      }
      if(state.bass){
        const br=bi>0.7?[0,3,6,8,10,14]:bi>0.4?[0,6,8,14]:[0,8];
        if(br.includes(s16)){
          const bsc=[0,0,2,4];
          const bn=baseMidi-12+(sc[bsc[Math.floor(rng()*bsc.length)]%sc.length]||0);
          tone({time:t,freq:midiToFreq(bn),dur:sd*(rng()<0.28?1.8:0.9),
                type:p.bassWave||'square',vol:0.14+bi*0.12+en*0.06,
                attack:0.008,release:0.09,filter:ff*0.6,filterEnd:ff*0.3,q:0.7});
        }
      }
      if(state.melody&&state.chordMode&&s16%4===0&&rng()<0.55+en*0.25){
        chord(t,baseMidi+12,sc,state.chordVoicing||'triad',p.wave||'sawtooth',
              (0.04+md*0.05)*(0.5+en*0.5),sd*(1.8+rng()*1.2),ff);
      }
      if(state.melody&&state.arpMode){
        const ar=Number(state.arpRate)||2;
        if(s16%ar===0){
          const ad=CHORD_VOICINGS[state.chordVoicing||'triad'];
          const am=baseMidi+12+(sc[ad[arpPh%ad.length]%sc.length]||0)+(rng()<0.15?12:0);
          tone({time:t,freq:midiToFreq(am),dur:sd*(0.4+rng()*0.4),
                type:p.wave||'sawtooth',vol:0.05+md*0.06+en*0.04,
                attack:0.008,release:0.07,filter:ff*1.2,q:1.1});
          arpPh++;
        }
      }
      if(state.melody&&!state.arpMode){
        const ch=0.08+md*0.55+en*0.2;
        const al=en>0.7||s16%2===0||[3,7,11,15].includes(s16);
        if(al&&rng()<ch){
          const dp=[0,0,1,2,3,4,5,6];
          const dg=(ci+dp[Math.floor(rng()*dp.length)])%sc.length;
          const mm=(p.root||45)+24+(sc[dg]||0)+(rng()<0.22?12:0);
          tone({time:t,freq:midiToFreq(mm),dur:sd*(0.4+rng()*1.2),
                type:p.wave||'sine',vol:0.045+md*0.07+en*0.05,
                attack:0.014,release:0.1,filter:ff*1.5,filterEnd:ff*0.8,q:0.9});
        }
      }
      if(state.melody&&state.reverb&&s16===0&&rng()<0.3+md*0.4){
        tone({time:t,freq:midiToFreq(baseMidi+12+(sc[ci%sc.length]||0)),
              dur:sd*14,type:'sine',vol:0.018+md*0.02,attack:0.3,release:0.8,filter:1800,q:0.5});
      }
      if(s16===0) setStatus(`${(ap[state.preset]||{}).name||'?'} · Bar ${bar+1}`);
    }

    function scheduler(){
      if(!playing||!audioCtx) return;
      while(nextT<audioCtx.currentTime+0.15){
        schedStep(step,nextT); nextT+=spStep(); step++;
      }
    }

    async function startMusic(){
      ensureAudio(); if(!audioCtx) return;
      try{ if(audioCtx.state==='suspended') await audioCtx.resume(); }
      catch{ setStatus('Tap START again'); return; }
      rng=mulberry32(hashStr(`${state.seed}|${state.preset}|v3`));
      arpPh=0; step=0; nextT=audioCtx.currentTime+0.06;
      playing=true; updateAudio();
      if(schedTimer) clearInterval(schedTimer);
      schedTimer=setInterval(scheduler,22);
      playBtn.textContent='⏹ STOP'; playBtn.classList.add('playing');
      miniPlay.textContent='⏹'; miniDot.classList.add('on');
      statusDot.classList.add('on');
      setStatus(`Playing: ${(allPresets()[state.preset]||{}).name||'?'}`);
    }

    function stopMusic(){
      playing=false; if(schedTimer){clearInterval(schedTimer);schedTimer=null;}
      updateAudio();
      playBtn.textContent='▶ START'; playBtn.classList.remove('playing');
      miniPlay.textContent='▶'; miniDot.classList.remove('on');
      statusDot.classList.remove('on');
      setStatus('Stopped.');
    }

    function panicStop(){
      playing=false; if(schedTimer){clearInterval(schedTimer);schedTimer=null;}
      if(audioCtx&&masterG){
        const now=audioCtx.currentTime;
        masterG.gain.cancelScheduledValues(now); masterG.gain.setValueAtTime(0.0001,now);
      }
      playBtn.textContent='▶ START'; playBtn.classList.remove('playing');
      miniPlay.textContent='▶'; miniDot.classList.remove('on');
      statusDot.classList.remove('on');
      setStatus('⛔ Panic stop');
    }

    // ── VISUALIZER ───────────────────────────────────────────────────────────
    function drawViz(){
      requestAnimationFrame(drawViz);
      const dpr=window.devicePixelRatio||1;
      canvas.width=(panel.querySelector('.viz-wrap').clientWidth||300)*dpr;
      canvas.height=60*dpr;
      const W=canvas.width, H=canvas.height;
      ctx2d.clearRect(0,0,W,H);

      if(!state.visualizer){
        ctx2d.fillStyle='rgba(20,20,30,0.6)';
        ctx2d.fillRect(0,0,W,H);
        return;
      }

      const t=Date.now()/1000;
      if(!analyser||!playing){
        // idle sine wave — theme colored
        ctx2d.beginPath();
        for(let i=0;i<W;i++){
          const y=H/2+Math.sin(i/W*Math.PI*4+t*2)*H*0.15+Math.sin(i/W*Math.PI*7+t*1.3)*H*0.06;
          i===0?ctx2d.moveTo(i,y):ctx2d.lineTo(i,y);
        }
        const grad=ctx2d.createLinearGradient(0,0,W,0);
        grad.addColorStop(0,'rgba(255,100,200,0.5)');
        grad.addColorStop(0.5,'rgba(160,80,255,0.5)');
        grad.addColorStop(1,'rgba(80,160,255,0.5)');
        ctx2d.strokeStyle=grad;
        ctx2d.lineWidth=1.5*dpr;
        ctx2d.stroke();
        return;
      }

      analyser.getByteFrequencyData(analyserData);
      const bins=analyserData.length, bw=W/bins;
      for(let i=0;i<bins;i++){
        const v=analyserData[i]/255;
        const h2=v*H;
        const hue=270-v*130;
        ctx2d.fillStyle=`hsla(${hue},${70+v*30}%,${38+v*32}%,${0.65+v*0.35})`;
        ctx2d.fillRect(i*bw,H-h2,bw-0.5,h2);
        if(v>0.05){
          ctx2d.fillStyle=`hsla(${hue+40},100%,80%,${v*0.45})`;
          ctx2d.fillRect(i*bw,H-h2-2*dpr,bw-0.5,2*dpr);
        }
      }
      analyser.getByteTimeDomainData(analyserData);
      ctx2d.beginPath();
      ctx2d.strokeStyle='rgba(255,220,255,0.3)';
      ctx2d.lineWidth=1.2*dpr;
      for(let i=0;i<bins;i++){
        const x=i/bins*W;
        const y=((analyserData[i]/128)-1)*H*0.35+H/2;
        i===0?ctx2d.moveTo(x,y):ctx2d.lineTo(x,y);
      }
      ctx2d.stroke();
    }
    drawViz();

    // Mini visualizer
    function drawMini(){
      requestAnimationFrame(drawMini);
      const dpr=window.devicePixelRatio||1;
      const wrap=mini.querySelector('.mini-canvas-wrap');
      miniCanvas.width=(wrap.clientWidth||100)*dpr;
      miniCanvas.height=20*dpr;
      const W=miniCanvas.width, H=miniCanvas.height;
      miniCtx.clearRect(0,0,W,H);
      const t=Date.now()/1000;
      if(!analyser||!playing){
        miniCtx.beginPath();
        for(let i=0;i<W;i++){
          const y=H/2+Math.sin(i/W*Math.PI*3+t*1.8)*H*0.18;
          i===0?miniCtx.moveTo(i,y):miniCtx.lineTo(i,y);
        }
        miniCtx.strokeStyle='rgba(160,100,255,0.35)'; miniCtx.lineWidth=1; miniCtx.stroke();
        return;
      }
      analyser.getByteFrequencyData(analyserData);
      const bins=analyserData.length, bw=W/bins;
      for(let i=0;i<bins;i++){
        const v=analyserData[i]/255;
        miniCtx.fillStyle=`hsla(${270-v*130},70%,55%,${0.6+v*0.4})`;
        miniCtx.fillRect(i*bw,H-v*H,bw-0.3,v*H);
      }
    }
    drawMini();

    // ── SEQUENCER UI ─────────────────────────────────────────────────────────
    function buildSeqRows(){
      ['kick','snare','hat','ohat'].forEach(type=>{
        const row=panel.querySelector(`#lSeq${type.charAt(0).toUpperCase()+type.slice(1)}`);
        while(row.children.length>1) row.removeChild(row.lastChild);
        for(let i=0;i<16;i++){
          const c=document.createElement('div');
          c.className=`seq-cell ${type}${livePat[type][i]?' on':''}`;
          c.addEventListener('click',()=>{
            livePat[type][i]=livePat[type][i]?0:1;
            c.classList.toggle('on',!!livePat[type][i]);
          });
          row.appendChild(c);
        }
      });
    }

    setInterval(()=>{
      if(!playing) return;
      const cur=step%16;
      panel.querySelectorAll('.seq-cell').forEach((c,i)=>{
        c.classList.toggle('cur',i%16===cur);
      });
    },40);

    Object.keys(DRUM_PATTERNS).forEach(k=>{
      const o=document.createElement('option');
      o.value=k; o.textContent=k.charAt(0).toUpperCase()+k.slice(1);
      patSel.appendChild(o);
    });
    patSel.value=state.drumPattern||'standard';
    patSel.addEventListener('change',()=>{
      state.drumPattern=patSel.value;
      livePat=JSON.parse(JSON.stringify(DRUM_PATTERNS[state.drumPattern]));
      buildSeqRows(); saveState();
    });
    seqSave.addEventListener('click',()=>{
      state._customPat=JSON.parse(JSON.stringify(livePat));
      saveState(); setStatus('Custom pattern saved');
    });
    seqRand.addEventListener('click',()=>{
      ['kick','snare','hat','ohat'].forEach(tp=>{
        const ch={kick:0.2,snare:0.15,hat:0.5,ohat:0.08};
        for(let i=0;i<16;i++) livePat[tp][i]=Math.random()<ch[tp]?1:0;
      });
      buildSeqRows();
    });
    buildSeqRows();

    // ── PRESET CARDS ─────────────────────────────────────────────────────────
    function buildCards(){
      const cont=panel.querySelector('#lPCards');
      cont.innerHTML='';
      Object.entries(allPresets()).forEach(([k,p])=>{
        const d=document.createElement('div');
        d.className='pcard'+(state.preset===k?' on':'');
        d.innerHTML=`
          <div class="pcard-icon">${iconForGenre(p.genre)}</div>
          <div class="pcard-info">
            <div class="pcard-name">${p.name}</div>
            <div class="pcard-meta">${p.scale||''} · ${p.wave||''}</div>
          </div>
          <div class="pcard-bpm">${p.bpm||'?'}</div>
          <div class="pcard-tag">${k.startsWith('custom_')?'Custom':p.genre||''}</div>
        `;
        d.addEventListener('click',()=>{applyPreset(k);buildCards();});
        cont.appendChild(d);
      });
    }

    // ── APPLY PRESET ─────────────────────────────────────────────────────────
    function applyPreset(k){
      const p=allPresets()[k]; if(!p) return;
      state.preset=k; state.bpm=p.bpm||120;
      state.reverbWet=p.rev!==undefined?p.rev:0.2;
      state.filterCutoff=p.filter!==undefined?p.filter:0.5;
      state.arpMode=!!p.arp; state.chordMode=p.chord!==undefined?p.chord:true;
      state.drumPattern=p.drum||'standard';
      state.bassIntensity=p.bassInt!==undefined?p.bassInt:0.7;
      state.melodyDensity=p.melDens!==undefined?p.melDens:0.5;
      livePat=JSON.parse(JSON.stringify(DRUM_PATTERNS[state.drumPattern]||DRUM_PATTERNS.standard));
      presetSel.value=k;
      bpmIn.value=state.bpm; bpmVal.textContent=state.bpm;
      revWetIn.value=state.reverbWet; revV.textContent=Math.round(state.reverbWet*100)+'%';
      filtIn.value=state.filterCutoff; filtV.textContent=Math.round(state.filterCutoff*100)+'%';
      bassIntIn.value=state.bassIntensity; bassIntV.textContent=Math.round(state.bassIntensity*100)+'%';
      melDIn.value=state.melodyDensity; melDV.textContent=Math.round(state.melodyDensity*100)+'%';
      patSel.value=state.drumPattern;
      setTg('tArp',arpChk,state.arpMode); setTg('tChord',chordChk,state.chordMode);
      buildSeqRows();
      miniName.textContent=p.name;
      if(playing&&audioCtx){
        rng=mulberry32(hashStr(`${state.seed}|${state.preset}|v3`));
        step=0; nextT=audioCtx.currentTime+0.05;
      }
      saveState(); setStatus(`Loaded: ${p.name}`);
    }

    // ── BUILD PRESET SELECT ───────────────────────────────────────────────────
    function buildPresetSel(){
      presetSel.innerHTML='';
      Object.entries(allPresets()).forEach(([k,p])=>{
        const o=document.createElement('option');
        o.value=k; o.textContent=p.name;
        presetSel.appendChild(o);
      });
      presetSel.value=state.preset;
    }

    // ── POPULATE BUILD FORM ───────────────────────────────────────────────────
    const noteNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for(let m=36;m<=72;m++){
      const o=document.createElement('option');
      o.value=m;
      o.textContent=`${noteNames[m%12]}${Math.floor(m/12)-1} (${m})`;
      cRoot.appendChild(o);
    }
    cRoot.value=45;
    Object.entries(SCALE_NAMES).forEach(([k,v])=>{
      const o=document.createElement('option'); o.value=k; o.textContent=v;
      cScale.appendChild(o);
    });
    cScale.value='minor';
    Object.keys(DRUM_PATTERNS).forEach(k=>{
      const o=document.createElement('option'); o.value=k;
      o.textContent=k.charAt(0).toUpperCase()+k.slice(1);
      cDrum.appendChild(o);
    });

    // ── TOGGLES ──────────────────────────────────────────────────────────────
    function setTg(labelId,chk,val){
      chk.checked=!!val;
      const lbl=panel.querySelector('#'+labelId);
      if(lbl) lbl.classList.toggle('on',!!val);
    }
    function bindTg(labelId,chkId,key,cb){
      const lbl=panel.querySelector('#'+labelId);
      const chk=panel.querySelector('#'+chkId);
      if(!lbl||!chk) return;
      lbl.addEventListener('click',()=>{
        const v=!chk.checked; chk.checked=v;
        state[key]=v; lbl.classList.toggle('on',v);
        if(cb) cb(v); saveState();
      });
    }

    // ── SONG MODE LFO ENGINE ─────────────────────────────────────────────────
    // Each param has its own LFO phase offset and random-walk drift
    const LFO_PARAMS = {
      energy:    { min:0.15, max:0.95, stateKey:'energy',        elId:'lEnergy',  valId:'lEnVal',   fmt:v=>Math.round(v*100)+'%' },
      filter:    { min:0.1,  max:0.9,  stateKey:'filterCutoff',  elId:'lFilter',  valId:'lFiltVal', fmt:v=>Math.round(v*100)+'%' },
      rev:       { min:0.0,  max:0.65, stateKey:'reverbWet',     elId:'lRevWet',  valId:'lRevVal',  fmt:v=>Math.round(v*100)+'%' },
      bassInt:   { min:0.2,  max:0.95, stateKey:'bassIntensity', elId:'lBassInt', valId:'lBassIntVal', fmt:v=>Math.round(v*100)+'%' },
      melDens:   { min:0.1,  max:0.85, stateKey:'melodyDensity', elId:'lMelDens', valId:'lMelDVal', fmt:v=>Math.round(v*100)+'%' },
      bpm:       { min:70,   max:160,  stateKey:'bpm',           elId:'lBpm',     valId:'lBpmVal',  fmt:v=>Math.round(v) },
      eqBass:    { min:0.1,  max:0.9,  stateKey:'eqBass',        elId:'lEqB',     valId:null,       fmt:v=>'' },
      eqMid:     { min:0.1,  max:0.9,  stateKey:'eqMid',         elId:'lEqM',     valId:null,       fmt:v=>'' },
      eqHigh:    { min:0.1,  max:0.9,  stateKey:'eqHigh',        elId:'lEqH',     valId:null,       fmt:v=>'' },
      volume:    { min:0.1,  max:0.8,  stateKey:'volume',        elId:'lVolume',  valId:'lVolVal',  fmt:v=>Math.round(v*100)+'%' },
    };
    // per-param: phase offset (0..2π), random walk accumulator, user-override timer
    const lfoState = {};
    Object.keys(LFO_PARAMS).forEach(k=>{
      lfoState[k]={phase:Math.random()*Math.PI*2, walk:0, overrideUntil:0};
    });

    // Toggle checkboxes for which params to modulate
    const songModToggles = {
      energy:'stEnergy', filter:'stFilter', rev:'stRev',
      bassInt:'stBassInt', melDens:'stMelDens', bpm:'stBpm',
      eqBass:'stEq', eqMid:'stEq', eqHigh:'stEq',
      volume:'stVol',
    };
    function isSongParamEnabled(k){
      const tId=songModToggles[k];
      if(!tId) return true;
      const el=panel.querySelector('#'+tId);
      return el?el.classList.contains('on'):true;
    }

    // Song mode LFO tick — called every ~100ms
    let songTimer=null;
    let songBaseValues={};  // snapshot of values when song mode turned on

    function snapshotBase(){
      Object.entries(LFO_PARAMS).forEach(([k,p])=>{
        songBaseValues[k]=state[p.stateKey];
      });
    }

    function songTick(){
      if(!state.songMode) return;
      const now=Date.now();
      const speed=state.songSpeed||30;
      const depth=state.songDepth||0.35;
      const turb=state.songTurbulence||0.2;
      const dt=0.1; // 100ms tick

      Object.entries(LFO_PARAMS).forEach(([k,p])=>{
        if(!isSongParamEnabled(k)) return;
        const ls=lfoState[k];
        // don't modulate if user recently touched
        if(now<ls.overrideUntil) return;

        // advance LFO phase
        ls.phase+=dt*(Math.PI*2/speed);
        // add random walk jitter
        ls.walk+=(Math.random()-0.5)*turb*0.12;
        ls.walk*=0.94; // decay walk

        const base=songBaseValues[k]!==undefined?songBaseValues[k]:(p.min+p.max)/2;
        const range=(p.max-p.min)*depth*0.5;
        const raw=base+Math.sin(ls.phase)*range+ls.walk*(p.max-p.min)*0.2;
        const clamped=clamp(raw,p.min,p.max);

        // Apply
        const prev=state[p.stateKey];
        state[p.stateKey]=clamped;

        // Update UI if changed meaningfully
        if(Math.abs(clamped-prev)>0.001){
          const el=panel.querySelector('#'+p.elId);
          if(el) el.value=String(clamped);
          if(p.valId){
            const vEl=panel.querySelector('#'+p.valId);
            if(vEl){ vEl.textContent=p.fmt(clamped); vEl.classList.add('modulated'); }
          }
          // Live audio effects
          if(k==='rev') updateAudio();
          if(k.startsWith('eq')) updateEq();
          if(k==='volume') updateAudio();
        }
      });
    }

    function startSongMode(){
      snapshotBase();
      if(songTimer) clearInterval(songTimer);
      songTimer=setInterval(songTick,100);
      state.songMode=true;
      [songBtn,songTgl2].forEach(b=>{ b.textContent='♾ Song Mode'; b.classList.add('on'); });
      saveState();
    }
    function stopSongMode(){
      if(songTimer){clearInterval(songTimer);songTimer=null;}
      state.songMode=false;
      [songBtn,songTgl2].forEach(b=>{ b.textContent='♾ Song Mode'; b.classList.remove('on'); });
      // Remove modulation markers
      panel.querySelectorAll('.sr-val.modulated').forEach(e=>e.classList.remove('modulated'));
      panel.querySelectorAll('input[type=range].modulated').forEach(e=>e.classList.remove('modulated'));
      saveState();
    }

    // Mark a slider as user-overridden so song mode backs off
    function markOverride(paramKey){
      if(!lfoState[paramKey]) return;
      lfoState[paramKey].overrideUntil=Date.now()+8000; // 8 sec cooldown
      // Update base to new user value
      songBaseValues[paramKey]=state[LFO_PARAMS[paramKey]?.stateKey];
      const vEl=panel.querySelector('#'+(LFO_PARAMS[paramKey]?.valId));
      if(vEl) vEl.classList.remove('modulated');
    }

    // Song mode canvas (little animated display)
    function drawSongViz(){
      requestAnimationFrame(drawSongViz);
      const dpr=window.devicePixelRatio||1;
      const w=songCanvas.parentElement.clientWidth||200;
      songCanvas.width=w*dpr; songCanvas.height=18*dpr;
      const W=songCanvas.width, H=songCanvas.height;
      songCtx.clearRect(0,0,W,H);
      if(!state.songMode){
        songCtx.fillStyle='rgba(255,200,40,0.08)';
        songCtx.fillRect(0,0,W,H);
        return;
      }
      const t=Date.now()/1000;
      const sp=state.songSpeed||30;
      // draw multiple sine waves, one per active param
      const colors=['#ffcc40','#ff9030','#ff6060','#60ff80','#40c0ff','#c060ff'];
      let ci=0;
      Object.keys(LFO_PARAMS).forEach(k=>{
        if(!isSongParamEnabled(k)) return;
        const ls=lfoState[k];
        songCtx.beginPath();
        for(let i=0;i<W;i++){
          const ph=ls.phase+(i/W)*Math.PI*4;
          const y=H/2+Math.sin(ph)*H*0.38;
          i===0?songCtx.moveTo(i,y):songCtx.lineTo(i,y);
        }
        songCtx.strokeStyle=colors[ci%colors.length]+'88';
        songCtx.lineWidth=1; songCtx.stroke(); ci++;
      });
    }
    drawSongViz();

    // ── THEME SWATCHES ────────────────────────────────────────────────────────
    const swatchColors={
      default:'#a060ff', matrix:'#00ff41', oldschool:'#ffaa00',
      torn:'#cc2222', ice:'#40d0ff', custom:'#ff80ff'
    };
    Object.entries(swatchColors).forEach(([k,color])=>{
      const sw=document.createElement('div');
      sw.className='swatch'+(state.theme===k?' on':'');
      sw.style.background=color;
      sw.title=THEMES[k]?THEMES[k].name||k:k;
      sw.textContent=sw.title.slice(0,2);
      sw.addEventListener('click',()=>{
        state.theme=k; saveState();
        applyTheme(k);
        swatchCont.querySelectorAll('.swatch').forEach(s=>s.classList.remove('on'));
        sw.classList.add('on');
        customFields.style.display=k==='custom'?'block':'none';
      });
      swatchCont.appendChild(sw);
    });
    customFields.style.display=state.theme==='custom'?'block':'none';

    accentColor.value=state.customThemeAccent||'#9060ff';
    accentHex.value=state.customThemeAccent||'#9060ff';
    bgOpIn.value=parseFloat((state.customThemeBg||'rgba(8,8,16,0.97)').match(/[\d.]+/g)?.[3]||'0.97');
    bgOpV.textContent=Math.round(Number(bgOpIn.value)*100)+'%';

    accentColor.addEventListener('input',()=>{ accentHex.value=accentColor.value; });
    accentHex.addEventListener('input',()=>{
      if(/^#[0-9a-fA-F]{6}$/.test(accentHex.value)) accentColor.value=accentHex.value;
    });
    bgOpIn.addEventListener('input',()=>{ bgOpV.textContent=Math.round(Number(bgOpIn.value)*100)+'%'; });
    applyCustom.addEventListener('click',()=>{
      const hex=accentColor.value;
      const op=Number(bgOpIn.value)||0.97;
      state.customThemeAccent=hex;
      state.customThemeBg=`rgba(8,8,14,${op})`;
      state.theme='custom'; saveState();
      THEMES.custom=buildThemeVars('custom');
      applyTheme('custom');
    });

    // ── RENDER ALL VALUES ─────────────────────────────────────────────────────
    function renderAll(){
      bpmIn.value=state.bpm; bpmVal.textContent=state.bpm;
      enIn.value=state.energy; enVal.textContent=Math.round(state.energy*100)+'%';
      volIn.value=state.volume; volVal.textContent=Math.round(state.volume*100)+'%';
      seedIn.value=state.seed;
      bassIntIn.value=state.bassIntensity||0.7; bassIntV.textContent=Math.round((state.bassIntensity||0.7)*100)+'%';
      melDIn.value=state.melodyDensity||0.5; melDV.textContent=Math.round((state.melodyDensity||0.5)*100)+'%';
      filtIn.value=state.filterCutoff||0.5; filtV.textContent=Math.round((state.filterCutoff||0.5)*100)+'%';
      revWetIn.value=state.reverbWet||0.18; revV.textContent=Math.round((state.reverbWet||0.18)*100)+'%';
      const ap2=allPresets(); const sw2=ap2[state.preset]?.swing||0.06;
      swingIn.value=sw2; swingVal.textContent=Math.round(sw2*100)+'%';
      eqBIn.value=state.eqBass||0.5; eqLIn.value=state.eqLow||0.5;
      eqMIn.value=state.eqMid||0.5; eqHIn.value=state.eqHigh||0.5; eqAIn.value=state.eqAir||0.5;
      arpRateS.value=String(state.arpRate||2); voicS.value=state.chordVoicing||'triad';
      songSp.value=state.songSpeed||30; songSpV.textContent=(state.songSpeed||30)+'s';
      songDep.value=state.songDepth||0.35; songDepV.textContent=Math.round((state.songDepth||0.35)*100)+'%';
      songTurb.value=state.songTurbulence||0.2; songTurbV.textContent=Math.round((state.songTurbulence||0.2)*100)+'%';
      setTg('tDrums',drumsChk,state.drums); setTg('tBass',bassChk,state.bass);
      setTg('tMelody',melChk,state.melody); setTg('tFx',fxChk,state.fx);
      setTg('tRev',revChk,state.reverb); setTg('tViz',vizChk,state.visualizer);
      setTg('tArp',arpChk,state.arpMode); setTg('tChord',chordChk,state.chordMode);
      if(state.songMode) startSongMode();
    }

    // ── TAB SWITCHING ─────────────────────────────────────────────────────────
    tabs.forEach(tab=>{
      tab.addEventListener('click',()=>{
        tabs.forEach(t=>t.classList.remove('on'));
        panel.querySelectorAll('.pane').forEach(p2=>p2.classList.remove('on'));
        tab.classList.add('on');
        const pane=panel.querySelector('#lPane-'+tab.dataset.tab);
        if(pane) pane.classList.add('on');
        state.activeTab=tab.dataset.tab;
        if(tab.dataset.tab==='genres') buildCards();
        if(tab.dataset.tab==='build') buildCustomList();
      });
    });

    // ── DRAG ─────────────────────────────────────────────────────────────────
    let drag=null;
    function startDrag(e,el){
      if(e.target.closest('button,input,select')) return;
      state.collapsed=false; panel.classList.remove('collapsed');
      drag={dx:e.clientX-panel.offsetLeft, dy:e.clientY-panel.offsetTop};
      el.setPointerCapture?.(e.pointerId); e.preventDefault();
    }
    [dragBar,handle].forEach(el=>{
      el.addEventListener('pointerdown',e=>startDrag(e,el));
      el.addEventListener('pointermove',e=>{
        if(!drag) return;
        state.x=clamp(e.clientX-drag.dx,6,Math.max(6,innerWidth-panel.offsetWidth-6));
        state.y=clamp(e.clientY-drag.dy,6,Math.max(6,innerHeight-panel.offsetHeight-6));
        panel.style.left=state.x+'px'; panel.style.top=state.y+'px';
      });
      el.addEventListener('pointerup',()=>{if(drag){drag=null;saveState();}});
      el.addEventListener('pointercancel',()=>drag=null);
    });
    handle.addEventListener('click',()=>{
      if(drag) return;
      state.collapsed=!state.collapsed;
      panel.classList.toggle('collapsed',state.collapsed); saveState();
    });
    colBtn.addEventListener('click',()=>{
      state.collapsed=!state.collapsed;
      panel.classList.toggle('collapsed',state.collapsed); saveState();
    });

    // Miniplayer drag
    let miniDrag=null, miniVisible=true;
    mini.addEventListener('pointerdown',e=>{
      if(e.target===miniPlay||e.target.closest('.mini-play')) return;
      miniDrag={dx:e.clientX-mini.offsetLeft, dy:e.clientY-mini.offsetTop};
      mini.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    mini.addEventListener('pointermove',e=>{
      if(!miniDrag) return;
      mini.style.left=clamp(e.clientX-miniDrag.dx,4,innerWidth-mini.offsetWidth-4)+'px';
      mini.style.top=clamp(e.clientY-miniDrag.dy,4,innerHeight-mini.offsetHeight-4)+'px';
    });
    mini.addEventListener('pointerup',()=>{
      if(miniDrag){ miniDrag=null; return; }
      // click = expand panel
      state.collapsed=false; panel.classList.remove('collapsed');
    });
    mini.addEventListener('pointercancel',()=>miniDrag=null);
    mini.querySelector('.mini-expand').addEventListener('click',()=>{
      state.collapsed=false; panel.classList.remove('collapsed');
    });
    miniPlay.addEventListener('click',e=>{
      e.stopPropagation();
      playing?stopMusic():startMusic();
    });
    miniBtn.addEventListener('click',()=>{
      miniVisible=!miniVisible;
      mini.style.display=miniVisible?'flex':'none';
    });

    // ── PLAY CONTROLS ─────────────────────────────────────────────────────────
    playBtn.addEventListener('click',()=>playing?stopMusic():startMusic());
    panicBtn.addEventListener('click',panicStop);
    [songBtn,songTgl2].forEach(b=>{
      b.addEventListener('click',()=>state.songMode?stopSongMode():startSongMode());
    });

    presetSel.addEventListener('change',()=>applyPreset(presetSel.value));

    function bindSlider(elId,key,valId,fmt,cb,paramKey){
      const el=panel.querySelector('#'+elId);
      const vEl=valId?panel.querySelector('#'+valId):null;
      if(!el) return;
      el.addEventListener('input',()=>{
        const v=Number(el.value); state[key]=v;
        if(vEl) vEl.textContent=fmt(v);
        if(cb) cb(v);
        if(paramKey) markOverride(paramKey);
        saveState();
      });
    }

    bindSlider('lBpm','bpm','lBpmVal',v=>Math.round(v)+'',null,'bpm');
    bindSlider('lEnergy','energy','lEnVal',v=>Math.round(v*100)+'%',null,'energy');
    bindSlider('lVolume','volume','lVolVal',v=>Math.round(v*100)+'%',updateAudio,'volume');
    bindSlider('lBassInt','bassIntensity','lBassIntVal',v=>Math.round(v*100)+'%',null,'bassInt');
    bindSlider('lMelDens','melodyDensity','lMelDVal',v=>Math.round(v*100)+'%',null,'melDens');
    bindSlider('lFilter','filterCutoff','lFiltVal',v=>Math.round(v*100)+'%',null,'filter');
    bindSlider('lRevWet','reverbWet','lRevVal',v=>Math.round(v*100)+'%',updateAudio,'rev');
    bindSlider('lEqB','eqBass',null,v=>'',updateEq,'eqBass');
    bindSlider('lEqL','eqLow',null,v=>'',updateEq);
    bindSlider('lEqM','eqMid',null,v=>'',updateEq,'eqMid');
    bindSlider('lEqH','eqHigh',null,v=>'',updateEq,'eqHigh');
    bindSlider('lEqA','eqAir',null,v=>'',updateEq);

    songSp.addEventListener('input',()=>{ state.songSpeed=Number(songSp.value); songSpV.textContent=state.songSpeed+'s'; saveState(); });
    songDep.addEventListener('input',()=>{ state.songDepth=Number(songDep.value); songDepV.textContent=Math.round(state.songDepth*100)+'%'; saveState(); });
    songTurb.addEventListener('input',()=>{ state.songTurbulence=Number(songTurb.value); songTurbV.textContent=Math.round(state.songTurbulence*100)+'%'; saveState(); });

    seedIn.addEventListener('change',()=>{
      state.seed=seedIn.value.trim()||'torn-war-777'; seedIn.value=state.seed;
      if(playing&&audioCtx){ rng=mulberry32(hashStr(`${state.seed}|${state.preset}|v3`)); step=0; nextT=audioCtx.currentTime+0.05; }
      saveState(); setStatus('Seed: '+state.seed);
    });
    newSeedB.addEventListener('click',()=>{
      const c='abcdefghijklmnopqrstuvwxyz0123456789';
      let s='torn-'; for(let i=0;i<8;i++) s+=c[Math.floor(Math.random()*c.length)];
      state.seed=s; seedIn.value=s;
      if(playing&&audioCtx){ rng=mulberry32(hashStr(`${state.seed}|${state.preset}|v3`)); step=0; nextT=audioCtx.currentTime+0.05; }
      saveState(); setStatus('New seed: '+s);
    });
    randB.addEventListener('click',()=>{
      const ks=Object.keys(allPresets());
      applyPreset(ks[Math.floor(Math.random()*ks.length)]);
      state.energy=Number((0.3+Math.random()*0.65).toFixed(2));
      enIn.value=state.energy; enVal.textContent=Math.round(state.energy*100)+'%';
      newSeedB.click(); saveState();
    });

    bindTg('tDrums','lDrums','drums');
    bindTg('tBass','lBass','bass');
    bindTg('tMelody','lMelody','melody');
    bindTg('tFx','lFx','fx',()=>updateAudio());
    bindTg('tRev','lRev','reverb',()=>updateAudio());
    bindTg('tViz','lViz','visualizer');
    bindTg('tArp','lArp','arpMode');
    bindTg('tChord','lChord','chordMode');

    // Song mode sub-toggles
    ['stEnergy','stFilter','stRev','stBassInt','stMelDens','stBpm','stEq','stVol'].forEach(id=>{
      const el=panel.querySelector('#'+id);
      if(!el) return;
      const chk=el.querySelector('input');
      el.addEventListener('click',()=>{
        const v=!chk.checked; chk.checked=v; el.classList.toggle('on',v);
      });
    });

    arpRateS.addEventListener('change',()=>{ state.arpRate=Number(arpRateS.value); saveState(); });
    voicS.addEventListener('change',()=>{ state.chordVoicing=voicS.value; saveState(); });
    swingIn.addEventListener('input',()=>{
      const p=allPresets()[state.preset]; if(p) p.swing=Number(swingIn.value);
      swingVal.textContent=Math.round(Number(swingIn.value)*100)+'%';
    });

    // ── CUSTOM GENRE ─────────────────────────────────────────────────────────
    cLoad.addEventListener('click',()=>{
      const p=allPresets()[state.preset]; if(!p) return;
      cName.value=p.name+' Copy';
      cRoot.value=p.root||45; cScale.value=p.scale||'minor';
      cBpm.value=p.bpm||120; cSwing.value=p.swing||0.05;
      cWave.value=p.wave||'sawtooth'; cBassWave.value=p.bassWave||'sine';
      cChords.value=(p.chords||[0,5,3,6]).join(',');
      cDrum.value=p.drum||p.drumPattern||'standard'; cGenre.value=p.genre||'custom';
      cRev.value=p.rev||p.reverbWet||0.2; cFilt.value=p.filter||p.filterCutoff||0.5;
      cBassInt.value=p.bassInt||p.bassIntensity||0.7; cMelD.value=p.melDens||p.melodyDensity||0.5;
      cStatus.textContent='Loaded from: '+p.name;
    });
    cSave.addEventListener('click',()=>{
      const name=cName.value.trim(); if(!name){cStatus.textContent='⚠ Need a name';return;}
      const ch=cChords.value.split(',').map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
      if(!ch.length){cStatus.textContent='⚠ Need chord degrees';return;}
      const key=name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,24);
      state.customGenres[key]={
        name,genre:cGenre.value,root:Number(cRoot.value)||45,scale:cScale.value,
        bpm:clamp(Number(cBpm.value)||120,40,240),swing:clamp(Number(cSwing.value)||0.05,0,0.4),
        wave:cWave.value,bassWave:cBassWave.value,chords:ch,
        drum:cDrum.value,
        rev:clamp(Number(cRev.value)||0.2,0,1),filter:clamp(Number(cFilt.value)||0.5,0,1),
        bassInt:clamp(Number(cBassInt.value)||0.7,0,1),melDens:clamp(Number(cMelD.value)||0.5,0,1),
        arp:false,chord:true,
      };
      saveState(); buildPresetSel(); buildCustomList();
      cStatus.textContent='✓ Saved: '+name;
    });

    function buildCustomList(){
      const el=panel.querySelector('#lCustomList'); el.innerHTML='';
      const c=state.customGenres||{};
      if(!Object.keys(c).length){
        el.innerHTML='<div style="font-size:8px;color:var(--lio-text-dim);padding:3px">No custom genres saved yet.</div>';
        return;
      }
      Object.entries(c).forEach(([k,p])=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:4px 6px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.06)';
        row.innerHTML=`<span style="font-size:14px">${iconForGenre(p.genre)}</span><span style="flex:1;font-size:9px;font-weight:700;color:var(--lio-text)">${p.name}</span><span style="font-size:8px;color:var(--lio-text-dim)">${p.bpm}bpm</span>`;
        const ub=document.createElement('button');
        ub.textContent='Use'; ub.style.cssText='padding:2px 6px;font-size:8px';
        ub.addEventListener('click',()=>{ applyPreset('custom_'+k); buildPresetSel(); });
        const db=document.createElement('button');
        db.textContent='✕'; db.style.cssText='padding:2px 6px;font-size:8px;color:#ff8080;border-color:rgba(255,80,80,0.3)';
        db.addEventListener('click',()=>{
          if(!confirm('Delete "'+p.name+'"?')) return;
          delete state.customGenres[k]; saveState(); buildCustomList(); buildPresetSel();
        });
        row.appendChild(ub); row.appendChild(db); el.appendChild(row);
      });
    }

    // ── PLACE PANELS ─────────────────────────────────────────────────────────
    function placePanel(){
      const W=panel.offsetWidth||358, H2=panel.offsetHeight||500;
      if(state.x===null) state.x=innerWidth-W-10;
      if(state.y===null) state.y=innerHeight-H2-80;
      state.x=clamp(state.x,6,Math.max(6,innerWidth-W-6));
      state.y=clamp(state.y,6,Math.max(6,innerHeight-H2-6));
      panel.style.left=state.x+'px'; panel.style.top=state.y+'px';
      saveState();
    }
    function placeMini(){
      mini.style.bottom='18px'; mini.style.right='18px';
      mini.style.left=''; mini.style.top='';
    }

    // ── INIT ─────────────────────────────────────────────────────────────────
    buildPresetSel(); renderAll(); buildCustomList(); buildCards();
    setTimeout(placePanel,60); placeMini();
    window.addEventListener('resize',placePanel);
    applyTheme(state.theme||'default');

    if(state._customPat&&state.drumPattern==='_custom'){
      livePat=JSON.parse(JSON.stringify(state._customPat)); buildSeqRows();
    }

    miniName.textContent=(allPresets()[state.preset]||{}).name||'?';
    mini.style.display='flex';

    setStatus('Tap ▶ START · v3.0');
  });
})();
