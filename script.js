// ==UserScript==
// @name         like looking in a mirror
// @namespace    tornscripts
// @version      1.0.0
// @description  Duplicates your profile picture + honor bar panel onto Torn Home for quick mirror vibes.
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const HOME_PATHS = new Set(['/index.php']);
  const PROFILE_URL = '/profiles.php?XID=me';
  const CONTAINER_ID = 'mirror-profile-panel';

  if (!HOME_PATHS.has(location.pathname)) return;

  const style = document.createElement('style');
  style.textContent = `
    #${CONTAINER_ID} {
      margin: 12px 0;
      border: 1px solid #2c2c2c;
      border-radius: 8px;
      overflow: hidden;
      background: var(--default-bg-panel-color, #111);
    }
    #${CONTAINER_ID} .mirror-title {
      padding: 8px 12px;
      font-weight: 700;
      border-bottom: 1px solid #2c2c2c;
      background: rgba(255,255,255,0.03);
    }
    #${CONTAINER_ID} .mirror-body {
      padding: 8px;
    }
    #${CONTAINER_ID} .mirror-error {
      padding: 10px 12px;
      color: #ff8686;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  const mount = document.createElement('section');
  mount.id = CONTAINER_ID;
  mount.innerHTML = '<div class="mirror-title">Like Looking in a Mirror</div><div class="mirror-body">Loading your profile mirror…</div>';

  const homeMain = document.querySelector('#mainContainer .content-wrapper, #mainContainer, #mainContainer > div');
  if (!homeMain) return;
  homeMain.prepend(mount);

  const bodyEl = mount.querySelector('.mirror-body');

  fetch(PROFILE_URL, { credentials: 'include' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const selectors = [
        '.user-profile .profile-image-wrapper',
        '.profile-wrapper .profileImage',
        '.profile-top .profileImage',
        '.user-profile .honorWrap',
        '.profile-container .honorWrap',
        '.profileImage, .honorWrap'
      ];

      let block = null;
      for (const sel of selectors) {
        const found = doc.querySelector(sel);
        if (found) {
          block = found.closest('.profile-wrapper, .user-profile, .profile-top, .content-wrapper') || found;
          break;
        }
      }

      if (!block) {
        bodyEl.innerHTML = '<div class="mirror-error">Could not find profile pic + honor bar block on your profile page.</div>';
        return;
      }

      const clone = document.createElement('div');
      clone.innerHTML = block.outerHTML;

      clone.querySelectorAll('script').forEach((s) => s.remove());
      clone.querySelectorAll('a').forEach((a) => {
        const href = a.getAttribute('href');
        if (href && href.startsWith('/')) a.href = `https://www.torn.com${href}`;
      });

      bodyEl.innerHTML = '';
      bodyEl.append(...clone.childNodes);
    })
    .catch((err) => {
      bodyEl.innerHTML = `<div class="mirror-error">Mirror failed to load: ${err.message}</div>`;
    });
})();
