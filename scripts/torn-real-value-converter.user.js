// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.4.0
// @description  Converts all Torn cash values to real USD using the classic $5/23.5M rate. Replaces $amount with converted value everywhere. Unconverted torn values show §.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/*
    Torn Real Value Converter v5.4.0
    ----------------------------------
    classic rate: $5 USD per 23.5M Torn Money
    that's $0.0000002128 per Torn $

    what it does:
    - finds every $amount on the page
    - replaces it with the converted USD value
    - any torn value that can't be converted gets § instead of $
    - runs continuously to catch Torn's dynamic content

    no APIs, no keys, no settings. just math.
*/

(function () {
    'use strict';

    // the classic rate
    var RATE = 5 / 23500000;

    // format a number nicely
    function fmt(val) {
        if (val == null || isNaN(val)) return '—';
        var a = Math.abs(val);
        if (a >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (a >= 1) return '$' + val.toFixed(2);
        return '$' + val.toFixed(4);
    }

    // parse "$5,000,000" or "$5.2M" into a number
    function parseMoney(text) {
        var s = text.replace(/[$,]/g, '');
        var mult = 1;
        if (/[Kk]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
        else if (/[Mm]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
        else if (/[Bb]$/.test(s)) { mult = 1e9; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isNaN(n) ? null : n * mult;
    }

    // check if an element is inside our own UI
    function isOurs(el) {
        var cur = el;
        while (cur) {
            if (cur.className && typeof cur.className === 'string' && cur.className.indexOf('tt-') !== -1) return true;
            if (cur.tagName === 'SCRIPT' || cur.tagName === 'STYLE') return true;
            cur = cur.parentElement;
        }
        return false;
    }

    // process a single text node: replace $amount with converted value
    function processNode(node) {
        if (!node || node.nodeType !== 3) return;
        var text = node.textContent;
        if (text.indexOf('$') === -1) return;
        if (!/\$\d/.test(text)) return;

        var p = node.parentElement;
        if (!p) return;
        if (isOurs(p)) return;

        // match $ followed by digits, optional commas/decimals, optional K/M/B
        var regex = /\$([\d,]+(?:\.\d+)?[KMBkmb]?)/g;
        var match, lastIdx = 0;
        var frag = document.createDocumentFragment();
        var found = false;

        while ((match = regex.exec(text)) !== null) {
            found = true;

            // text before the match
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            }

            var tornAmt = parseMoney('$' + match[1]);
            if (tornAmt !== null) {
                // convert and replace
                var usd = tornAmt * RATE;
                var span = document.createElement('span');
                span.className = 'tt-val';
                span.textContent = fmt(usd);
                frag.appendChild(span);
            } else {
                // couldn't parse, keep as-is
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
    }

    // walk the whole DOM and process all text nodes
    function sweep() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var tn;
        while ((tn = walker.nextNode())) {
            processNode(tn);
        }
    }

    // also replace standalone $ signs (not followed by digits) with §
    // this handles cases like "Cash: $" where the amount is in a separate node
    function replaceBareSymbols() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var tn;
        while ((tn = walker.nextNode())) {
            if (tn.textContent === '$' || tn.textContent === ' $') {
                var p = tn.parentElement;
                if (p && !isOurs(p)) {
                    tn.textContent = tn.textContent.replace('$', '\u00a7');
                }
            }
        }
    }

    // mutation observer for dynamic content
    var _obs = null;
    var _debounce = null;

    function startObserver() {
        if (_obs) return;
        _obs = new MutationObserver(function (muts) {
            var nodes = [];
            for (var i = 0; i < muts.length; i++) {
                for (var j = 0; j < muts[i].addedNodes.length; j++) {
                    var nd = muts[i].addedNodes[j];
                    if (nd.nodeType === 3) {
                        if (nd.textContent.indexOf('$') !== -1) nodes.push(nd);
                    } else if (nd.nodeType === 1 && !isOurs(nd)) {
                        var w = document.createTreeWalker(nd, NodeFilter.SHOW_TEXT, null);
                        var t;
                        while ((t = w.nextNode())) {
                            if (t.textContent.indexOf('$') !== -1) nodes.push(t);
                        }
                    }
                }
            }
            if (nodes.length === 0) return;
            clearTimeout(_debounce);
            _debounce = setTimeout(function () {
                for (var n = 0; n < nodes.length; n++) {
                    if (nodes[n].parentNode) processNode(nodes[n]);
                }
                replaceBareSymbols();
            }, 100);
        });
        _obs.observe(document.body, { childList: true, subtree: true });
    }

    // init
    function init() {
        // initial sweep
        sweep();
        replaceBareSymbols();

        // start observer
        startObserver();

        // periodic sweep every 2 seconds to catch anything missed
        setInterval(function () {
            sweep();
            replaceBareSymbols();
        }, 2000);

        console.log('[TRV] Torn Real Value Converter v5.4.0 loaded — $5/23.5M rate');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
