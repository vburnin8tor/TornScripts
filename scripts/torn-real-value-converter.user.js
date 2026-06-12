// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.2
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const USD_PER_TORN = 5 / 23500000;

    function formatUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;

        if (usd >= 1000000) {
            return '$' + usd.toLocaleString(undefined, {
                maximumFractionDigits: 0
            });
        }

        if (usd >= 1) {
            return '$' + usd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        return '$' + usd.toFixed(4);
    }

    function convertText(text) {
        return text.replace(
            /\$([\d,.]+)\s*([kmbt])?/gi,
            (match, value, suffix) => {

                let amount = parseFloat(
                    value.replace(/,/g, '')
                );

                if (isNaN(amount)) {
                    return match;
                }

                switch ((suffix || '').toLowerCase()) {
                    case 'k':
                        amount *= 1e3;
                        break;
                    case 'm':
                        amount *= 1e6;
                        break;
                    case 'b':
                        amount *= 1e9;
                        break;
                    case 't':
                        amount *= 1e12;
                        break;
                }

                // Skip suspiciously tiny values
                if (amount < 1000) {
                    return match;
                }

                return formatUSD(amount) + ' ';
            }
        );
    }

    function processNode(node) {
        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue ||
            !node.nodeValue.includes('$')
        ) {
            return;
        }

        node.nodeValue = convertText(node.nodeValue);
    }

    function scan(root) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;

        while ((node = walker.nextNode())) {
            processNode(node);
        }
    }

    scan(document.body);

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {

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
