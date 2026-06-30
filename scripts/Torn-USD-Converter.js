// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.99.2
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
    //   "simplified"   →  §1 (<$0.01)
    //   "original"     →  §23.5M
    const DISPLAY_MODE = "fullreversed";

    // Real-money value of 1 Torn dollar.
    // Update the numerator/denominator to change the exchange rate.
    const USD_PER_TORN = 5 / 23500000;

    // ─────────────────────────────────────────────
    // REGEX
    // ─────────────────────────────────────────────

    // Matches "$1,234", "$5.6M", "$2bil", "$1 million", etc.
    // Suffix must be immediately followed by a non-word character so we don't
    // accidentally grab the "M" in "Market" or the "B" in "Billion".
    const TORN_PRICE_REGEX =
        /\$([\d,.]+ ?)([kMBT]|mil|mill|bil|bill|million|billion|trillion)?(?!\w)/gi;

    // CSS selector for structured price blocks and generic price divs.
    const PRICE_ELEMENT_SELECTOR = [
    'span[class*="displayPrice"]',
    'div[class*="price"]',
    'div[class*="priceAndTotal"]',
    '[class*="winner"]',
    '[class*="classified"]',
    '[class*="reward"]',
    '[class*="price"]',
    '[class*="sum"]'
    ].join(',');

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

        const multipliers = {
            'k':        1e3,
            'm':        1e6,
            'mil':      1e6,
            'mill':     1e6,
            'million':  1e6,
            'b':        1e9,
            'bil':      1e9,
            'bill':     1e9,
            'billion':  1e9,
            't':        1e12,
            'trillion': 1e12,
        };

        const key = (suffix || '').trim().toLowerCase();
        return baseAmount * (multipliers[key] ?? 1);
    }

    /**
     * Given a price-element's text (e.g. "$872,995"), return [tornFormatted, usdFormatted].
     * Returns null if no price is found.
     */
    function parseSinglePriceElement(elementText) {
        const match = elementText.match(TORN_PRICE_REGEX);
        if (!match) return null;

        // match[1] = numeric part, match[2] = optional suffix (may be undefined)
        const tornAmount = parseTornAmount(match[1], match[2]);
        if (tornAmount === null) return null;

        const abbrev = DISPLAY_MODE === 'converted' || DISPLAY_MODE === 'combined' || DISPLAY_MODE === 'reversed';
        return [formatAsTorn(tornAmount, abbrev), formatAsUSD(tornAmount)];
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
            const abbrev = DISPLAY_MODE === 'converted' || DISPLAY_MODE === 'combined' || DISPLAY_MODE === 'reversed';
            const tornFormatted = formatAsTorn(tornAmount, abbrev);
            const usdFormatted  = formatAsUSD(tornAmount);

            switch (DISPLAY_MODE) {
                case 'converted':    return usdFormatted;
                case 'combined':     return `${usdFormatted} (${tornFormatted}) `;
                case 'reversed':     return `${tornFormatted} (${usdFormatted}) `;
                case 'full':         return `${usdFormatted} (${originalWithTornSymbol}) `;
                case 'fullreversed': return `${originalWithTornSymbol} (${usdFormatted}) `;
                case 'original':     return originalWithTornSymbol;
                default:             return fullMatch;
            }
        });
    }

    // ─────────────────────────────────────────────
    // FORMATTING
    // ─────────────────────────────────────────────

    /**
     * Format a Torn-dollar amount as a USD string.
     * Once the value hits USD_CENTS_THRESHOLD ($0.02) we round to cents —
     * at that point sub-cent precision is more noise than signal.
     */
    function formatAsUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;

        if (usd === 0)                       return '$0';
        if (tornAmount >= 94000) {
            // Round to nearest cent; use locale formatting for large values.
            return '$' + usd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        }
        // Sub-cent: show as many decimal places as needed to see at least one sig fig.
        if (usd >= 0.001)  return '$' + usd.toFixed(4);
        if (usd >= 0.0001) return '$' + usd.toFixed(5);
        if (usd >= 0.00001) return '$' + usd.toFixed(6);
        return '$' + usd.toFixed(7);
    }

    /**
     * Format a Torn-dollar amount using the § currency symbol with T/B/M/k suffixes.
     * Values under 1,000 are always shown as plain integers (e.g. §590).
     * Values 1,000–93,599 abbreviate to 'k' only when `abbreviate` is true
     * (i.e. in full/fullreversed modes where space is tight).
     */
    function formatAsTorn(tornAmount, abbreviate = false) {
        if (tornAmount >= 1e12) {
            return '§' + (tornAmount / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
        }
        if (tornAmount >= 1e9) {
            return '§' + (tornAmount / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
        }
        if (tornAmount >= 1e6) {
            return '§' + (tornAmount / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
        }
        if (abbreviate && tornAmount >= 93969) {
            return '§' + (tornAmount / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'k';
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
     * True if this node has a converted ancestor — meaning processElement already
     * handled a parent element and stamped data-usd-converted="1" on it.
     * The text walker must skip these or it will re-convert the already-formatted output.
     */
    function isInsideConvertedElement(node) {
        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (el) {
            if (el.dataset?.usdConverted === '1') return true;
            el = el.parentElement;
        }
        return false;
    }

    /**
     * True if this element is a structured priceAndTotal block.
     */
    function isPriceAndTotalElement(el) {
        return el.tagName === 'DIV' && el.className.includes('priceAndTotal');
    }

    /**
     * True if this is a generic price/sum/winner div (but NOT a priceAndTotal block).
     */
    function isGenericPriceElement(el) {
    const cls = el.className || '';

    return (
        !cls.includes('priceAndTotal') &&
        (
            cls.includes('price') ||
            cls.includes('sum') ||
            cls.includes('winner') ||
            cls.includes('classified') ||
            cls.includes('reward') ||
            cls.includes('link')
        )
    );
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
     */
    function processPriceAndTotalBlock(containerEl) {
        const priceSpan = containerEl.querySelector(
            '[class*="priceAndTotal"] > span:not([class*="titleTotal"])'
        );
        const totalSpan = containerEl.querySelector(
            '[class*="priceAndTotal"] > span[class*="titleTotal"]'
        );

        if (!priceSpan) return;

        const parsed = parseSinglePriceElement(priceSpan.textContent);
        if (!parsed) return;

        const [torn, usd]    = parsed;
        const originalPrice  = priceSpan.textContent;
        const total          = totalSpan?.textContent ?? '';
        let content;

        switch (DISPLAY_MODE) {
            case 'converted':    content = `${usd} (${total})`;         break;
            case 'combined':     content = `${usd} (${torn})`;          break;
            case 'reversed':     content = `${torn} (${usd})`;          break;
            case 'full':         content = `${usd} (${originalPrice})`; break;
            case 'fullreversed': content = `${originalPrice} (${usd})`; break;
            case 'original':     content = `${torn} (${total})`;        break;
            default:             content = `${originalPrice} (${usd})`; break;
        }

        priceSpan.innerHTML = content;

        if (totalSpan) {
            priceSpan.appendChild(document.createElement('br'));
            priceSpan.appendChild(totalSpan);
        }

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
            case 'converted':    output = usd;                break;
            case 'combined':     output = `${usd} (${torn})`; break;
            case 'reversed':     output = `${torn} (${usd})`; break;
            case 'full':         output = `${usd} (${torn})`; break;
            case 'fullreversed': output = `${torn} (${usd})`; break;
            case 'original':     output = torn;               break;
            default:             output = `${torn} (${usd})`; break;
        }

        el.innerHTML = output;
        el.dataset.usdConverted = '1';
    }

    /**
     * Route a price-related element to the right handler.
     * IMPORTANT: check priceAndTotal FIRST — its class also contains "price",
     * so the generic handler would incorrectly grab it otherwise.
     */
    function processElement(el) {
        if (!el || el.dataset.usdConverted === '1') return;
        if (el.dataset.testid === 'price') return;          // handled by text walker; skip to avoid double-conversion
        if (el.textContent.includes('($') || el.textContent.includes('§')) return;

        if (isPriceAndTotalElement(el)) {
            processPriceAndTotalBlock(el);
        } else if (isGenericPriceElement(el)) {
            processGenericPriceElement(el);
        } else {
            // Fallback: matched selector but not a handled element type.
            const text = el.textContent;
            if (!text || !text.includes('$'))           return;
            if (text.includes('(§') || text.includes('($')) return;

            el.textContent = convertPriceTextContent(text);
            el.dataset.usdConverted = '1';
        }
    }

    /**
     * Convert any Torn price patterns found inside a raw text node.
     * Skips nodes inside priceAndTotal blocks and already-converted nodes.
     */
    function processTextNode(node) {
        if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
        if (isInsidePriceAndTotal(node.parentElement))           return;
        if (isInsideConvertedElement(node))                      return;  // parent element already converted; don't re-process
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
                for (const el of priceNodes) processElement(el);
            }
        }

        const walker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while ((node = walker.nextNode())) processTextNode(node);
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

    mutationObserver.observe(document.body, { childList: true, subtree: true });

})();