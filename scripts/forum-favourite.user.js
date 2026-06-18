// ==UserScript==
// @name         Forum Favourite
// @namespace    torn.forum.fav
// @version      0.3
// @description  Lets you put your favourite sub-forums on top.
// @author       shaul [3908280]
// @match        https://www.torn.com/forums.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    var STORAGE_KEY = 'torn_forum_fav';
    var POLL_INTERVAL = 250;
    var STAR_COLOR = '#f3da35';

    var saved = loadSaved();

    GM_addStyle(
        '.forumFavStar { padding: 6px; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle; font-size: 15px; line-height: 1; color: ' + STAR_COLOR + '; }' +
        '.forum-list { display: flex!important; flex-direction: column; }' +
        'li[isFav="yes"] { order: -1; }'
    );

    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    function onHashChange() {
        clearInterval(pollTimer);
        var hash = window.location.hash;
        if (!hash || hash === '' || hash.indexOf('/p=main') !== -1 || hash.indexOf('#/p=') !== 0) {
            startPolling();
        }
    }

    var pollTimer = null;

    function startPolling() {
        pollTimer = setInterval(function () {
            var forumLists = document.querySelectorAll('.forum-list:not([data-ff-processed])');
            if (!forumLists.length) return;

            for (var i = 0; i < forumLists.length; i++) {
                var forumList = forumLists[i];
                forumList.setAttribute('data-ff-processed', 'true');
                processList(forumList);
            }

            if (!document.querySelectorAll('.forum-list:not([data-ff-processed])').length) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }, POLL_INTERVAL);
    }

    function processList(forumList) {
        var liList = forumList.querySelectorAll('li[data-href^="forums.php?p=forums"]');
        var idxKey = getGroupIndex(forumList);

        for (var i = 0; i < liList.length; i++) {
            var li = liList[i];
            if (li.querySelector('.forumFavStar')) continue;

            var dataUrl = li.getAttribute('data-href');
            var isFav = saved[idxKey] && saved[idxKey].indexOf(dataUrl) !== -1;

            var span = document.createElement('span');
            span.className = 'forumFavStar';
            span.textContent = isFav ? '\u2605' : '\u2606';
            span.setAttribute('isFav', isFav ? 'yes' : 'no');
            span.setAttribute('data-href', dataUrl);

            li.setAttribute('isFav', isFav ? 'yes' : 'no');
            if (isFav) moveLiToTop(li, forumList);

            span.addEventListener('click', onStarClick);

            var desc = li.querySelector('.name a .desc');
            if (desc) desc.appendChild(span);
        }
    }

    function getGroupIndex(forumList) {
        var lists = document.querySelectorAll('.forum-list');
        for (var i = 0; i < lists.length; i++) {
            if (lists[i] === forumList) return String(Math.max(0, i - 1));
        }
        return '0';
    }

    function onStarClick(e) {
        e.preventDefault();
        e.stopPropagation();

        var span = e.currentTarget;
        var href = span.getAttribute('data-href');
        var wasFav = span.getAttribute('isFav') === 'yes';

        var li = span.parentElement;
        while (li && li.tagName !== 'LI') li = li.parentElement;
        var forumList = li ? li.parentElement : null;

        if (wasFav) {
            span.textContent = '\u2606';
            span.setAttribute('isFav', 'no');
            if (li) li.setAttribute('isFav', 'no');
            var idx = getGroupIndex(forumList);
            saved[idx] = (saved[idx] || []).filter(function (h) { return h !== href; });
            if (li && forumList) moveLiToEnd(li, forumList);
        } else {
            span.textContent = '\u2605';
            span.setAttribute('isFav', 'yes');
            if (li) {
                li.setAttribute('isFav', 'yes');
                if (forumList) moveLiToTop(li, forumList);
            }
            var idx = getGroupIndex(forumList);
            if (!saved[idx]) saved[idx] = [];
            saved[idx].push(href);
        }

        save();
    }

    function moveLiToEnd(li, forumList) {
        if (!forumList) return;
        var last = forumList.lastElementChild;
        if (last && last !== li) {
            forumList.insertBefore(li, last.nextSibling);
        } else if (last === li) {
            // already last, do nothing
        } else {
            forumList.appendChild(li);
        }
    }

    function moveLiToTop(li, forumList) {
        if (!forumList) return;
        var first = forumList.querySelector('li[data-href^="forums.php?p=forums"]');
        if (first && first !== li) forumList.insertBefore(li, first);
    }

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
})();
