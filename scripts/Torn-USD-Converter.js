// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.5
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SHOW_ORIGINAL_VALUE = true;
    const USD_PER_TORN = 5 / 23500000;

    function formatUSD(tornAmount) {
        var usd = tornAmount * USD_PER_TORN;

        if (usd <= 0.00001){
            return '$' + usd.toFixed(6)
        }

        if (usd <= 0.0001 ){
            return '$' + usd.toFixed(5)
        }

        if (usd >= 9999) {
            return '$' + usd.toFixed(0)
        }

        if (usd >= 0.01) {
            return '$' + usd.toFixed(2)
        }

        return '$' + usd.toFixed(4);
    }

    function formatTorn(tornAmount) {
        if (tornAmount >= 1e10) {
            return '§' + (tornAmount / 1e9).toFixed(2) + 'B';
        }
        if (tornAmount >= 1e7) {
            return '§' + (tornAmount / 1e6).toFixed(2) + 'M';
        }
        return '§' + tornAmount.toLocaleString(undefined, {
            maximumFractionDigits: 0
        });
    }

    function convertText(text) {
        return text.replace(
            /\$([\d,.]+)\s*([kMBT]|mil|bil)?/gi,
            function(match, value, suffix) {

                var amount = parseFloat(
                    value.replace(/,/g, '')
                );

                if (isNaN(amount)) return match;

                switch ((suffix || '').toLowerCase()) {
                    case 'k':
                        amount *= 1e3;
                        break;
                    case 'm':
                    case 'mil':
                        amount *= 1e6;
                        break;
                    case 'b':
                    case 'bil':
                        amount *= 1e9;
                        break;
                    case 't':
                        amount *= 1e12;
                        break;
                }

                return SHOW_ORIGINAL_VALUE ? formatUSD(amount) + ' (' + formatTorn(amount) + ') ' : formatUSD(amount) + ' ';
            }
        );
    }

    function isAlreadyConverted(text) {
        if (!text) return false;
        if (text.indexOf('(§') !== -1) return true;
        return false;
    }

    function processElement(el) {
        if (!el || el.dataset.usdConverted === "1") return;

        var text = el.textContent;
        if (!text || text.indexOf('$') === -1) return;
        if (isAlreadyConverted(text)) return;

        el.textContent = convertText(text);
        el.dataset.usdConverted = "1";
    }

    function processNode(node) {
        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue ||
            isAlreadyConverted(node.nodeValue)
        ) {
            return;
        }

        var parent = node.parentElement;
        if (parent && parent.dataset.usdConverted === "1") return;

        var newValue = convertText(node.nodeValue);

        if (newValue !== node.nodeValue) {
            if (parent) parent.dataset.usdConverted = "1";
            node.nodeValue = newValue;
        }
    }

    function scan(root) {
        var walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        var node;
        while ((node = walker.nextNode())) {
            var spans = root.querySelectorAll ? root.querySelectorAll('span[class*="displayPrice"]') : null;
            processNode(node);
            if (spans) {
                for (var i = 0; i < spans.length; i++) {
                    processElement(spans[i]);
                }
            }
        }
    }

    scan(document.body);

    var observer = new MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
            var mutation = mutations[m];
            for (var n = 0; n < mutation.addedNodes.length; n++) {
                var node = mutation.addedNodes[n];

                if (node.nodeType === Node.TEXT_NODE) {
                    processNode(node);
                }

                if (node.nodeType === Node.ELEMENT_NODE) {
                    scan(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
