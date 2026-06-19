// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.8.67
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// @license MIT
// @namespace https://greasyfork.org/users/559205
// ==/UserScript==

(function () {
    'use strict';

    // =========================
    // CONFIG
    // =========================
    const DISPLAY_MODE = "fullreversed";
    // OPTIONS :
    //   "converted"    -> $5.00
    //   "combined"     -> $5.00 (§23.5M) (abbreviation starts at $0.02/94000)
    //   "reversed"     -> §23.5M ($5.00)
    //   "full"         -> $5.00 (§23,500,001)
    //   "fullreversed" -> §23,500,001 ($5.00)
    //   "original"     -> §23.5M

    const USD_PER_TORN = 5 / 23500000;

    const PRICE_REGEX = /\$([\d,.]+)([kMBT]|mil|bil| mil| bil)?(?!\w)/g;
    const SIMPLE_PRICE_REGEX = /\$([\d,.]+)/;

    const PRICE_SELECTOR =
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"]';

    // =========================
    // FORMATTING
    // =========================

    function formatUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;

        if (usd === 0) return '$0';
        if (usd <= 0.000001) return '$' + usd.toFixed(7);
        if (usd <= 0.00001) return '$' + usd.toFixed(6);
        if (usd <= 0.0001) return '$' + usd.toFixed(5);
        if (usd >= 9999) return '$' + usd.toFixed(0);
        if (usd >= 0.02) return '$' + usd.toFixed(2);

        return '$' + usd.toFixed(4);
    }

    function formatTorn(tornAmount) {
        if (tornAmount >= 1e12) {
            return '§' + (tornAmount / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
        }
        if (tornAmount >= 1e9) {
            return '§' + (tornAmount / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
        }
        if (tornAmount >= 1e6) {
            return '§' + (tornAmount / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
        }
        if (tornAmount >= 94000) {
            return '§' + (tornAmount / 1e3).toFixed(1) + 'k';
        }
        return '§' + tornAmount.toLocaleString();
    }

    // =========================
    // PARSING
    // =========================

    function parseTornAmount(rawValue, suffix = '') {
        let amount = parseFloat(rawValue.replace(/,/g, ''));
        if (Number.isNaN(amount)) return null;

        switch ((suffix || '').trim()) {
            case 'K':
            case 'k': amount *= 1e3; break;
            case 'mil':
            case 'M':
            case 'm': amount *= 1e6; break;
            case 'bil':
            case 'B':
            case 'b': amount *= 1e9; break;
            case 'T':
            case 't': amount *= 1e12; break;
        }

        return amount;
    }

    function convertSinglePrice(text) {
        const match = text.match(SIMPLE_PRICE_REGEX);
        if (!match) return null;

        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (Number.isNaN(amount)) return null;

        return [formatTorn(amount), formatUSD(amount)];
    }

    function convertText(text) {
        return text.replace(PRICE_REGEX, (match, value, suffix) => {
            const amount = parseTornAmount(value, suffix);
            if (amount == null) return match;

            switch (DISPLAY_MODE) {
                case 'converted':
                    return formatUSD(amount);

                case 'combined':
                    return `${formatUSD(amount)} (${formatTorn(amount)}) `;

                case 'reversed':
                    return `${formatTorn(amount)} (${formatUSD(amount)}) `;

                case 'full':
                    return `${formatUSD(amount)} (${match.replace('$', '§')}) `;

                case 'fullreversed':
                    return `${match.replace('$', '§')} (${formatUSD(amount)}) `;

                case 'original':
                    return match.replace('$', '§');

                default:
                    return match;
            }
        });
    }

    // =========================
    // STRUCTURE GUARDS
    // =========================

    function isInsidePriceAndTotal(el) {
        while (el) {
            if (el.classList?.contains('priceAndTotal')) return true;
            el = el.parentElement;
        }
        return false;
    }

    function isPriceElement(el) {
        return el.tagName === 'DIV' && el.className.includes('price') && !el.className.includes('priceandTotal');
    }

    function isPriceAndTotalElement(el) {
        return el.tagName === 'DIV' && el.className.includes('priceandTotal');
    }

    // =========================
    // DOM PROCESSING
    // =========================

    function processElement(el) {
    if (!el || el.dataset.usdConverted === '1') return;

    // =========================
    // STRUCTURED PRICE BLOCK
    // =========================
    if (isPriceAndTotalElement(el)) {
        const priceSpan = el.querySelector('priceAndTotal');
        const totalSpan = el.querySelector('span:titleTotal');

        if (!priceSpan) return;

        const converted = convertSinglePrice(priceSpan.textContent);
        if (!converted) return;

        const torn = converted[0];
        const usd = converted[1];
        const price = priceSpan.textContent;
        const total = totalSpan.textContent;
        let stack = [];

        switch (DISPLAY_MODE) {

            case 'converted':
                stack = [`${usd} (${total})`];
                break;

            case 'combined':
                stack = [`${usd} (${torn}) (${total})` ];
                break;

            case 'reversed':
                stack = [`${torn} (${usd}) (${total})`];
                break;

            case 'full':
                    stack = [`${usd} (${price}) (${total})`];
                break;

            case 'fullreversed':
                    stack = [`${price} (${usd}) (${total})`];
                break;

            case 'original':
                    stack = [`${torn} (${total})`];
                break;

            default:
                    stack = [`${price} (${usd}) (${total})`];
        }

        // rebuild ONLY price span
        priceSpan.innerHTML = stack.join('<br>');

        el.dataset.usdConverted = '1';
        return;
    }

    // =========================
    // NORMAL PRICE BLOCK
    // =========================
    if (isPriceElement(el)) {
        const converted = convertSinglePrice(el.textContent);
        if (!converted) return;

        const torn = converted[0];
        const usd = converted[1];

        let output;

        switch (DISPLAY_MODE) {
            case 'converted':
                output = usd;
                break;

            case 'combined':
                output = `${usd} (${torn})`;
                break;

            case 'reversed':
                output = `${torn} (${usd})`;
                break;

            case 'full':
                output = `${usd} (${torn})`;
                break;

            case 'fullreversed':
                output = `${torn} (${usd})`;
                break;

            case 'original':
                output = torn;
                break;

            default:
                output = `${torn} (${usd})`;
        }

        el.innerHTML = output;
        el.dataset.usdConverted = '1';
        return;
    }

    // =========================
    // FALLBACK TEXT
    // =========================
    const text = el.textContent;
    if (!text || !text.includes('$')) return;
    if (text.includes('(§') || text.includes('($')) return;

    el.textContent = convertText(text);
    el.dataset.usdConverted = '1';
}
    function processTextNode(node) {
        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue ||
            isInsidePriceAndTotal(node.parentElement)
        ) return;

        if (node.nodeValue.includes('(§') || node.nodeValue.includes('($')) return;

        node.nodeValue = convertText(node.nodeValue);
    }

    // =========================
    // SCAN
    // =========================

    function scan(root) {
        if (!root) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            const priceNodes = root.querySelectorAll?.(PRICE_SELECTOR);
            if (priceNodes) {
                for (const el of priceNodes) {
                    processElement(el);
                }
            }
        }

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while ((node = walker.nextNode())) {
            processTextNode(node);
        }
    }

    // =========================
    // INIT
    // =========================

    scan(document.body);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    processTextNode(node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
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
