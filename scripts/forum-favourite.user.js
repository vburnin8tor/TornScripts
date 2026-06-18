// ==UserScript==
// @name         Forum Favourite
// @namespace    torn.forum.fav
// @version      0.9
// @description  Lets you put your favourite sub-forums on top.
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
    var POLL_INTERVAL = 250;
    var STAR_COLOR = '#f3da35';

    var saved = loadSaved();

    var pollTimer = null;
    var processedLists = [];

    GM_addStyle(
        '.ffStar { padding: 6px; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle; font-size: 15px; line-height: 1; color: ' + STAR_COLOR + '; }' +
        '.forum-list { display: flex!important; flex-direction: column; }' +
        'li[isFav="yes"] { order: -1; }'
    );

    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    function onHashChange() {
        clearInterval(pollTimer);
        processedLists = [];

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

                // Skip index 0 — usually the main category header list
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
        var liList = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var idxKey = index.toString();

        for (var i = 0; i < liList.length; i++) {
            var li = liList[i];
            var dataUrl = li.getAttribute('data-href');

            // Skip if this li already has a star
            if (li.querySelector('.ffStar')) continue;

            var span = document.createElement('span');
            span.className = 'ffStar';

            var isFav = saved[idxKey] && saved[idxKey].indexOf(dataUrl) !== -1 ? 'yes' : 'no';
            span.setAttribute('isFav', isFav);
            span.setAttribute('data-index', idxKey);
            span.setAttribute('data-href', dataUrl);
            span.textContent = isFav === 'yes' ? '\u2605' : '\u2606';

            // Mark the li so CSS can style it and so we can find it for reordering
            li.setAttribute('isFav', isFav);

            // Move existing favourites to the top of the list immediately
            if (isFav === 'yes') {
                moveLiToTop(li, forumList);
            }

            span.addEventListener('click', onStarClick);

            var desc = li.querySelector('.name a .desc');
            if (desc) {
                desc.appendChild(span);
            }
        }
    }

    function onStarClick(e) {
        e.preventDefault();
        e.stopPropagation();

        var span = e.currentTarget;
        var idx = span.getAttribute('data-index');
        var href = span.getAttribute('data-href');
        var isSelected = span.getAttribute('isFav') === 'yes';
        // Walk up from the star span to find the parent li element
        var li = span.parentElement;
        while (li && li.tagName !== 'LI') {
            li = li.parentElement;
        }
        var forumList = li ? li.parentElement : null;

        if (isSelected) {
            span.textContent = '\u2606';
            span.setAttribute('isFav', 'no');
            if (li) li.setAttribute('isFav', 'no');
            saved[idx] = removeFromArray(saved[idx] || [], href);
            // Move unfavourited item to after the last non-fav item
            if (li && forumList) moveLiToEnd(li, forumList);
        } else {
            span.textContent = '\u2605';
            span.setAttribute('isFav', 'yes');
            if (li) {
                li.setAttribute('isFav', 'yes');
                if (forumList) moveLiToTop(li, forumList);
            }
            if (!saved[idx]) saved[idx] = [];
            saved[idx].push(href);
        }

        save();
    }

    // Move an unfavourited li to the end of the forum-list
    function moveLiToEnd(li, forumList) {
        if (!forumList) return;
        // Find the last li in the list and insert after it
        var allLis = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var last = null;
        for (var i = 0; i < allLis.length; i++) {
            last = allLis[i];
        }
        if (last && last !== li && last.nextSibling) {
            forumList.insertBefore(li, last.nextSibling);
        } else if (last && last !== li) {
            forumList.appendChild(li);
        }
    }

    // Move a favourited li to the top of its forum-list parent
    // Uses insertBefore since flex order doesn't always work on Torn's DOM
    function moveLiToTop(li, forumList) {
        if (!forumList) return;
        var first = forumList.querySelector('li[data-href^="forums.php?p=forums"]');
        if (first && first !== li) {
            forumList.insertBefore(li, first);
        }
    }

    function loadSaved() {
        try {
            var raw = GM_getValue(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                // Validate shape
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
        } catch (e) {
            console.log('[ForumFav] Failed to load saved data, resetting.');
        }
        return { '0': [], '1': [], '2': [], '3': [] };
    }

    function save() {
        var stringed = JSON.stringify(saved);
        GM_setValue(STORAGE_KEY, stringed);
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
