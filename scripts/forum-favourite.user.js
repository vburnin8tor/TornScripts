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
    var ANIMATE_DURATION = 300; // ms for scrollIntoView

    var saved = loadSaved();
    var customOrder = loadCustomOrder(); // { idxKey: [dataUrl, ...] }
    var originalPositions = new Map(); // data-href -> original index within its list
    var pollTimer = null;
    var processedLists = [];
    var editMode = false;
    var dragState = null; // { li, forumList, startY, startIndex, ... }

    GM_addStyle(
        '.ffStar { padding: 6px; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle; font-size: 15px; line-height: 1; color: ' + STAR_COLOR + '; }' +
        '.forum-list { display: flex!important; flex-direction: column; }' +
        'li[isFav="yes"] { order: -1; }' +
        '.ff-edit-btn { cursor: pointer; margin-left: 6px; font-size: 13px; color: #888; display: inline-flex; align-items: center; vertical-align: middle; }' +
        '.ff-edit-btn:hover { color: #ccc; }' +
        '.ff-drag-handle { cursor: grab; margin-right: 6px; font-size: 14px; color: #666; display: inline-flex; align-items: center; vertical-align: middle; user-select: none; }' +
        '.ff-drag-handle:active { cursor: grabbing; }' +
        '.ff-edit-mode .ff-drag-handle { display: inline-flex; }' +
        '.ff-drag-handle { display: none; }' +
        '.ff-dragging { opacity: 0.5; outline: 2px dashed #f3da35; }' +
        '.ff-drag-over { border-top: 2px solid #f3da35; }' +
        '#ff-edit-toggle { position: fixed; bottom: 12px; right: 12px; z-index: 99999; background: #1a1a1a; color: #f3da35; border: 1px solid #f3da35; padding: 6px 12px; cursor: pointer; font-size: 12px; border-radius: 4px; font-family: monospace; }' +
        '#ff-edit-toggle:hover { background: #2a2a2a; }' +
        '#ff-edit-toggle.active { background: #f3da35; color: #1a1a1a; }'
    );

    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    function onHashChange() {
        clearInterval(pollTimer);
        processedLists = [];
        originalPositions.clear();

        var hash = window.location.hash;
        if (!hash || hash === '' || hash.indexOf('/p=main') !== -1 || hash.indexOf('#/p=') !== 0) {
            startPolling();
        }
    }

    function startPolling() {
        pollTimer = setInterval(function() {
            var forumLists = document.querySelectorAll('.forum-list:not([data-ff-processed])');
            if (forumLists.length === 0) return;

            var index = processedLists.length;
            var anyNew = false;

            for (var i = 0; i < forumLists.length; i++) {
                var forumList = forumLists[i];
                forumList.setAttribute('data-ff-processed', 'true');
                anyNew = true;

                if (index === 0) {
                    processedLists.push(true);
                    index += 1;
                    continue;
                }

                processList(forumList, index);
                processedLists.push(true);
                index += 1;
            }

            if (anyNew) {
                var remaining = document.querySelectorAll('.forum-list:not([data-ff-processed])');
                if (remaining.length === 0) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
            }
        }, POLL_INTERVAL);
    }

    function processList(forumList, index) {
        var idxKey = String(index);
        var liList = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');

        // Record original positions before any reordering
        var lis = [];
        for (var i = 0; i < liList.length; i++) {
            var li = liList[i];
            var dataUrl = li.getAttribute('data-href');
            if (!originalPositions.has(dataUrl)) {
                originalPositions.set(dataUrl, { idxKey: idxKey, index: i });
            }
            lis.push(li);
        }

        // Apply custom order if exists
        if (customOrder[idxKey]) {
            applyCustomOrder(forumList, lis, idxKey);
        }

        for (var i = 0; i < liList.length; i++) {
            var li = liList[i];
            var dataUrl = li.getAttribute('data-href');

            if (li.querySelector('.ffStar')) continue;

            var span = document.createElement('span');
            span.className = 'ffStar';

            var isFav = saved[idxKey] && saved[idxKey].indexOf(dataUrl) !== -1 ? 'yes' : 'no';
            span.setAttribute('isFav', isFav);
            span.setAttribute('data-index', idxKey);
            span.setAttribute('data-href', dataUrl);
            span.textContent = isFav === 'yes' ? '\u2605' : '\u2606';

            li.setAttribute('isFav', isFav);

            if (isFav === 'yes') {
                moveLiToTop(li, forumList);
            }

            span.addEventListener('click', onStarClick);

            var desc = li.querySelector('.name a .desc');
            if (desc) {
                desc.appendChild(span);
            }

            // Add drag handle (hidden by default, shown in edit mode)
            var dragHandle = document.createElement('span');
            dragHandle.className = 'ff-drag-handle';
            dragHandle.textContent = '\u2630'; // ≡
            dragHandle.setAttribute('data-href', dataUrl);
            dragHandle.setAttribute('data-index', idxKey);
            dragHandle.addEventListener('mousedown', onDragStart);
            dragHandle.addEventListener('touchstart', onDragStart, { passive: false });

            var nameEl = li.querySelector('.name');
            if (nameEl) {
                nameEl.insertBefore(dragHandle, nameEl.firstChild);
            }
        }

        // Add edit button to the list header area
        if (!forumList.querySelector('.ff-edit-btn')) {
            var editBtn = document.createElement('span');
            editBtn.className = 'ff-edit-btn';
            editBtn.textContent = '\u270E'; // ✎
            editBtn.title = 'Toggle edit mode for reordering';
            editBtn.addEventListener('click', function() {
                toggleEditMode(forumList);
            });
            // Try to find a header for this list
            var prev = forumList.previousElementSibling;
            if (prev) {
                prev.style.position = 'relative';
                prev.appendChild(editBtn);
            }
        }
    }

    function applyCustomOrder(forumList, lis, idxKey) {
        var order = customOrder[idxKey];
        if (!order || !order.length) return;

        // Sort lis according to custom order
        var ordered = [];
        var seen = {};

        // First, add items in custom order
        for (var i = 0; i < order.length; i++) {
            for (var j = 0; j < lis.length; j++) {
                if (lis[j].getAttribute('data-href') === order[i]) {
                    ordered.push(lis[j]);
                    seen[order[i]] = true;
                    break;
                }
            }
        }

        // Then add any new items not in custom order
        for (var i = 0; i < lis.length; i++) {
            var href = lis[i].getAttribute('data-href');
            if (!seen[href]) {
                ordered.push(lis[i]);
            }
        }

        // Re-append in order
        for (var i = 0; i < ordered.length; i++) {
            forumList.appendChild(ordered[i]);
        }
    }

    // ─── Star Click ───────────────────────────────────────────

    function onStarClick(e) {
        e.preventDefault();
        e.stopPropagation();

        var span = e.currentTarget;
        var idx = span.getAttribute('data-index');
        var href = span.getAttribute('data-href');
        var wasFav = span.getAttribute('isFav') === 'yes';

        var li = span.parentElement;
        while (li && li.tagName !== 'LI') li = li.parentElement;
        var forumList = li ? li.parentElement : null;

        if (wasFav) {
            span.textContent = '\u2606';
            span.setAttribute('isFav', 'no');
            if (li) li.setAttribute('isFav', 'no');
            saved[idx] = removeFromArray(saved[idx] || [], href);

            // Animate: move back to original position
            if (li && forumList) {
                moveLiToOriginalPosition(li, forumList, href);
            }
        } else {
            span.textContent = '\u2605';
            span.setAttribute('isFav', 'yes');
            if (li) {
                li.setAttribute('isFav', 'yes');
                if (forumList) {
                    // Animate: move to top
                    animateMoveToTop(li, forumList);
                }
            }
            if (!saved[idx]) saved[idx] = [];
            saved[idx].push(href);
        }

        save();
    }

    function animateMoveToTop(li, forumList) {
        // Get the current visual position
        var liRect = li.getBoundingClientRect();
        var first = forumList.querySelector('li[data-href^="forums.php?p=forums"]');
        if (!first || first === li) return;

        var firstRect = first.getBoundingClientRect();
        var deltaY = liRect.top - firstRect.top;

        // If already at top, skip
        if (Math.abs(deltaY) < 2) {
            forumList.insertBefore(li, first);
            return;
        }

        // Use FLIP animation: First, Last, Invert, Play
        // First: current position (already captured above)

        // Last: move to DOM position
        forumList.insertBefore(li, first);

        // Invert: transform back to old visual position
        var newRect = li.getBoundingClientRect();
        var invertY = deltaY;

        li.style.transition = 'none';
        li.style.transform = 'translateY(' + invertY + 'px)';

        // Play: animate to final position
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                li.style.transition = 'transform ' + ANIMATE_DURATION + 'ms ease-out';
                li.style.transform = 'translateY(0)';
                setTimeout(function() {
                    li.style.transition = '';
                    li.style.transform = '';
                }, ANIMATE_DURATION);
            });
        });
    }

    function moveLiToOriginalPosition(li, forumList, href) {
        var orig = originalPositions.get(href);
        if (!orig || orig.idxKey !== getForumListIndex(forumList)) {
            moveLiToEnd(li, forumList);
            return;
        }

        // Find the element that should be just before this one in original order
        var lis = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var targetLi = null;

        // The element at original index should be the one before our insertion point
        if (orig.index >= lis.length) {
            // Should go at end
            var lastLi = null;
            for (var i = 0; i < lis.length; i++) {
                if (lis[i] !== li) lastLi = lis[i];
            }
            if (lastLi && lastLi !== li) {
                forumList.insertBefore(li, lastLi.nextSibling);
            }
        } else {
            // Find what element is currently at position orig.index
            var allItems = [];
            for (var i = 0; i < lis.length; i++) {
                allItems.push(lis[i]);
            }

            // We want to insert at original position, but accounting for ourselves being removed
            var insertBeforeEl = null;
            var count = 0;
            for (var i = 0; i < allItems.length; i++) {
                if (allItems[i] === li) continue;
                if (count === orig.index) {
                    insertBeforeEl = allItems[i];
                    break;
                }
                count++;
            }

            if (insertBeforeEl) {
                // FLIP animation
                var liRect = li.getBoundingClientRect();
                var targetRect = insertBeforeEl.getBoundingClientRect();
                var deltaY = liRect.top - targetRect.top;

                forumList.insertBefore(li, insertBeforeEl);

                var newRect = li.getBoundingClientRect();
                var invertDelta = deltaY;

                li.style.transition = 'none';
                li.style.transform = 'translateY(' + invertDelta + 'px)';

                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        li.style.transition = 'transform ' + ANIMATE_DURATION + 'ms ease-out';
                        li.style.transform = 'translateY(0)';
                        setTimeout(function() {
                            li.style.transition = '';
                            li.style.transform = '';
                        }, ANIMATE_DURATION);
                    });
                });
            }
        }
    }

    function moveLiToEnd(li, forumList) {
        if (!forumList) return;
        var allLis = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var last = null;
        for (var i = 0; i < allLis.length; i++) last = allLis[i];
        if (last && last !== li && last.nextSibling) {
            forumList.insertBefore(li, last.nextSibling);
        } else if (last && last !== li) {
            forumList.appendChild(li);
        }
    }

    function moveLiToTop(li, forumList) {
        if (!forumList) return;
        var first = forumList.querySelector('li[data-href^="forums.php?p=forums"]');
        if (first && first !== li) forumList.insertBefore(li, first);
    }

    function getForumListIndex(forumList) {
        var lists = document.querySelectorAll('.forum-list');
        for (var i = 0; i < lists.length; i++) {
            if (lists[i] === forumList) return String(Math.max(0, i - 1));
        }
        return '0';
    }

    // ─── Drag & Drop Reorder ───────────────────────────────────

    function toggleEditMode(forumList) {
        editMode = !editMode;
        var btn = forumList.querySelector('.ff-edit-btn');
        if (editMode) {
            forumList.classList.add('ff-edit-mode');
            if (btn) {
                btn.textContent = '\u2714'; // ✔
                btn.title = 'Save and exit edit mode';
            }
            showEditToggle(true);
        } else {
            forumList.classList.remove('ff-edit-mode');
            if (btn) {
                btn.textContent = '\u270E'; // ✎
                btn.title = 'Toggle edit mode for reordering';
            }
            saveCustomOrder(forumList);
            showEditToggle(false);
        }
    }

    function showEditToggle(active) {
        var existing = document.getElementById('ff-edit-toggle');
        if (existing) existing.remove();

        if (!active) return;

        var toggle = document.createElement('button');
        toggle.id = 'ff-edit-toggle';
        toggle.textContent = '✎ Edit Mode: ON';
        toggle.className = 'active';
        toggle.addEventListener('click', function() {
            // Find all forum lists and exit edit mode
            var lists = document.querySelectorAll('.forum-list.ff-edit-mode');
            for (var i = 0; i < lists.length; i++) {
                toggleEditMode(lists[i]);
            }
        });
        document.body.appendChild(toggle);
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
        var lis = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var startIndex = -1;
        for (var i = 0; i < lis.length; i++) {
            if (lis[i] === li) { startIndex = i; break; }
        }

        dragState = {
            li: li,
            forumList: forumList,
            startIndex: startIndex,
            startY: e.type === 'touchstart' ? e.touches[0].clientY : e.clientY,
            currentIndex: startIndex
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

        var clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        var forumList = dragState.forumList;
        var lis = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');

        // Find which item we're hovering over
        var hoverIndex = -1;
        for (var i = 0; i < lis.length; i++) {
            if (lis[i] === dragState.li) continue;
            var rect = lis[i].getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (clientY < midY) {
                hoverIndex = i;
                break;
            }
            hoverIndex = i + 1;
        }

        // Clamp
        if (hoverIndex < 0) hoverIndex = 0;
        if (hoverIndex > lis.length - 1) hoverIndex = lis.length - 1;

        if (hoverIndex !== dragState.currentIndex) {
            // Move the dragged element
            var targetLi = lis[hoverIndex];
            if (targetLi && targetLi !== dragState.li) {
                forumList.insertBefore(dragState.li, targetLi);
            } else if (hoverIndex >= lis.length - 1) {
                forumList.appendChild(dragState.li);
            }
            dragState.currentIndex = hoverIndex;
        }
    }

    function onDragEnd(e) {
        if (!dragState) return;

        dragState.li.classList.remove('ff-dragging');
        saveCustomOrder(dragState.forumList);

        dragState = null;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);
    }

    function saveCustomOrder(forumList) {
        var idxKey = getForumListIndex(forumList);
        var lis = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var order = [];
        for (var i = 0; i < lis.length; i++) {
            order.push(lis[i].getAttribute('data-href'));
        }
        customOrder[idxKey] = order;
        saveOrder();
    }

    // ─── Storage ───────────────────────────────────────────────

    function loadSaved() {
        try {
            var raw = GM_getValue(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[ForumFav] Failed to load saved data, resetting.');
        }
        return { '0': [], '1': [], '2': [], '3': [] };
    }

    function save() {
        GM_setValue(STORAGE_KEY, JSON.stringify(saved));
    }

    function loadCustomOrder() {
        try {
            var raw = GM_getValue(ORDER_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[ForumFav] Failed to load custom order, resetting.');
        }
        return {};
    }

    function saveOrder() {
        GM_setValue(ORDER_KEY, JSON.stringify(customOrder));
    }

    function removeFromArray(arr, item) {
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] !== item) {
                result.push(arr[i]);
            }
        }
        return result;
    }
})();
