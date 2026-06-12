// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.4.7
// @description  Converts all Torn cash values to real USD using $5/23.5M rate.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    var RATE = 5 / 23500000;
    var CONVERTED = 0;

    function fmt(val) {
        if (val == null || isNaN(val)) return '?';
        var a = Math.abs(val);
        if (a >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (a >= 1) return '$' + val.toFixed(2);
        return '$' + val.toFixed(4);
    }

    function parse(s) {
        s = s.replace(/[$,]/g, '');
        var m = 1;
        if (/K$/.test(s)) { m = 1e3; s = s.slice(0, -1); }
        else if (/M$/.test(s)) { m = 1e6; s = s.slice(0, -1); }
        else if (/B$/.test(s)) { m = 1e9; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isNaN(n) ? null : n * m;
    }

    // convert a text node if it contains $amount
    function convertNode(node) {
        if (!node || node.nodeType !== 3) return false;
        var text = node.textContent;
        if (!text || !/\$\d/.test(text)) return false;

        // walk up to find parent element
        var el = node.parentElement;
        if (!el) return false;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
        // skip if already converted
        if (el.classList && el.classList.contains('tt-done')) return false;

        var regex = /\$([\d,]+(?:\.\d+)?[KMB]?)/g;
        var match, lastIdx = 0;
        var frag = document.createDocumentFragment();
        var found = false;

        while ((match = regex.exec(text)) !== null) {
            found = true;
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            }
            var amount = parse('$' + match[1]);
            if (amount !== null) {
                frag.appendChild(document.createTextNode(fmt(amount * RATE)));
                CONVERTED++;
            } else {
                frag.appendChild(document.createTextNode('$' + match[1]));
            }
            lastIdx = regex.lastIndex;
        }

        if (found && node.parentNode) {
            if (lastIdx < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx)));
            }
            node.parentNode.replaceChild(frag, node);
            // mark parent as converted
            el.classList.add('tt-done');
        }
        return found;
    }

    // sweep all text nodes
    function sweep() {
        if (!document.body) return;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var tn;
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        for (var i = nodes.length - 1; i >= 0; i--) {
            try { convertNode(nodes[i]); } catch(e) {}
        }
    }

    // watch for new content
    var obs = null;
    var timer = null;
    function onChange() {
        clearTimeout(timer);
        timer = setTimeout(sweep, 50);
    }
    function startObs() {
        if (obs) return;
        obs = new MutationObserver(onChange);
        obs.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // also target specific torn money elements by class
    function sweepElements() {
        if (!document.body) return;
        // common torn money selectors
        var selectors = [
            '[id="user-money"]',
            '.swiss-faction-money-value',
            '.money-positive',
            '.money-negative',
            '[data-money]'
        ];
        for (var s = 0; s < selectors.length; s++) {
            var els = document.querySelectorAll(selectors[s]);
            for (var e = 0; e < els.length; e++) {
                var el = els[e];
                if (el.classList.contains('tt-done')) continue;
                var text = el.textContent;
                if (!text || !/\$\d/.test(text)) continue;
                var regex = /\$([\d,]+(?:\.\d+)?[KMB]?)/g;
                var html = text.replace(regex, function(match, amount) {
                    var parsed = parse(match);
                    if (parsed !== null) {
                        CONVERTED++;
                        return fmt(parsed * RATE);
                    }
                    return match;
                });
                el.innerHTML = html;
                el.classList.add('tt-done');
            }
        }
    }

    function init() {
        if (!document.body) { setTimeout(init, 50); return; }

        sweep();
        sweepElements();
        startObs();

        // aggressive periodic sweep
        setInterval(function() {
            sweep();
            sweepElements();
        }, 1000);

        // counter
        var counter = document.createElement('div');
        counter.style.cssText = 'position:fixed;bottom:3px;left:3px;z-index:999999;font:10px monospace;color:#0f0;background:rgba(0,0,0,0.8);padding:2px 6px;border-radius:2px;pointer-events:none;';
        document.body.appendChild(counter);
        setInterval(function() {
            if (counter.parentNode) counter.textContent = 'TRV ' + CONVERTED;
        }, 500);

        console.log('[TRV] v5.4.7 loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
