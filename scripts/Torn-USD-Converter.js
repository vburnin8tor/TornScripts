// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.99
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// @license      MIT
// @namespace    https://greasyfork.org/users/559205
// @downloadURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.user.js
// @updateURL   https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────
    // CONFIG
    // ─────────────────────────────────────────────
    // Pick one display mode:
    //   "converted"    →  $5.00
    //   "combined"     →  $5.00 (§23.5M)
    //   "reversed"     →  §23.5M ($5.00)
    //   "full"         →  $5.00 (§23,500,001)
    //   "fullreversed" →  §23,500,001 ($5.00)    ← default
    //   "original"     →  §23.5M
    const DISPLAY_MODE = "fullreversed";

    // Real-money value of 1 Torn dollar.
    // Update the numerator/denominator to change the exchange rate.
    const USD_PER_TORN = 5 / 23_500_000;

    // ─────────────────────────────────────────────
    // REGEX
    // ─────────────────────────────────────────────

    // Matches "$1,234", "$5.6M", "$2bil", "$1 million", etc.
    // Suffix is optional and must be immediately followed by a non-word character
    // so we don't accidentally grab the "M" in "Market" or "B" in "Billion".
    const TORN_PRICE_REGEX =
        /\$([\d,.]+ ?)([kMBT]|mil|bil| mil| bil| million| billion)?(?!\w)/g;

    // Simpler version used when we only need the raw number from a single element.
    const SINGLE_PRICE_REGEX = /\$([\d,.]+)/;

    // CSS selector for structured price blocks and generic price divs.
    const PRICE_ELEMENT_SELECTOR =
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"]';

    // ─────────────────────────────────────────────
    // PARSING
    // ─────────────────────────────────────────────

    /**
     * Turn a raw numeric string + optional suffix into a plain Torn-dollar number.
     * e.g. ("5.6", "M") → 5_600_000
     *      ("1", "million") → 1_000_000
     *      ("2", "billion") → 2_000_000_000
     */
    function parseTornAmount(numericString, suffix) {
        const baseAmount = parseFloat(numericString.replace(/,/g, ''));
        if (Number.isNaN(baseAmount)) return null;

        const normalizedSuffix = (suffix || '').trim().toLowerCase();

        const multipliers = {
            'k': 1e3,
            'm': 1e6,
            'mil': 1e6,
            'million': 1e6,
            'b': 1e9,
            'bil': 1e9,
            'billion': 1e9,
            't': 1e12,
        };

        return baseAmount * (multipliers[normalizedSuffix] ?? 1);
    }

    /**
     * Given a price-element's text (e.g. "$872,995"), return [tornFormatted, usdFormatted].
     * Returns null if no price is found.
     */
    function parseSinglePriceElement(elementText) {
        const match = elementText.match(SINGLE_PRICE_REGEX);
        if (!match) return null;

        const tornAmount = parseFloat(match[1].replace(/,/g, ''));
        if (Number.isNaN(tornAmount)) return null;

        return [formatAsTorn(tornAmount), formatAsUSD(tornAmount)];
    }

    /**
     * Replace all Torn price patterns in a plain text string
     * with the chosen display format.
     */
    function convertPriceTextContent(text) {
        return text.replace(TORN_PRICE_REGEX, (fullMatch, numericPart, suffix) => {
            const tornAmount = parseTornAmount(numericPart, suffix);
            if (tornAmount == null) return fullMatch;

            const originalWithTornSymbol = fullMatch.replace('$', '§');
            const tornFormatted = formatAsTorn(tornAmount);
            const usdFormatted = formatAsUSD(tornAmount);

            switch (DISPLAY_MODE) {
                case 'converted':
                    return usdFormatted;
                case 'combined':
                    return `${usdFormatted} (${tornFormatted}) `;
                case 'reversed':
                    return `${tornFormatted} (${usdFormatted}) `;
                case 'full':
                    return `${usdFormatted} (${originalWithTornSymbol}) `;
                case 'fullreversed':
                    return `${originalWithTornSymbol} (${usdFormatted}) `;
                case 'original':
                    return originalWithTornSymbol;
                default:
                    return fullMatch;
            }
        });
    }

    // ─────────────────────────────────────────────
    // FORMATTING
    // ─────────────────────────────────────────────

    /**
     * Format a Torn-dollar amount as a USD string with appropriate decimal places.
     */
    function formatAsUSD(tornAmount) {
        const usdValue = tornAmount * USD_PER_TORN;

        if (usdValue === 0) return '$0';
        if (usdValue <= 0.000001) return '$' + usdValue.toFixed(7);
        if (usdValue <= 0.00001) return '$' + usdValue.toFixed(6);
        if (usdValue <= 0.0001) return '$' + usdValue.toFixed(5);
        if (usdValue >= 9999) return '$' + usdValue.toFixed(0);
        if (usdValue >= 0.02) return '$' + usdValue.toFixed(2);

        return '$' + usdValue.toFixed(4);
    }

    /**
     * Format a Torn-dollar amount using the § currency symbol with T/B/M/k suffixes.
     */
    function formatAsTorn(tornAmount) {
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

    // ─────────────────────────────────────────────
    // GUARDS
    // ─────────────────────────────────────────────

    /**
     * True if this element (or any ancestor) is a priceAndTotal block.
     * Those are handled structurally by processPriceAndTotalBlock —
     * the text walker must not touch them or it will corrupt the output.
     */
    function isInsidePriceAndTotal(el) {
        while (el) {
            if (el.classList?.contains('priceAndTotal')) return true;
            el = el.parentElement;
        }
        return false;
    }

    /**
     * True if this element is a generic price div (not priceAndTotal).
     */
    function isGenericPriceElement(el) {
        return (
            el.tagName === 'DIV' &&
            el.className.includes('price') &&
            !el.className.includes('priceAndTotal')
        );
    }

    /**
     * True if this element is a structured priceAndTotal block.
     */
    function isPriceAndTotalElement(el) {
        return el.tagName === 'DIV' && el.className.includes('priceAndTotal');
    }

    // ─────────────────────────────────────────────
    // DOM PROCESSING
    // ─────────────────────────────────────────────

    /**
     * Handle the structured "priceAndTotal" block used on the Item Market.
     *
     * Expected DOM structure:
     *   <div class="priceAndTotal">
     *     <span>$872,995</span>
     *     <span class="titleTotal">(13,456)</span>
     *   </div>
     *
     * Target output (fullreversed example):
     *   <div class="priceAndTotal" data-usd-converted="1">
     *     <span>§872,995<br>$0.19</span>
     *     <span class="titleTotal">(13,456)</span>
     *   </div>
     *
     * Key rules:
     *   - We ONLY rewrite the text inside the price <span>.
     *   - We insert a <br> between the converted price and the USD value.
     *   - The totalSpan is never modified so Torn's own CSS keeps it visible.
     */
    function processPriceAndTotalBlock(containerEl) {
        const priceSpan = containerEl.querySelector('priceAndTotal');
        const totalSpan = containerEl.querySelector('span:titleTotal');

        if (!priceSpan) return;

        const parsed = parseSinglePriceElement(priceSpan.textContent);
        if (!parsed) return;

        const [torn, usd] = parsed;
        const originalPrice = priceSpan.textContent;
        const total = totalSpan.textContent;
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
                stack = [`${usd} (${originalPrice}) (${total})`];
                break;
            case 'fullreversed':
                stack = [`${originalPrice} (${usd}) (${total})`];
                break;
            case 'original':
                stack = [`${torn} (${total})`];
                break;
            default:
                stack = [`${originalPrice} (${usd}) (${total})`];
        }

        // Rebuild ONLY the price span; totalSpan stays untouched.
        priceSpan.innerHTML = stack.join('<br>');

        containerEl.dataset.usdConverted = '1';
    }

    /**
     * Handle a generic price element like:
     *   <div class="price">$872,995</div>
     */
    function processGenericPriceElement(el) {
        const parsed = parseSinglePriceElement(el.textContent);
        if (!parsed) return;

        const [torn, usd] = parsed;
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
    }

    /**
     * Route a price-related element to the right handler.
     *
     * IMPORTANT: check priceAndTotal FIRST — its class name also contains
     * "price", so without this order the generic handler would grab it.
     */
    function processElement(el) {
        if (!el || el.dataset.usdConverted === '1') return;
        if (el.textContent.includes('($') || el.textContent.includes('§')) return;

        if (isPriceAndTotalElement(el)) {
            processPriceAndTotalBlock(el);
        } else if (isGenericPriceElement(el)) {
            processGenericPriceElement(el);
        } else {
            // Fallback: element matched selector but isn't a price div.
            // Treat its text content as a plain string conversion.
            const text = el.textContent;
            if (!text || !text.includes('$')) return;
            if (text.includes('(§') || text.includes('($')) return;

            el.textContent = convertPriceTextContent(text);
            el.dataset.usdConverted = '1';
        }
    }

    /**
     * Convert any Torn price patterns found inside a raw text node.
     * Skips nodes inside priceAndTotal blocks (those have their own handler)
     * and nodes that already contain conversion markers.
     */
    function processTextNode(node) {
        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue ||
            isInsidePriceAndTotal(node.parentElement)
        ) return;

        if (node.nodeValue.includes('(§') || node.nodeValue.includes('($')) return;

        node.nodeValue = convertPriceTextContent(node.nodeValue);
    }

    // ─────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────

    /**
     * Walk a DOM subtree and process all price elements and text nodes within it.
     */
    function scanSubtree(rootNode) {
        if (!rootNode) return;

        if (rootNode.nodeType === Node.ELEMENT_NODE) {
            const priceNodes = rootNode.querySelectorAll?.(PRICE_ELEMENT_SELECTOR);
            if (priceNodes) {
                for (const el of priceNodes) {
                    processElement(el);
                }
            }
        }

        const textWalker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let currentNode;
        while ((currentNode = textWalker.nextNode())) {
            processTextNode(currentNode);
        }
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────

    // Initial pass over the whole page.
    scanSubtree(document.body);

    // Watch for dynamically added content (Torn is heavily Ajax-driven).
    const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.TEXT_NODE) {
                    processTextNode(addedNode);
                } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    scanSubtree(addedNode);
                }
            }
        }
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

})();
