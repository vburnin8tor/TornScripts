// ==UserScript==
// @name         Forum Favourite
// @namespace    hardy.forum.fav
// @version      0.3
// @description  Lets you put your favourite sub-forums on top.
// @author       Father [2131687]
// @match        https://www.torn.com/forums.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    var STORAGE_KEY = 'hardy_forum_fav';
    var POLL_INTERVAL = 250;
    var STAR_COLOR = '#f3da35';
    var STAR_SIZE = 15;

    var saved = loadSaved();

    var filledStar = '<svg style="color:' + STAR_COLOR + '" width="' + STAR_SIZE + '" height="' + STAR_SIZE + '" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.22303 0.665992C7.32551 0.419604 7.67454 0.419604 7.77702 0.665992L9.41343 4.60039C9.45663 4.70426 9.55432 4.77523 9.66645 4.78422L13.914 5.12475C14.18 5.14607 14.2878 5.47802 14.0852 5.65162L10.849 8.42374C10.7636 8.49692 10.7263 8.61176 10.7524 8.72118L11.7411 12.866C11.803 13.1256 11.5206 13.3308 11.2929 13.1917L7.6564 10.9705C7.5604 10.9119 7.43965 10.9119 7.34365 10.9705L3.70718 13.1917C3.47945 13.3308 3.19708 13.1256 3.25899 12.866L4.24769 8.72118C4.2738 8.61176 4.23648 8.49692 4.15105 8.42374L0.914889 5.65162C0.712228 5.47802 0.820086 5.14607 1.08608 5.12475L5.3336 4.78422C5.44573 4.77523 5.54342 4.70426 5.58662 4.60039L7.22303 0.665992Z" fill="' + STAR_COLOR + '"></path></svg>';
    var emptyStar = '<svg style="color:' + STAR_COLOR + '" xmlns="http://www.w3.org/2000/svg" width="' + STAR_SIZE + '" height="' + STAR_SIZE + '" fill="currentColor" class="bi bi-star" viewBox="0 0 16 16"><path d="M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.522-3.356c.33-.314.16-.888-.282-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.354 5.12l-4.898.696c-.441.062-.612.636-.283.95l3.523 3.356-.83 4.73zm4.905-2.767-3.686 1.894.694-3.957a.565.565 0 0 0-.163-.505L1.71 6.745l4.052-.576a.525.525 0 0 0 .393-.288L8 2.223l1.847 3.658a.525.525 0 0 0 .393.288l4.052.575-2.906 2.77a.565.565 0 0 0-.163.506l.694 3.957-3.686-1.894a.503.503 0 0 0-.461 0z" fill="' + STAR_COLOR + '"></path></svg>';

    var pollTimer = null;
    var processedLists = [];

    GM_addStyle('.hardyForumFav { padding: 6px; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle; } .forum-list { display: flex!important; flex-direction: column; } li[isFav="yes"] { order: -1; }');

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
            var forumLists = document.querySelectorAll('.forum-list:not([data-hardy-processed])');
            if (forumLists.length === 0) return;

            var index = processedLists.length;
            var anyNew = false;

            for (var i = 0; i < forumLists.length; i++) {
                var forumList = forumLists[i];
                forumList.setAttribute('data-hardy-processed', 'true');
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
                var remaining = document.querySelectorAll('.forum-list:not([data-hardy-processed])');
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
            if (li.querySelector('.hardyForumFav')) continue;

            var span = document.createElement('span');
            span.className = 'hardyForumFav';

            var isFav = saved[idxKey] && saved[idxKey].indexOf(dataUrl) !== -1 ? 'yes' : 'no';
            span.setAttribute('isFav', isFav);
            span.setAttribute('data-index', idxKey);
            span.setAttribute('data-href', dataUrl);
            span.innerHTML = isFav === 'yes' ? filledStar : emptyStar;

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

        if (isSelected) {
            span.innerHTML = emptyStar;
            span.setAttribute('isFav', 'no');
            saved[idx] = removeFromArray(saved[idx] || [], href);
        } else {
            span.innerHTML = filledStar;
            span.setAttribute('isFav', 'yes');
            if (!saved[idx]) saved[idx] = [];
            saved[idx].push(href);
        }

        save();
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
