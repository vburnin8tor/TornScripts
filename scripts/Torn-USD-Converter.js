// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.4
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SHOW_ORIGINAL_VALUE = true;
    const USD_PER_TORN = 5 / 23500000;


    function formatUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;

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
            /\$([\d,.]+)\s*([kMBT])?/gi,
            (match, value, suffix) => {

                let amount = parseFloat(
                    value.replace(/,/g, '')
                );

                switch ((suffix || '')) {
                    case 'k':
                        amount *= 1e3;
                        break;
                    case 'M':
                        amount *= 1e6;
                        break;
                    case 'B':
                        amount *= 1e9;
                        break;
                    case 'T':
                        amount *= 1e12;
                        break;
                }

                return SHOW_ORIGINAL_VALUE ? formatUSD(amount) + ' (' + formatTorn(amount) + ') ' : formatUSD(amount) + ' ';
            }
        );
    }

    function processElement(el) {
        if (!el || el.dataset.usdConverted === "1") return;

        const text = el.textContent;
        if (!text || !text.includes('$')) return;

        el.textContent = convertText(text);
        el.dataset.usdConverted = "1";
    }

    function processNode(node) {
    if (
        node.nodeType !== Node.TEXT_NODE ||
        !node.nodeValue ||
        node.nodeValue.includes('(§')
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
        const spans = root.querySelectorAll?.('span[class*="displayPrice"]');
        processNode(node);
            // catch displayPrice Torn spans
        if (spans) {
            spans.forEach(processElement);
        }
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
