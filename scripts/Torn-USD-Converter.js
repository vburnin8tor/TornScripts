// ==UserScript==
// @name         Torn USD Converter
// @author       shaul [3908280]
// @version      1.6
// @description  Convert Torn cash displays to USD equivalents
// @match        https://www.torn.com/*
// @grant        none
// @license MIT
// @namespace https://greasyfork.org/users/559205
// ==/UserScript==
 
(function() {
    'use strict';
 
        // =========================
        // +++++++++CONFIG++++++++++
        // =========================
    const DISPLAY_MODE = "reversed";
        // OPTIONS :
        // "converted"    -> $5.00
        // "combined"     -> $5.00 (§23.5M) (abbreviation starts at $0.02/94000)
        // "reversed"     -> §23.5M ($5.00)
        // "full"         -> $5.00 (§23,500,001)
	// "fullreversed" -> §23,500,001 ($5.00)
        // "original"     -> §89,984 (exact, no abbreviation)
 
    const USD_PER_TORN = 5 / 23500000;
 
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
 
                switch (DISPLAY_MODE) {
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
        if (el.tagName !== 'DIV') return false;
        var cls = el.className || '';
        if (cls.indexOf('priceandTotal') !== -1) return false;
        return cls.indexOf('price') !== -1;
    }

    function isItemMarketPriceAndTotal(el) {
        if (el.tagName !== 'DIV') return false;
        var cls = el.className || '';
        return cls.indexOf('priceandTotal') !== -1;
    }

    function convertSinglePrice(text) {
        // returns [tornLine, usdLine] for a single $price
        var match = text.match(/\$([\d,.]+)/);
        if (!match) return null;
        var amount = parseFloat(match[1].replace(/,/g, ''));
        if (isNaN(amount)) return null;
        return [formatTorn(amount), formatUSD(amount)];
    }

    function processElement(el) {
            if (!el || el.dataset.usdConverted === "1") return;

            const text = el.textContent;
            if (!text || !text.includes('$')) return;
            // skip already-converted text (converted output has ($ or (§)
            if (text.includes('(§') || text.includes('($')) return;

            // item market priceandTotal div: stacked torn / usd / total
            // structure: <span>$410</span><span class="titleTotal___..."> (215,463)</span>
            // the total span is item count — pass through unchanged
            if (isItemMarketPriceAndTotal(el)) {
                if (el.dataset.usdConverted === "1") return;
                var children = el.children;
                var priceText = "";
                var totalText = "";
                for (var i = 0; i < children.length; i++) {
                    var childText = children[i].textContent;
                    if (childText.indexOf('$') !== -1) {
                        priceText = childText;
                    } else {
                        totalText = childText;
                    }
                }
                if (priceText) {
                    var lines = convertSinglePrice(priceText);
                    if (lines) {
                        var html = lines.join('<br>');
                        if (totalText) {
                            html += '<br>' + totalText;
                        }
                        el.innerHTML = html;
                    }
                }
                el.dataset.usdConverted = "1";
                return;
            }

            // item market price divs: stacked torn / usd
            if (isItemMarketPrice(el)) {
                // skip if already converted
                if (text.indexOf('§') !== -1) return;
                var lines = convertSinglePrice(text);
                if (lines) {
                    el.innerHTML = lines.join('<br>');
                    el.dataset.usdConverted = "1";
                }
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
 
})();
