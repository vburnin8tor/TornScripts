// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.8
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

    const USD_PER_TORN = 5 / 23500000;

    const PRICE_REGEX = /\$([\d,.]+)([kMBT]|mil|bil| mil| bil)?/g;
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
            case 'k': amount *= 1e3; break;
            case 'M':
            case 'mil': amount *= 1e6; break;
            case 'B':
            case 'bil': amount *= 1e9; break;
            case 'T': amount *= 1e12; break;
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
                    return `${formatUSD(amount)} (${formatTorn(amount)})`;

                case 'reversed':
                    return `${formatTorn(amount)} (${formatUSD(amount)})`;

                case 'full':
                    return `${formatUSD(amount)} (${match.replace('$', '§')})`;

                case 'fullreversed':
                    return `${match.replace('$', '§')} (${formatUSD(amount)})`;

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
            if (el.className?.includes('priceandTotal')) return true;
            el = el.parentElement;
        }
        return false;
    }

    function isPriceElement(el) {
        return el.tagName === 'DIV' && el.className?.includes('price') && !el.className?.includes('priceandTotal');
    }

    function isPriceAndTotalElement(el) {
        return el.tagName === 'DIV' && el.className?.includes('priceandTotal');
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
            // structure: <span>$410</span><span class="titleTotal___..."> (215,463)</span>
            var children = el.children;
            var priceText = '';
            var totalText = '';

            for (var i = 0; i < children.length; i++) {
                var childText = children[i].textContent;
                if (childText.indexOf('$') !== -1) {
                    priceText = childText;
                } else {
                    totalText = childText;
                }
            }

            if (!priceText) return;

            var converted = convertSinglePrice(priceText);
            if (!converted) return;

            var torn = converted[0];
            var usd = converted[1];
            var stack = [];

            switch (DISPLAY_MODE) {
                case 'converted':
                    stack = [usd, totalText];
                    break;

                case 'combined':
                    stack = [usd + ' (' + torn + ')', totalText];
                    break;

                case 'reversed':
                    stack = [torn + ' (' + usd + ')', totalText];
                    break;

                case 'full':
                    stack = [usd + ' (' + priceText.replace('$', '§') + ')', totalText];
                    break;

                case 'fullreversed':
                    stack = [priceText.replace('$', '§') + ' (' + usd + ')', totalText];
                    break;

                case 'original':
                    stack = [priceText.replace('$', '§'), totalText];
                    break;

                default:
                    stack = [priceText.replace('$', '§') + ' (' + usd + ')', totalText];
            }

            // rebuild the whole div with stacked lines
            el.innerHTML = stack.filter(function(l){return l;}).join('<br>');
            el.dataset.usdConverted = '1';
            return;
        }

        // =========================
        // NORMAL PRICE BLOCK
        // =========================
        if (isPriceElement(el)) {
            var converted = convertSinglePrice(el.textContent);
            if (!converted) return;

            var torn = converted[0];
            var usd = converted[1];
            var output;

            switch (DISPLAY_MODE) {
                case 'converted':
                    output = usd;
                    break;

                case 'combined':
                    output = usd + ' (' + torn + ')';
                    break;

                case 'reversed':
                    output = torn + ' (' + usd + ')';
                    break;

                case 'full':
                    output = usd + ' (' + torn + ')';
                    break;

                case 'fullreversed':
                    output = torn + ' (' + usd + ')';
                    break;

                case 'original':
                    output = torn;
                    break;

                default:
                    output = torn + ' (' + usd + ')';
            }

            el.innerHTML = output;
            el.dataset.usdConverted = '1';
            return;
        }

        // =========================
        // FALLBACK TEXT
        // =========================
        var text = el.textContent;
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
            var priceNodes = root.querySelectorAll?.(PRICE_SELECTOR);
            if (priceNodes) {
                for (var i = 0; i < priceNodes.length; i++) {
                    processElement(priceNodes[i]);
                }
            }
        }

        var walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        var node;
        while ((node = walker.nextNode())) {
            processTextNode(node);
        }
    }

    // =========================
    // INIT
    // =========================

    scan(document.body);

    var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            for (var j = 0; j < mutation.addedNodes.length; j++) {
                var node = mutation.addedNodes[j];
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
