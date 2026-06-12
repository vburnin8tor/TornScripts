// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.5.0
// @description  Converts all Torn cash to real USD. Classic $5/23.5M rate. Simple.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
    Torn Real Value Converter v5.5.0
    ----------------------------------
    classic rate: $5 USD per 23.5M Torn Money

    strategy:
    - wait for document-idle (everything loaded)
    - walk every text node in the body
    - if it contains $ followed by a number, convert it
    - done. no observers, no polling, no frameworks.

    to revert: set custom rate to 1.0
*/

(function () {
    'use strict';

    // classic $5 per 23.5M
    var RATE = 5 / 23500000;

    // format a USD number for display
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

    // collect all text nodes under a root, deepest first
    function collectTextNodes(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        return nodes;
    }

    // convert $amount in a text node to its USD equivalent
    function convertTextNode(node) {
        if (!node || node.nodeType !== 3) return false;
        var text = node.textContent;
        if (!text || !/\$\d/.test(text)) return false;

        // skip script/style content
        var parent = node.parentElement;
        if (!parent) return false;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return false;

        var regex = /\$([\d,]+(?:\.\d+)?[KMB]?)/g;
        var match, lastIdx = 0;
        var frag = document.createDocumentFragment();
        var found = false;

        while ((match = regex.exec(text)) !== null) {
            found = true;

            // text before the dollar amount
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            }

            // convert the dollar amount
            var tornAmt = parse(match[0]);
            if (tornAmt !== null) {
                frag.appendChild(document.createTextNode(fmt(tornAmt * RATE)));
            } else {
                frag.appendChild(document.createTextNode(match[0]));
            }

            lastIdx = regex.lastIndex;
        }

        if (found) {
            // any remaining text after the last match
            if (lastIdx < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx)));
            }
            if (node.parentNode) {
                node.parentNode.replaceChild(frag, node);
            }
        }

        return found;
    }

    // single pass: walk all text nodes, convert any $amount found
    function convertAll() {
        var nodes = collectTextNodes(document.body);
        // process deepest nodes first so parent indices stay valid
        for (var i = nodes.length - 1; i >= 0; i--) {
            try {
                if (nodes[i].parentNode) {
                    convertTextNode(nodes[i]);
                }
            } catch (e) {
                // skip nodes that cause errors
            }
        }
    }

    // run at document-idle when everything is loaded
    function init() {
        convertAll();
        console.log('[TRV] v5.5.0 — converted all $amount values at document-idle');
    }

    // document-idle is handled by @run-at, but also check readyState
    if (document.readyState === 'complete') {
        init();
    } else {
       document.addEventListener('readystatechange', function () {
            if (document.readyState === 'complete') {
                init();
            }
        });
    }
})();
