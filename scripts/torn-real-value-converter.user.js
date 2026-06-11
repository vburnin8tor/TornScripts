// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.4.5
// @description  Converts all Torn cash values to real USD using $5/23.5M rate.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    var RATE = 5 / 23500000;
    var _totalConverted = 0;

    function fmt(val) {
        if (val == null || isNaN(val)) return '—';
        var a = Math.abs(val);
        if (a >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (a >= 1) return '$' + val.toFixed(2);
        return '$' + val.toFixed(4);
    }

    function parseMoney(text) {
        var s = text.replace(/[$,]/g, '');
        var mult = 1;
        if (/[Kk]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
        else if (/[Mm]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
        else if (/[Bb]$/.test(s)) { mult = 1e9; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isNaN(n) ? null : n * mult;
    }

    function isOurs(el) {
        var cur = el;
        while (cur) {
            if (cur.className && typeof cur.className === 'string' && cur.className.indexOf('tt-') !== -1) return true;
            if (cur.tagName === 'SCRIPT' || cur.tagName === 'STYLE') return true;
            cur = cur.parentElement;
        }
        return false;
    }

    // process a text node
    function processNode(node) {
        if (!node || node.nodeType !== 3) return false;
        var text = node.textContent;
        if (text.indexOf('$') === -1) return false;
        if (!/\$\d/.test(text)) return false;

        var p = node.parentElement;
        if (!p || isOurs(p)) return false;
        if (p.tagName === 'SPAN' && p.className === 'tt-val') return false;

        var regex = /\$([\d,]+(?:\.\d+)?[KMBkmb]?)/g;
        var match, lastIdx = 0;
        var frag = document.createDocumentFragment();
        var found = false;

        while ((match = regex.exec(text)) !== null) {
            found = true;
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            }
            var tornAmt = parseMoney('$' + match[1]);
            if (tornAmt !== null) {
                var span = document.createElement('span');
                span.className = 'tt-val';
                span.textContent = fmt(tornAmt * RATE);
                frag.appendChild(span);
                _totalConverted++;
            } else {
                frag.appendChild(document.createTextNode('$' + match[1]));
            }
            lastIdx = regex.lastIndex;
        }

        if (found) {
            if (lastIdx < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx)));
            }
            node.parentNode.replaceChild(frag, node);
        }
        return found;
    }

    // sweep the whole DOM
    function sweep() {
        if (!document.body) return;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var tn;
        while ((tn = walker.nextNode())) nodes.push(tn);
        for (var i = nodes.length - 1; i >= 0; i--) processNode(nodes[i]);
    }

    // mutation observer
    var _obs = null;
    var _timer = null;
    function onMutations() { clearTimeout(_timer); _timer = setTimeout(sweep, 50); }
    function startObserver() {
        if (_obs) return;
        _obs = new MutationObserver(onMutations);
        _obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }

    // floating counter to show script is working
    function showCounter() {
        var div = document.createElement('div');
        div.id = 'tt-counter';
        div.style.cssText = 'position:fixed;bottom:5px;left:5px;z-index:999999;background:#1a1a1a;color:#4dff4d;font:11px monospace;padding:3px 8px;border:1px solid #333;border-radius:3px;opacity:0.7;pointer-events:none;';
        document.body.appendChild(div);
        setInterval(function () {
            if (document.getElementById('tt-counter')) {
                document.getElementById('tt-counter').textContent = 'TRV: ' + _totalConverted + ' converted';
            }
        }, 1000);
    }

    function init() {
        if (!document.body) { setTimeout(init, 10); return; }
        sweep();
        startObserver();
        setInterval(sweep, 2000);
        showCounter();
        console.log('[TRV] v5.4.5 loaded — $5/23.5M rate');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
