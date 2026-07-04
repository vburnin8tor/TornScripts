// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      2.4
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

    // Display mode options:
    //   "converted"    →  $5.00
    //   "combined"     →  $5.00 (§23.5M)
    //   "reversed"     →  §23.5M ($5.00)
    //   "full"         →  $5.00 (§23,500,001)
    //   "fullreversed" →  §23,500,001 ($5.00)    ← default
    //   "reduced"      →  §1 (<$0.01)
    //   "original"     →  §23.5M
    const DISPLAY_MODE = 'fullreversed';

    // Real-money value of 1 Torn dollar (adjust numerator/denominator to change rate)
    const USD_PER_TORN = 5 / 23500000;

    // Enable console debug output (comment out to disable)
    // const DEBUG = true;
    const DEBUG = false;

    // ─────────────────────────────────────────────
    // REGEX
    // ─────────────────────────────────────────────

    // Matches Torn currency patterns: $1,234, $5.6M, $2bil, $1 million, etc.
    const TORN_PRICE_REGEX = /\$([\d,.]+ ?)([kMBT]|mil|mill|bil|bill|million|billion|trillion)?(?!\w)/gi;

    // Extract numeric value from a single price element
    const SINGLE_PRICE_REGEX = /\$([\d,.]+)/;

    // CSS selector for price-related elements
    const PRICE_ELEMENT_SELECTOR =
        'span[class*="displayPrice"], span[class*="price"], div[class*="price"], div[class*="priceAndTotal"], span[class*=sum], span[class*=grandTotal]';

    // ─────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────

    function log(message, data, element) {
        if (!DEBUG) return;
        if (element) {
            console.log(`[TornUSD] ${message}`, data, element);
        } else if (data !== undefined) {
            console.log(`[TornUSD] ${message}`, data);
        } else {
            console.log(`[TornUSD] ${message}`);
        }
    }

    // ─────────────────────────────────────────────
    // PARSING
    // ─────────────────────────────────────────────

    function parseTornAmount(numericString, suffix) {
        // Expand torn values with suffix multipliers
        // e.g. ("5.6", "M") → 5,600,000
        //      ("1", "million") → 1,000,000

        let baseAmount = parseFloat(numericString.replace(/,/g, ''));
        if (Number.isNaN(baseAmount)) return null;

        const normalizedSuffix = (suffix || '').toLowerCase();

        const multipliers = {
            k: 1e3,
            m: 1e6,
            mil: 1e6,
            mill: 1e6,
            million: 1e6,
            b: 1e9,
            bil: 1e9,
            bill: 1e9,
            billion: 1e9,
            t: 1e12,
            trillion: 1e12,
        };

        return baseAmount * (multipliers[normalizedSuffix] ?? 1);
    }

    function parseSinglePriceElement(elementText) {
        // Extract price amount and suffix from element text
        // Returns [tornFormatted, usdFormatted] or null if no price found

        const match = elementText.match(SINGLE_PRICE_REGEX);
        if (!match) return null;

        const numericString = match[1];
        const tornAmount = parseTornAmount(numericString);
        if (tornAmount === null) return null;

        return [formatAsTorn(tornAmount), formatAsUSD(tornAmount)];
    }

    function convertPriceTextContent(text) {
        // Replace all Torn price patterns in text with formatted conversions
        // Add space after closing parenthesis to separate from following elements

        return text.replace(TORN_PRICE_REGEX, (fullMatch, numericPart, suffix) => {
            const tornAmount = parseTornAmount(numericPart, suffix);
            if (tornAmount == null) return fullMatch;

            const originalWithTornSymbol = fullMatch.replace('$', '§');
            const tornFormatted = formatAsTorn(tornAmount);
            const usdFormatted = formatAsUSD(tornAmount);

            let result;
            switch (DISPLAY_MODE) {
                case 'converted':
                    result = usdFormatted;
                    break;
                case 'combined':
                    result = `${usdFormatted} (${tornFormatted})`;
                    break;
                case 'reversed':
                    result = `${tornFormatted} (${usdFormatted})`;
                    break;
                case 'full':
                    result = `${usdFormatted} (${originalWithTornSymbol})`;
                    break;
                case 'fullreversed':
                    result = `${originalWithTornSymbol} (${usdFormatted})`;
                    break;
                case 'reduced':
                    result = `${tornFormatted} (<${usdFormatted === '$0' ? '$0.01' : usdFormatted}>)`;
                    break;
                case 'original':
                    result = originalWithTornSymbol;
                    break;
                default:
                    result = fullMatch;
            }

            // Add space after closing paren if followed by bracket or other non-whitespace
            if (result.endsWith(')') && fullMatch !== result) {
                result += ' ';
            }

            return result;
        });
    }

    // ─────────────────────────────────────────────
    // FORMATTING
    // ─────────────────────────────────────────────

    function formatAsUSD(tornAmount) {
        // Convert Torn amount to USD string with appropriate decimal places

        const usdValue = tornAmount * USD_PER_TORN;

        if (usdValue === 0) return '$0';
        if (usdValue <= 0.000001) return '$' + usdValue.toFixed(7);
        if (usdValue <= 0.00001) return '$' + usdValue.toFixed(6);
        if (usdValue <= 0.0001) return '$' + usdValue.toFixed(5);
        if (usdValue >= 0.02)
            return (
                '$' +
                usdValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })
            );

        return '$' + usdValue.toFixed(4);
    }

    function formatAsTorn(tornAmount) {
        // Format Torn amount with § symbol and T/B/M/k suffixes
        // Only used in combined/reversed/reduced display modes

        if (tornAmount >= 1e12) {
            return '§' + (tornAmount / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
        }
        if (tornAmount >= 1e9) {
            return '§' + (tornAmount / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
        }
        if (tornAmount >= 1e6) {
            return '§' + (tornAmount / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
        }
        if (tornAmount >= 1e3) {
            return '§' + (tornAmount / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'k';
        }

        return '§' + tornAmount.toLocaleString();
    }

    // ─────────────────────────────────────────────
    // GUARDS
    // ─────────────────────────────────────────────

    function isInsidePriceAndTotal(el) {
        // Check if element is nested inside a priceAndTotal block
        // (Item Market structured pricing, handled separately)

        while (el) {
            if (el.classList?.contains('priceAndTotal')) return true;
            el = el.parentElement;
        }
        return false;
    }

    function isGenericPriceElement(el) {
        // Check if element is a generic price div/span (not priceAndTotal)

        if (el.tagName !== 'DIV' && el.tagName !== 'SPAN') return false;

        const cls = el.className || '';
        const isPrice = cls.includes('price') && !cls.includes('priceAndTotal');
        const isOtherTarget = cls.includes('sum') || cls.includes('grandTotal');

        return isPrice || isOtherTarget;
    }

    function isPriceAndTotalElement(el) {
        // Check if element is a structured priceAndTotal block (Item Market)

        return el.tagName === 'DIV' && el.className.includes('priceAndTotal');
    }

    // ─────────────────────────────────────────────
    // DOM PROCESSING
    // ─────────────────────────────────────────────

    function processPriceAndTotalBlock(containerEl) {
        // Handle Item Market's structured priceAndTotal block
        // Expected structure:
        //   <div class="priceAndTotal">
        //     <span>$872,995</span>
        //     <span class="titleTotal">(13,456)</span>
        //   </div>

        const priceSpan = containerEl.querySelector('[class*="priceAndTotal"] > span:not([class*="titleTotal"])');
        const totalSpan = containerEl.querySelector('[class*="priceAndTotal"] > span[class*="titleTotal"]');

        if (!priceSpan) return;

        const parsed = parseSinglePriceElement(priceSpan.textContent);
        if (!parsed) return;

        const [torn, usd] = parsed;
        const originalPrice = priceSpan.textContent;
        const total = totalSpan?.textContent || '';
        let output;

        switch (DISPLAY_MODE) {
            case 'converted':
                output = `${usd} (${total})`;
                break;
            case 'combined':
                output = `${usd} (${torn})`;
                break;
            case 'reversed':
                output = `${torn} (${usd})`;
                break;
            case 'full':
                output = `${usd} (${originalPrice})`;
                break;
            case 'fullreversed':
                output = `${originalPrice} (${usd})`;
                break;
            case 'reduced':
                output = `${torn} (<${usd === '$0' ? '$0.01' : usd}>)`;
                break;
            case 'original':
                output = `${torn} (${total})`;
                break;
            default:
                output = `${originalPrice} (${usd})`;
        }

        priceSpan.innerHTML = output;

        if (totalSpan) {
            priceSpan.appendChild(document.createElement('br'));
            priceSpan.appendChild(totalSpan);
        }

        log(`Converting priceAndTotal: ${originalPrice}`, { torn, usd }, containerEl);

        containerEl.dataset.usdConverted = '1';
    }

    function processGenericPriceElement(el) {
        // Handle generic price elements like <div class="price">$872,995</div>

        const parsed = parseSinglePriceElement(el.textContent);
        if (!parsed) return;

        const [torn, usd] = parsed;
        const originalText = el.textContent;
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
            case 'reduced':
                output = `${torn} (<${usd === '$0' ? '$0.01' : usd}>)`;
                break;
            case 'original':
                output = torn;
                break;
            default:
                output = `${torn} (${usd})`;
        }

        el.innerHTML = output;

        log(`Converting generic price: ${originalText}`, { torn, usd }, el);

        el.dataset.usdConverted = '1';
    }

    function processElement(el) {
        // Route element to appropriate handler based on type
        // IMPORTANT: check priceAndTotal first since its class contains "price"

        if (!el || el.dataset.usdConverted === '1') return;
        if (el.textContent.includes('($') || el.textContent.includes('§')) return;

        if (isPriceAndTotalElement(el)) {
            processPriceAndTotalBlock(el);
        } else if (isGenericPriceElement(el)) {
            processGenericPriceElement(el);
        } else {
            // Fallback: treat as plain text conversion
            const text = el.textContent;
            if (!text || !text.includes('$')) return;
            if (text.includes('(§') || text.includes('($')) return;

            el.textContent = convertPriceTextContent(text);
            el.dataset.usdConverted = '1';
        }
    }

    function processTextNode(node) {
        // Convert Torn price patterns in raw text nodes
        // Skip nodes inside priceAndTotal blocks (they have own handler)

        if (node.nodeType !== Node.TEXT_NODE) {
            return;
        }

        if (!node.nodeValue) {
            return;
        }

        if (isInsidePriceAndTotal(node.parentElement)) {
            log(`Skipped node inside priceAndTotal: "${node.nodeValue}"`);
            return;
        }

        if (node.nodeValue.includes('(§') || node.nodeValue.includes('($')) {
            log(`Skipped already converted node: "${node.nodeValue}"`);
            return;
        }

        if (!node.nodeValue.includes('$')) {
            return;
        }

        log(`Found text node with $: "${node.nodeValue}"`, null, node.parentElement);

        const originalValue = node.nodeValue;
        node.nodeValue = convertPriceTextContent(node.nodeValue);

        if (originalValue !== node.nodeValue) {
            log(`Text node conversion: "${originalValue}" → "${node.nodeValue}"`, null, node.parentElement);
        }
    }

    // ─────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────

    function scanSubtree(rootNode) {
        // Walk DOM subtree and process all price elements and text nodes

        if (!rootNode) return;

        if (rootNode.nodeType === Node.ELEMENT_NODE) {
            const priceNodes = rootNode.querySelectorAll?.(PRICE_ELEMENT_SELECTOR);
            if (priceNodes && priceNodes.length > 0) {
                log(`Found ${priceNodes.length} price elements`);
                for (const el of priceNodes) {
                    processElement(el);
                }
            }
        }

        const textWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);

        let currentNode;
        while ((currentNode = textWalker.nextNode())) {
            processTextNode(currentNode);
        }
    }

    // ─────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────

    log(`Torn USD Converter initialized (Mode: ${DISPLAY_MODE})`);

    // Initial scan of page
    scanSubtree(document.body);

    // Watch for dynamically added content
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
