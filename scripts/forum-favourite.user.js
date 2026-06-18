// ==UserScript==
// @name         Forum Favourite (Experimental)
// @namespace    torn.forum.fav
// @version      0.9.1-exp
// @description  Favourite sub-forums with animated reordering + drag-to-reorder all categories.
// @author       shaul [3908280]
// @match        https://www.torn.com/forums.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    var STORAGE_KEY = 'ff_forum_fav';
    var ORDER_KEY = 'ff_forum_order';
    var POLL_INTERVAL = 250;
    var STAR_COLOR = '#f3da35';
    var ANIM_MS = 350;

    var saved = loadSaved();
    var customOrder = loadCustomOrder();
    var originalOrder = new Map(); // data-href -> [dataUrl,...] snapshot per list
    var pollTimer = null;
    var processedLists = [];
    var editMode = false;
    var dragState = null;

    GM_addStyle(
        '.ffStar{padding:6px;cursor:pointer;display:inline-flex;align-items:center;vertical-align:middle;font-size:15px;line-height:1;color:' + STAR_COLOR + '}' +
        '.forum-list{display:flex!important;flex-direction:column}' +
        '.ff-drag-handle{cursor:grab;margin-right:6px;font-size:14px;color:#666;display:none;align-items:center;vertical-align:middle;user-select:none}' +
        '.ff-drag-handle:active{cursor:grabbing}' +
        '.ff-edit-mode .ff-drag-handle{display:inline-flex}' +
        '.ff-dragging{opacity:0.4;outline:2px dashed ' + STAR_COLOR + '}' +
        '.ff-edit-btn{cursor:pointer;margin-left:8px;font-size:13px;color:#888;display:inline;vertical-align:middle}' +
        '.ff-edit-btn:hover{color:#f3da35}' +
        '#ff-edit-toggle{position:fixed;bottom:12px;right:12px;z-index:99999;background:#1a1a1a;color:' + STAR_COLOR + ';border:1px solid ' + STAR_COLOR + ';padding:6px 14px;cursor:pointer;font-size:12px;border-radius:4px;font-family:monospace}' +
        '#ff-edit-toggle:hover{background:#2a2a2a}' +
        '.ff-animating{transition:transform ' + ANIM_MS + 'ms cubic-bezier(.25,.1,.25,1)}'
    );

    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    // ─── Polling ───────────────────────────────────────────────

    function onHashChange() {
        clearInterval(pollTimer);
        processedLists = [];
        originalOrder.clear();
        var hash = window.location.hash;
        if (!hash || hash === '' || hash.indexOf('/p=main') !== -1 || hash.indexOf('#/p=') !== 0) {
            startPolling();
        }
    }

    function startPolling() {
        pollTimer = setInterval(function() {
            var lists = document.querySelectorAll('.forum-list:not([data-ff-processed])');
            if (!lists.length) return;
            var idx = processedLists.length;
            for (var i = 0; i < lists.length; i++) {
                lists[i].setAttribute('data-ff-processed', 'true');
                if (idx === 0) { processedLists.push(true); idx++; continue; }
                processList(lists[i], idx);
                processedLists.push(true);
                idx++;
            }
            if (!document.querySelectorAll('.forum-list:not([data-ff-processed])').length) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }, POLL_INTERVAL);
    }

    // ─── Process a forum list ──────────────────────────────────

    function processList(forumList, idx) {
        var idxKey = String(idx);
        var items = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');

        // Snapshot original DOM order once
        if (!originalOrder.has(idxKey)) {
            var snap = [];
            for (var i = 0; i < items.length; i++) {
                snap.push(items[i].getAttribute('data-href'));
            }
            originalOrder.set(idxKey, snap);
        }

        // Apply saved custom order
        if (customOrder[idxKey]) {
            applyCustomOrder(forumList, items, idxKey);
        }

        for (var i = 0; i < items.length; i++) {
            var li = items[i];
            var href = li.getAttribute('data-href');
            if (li.querySelector('.ffStar')) continue;

            var isFav = saved[idxKey] && saved[idxKey].indexOf(href) !== -1;

            // Star
            var star = document.createElement('span');
            star.className = 'ffStar';
            star.textContent = isFav ? '\u2605' : '\u2606';
            star.setAttribute('data-href', href);
            star.setAttribute('data-idx', idxKey);
            star.setAttribute('data-fav', isFav ? '1' : '0');
            star.addEventListener('click', onStarClick);
            var desc = li.querySelector('.name a .desc');
            if (desc) desc.appendChild(star);

            // Drag handle
            var handle = document.createElement('span');
            handle.className = 'ff-drag-handle';
            handle.textContent = '\u2630';
            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });
            var nameEl = li.querySelector('.name');
            if (nameEl) nameEl.insertBefore(handle, nameEl.firstChild);

            // Move favs to top immediately (no animation on initial load)
            if (isFav) {
                var target = forumList.querySelector('li[data-href^="forums.php?p=forums"]');
                if (target && target !== li) {
                    forumList.insertBefore(li, target);
                }
            }
        }

        // Edit button — place inside the title <li class="name"> next to heading text
        var wrap = forumList.closest('.forum-wrap');
        if (wrap && !wrap.querySelector('.ff-edit-btn')) {
            var titleName = wrap.querySelector('.title-black .name');
            if (titleName) {
                var btn = document.createElement('span');
                btn.className = 'ff-edit-btn';
                btn.textContent = ' \u270E';
                btn.title = 'Toggle drag-reorder mode';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleEditMode(forumList, btn);
                });
                titleName.appendChild(btn);
            }
        }
    }

    // ─── Star click → animate ──────────────────────────────────

    function onStarClick(e) {
        e.preventDefault();
        e.stopPropagation();
        var star = e.currentTarget;
        var href = star.getAttribute('data-href');
        var idxKey = star.getAttribute('data-idx');
        var wasFav = star.getAttribute('data-fav') === '1';

        // Walk up to the <li>
        var li = star.parentElement;
        while (li && li.tagName !== 'LI') li = li.parentElement;
        if (!li) return;
        var forumList = li.parentElement;

        if (wasFav) {
            // Unfavourite
            star.textContent = '\u2606';
            star.setAttribute('data-fav', '0');
            saved[idxKey] = (saved[idxKey] || []).filter(function(h) { return h !== href; });
            animateToOriginal(li, forumList, href, idxKey);
        } else {
            // Favourite
            star.textContent = '\u2605';
            star.setAttribute('data-fav', '1');
            if (!saved[idxKey]) saved[idxKey] = [];
            saved[idxKey].push(href);
            animateToTop(li, forumList);
        }
        save();
    }

    function animateToTop(li, forumList) {
        var target = forumList.querySelector('li[data-href^="forums.php?p=forums"]');
        if (!target || target === li) return;

        // First: record current visual position
        var firstRect = li.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var dy = firstRect.top - targetRect.top;

        if (Math.abs(dy) < 3) { forumList.insertBefore(li, target); return; }

        // Last: move in DOM
        forumList.insertBefore(li, target);

        // Invert: offset visually back to where it was
        li.style.transition = 'none';
        li.style.transform = 'translateY(' + dy + 'px)';

        // Force reflow
        li.offsetHeight;

        // Play: animate to 0 using CSS class
        li.classList.add('ff-animating');
        li.style.transform = '';
        setTimeout(function() {
            li.classList.remove('ff-animating');
            li.style.transform = '';
            li.style.transition = '';
        }, ANIM_MS);
    }

    function animateToOriginal(li, forumList, href, idxKey) {
        var snap = originalOrder.get(idxKey);
        if (!snap) { moveLiToEnd(li, forumList); return; }

        var origIdx = snap.indexOf(href);
        if (origIdx === -1) { moveLiToEnd(li, forumList); return; }

        var current = [];
        var all = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        for (var i = 0; i < all.length; i++) {
            if (all[i] !== li) current.push(all[i]);
        }

        var insertBefore = null;
        if (origIdx === 0) {
            if (current.length > 0) insertBefore = current[0];
        } else {
            var prevHref = snap[origIdx - 1];
            var foundPrev = false;
            for (var i = 0; i < current.length; i++) {
                if (foundPrev) { insertBefore = current[i]; break; }
                if (current[i].getAttribute('data-href') === prevHref) foundPrev = true;
            }
        }

        var firstRect = li.getBoundingClientRect();
        if (insertBefore) {
            forumList.insertBefore(li, insertBefore);
        } else {
            forumList.appendChild(li);
        }
        var newRect = li.getBoundingClientRect();
        var dy = firstRect.top - newRect.top;
        if (Math.abs(dy) < 3) return;

        li.style.transition = 'none';
        li.style.transform = 'translateY(' + dy + 'px)';
        li.offsetHeight;
        li.classList.add('ff-animating');
        li.style.transform = '';
        setTimeout(function() {
            li.classList.remove('ff-animating');
            li.style.transform = '';
            li.style.transition = '';
        }, ANIM_MS);
    }

    function moveLiToEnd(li, forumList) {
        if (!forumList) return;
        var all = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var last = all[all.length - 1];
        if (last && last !== li) forumList.appendChild(li);
    }

    // ─── Custom order ──────────────────────────────────────────

    function applyCustomOrder(forumList, items, idxKey) {
        var order = customOrder[idxKey];
        if (!order || !order.length) return;
        var itemArr = [];
        for (var i = 0; i < items.length; i++) itemArr.push(items[i]);
        var seen = {};
        // Place items in saved order first
        for (var i = 0; i < order.length; i++) {
            for (var j = 0; j < itemArr.length; j++) {
                if (itemArr[j].getAttribute('data-href') === order[i]) {
                    forumList.appendChild(itemArr[j]);
                    seen[order[i]] = true;
                    break;
                }
            }
        }
        // Append any new items not in saved order
        for (var i = 0; i < itemArr.length; i++) {
            if (!seen[itemArr[i].getAttribute('data-href')]) {
                forumList.appendChild(itemArr[i]);
            }
        }
    }

    // ─── Drag & drop ───────────────────────────────────────────

    function toggleEditMode(forumList, btn) {
        editMode = !editMode;
        if (editMode) {
            forumList.classList.add('ff-edit-mode');
            btn.textContent = ' \u2714';
            btn.title = 'Save & exit edit mode';
            showGlobalToggle(true);
        } else {
            forumList.classList.remove('ff-edit-mode');
            btn.textContent = ' \u270E';
            btn.title = 'Toggle drag-reorder mode';
            saveCustomOrderForList(forumList);
            showGlobalToggle(false);
        }
    }

    function showGlobalToggle(on) {
        var el = document.getElementById('ff-edit-toggle');
        if (el) el.remove();
        if (!on) return;
        var btn = document.createElement('button');
        btn.id = 'ff-edit-toggle';
        btn.textContent = '\u270E  Edit Mode: ON  \u2714';
        btn.addEventListener('click', function() {
            var lists = document.querySelectorAll('.forum-list.ff-edit-mode');
            for (var i = 0; i < lists.length; i++) {
                var b = lists[i].closest('.forum-wrap').querySelector('.ff-edit-btn');
                if (b) toggleEditMode(lists[i], b);
            }
        });
        document.body.appendChild(btn);
    }

    function onDragStart(e) {
        if (!editMode) return;
        e.preventDefault();
        e.stopPropagation();
        var handle = e.currentTarget;
        var li = handle.parentElement;
        while (li && li.tagName !== 'LI') li = li.parentElement;
        if (!li) return;
        var forumList = li.parentElement;
        dragState = {
            li: li,
            forumList: forumList,
            startY: e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
        };
        li.classList.add('ff-dragging');
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
        if (!dragState) return;
        e.preventDefault();
        var y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        var fl = dragState.forumList;
        var items = fl.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        for (var i = 0; i < items.length; i++) {
            if (items[i] === dragState.li) continue;
            var rect = items[i].getBoundingClientRect();
            if (y < rect.top + rect.height / 2) {
                fl.insertBefore(dragState.li, items[i]);
                return;
            }
        }
        fl.appendChild(dragState.li);
    }

    function onDragEnd() {
        if (!dragState) return;
        dragState.li.classList.remove('ff-dragging');
        saveCustomOrderForList(dragState.forumList);
        dragState = null;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);
    }

    function saveCustomOrderForList(forumList) {
        // Find idxKey for this list
        var lists = document.querySelectorAll('.forum-list');
        var idx = '0';
        for (var i = 0; i < lists.length; i++) {
            if (lists[i] === forumList) { idx = String(Math.max(0, i - 1)); break; }
        }
        var items = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var order = [];
        for (var i = 0; i < items.length; i++) order.push(items[i].getAttribute('data-href'));
        customOrder[idx] = order;
        GM_setValue(ORDER_KEY, JSON.stringify(customOrder));
    }

    // ─── Storage ───────────────────────────────────────────────

    function loadSaved() {
        try {
            var raw = GM_getValue(STORAGE_KEY);
            if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object' && !Array.isArray(p)) return p; }
        } catch(e) {}
        return {};
    }

    function save() {
        GM_setValue(STORAGE_KEY, JSON.stringify(saved));
    }

    function loadCustomOrder() {
        try {
            var raw = GM_getValue(ORDER_KEY);
            if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') return p; }
        } catch(e) {}
        return {};
    }
})();
