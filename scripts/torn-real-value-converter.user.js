// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.4.1
// @description  Converts all Torn cash values to real USD using the classic $5/23.5M rate. Replaces $amount with converted value everywhere. Unconverted torn values show §.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

/*
    Torn Real Value Converter v5.4.1
    ----------------------------------
    classic rate: $5 USD per 23.5M Torn Money

    what it does:
    - finds every $amount on the page
    - replaces it with the converted USD value
    - any torn value that can't be converted gets § instead of $
    - runs from document-start to catch all dynamic content

    no APIs, no keys, no settings. just math.
*/

(function () {
    'use strict';

    var RATE = 5 / 23500000;
    var SYMBOL = '\u00a7'; // section sign for unconverted torn money

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

    // process a text node: replace $amount with converted value
    function processTextNode(node) {
        if (!node || node.nodeType !== 3) return false;
        var text = node.textContent;
        if (text.indexOf('$') === -1) return false;
        if (!/\$\d/.test(text)) return false;

        var p = node.parentElement;
        if (!p) return false;
        if (isOurs(p)) return false;

        // don't process if already inside a converted span
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
                var usd = tornAmt * RATE;
                var span = document.createElement('span');
                span.className = 'tt-val';
                span.textContent = fmt(usd);
                frag.appendChild(span);
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

    // replace bare $ with § (torn money indicator)
    function replaceBareDollar(node) {
        if (!node || node.nodeType !== 3) return;
        var text = node.textContent;
        // standalone $ or $ not followed by a digit
        if (text.indexOf('$') === -1) return;
        if (/\$\d/.test(text)) return; // has actual amounts, skip

        var p = node.parentElement;
        if (!p || isOurs(p)) return;

        node.textContent = text.replace(/\$/g, SYMBOL);
    }

    // sweep the whole DOM
    function sweep() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var tn;
        while ((tn = walker.nextNode())) {
            nodes.push(tn);
        }
        // process in reverse to avoid index issues when replacing nodes
        for (var i = nodes.length - 1; i >= 0; i--) {
            processTextNode(nodes[i]);
        }
        // second pass for bare dollars
        walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        nodes = [];
        while ((tn = walker.nextNode())) {
            nodes.push(tn);
        }
        for (var j = nodes.length - 1; j >= 0; j--) {
            replaceBareDollar(nodes[j]);
        }
    }

    // mutation observer
    var _obs = null;
    var _timer = null;

    function onMutations() {
        clearTimeout(_timer);
        _timer = setTimeout(sweep, 50);
    }

    function startObserver() {
        if (_obs) return;
        _obs = new MutationObserver(onMutations);
        _obs.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // init — runs at document-start
    function init() {
        // wait for body to exist
        if (!document.body) {
            setTimeout(init, 10);
            return;
        }

        sweep();
        startObserver();

        // aggressive periodic sweep for first 60 seconds
        var count = 0;
        var fastInterval = setInterval(function () {
            sweep();
            count++;
            if (count >= 20) {
                clearInterval(fastInterval);
                // then every 3 seconds forever
                setInterval(sweep, 3000);
            }
        }, 3000);

        console.log('[TRV] v5.4.1 loaded — $5/23.5M rate');
    }

    // kick off
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
