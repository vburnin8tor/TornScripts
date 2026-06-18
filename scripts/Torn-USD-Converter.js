// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.9.2
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        none
// @license MIT
// @namespace https://greasyfork.org/users/559205
// @downloadURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.user.js
// @updateURL https://update.greasyfork.org/scripts/582336/Torn%20USD%20Converter.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // =========================
    // CONFIG — persisted
    // =========================
    const DEFAULT_MODE = 'fullreversed';
    const DISPLAY_MODE_KEY = 'torn_usd_mode';
    const UI_VISIBLE_KEY  = 'torn_usd_ui_visible';
    const PREVIEW_OPEN_KEY = 'torn_usd_preview_open';

    const MODE_OPTIONS = [
        { value: 'converted',    label: 'Converted',     desc: 'USD only — $5.00' },
        { value: 'combined',      label: 'Combined',      desc: 'USD + Torn — $5.00 (§23.5M)' },
        { value: 'reversed',      label: 'Reversed',      desc: 'Torn + USD — §23.5M ($5.00)' },
        { value: 'full',          label: 'Full',          desc: 'USD + raw Torn — $5.00 (§23,500,001)' },
        { value: 'fullreversed',  label: 'Full Reversed', desc: 'raw Torn + USD — §23,500,001 ($5.00)' },
        { value: 'original',      label: 'Original',      desc: 'Torn dollars only — §23.5M' },
        { value: 'badge',         label: 'Badge',         desc: 'Original + green USD badge appended' },
    ];

    function getMode() {
        try { return GM_getValue(DISPLAY_MODE_KEY, DEFAULT_MODE); } catch (e) { return localStorage.getItem(DISPLAY_MODE_KEY) || DEFAULT_MODE; }
    }
    function setMode(mode) {
        try { GM_setValue(DISPLAY_MODE_KEY, mode); } catch (e) { localStorage.setItem(DISPLAY_MODE_KEY, mode); }
        location.reload();
    }

    let DISPLAY_MODE = getMode();
    const USD_PER_TORN = 5 / 23500000;

    const PRICE_REGEX = /\$([\d,.]+)\s*(mil|mill|bil|bn|tril|k|m|b|t)?/gi;
    const SIMPLE_PRICE_REGEX = /\$([\d,.]+)/;

    const PRICE_SELECTOR =
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"], span[class*="tt-item-price"], span[class*="item-price"]';

    const isBadgeMode = DISPLAY_MODE === 'badge';

    // =========================
    // BADGE STYLING
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
        if (tornAmount >= 1e12) return '§' + (tornAmount / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
        if (tornAmount >= 1e9)  return '§' + (tornAmount / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
        if (tornAmount >= 1e6)  return '§' + (tornAmount / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
        if (tornAmount >= 94000) return '§' + (tornAmount / 1e3).toFixed(1) + 'k';
        return '§' + tornAmount.toLocaleString();
    }

    function parseTornAmount(rawValue, suffix = '') {
        let amount = parseFloat(rawValue.replace(/,/g, ''));
        if (Number.isNaN(amount)) return null;
        switch ((suffix || '').trim()) {
            case 'K': case 'k': amount *= 1e3; break;
            case 'M': case 'm': case 'mil': amount *= 1e6; break;
            case 'B': case 'b': case 'bil': amount *= 1e9; break;
            case 'T': case 't': amount *= 1e12; break;
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
    // TEXT CONVERSION (non-badge)
    // =========================

    function convertText(text) {
        return text.replace(PRICE_REGEX, (match, value, suffix) => {
            const amount = parseTornAmount(value, suffix);
            if (amount == null) return match;
            switch (DISPLAY_MODE) {
                case 'converted':      return formatUSD(amount);
                case 'combined':       return `${formatUSD(amount)} (${formatTorn(amount)})`;
                case 'reversed':       return `${formatTorn(amount)} (${formatUSD(amount)})`;
                case 'full':           return `${formatUSD(amount)} (${match.replace('$', '§')})`;
                case 'fullreversed':   return `${match.replace('$', '§')} (${formatUSD(amount)})`;
                case 'original':       return match.replace('$', '§');
                default:               return match;
            }
        });
    }

    // =========================
    // TORN TOOLS tt-item-price
    // =========================

    function isTTItemPrice(el) {
        return el.tagName === 'SPAN' && el.className.includes('tt-item-price');
    }

    function processTTItemPriceBadge(el) {
        if (!el || el.dataset.usdConverted === '1') return;
        for (const child of el.children) {
            const text = child.textContent;
            if (!text.includes('$')) continue;
            if (child.firstChild && child.firstChild.nodeType === Node.TEXT_NODE) {
                child.firstChild.nodeValue = child.firstChild.nodeValue.replace(/\|\s*$/, '');
            }
            const converted = convertSinglePrice(text);
            if (!converted) continue;
            appendBadgeToElement(child, converted[1]);
        }
        el.dataset.usdConverted = '1';
    }

    function processTTItemPriceStandard(el) {
        if (!el || el.dataset.usdConverted === '1') return;
        for (const child of el.children) {
            if (child.className.includes('tt-item-quantity')) continue;
            const text = child.textContent;
            if (!text.includes('$')) continue;
            if (text.includes('(§') || text.includes('($')) continue;
            child.textContent = convertText(text.replace(/\|\s*$/, ''));
        }
        el.dataset.usdConverted = '1';
    }

    // =========================
    // BADGE HELPERS
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
    // DOM — BADGE MODE
    // =========================

    function processElementBadge(el) {
        if (!el || el.dataset.usdConverted === '1') return;

        if (isTTItemPrice(el)) { processTTItemPriceBadge(el); return; }

        if (isPriceAndTotalElement(el)) {
            const priceSpan = el.querySelector('priceAndTotal');
            if (!priceSpan) return;
            const converted = convertSinglePrice(priceSpan.textContent);
            if (!converted) return;
            appendBadgeToElement(priceSpan, converted[1]);
            el.dataset.usdConverted = '1';
            return;
        }

        if (isPriceElement(el)) {
            const converted = convertSinglePrice(el.textContent);
            if (!converted) return;
            appendBadgeToElement(el, converted[1]);
            el.dataset.usdConverted = '1';
            return;
        }

        // FALLBACK
        if (el.children.length > 0) return;
        const text = el.textContent;
        if (!text || !text.includes('$')) return;
        if (text.includes('(§') || text.includes('($') || text.includes('|')) return;
        processTextNodesBadge(el);
        el.dataset.usdConverted = '1';
    }

    function processTextNodesBadge(el) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        const nodesToProcess = [];
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.includes('$') &&
                !node.nodeValue.includes('(§') && !node.nodeValue.includes('($') &&
                !isInsidePriceAndTotal(node.parentElement)) {
                nodesToProcess.push(node);
            }
        }
        for (const textNode of nodesToProcess) processTextNodeBadge(textNode);
    }

    function processTextNodeBadge(node) {
        if (!node.nodeValue) return;
        const text = node.nodeValue;
        const parent = node.parentElement;
        if (!parent) return;
        PRICE_REGEX.lastIndex = 0;
        let lastIndex = 0, match, fragments = [];
        while ((match = PRICE_REGEX.exec(text)) !== null) {
            if (match.index > lastIndex) fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
            fragments.push(document.createTextNode(match[0]));
            const amount = parseTornAmount(match[1], match[2]);
            if (amount != null) {
                fragments.push(document.createTextNode(' '));
                fragments.push(createUSDBadge(formatUSD(amount)));
            }
            lastIndex = PRICE_REGEX.lastIndex;
        }
        if (lastIndex < text.length) fragments.push(document.createTextNode(text.slice(lastIndex)));
        if (!fragments.length) return;
        const frag = document.createDocumentFragment();
        for (const f of fragments) frag.appendChild(f);
        parent.replaceChild(frag, node);
    }

    // =========================
    // DOM — STANDARD MODES
    // =========================

    function processElementStandard(el) {
        if (!el || el.dataset.usdConverted === '1') return;

        if (isTTItemPrice(el)) { processTTItemPriceStandard(el); return; }

        if (isPriceAndTotalElement(el)) {
            const priceSpan = el.querySelector('priceAndTotal');
            const totalSpan = el.querySelector('span:titleTotal');
            if (!priceSpan) return;
            const converted = convertSinglePrice(priceSpan.textContent);
            if (!converted) return;
            const torn = converted[0], usd = converted[1];
            const price = priceSpan.textContent;
            const total = totalSpan ? totalSpan.textContent : '';
            let stack = [];
            switch (DISPLAY_MODE) {
                case 'converted':     stack = [`${usd} (${total})`]; break;
                case 'combined':      stack = [`${usd} (${torn}) (${total})`]; break;
                case 'reversed':      stack = [`${torn} (${usd}) (${total})`]; break;
                case 'full':          stack = [`${usd} (${price}) (${total})`]; break;
                case 'fullreversed':  stack = [`${price} (${usd}) (${total})`]; break;
                case 'original':      stack = [`${torn} (${total})`]; break;
                default:              stack = [`${price} (${usd}) (${total})`];
            }
            priceSpan.innerHTML = stack.join('<br>');
            el.dataset.usdConverted = '1';
            return;
        }

        if (isPriceElement(el)) {
            const converted = convertSinglePrice(el.textContent);
            if (!converted) return;
            const torn = converted[0], usd = converted[1];
            let output;
            switch (DISPLAY_MODE) {
                case 'converted':     output = usd; break;
                case 'combined':      output = `${usd} (${torn})`; break;
                case 'reversed':      output = `${torn} (${usd})`; break;
                case 'full':          output = `${usd} (${torn})`; break;
                case 'fullreversed':  output = `${torn} (${usd})`; break;
                case 'original':      output = torn; break;
                default:              output = `${torn} (${usd})`;
            }
            el.innerHTML = output;
            el.dataset.usdConverted = '1';
            return;
        }

        // FALLBACK
        if (el.children.length > 0) return;
        const text = el.textContent;
        if (!text || !text.includes('$')) return;
        if (text.includes('(§') || text.includes('($') || text.includes('|')) return;
        el.textContent = convertText(text);
        el.dataset.usdConverted = '1';
    }

    function processTextNodeStandard(node) {
        if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue || isInsidePriceAndTotal(node.parentElement)) return;
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
                    if (isBadgeMode) processElementBadge(el);
                    else processElementStandard(el);
                }
            }
        }
        if (!isBadgeMode) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) processTextNodeStandard(node);
        }
    }

    // =========================
    // PREVIEW DATA — sample prices
    // =========================
    const PREVIEW_ITEMS = [
        { name: 'Body Armor',     price: 410,       qty: 1 },
        { name: 'Dinosaur Egg',   price: 23500000,   qty: 1 },
        { name: 'xanax',          price: 4500000,    qty: 2 },
        { name: 'Bank Statement', price: 13141,      qty: 50 },
        { name: 'Claw',           price: 820000,     qty: 1 },
    ];
    const PREVIEW_ROW = [
        { label: 'Items',        value: 52875000,    change: -1045000 },
        { label: 'Stock Market', value: 8039000,     change: -2006 },
        { label: 'Item Market',  value: 239125,      change: 239125 },
    ];

    // =========================
    // SETTINGS UI — matrix theme
    // =========================

    const SETTINGS_ID = 'torn-usd-settings';

    function injectSettingsStyles() {
        if (document.getElementById(SETTINGS_ID + '-styles')) return;
        const s = document.createElement('style');
        s.id = SETTINGS_ID + '-styles';
        s.textContent = `
            #${SETTINGS_ID}-backdrop {
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(0,0,0,0.85);
                display: none; justify-content: center; align-items: center;
                font-family: 'Courier New', Courier, monospace;
            }
            #${SETTINGS_ID}-backdrop.active { display: flex; }

            #${SETTINGS_ID} {
                background: #0a0a0a;
                border: 1px solid rgba(0,255,65,0.4);
                border-radius: 4px;
                color: #bdbdbd;
                font-size: 13px;
                line-height: 1.6;
                width: 640px; max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 0 40px rgba(0,255,65,0.08), 0 0 0 1px rgba(0,0,0,0.8);
                position: relative;
            }
            #${SETTINGS_ID}::-webkit-scrollbar { width: 6px; }
            #${SETTINGS_ID}::-webkit-scrollbar-track { background: #0a0a0a; }
            #${SETTINGS_ID}::-webkit-scrollbar-thumb { background: rgba(0,255,65,0.3); border-radius: 3px; }

            .usd-hdr {
                padding: 16px 20px 12px;
                border-bottom: 1px solid rgba(0,255,65,0.15);
                display: flex; align-items: center; justify-content: space-between;
            }
            .usd-hdr h1 {
                margin: 0; font-size: 15px; font-weight: bold;
                color: #00ff41; letter-spacing: 1px; text-transform: uppercase;
            }
            .usd-hdr .usd-x {
                background: none; border: 1px solid rgba(0,255,65,0.3);
                color: #00cc33; font-family: inherit; font-size: 16px;
                cursor: pointer; padding: 2px 8px; border-radius: 2px;
                line-height: 1;
            }
            .usd-hdr .usd-x:hover { background: rgba(0,255,65,0.1); }

            .usd-sec { padding: 14px 20px; }
            .usd-sec + .usd-sec { border-top: 1px solid rgba(0,255,65,0.06); }
            .usd-sec-title {
                font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;
                color: #00cc33; margin: 0 0 10px 0;
            }

            .usd-modes { display: flex; flex-wrap: wrap; gap: 6px; }
            .usd-mode-btn {
                background: transparent; border: 1px solid rgba(0,255,65,0.2);
                color: #999; font-family: inherit; font-size: 12px;
                padding: 5px 12px; cursor: pointer; border-radius: 2px;
                transition: all 0.15s;
            }
            .usd-mode-btn:hover { border-color: rgba(0,255,65,0.5); color: #ccc; }
            .usd-mode-btn.active {
                border-color: #00ff41; color: #00ff41;
                background: rgba(0,255,65,0.08);
                font-weight: bold;
            }
            .usd-mode-btn .usd-mode-desc {
                display: block; font-size: 10px; color: #666; margin-top: 2px;
            }

            .usd-preview-wrap {
                background: rgba(0,255,65,0.03);
                border: 1px solid rgba(0,255,65,0.1);
                border-radius: 3px; padding: 10px 14px;
                min-height: 60px;
            }
            .usd-preview-label {
                font-size: 10px; color: #00cc33; text-transform: uppercase;
                letter-spacing: 1px; margin-bottom: 6px;
            }
            .usd-preview-row {
                display: flex; justify-content: space-between; align-items: baseline;
                font-size: 12px; padding: 2px 0;
            }
            .usd-preview-row .pl { color: #777; }
            .usd-preview-row .pv { color: #ccc; }

            .usd-preview-item {
                display: flex; align-items: center; gap: 10px;
                font-size: 12px; padding: 3px 0;
            }
            .usd-preview-item .pi-name { flex: 1; color: #888; }
            .usd-preview-item .pi-qty { color: #555; font-size: 11px; }
            .usd-preview-item .pi-price { color: #ccc; text-align: right; }

            .usd-preview-market {
                font-size: 12px; padding: 3px 0;
            }
            .usd-preview-market .pm-row {
                display: flex; justify-content: space-between; padding: 2px 0;
            }
            .usd-preview-market .pm-label { color: #777; }
            .usd-preview-market .pm-val { color: #ccc; }
            .usd-preview-market .pm-change { color: #00cc33; font-size: 11px; }
            .usd-preview-market .pm-change.neg { color: #ff4141; }

            .usd-actions {
                padding: 12px 20px; border-top: 1px solid rgba(0,255,65,0.1);
                display: flex; gap: 8px; justify-content: flex-end;
            }
            .usd-btn {
                background: transparent; border: 1px solid rgba(0,255,65,0.3);
                color: #00ff41; font-family: inherit; font-size: 12px;
                padding: 6px 16px; cursor: pointer; border-radius: 2px;
                text-transform: uppercase; letter-spacing: 0.5px;
                transition: all 0.15s;
            }
            .usd-btn:hover { background: rgba(0,255,65,0.1); }
            .usd-btn.primary {
                border-color: #00ff41; font-weight: bold;
                background: rgba(0,255,65,0.06);
            }
            .usd-btn.primary:hover { background: rgba(0,255,65,0.15); }

            .usd-status {
                font-size: 11px; color: #555;
                padding: 0 20px 10px;
            }
            .usd-status .usd-ok { color: #00cc33; }
        `;
        document.head.appendChild(s);
    }

    // ── Build preview DOM for a given mode (without side-effects) ──
    function renderPreview(mode) {
        const badge = mode === 'badge';

        // Helper: format a price in any mode
        function fmtPrice(amount) {
            const torn = formatTorn(amount);
            const usd = formatUSD(amount);
            if (badge) return `${torn} <span class="${BADGE_CLASS}" style="font-size:0.75em;opacity:0.7;margin-left:4px;color:#8bc34a;white-space:nowrap">${usd}</span>`;
            switch (mode) {
                case 'converted':     return usd;
                case 'combined':      return `${usd} (${torn})`;
                case 'reversed':      return `${torn} (${usd})`;
                case 'full':          return `${usd} (${'§' + amount.toLocaleString()})`;
                case 'fullreversed':  return `${'§' + amount.toLocaleString()} (${usd})`;
                case 'original':      return torn;
                default:              return `${torn} (${usd})`;
            }
        }

        // ── Standalone prices ──
        let standaloneHTML = '';
        standaloneHTML += `<div class="usd-preview-label">Standalone price</div>`;
        standaloneHTML += `<div class="usd-preview-row"><span class="pl">Small (§410)</span><span class="pv">${fmtPrice(410)}</span></div>`;
        standaloneHTML += `<div class="usd-preview-row"><span class="pl">Medium (§13,141)</span><span class="pv">${fmtPrice(13141)}</span></div>`;
        standaloneHTML += `<div class="usd-preview-row"><span class="pl">Large (§23.5M)</span><span class="pv">${fmtPrice(23500000)}</span></div>`;

        // ── Item row (with qty) ──
        let itemHTML = '';
        itemHTML += `<div class="usd-preview-label">Item row (quantity)</div>`;
        for (const it of PREVIEW_ITEMS) {
            const priceStr = fmtPrice(it.price);
            const qtyStr = it.qty > 1 ? `<span class="pi-qty">${it.qty}x =</span> ${fmtPrice(it.price * it.qty)}` : '';
            itemHTML += `<div class="usd-preview-item">
                <span class="pi-name">${it.name}</span>
                ${qtyStr ? `<span class="pi-price">${priceStr} <span class="pi-qty" style="color:#555;font-size:10px">${it.qty}x</span> ${qtyStr.includes('=') ? '→ ' + fmtPrice(it.price * it.qty) : ''}</span>` : `<span class="pi-price">${priceStr}</span>`}
            </div>`;
        }

        // ── Market row ──
        let marketHTML = '';
        marketHTML += `<div class="usd-preview-label">Market / networth row</div>`;
        marketHTML += `<div class="usd-preview-market">`;
        for (const r of PREVIEW_ROW) {
            const valStr = fmtPrice(r.value);
            const changeFmt = r.change >= 0 ? `+${fmtPrice(r.change)}` : fmtPrice(r.change);
            const changeColor = r.change >= 0 ? 'color:#00cc33' : 'color:#ff4141';
            marketHTML += `<div class="pm-row">
                <span class="pm-label">${r.label}</span>
                <span>${valStr} <span style="${changeColor};font-size:10px">${changeFmt}</span></span>
            </div>`;
        }
        marketHTML += `</div>`;

        return { standaloneHTML, itemHTML, marketHTML };
    }

    function buildSettingsUI() {
        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = SETTINGS_ID + '-backdrop';

        // Panel
        const panel = document.createElement('div');
        panel.id = SETTINGS_ID;

        // Header
        panel.innerHTML = `
            <div class="usd-hdr">
                <h1>◆ USD Converter</h1>
                <button class="usd-x" id="${SETTINGS_ID}-close">✕</button>
            </div>

            <div class="usd-sec">
                <div class="usd-sec-title">Display mode</div>
                <div class="usd-modes" id="${SETTINGS_ID}-modes"></div>
            </div>

            <div class="usd-sec" id="${SETTINGS_ID}-preview-sec">
                <div class="usd-sec-title">Live preview</div>
                <div class="usd-preview-wrap" id="${SETTINGS_ID}-preview"></div>
            </div>

            <div class="usd-actions">
                <button class="usd-btn" id="${SETTINGS_ID}-reset">Reset to default</button>
                <button class="usd-btn primary" id="${SETTINGS_ID}-apply">Apply &amp; reload</button>
            </div>
            <div class="usd-status">Mode: <span class="usd-ok" id="${SETTINGS_ID}-cur-mode"></span></div>
        `;

        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);

        // Render mode buttons + preview
        const modesEl = panel.querySelector(`#${SETTINGS_ID}-modes`);
        const previewEl = panel.querySelector(`#${SETTINGS_ID}-preview`);
        const curModeEl = panel.querySelector(`#${SETTINGS_ID}-cur-mode`);

        let selectedMode = DISPLAY_MODE;

        function updatePreview() {
            const p = renderPreview(selectedMode);
            previewEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${p.standaloneHTML}${p.itemHTML}${p.marketHTML}</div>`;
            curModeEl.textContent = selectedMode;
        }

        for (const opt of MODE_OPTIONS) {
            const btn = document.createElement('button');
            btn.className = 'usd-mode-btn' + (opt.value === selectedMode ? ' active' : '');
            btn.innerHTML = `${opt.label}<span class="usd-mode-desc">${opt.desc}</span>`;
            btn.dataset.value = opt.value;
            btn.addEventListener('click', () => {
                selectedMode = opt.value;
                for (const b of modesEl.children) b.classList.toggle('active', b.dataset.value === selectedMode);
                updatePreview();
            });
            modesEl.appendChild(btn);
        }

        updatePreview();

        // Close
        const close = () => { backdrop.classList.remove('active'); };
        panel.querySelector(`#${SETTINGS_ID}-close`).addEventListener('click', close);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

        // Reset
        panel.querySelector(`#${SETTINGS_ID}-reset`).addEventListener('click', () => {
            selectedMode = DEFAULT_MODE;
            for (const b of modesEl.children) b.classList.toggle('active', b.dataset.value === selectedMode);
            updatePreview();
        });

        // Apply
        panel.querySelector(`#${SETTINGS_ID}-apply`).addEventListener('click', () => {
            if (selectedMode === DISPLAY_MODE) { close(); return; }
            setMode(selectedMode);
        });

        return backdrop;
    }

    function openSettings() {
        let backdrop = document.getElementById(SETTINGS_ID + '-backdrop');
        if (!backdrop) {
            injectSettingsStyles();
            backdrop = buildSettingsUI();
        }
        backdrop.classList.add('active');
    }

    // =========================
    // TAMPERMONKEY MENU
    // =========================

    if (typeof GM_registerMenuCommand !== 'undefined') {
        // Direct mode switches
        for (const opt of MODE_OPTIONS) {
            GM_registerMenuCommand(`USD: ${opt.label}`, () => setMode(opt.value), null);
        }
        GM_registerMenuCommand('────────────────', () => {}, null);
        GM_registerMenuCommand('USD: Settings...', () => openSettings(), null);
    }

    // =========================
    // INIT
    // =========================

    if (isBadgeMode) ensureBadgeStyle();

    scan(document.body);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (!isBadgeMode) processTextNodeStandard(node);
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
