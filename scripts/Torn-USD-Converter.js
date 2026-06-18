// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.9.1
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// @license MIT
// @namespace https://greasyfork.org/users/559205
// @downloadURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.user.js
// @updateURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.meta.js
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
    //   "badge"        -> §23.5M $5.00  (original price + small green USD badge appended)

    const USD_PER_TORN = 5 / 23500000;

    const PRICE_REGEX = /\$([\d,.]+)\s*(k|m|b|t|mil|mill|bil|bn|tril)?/gi;
    const SIMPLE_PRICE_REGEX = /\$([\d,.]+)/;

    const PRICE_SELECTOR =
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"]';

    // =========================
    // BADGE STYLING (for "badge" mode only)
    // =========================
    const BADGE_CLASS = "usd-converter-badge";

    function ensureBadgeStyle() {
        if (document.getElementById("usd-converter-style")) return;
        const style = document.createElement("style");
        style.id = "usd-converter-style";
        style.textContent = `
            .${BADGE_CLASS} {
                font-size: 0.75em;
                opacity: 0.7;
                margin-left: 4px;
                white-space: nowrap;
                color: #8bc34a;
            }
        `;
        document.head.appendChild(style);
    }

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
            case 'M':
            case 'm':
            case 'mil': amount *= 1e6; break;
            case 'B':
            case 'b':
            case 'bil': amount *= 1e9; break;
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

    // =========================
    // TEXT CONVERSION (for non-badge modes)
    // =========================

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
    // BADGE CREATION (for "badge" mode)
    // =========================

    function createUSDBadge(usdText) {
        const span = document.createElement("span");
        span.className = BADGE_CLASS;
        span.textContent = usdText;
        return span;
    }

    function hasBadge(el) {
        return el.querySelector(`.${BADGE_CLASS}`) !== null;
    }

    function appendBadgeToElement(el, usdText) {
        if (hasBadge(el)) return;
        el.appendChild(document.createTextNode(' '));
        el.appendChild(createUSDBadge(usdText));
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
    // DOM PROCESSING — BADGE MODE
    // =========================

    function processElementBadge(el) {
        if (!el || el.dataset.usdConverted === '1') return;

        // STRUCTURED PRICE BLOCK
        if (isPriceAndTotalElement(el)) {
            const priceSpan = el.querySelector('priceAndTotal');
            if (!priceSpan) return;

            const converted = convertSinglePrice(priceSpan.textContent);
            if (!converted) return;

            const usd = converted[1];
            appendBadgeToElement(priceSpan, usd);

            el.dataset.usdConverted = '1';
            return;
        }

        // NORMAL PRICE BLOCK
        if (isPriceElement(el)) {
            const converted = convertSinglePrice(el.textContent);
            if (!converted) return;

            const usd = converted[1];
            appendBadgeToElement(el, usd);

            el.dataset.usdConverted = '1';
            return;
        }

        // FALLBACK TEXT — walk text nodes and append badges
        const text = el.textContent;
        if (!text || !text.includes('$')) return;
        if (text.includes('(§') || text.includes('($')) return;

        processTextNodesBadge(el);
        el.dataset.usdConverted = '1';
    }

    function processTextNodesBadge(el) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        const nodesToProcess = [];
        let node;
        while ((node = walker.nextNode())) {
            if (
                node.nodeValue &&
                node.nodeValue.includes('$') &&
                !node.nodeValue.includes('(§') &&
                !node.nodeValue.includes('($') &&
                !isInsidePriceAndTotal(node.parentElement)
            ) {
                nodesToProcess.push(node);
            }
        }

        for (const textNode of nodesToProcess) {
            processTextNodeBadge(textNode);
        }
    }

    function processTextNodeBadge(node) {
        if (!node.nodeValue) return;

        const text = node.nodeValue;
        const parent = node.parentElement;
        if (!parent) return;

        PRICE_REGEX.lastIndex = 0;

        let lastIndex = 0;
        let match;
        const fragments = [];

        while ((match = PRICE_REGEX.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            // Keep original price text
            fragments.push(document.createTextNode(match[0]));

            // Append USD badge
            const amount = parseTornAmount(match[1], match[2]);
            if (amount != null) {
                fragments.push(document.createTextNode(' '));
                fragments.push(createUSDBadge(formatUSD(amount)));
            }

            lastIndex = PRICE_REGEX.lastIndex;
        }

        if (lastIndex < text.length) {
            fragments.push(document.createTextNode(text.slice(lastIndex)));
        }

        if (fragments.length === 0) return;

        const frag = document.createDocumentFragment();
        for (const f of fragments) frag.appendChild(f);
        parent.replaceChild(frag, node);
    }

    // =========================
    // DOM PROCESSING — STANDARD MODES (converted/combined/reversed/full/fullreversed/original)
    // =========================

    function processElementStandard(el) {
        if (!el || el.dataset.usdConverted === '1') return;

        // STRUCTURED PRICE BLOCK
        if (isPriceAndTotalElement(el)) {
            const priceSpan = el.querySelector('priceAndTotal');
            const totalSpan = el.querySelector('span:titleTotal');

            if (!priceSpan) return;

            const converted = convertSinglePrice(priceSpan.textContent);
            if (!converted) return;

            const torn = converted[0];
            const usd = converted[1];
            const price = priceSpan.textContent;
            const total = totalSpan ? totalSpan.textContent : '';
            let stack = [];

            switch (DISPLAY_MODE) {
                case 'converted':
                    stack = [`${usd} (${total})`];
                    break;
                case 'combined':
                    stack = [`${usd} (${torn}) (${total})`];
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

            priceSpan.innerHTML = stack.join('<br>');
            el.dataset.usdConverted = '1';
            return;
        }

        // NORMAL PRICE BLOCK
        if (isPriceElement(el)) {
            const converted = convertSinglePrice(el.textContent);
            if (!converted) return;

            const torn = converted[0];
            const usd = converted[1];

            let output;
            switch (DISPLAY_MODE) {
                case 'converted': output = usd; break;
                case 'combined': output = `${usd} (${torn})`; break;
                case 'reversed': output = `${torn} (${usd})`; break;
                case 'full': output = `${usd} (${torn})`; break;
                case 'fullreversed': output = `${torn} (${usd})`; break;
                case 'original': output = torn; break;
                default: output = `${torn} (${usd})`;
            }

            el.innerHTML = output;
            el.dataset.usdConverted = '1';
            return;
        }

        // FALLBACK TEXT
        const text = el.textContent;
        if (!text || !text.includes('$')) return;
        if (text.includes('(§') || text.includes('($')) return;

        el.textContent = convertText(text);
        el.dataset.usdConverted = '1';
    }

    function processTextNodeStandard(node) {
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

    const isBadgeMode = DISPLAY_MODE === 'badge';

    function scan(root) {
        if (!root) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            const priceNodes = root.querySelectorAll?.(PRICE_SELECTOR);
            if (priceNodes) {
                for (const el of priceNodes) {
                    if (isBadgeMode) {
                        processElementBadge(el);
                    } else {
                        processElementStandard(el);
                    }
                }
            }
        }

        // Text node walking — only in standard modes
        if (!isBadgeMode) {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while ((node = walker.nextNode())) {
                processTextNodeStandard(node);
            }
        }
    }

    // =========================
    // INIT
    // =========================

    if (isBadgeMode) {
        ensureBadgeStyle();
    }

    scan(document.body);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (!isBadgeMode) {
                        processTextNodeStandard(node);
                    }
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
