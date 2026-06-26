// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.8.69
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// @license      MIT
// @namespace    https://greasyfork.org/users/559205
// ==/UserScript==

(function() {
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

    // Matches "$1,234", "$5.6M", "$2bil", etc.
    // Suffix is optional and must be immediately followed by a non-word character
    // so we don't accidentally grab the "B" in "Billion" or "M" in "Market".
    const TORN_PRICE_REGEX = /\$([\d,.]+)\s*([kKmMbBtT]|mil|bil)?(?=[^\w]|$)/g;

    // Simpler version used when we only need the raw number from a single element's text.
    const SINGLE_PRICE_REGEX = /\$([\d,.]+)/;

    // CSS selector for structured price blocks and generic price divs.
    const PRICE_ELEMENT_SELECTOR = '[class*="price" i]';

    // ─────────────────────────────────────────────
    // PARSING
    // ─────────────────────────────────────────────

    /**
     * Turn a raw numeric string + optional suffix into a plain Torn-dollar number.
     * e.g. ("5.6", "M") → 5_600_000
     */
    function parseTornAmount(numericString, suffix) {
        const baseAmount = parseFloat(numericString.replace(/,/g, ''));
        if (Number.isNaN(baseAmount)) return null;

        const normalizedSuffix = (suffix || '').trim().toLowerCase();

        const multipliers = {
            'k': 1e3,
            'm': 1e6,
            'mil': 1e6,
            'b': 1e9,
            'bil': 1e9,
            't': 1e12,
        };

        return baseAmount * (multipliers[normalizedSuffix] ?? 1);
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
        if (tornAmount >= 1e12) return '§' + (tornAmount / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
        if (tornAmount >= 1e9) return '§' + (tornAmount / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
        if (tornAmount >= 1e6) return '§' + (tornAmount / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
        if (tornAmount >= 94000) return '§' + (tornAmount / 1e3).toFixed(1) + 'k';
        return '§' + tornAmount.toLocaleString();
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

    // ─────────────────────────────────────────────
    // TEXT CONVERSION
    // ─────────────────────────────────────────────

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
                    return `${usdFormatted} (${tornFormatted})`;
                case 'reversed':
                    return `${tornFormatted} (${usdFormatted})`;
                case 'full':
                    return `${usdFormatted} (${originalWithTornSymbol})`;
                case 'fullreversed':
                    return `${originalWithTornSymbol} (${usdFormatted})`;
                case 'original':
                    return originalWithTornSymbol;
                default:
                    return fullMatch;
            }
        });
    }

    // ─────────────────────────────────────────────
    // GUARDS
    // ─────────────────────────────────────────────

    /**
     * True if this element (or any ancestor) has already been processed.
     * Prevents double-conversion.
     */
    function isAlreadyConverted(element) {
        let node = element;
        while (node) {
            if (node.dataset?.usdConverted === '1') return true;
            node = node.parentElement;
        }
        return false;
    }

    /**
     * True if the text already contains our conversion markers (§ or a converted bracket).
     * Prevents re-processing text nodes that were already rewritten.
     */
    function looksAlreadyConverted(text) {
        return text.includes('§') || text.includes('($');
    }

    // ─────────────────────────────────────────────
    // ELEMENT PROCESSING
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
     *     <span>§872,995 ($0.19)</span>
     *     <br>
     *     <span class="titleTotal">(13,456)</span>
     *   </div>
     *
     * Key rules:
     *   - We ONLY rewrite the text inside the price <span>.
     *   - We insert a <br> between the price span and the total span.
     *   - The totalSpan is never modified so Torn's own CSS keeps it visible.
     */
    function processPriceAndTotalBlock(containerEl) {
        // The price is in the first <span> child (not the total span).
        // Torn hashes class names: "titleTotal___Pjmco" not just "titleTotal".
        // Use attribute-contains selectors so we match regardless of the hash suffix.
        const priceSpan = containerEl.querySelector('span:not([class*="titleTotal"])');

        if (!priceSpan) return;

        const parsed = parseSinglePriceElement(priceSpan.textContent);
        if (!parsed) return;

        const [tornFormatted, usdFormatted] = parsed;
        const originalPriceText = priceSpan.textContent.trim();

        // Build the converted price text based on display mode.
        // This goes inside priceSpan only — totalSpan is hidden separately below.
        let newPriceText;
        switch (DISPLAY_MODE) {
            case 'converted':
                newPriceText = usdFormatted;
                break;
            case 'combined':
                newPriceText = `${usdFormatted} (${tornFormatted})`;
                break;
            case 'reversed':
                newPriceText = `${tornFormatted} (${usdFormatted})`;
                break;
            case 'full':
                newPriceText = `${usdFormatted} (${originalPriceText})`;
                break;
            case 'fullreversed':
                newPriceText = `${originalPriceText.replace('$', '§')} (${usdFormatted})`;
                break;
            case 'original':
                newPriceText = tornFormatted;
                break;
            default:
                newPriceText = `${tornFormatted} (${usdFormatted})`;
        }

        // Update the price span text.
        priceSpan.textContent = newPriceText;

        // Hide the total span — Torn refreshes the container constantly so any
        // layout trick (br, display:block) gets wiped. Easiest fix is to just
        // remove the total from view entirely.
        const totalSpan = containerEl.querySelector('[class*="titleTotal"]');
        if (totalSpan) totalSpan.style.display = 'none';

        containerEl.dataset.usdConverted = '1';
    }

    /**
     * Handle a generic price element like:
     *   <div class="price">$872,995</div>
     */
    function processGenericPriceElement(el) {
        const parsed = parseSinglePriceElement(el.textContent);
        if (!parsed) return;

        const [tornFormatted, usdFormatted] = parsed;

        let newContent;
        switch (DISPLAY_MODE) {
            case 'converted':
                newContent = usdFormatted;
                break;
            case 'combined':
                newContent = `${usdFormatted} (${tornFormatted})`;
                break;
            case 'reversed':
                newContent = `${tornFormatted} (${usdFormatted})`;
                break;
            case 'full':
                newContent = `${usdFormatted} (${tornFormatted})`;
                break;
            case 'fullreversed':
                newContent = `${tornFormatted} (${usdFormatted})`;
                break;
            case 'original':
                newContent = tornFormatted;
                break;
            default:
                newContent = `${tornFormatted} (${usdFormatted})`;
        }

        el.textContent = newContent;
        el.dataset.usdConverted = '1';
    }

    /**
     * Route a price-related element to the right handler.
     *
     * IMPORTANT: check priceAndTotal FIRST — its class name also contains
     * "price", so without this order the generic handler would grab it.
     * Torn hashes class names (e.g. "priceAndTotal___iTrH1") so we use
     * .includes() rather than an exact match.
     */
    function processElement(el) {
        if (!el || el.dataset.usdConverted === '1') return;

        const classString = el.className?.toString() ?? '';

        if (classString.includes('priceAndTotal')) {
            processPriceAndTotalBlock(el);
        } else if (classString.toLowerCase().includes('price')) {
            processGenericPriceElement(el);
        }
    }

    /**
     * True if this text node lives inside a priceAndTotal block.
     * Those blocks are handled structurally by processPriceAndTotalBlock —
     * the text walker must not touch them or it will corrupt the output.
     */
    function isInsidePriceAndTotalBlock(textNode) {
        let node = textNode.parentElement;
        while (node) {
            if (node.className?.toString().includes('priceAndTotal')) return true;
            node = node.parentElement;
        }
        return false;
    }

    /**
     * Convert any Torn price patterns found inside a raw text node.
     * Skips nodes inside priceAndTotal blocks (those have their own handler)
     * and nodes inside already-converted elements.
     */
    function processTextNode(textNode) {
        if (textNode.nodeType !== Node.TEXT_NODE) return;
        if (!textNode.nodeValue) return;
        if (isInsidePriceAndTotalBlock(textNode)) return;
        if (isAlreadyConverted(textNode.parentElement)) return;
        if (looksAlreadyConverted(textNode.nodeValue)) return;

        textNode.nodeValue = convertPriceTextContent(textNode.nodeValue);
    }

    // ─────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────

    /**
     * Walk a DOM subtree and process all price elements and text nodes within it.
     */
    function scanSubtree(rootNode) {
        if (!rootNode || rootNode.nodeType !== Node.ELEMENT_NODE) return;

        // Handle price elements (including the root itself).
        if (rootNode.matches?.(PRICE_ELEMENT_SELECTOR)) {
            processElement(rootNode);
        }
        rootNode.querySelectorAll(PRICE_ELEMENT_SELECTOR).forEach(processElement);

        // Walk all text nodes in the subtree.
        const textWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
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
                if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    scanSubtree(addedNode);
                } else if (addedNode.nodeType === Node.TEXT_NODE) {
                    processTextNode(addedNode);
                }
            }
        }
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

})();
