// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.93
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// @license      MIT
// @namespace    https://greasyfork.org/users/559205
// @downloadURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.user.js
// @updateURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // ─────────────────────────────────────────────
    // CONFIG
    // ─────────────────────────────────────────────
    // Pick one display mode:
    //   "combined"     →  $5.00 (§23.5M)
    //   "reversed"     →  §23.5M ($5.00)
    //   "full"         →  $5.00 (§23,500,001)
    //   "fullreversed" →  §23,500,001 ($5.00)    ← default
    //   "original"     →  §23.5M

    const SETTINGS_STORAGE_KEY = 'tornUsdConverter.settings';

    // Currency symbol options. `symbol` is what gets prefixed/suffixed onto the
    // converted amount. NOTE: the underlying math is unchanged — everything is
    // still computed as a USD value (USD_PER_TORN below). Picking a non-USD
    // symbol here only changes the label shown, not the exchange rate used;
    // this script does not fetch live FX rates.
    const CURRENCY_OPTIONS = [
        { value: 'USD', symbol: '$', prefix: true, label: '$ — US Dollar' },
        { value: 'GBP', symbol: '£', prefix: true, label: '£ — British Pound' },
        { value: 'CAD', symbol: 'CA$', prefix: true, label: 'CA$ — Canadian Dollar' },
        { value: 'AUD', symbol: 'AU$', prefix: true, label: 'AU$ — Australian Dollar' },
        { value: 'EUR', symbol: '€', prefix: true, label: '€ — Euro' },
        { value: 'CZK', symbol: 'Kč', prefix: false, label: 'Kč — Czech Koruna' },
        { value: 'DKK', symbol: 'kr.', prefix: false, label: 'kr. — Danish Krone' },
        { value: 'HUF', symbol: 'Ft', prefix: false, label: 'Ft — Hungarian Forint' },
        { value: 'ILS', symbol: '₪', prefix: true, label: '₪ — Israeli Shekel' },
        { value: 'JPY', symbol: '¥', prefix: true, label: '¥ — Japanese Yen' },
        { value: 'PHP', symbol: '₱', prefix: true, label: '₱ — Philippine Peso' },
        { value: 'PLN', symbol: 'zł', prefix: false, label: 'zł — Polish Zloty' },
        { value: 'CHF', symbol: 'CHF', prefix: true, label: 'CHF — Swiss Franc' },
        { value: 'SEK', symbol: 'kr', prefix: false, label: 'kr — Swedish Krona' },
        { value: 'NOK', symbol: 'NKr', prefix: true, label: 'NKr — Norwegian Krone' },
        { value: 'HKD', symbol: 'HK$', prefix: true, label: 'HK$ — Hong Kong Dollar' },
        { value: 'SGD', symbol: 'S$', prefix: true, label: 'S$ — Singapore Dollar' },
        { value: 'MXN', symbol: 'MEX$', prefix: true, label: 'MEX$ — Mexican Peso' },
        { value: 'NZD', symbol: 'NZ$', prefix: true, label: 'NZ$ — New Zealand Dollar' },
        { value: 'THB', symbol: '฿', prefix: false, label: '฿ — Thai Baht' },
    ];

    // ─────────────────────────────────────────────
    // CONVERSION RATES
    // ─────────────────────────────────────────────
    // One slot per non-USD currency, expressed as "how many units of that
    // currency equal 1 USD" (i.e. multiply a USD amount by this number to
    // get that currency's amount — the standard "USD base" quoting convention,
    // e.g. if 1 USD = 0.92 EUR, set CONVERSION_RATES.EUR = 0.92).
    //
    // Left as `null` on purpose — fill in the numbers yourself. Until a given
    // currency's rate is filled in, that currency falls back to showing the
    // raw USD amount with its own symbol/placement (the previous behavior),
    // so nothing breaks or displays a wrong number in the meantime. USD has
    // no entry here since it's the base unit being converted FROM — there's
    // no separate rate to apply for it.
    const CONVERSION_RATES = {
        USD: 5/23500000,
        GBP: 3.73/23500000,
        CAD: 7.06/23500000,
        AUD: 7.20/23500000,
        EUR: 4.37/23500000,
        CZK: 106.18/23500000,
        DKK: 32.71/23500000,
        HUF: 1561/23500000,
        ILS: 15.12/23500000,
        JPY: 810/23500000,
        PHP: 307.89/23500000,
        PLN: 18.92/23500000,
        CHF: 4.05/23500000,
        SEK: 48.26/23500000,
        NOK: 48.84/23500000,
        HKD: 39.19/23500000,
        SGD: 6.46/23500000,
        MXN: 87.45/23500000,
        NZD: 8.65/23500000,
        THB: 166.92/23500000,
    };

    function getConversionRate(currencyValue) {
        /**
         * Returns the numeric rate for a currency code, or null if unset (or
         * if the currency is USD, which has no separate rate). A rate of 0,
         * a negative number, or a non-finite value (NaN, Infinity — e.g. from
         * a typo like an empty string or a stray comma) is treated the same
         * as unset, so a bad edit here fails safe into the old raw-USD
         * behavior rather than producing a silently wrong or broken price.
         */
        const rate = CONVERSION_RATES[currencyValue];
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
        return rate;
    }

    const DEFAULT_CURRENCY = 'USD';

    function getCurrencyOption(value) {
        return CURRENCY_OPTIONS.find((c) => c.value === value) || CURRENCY_OPTIONS[0];
    }

    const DEFAULT_SETTINGS = {
        displayMode: 'fullreversed',
        microcents: true,
        currency: DEFAULT_CURRENCY,
        primaryCurrency: DEFAULT_CURRENCY,
    };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) return {
                ...DEFAULT_SETTINGS
            };
            const parsed = JSON.parse(raw);
            let displayMode = typeof parsed.displayMode === 'string' ? parsed.displayMode : DEFAULT_SETTINGS.displayMode;
            if (displayMode === 'converted') displayMode = DEFAULT_SETTINGS.displayMode;
            const isValidCurrency = typeof parsed.currency === 'string' && CURRENCY_OPTIONS.some((c) => c.value === parsed.currency);
            const isValidPrimary = typeof parsed.primaryCurrency === 'string' && CURRENCY_OPTIONS.some((c) => c.value === parsed.primaryCurrency);
            return {
                displayMode,
                microcents: typeof parsed.microcents === 'boolean' ? parsed.microcents : DEFAULT_SETTINGS.microcents,
                currency: isValidCurrency ? parsed.currency : DEFAULT_SETTINGS.currency,
                primaryCurrency: isValidPrimary ? parsed.primaryCurrency : DEFAULT_SETTINGS.primaryCurrency,
            };
        } catch (e) {
            return {
                ...DEFAULT_SETTINGS
            };
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('[Torn USD Converter] Failed to save settings:', e);
        }
    }

    const settings = loadSettings();

    function getDisplayMode() {
        return settings.displayMode;
    }

    function getMicrocents() {
        return settings.microcents;
    }

    function getCurrency() {
        return getCurrencyOption(settings.currency);
    }

    function getPrimaryCurrency() {
        return getCurrencyOption(settings.primaryCurrency);
    }

    function alreadyConverted(text) {
        /**
         * True if `text` already contains a converted-price marker and should be
         * left alone. This must check against the CURRENTLY SELECTED currency's
         * symbol, not a hardcoded '$' — otherwise switching to e.g. '£' or 'Kč'
         * would make this check silently stop matching, and already-converted
         * text would get re-processed (and, for prefix currencies, re-wrapped in
         * another layer of parens each scan).
         *
         * Marker shape depends on symbol placement:
         *   - prefix currencies produce "($5.00" or "(£5.00" → check "(" + symbol
         *   - suffix currencies produce "5.00 zł)" or "5.00 Kč)" → check symbol + ")"
         * A bare "(" is NOT a safe marker for suffix currencies: ordinary
         * unconverted Torn text can contain parentheses for unrelated reasons
         * (e.g. "Bounty (expires in 2 days): $5,000,000"), which would cause
         * the script to skip converting perfectly normal, not-yet-converted text.
         *
         * Torn's own '§' symbol and the '≈'/'<' fallback markers are always
         * checked regardless of currency, since those never change.
         */
        const currency = getPrimaryCurrency();
        const conversionMarker = currency.prefix ? ('(' + currency.symbol) : (currency.symbol + ')');
        const approxMarker = currency.prefix ? ('≈' + currency.symbol + '0') : ('≈0 ' + currency.symbol);
        const underMarker = currency.prefix ? ('<' + currency.symbol + '0.01') : ('<0.01 ' + currency.symbol);
        return (
            text.includes(conversionMarker) ||
            text.includes('§') ||
            text.includes(approxMarker) ||
            text.includes(underMarker)
        );
    }

    const USD_PER_TORN = 5 / 23500000;

    const TORN_PRICE_REGEX =
        /\$([\d,.]+ ?)([kMBT]|mil|mill|bil|bill|million|billion|trillion)?(?!\w)/gi;

    const SINGLE_PRICE_REGEX_FULL =
        /\$([\d,.]+ ?)([kMBT]|mil|mill|bil|bill|million|billion|trillion)?(?!\w)/i;

    // ─────────────────────────────────────────────
    // PARSING
    // ─────────────────────────────────────────────


    function parseTornAmount(numericString, suffix) {
        /**
         * Expand torn values, cleaning separators & suffix
         * e.g. ("5.6", "M") → 5600000
         *      ("1", "million") → 1000000
         *      ("2", "billion") → 2000000000
         */
        let baseAmount = parseFloat(numericString.replace(/,/g, ''));
        if (Number.isNaN(baseAmount)) return null;

        const normalizedSuffix = (suffix || '').toLowerCase();

        const multipliers = {
            'k': 1e3,
            'm': 1e6,
            'mil': 1e6,
            'mill': 1e6,
            'million': 1e6,
            'b': 1e9,
            'bil': 1e9,
            'bill': 1e9,
            'billion': 1e9,
            't': 1e12,
            'trillion': 1e12,
        };
        return (baseAmount * (multipliers[normalizedSuffix] || 1));
    }


    function parseSinglePriceElement(elementText) {
        /**
         * Given a price-element's text (e.g. "$872,995"), return [tornFormatted, usdFormatted].
         * Returns null if no price is found.
         */
        const match = SINGLE_PRICE_REGEX_FULL.exec(elementText);
        if (!match) return null;

        const numericString = match[1];
        const suffix = match[2];

        const tornAmount = parseTornAmount(numericString, suffix);
        if (tornAmount === null) return null;

        return convertPriceValues(tornAmount);
    }

    function convertPriceValues(tornAmount) {
        /**
         * Return [tornFormatted, usdFormatted] for a raw torn amount.
         */
        return [formatAsTorn(tornAmount), formatAsUSD(tornAmount)];
    }

    function convertPriceTextContent(text) {
        /**
         * Replace all Torn price patterns in a plain text string
         * with the chosen display format.
         */
        return text.replace(TORN_PRICE_REGEX, (fullMatch, numericPart, suffix) => {
            const tornAmount = parseTornAmount(numericPart, suffix);
            if (tornAmount == null) return fullMatch;

            const originalWithTornSymbol = fullMatch.replace('$', '§');
            const tornFormatted = formatAsTorn(tornAmount);
            const usdFormatted = formatAsUSD(tornAmount);

            switch (getDisplayMode()) {
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
                    return 'No Mode Set!';
            }
        });
    }

    // ─────────────────────────────────────────────
    // FORMATTING
    // ─────────────────────────────────────────────

    function applyCurrencySymbol(numericPart) {
        /**
         * Attach the selected currency's symbol to a formatted number, in the
         * right position (prefix like "$5.00" vs suffix like "5.00 Kč").
         * numericPart should NOT include a sign like '<' or '≈' — callers
         * that need those prepend them to the result of this function.
         */
        const currency = getPrimaryCurrency();
        return currency.prefix ? (currency.symbol + numericPart) : (numericPart + ' ' + currency.symbol);
    }

    function formatAsUSD(tornAmount) {
        /**
         * Convert a Torn-dollar amount as a currency string (symbol depends on the
         * selected currency setting) with appropriate decimal places.
         *
         * NOTE ON THE NAME: this function is still named formatAsUSD for historical
         * reasons, but it no longer always returns a USD amount. usdValue is always
         * the real USD amount (Torn cash × USD_PER_TORN) — that math never changes.
         * convertedValue is what actually gets displayed: if the selected currency
         * has a rate filled in under CONVERSION_RATES, convertedValue is usdValue
         * multiplied by that rate (a true conversion). If no rate is set for the
         * selected currency (still null, or USD itself), convertedValue just equals
         * usdValue, so the display falls back to the original behavior — showing
         * the raw USD figure with that currency's own symbol/placement.
         *
         * All the threshold checks below (which pick how many decimal places to
         * show) run against convertedValue, not usdValue. This matters once real
         * rates are filled in: a currency with a very different scale than USD
         * (e.g. JPY, roughly 100+ per USD) needs its OWN precision bucket based on
         * its OWN converted number, not on what the equivalent USD figure would
         * have needed.
         */
        const usdValue = tornAmount * USD_PER_TORN;
        const rate = getConversionRate(settings.primaryCurrency);
        const convertedValue = rate !== null ? (usdValue * rate) : usdValue;

        if (tornAmount === 0 || convertedValue === 0) return applyCurrencySymbol('0');
        if (!getMicrocents()) {
            if (convertedValue < 0.01) return '<' + applyCurrencySymbol('0.01');
        }
        if (tornAmount < 1) return '≈' + applyCurrencySymbol('0');
        if (convertedValue <= 0.000001) return applyCurrencySymbol(convertedValue.toFixed(7));
        if (convertedValue <= 0.00001) return applyCurrencySymbol(convertedValue.toFixed(6));
        if (convertedValue <= 0.0001) return applyCurrencySymbol(convertedValue.toFixed(5));
        if (convertedValue >= 0.0200) return applyCurrencySymbol(convertedValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }));

        return applyCurrencySymbol(convertedValue.toFixed(4));
    }

    function formatAsTorn(tornAmount) {
        /**
         * Format a Torn-dollar amount using the § currency symbol with T/B/M/k suffixes (compression).
         * Only available for 'combined' / 'reversed' display modes
         */
        if (getDisplayMode() === 'combined' || getDisplayMode() === 'reversed') {
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
        }
        return '§' + tornAmount.toLocaleString();
    }

    // ─────────────────────────────────────────────
    // GUARDS
    // ─────────────────────────────────────────────

    function isInsidePriceAndTotal(el) {
        /**
         * True if this element (or any ancestor) is a priceAndTotal block. (Item Market)
         * Those are handled structurally by processPriceAndTotalBlock —
         * the text walker must not touch them or it will corrupt the output.
         */
        while (el) {
            if (el.classList && el.classList.contains('priceAndTotal')) return true;
            el = el.parentElement;
        }
        return false;
    }

    function isInsideSettingsUi(el) {
        while (el) {
            if (el.id === 'tuc-settings-toggle' || el.id === 'tuc-settings-overlay' || el.id === 'tuc-settings-style') return true;
            el = el.parentElement;
        }
        return false;
    }

    function isInsideEditableRegion(el) {
        /**
                * True if this element (or any ancestor) is something the user can type into:
                * a real <input>/<textarea>, or a contenteditable region (chat boxes, rich-text
                * editors, etc). We must never rewrite text nodes inside these — reassigning
                * nodeValue while the caret sits inside the node resets the caret to position 0,
                * which is what causes typed characters to land in reverse order.
                *
                * Note: <input>/<textarea> content isn't reachable via DOM text nodes anyway
                * (their value lives in the .value property, not as child text nodes), so this
                * mainly matters for contenteditable elements. It's included for completeness
                * and in case el itself is the input/textarea (e.g. passed from a focus check).
                */
                while (el) {
            if (el.nodeType === Node.ELEMENT_NODE) {
                const tag = el.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
                if (el.isContentEditable) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    function isGenericPriceElement(el) {
        if (el.tagName !== 'DIV' && el.tagName !== 'SPAN') return false;

        const cls = el.className || '';

        const isPrice =
            cls.includes('price') &&
            !cls.includes('priceAndTotal');

        const isOtherTarget =
            cls.includes('sum') ||
            cls.includes('winner') ||
            cls.includes('grandTotal');

        return isPrice || isOtherTarget;
    }

    function isPriceAndTotalElement(el) {
        /**
         * True if this element is a structured priceAndTotal block (Item Market).
         */
        return el.tagName === 'DIV' && el.className && el.className.includes('priceAndTotal');
    }

    // ─────────────────────────────────────────────
    // DOM PROCESSING
    // ─────────────────────────────────────────────

    function processPriceAndTotalBlock(containerEl) {
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
         *     <span>§872,995<br>($0.19)</span>
         *     <span class="titleTotal">(13,456)</span>
         *   </div>
         *
         */
        const priceSpan = containerEl.querySelector('[class*="priceAndTotal"] > span:not([class*="titleTotal"])');
        const totalSpan = containerEl.querySelector('[class*="priceAndTotal"] > span[class*="titleTotal"]');

        if (!priceSpan) return;

        const parsed = parseSinglePriceElement(priceSpan.textContent);
        if (!parsed) return;

        const [torn, usd] = parsed;
        const originalPrice = priceSpan.textContent;
        const total = totalSpan ? totalSpan.textContent : '';
        let stack = [];

        switch (getDisplayMode()) {
            case 'combined':
                stack = [`${usd} (${torn})`];
                break;
            case 'reversed':
                stack = [`${torn} (${usd})`];
                break;
            case 'full':
                stack = [`${usd} (${originalPrice})`];
                break;
            case 'fullreversed':
                stack = [`${originalPrice} (${usd})`];
                break;
            case 'original':
                stack = [`${originalPrice}`];
                break;
            default:
                stack = [`${originalPrice} (${usd})`];
        }

        // Rebuild ONLY the price span; totalSpan stays untouched.
        priceSpan.innerHTML = stack.join('<br>');

        if (totalSpan && (totalSpan.textContent ?? '')) {
            priceSpan.appendChild(document.createElement('br'));
            priceSpan.appendChild(totalSpan);
        }

        containerEl.dataset.usdConverted = '1';
        return;
    }

    function processGenericPriceElement(el) {
        /**
         * Handle a generic price element like:
         *   <div class="price">$872,995</div>
         */
        const parsed = parseSinglePriceElement(el.textContent);
        if (!parsed) return;

        const [torn, usd] = parsed;
        let output;

        switch (getDisplayMode()) {
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

    function processElement(el) {

        if (!el || el.dataset.usdConverted === '1') return;
        if (isInsideSettingsUi(el)) return;
        if (isInsideEditableRegion(el)) return;
        if (alreadyConverted(el.textContent)) return;

        if (isPriceAndTotalElement(el)) {
            processPriceAndTotalBlock(el);
        } else if (isGenericPriceElement(el)) {
            processGenericPriceElement(el);
        } else {
            const text = el.textContent;
            if (!text || !text.includes('$')) return;
            if (alreadyConverted(text)) return;

            el.textContent = convertPriceTextContent(text);
            el.dataset.usdConverted = '1';
        }
    }

    function processTextNode(node) {
        /**
         * Convert any Torn price patterns found inside a raw text node.
         * Skips nodes inside priceAndTotal blocks (those have their own handler)
         * and nodes that already contain conversion markers.
         */
        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue ||
            isInsidePriceAndTotal(node.parentElement) ||
            isInsideSettingsUi(node.parentElement) ||
            isInsideEditableRegion(node.parentElement)
        ) return;

        if (alreadyConverted(node.nodeValue)) return;

        node.nodeValue = convertPriceTextContent(node.nodeValue);
    }

    // ─────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────

    function scanSubtree(rootNode) {
        /**
         * Walk a DOM subtree and process all price elements and text nodes within it.
         */
        // Never scan into the script's own settings UI — see isInsideSettingsUi.
        if (rootNode.nodeType === Node.ELEMENT_NODE && isInsideSettingsUi(rootNode)) return;
        // Never scan into something the user is actively typing into — see isInsideEditableRegion.
        if (rootNode.nodeType === Node.ELEMENT_NODE && isInsideEditableRegion(rootNode)) return;

        const priceNodes = rootNode.querySelectorAll(PRICE_ELEMENT_SELECTOR);
        for (const el of priceNodes) {
            if (isInsideSettingsUi(el)) continue;
            processElement(el);
        }

        const textWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);

        let currentNode;
        while ((currentNode = textWalker.nextNode())) {
            processTextNode(currentNode);
        }
    }

    // CSS selector for structured price blocks and generic price divs.
    const PRICE_ELEMENT_SELECTOR =
        'span[class*="displayPrice"], span[class*="price"], div[class*="price"], div[class*="priceAndTotal"], p[class*="up"], p[class*="down"], p[class*="pause"], span[class*="sum"], span[class*="grandTotal"], span[class*="infoLine"], p[class*="pot"]';

    // ─────────────────────────────────────────────
    // SETTINGS MODAL
    // ─────────────────────────────────────────────
    // Only shown on the stocks page and the bank page. A page reload is
    // required for changes to fully apply, because already-converted
    // elements/text nodes have had their original "$..." text replaced
    // in place — there's nothing left to re-parse without a fresh DOM
    // from the server. This keeps the logic simple and avoids corrupting
    // already-converted output on a live re-render attempt.

    const SETTINGS_PAGES = [
        'https://www.torn.com/page.php?sid=stocks',
        'https://www.torn.com/bank.php',
    ];

    function isSettingsPage() {
        const href = window.location.href;
        return SETTINGS_PAGES.some((pageUrl) => href.indexOf(pageUrl) === 0);
    }

    const DISPLAY_MODE_OPTIONS = [{
            value: 'combined',
            label: 'Combined — $5.00 (§23.5M)'
        },
        {
            value: 'reversed',
            label: 'Reversed — §23.5M ($5.00)'
        },
        {
            value: 'full',
            label: 'Full — $5.00 (§23,500,001)'
        },
        {
            value: 'fullreversed',
            label: 'Full reversed — §23,500,001 ($5.00)'
        },
        {
            value: 'original',
            label: 'Original — §23.5M'
        },
    ];

    function injectSettingsStyles() {
        if (document.getElementById('tuc-settings-style')) return;
        const style = document.createElement('style');
        style.id = 'tuc-settings-style';
        style.textContent = `
            #tuc-settings-toggle {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: #2c2c2c;
                color: #fff;
                border: 1px solid #555;
                font-size: 13px;
                line-height: 1;
                padding: 2px;
                overflow: hidden;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #tuc-settings-toggle:hover { background: #3a3a3a; }
            #tuc-settings-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.5);
                z-index: 999998;
                display: none;
                align-items: center;
                justify-content: center;
            }
            #tuc-settings-overlay.tuc-open { display: flex; }
            #tuc-settings-modal {
                background: #1e1e1e;
                color: #eee;
                width: 320px;
                max-width: 90vw;
                border-radius: 8px;
                padding: 20px;
                font-family: Arial, sans-serif;
                font-size: 13px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.6);
            }
            #tuc-settings-modal h3 {
                margin: 0 0 14px 0;
                font-size: 15px;
                color: #fff;
            }
            #tuc-settings-modal label {
                display: block;
                margin-bottom: 6px;
                color: #ccc;
            }
            #tuc-settings-modal select {
                width: 100%;
                padding: 6px;
                margin-bottom: 14px;
                background: #2c2c2c;
                color: #eee;
                border: 1px solid #555;
                border-radius: 4px;
            }
            #tuc-settings-modal .tuc-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            }
            #tuc-settings-modal .tuc-note {
                font-size: 11px;
                color: #999;
                margin-bottom: 14px;
                line-height: 1.4;
            }
            #tuc-settings-modal .tuc-buttons {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            #tuc-settings-modal button.tuc-btn {
                padding: 7px 14px;
                border-radius: 4px;
                border: 1px solid #555;
                background: #2c2c2c;
                color: #eee;
                cursor: pointer;
                font-size: 13px;
            }
            #tuc-settings-modal button.tuc-btn:hover { background: #3a3a3a; }
            #tuc-settings-modal button.tuc-btn-primary {
                background: #3b7dd8;
                border-color: #3b7dd8;
            }
            #tuc-settings-modal button.tuc-btn-primary:hover { background: #4a8ae0; }
        `;
        document.head.appendChild(style);
    }

    function buildSettingsModal() {
        injectSettingsStyles();

        const overlay = document.createElement('div');
        overlay.id = 'tuc-settings-overlay';

        const modal = document.createElement('div');
        modal.id = 'tuc-settings-modal';

        const heading = document.createElement('h3');
        heading.textContent = 'Torn USD Converter Settings';
        modal.appendChild(heading);

        // Display mode select
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Display mode';
        modal.appendChild(modeLabel);

        const modeSelect = document.createElement('select');
        for (const opt of DISPLAY_MODE_OPTIONS) {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            if (opt.value === settings.displayMode) optionEl.selected = true;
            modeSelect.appendChild(optionEl);
        }
        modal.appendChild(modeSelect);

        // Primary currency select
        const primaryLabel = document.createElement('label');
        primaryLabel.textContent = 'Primary Currency';
        modal.appendChild(primaryLabel);

        const primarySelect = document.createElement('select');
        for (const opt of CURRENCY_OPTIONS) {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            if (opt.value === settings.primaryCurrency) optionEl.selected = true;
            primarySelect.appendChild(optionEl);
        }
        modal.appendChild(primarySelect);

        // Microcents toggle
        const row = document.createElement('div');
        row.className = 'tuc-row';

        const toggleLabel = document.createElement('label');
        toggleLabel.textContent = 'Show microcents for small amounts';
        toggleLabel.style.marginBottom = '0';
        toggleLabel.style.flex = '1';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = settings.microcents;

        row.appendChild(toggleLabel);
        row.appendChild(toggleInput);
        modal.appendChild(row);

        // Note about currency
        const currencyNote = document.createElement('div');
        currencyNote.className = 'tuc-note';
        currencyNote.textContent = 'This changes the symbol shown, not the exchange rate — amounts are still the USD value, just labeled with a different currency\'s symbol.';
        modal.appendChild(currencyNote);

        // Note about reload
        const note = document.createElement('div');
        note.className = 'tuc-note';
        note.textContent = 'Changes apply after the page reloads, since already-converted prices on this page can\'t be re-parsed in place.';
        modal.appendChild(note);

        const buttons = document.createElement('div');
        buttons.className = 'tuc-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'tuc-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => closeSettingsModal(overlay));

        const saveBtn = document.createElement('button');
        saveBtn.className = 'tuc-btn tuc-btn-primary';
        saveBtn.textContent = 'Save & Reload';
        saveBtn.addEventListener('click', () => {
            settings.displayMode = modeSelect.value;
            settings.microcents = toggleInput.checked;
            settings.primaryCurrency = primarySelect.value;
            // Keep currency field for backward compatibility
            settings.currency = settings.primaryCurrency;
            saveSettings(settings);
            window.location.reload();
        });

        buttons.appendChild(cancelBtn);
        buttons.appendChild(saveBtn);
        modal.appendChild(buttons);

        overlay.appendChild(modal);

        // Clicking the dark backdrop (not the modal itself) closes it.
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSettingsModal(overlay);
        });

        return overlay;
    }

    function closeSettingsModal(overlay) {
        overlay.classList.remove('tuc-open');
    }

    function initSettingsModal() {
        if (!isSettingsPage()) return;
        if (document.getElementById('tuc-settings-toggle')) return; // already injected

        const overlay = buildSettingsModal();
        document.body.appendChild(overlay);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'tuc-settings-toggle';
        toggleBtn.title = 'Torn USD Converter settings';
        toggleBtn.textContent = getPrimaryCurrency().symbol;
        toggleBtn.addEventListener('click', () => {
            overlay.classList.add('tuc-open');
        });

        document.body.appendChild(toggleBtn);

        // Also close on Escape.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSettingsModal(overlay);
        });
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────

    let initialScanDone = false;

    const mutationObserver = new MutationObserver((mutations) => {
        scanSubtree(document.body);
        for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.TEXT_NODE) {
                    if (isInsideSettingsUi(addedNode.parentElement)) continue;
                    processTextNode(addedNode);
                } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    if (isInsideSettingsUi(addedNode)) continue;
                    scanSubtree(addedNode);
                }
            }
        }
    });

    function init() {
        if (initialScanDone) return;
        initialScanDone = true;
        scanSubtree(document.body);
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
        initSettingsModal();
    }

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            if (isSettingsPage()) {
                initSettingsModal();
            } else {
                const existingBtn = document.getElementById('tuc-settings-toggle');
                const existingOverlay = document.getElementById('tuc-settings-overlay');
                if (existingBtn) existingBtn.remove();
                if (existingOverlay) existingOverlay.remove();
            }
        }
    }, 1000);

})();