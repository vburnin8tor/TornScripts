// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.4.6
// @description  Converts all Torn cash values to real USD using $5/23.5M rate.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // classic $5 per 23.5M Torn Money
    var RATE = 5 / 23500000;
    var CONVERTED = 0;

    // format USD value for display
    function fmt(val) {
        if (val == null || isNaN(val)) return '?';
        var a = Math.abs(val);
        if (a >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (a >= 1) return '$' + val.toFixed(2);
        return '$' + val.toFixed(4);
    }

    // parse "$1,071,199" or "$5.2M" into a number
    function parse(s) {
        s = s.replace(/[$,]/g, '');
        var m = 1;
        if (/K$/.test(s)) { m = 1e3; s = s.slice(0, -1); }
        else if (/M$/.test(s)) { m = 1e6; s = s.slice(0, -1); }
        else if (/B$/.test(s)) { m = 1e9; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isNaN(n) ? null : n * m;
    }

    // check if element is inside our own UI
    function isOurs(el) {
        while (el) {
            if (el.className && typeof el.className === 'string') {
                // our elements use tt- prefix
                if (el.className.indexOf('tt-') !== -1) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    // process one text node
    function processTextNode(node) {
        if (!node || node.nodeType !== 3) return false;
        var text = node.textContent;
        if (!text || text.indexOf('$') === -1) return false;
        if (!/\$\d/.test(text)) return false;

        var parent = node.parentElement;
        if (!parent) return false;
        if (isOurs(parent)) return false;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return false;

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
                var span = document.createElement('span');
                span.style.color = 'inherit';
                span.textContent = fmt(amount * RATE);
                frag.appendChild(span);
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
        }

        return found;
    }

    // collect all text nodes and process them
    function sweep() {
        if (!document.body) return;
        var walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null
        );
        var nodes = [];
        var tn = walker.nextNode();
        while (tn) {
            nodes.push(tn);
            tn = walker.nextNode();
        }
        for (var i = nodes.length - 1; i >= 0; i--) {
            try { processTextNode(nodes[i]); } catch(e) {}
        }
    }

    // mutation observer - watch for ANY DOM changes
    var observer = null;
    var timer = null;

    function scheduleSweep() {
        clearTimeout(timer);
        timer = setTimeout(sweep, 100);
    }

    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(function(mutations) {
            scheduleSweep();
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    }

    // init
    function init() {
        if (!document.body) {
            setTimeout(init, 50);
            return;
        }

        sweep();
        startObserver();

        // sweep every 2 seconds for the first minute, then every 5 seconds
        var count = 0;
        var interval = setInterval(function() {
            sweep();
            count++;
            if (count > 30) {
                clearInterval(interval);
                setInterval(sweep, 5000);
            }
        }, 2000);

        // use requestAnimationFrame as another catch-all
        function rafSweep() {
            sweep();
            requestAnimationFrame(rafSweep);
        }
        requestAnimationFrame(rafSweep);

        // show a small counter so you know its working
        var counter = document.createElement('div');
        counter.id = 'tt-counter';
        counter.style.cssText = 'position:fixed;bottom:3px;left:3px;z-index:999999;font:10px monospace;color:#0f0;background:rgba(0,0,0,0.7);padding:2px 5px;border-radius:2px;pointer-events:none;';
        document.body.appendChild(counter);

        setInterval(function() {
            if (counter.parentNode) {
                counter.textContent = 'TRV ' + CONVERTED;
            }
        }, 500);

        console.log('[TRV] v5.4.6 — $5/23.5M rate active');
    }

    // start as early as possible
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
