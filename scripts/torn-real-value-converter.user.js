// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.4.8
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

    // convert money in a specific element
    function convertElement(el) {
        if (!el) return false;
        if (el.getAttribute('data-tt-done')) return false;
        var text = el.textContent;
        if (!text || !/\$\d/.test(text)) return false;

        var regex = /\$([\d,]+(?:\.\d+)?[KMB]?)/g;
        var newHtml = text.replace(regex, function(match, amountStr) {
            var amount = parse(match);
            if (amount !== null) {
                CONVERTED++;
                return fmt(amount * RATE);
            }
            return match;
        });

        if (newHtml !== text) {
            el.innerHTML = newHtml;
            el.setAttribute('data-tt-done', '1');
            return true;
        }
        return false;
    }

    // walk text nodes and convert
    function sweepNodes() {
        if (!document.body) return;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var toProcess = [];
        while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.textContent && /\$\d/.test(node.textContent)) {
                var parent = node.parentElement;
                if (parent && !parent.getAttribute('data-tt-done') &&
                    parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
                    toProcess.push({node: node, parent: parent});
                }
            }
        }
        // process in reverse
        for (var i = toProcess.length - 1; i >= 0; i--) {
            var item = toProcess[i];
            if (item.node.parentNode) {
                var span = document.createElement('span');
                var text = item.node.textContent;
                var regex = /\$([\d,]+(?:\.\d+)?[KMB]?)/g;
                var newHtml = text.replace(regex, function(match, amountStr) {
                    var amount = parse(match);
                    if (amount !== null) {
                        CONVERTED++;
                        return '<span style="color:inherit">' + fmt(amount * RATE) + '</span>';
                    }
                    return match;
                });
                span.innerHTML = newHtml;
                item.node.parentNode.replaceChild(span, item.node);
                item.parent.setAttribute('data-tt-done', '1');
            }
        }
    }

    // also target known torn money elements by selector
    function sweepSelectors() {
        if (!document.body) return;
        var selectors = [
            '#user-money',
            '.swiss-faction-money-value',
            '.money-positive',
            '.money-negative',
            '[data-money]',
            '.profit',
            '.bank-investment-money-cell-total',
            '.bank-investment-money-cell-per-day'
        ];
        for (var s = 0; s < selectors.length; s++) {
            var els = document.querySelectorAll(selectors[s]);
            for (var e = 0; e < els.length; e++) {
                convertElement(els[e]);
            }
        }
    }

    // watch for changes
    var obs = null;
    var timer = null;
    function onChange() {
        clearTimeout(timer);
        timer = setTimeout(function() {
            sweepNodes();
            sweepSelectors();
        }, 100);
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

    function init() {
        if (!document.body) { setTimeout(init, 50); return; }

        // initial conversion
        sweepNodes();
        sweepSelectors();

        // start observer
        startObs();

        // periodic sweep
        setInterval(function() {
            sweepNodes();
            sweepSelectors();
        }, 1000);

        // counter display
        var counter = document.createElement('div');
        counter.style.cssText = 'position:fixed;bottom:3px;left:3px;z-index:999999;font:10px monospace;color:#0f0;background:rgba(0,0,0,0.8);padding:2px 6px;border-radius:2px;pointer-events:none;';
        document.body.appendChild(counter);
        setInterval(function() {
            if (counter.parentNode) counter.textContent = 'TRV ' + CONVERTED;
        }, 500);

        console.log('[TRV] v5.4.8 loaded — $5/23.5M rate');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
