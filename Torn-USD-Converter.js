// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      2.3
// @description  Convert Torn cash displays to USD equivalents (multi-display modes)
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
    const DISPLAY_MODE = "full"; // Options:
    // "converted"  -> $5.00
    // "combined"   -> $5.00 (§23.50M)
    // "reversed"   -> §23.50M ($5.00)
    // "full"       -> $5.00 (§23,500,364)
    // "original"   -> §23.5m

    const USD_PER_TORN = 5 / 23500000;

    // "Full" toggle: when true, abbreviated Torn values (23.5M) expand to
    // their full numeric form (23,539,270) on click.
    let fullToggleEnabled = true;

    // =========================
    // FORMATTERS
    // =========================
    function formatUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;
        if (usd === 0) return '$0';
        if (usd <= 0.000001) return '$' + usd.toFixed(7);
        if (usd <= 0.0001) return '$' + usd.toFixed(6);
        if (usd <= 0.001) return '$' + usd.toFixed(5);
        if (usd >= 9999) return '$' + usd.toFixed(0);
        if (usd >= 1) return '$' + usd.toFixed(2);
        return '$' + usd.toFixed(3);
    }

    function formatTorn(tornAmount, full = false) {
        if (full) {
            return '§' + tornAmount.toLocaleString(undefined, {
                maximumFractionDigits: 20
            });
        }
        if (tornAmount >= 1e12) {
            return '§' + (tornAmount / 1e12).toFixed(2) + 'T';
        }
        if (tornAmount >= 1e9) {
            return '§' + (tornAmount / 1e9).toFixed(2) + 'B';
        }
        if (tornAmount >= 1e6) {
            return '§' + (tornAmount / 1e6).toFixed(2) + 'M';
        }
        if (tornAmount >= 1e3) {
            return '§' + (tornAmount / 1e3).toFixed(2) + 'K';
        }
        return '§' + Math.round(tornAmount).toLocaleString();
    }

    function parseAmount(value, suffix) {
        let amount = parseFloat(value.replace(/,/g, ''));
        if (isNaN(amount)) return NaN;
        switch ((suffix || '').toUpperCase()) {
            case 'K':
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
        return amount;
    }

    // =========================
    // DISPLAY LOGIC
    // =========================
    function getDisplayText(amount, originalMatch) {
        const usd = formatUSD(amount);
        const tornShort = formatTorn(amount);
        const tornFull = formatTorn(amount, true);

        switch (DISPLAY_MODE) {
            case 'converted':
                return usd;
            case 'combined':
                return `${usd} (${tornShort})`;
            case 'reversed':
                return `${tornShort} (${usd})`;
            case 'full':
                return `${usd} (${tornFull})`;
            case 'original':
                return originalMatch.replace('$', '§');
            default:
                return `${usd} (${tornShort})`;
        }
    }

    // =========================
    // FULL TOGGLE
    // =========================
    // When fullToggleEnabled is true, clicking a Torn value that uses an
    // abbreviated suffix (M/B/T/K) swaps it to the full number, and
    // clicking again swaps back.

    const expandedValues = new WeakMap();

    function isAbbreviated(tornStr) {
        // Matches §23.50M, §1.23B, §4.56T, §78.90K etc.
        return /[KMBT]$/.test(tornStr);
    }

    function handleToggleClick(e) {
        const span = e.currentTarget;
        const currentText = span.textContent;

        // Find the Torn portion in the display text
        // Patterns: "§23.50M" or "§23,500,364" inside parens or standalone
        const tornMatch = currentText.match(/§[\d,.]+[KMBT]?/);
        if (!tornMatch) return;

        const tornStr = tornMatch[0];

        if (expandedValues.get(span)) {
            // Already expanded — collapse back
            const collapsed = expandedValues.get(span).collapsedText;
            // Replace the full Torn value with the abbreviated one
            span.textContent = currentText.replace(tornMatch[0], collapsed);
            expandedValues.delete(span);
            span.style.cursor = 'pointer';
            span.title = 'Click to expand';
        } else {
            // Not expanded yet — check if it's abbreviated
            if (!isAbbreviated(tornStr)) return;

            // Parse the abbreviated value
            const suffix = tornStr.slice(-1);
            const numPart = tornStr.slice(1, -1); // strip § and suffix
            const amount = parseAmount(numPart, suffix);
            if (isNaN(amount)) return;

            const fullStr = formatTorn(amount, true);
            const newText = currentText.replace(tornMatch[0], fullStr);

            // Store both states
            expandedValues.set(span, {
                expandedText: newText,
                collapsedText: tornStr
            });

            span.textContent = newText;
            span.style.cursor = 'pointer';
            span.title = 'Click to collapse';
        }
    }

    function setupToggle(span, amount) {
        if (!fullToggleEnabled) return;

        const tornShort = formatTorn(amount);
        if (!isAbbreviated(tornShort)) return;

        span.style.cursor = 'pointer';
        span.title = 'Click to expand';
        span.addEventListener('click', handleToggleClick);
    }

    // =========================
    // DOM PROCESSING
    // =========================
    function buildReplacement(match, value, suffix) {
        const amount = parseAmount(value, suffix);
        const span = document.createElement('span');
        span.className = 'torn-usd-display';
        span.textContent = getDisplayText(amount, match);

        // Set up click-to-toggle for abbreviated Torn values
        setupToggle(span, amount);

        return span;
    }

    function processTextNode(node) {
        if (!node || !node.parentNode) return;

        // Skip if already inside a processed display
        const parent = node.parentNode;
        if (parent && parent.classList && parent.classList.contains('torn-usd-display')) return;

        const text = node.nodeValue;
        if (!text || !text.includes('$')) return;

        const regex = /\$([\d,.]+)\s*([kmbt])?/gi;

        // Test first to avoid unnecessary work
        if (!regex.test(text)) return;
        regex.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Skip matches that are already inside our spans
            // (check if this text node's content at this position is valid)
            if (match.index < lastIndex) continue;

            fragment.appendChild(
                document.createTextNode(
                    text.slice(lastIndex, match.index)
                )
            );
            fragment.appendChild(
                buildReplacement(
                    match[0],
                    match[1],
                    match[2]
                )
            );
            lastIndex = regex.lastIndex;
        }

        if (lastIndex === 0) return; // No matches found

        fragment.appendChild(
            document.createTextNode(
                text.slice(lastIndex)
            )
        );

        try {
            node.parentNode.replaceChild(fragment, node);
        } catch (e) {
            // Parent may have been removed from DOM already
        }
    }

    function scan(root) {
        if (!root) return;

        // If root is a text node, process it directly
        if (root.nodeType === Node.TEXT_NODE) {
            processTextNode(root);
            return;
        }

        // Skip scanning inside our own display elements
        if (root.classList && root.classList.contains('torn-usd-display')) return;

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Skip text nodes inside our display spans
                    if (node.parentNode &&
                        node.parentNode.classList &&
                        node.parentNode.classList.contains('torn-usd-display')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            nodes.push(node);
        }
        nodes.forEach(processTextNode);
    }

    // =========================
    // INIT
    // =========================
    if (document.body) {
        scan(document.body);
    }

    const observer = new MutationObserver(mutations => {
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
