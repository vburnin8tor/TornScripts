// ==UserScript==
// @name         Torn USD Converter *Claude
// @author       shaul [3908280]
// @version      3.1
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

    // Matches Torn currency patterns anywhere in text: $1,234, $5.6M, $2bil, $1 million, etc.
    // Captures just the numeric+suffix portion so surrounding text is never touched.
    const TORN_PRICE_REGEX = /\$([\d,.]+ ?)([kMBT]|mil|mill|bil|bill|million|billion|trillion)?(?!\w)/gi;

    // Regex to detect if text is already converted (contains § or USD format with parentheses)
    const ALREADY_CONVERTED_REGEX = /§|\$\d+\.\d{2}\s*\(/;

    // ─────────────────────────────────────────────
    // ELEMENTS TO SKIP ENTIRELY
    // ─────────────────────────────────────────────

    // Tags whose text content should never be scanned/rewritten
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);

    // Marker attribute used to avoid re-processing / re-matching our own output
    const CONVERTED_ATTR = 'data-usd-converted';

    // ─────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────

    function log(message, data) {
        if (!DEBUG) return;
        if (data !== undefined) {
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
        // Only used in combined/reversed/reduced/full display modes

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

    function buildReplacement(fullMatch, numericPart, suffix) {
        // Given a single "$X" match, return the replacement string per DISPLAY_MODE.
        // Returns null if the match couldn't be parsed (leave untouched).

        const tornAmount = parseTornAmount(numericPart, suffix);
        if (tornAmount == null) return null;

        const originalWithTornSymbol = fullMatch.replace('$', '§');
        const tornFormatted = formatAsTorn(tornAmount);
        const usdFormatted = formatAsUSD(tornAmount);

        log(`Converting: ${fullMatch} → Torn: ${tornFormatted}, USD: ${usdFormatted}`);

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
            case 'reduced':
                return `${tornFormatted} (<${usdFormatted === '$0' ? '$0.01' : usdFormatted}>)`;
            case 'original':
                return originalWithTornSymbol;
            default:
                return fullMatch;
        }
    }

    function convertPriceTextContent(text) {
        // Replace every Torn price pattern found in text, leaving all other
        // characters (labels, punctuation, whitespace) exactly where they are.

        return text.replace(TORN_PRICE_REGEX, (fullMatch, numericPart, suffix) => {
            const replacement = buildReplacement(fullMatch, numericPart, suffix);
            return replacement == null ? fullMatch : replacement;
        });
    }

    // ─────────────────────────────────────────────
    // TEXT NODE PROCESSING (primary strategy)
    // ─────────────────────────────────────────────

    function shouldSkipSubtree(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        if (SKIP_TAGS.has(el.tagName)) return true;
        if (el.isContentEditable) return true;
        return false;
    }

    function isAlreadyConverted(text) {
        // Check if text already contains converted output (§ symbol or USD format with parentheses)
        return ALREADY_CONVERTED_REGEX.test(text);
    }

    function processTextNode(node) {
        // Convert Torn price patterns found directly in a text node.
        // This is format-preserving by construction: only the characters of
        // the text node itself change, never surrounding markup or siblings.

        if (!node || node.nodeType !== Node.TEXT_NODE) return;

        const value = node.nodeValue;
        if (!value || value.indexOf('$') === -1) return;

        const parent = node.parentElement;
        if (shouldSkipSubtree(parent)) return;

        // Already-converted output looks like "$5.00 (...)" or contains "§";
        // skip so we don't re-match our own previous replacement.
        if (parent && parent.getAttribute(CONVERTED_ATTR) === '1') return;

        const converted = convertPriceTextContent(value);
        if (converted !== value) {
            node.nodeValue = converted;
            if (parent) parent.setAttribute(CONVERTED_ATTR, '1');
        }
    }

    // ─────────────────────────────────────────────
    // STRUCTURED SPECIAL CASE: Item Market priceAndTotal
    // ─────────────────────────────────────────────
    // This one block genuinely needs structural handling: Torn splits the
    // price and the item count into two separate sibling spans, and the
    // desired output combines text from both into one place. A pure
    // text-node walk can't merge two nodes, so this remains a targeted,
    // minimal DOM touch — everything else in the script is text-only.

    function processPriceAndTotalBlocks(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

        const blocks = root.matches?.('[class*="priceAndTotal"]')
            ? [root]
            : root.querySelectorAll?.('[class*="priceAndTotal"]') || [];

        for (const containerEl of blocks) {
            // Don't mark as converted - priceAndTotal elements update frequently
            if (containerEl.getAttribute(CONVERTED_ATTR) === '1') continue;

            const priceSpan = containerEl.querySelector(':scope > span:not([class*="titleTotal"])');
            const totalSpan = containerEl.querySelector(':scope > span[class*="titleTotal"]');
            if (!priceSpan) continue;

            const textContent = priceSpan.textContent;
            if (!textContent || textContent.indexOf('$') === -1) continue;

            // Skip if already converted (contains § or USD format)
            if (isAlreadyConverted(textContent)) continue;

            const match = textContent.match(/\$([\d,.]+)/);
            if (!match) continue;

            const tornAmount = parseTornAmount(match[1]);
            if (tornAmount === null) continue;

            const torn = formatAsTorn(tornAmount);
            const usd = formatAsUSD(tornAmount);
            const originalPrice = textContent;
            const total = totalSpan?.textContent || '';
            let output;

            log(`Processing priceAndTotal: ${originalPrice}`, { torn, usd, total });

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

            priceSpan.textContent = output;
            if (totalSpan && DISPLAY_MODE !== 'converted') {
                priceSpan.appendChild(document.createElement('br'));
                priceSpan.appendChild(totalSpan);
            } else if (totalSpan) {
                totalSpan.remove();
            }
        }
    }

    // ─────────────────────────────────────────────
    // STRUCTURED SPECIAL CASE: Poker pots
    // ─────────────────────────────────────────────
    // Poker tables update pot values frequently during gameplay. Any element
    // with 'pot' in its class name will contain a dollar value that needs
    // conversion. Unlike priceAndTotal, we don't mark these as converted
    // since they update in real-time.

    function processPokerPotBlocks(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

        const blocks = root.matches?.('[class*="pot"]')
            ? [root]
            : root.querySelectorAll?.('[class*="pot"]') || [];

        for (const containerEl of blocks) {
            // Don't mark as converted - poker pots update frequently
            if (containerEl.getAttribute(CONVERTED_ATTR) === '1') continue;

            // Find any child elements with dollar values
            const spans = containerEl.querySelectorAll('span, div, td, .pot, [class*="pot"]');
            if (!spans.length) {
                // Check the container itself if no child spans found
                if (containerEl.textContent && containerEl.textContent.indexOf('$') !== -1) {
                    spans = [containerEl];
                } else {
                    continue;
                }
            }

            for (const el of spans) {
                if (!el || el.nodeType !== Node.ELEMENT_NODE) continue;

                const textContent = el.textContent;
                if (!textContent || textContent.indexOf('$') === -1) continue;

                // Skip if already converted (contains § or USD format)
                if (isAlreadyConverted(textContent)) continue;

                const converted = convertPriceTextContent(textContent);
                if (converted !== textContent) {
                    el.textContent = converted;
                }
            }
        }
    }

    // ─────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────

    function scanSubtree(rootNode) {
        // Walk every text node under rootNode and convert prices in place.
        // No class/selector matching for generic prices — any "$..." pattern
        // in any text node, anywhere on the page, gets converted.

        if (!rootNode) return;
        if (rootNode.nodeType === Node.ELEMENT_NODE && shouldSkipSubtree(rootNode)) return;

        log('Scanning subtree', rootNode);

        // Structured special case first (Item Market), so its own text
        // doesn't also get caught and mangled by the generic text walk.
        processPriceAndTotalBlocks(rootNode);

        // Poker pots - also special handling needed
        processPokerPotBlocks(rootNode);

        if (rootNode.nodeType === Node.TEXT_NODE) {
            processTextNode(rootNode);
            return;
        }

        const textWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return shouldSkipSubtree(node.parentElement)
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT;
            },
        });

        let currentNode;
        while ((currentNode = textWalker.nextNode())) {
            processTextNode(currentNode);
        }
    }

    // ─────────────────────────────────────────────
    // INITIALIZATION & LIVE UPDATES
    // ─────────────────────────────────────────────
    //
    // Torn's prices update in two ways:
    //   1. New elements get added to the DOM (childList mutations)
    //   2. Existing text nodes get their value changed directly, e.g. a
    //      live auction/market tick (characterData mutations)
    // We watch both so conversions happen as fast as possible. Rapid bursts
    // of mutations (common on live pages) are coalesced into a single
    // animation-frame batch so we don't re-walk the tree once per mutation.

    log(`Torn USD Converter initialized (Mode: ${DISPLAY_MODE})`);

    scanSubtree(document.body);

    let pendingTextNodes = new Set();
    let pendingElements = new Set();
    let flushScheduled = false;

    function scheduleFlush() {
        if (flushScheduled) return;
        flushScheduled = true;
        requestAnimationFrame(flushPending);
    }

    function flushPending() {
        flushScheduled = false;

        for (const node of pendingTextNodes) {
            if (node.isConnected) processTextNode(node);
        }
        pendingTextNodes.clear();

        for (const el of pendingElements) {
            if (el.isConnected) scanSubtree(el);
        }
        pendingElements.clear();
    }

    const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                if (mutation.target.nodeType === Node.TEXT_NODE) {
                    pendingTextNodes.add(mutation.target);
                }
                continue;
            }

            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.TEXT_NODE) {
                    pendingTextNodes.add(addedNode);
                } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    pendingElements.add(addedNode);
                }
            }
        }

        if (pendingTextNodes.size || pendingElements.size) scheduleFlush();
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });
})();