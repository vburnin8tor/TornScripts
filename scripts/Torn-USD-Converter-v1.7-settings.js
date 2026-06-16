// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.7
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license MIT
// @namespace https://greasyfork.org/users/559205
// ==/UserScript==

(function() {
    'use strict';

        // =========================
        // config — persisted via tampermonkey storage
        // =========================
    const USD_PER_TORN = 5 / 23500000;

    // loaded from gm storage, defaults to reversed
    var displayMode = "reversed";

    function loadConfig() {
        try {
            var v = GM_getValue('torn_usd_display_mode', 'reversed');
            // only accept valid display modes
            var valid = ['converted','combined','reversed','full','fullreversed','original'];
            if (valid.indexOf(v) !== -1) displayMode = v;
        } catch(e) { displayMode = 'reversed'; }
    }

    function saveConfig() {
        GM_setValue('torn_usd_display_mode', displayMode);
    }

    loadConfig();

    function formatUSD(tornAmount) {
        const usd = tornAmount * USD_PER_TORN;
        if (usd === 0) return '$0';
        if (usd <= 0.000001){
            return '$' + usd.toFixed(7);
        }
        if (usd <= 0.00001){
            return '$' + usd.toFixed(6);
        }

        if (usd <= 0.0001 ){
            return '$' + usd.toFixed(5);
        }

        if (usd >= 9999) {
            return '$' + usd.toFixed(0);
        }

        if (usd >= 0.02) {
            return '$' + usd.toFixed(2);
        }

        return '$' + usd.toFixed(4);
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

    function convertText(text) {
        return text.replace(
            /\$([\d,.]+)([kMBT]|mil|bil| mil| bil)?/g,
            (match, value, suffix) => {

                let amount = parseFloat(value.replace(/,/g, ''))
		if (isNaN(amount)) return match;
                switch ((suffix || '')) {
                    case 'k':
                        amount *= 1e3;
                        break;
                    case 'M':
                    case 'mil':
                        amount *= 1e6;
                        break;
                    case 'B':
                    case 'bil':
                        amount *= 1e9;
                        break;
                    case 'T':
                        amount *= 1e12;
                        break;
                }

                switch (displayMode) {
                    case 'converted':
                        return formatUSD(amount);
                    case 'combined':
                        return formatUSD(amount) + ' (' + formatTorn(amount) + ') ';
                    case 'reversed':
                        return formatTorn(amount) + ' (' + formatUSD(amount) + ') ';
                    case 'full':
                        return formatUSD(amount) + ' (' + match.replace(/\$/, '§') + ') ';
					case 'fullreversed':
						return match.replace(/\$/, '§') + ' (' + formatUSD(amount) + ') ';
                    case 'original':
                        return match.replace(/\$/, '§');

                }
            }
        );
    }

    function isItemMarketPrice(el) {
        // item market price/total divs — just swap $ to §, no full conversion
        if (el.tagName === 'DIV') {
            var cls = el.className || '';
            if (cls.indexOf('price') !== -1 || cls.indexOf('priceandTotal') !== -1) return true;
        }
        return false;
    }

    function processElement(el) {
            if (!el || el.dataset.usdConverted === "1") return;
            // skip our own settings panel elements
            if (el.id && el.id.indexOf('tusd') !== -1) return;
            if (el.closest && el.closest('#tusd-overlay, #tusd-sbtn')) return;

            const text = el.textContent;
            if (!text || !text.includes('$')) return;
            // skip already-converted text (converted output has ($ or (§)
            if (text.includes('(§') || text.includes('($')) return;

            // item market price divs: just swap $ to § to avoid overflow
            if (isItemMarketPrice(el)) {
                el.textContent = text.replace(/\$/g, '§');
                el.dataset.usdConverted = "1";
                return;
            }

            el.textContent = convertText(text);
            el.dataset.usdConverted = "1";
        }

        function processNode(node) {
        	if (
        	node.nodeType !== Node.TEXT_NODE ||
        	!node.nodeValue ||
        	node.nodeValue.includes('(§') ||
        	node.nodeValue.includes('($')
        	)
        	{
            return;
        }
        // skip text inside our own settings panel
        var p = node.parentElement;
        if (p && (p.id && p.id.indexOf('tusd') !== -1)) return;
        if (p && p.closest && p.closest('#tusd-overlay, #tusd-sbtn')) return;

        node.nodeValue = convertText(node.nodeValue);
    }

   function scan(root) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    // process item market + displayPrice spans once before walking text nodes
    var priceEls = root.querySelectorAll?.(
        'span[class*="displayPrice"], div[class*="price"], div[class*="priceandTotal"]'
    );
    if (priceEls) {
        priceEls.forEach(processElement);
    }

    let node;
    while ((node = walker.nextNode())) {
        processNode(node);
    }
}

    scan(document.body);

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {

                if (node.nodeType === Node.TEXT_NODE) {
                    processNode(node);
                }

                if (node.nodeType === Node.ELEMENT_NODE) {
                    scan(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // =========================
    // settings panel v1.0
    // adds a floating button + modal + tampermonkey menu entry
    // =========================

    // inject css once
    var settingsStyle = document.createElement('style');
    settingsStyle.textContent =
        '#tusd-sbtn{position:fixed;bottom:24px;right:24px;z-index:99999;' +
        'width:38px;height:38px;border-radius:50%;background:#222;' +
        'color:#888;border:1px solid #444;cursor:pointer;font-size:18px;' +
        'display:flex;align-items:center;justify-content:center;' +
        'opacity:0.45;transition:opacity .2s}' +
        '#tusd-sbtn:hover{opacity:1;color:#bbb;border-color:#666}' +
        '#tusd-overlay{display:none;position:fixed;inset:0;' +
        'background:rgba(0,0,0,.5);z-index:100000;' +
        'justify-content:center;align-items:center}' +
        '#tusd-overlay.tusd-show{display:flex}' +
        '#tusd-modal{background:#1e1e1e;border:1px solid #333;' +
        'border-radius:8px;padding:20px;max-width:380px;width:90%;' +
        'color:#ccc;font:13px/1.6 Arial,sans-serif;position:relative}' +
        '#tusd-modal h3{margin:0 0 12px;font-size:15px;color:#ddd}' +
        '#tusd-close{position:absolute;top:10px;right:14px;' +
        'cursor:pointer;color:#666;font-size:20px}' +
        '#tusd-close:hover{color:#aaa}' +
        '#tusd-modal label{display:block;margin-bottom:4px;' +
        'font-size:11px;color:#888;text-transform:uppercase}' +
        '#tusd-modal select{width:100%;padding:6px 8px;margin-bottom:14px;' +
        'background:#111;border:1px solid #333;border-radius:4px;' +
        'color:#ccc;font-size:13px}' +
        '#tusd-modal .tusd-hint{font-size:10px;color:#555;' +
        'margin:-10px 0 14px}' +
        '#tusd-modal .tusd-btn{width:100%;padding:8px;' +
        'background:#2a2a2a;color:#aaa;border:1px solid #444;' +
        'border-radius:4px;cursor:pointer;font-size:13px;margin:4px 0}' +
        '#tusd-modal .tusd-btn:hover{background:#333;color:#ddd}' +
        '#tusd-modal .tusd-meta{font-size:10px;color:#555;' +
        'margin-top:10px;text-align:center}';
    document.head.appendChild(settingsStyle);

    // floating settings button (gear icon)
    var sbtn = document.createElement('button');
    sbtn.id = 'tusd-sbtn';
    sbtn.textContent = '\u2699';
    sbtn.title = 'torn usd converter settings';
    sbtn.addEventListener('click', openSettings);
    document.body.appendChild(sbtn);

    // overlay + modal
    function openSettings() {
        if (document.getElementById('tusd-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'tusd-overlay';
        overlay.className = 'tusd-show';

        var modal = document.createElement('div');
        modal.id = 'tusd-modal';

        // build display mode options
        var modes = [
            { val: 'converted',    label: 'Converted' + ' \u2014 $5.00' },
            { val: 'combined',     label: 'Combined \u2014 $5.00 (\u00a723.5M)' },
            { val: 'reversed',     label: 'Reversed \u2014 \u00a723.5M ($5.00)' },
            { val: 'full',         label: 'Full \u2014 $5.00 (\u00a723,500,001)' },
            { val: 'fullreversed', label: 'Full Reversed \u2014 \u00a723,500,001 ($5.00)' },
            { val: 'original',     label: 'Original \u2014 \u00a723,500,001' }
        ];
        var optsHtml = '';
        for (var i = 0; i < modes.length; i++) {
            var m = modes[i];
            optsHtml += '<option value="' + m.val + '"' +
                (m.val === displayMode ? ' selected' : '') + '>' + m.label + '</option>';
        }

        modal.innerHTML =
            '<span id="tusd-close">&times;</span>' +
            '<h3>\u2699 Torn USD Converter</h3>' +
            '<label>Display Mode</label>' +
            '<select id="tusd-mode">' + optsHtml + '</select>' +
            '<div class="tusd-hint">current: ' + displayMode + ' \u2014 changes reload the page</div>' +
            '<button class="tusd-btn" id="tusd-save">Save &amp; Reload</button>' +
            '<button class="tusd-btn" id="tusd-cancel">Cancel</button>' +
            '<div class="tusd-meta">v1.7 \u2022 shaul [3908280] \u2022 ' +
            '<a href="#" id="tusd-tm-link" style="color:#555">tampermonkey dashboard</a></div>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // close handlers
        document.getElementById('tusd-close').onclick = closeSettings;
        document.getElementById('tusd-cancel').onclick = closeSettings;
        overlay.onclick = function(e) {
            if (e.target === overlay) closeSettings();
        };

        // save handler
        document.getElementById('tusd-save').onclick = function() {
            displayMode = document.getElementById('tusd-mode').value;
            saveConfig();
            closeSettings();
            // reload so new mode takes effect on fresh dom
            location.reload();
        };

        // link to tm dashboard
        document.getElementById('tusd-tm-link').onclick = function(e) {
            e.preventDefault();
            // tries to open tm's manage panel — works on most browsers
            window.open('about:blank', '_blank');
            // fallback: show the user where to find it
            alert('find this script in your tampermonkey dashboard ' +
                  '(click the monkey icon \u2192 dashboard \u2192 torn usd converter) ' +
                  'to edit @match rules, export, or remove it.');
        };
    }

    function closeSettings() {
        var overlay = document.getElementById('tusd-overlay');
        if (overlay) overlay.remove();
    }

    // tampermonkey menu entry (click the monkey icon in your toolbar)
    try {
        GM_registerMenuCommand('\u2699 USD Converter: Open Settings', openSettings);
    } catch(e) {
        // tm not available — that's fine, floating button still works
    }

})();
