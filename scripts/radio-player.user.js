// ==UserScript==
// @name         Torn Radio Player
// @namespace    tornscripts
// @version      1.0.0
// @description  Embeds a minimizable caster.fm radio player on every Torn page
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'torn_radio_minimized';
  const PANEL_ID = 'torn-radio-player';
  const TOGGLE_BTN_ID = 'torn-radio-toggle';

  // dont inject twice
  if (document.getElementById(PANEL_ID)) return;

  // inject the caster.fm embed script once
  if (!document.getElementById('caster-fm-embed')) {
    var casterScript = document.createElement('script');
    casterScript.id = 'caster-fm-embed';
    casterScript.src = '//cdn.cloud.caster.fm//widgets/embed.js';
    document.head.appendChild(casterScript);
  }

  // styles
  var style = document.createElement('style');
  style.textContent =
    '#' + PANEL_ID + ' {' +
    '  position: fixed;' +
    '  bottom: 12px;' +
    '  right: 12px;' +
    '  z-index: 99999;' +
    '  background: #111;' +
    '  border: 1px solid #333;' +
    '  border-radius: 8px;' +
    '  overflow: hidden;' +
    '  transition: width 0.2s ease, height 0.2s ease;' +
    '  font-family: "Courier New", monospace;' +
    '}' +
    '#' + PANEL_ID + '.minimized {' +
    '  width: 44px;' +
    '  height: 44px;' +
    '  border-radius: 50%;' +
    '  cursor: pointer;' +
    '}' +
    '#' + PANEL_ID + '.minimized .radio-content,' +
    '#' + PANEL_ID + '.minimized .radio-header {' +
    '  display: none;' +
    '}' +
    '#' + PANEL_ID + ' .radio-header {' +
    '  display: flex;' +
    '  align-items: center;' +
    '  justify-content: space-between;' +
    '  padding: 6px 10px;' +
    '  background: #1a1a1a;' +
    '  border-bottom: 1px solid #333;' +
    '  color: #8AA32E;' +
    '  font-size: 12px;' +
    '  font-weight: 700;' +
    '  user-select: none;' +
    '}' +
    '#' + PANEL_ID + ' .radio-header .radio-title {' +
    '  display: flex;' +
    '  align-items: center;' +
    '  gap: 6px;' +
    '}' +
    '#' + PANEL_ID + ' .radio-header .radio-dot {' +
    '  width: 8px;' +
    '  height: 8px;' +
    '  border-radius: 50%;' +
    '  background: #8AA32E;' +
    '  animation: radio-pulse 2s ease-in-out infinite;' +
    '}' +
    '@keyframes radio-pulse {' +
    '  0%, 100% { opacity: 1; }' +
    '  50% { opacity: 0.3; }' +
    '}' +
    '#' + PANEL_ID + '.minimized .radio-dot {' +
    '  display: none;' +
    '}' +
    '#' + PANEL_ID + ' .radio-minimize-btn {' +
    '  background: none;' +
    '  border: none;' +
    '  color: #8AA32E;' +
    '  font-size: 16px;' +
    '  cursor: pointer;' +
    '  padding: 0 4px;' +
    '  line-height: 1;' +
    '}' +
    '#' + PANEL_ID + ' .radio-minimize-btn:hover {' +
    '  color: #b3cc4e;' +
    '}' +
    '#' + PANEL_ID + ' .radio-content {' +
    '  padding: 8px;' +
    '}' +
    '#' + PANEL_ID + ' .radio-content .cstrEmbed {' +
    '  min-width: 260px;' +
    '}' +
    // minimized state: show a small icon in the circle
    '#' + PANEL_ID + '.minimized .radio-restore-icon {' +
    '  display: flex;' +
    '}' +
    '#' + PANEL_ID + ' .radio-restore-icon {' +
    '  display: none;' +
    '  width: 100%;' +
    '  height: 100%;' +
    '  align-items: center;' +
    '  justify-content: center;' +
    '  color: #8AA32E;' +
    '  font-size: 20px;' +
    '  animation: radio-pulse 2s ease-in-out infinite;' +
    '}' +
    // when not minimized the panel has a fixed size
    '#' + PANEL_ID + ':not(.minimized) {' +
    '  width: 300px;' +
    '}';
  document.head.appendChild(style);

  // build the panel
  var panel = document.createElement('div');
  panel.id = PANEL_ID;

  var isMinimized = GM_getValue(STORAGE_KEY, false);
  if (isMinimized) panel.classList.add('minimized');

  // header
  var header = document.createElement('div');
  header.className = 'radio-header';

  var titleWrap = document.createElement('span');
  titleWrap.className = 'radio-title';

  var dot = document.createElement('span');
  dot.className = 'radio-dot';

  var titleText = document.createElement('span');
  titleText.textContent = 'Radio';

  titleWrap.appendChild(dot);
  titleWrap.appendChild(titleText);

  var minimizeBtn = document.createElement('button');
  minimizeBtn.className = 'radio-minimize-btn';
  minimizeBtn.textContent = '—';
  minimizeBtn.title = 'Minimize';
  minimizeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    panel.classList.add('minimized');
    GM_setValue(STORAGE_KEY, true);
  });

  header.appendChild(titleWrap);
  header.appendChild(minimizeBtn);

  // content area with the caster.fm embed
  var content = document.createElement('div');
  content.className = 'radio-content';

  var embedDiv = document.createElement('div');
  embedDiv.setAttribute('data-type', 'podcastsPlayer');
  embedDiv.setAttribute('data-publicToken', '2d9e61c3-872b-431e-a9d7-e4f7e4190dc6');
  embedDiv.setAttribute('data-theme', 'dark');
  embedDiv.setAttribute('data-color', '8AA32E');
  embedDiv.setAttribute('data-channelId', 'a21639a7-533c-42ce-b8aa-af562a550644');
  embedDiv.setAttribute('data-rendered', 'false');
  embedDiv.className = 'cstrEmbed';
  embedDiv.innerHTML =
    '<a href="https://www.caster.fm">Shoutcast Hosting</a> ' +
    '<a href="https://www.caster.fm">Stream Hosting</a> ' +
    '<a href="https://www.caster.fm">Radio Server Hosting</a>';

  content.appendChild(embedDiv);

  // restore icon for minimized state
  var restoreIcon = document.createElement('div');
  restoreIcon.className = 'radio-restore-icon';
  restoreIcon.textContent = '♪';

  // clicking the minimized panel restores it
  panel.addEventListener('click', function () {
    if (panel.classList.contains('minimized')) {
      panel.classList.remove('minimized');
      GM_setValue(STORAGE_KEY, false);
    }
  });

  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(restoreIcon);

  // append to body after a short delay so torn's DOM is ready
  var tryAppend = function () {
    if (document.body) {
      document.body.appendChild(panel);
    } else {
      setTimeout(tryAppend, 200);
    }
  };
  tryAppend();
})();
