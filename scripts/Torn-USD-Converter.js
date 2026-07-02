// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.999
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
    //   "reduced"      →  §1 (<$0.01) | §0.008 (~$0.01) | §0.015 ($0.01) | §0.02 ($0.02)
    //   "original"     →  §23.5M
    const DISPLAY_MODE = "fullreversed"; // User can change this

    // Real-money value of 1 Torn dollar.
    // Update the numerator/denominator to change the exchange rate.
    // Current rate: $5 USD per 23,500,000 Torn dollars.
    const USD_PER_TORN = 5 / 23500000;

    // ─────────────────────────────────────────────
    // REGEX
    // ─────────────────────────────────────────────

    // Matches "$1,234", "$5.6M", "$2bil", "$1 million", etc.
    // Suffix is optional and must be immediately followed by a non-word character
    // so we don't accidentally grab the "M" in "Market" or "B" in "Billion".
    // Refined to be more robust against various number formats.
    const TORN_PRICE_REGEX =
        /\$([\d,.]+ ?)([kMBT]|mil|bil|million|billion|trillion)?(?!\w)/gi;

    // Simpler version used when we only need the raw number from a single element.
    const SINGLE_PRICE_REGEX = /\$([\d,.]+)/;

    // CSS selector for structured price blocks and generic price divs.
    const PRICE_ELEMENT_SELECTOR =
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"], span[class*="winner"]';

    // ─────────────────────────────────────────────
    // PARSING
    // ─────────────────────────────────────────────

    /**
     * Turn a raw numeric string + optional suffix into a plain Torn-dollar number.
     * e.g. ("5.6", "M") → 5_600_000
     *      ("1", "million") → 1_000_000
     *      ("2", "billion") → 2_000_000_000
     *
     * Fixes potential "extra factor of ten" bug by ensuring robust number parsing.
     */
    function parseTornAmount(numericString, suffix) {
        // Normalize numeric string: remove commas (thousands separators),
        // then ensure only digits and a single decimal point remain.
        let cleanedNumericString = numericString.replace(/,/g, '');

        // Robustly handle potentially malformed numbers with multiple decimal points or non-numeric chars.
        // Assume '.' is the decimal separator.
        const parts = cleanedNumericString.split('.');
        if (parts.length > 2) {
            // If there's more than one dot, use the first one as the decimal and join the rest.
            // This handles cases like "10,4.5" -> "104.5" (incorrect input, but safer parsing)
            cleanedNumericString = parts[0] + '.' + parts.slice(1).join('');
        } else if (parts.length === 1) {
            // No dot, just digits
            cleanedNumericString = parts[0];
        } else { // parts.length === 2, one dot confirmed.
            cleanedNumericString = parts[0] + '.' + parts[1];
        }
        // Ensure no stray non-digit/non-dot characters remain if the above split logic failed somehow.
        cleanedNumericString = cleanedNumericString.replace(/[^\d.]/g, '');


        let baseAmount = parseFloat(cleanedNumericString);

        if (Number.isNaN(baseAmount)) {
            // Log error if parsing fails even after cleaning.
            console.error("Torn USD Converter: Failed to parse numeric string:", numericString, "->", cleanedNumericString);
            return null;
        }

        // Apply suffix multiplier
        const normalizedSuffix = (suffix || '').toLowerCase();
        const multipliers = {
            'k': 1e3,
            'm': 1e6,
            'mil': 1e6,
            'million': 1e6,
            'b': 1e9,
            'bil': 1e9,
            'billion': 1e9,
            't': 1e12,
            'trillion': 1e12,
        };
        // Use the multiplier, default to 1 if suffix is not recognized or empty.
        const multiplier = multipliers[normalizedSuffix] ?? 1;
        return baseAmount * multiplier;
    }

    /**
     * Given a price-element's text (e.g. "$872,995"), return [tornFormatted, usdFormatted].
     * Returns null if no price is found.
     */
    function parseSinglePriceElement(elementText) {
        const match = elementText.match(SINGLE_PRICE_REGEX);
        if (!match) return null;

        const numericString = match[1];
        // The original regex for SINGLE_PRICE_REGEX didn't capture suffix.
        // For consistency, let's use the TORN_PRICE_REGEX logic or check for suffix if needed.
        // However, `SINGLE_PRICE_REGEX` is used in `processPriceAndTotalBlock` on `priceSpan.textContent`
        // which can contain numbers like "$872,995". It's unlikely to have suffixes here.
        // Let's assume `numericString` is just the number part.
        // If it *does* have suffix here, parseTornAmount will handle `suffix` as null.
        const tornAmount = parseTornAmount(numericString, null); // Pass null for suffix
        if (tornAmount === null) return null;

        return [formatAsTorn(tornAmount), formatAsUSD(tornAmount)];
    }

    /**
     * Replace all Torn price patterns in a plain text string
     * with the chosen display format.
     */
    function convertPriceTextContent(text) {
        // Apply the regex to find all price patterns
        return text.replace(TORN_PRICE_REGEX, (fullMatch, numericPart, suffix) => {
            // Parse the captured Torn amount
            const tornAmount = parseTornAmount(numericPart, suffix);
            if (tornAmount == null) return fullMatch; // If parsing fails, return original match

            // Format the Torn amount into its original string form using torn symbol
            const formattedTorn = formatAsTorn(tornAmount);
            const usdFormatted = formatAsUSD(tornAmount);

            switch (DISPLAY_MODE) {
                case 'converted':
                    return usdFormatted;
                case 'combined':
                    return `${usdFormatted} (${formattedTorn}) `;
                case 'reversed':
                    return `${formattedTorn} (${usdFormatted}) `;
                case 'full':
                    return `${usdFormatted} (${formattedTorn}) `;
                case 'fullreversed':
                case 'reduced': // For text nodes, 'reduced' should show both Torn and USD for context.
                    return `${formattedTorn} (${usdFormatted}) `;
                case 'original':
                    return fullMatch; // Return the original matched string
                default: // Fallback for any other modes.
                    return fullMatch;
            }
        });
    }

    // ─────────────────────────────────────────────
    // FORMATTING
    // ─────────────────────────────────────────────

    /**
     * Format a Torn-dollar amount as a USD string with appropriate decimal places,
     * respecting special formatting for the "reduced" display mode.
     */
    function formatAsUSD(tornAmount) {
        const usdValue = tornAmount * USD_PER_TORN;

        if (DISPLAY_MODE === "reduced") {
            // Special handling for "reduced" mode as per user requirement:
            // - Values < 0.007 USD: "<$0.01"
            // - Values from 0.007 to <0.01 USD: "~$0.01"
            // - Values from 0.01 to <0.02 USD: "$0.01" (prefix only for values >= 2 cents removed)
            // - Values >= 0.02 USD: Standard $X.XX format.

            if (Number.isNaN(usdValue)) { // Handle potential NaN from calculation
                return "<$0.01"; // Indicate error or minimal value
            }

            if (usdValue < 0.007) {
                return "<$0.01";
            } else if (usdValue < 0.01) { // 0.007 <= usdValue < 0.01
                return "~$0.01";
            } else if (usdValue < 0.02) { // 0.01 <= usdValue < 0.02
                // Formatted to two decimal places, showing "1 cent" as value is at least 0.01.
                return "$0.01";
            } else { // usdValue >= 0.02
                // For 2 cents and up, use standard 2-decimal formatting.
                return '$' + usdValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2,});
            }
        } else {
            // Original formatting logic for other display modes.
            if (usdValue === 0) return '$0';

            if (usdValue < 0.01) { // For values less than 1 cent in NON-REDUCED modes, maintain precision.
                if (usdValue <= 0.000001) return '$' + usdValue.toFixed(7);
                if (usdValue <= 0.00001) return '$' + usdValue.toFixed(6);
                if (usdValue <= 0.0001) return '$' + usdValue.toFixed(5);
                // For values between 0.0001 and 0.01, use toFixed(4) for precision.
                return '$' + usdValue.toFixed(4);
            } else if (usdValue >= 0.02) { // Standard 2 decimal format for 2 cents and up.
                return '$' + usdValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2,});
            } else { // For values between 0.01 (inclusive) and 0.02 (exclusive) in non-reduced modes
                // Maintain precision as per original script's toFixed(4).
                return '$' + usdValue.toFixed(4);
            }
        }
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
        if (tornAmount >= 1e3) {
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

    function isGenericPriceElement(el) {
        if (el.tagName !== 'DIV') return false;

        const cls = el.className || '';

        // Check if it's a div with 'price' in class name, but NOT 'priceAndTotal'
        const isPriceClass = cls.includes('price') && !cls.includes('priceAndTotal');

        // Also check for class names that might indicate a price display.
        const isOtherTarget =
            cls.includes('sum') ||
            cls.includes('winner') ||
            cls.includes('value') || // Added 'value' as it might be used for prices
            cls.includes('amount');   // Added 'amount'

        return isPriceClass || isOtherTarget;
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
     *   - The totalSpan remains a sibling element and is untouched.
     */
    function processPriceAndTotalBlock(containerEl) {
        // Find the span that contains the price, excluding any sub-spans with "titleTotal" class.
        const priceSpan = containerEl.querySelector('span:not([class*="titleTotal"])');
        const totalSpan = containerEl.querySelector('span[class*="titleTotal"]'); // Get the total span if it exists.

        if (!priceSpan) return; // If no price span found, exit.

        const parsed = parseSinglePriceElement(priceSpan.textContent);
        if (!parsed) return; // If parsing fails, exit.

        const [tornFormatted, usdFormatted] = parsed; // tornFormatted is the formatted torn amount, usdFormatted is the formatted USD amount.

        let priceContentHtml = ''; // Store the HTML to inject into priceSpan.

        // Construct the inner HTML for the price span based on the display mode.
        switch (DISPLAY_MODE) {
            case 'converted':
                priceContentHtml = usdFormatted;
                break;
            case 'combined':
                priceContentHtml = `${usdFormatted} (${tornFormatted})`;
                break;
            case 'reversed':
                priceContentHtml = `${tornFormatted} (${usdFormatted})`;
                break;
            case 'full':
                priceContentHtml = `${usdFormatted} (${tornFormatted})`;
                break;
            case 'fullreversed':
            case 'reduced':
                priceContentHtml = `${tornFormatted} (${usdFormatted})`;
                break;
            case 'original':
                priceContentHtml = tornFormatted;
                break;
            default: // Fallback
                priceContentHtml = `${tornFormatted} (${usdFormatted})`;
        }

        // Apply the constructed HTML to the price span.
        priceSpan.innerHTML = priceContentHtml;

        // Add a data attribute to mark that this element has been processed.
        containerEl.dataset.usdConverted = '1';
        return;
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

        // Determine the output based on DISPLAY_MODE, using the already formatted torn/usd strings.
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
            case 'reduced':
                output = `${torn} (${usd})`;
                break;
            case 'original':
                output = torn;
                break;
            default: // Fallback
                output = `${torn} (${usd})`;
        }

        el.innerHTML = output; // Use innerHTML to allow for potential future tags like <br> if needed.
        el.dataset.usdConverted = '1'; // Mark as converted.
        return;
    }

    /**
     * Convert any Torn price patterns found inside a raw text node.
     * Skips nodes inside priceAndTotal blocks (those have their own handler)
     * and nodes that already contain conversion markers.
     */
    function processTextNode(node) {
        // Ensure it's a text node, has content, and is not within a 'priceAndTotal' block.
        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue ||
            isInsidePriceAndTotal(node.parentElement)
        ) return;

        // Skip if it already contains markers that indicate it's already converted or part of a converted block.
        if (node.nodeValue.includes('(§') || node.nodeValue.includes('($') || node.nodeValue.includes('data-usd-converted')) return;

        // Use convertPriceTextContent to process the text.
        // This function will replace any price patterns found within the text.
        const convertedText = convertPriceTextContent(node.nodeValue);

        // Only update the node if the text has actually changed.
        if (convertedText !== node.nodeValue) {
            node.nodeValue = convertedText;
        }
    }


    // ─────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────

    /**
     * Walk a DOM subtree and process all price elements and text nodes within it.
     * This is the core function that finds and converts prices.
     */
    function scanSubtree(rootNode) {
        if (!rootNode) return;

        // Process direct element matches first.
        // This queries for all elements matching PRICE_ELEMENT_SELECTOR within the rootNode.
        const priceNodes = rootNode.querySelectorAll?.(PRICE_ELEMENT_SELECTOR);
        if (priceNodes) {
            for (const el of priceNodes) {
                // If the element hasn't been converted yet, process it.
                if (el.dataset.usdConverted !== '1') {
                     processElement(el);
                }
            }
        }

        // Use a TreeWalker to efficiently iterate over all text nodes.
        const textWalker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_TEXT, // Only interested in text nodes
            null, // No specific filter function (user-provided filter would go here)
            false // Not an entity reference iterator
        );

        let currentNode;
        // Iterate through all text nodes found.
        while ((currentNode = textWalker.nextNode())) {
            // Process each text node for potential price conversions.
            processTextNode(currentNode);
        }
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────

    // Initial pass over the whole page body when the script loads.
    // This handles static content present on page load.
    scanSubtree(document.body);

    // Watch for dynamically added content. Torn.com uses Ajax heavily,
    // so new content (prices, etc.) is often added after the initial load.
    const mutationObserver = new MutationObserver((mutations) => {
        // For every mutation event, iterate through all added nodes.
        for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
                // If a text node was added, process it directly.
                if (addedNode.nodeType === Node.TEXT_NODE) {
                    processTextNode(addedNode);
                }
                // If an element node was added, scan its subtree for prices and text nodes.
                else if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    // Only scan the subtree if the element itself hasn't been converted yet.
                    // This is an optimization to avoid re-scanning already converted elements.
                    if (addedNode.dataset.usdConverted !== '1') {
                        scanSubtree(addedNode);
                    }
                }
            }
        }
    });

    // Configure the observer to watch for changes in the document body,
    // including additions/removals of child nodes and their descendants (subtree: true).
    mutationObserver.observe(document.body, {
        childList: true, // Watch for additions and removals of child nodes.
        subtree: true,   // Watch all descendants of the target.
    });

})();
