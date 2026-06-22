// ==UserScript==
// @name         Forum Favourite
// @namespace    torn.forum.fav
// @version      0.9.2
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
    var COLOR_KEY = 'ff_star_color';
    var POLL_INTERVAL = 250;
    var DEFAULT_COLOR = '#f3da35';

    var saved = loadSaved();
    var starColor = loadColor();

    var pollTimer = null;
    var processedLists = [];
    var colorPickerOpen = false;
    var pencilInjected = false;

    GM_addStyle(
        '.ffStar { padding: 6px; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle; font-size: 15px; line-height: 1; color: var(--ff-star-color, ' + starColor + '); }' +
        '.forum-list { display: flex!important; flex-direction: column; }' +
        'li[isFav="yes"] { order: -1; }' +
        '.ffPencil { padding: 4px 6px; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle; font-size: 14px; line-height: 1; color: #999; margin-left: 8px; opacity: 0.5; transition: opacity 0.15s; }' +
        '.ffPencil:hover { opacity: 1; }' +
        '#ffColorPicker { position: fixed; z-index: 99999; background: #1a1a2e; border: 1px solid #333; border-radius: 8px; padding: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: none; }' +
        '#ffColorPicker canvas { display: block; cursor: crosshair; border-radius: 4px; }' +
        '#ffColorPicker .ffPickerRow { display: flex; align-items: center; gap: 8px; margin-top: 8px; }' +
        '#ffColorPicker .ffPreview { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #555; flex-shrink: 0; }' +
        '#ffColorPicker input[type="text"] { background: #111; border: 1px solid #444; color: #ddd; font-family: monospace; font-size: 13px; padding: 4px 6px; border-radius: 4px; width: 80px; outline: none; }' +
        '#ffColorPicker input[type="text"]:focus { border-color: #666; }' +
        '#ffColorPicker .ffApplyBtn { background: #2a2a4a; border: 1px solid #444; color: #ccc; font-size: 12px; padding: 4px 10px; border-radius: 4px; cursor: pointer; }' +
        '#ffColorPicker .ffApplyBtn:hover { background: #3a3a5a; }'
    );

    injectColorPicker();
    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    function loadColor() {
        var c = GM_getValue(COLOR_KEY);
        if (c && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
        return DEFAULT_COLOR;
    }

    function saveColor(c) {
        GM_setValue(COLOR_KEY, c);
    }

    function injectColorPicker() {
        var picker = document.createElement('div');
        picker.id = 'ffColorPicker';

        var canvas = document.createElement('canvas');
        canvas.width = 180;
        canvas.height = 180;
        picker.appendChild(canvas);

        var row = document.createElement('div');
        row.className = 'ffPickerRow';

        var preview = document.createElement('div');
        preview.className = 'ffPreview';
        preview.style.background = starColor;
        row.appendChild(preview);

        var hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.maxLength = 7;
        hexInput.value = starColor;
        hexInput.placeholder = '#rrggbb';
        row.appendChild(hexInput);

        var applyBtn = document.createElement('button');
        applyBtn.className = 'ffApplyBtn';
        applyBtn.textContent = 'Apply';
        row.appendChild(applyBtn);

        picker.appendChild(row);
        document.body.appendChild(picker);

        drawWheel(canvas, starColor);

        var ctx = canvas.getContext('2d');

        function pickColor(e) {
            var rect = canvas.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            var px = ctx.getImageData(x, y, 1, 1).data;
            var hex = rgbToHex(px[0], px[1], px[2]);
            preview.style.background = hex;
            hexInput.value = hex;
        }

        canvas.addEventListener('mousedown', function(e) {
            pickColor(e);
            var moveHandler = function(ev) { pickColor(ev); };
            var upHandler = function() {
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
            };
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
        });

        hexInput.addEventListener('input', function() {
            var v = hexInput.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                preview.style.background = v;
            }
        });

        hexInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                applyBtn.click();
            }
        });

        applyBtn.addEventListener('click', function() {
            var v = hexInput.value.trim();
            if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
            starColor = v;
            saveColor(v);
            document.documentElement.style.setProperty('--ff-star-color', v);
            closePicker();
        });
    }

    function drawWheel(canvas, highlightHex) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        var cx = w / 2, cy = h / 2;
        var r = w / 2 - 2;

        // Draw hue ring
        for (var angle = 0; angle < 360; angle += 1) {
            var startAngle = (angle - 1) * Math.PI / 180;
            var endAngle = (angle + 1) * Math.PI / 180;
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, endAngle);
            ctx.strokeStyle = 'hsl(' + angle + ', 100%, 50%)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Draw inner saturation/lightness triangle-ish gradient
        var innerR = r - 8;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dx = x - cx, dy = y - cy;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= innerR) {
                    var hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                    var sat = (dist / innerR) * 100;
                    var light = 50 + (0.5 - y / h) * 40;
                    ctx.fillStyle = 'hsl(' + hue + ', ' + sat + '%, ' + light + '%)';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
    }

    function openPicker(anchorEl) {
        var picker = document.getElementById('ffColorPicker');
        var rect = anchorEl.getBoundingClientRect();
        picker.style.left = rect.left + 'px';
        picker.style.top = (rect.bottom + 6) + 'px';
        picker.style.display = 'block';
        colorPickerOpen = true;
    }

    function closePicker() {
        var picker = document.getElementById('ffColorPicker');
        picker.style.display = 'none';
        colorPickerOpen = false;
    }

    // Close picker when clicking outside
    document.addEventListener('click', function(e) {
        if (!colorPickerOpen) return;
        var picker = document.getElementById('ffColorPicker');
        if (picker && !picker.contains(e.target) && !e.target.classList.contains('ffPencil')) {
            closePicker();
        }
    });

    function onHashChange() {
        clearInterval(pollTimer);
        processedLists = [];
        pencilInjected = false;

        var hash = window.location.hash;
        if (!hash || hash === '' || hash.indexOf('/p=main') !== -1 || hash.indexOf('#/p=') !== 0) {
            startPolling();
        }
    }

    function startPolling() {
        pollTimer = setInterval(function() {
            // Inject single pencil next to page header
            if (!pencilInjected) {
                var header = document.querySelector('.forums-title');
                if (!header) header = document.querySelector('h1');
                if (!header) header = document.querySelector('.title');
                if (header) {
                    var existing = document.getElementById('ffPencil');
                    if (!existing) {
                        var pencil = document.createElement('span');
                        pencil.id = 'ffPencil';
                        pencil.className = 'ffPencil';
                        pencil.textContent = '\u270E';
                        pencil.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (colorPickerOpen) {
                                closePicker();
                            } else {
                                openPicker(pencil);
                            }
                        });
                        header.appendChild(pencil);
                    }
                    pencilInjected = true;
                }
            }

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
