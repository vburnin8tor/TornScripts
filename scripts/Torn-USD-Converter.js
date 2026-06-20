// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.9.0
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @license MIT
// @namespace https://greasyfork.org/users/559205
// ==/UserScript==

(function () {
    'use strict';

    // =========================
    // CONFIG
    // =========================

    const STORAGE_KEY_SYMBOL = 'torn_usd_currency_symbol';
    const STORAGE_KEY_MODE   = 'torn_usd_display_mode';

    // Default display mode
    const DEFAULT_MODE = 'fullreversed';

    // Global currency list: [symbol, label]
    const CURRENCY_LIST = [
        ['$',  'USD — US Dollar'],
        ['€',  'EUR — Euro'],
        ['£',  'GBP — British Pound'],
        ['¥',  'JPY — Japanese Yen'],
        ['₩',  'KRW — South Korean Won'],
        ['₽',  'RUB — Russian Ruble'],
        ['₹',  'INR — Indian Rupee'],
        ['R$', 'BRL — Brazilian Real'],
        ['C$', 'CAD — Canadian Dollar'],
        ['A$', 'AUD — Australian Dollar'],
        ['CHF','CHF — Swiss Franc'],
        ['kr', 'SEK — Swedish Krona'],
        ['zł', 'PLN — Polish Zloty'],
        ['₺',  'TRY — Turkish Lira'],
        ['₴',  'UAH — Ukrainian Hryvnia'],
        ['NZ$','NZD — New Zealand Dollar'],
        ['S$', 'SGD — Singapore Dollar'],
        ['HK$','HKD — Hong Kong Dollar'],
        ['NOK','NOK — Norwegian Krone'],
        ['MX$','MXN — Mexican Peso'],
    ];

    const DISPLAY_MODES = [
        { value: 'converted',    label: 'Converted only',       desc: '$5.00' },
        { value: 'combined',     label: 'Combined',             desc: '$5.00 (§23.5M)' },
        { value: 'reversed',     label: 'Reversed',             desc: '§23.5M ($5.00)' },
        { value: 'full',         label: 'Full',                 desc: '$5.00 (§23,500,001)' },
        { value: 'fullreversed', label: 'Full reversed',        desc: '§23,500,001 ($5.00)' },
        { value: 'original',     label: 'Original (no USD)',    desc: '§23.5M' },
    ];

    // Read saved settings
    function getSavedMode() {
        return GM_getValue(STORAGE_KEY_MODE, DEFAULT_MODE);
    }
    function getSavedSymbol() {
        return GM_getValue(STORAGE_KEY_SYMBOL, '$');
    }

    let DISPLAY_MODE = getSavedMode();
    let CURRENCY_SYMBOL = getSavedSymbol();

    const USD_PER_TORN = 5 / 23500000;

    const PRICE_REGEX = /\$([\d,.]+)([kMBT]|mil|bil| mil| bil)?(?!\w)/g;
    const SIMPLE_PRICE_REGEX = /\$([\d,.]+)/;

    const PRICE_SELECTOR =
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"]';

    // =========================
    // FORMATTING
    // =========================

    function formatUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;

        if (usd === 0) return CURRENCY_SYMBOL + '0';
        if (usd <= 0.000001) return CURRENCY_SYMBOL + usd.toFixed(7);
        if (usd <= 0.00001) return CURRENCY_SYMBOL + usd.toFixed(6);
        if (usd <= 0.0001) return CURRENCY_SYMBOL + usd.toFixed(5);
        if (usd >= 9999) return CURRENCY_SYMBOL + usd.toFixed(0);
        if (usd >= 0.02) return CURRENCY_SYMBOL + usd.toFixed(2);

        return CURRENCY_SYMBOL + usd.toFixed(4);
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
            case 'mil':
            case 'M':
            case 'm': amount *= 1e6; break;
            case 'bil':
            case 'B':
            case 'b': amount *= 1e9; break;
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

    function convertText(text) {
        return text.replace(PRICE_REGEX, (match, value, suffix) => {
            const amount = parseTornAmount(value, suffix);
            if (amount == null) return match;

            switch (DISPLAY_MODE) {
                case 'converted':
                    return formatUSD(amount);

                case 'combined':
                    return `${formatUSD(amount)} (${formatTorn(amount)}) `;

                case 'reversed':
                    return `${formatTorn(amount)} (${formatUSD(amount)}) `;

                case 'full':
                    return `${formatUSD(amount)} (${match.replace('$', '§')}) `;

                case 'fullreversed':
                    return `${match.replace('$', '§')} (${formatUSD(amount)}) `;

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
    // DOM PROCESSING
    // =========================

    function processElement(el) {
    if (!el || el.dataset.usdConverted === '1') return;

    // =========================
    // STRUCTURED PRICE BLOCK
    // =========================
    if (isPriceAndTotalElement(el)) {
        const priceSpan = el.querySelector('priceAndTotal');
        const totalSpan = el.querySelector('span:titleTotal');

        if (!priceSpan) return;

        const converted = convertSinglePrice(priceSpan.textContent);
        if (!converted) return;

        const torn = converted[0];
        const usd = converted[1];
        const price = priceSpan.textContent;
        const total = totalSpan.textContent;
        let stack = [];

        switch (DISPLAY_MODE) {

            case 'converted':
                stack = [`${usd} (${total})`];
                break;

            case 'combined':
                stack = [`${usd} (${torn}) (${total})` ];
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

        // rebuild ONLY price span
        priceSpan.innerHTML = stack.join('<br>');

        el.dataset.usdConverted = '1';
        return;
    }

    // =========================
    // NORMAL PRICE BLOCK
    // =========================
    if (isPriceElement(el)) {
        const converted = convertSinglePrice(el.textContent);
        if (!converted) return;

        const torn = converted[0];
        const usd = converted[1];

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
        return;
    }

    // =========================
    // FALLBACK TEXT
    // =========================
    const text = el.textContent;
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
            const priceNodes = root.querySelectorAll?.(PRICE_SELECTOR);
            if (priceNodes) {
                for (const el of priceNodes) {
                    processElement(el);
                }
            }
        }

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while ((node = walker.nextNode())) {
            processTextNode(node);
        }
    }

    // =========================
    // SETTINGS PANEL
    // =========================

    // Check if we're on a page where the settings panel should appear
    function isCurrencyPage() {
        const path = window.location.pathname + window.location.hash;
        return path.includes('bank') || path.includes('stockmarket');
    }

    // Generate preview text for a given mode using example amounts
    function generatePreview(mode, symbol) {
        // Example Torn amounts to preview
        const examples = [
            { torn: 23500000,  label: '23.5M' },
            { torn: 500000000, label: '500M' },
            { torn: 1500,      label: '1.5K' },
        ];

        function fmtUSD(amount) {
            const usd = amount * USD_PER_TORN;
            if (usd === 0) return symbol + '0';
            if (usd <= 0.000001) return symbol + usd.toFixed(7);
            if (usd <= 0.00001) return symbol + usd.toFixed(6);
            if (usd <= 0.0001) return symbol + usd.toFixed(5);
            if (usd >= 9999) return symbol + usd.toFixed(0);
            if (usd >= 0.02) return symbol + usd.toFixed(2);
            return symbol + usd.toFixed(4);
        }

        function fmtTorn(amount) {
            if (amount >= 1e12) return '§' + (amount / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
            if (amount >= 1e9)  return '§' + (amount / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
            if (amount >= 1e6)  return '§' + (amount / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
            if (amount >= 94000) return '§' + (amount / 1e3).toFixed(1) + 'k';
            return '§' + amount.toLocaleString();
        }

        return examples.map(ex => {
            const usd = fmtUSD(ex.torn);
            const torn = fmtTorn(ex.torn);
            const raw = '§' + ex.torn.toLocaleString();

            switch (mode) {
                case 'converted':    return usd;
                case 'combined':     return `${usd} (${torn})`;
                case 'reversed':     return `${torn} (${usd})`;
                case 'full':         return `${usd} (${raw})`;
                case 'fullreversed': return `${raw} (${usd})`;
                case 'original':     return torn;
                default:             return `${torn} (${usd})`;
            }
        });
    }

    function buildSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'usd-converter-settings';
        panel.setAttribute('data-usd-settings-panel', '1');

        // --- Styles ---
        const style = document.createElement('style');
        style.textContent = `
            #usd-converter-settings {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 0;
                margin: 10px 0;
                color: #ccc;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12px;
                line-height: 1.5;
                position: relative;
                z-index: 100;
            }
            #usd-converter-settings .usd-cfg-header {
                background: #222;
                border-bottom: 1px solid #333;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                user-select: none;
            }
            #usd-converter-settings .usd-cfg-header:hover {
                background: #2a2a2a;
            }
            #usd-converter-settings .usd-cfg-title {
                color: #8dc63f;
                font-weight: bold;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            #usd-converter-settings .usd-cfg-toggle {
                color: #8dc63f;
                font-size: 16px;
                font-weight: bold;
                transition: transform 0.2s;
            }
            #usd-converter-settings .usd-cfg-toggle.usd-cfg-collapsed {
                transform: rotate(-90deg);
            }
            #usd-converter-settings .usd-cfg-body {
                padding: 10px 12px;
                overflow: hidden;
                transition: max-height 0.25s ease, padding 0.25s ease;
            }
            #usd-converter-settings .usd-cfg-body.usd-cfg-hidden {
                max-height: 0 !important;
                padding: 0 12px;
            }
            #usd-converter-settings hr {
                border: none;
                border-top: 1px solid #333;
                margin: 8px 0;
            }
            #usd-converter-settings .usd-cfg-section-title {
                color: #999;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 6px;
            }
            #usd-converter-settings .usd-cfg-field {
                margin-bottom: 10px;
            }
            #usd-converter-settings .usd-cfg-field label {
                display: block;
                color: #aaa;
                font-size: 11px;
                margin-bottom: 3px;
            }
            #usd-converter-settings .usd-cfg-select {
                background: #222;
                color: #ccc;
                border: 1px solid #444;
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 12px;
                width: 100%;
                max-width: 280px;
                outline: none;
                appearance: auto;
            }
            #usd-converter-settings .usd-cfg-select:focus {
                border-color: #8dc63f;
            }
            #usd-converter-settings .usd-cfg-radio-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            #usd-converter-settings .usd-cfg-radio-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 3px 6px;
                border-radius: 3px;
                cursor: pointer;
                transition: background 0.15s;
            }
            #usd-converter-settings .usd-cfg-radio-item:hover {
                background: #252525;
            }
            #usd-converter-settings .usd-cfg-radio-item input[type="radio"] {
                accent-color: #8dc63f;
                margin: 0;
            }
            #usd-converter-settings .usd-cfg-radio-label {
                color: #ccc;
                font-size: 12px;
            }
            #usd-converter-settings .usd-cfg-radio-desc {
                color: #666;
                font-size: 11px;
                margin-left: 4px;
            }
            #usd-converter-settings .usd-cfg-preview {
                background: #111;
                border: 1px solid #333;
                border-radius: 3px;
                padding: 8px 10px;
                margin-top: 4px;
            }
            #usd-converter-settings .usd-cfg-preview-title {
                color: #666;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 6px;
            }
            #usd-converter-settings .usd-cfg-preview-row {
                color: #aaa;
                font-size: 12px;
                padding: 2px 0;
                font-family: 'Courier New', Courier, monospace;
            }
            #usd-converter-settings .usd-cfg-preview-row .usd-cfg-preview-arrow {
                color: #555;
                margin: 0 6px;
            }
            #usd-converter-settings .usd-cfg-save-btn {
                background: #8dc63f;
                color: #1a1a1a;
                border: none;
                border-radius: 3px;
                padding: 5px 16px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                margin-top: 4px;
                transition: background 0.15s;
            }
            #usd-converter-settings .usd-cfg-save-btn:hover {
                background: #a8e05f;
            }
            #usd-converter-settings .usd-cfg-saved-toast {
                color: #8dc63f;
                font-size: 11px;
                margin-left: 8px;
                opacity: 0;
                transition: opacity 0.3s;
            }
            #usd-converter-settings .usd-cfg-saved-toast.usd-cfg-show {
                opacity: 1;
            }
        `;
        panel.appendChild(style);

        // --- Header (collapsible) ---
        const header = document.createElement('div');
        header.className = 'usd-cfg-header';
        header.innerHTML = `
            <span class="usd-cfg-title">
                <span style="color:#8dc63f">§</span> USD Converter Settings
            </span>
            <span class="usd-cfg-toggle" id="usd-cfg-toggle-icon">▼</span>
        `;

        const body = document.createElement('div');
        body.className = 'usd-cfg-body';
        body.id = 'usd-cfg-body';

        let collapsed = false;
        header.addEventListener('click', () => {
            collapsed = !collapsed;
            const toggle = header.querySelector('#usd-cfg-toggle-icon');
            if (collapsed) {
                body.classList.add('usd-cfg-hidden');
                toggle.classList.add('usd-cfg-collapsed');
            } else {
                body.classList.remove('usd-cfg-hidden');
                toggle.classList.remove('usd-cfg-collapsed');
            }
        });

        // --- Currency Symbol Section ---
        const symbolSection = document.createElement('div');
        symbolSection.innerHTML = `<div class="usd-cfg-section-title">Currency Symbol</div>`;

        const symbolField = document.createElement('div');
        symbolField.className = 'usd-cfg-field';

        const symbolLabel = document.createElement('label');
        symbolLabel.textContent = 'Replace $ with:';
        symbolLabel.htmlFor = 'usd-cfg-symbol-select';

        const symbolSelect = document.createElement('select');
        symbolSelect.className = 'usd-cfg-select';
        symbolSelect.id = 'usd-cfg-symbol-select';

        for (const [sym, label] of CURRENCY_LIST) {
            const opt = document.createElement('option');
            opt.value = sym;
            opt.textContent = `${sym} — ${label}`;
            if (sym === CURRENCY_SYMBOL) opt.selected = true;
            symbolSelect.appendChild(opt);
        }

        symbolField.appendChild(symbolLabel);
        symbolField.appendChild(symbolSelect);
        symbolSection.appendChild(symbolField);

        // --- Display Mode Section ---
        const modeSection = document.createElement('div');
        modeSection.innerHTML = `<hr><div class="usd-cfg-section-title">Display Mode</div>`;

        const modeField = document.createElement('div');
        modeField.className = 'usd-cfg-field';

        const radioGroup = document.createElement('div');
        radioGroup.className = 'usd-cfg-radio-group';

        const modeRadios = [];
        for (const mode of DISPLAY_MODES) {
            const item = document.createElement('label');
            item.className = 'usd-cfg-radio-item';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'usd-display-mode';
            radio.value = mode.value;
            if (mode.value === DISPLAY_MODE) radio.checked = true;
            modeRadios.push(radio);

            const labelSpan = document.createElement('span');
            labelSpan.className = 'usd-cfg-radio-label';
            labelSpan.textContent = mode.label;

            const descSpan = document.createElement('span');
            descSpan.className = 'usd-cfg-radio-desc';
            descSpan.textContent = mode.desc;

            item.appendChild(radio);
            item.appendChild(labelSpan);
            item.appendChild(descSpan);
            radioGroup.appendChild(item);
        }

        modeField.appendChild(radioGroup);
        modeSection.appendChild(modeField);

        // --- Preview Box ---
        const previewSection = document.createElement('div');
        previewSection.innerHTML = `<hr><div class="usd-cfg-section-title">Preview</div>`;

        const previewBox = document.createElement('div');
        previewBox.className = 'usd-cfg-preview';
        previewBox.id = 'usd-cfg-preview-box';

        function updatePreview() {
            const selectedMode = modeRadios.find(r => r.checked)?.value || DISPLAY_MODE;
            const selectedSymbol = symbolSelect.value;
            const previews = generatePreview(selectedMode, selectedSymbol);
            previewBox.innerHTML = `
                <div class="usd-cfg-preview-title">Example output</div>
                <div class="usd-cfg-preview-row">§23,500,001 <span class="usd-cfg-preview-arrow">→</span> ${previews[0]}</div>
                <div class="usd-cfg-preview-row">§500,000,000 <span class="usd-cfg-preview-arrow">→</span> ${previews[1]}</div>
                <div class="usd-cfg-preview-row">§1,500 <span class="usd-cfg-preview-arrow">→</span> ${previews[2]}</div>
            `;
        }

        // Live-update preview on any change
        symbolSelect.addEventListener('change', updatePreview);
        for (const radio of modeRadios) {
            radio.addEventListener('change', updatePreview);
        }

        updatePreview();
        previewSection.appendChild(previewBox);

        // --- Save Button ---
        const saveSection = document.createElement('div');
        saveSection.style.marginTop = '10px';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'usd-cfg-save-btn';
        saveBtn.textContent = 'Save Settings';

        const toast = document.createElement('span');
        toast.className = 'usd-cfg-saved-toast';
        toast.id = 'usd-cfg-toast';
        toast.textContent = '✓ Saved';

        saveBtn.addEventListener('click', () => {
            const newSymbol = symbolSelect.value;
            const newMode = modeRadios.find(r => r.checked)?.value || DISPLAY_MODE;

            CURRENCY_SYMBOL = newSymbol;
            DISPLAY_MODE = newMode;

            GM_setValue(STORAGE_KEY_SYMBOL, newSymbol);
            GM_setValue(STORAGE_KEY_MODE, newMode);

            // Show toast
            toast.classList.add('usd-cfg-show');
            setTimeout(() => toast.classList.remove('usd-cfg-show'), 2000);

            // Update preview
            updatePreview();

            // Re-scan the page with new settings
            // Clear all converted markers so everything re-processes
            document.querySelectorAll('[data-usd-converted]').forEach(el => {
                el.dataset.usdConverted = '0';
                // We can't easily restore original text, so just mark for re-conversion
                // The MutationObserver will pick up new elements
            });
            scan(document.body);
        });

        saveSection.appendChild(saveBtn);
        saveSection.appendChild(toast);

        // --- Assemble ---
        body.appendChild(symbolSection);
        body.appendChild(modeSection);
        body.appendChild(previewSection);
        body.appendChild(saveSection);

        panel.appendChild(header);
        panel.appendChild(body);

        return panel;
    }

    function injectSettingsPanel() {
        if (!isCurrencyPage()) return;

        // Avoid double-injection
        if (document.getElementById('usd-converter-settings')) return;

        // Find a good injection point — look for Torn's content containers
        // Torn uses various wrapper classes; try common ones
        const containers = [
            document.querySelector('.content-wrapper'),
            document.querySelector('#mainContainer'),
            document.querySelector('.content'),
            document.querySelector('[class*="bank"]'),
            document.querySelector('[class*="stock"]'),
        ];

        const panel = buildSettingsPanel();

        for (const container of containers) {
            if (container) {
                // Insert as first child of the content area
                container.insertBefore(panel, container.firstChild);
                return;
            }
        }

        // Fallback: prepend to body's main content area
        const fallback = document.querySelector('body > div');
        if (fallback) {
            fallback.insertBefore(panel, fallback.firstChild);
        }
    }

    // =========================
    // TAMPERMONKEY MENU
    // =========================

    GM_registerMenuCommand('USD Converter — Open Settings', () => {
        // If on a currency page, scroll to the panel
        const existing = document.getElementById('usd-converter-settings');
        if (existing) {
            existing.scrollIntoView({ behavior: 'smooth' });
            // Flash the header
            const hdr = existing.querySelector('.usd-cfg-header');
            hdr.style.background = '#3a5a1f';
            setTimeout(() => hdr.style.background = '', 600);
        } else {
            // Not on a currency page — just alert
            alert('USD Converter settings are available on the Bank and Stock Market pages.');
        }
    });

    // =========================
    // INIT
    // =========================

    scan(document.body);

    // Inject settings panel on currency pages
    // Use a small delay to let Torn's SPA render
    if (isCurrencyPage()) {
        setTimeout(injectSettingsPanel, 500);
        // Also try again after a longer delay for slow-loading pages
        setTimeout(injectSettingsPanel, 2000);
    }

    // Re-inject on URL changes (Torn is a SPA)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (isCurrencyPage()) {
                setTimeout(injectSettingsPanel, 500);
                setTimeout(injectSettingsPanel, 2000);
            }
        }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    processTextNode(node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Don't process our own settings panel
                    if (node.dataset?.usdSettingsPanel === '1') continue;
                    if (node.id === 'usd-converter-settings') continue;
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
