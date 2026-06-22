// ==UserScript==
// @name         Torn Radio Player
// @namespace    tornscripts
// @version      1.1.0
// @description  Embeds the caster.fm radio player on every Torn page. Autoplays.
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const WRAPPER_ID = 'torn-radio-player';

  // dont inject twice
  if (document.getElementById(WRAPPER_ID)) return;

  // inject the caster.fm embed script once
  if (!document.getElementById('caster-fm-embed')) {
    var s = document.createElement('script');
    s.id = 'caster-fm-embed';
    s.src = '//cdn.cloud.caster.fm//widgets/embed.js';
    document.head.appendChild(s);
  }

  // wrapper styles
  var style = document.createElement('style');
  style.textContent =
    '#' + WRAPPER_ID + ' {' +
    '  position: fixed;' +
    '  bottom: 12px;' +
    '  right: 12px;' +
    '  z-index: 99999;' +
    '}';
  document.head.appendChild(style);

  // build the embed wrapper
  var wrap = document.createElement('div');
  wrap.id = WRAPPER_ID;

  var embed = document.createElement('div');
  embed.setAttribute('data-type', 'newStreamPlayer');
  embed.setAttribute('data-publicToken', '2d9e61c3-872b-431e-a9d7-e4f7e4190dc6');
  embed.setAttribute('data-theme', 'light');
  embed.setAttribute('data-color', '8AA32E');
  embed.setAttribute('data-channelId', 'a21639a7-533c-42ce-b8aa-af562a550644');
  embed.setAttribute('data-rendered', 'false');
  embed.className = 'cstrEmbed';
  embed.innerHTML =
    '<a href="https://www.caster.fm">Shoutcast Hosting</a> ' +
    '<a href="https://www.caster.fm">Stream Hosting</a> ' +
    '<a href="https://www.caster.fm">Radio Server Hosting</a>';

  wrap.appendChild(embed);

  // append once body is ready
  var tryAppend = function () {
    if (document.body) {
      document.body.appendChild(wrap);
    } else {
      setTimeout(tryAppend, 200);
    }
  };
  tryAppend();
})();
