// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.2.0
// @description  Converts Torn cash to real-world values everywhere. Bank page dashboard with live rates, crypto, and currency conversion.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      api.torn.com
// @connect      api.coingecko.com
// @connect      api.exchangerate-api.com
// @connect      open.er-api.com
// @connect      api.frankfurter.dev
// ==/UserScript==

/*
    Torn Real Value Converter v5.2.0
    ----------------------------------
    what this does:
    - replaces all $ on the page with a symbol you pick (default §)
    - shows converted real-world values next to every money amount
    - hover over any amount for a tooltip with multiple currencies
    - bank page gets a settings modal and a dashboard widget

    conversion modes:
    - fixed: millionaire (÷1M), billionaire (÷1B), broke (÷1T)
    - live crypto: BTC or any coin via coingecko (keyless API, no key needed)
    - live currency: pick from ~160 world currencies with flags
    - donator pack: fixed $5/23.5M or live market price via torn API
    - points: fixed $/pt or live market price via torn API
    - custom: you type your own rate

    base math: $5 USD per 23.5M Torn Money (the classic rate)

    rates update daily at 9:30 AM EST
    easter egg: stock market bell if you're on the bank page at update time

    no frameworks, no build tools. vanilla JS.
    works on tampermonkey / greasemonkey / violentmonkey.
*/

(function () {
    'use strict';

    // ======== DEFAULTS ========
    // everything the user can change. stored in tampermonkey storage.

    var DEFAULTS = {
        symbol: '\u00a7',               // what to replace $ with (section sign)
        rateMode: 'donator_fixed',       // which conversion mode
        customRate: 0.001,               // used when rateMode is 'custom'
        pointsPerDollar: 0.075,          // $1 = how many points
        donatorPackPrice: 5.00,          // what you pay for a donator pack in USD
        donatorPackCash: 23500000,       // what you get in Torn cash from a pack
        primaryCurrency: 'USD',          // main currency to show
        favoriteCurrencies: ['EUR', 'GBP'],  // extra currencies in tooltip
        cryptoId: 'bitcoin',             // which crypto (coingecko id)
        apiKey: '',                      // torn api key
        tooltipDelay: 200,               // ms before tooltip shows
        lastRateUpdate: '',              // date string of last update (YYYY-MM-DD)
        bankPanelOpen: false             // remember if panel was open
    };

    var config = {};
    for (var dk in DEFAULTS) {
        if (DEFAULTS.hasOwnProperty(dk)) config[dk] = DEFAULTS[dk];
    }

    // ======== WORLD CURRENCIES ========
    // ~160 currencies with emoji flags and symbols

    var CURRENCIES = [
        { code: 'USD', flag: '\ud83c\uddfa\ud83c\uddf8', sym: '$' },
        { code: 'EUR', flag: '\ud83c\uddea\ud83c\uddfa', sym: '\u20ac' },
        { code: 'GBP', flag: '\ud83c\uddec\ud83c\udde7', sym: '\u00a3' },
        { code: 'JPY', flag: '\ud83c\uddef\ud83c\uddf5', sym: '\u00a5' },
        { code: 'CNY', flag: '\ud83c\udde8\ud83c\uddf3', sym: '\u00a5' },
        { code: 'CAD', flag: '\ud83c\udde8\ud83c\udde6', sym: 'C$' },
        { code: 'AUD', flag: '\ud83c\udde6\ud83c\uddfa', sym: 'A$' },
        { code: 'CHF', flag: '\ud83c\udde8\ud83c\udded', sym: 'Fr' },
        { code: 'INR', flag: '\ud83c\uddee\ud83c\uddf3', sym: '\u20b9' },
        { code: 'BRL', flag: '\ud83c\udde7\ud83c\uddf7', sym: 'R$' },
        { code: 'KRW', flag: '\ud83c\uddf0\ud83c\uddf7', sym: '\u20a9' },
        { code: 'MXN', flag: '\ud83c\uddf2\ud83c\uddfd', sym: 'MX$' },
        { code: 'RUB', flag: '\ud83c\uddf7\ud83c\uddfa', sym: '\u20bd' },
        { code: 'ZAR', flag: '\ud83c\uddff\ud83c\udde6', sym: 'R' },
        { code: 'TRY', flag: '\ud83c\uddf9\ud83c\uddf7', sym: '\u20ba' },
        { code: 'SEK', flag: '\ud83c\uddf8\ud83c\uddea', sym: 'kr' },
        { code: 'NOK', flag: '\ud83c\uddf3\ud83c\uddf4', sym: 'kr' },
        { code: 'DKK', flag: '\ud83c\udde9\ud83c\uddf0', sym: 'kr' },
        { code: 'PLN', flag: '\ud83c\uddf5\ud83c\uddf1', sym: 'z\u0142' },
        { code: 'THB', flag: '\ud83c\uddf9\ud83c\udded', sym: '\u0e3f' },
        { code: 'IDR', flag: '\ud83c\uddee\ud83c\udde9', sym: 'Rp' },
        { code: 'MYR', flag: '\ud83c\uddf2\ud83c\uddfd', sym: 'RM' },
        { code: 'PHP', flag: '\ud83c\uddf5\ud83c\udded', sym: '\u20b1' },
        { code: 'SGD', flag: '\ud83c\uddf8\ud83c\uddec', sym: 'S$' },
        { code: 'NZD', flag: '\ud83c\uddf3\ud83c\uddff', sym: 'NZ$' },
        { code: 'HKD', flag: '\ud83c\udded\ud83c\uddf0', sym: 'HK$' },
        { code: 'ILS', flag: '\ud83c\uddee\ud83c\uddf1', sym: '\u20aa' },
        { code: 'EGP', flag: '\ud83c\uddea\ud83c\uddec', sym: 'E\u00a3' },
        { code: 'NGN', flag: '\ud83c\uddf3\ud83c\uddec', sym: '\u20a6' },
        { code: 'PKR', flag: '\ud83c\uddf5\ud83c\uddf0', sym: '\u20a8' },
        { code: 'BDT', flag: '\ud83c\udde7\ud83c\udde9', sym: '\u09f3' },
        { code: 'VND', flag: '\ud83c\uddfb\ud83c\uddf3', sym: '\u20ab' },
        { code: 'UAH', flag: '\ud83c\uddfa\ud83c\udde6', sym: '\u20b4' },
        { code: 'CZK', flag: '\ud83c\udde8\ud83c\uddff', sym: 'K\u010d' },
        { code: 'RON', flag: '\ud83c\uddf7\ud83c\uddf4', sym: 'lei' },
        { code: 'HUF', flag: '\ud83c\udded\ud83c\uddfa', sym: 'Ft' },
        { code: 'ARS', flag: '\ud83c\udde6\ud83c\uddf7', sym: 'AR$' },
        { code: 'COP', flag: '\ud83c\udde8\ud83c\uddf4', sym: 'CO$' },
        { code: 'PEN', flag: '\ud83c\uddf5\ud83c\uddea', sym: 'S/.' },
        { code: 'CLP', flag: '\ud83c\udde8\ud83c\uddf1', sym: 'CLP$' },
        { code: 'AED', flag: '\ud83c\udde6\ud83c\uddea', sym: '\u062f.\u0625' },
        { code: 'SAR', flag: '\ud83c\uddf8\ud83c\udde6', sym: '\ufdfc' },
        { code: 'TWD', flag: '\ud83c\uddf9\ud83c\uddfc', sym: 'NT$' },
        { code: 'BGN', flag: '\ud83c\udde7\ud83c\uddec', sym: '\u043b\u0432' },
        { code: 'HRK', flag: '\ud83c\udded\ud83c\uddf7', sym: 'kn' },
        { code: 'ISK', flag: '\ud83c\uddee\ud83c\uddf8', sym: 'kr' },
        { code: 'GEL', flag: '\ud83c\uddec\ud83c\uddea', sym: '\u20be' },
        { code: 'KZT', flag: '\ud83c\uddf0\ud83c\uddff', sym: '\u20b8' },
        { code: 'QAR', flag: '\ud83c\uddf6\ud83c\udde6', sym: '\ufdfc' },
        { code: 'KWD', flag: '\ud83c\uddf0\ud83c\uddfc', sym: '\u062f.\u0643' },
        { code: 'MAD', flag: '\ud83c\uddf2\ud83c\udde6', sym: 'MAD' },
        { code: 'JOD', flag: '\ud83c\uddef\ud83c\uddf4', sym: 'JD' },
        { code: 'BHD', flag: '\ud83c\udde7\ud83c\udded', sym: 'BD' },
        { code: 'OMR', flag: '\ud83c\uddf4\ud83c\uddf2', sym: '\ufdfc' },
        { code: 'LKR', flag: '\ud83c\uddf1\ud83c\uddf0', sym: 'Rs' },
        { code: 'MMK', flag: '\ud83c\uddf2\ud83c\uddf2', sym: 'K' },
        { code: 'KHR', flag: '\ud83c\uddf0\ud83c\udded', sym: '\u17db' },
        { code: 'MNT', flag: '\ud83c\uddf2\ud83c\uddf3', sym: '\u20ae' },
        { code: 'AFN', flag: '\ud83c\udde6\ud83c\uddeb', sym: '\u060b' },
        { code: 'ALL', flag: '\ud83c\udde6\ud83c\uddf1', sym: 'L' },
        { code: 'AMD', flag: '\ud83c\udde6\ud83c\uddf2', sym: '\u058f' },
        { code: 'ANG', flag: '\ud83c\udde8\ud83c\uddec', sym: 'NAf' },
        { code: 'AOA', flag: '\ud83c\udde6\ud83c\uddf4', sym: 'Kz' },
        { code: 'AWG', flag: '\ud83c\udde6\ud83c\uddfc', sym: 'Afl' },
        { code: 'AZN', flag: '\ud83c\udde6\ud83c\uddff', sym: '\u20bc' },
        { code: 'BAM', flag: '\ud83c\udde7\ud83c\udde6', sym: 'KM' },
        { code: 'BBD', flag: '\ud83c\udde7\ud83c\udde7', sym: 'Bds$' },
        { code: 'BIF', flag: '\ud83c\udde7\ud83c\uddee', sym: 'Fr' },
        { code: 'BMD', flag: '\ud83c\udde7\ud83c\uddf2', sym: 'BD$' },
        { code: 'BND', flag: '\ud83c\udde7\ud83c\uddf3', sym: 'B$' },
        { code: 'BOB', flag: '\ud83c\udde7\ud83c\uddf4', sym: 'Bs.' },
        { code: 'BSD', flag: '\ud83c\udde7\ud83c\uddf8', sym: 'B$' },
        { code: 'BTN', flag: '\ud83c\udde7\ud83c\uddf9', sym: 'Nu' },
        { code: 'BWP', flag: '\ud83c\udde7\ud83c\uddfc', sym: 'P' },
        { code: 'BZD', flag: '\ud83c\udde7\ud83c\uddff', sym: 'BZ$' },
        { code: 'CDF', flag: '\ud83c\udde8\ud83c\udde9', sym: 'Fr' },
        { code: 'CRC', flag: '\ud83c\udde8\ud83c\uddf7', sym: '\u20a1' },
        { code: 'CUP', flag: '\ud83c\udde8\ud83c\uddfa', sym: 'CUP$' },
        { code: 'CVE', flag: '\ud83c\udde8\ud83c\uddfb', sym: 'Esc' },
        { code: 'DJF', flag: '\ud83c\udde9\ud83c\uddef', sym: 'Fr' },
        { code: 'DOP', flag: '\ud83c\udde9\ud83c\uddf4', sym: 'RD$' },
        { code: 'DZD', flag: '\ud83c\udde9\ud83c\uddff', sym: '\u062f.\u062c' },
        { code: 'ERN', flag: '\ud83c\uddea\ud83c\uddf7', sym: 'Nfk' },
        { code: 'ETB', flag: '\ud83c\uddea\ud83c\uddf9', sym: 'Br' },
        { code: 'FJD', flag: '\ud83c\uddeb\ud83c\uddef', sym: 'FJ$' },
        { code: 'FKP', flag: '\ud83c\uddeb\ud83c\uddf0', sym: '\u00a3' },
        { code: 'GHS', flag: '\ud83c\uddec\ud83c\udded', sym: '\u20b5' },
        { code: 'GIP', flag: '\ud83c\uddec\ud83c\uddee', sym: '\u00a3' },
        { code: 'GMD', flag: '\ud83c\uddec\ud83c\uddf2', sym: 'D' },
        { code: 'GNF', flag: '\ud83c\uddec\ud83c\uddf3', sym: 'Fr' },
        { code: 'GTQ', flag: '\ud83c\uddec\ud83c\uddf9', sym: 'Q' },
        { code: 'GYD', flag: '\ud83c\uddec\ud83c\uddfd', sym: 'GY$' },
        { code: 'HNL', flag: '\ud83c\udded\ud83c\uddf3', sym: 'L' },
        { code: 'HTG', flag: '\ud83c\udded\ud83c\uddf9', sym: 'G' },
        { code: 'IRR', flag: '\ud83c\uddee\ud83c\uddf7', sym: '\ufdfc' },
        { code: 'IQD', flag: '\ud83c\uddee\ud83c\uddf6', sym: '\u0639.\u062f' },
        { code: 'JMD', flag: '\ud83c\uddef\ud83c\uddf2', sym: 'J$' },
        { code: 'KES', flag: '\ud83c\uddf0\ud83c\uddea', sym: 'KSh' },
        { code: 'KGS', flag: '\ud83c\uddf0\ud83c\uddec', sym: '\u043b\u0432' },
        { code: 'KMF', flag: '\ud83c\uddf0\ud83c\uddf2', sym: 'Fr' },
        { code: 'KYD', flag: '\ud83c\uddf0\ud83c\uddfd', sym: 'CI$' },
        { code: 'LAK', flag: '\ud83c\uddf1\ud83c\udde6', sym: '\u20ad' },
        { code: 'LBP', flag: '\ud83c\uddf1\ud83c\udde7', sym: 'L\u00a3' },
        { code: 'LRD', flag: '\ud83c\uddf1\ud83c\uddf7', sym: 'L$' },
        { code: 'LSL', flag: '\ud83c\uddf1\ud83c\uddf8', sym: 'L' },
        { code: 'LYD', flag: '\ud83c\uddf1\ud83c\uddfd', sym: 'LD' },
        { code: 'MDL', flag: '\ud83c\uddf2\ud83c\udde9', sym: 'L' },
        { code: 'MGA', flag: '\ud83c\uddf2\ud83c\uddec', sym: 'Ar' },
        { code: 'MKD', flag: '\ud83c\uddf2\ud83c\uddf0', sym: '\u0434\u0435\u043d' },
        { code: 'MOP', flag: '\ud83c\uddf2\ud83c\uddf4', sym: 'MOP$' },
        { code: 'MRU', flag: '\ud83c\uddf2\ud83c\uddf7', sym: 'UM' },
        { code: 'MUR', flag: '\ud83c\uddf2\ud83c\uddfa', sym: '\u20a8' },
        { code: 'MVR', flag: '\ud83c\uddf2\ud83c\uddfb', sym: 'Rf' },
        { code: 'MWK', flag: '\ud83c\uddf2\ud83c\uddfc', sym: 'MK' },
        { code: 'MZN', flag: '\ud83c\uddf2\ud83c\uddff', sym: 'MT' },
        { code: 'NAD', flag: '\ud83c\uddf3\ud83c\udde6', sym: 'N$' },
        { code: 'NIO', flag: '\ud83c\uddf3\ud83c\uddee', sym: 'C$' },
        { code: 'NPR', flag: '\ud83c\uddf3\ud83c\uddf5', sym: '\u20a8' },
        { code: 'PAB', flag: '\ud83c\uddf5\ud83c\udde6', sym: 'B/.' },
        { code: 'PGK', flag: '\ud83c\uddf5\ud83c\uddec', sym: 'K' },
        { code: 'PYG', flag: '\ud83c\uddf5\ud83c\uddec', sym: '\u20b2' },
        { code: 'RSD', flag: '\ud83c\uddf7\ud83c\uddf8', sym: 'din' },
        { code: 'RWF', flag: '\ud83c\uddf7\ud83c\uddfc', sym: 'Fr' },
        { code: 'SBD', flag: '\ud83c\uddf8\ud83c\udde7', sym: 'SI$' },
        { code: 'SCR', flag: '\ud83c\uddf8\ud83c\udde8', sym: '\u20a8' },
        { code: 'SDG', flag: '\ud83c\uddf8\ud83c\udde9', sym: 'SDG' },
        { code: 'SHP', flag: '\ud83c\uddf8\ud83c\udded', sym: '\u00a3' },
        { code: 'SLE', flag: '\ud83c\uddf8\ud83c\uddf1', sym: 'Le' },
        { code: 'SOS', flag: '\ud83c\uddf8\ud83c\uddf4', sym: 'Sh' },
        { code: 'SRD', flag: '\ud83c\uddf8\ud83c\uddf3', sym: 'SRD$' },
        { code: 'SSP', flag: '\ud83c\uddf8\ud83c\uddf8', sym: '\u00a3' },
        { code: 'STN', flag: '\ud83c\uddf8\ud83c\uddf9', sym: 'Db' },
        { code: 'SVC', flag: '\ud83c\uddf8\ud83c\uddfb', sym: '\u20a1' },
        { code: 'SYP', flag: '\ud83c\uddf8\ud83c\uddfd', sym: '\u00a3' },
        { code: 'SZL', flag: '\ud83c\uddf8\ud83c\uddff', sym: 'L' },
        { code: 'TJS', flag: '\ud83c\uddf9\ud83c\uddef', sym: 'SM' },
        { code: 'TMT', flag: '\ud83c\uddf9\ud83c\uddf2', sym: 'T' },
        { code: 'TND', flag: '\ud83c\uddf9\ud83c\uddf3', sym: 'DT' },
        { code: 'TOP', flag: '\ud83c\uddf9\ud83c\uddf4', sym: 'T$' },
        { code: 'TTD', flag: '\ud83c\uddf9\ud83c\uddf9', sym: 'TT$' },
        { code: 'TZS', flag: '\ud83c\uddf9\ud83c\uddff', sym: 'TSh' },
        { code: 'UGX', flag: '\ud83c\uddfa\ud83c\uddec', sym: 'USh' },
        { code: 'UYU', flag: '\ud83c\uddfa\ud83c\uddfd', sym: '$U' },
        { code: 'UZS', flag: '\ud83c\uddfa\ud83c\uddff', sym: '\u043b\u0432' },
        { code: 'VED', flag: '\ud83c\uddfb\ud83c\uddea', sym: 'Bs.D' },
        { code: 'VES', flag: '\ud83c\uddfb\ud83c\uddea', sym: 'Bs.S' },
        { code: 'VUV', flag: '\ud83c\uddfb\ud83c\uddfa', sym: 'VT' },
        { code: 'WST', flag: '\ud83c\uddfc\ud83c\uddf8', sym: 'T' },
        { code: 'XAF', flag: '', sym: 'Fr' },
        { code: 'XCD', flag: '', sym: 'EC$' },
        { code: 'XOF', flag: '', sym: 'Fr' },
        { code: 'XPF', flag: '', sym: 'Fr' },
        { code: 'YER', flag: '\ud83c\uddfd\ud83c\uddea', sym: '\ufdfc' },
        { code: 'ZMW', flag: '\ud83c\uddff\ud83c\uddf2', sym: 'ZK' },
        { code: 'ZWL', flag: '\ud83c\uddff\ud83c\uddfc', sym: 'Z$' }
    ];

    function findCurrency(code) {
        for (var i = 0; i < CURRENCIES.length; i++) {
            if (CURRENCIES[i].code === code) return CURRENCIES[i];
        }
        return null;
    }

    function getSym(code) {
        var c = findCurrency(code);
        return c ? c.sym : code;
    }

    // ======== CRYPTO LIST ========
    // supported cryptocurrencies (coingecko ids)
    // uses coingecko's keyless public API — no api key needed
    // docs: https://docs.coingecko.com/docs/keyless-public-api

    var CRYPTOS = [
        { id: 'bitcoin', name: 'Bitcoin', sym: 'BTC' },
        { id: 'ethereum', name: 'Ethereum', sym: 'ETH' },
        { id: 'solana', name: 'Solana', sym: 'SOL' },
        { id: 'binancecoin', name: 'BNB', sym: 'BNB' },
        { id: 'ripple', name: 'XRP', sym: 'XRP' },
        { id: 'cardano', name: 'Cardano', sym: 'ADA' },
        { id: 'dogecoin', name: 'Dogecoin', sym: 'DOGE' },
        { id: 'polkadot', name: 'Polkadot', sym: 'DOT' },
        { id: 'avalanche-2', name: 'Avalanche', sym: 'AVAX' },
        { id: 'chainlink', name: 'Chainlink', sym: 'LINK' },
        { id: 'litecoin', name: 'Litecoin', sym: 'LTC' },
        { id: 'matic-network', name: 'Polygon', sym: 'MATIC' },
        { id: 'uniswap', name: 'Uniswap', sym: 'UNI' },
        { id: 'stellar', name: 'Stellar', sym: 'XLM' },
        { id: 'cosmos', name: 'Cosmos', sym: 'ATOM' },
        { id: 'near', name: 'NEAR', sym: 'NEAR' },
        { id: 'aptos', name: 'Aptos', sym: 'APT' },
        { id: 'sui', name: 'Sui', sym: 'SUI' }
    ];

    function findCrypto(id) {
        for (var i = 0; i < CRYPTOS.length; i++) {
            if (CRYPTOS[i].id === id) return CRYPTOS[i];
        }
        return null;
    }

    // ======== RATE STORAGE ========

    var rates = {
        pointsMarketCost: null,
        donatorPackMarketCost: null,
        cryptoPriceUSD: null,
        currencies: null,
        stocks: null,
        lastUpdate: 0
    };

    // ======== HTTP ========

    function xhrGet(url) {
        var r = new XMLHttpRequest();
        r.open('GET', url, false);
        r.send();
        if (r.status !== 200) throw new Error('HTTP ' + r.status);
        return JSON.parse(r.responseText);
    }

    // ======== FETCH RATES ========
    // currency: frankfurter (free, no key) → open.er-api (free, no key)
    // crypto: coingecko keyless public api (free, no key)
    // torn: needs your own api key

    function fetchAllRates() {
        var errors = [];

        // --- currency exchange rates ---
        var ratesFetched = false;
        try {
            var d = xhrGet('https://api.frankfurter.dev/v1/latest?from=USD');
            rates.currencies = d.rates;
            ratesFetched = true;
        } catch (e1) { /* fall through */ }
        if (!ratesFetched) {
            try {
                d = xhrGet('https://open.er-api.com/v6/latest/USD');
                rates.currencies = d.rates;
            } catch (e2) {
                errors.push('Currency: ' + e2.message);
            }
        }

        // --- torn API stuff ---
        if (config.apiKey) {
            if (config.rateMode === 'points_live') {
                try {
                    d = xhrGet('https://api.torn.com/market/?selections=pointsmarket&key=' + config.apiKey);
                    if (d.error) throw new Error(d.error.error);
                    if (d.pointsmarket && d.pointsmarket.length) {
                        var low = d.pointsmarket[0];
                        for (var i = 1; i < d.pointsmarket.length; i++) {
                            if (d.pointsmarket[i].cost < low.cost) low = d.pointsmarket[i];
                        }
                        rates.pointsMarketCost = low.cost;
                    }
                } catch (e) { errors.push('Points: ' + e.message); }
            }

            if (config.rateMode === 'donator_live') {
                try {
                    d = xhrGet('https://api.torn.com/market/?selections=itemmarket&key=' + config.apiKey);
                    if (d.error) throw new Error(d.error.error);
                    var im = d.itemmarket;
                    if (im) {
                        var dp = im[283] || im['283'];
                        if (dp) rates.donatorPackMarketCost = dp.cost || dp.price;
                    }
                } catch (e) { errors.push('Donator: ' + e.message); }
            }

            try {
                d = xhrGet('https://api.torn.com/user/?selections=stocks&key=' + config.apiKey);
                if (!d.error) rates.stocks = d.stocks;
            } catch (e) { /* stocks are optional */ }

        } else if (config.rateMode === 'points_live' || config.rateMode === 'donator_live') {
            errors.push('Need Torn API key');
        }

        // --- crypto price via coingecko keyless API ---
        // no api key needed — this is the free public endpoint
        if (config.rateMode === 'crypto') {
            try {
                d = xhrGet('https://api.coingecko.com/api/v3/simple/price?ids=' + config.cryptoId + '&vs_currencies=usd');
                rates.cryptoPriceUSD = d[config.cryptoId].usd;
            } catch (e) { errors.push('Crypto: ' + e.message); }
        }

        rates.lastUpdate = Date.now();
        return errors;
    }

    // ======== CONVERSION ENGINE ========
    // base rate: $5 USD per 23.5M Torn Money = ~2.128e-7 USD per Torn $

    var BASE_RATE = 5 / 23500000;

    function getRate() {
        switch (config.rateMode) {
            case 'millionaire':
            case 'billionaire':
            case 'broke':
                return BASE_RATE;
            case 'donator_fixed':
                // pack price is always in USD, cash is always in Torn $
                return config.donatorPackPrice / config.donatorPackCash;
            case 'donator_live':
                var mpc = rates.donatorPackMarketCost;
                return mpc ? config.donatorPackPrice / mpc : (config.donatorPackPrice / config.donatorPackCash);
            case 'points_fixed':
                var ppt = rates.pointsMarketCost || 1000000;
                return config.pointsPerDollar / ppt;
            case 'points_live':
                var lpt = rates.pointsMarketCost;
                return lpt ? (1 / lpt) : (config.pointsPerDollar / 1000000);
            case 'crypto':
                // crypto price is in USD per 1 coin
                // we want: (USD per Torn $) / (USD per coin) = coins per Torn $
                // then multiply by torn amount to get coin amount
                // but we still display in primary currency, so:
                // torn$ * BASE_RATE = USD, then USD / cryptoPrice = coins
                // actually for display we just need USD per Torn $, same as base
                // the "crypto" aspect is that we're pegging to crypto value
                // so: 1 Torn $ = BASE_RATE / cryptoPriceUSD coins
                // and we display that coin amount converted to primary currency
                // simplest: just use BASE_RATE (the USD value), display converts it
                return BASE_RATE;
            case 'custom':
                return config.customRate;
            default:
                return BASE_RATE;
        }
    }

    // get the display divisor for fixed modes
    function getFixedDivisor() {
        switch (config.rateMode) {
            case 'millionaire': return 1e6;
            case 'billionaire': return 1e9;
            case 'broke': return 1e12;
            default: return 1;
        }
    }

    function isFixedMode() {
        return config.rateMode === 'millionaire' ||
               config.rateMode === 'billionaire' ||
               config.rateMode === 'broke';
    }

    // get the effective $/point rate for display
    function getPointsRate() {
        if (config.rateMode === 'points_live' && rates.pointsMarketCost) {
            return (1 / rates.pointsMarketCost).toFixed(6);
        }
        return config.pointsPerDollar.toFixed(3);
    }

    function isPointsLive() {
        return config.rateMode === 'points_live';
    }

    // convert USD to another currency
    function usdToCurr(usd, code) {
        if (code === 'USD') return usd;
        if (!rates.currencies) return null;
        var r = rates.currencies[code];
        return r ? usd * r : null;
    }

    // format a number with K/M/B/T suffix
    function fmt(val, sym) {
        if (val == null) return '\u2014';
        var neg = val < 0;
        var a = Math.abs(val);
        var s = neg ? '-' : '';
        if (a >= 1e12) return s + sym + (val / 1e12).toFixed(2) + 'T';
        if (a >= 1e9) return s + sym + (val / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return s + sym + (val / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return s + sym + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (a >= 1) return s + sym + val.toFixed(2);
        return s + sym + val.toFixed(4);
    }

    // ======== SYMBOL REPLACEMENT ========
    // swap $ with user's chosen symbol so we can find torn money
    // without confusing it with our own conversion text

    function replaceSymbols() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var tn;
        while ((tn = walker.nextNode())) {
            replaceSymbolsInNode(tn);
        }
    }

    function replaceSymbolsInNode(node) {
        if (!node || node.nodeType !== 3) return;
        if (node.textContent.indexOf('$') === -1) return;
        if (!/\$\d/.test(node.textContent)) return;
        var p = node.parentElement;
        if (!p) return;
        if (isInsideOurStuff(p)) return;
        p.setAttribute('tt-done', '1');
        node.textContent = node.textContent.replace(/\$/g, config.symbol);
    }

    function isInsideOurStuff(el) {
        var cur = el;
        while (cur) {
            if (cur.className && typeof cur.className === 'string') {
                if (cur.className.indexOf('tt-tip') !== -1 ||
                    cur.className.indexOf('tt-panel') !== -1 ||
                    cur.className.indexOf('tt-dash') !== -1 ||
                    cur.className.indexOf('tt-conv') !== -1 ||
                    cur.className.indexOf('tt-modal') !== -1 ||
                    cur.className.indexOf('tt-btn') !== -1) {
                    return true;
                }
            }
            if (cur.tagName === 'SCRIPT' || cur.tagName === 'STYLE') return true;
            cur = cur.parentElement;
        }
        return false;
    }

    // ======== DOM PROCESSING ========

    function processInlineNode(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.hasAttribute('tt-done')) return;
        if (isInsideOurStuff(el)) return;
        if (!el.textContent || el.textContent.indexOf(config.symbol) === -1) return;
        if (!new RegExp(config.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d').test(el.textContent)) return;

        el.setAttribute('tt-done', '1');

        var rate = getRate();
        var sym = getSym(config.primaryCurrency);
        var children = el.childNodes;
        var symEsc = config.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var moneyRe = new RegExp(symEsc + '([\\d,]+(?:\\.\\d+)?[KMBkmb]?)', 'g');

        for (var c = 0; c < children.length; c++) {
            var child = children[c];
            if (child.nodeType !== 3) continue;
            if (child.textContent.indexOf(config.symbol) === -1) continue;

            var text = child.textContent;
            var match, lastIdx = 0;
            var frag = document.createDocumentFragment();
            var found = false;

            while ((match = moneyRe.exec(text)) !== null) {
                found = true;
                if (match.index > lastIdx) {
                    frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
                }
                var origSpan = document.createElement('span');
                origSpan.textContent = config.symbol + match[1];
                frag.appendChild(origSpan);
                var tornAmt = parseMoney(config.symbol + match[1]);
                if (tornAmt !== null) {
                    var usdVal = tornAmt * rate;
                    var convVal = usdToCurr(usdVal, config.primaryCurrency);
                    var cSpan = document.createElement('span');
                    cSpan.className = 'tt-conv';
                    cSpan.textContent = ' (' + fmt(convVal, sym) + ')';
                    frag.appendChild(cSpan);
                }
                lastIdx = moneyRe.lastIndex;
            }

            if (found) {
                if (lastIdx < text.length) {
                    frag.appendChild(document.createTextNode(text.slice(lastIdx)));
                }
                child.parentNode.replaceChild(frag, child);
            }
        }
    }

    function parseMoney(text) {
        var s = text.replace(/[,$§]/g, '').replace(new RegExp(config.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        var mult = 1;
        if (/[Kk]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
        else if (/[Mm]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
        else if (/[Bb]$/.test(s)) { mult = 1e9; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isNaN(n) ? null : n * mult;
    }

    // ======== MUTATION OBSERVER ========

    var _ttObserver = null;
    var _ttDebounce = null;

    function startObserver() {
        if (_ttObserver) return;

        _ttObserver = new MutationObserver(function (muts) {
            var elements = [];
            var textNodes = [];

            for (var i = 0; i < muts.length; i++) {
                for (var j = 0; j < muts[i].addedNodes.length; j++) {
                    var nd = muts[i].addedNodes[j];
                    if (nd.nodeType === 3) {
                        if (nd.textContent.indexOf('$') !== -1 && /\$\d/.test(nd.textContent)) {
                            textNodes.push(nd);
                        }
                    } else if (nd.nodeType === 1) {
                        if (!nd.hasAttribute('tt-done') && !isInsideOurStuff(nd)) {
                            elements.push(nd);
                        }
                    }
                }
            }

            if (textNodes.length === 0 && elements.length === 0) return;

            clearTimeout(_ttDebounce);
            _ttDebounce = setTimeout(function () {
                for (var t = 0; t < textNodes.length; t++) {
                    if (textNodes[t].parentNode) replaceSymbolsInNode(textNodes[t]);
                }
                for (var e = 0; e < elements.length; e++) {
                    if (!elements[e].parentNode) continue;
                    var walker = document.createTreeWalker(elements[e], NodeFilter.SHOW_TEXT, null);
                    var tn;
                    while ((tn = walker.nextNode())) replaceSymbolsInNode(tn);
                }
                for (var e2 = 0; e2 < elements.length; e2++) {
                    if (elements[e2].parentNode) processInlineNode(elements[e2]);
                }
            }, 200);
        });

        _ttObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ======== TOOLTIP ========

    var tip = null;
    var tipTimer = null;

    function ensureTip() {
        if (tip) return;
        tip = document.createElement('div');
        tip.className = 'tt-tip';
        document.body.appendChild(tip);
    }

    var MONEY_RE = /[\u00a7$][\d,]+(?:\.\d+)?[KMBkmb]?/;

    function buildTip(origText, usdValue) {
        var sym = getSym(config.primaryCurrency);
        var pv = usdToCurr(usdValue, config.primaryCurrency);
        var html = '<div class="tt-orig">Torn: <b>' + origText + '</b></div><div class="tt-hr"></div>';
        html += '<div class="tt-row tt-pri"><span class="tt-cc">' + config.primaryCurrency + '</span>';
        html += '<span class="tt-cv">' + fmt(pv, sym) + '</span></div>';
        for (var i = 0; i < config.favoriteCurrencies.length; i++) {
            var fav = config.favoriteCurrencies[i];
            if (fav === config.primaryCurrency) continue;
            var fs = getSym(fav);
            var fv = usdToCurr(usdValue, fav);
            html += '<div class="tt-row"><span class="tt-cc">' + fav + '</span>';
            html += '<span class="tt-cv">' + fmt(fv, fs) + '</span></div>';
        }
        var modeNames = {
            millionaire: 'Millionaire (\u00f71M)',
            billionaire: 'Billionaire (\u00f71B)',
            broke: 'Broke (\u00f71T)',
            donator_fixed: 'Donator $5/23.5M',
            donator_live: 'Donator live market',
            points_fixed: 'Points (fixed)',
            points_live: 'Points live market',
            crypto: 'Crypto',
            custom: 'Custom'
        };
        var modeName = modeNames[config.rateMode] || config.rateMode;
        html += '<div class="tt-foot">' + modeName + ' \u00b7 ' + new Date().toLocaleTimeString() + '</div>';
        return html;
    }

    function posTip(x, y) {
        if (!tip) return;
        var pad = 12, r = tip.getBoundingClientRect();
        var l = x + pad, t = y + pad;
        if (l + r.width > window.innerWidth) l = x - r.width - pad;
        if (t + r.height > window.innerHeight) t = y - r.height - pad;
        tip.style.left = l + 'px';
        tip.style.top = t + 'px';
    }

    function findMoney(el) {
        if (!el || el.nodeType !== 1) return null;
        if (isInsideOurStuff(el)) return null;
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        var tn;
        while ((tn = walker.nextNode())) {
            var p = tn.parentElement;
            if (!p) continue;
            if (isInsideOurStuff(p)) continue;
            var m = tn.textContent.match(MONEY_RE);
            if (m) return { text: m[0] };
        }
        return null;
    }

    function attachHover() {
        var _tipOwner = null;
        var _tipShown = false;

        document.addEventListener('mouseover', function (e) {
            var target = e.target;
            if (!target || target.nodeType !== 1) return;
            if (isInsideOurStuff(target)) return;

            if (_tipShown && _tipOwner === target) return;

            var found = findMoney(target);
            if (!found) {
                if (_tipShown) {
                    clearTimeout(tipTimer);
                    _tipOwner = null;
                    _tipShown = false;
                    if (tip) tip.classList.remove('tt-vis');
                }
                return;
            }

            var amt = parseMoney(found.text);
            if (amt === null) return;

            if (_tipShown && _tipOwner !== target) {
                tip.classList.remove('tt-vis');
                clearTimeout(tipTimer);
            }

            _tipOwner = target;
            _tipShown = false;

            clearTimeout(tipTimer);
            tipTimer = setTimeout(function () {
                if (_tipOwner !== target) return;
                ensureTip();
                var usd = amt * getRate();
                tip.innerHTML = buildTip(found.text, usd);
                tip.classList.add('tt-vis');
                _tipShown = true;
                posTip(e.clientX, e.clientY);
            }, config.tooltipDelay);
        });

        document.addEventListener('mousemove', function (e) {
            if (_tipShown && tip && tip.classList.contains('tt-vis')) {
                posTip(e.clientX, e.clientY);
            }
        });

        document.addEventListener('mouseout', function (e) {
            if (e.relatedTarget && isInsideOurStuff(e.relatedTarget)) return;
            clearTimeout(tipTimer);
            _tipOwner = null;
            _tipShown = false;
            if (tip) tip.classList.remove('tt-vis');
        });

        window.addEventListener('scroll', function () {
            clearTimeout(tipTimer);
            _tipOwner = null;
            _tipShown = false;
            if (tip) tip.classList.remove('tt-vis');
        }, { passive: true });
    }

    // ======== CSS ========

    GM_addStyle(
        '.tt-tip{display:none;position:fixed;z-index:999999;background:#444;color:#ddd;font:12px Arial;padding:8px 10px;border-radius:4px;box-shadow:0 0 2px rgba(0,0,0,.65);pointer-events:none;min-width:170px;text-align:left}' +
        '.tt-tip.tt-vis{display:block}' +
        '.tt-tip .tt-orig{color:#aaa;font-size:11px;margin-bottom:4px}' +
        '.tt-tip .tt-hr{border:none;border-top:1px solid #555;margin:5px 0}' +
        '.tt-tip .tt-row{display:flex;justify-content:space-between;gap:12px}' +
        '.tt-tip .tt-cc{color:#999}' +
        '.tt-tip .tt-cv{color:#ddd}' +
        '.tt-tip .tt-pri .tt-cv{color:#fff;font-weight:700}' +
        '.tt-tip .tt-foot{color:#777;font-size:10px;margin-top:5px;padding-top:5px;border-top:1px solid #555}' +
        '.tt-conv{color:#888!important;font-size:.8em!important;margin-left:4px!important;white-space:nowrap!important}' +
        '.tt-panel{margin:0 0 10px}' +
        '.tt-panel .tt-phdr{background:linear-gradient(180deg,#3a3a3a,#1a1a1a);color:#ddd;font-size:12px;font-weight:700;padding:6px 12px;border-radius:5px 5px 0 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center}' +
        '.tt-panel .tt-phdr:hover{background:linear-gradient(180deg,#4a4a4a,#2a2a2a)}' +
        '.tt-panel .tt-pbody{background:#222;border:1px solid #333;border-top:none;border-radius:0 0 5px 5px;padding:10px 12px;display:none}' +
        '.tt-panel .tt-pbody.tt-open{display:block}' +
        '.tt-panel .tt-f{margin-bottom:10px}' +
        '.tt-panel .tt-f label{display:block;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:3px}' +
        '.tt-panel .tt-f select,.tt-panel .tt-f input[type=text],.tt-panel .tt-f input[type=number]{width:100%;padding:4px 8px;background:#111;border:1px solid #333;border-radius:3px;color:#ccc;font-size:12px;box-sizing:border-box}' +
        '.tt-panel .tt-f select:focus,.tt-panel .tt-f input:focus{outline:none;border-color:#555}' +
        '.tt-panel .tt-hint{font-size:10px;color:#555;margin-top:2px}' +
        '.tt-panel .tt-chips{display:flex;flex-wrap:wrap;gap:3px;max-height:90px;overflow-y:auto;padding:4px;background:#111;border:1px solid #333;border-radius:3px}' +
        '.tt-panel .tt-chip{padding:2px 7px;border-radius:3px;font-size:10px;cursor:pointer;border:1px solid #333;background:#1a1a1a;color:#777;user-select:none}' +
        '.tt-panel .tt-chip:hover{border-color:#555}' +
        '.tt-panel .tt-chip.tt-on{background:#2a2a2a;border-color:#666;color:#ccc}' +
        '.tt-panel .tt-st{margin-top:8px;padding:4px 8px;background:#111;border-radius:3px;font-size:10px;color:#555}' +
        '.tt-panel .tt-st.tt-ok{color:#6a6}.tt-panel .tt-st.tt-err{color:#c66}.tt-panel .tt-st.tt-warn{color:#ca0}' +
        '.tt-panel .tt-btn{margin-top:8px;width:100%;padding:5px;background:#2a2a2a;color:#aaa;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:11px}' +
        '.tt-panel .tt-btn:hover{background:#333;color:#ccc}' +
        '.tt-dash{background:#1a1a1a;border:1px solid #333;border-radius:5px;padding:10px 12px;margin:10px 0}' +
        '.tt-dash .tt-dbig{font-size:28px;font-weight:700;color:#ddd;line-height:1.2}' +
        '.tt-dash .tt-dbig .tt-dsym{font-size:20px;color:#888}' +
        '.tt-dash .tt-dsub{font-size:11px;color:#666;margin-top:2px}' +
        '.tt-dash .tt-dhr{border:none;border-top:1px solid #333;margin:8px 0}' +
        '.tt-dash .tt-drow{display:flex;justify-content:space-between;font-size:11px;padding:2px 0}' +
        '.tt-dash .tt-dcode{color:#777}.tt-dash .tt-dval{color:#bbb}' +
        '.tt-dash .tt-dinv{font-size:11px;color:#888;margin-top:6px}' +
        '.tt-dash .tt-dinvv{color:#bbb;font-weight:700}' +
        '.tt-dash .tt-dstocks{margin-top:6px;font-size:10px;color:#555;max-height:60px;overflow:hidden}' +
        '.tt-dash .tt-dstock{display:flex;justify-content:space-between;padding:1px 0}' +
        '.tt-dash .tt-dup{color:#6a6}.tt-dash .tt-ddn{color:#c66}' +
        '.tt-modal-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:999998;justify-content:center;align-items:center}' +
        '.tt-modal-overlay.tt-show{display:flex}' +
        '.tt-modal{background:#222;border:1px solid #444;border-radius:8px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto}' +
        '.tt-modal h3{color:#ddd;font-size:16px;margin:0 0 12px}' +
        '.tt-modal .tt-close{float:right;color:#666;cursor:pointer;font-size:18px}' +
        '.tt-modal .tt-close:hover{color:#aaa}' +
        '.tt-modal .tt-f{margin-bottom:12px}' +
        '.tt-modal .tt-f label{display:block;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:4px}' +
        '.tt-modal .tt-f select,.tt-modal .tt-f input[type=text],.tt-modal .tt-f input[type=number]{width:100%;padding:6px 10px;background:#111;border:1px solid #333;border-radius:3px;color:#ccc;font-size:13px;box-sizing:border-box}' +
        '.tt-modal .tt-f select:focus,.tt-modal .tt-f input:focus{outline:none;border-color:#555}' +
        '.tt-modal .tt-hint{font-size:10px;color:#555;margin-top:3px}' +
        '.tt-modal .tt-chips{display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;padding:6px;background:#111;border:1px solid #333;border-radius:3px}' +
        '.tt-modal .tt-chip{padding:3px 8px;border-radius:3px;font-size:11px;cursor:pointer;border:1px solid #333;background:#1a1a1a;color:#777;user-select:none}' +
        '.tt-modal .tt-chip:hover{border-color:#555}' +
        '.tt-modal .tt-chip.tt-on{background:#2a2a2a;border-color:#666;color:#ccc}' +
        '.tt-modal .tt-btn{margin-top:12px;width:100%;padding:8px;background:#2a2a2a;color:#aaa;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:13px}' +
        '.tt-modal .tt-btn:hover{background:#333;color:#ccc}' +
        '.tt-modal .tt-st{margin-top:8px;padding:6px 10px;background:#111;border-radius:3px;font-size:11px;color:#555}' +
        '.tt-modal .tt-st.tt-ok{color:#6a6}.tt-modal .tt-st.tt-err{color:#c66}.tt-modal .tt-st.tt-warn{color:#ca0}'
    );

    // ======== PAGE DETECTION ========

    function isBank() {
        return window.location.pathname.indexOf('bank.php') !== -1;
    }

    function isStocks() {
        return window.location.pathname.indexOf('page.php') !== -1 &&
               window.location.search.indexOf('sid=stocks') !== -1;
    }

    // ======== BANK PAGE: FLOATING BUTTON + DASHBOARD ========

    function injectBankUI() {
        if (!isBank()) return;
        var wrap = document.querySelector('.content-wrapper');
        if (!wrap) { setTimeout(injectBankUI, 1000); return; }

        if (!document.getElementById('tt-settings-btn')) {
            var btn = document.createElement('button');
            btn.id = 'tt-settings-btn';
            btn.textContent = '\ud83d\udcb5 TRv5 Settings';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999997;padding:8px 16px;background:#2a2a2a;color:#aaa;border:1px solid #444;border-radius:5px;cursor:pointer;font-size:12px;font-family:Arial;';
            btn.addEventListener('click', openSettingsModal);
            document.body.appendChild(btn);
        }

        injectDash();
    }

    // ======== STOCK PAGE: SETTINGS + DASHBOARD ========

    function injectStockUI() {
        if (!isStocks()) return;
        var wrap = document.querySelector('.content-wrapper');
        if (!wrap) { setTimeout(injectStockUI, 1000); return; }

        if (!document.getElementById('tt-stock-settings')) {
            var container = document.createElement('div');
            container.id = 'tt-stock-settings';
            container.style.cssText = 'text-align:center;padding:20px 0;margin-top:20px;border-top:1px solid #333';

            var btn = document.createElement('button');
            btn.textContent = '\u2699 Real Value Settings';
            btn.style.cssText = 'padding:8px 16px;background:#2a2a2a;color:#aaa;border:1px solid #444;border-radius:5px;cursor:pointer;font-size:12px;font-family:Arial;';
            btn.addEventListener('click', openSettingsModal);
            container.appendChild(btn);

            var st = document.createElement('div');
            st.id = 'tt-stock-st';
            st.style.cssText = 'margin-top:8px;font-size:11px;color:#555';
            st.textContent = 'Loading...';
            container.appendChild(st);

            wrap.appendChild(container);
        }

        injectStockDash();
    }

    function injectStockDash() {
        if (!isStocks()) return;
        var wrap = document.querySelector('.content-wrapper');
        if (!wrap) return;
        if (document.getElementById('tt-stock-dash')) return;

        var dash = document.createElement('div');
        dash.id = 'tt-stock-dash';
        dash.className = 'tt-dash';
        updateDash(dash);

        var settingsEl = document.getElementById('tt-stock-settings');
        if (settingsEl && settingsEl.parentNode) {
            settingsEl.parentNode.insertBefore(dash, settingsEl);
        } else {
            wrap.appendChild(dash);
        }
    }

    // ======== SETTINGS MODAL ========

    function openSettingsModal() {
        if (document.getElementById('tt-modal-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'tt-modal-overlay';
        overlay.className = 'tt-modal-overlay tt-show';

        var modal = document.createElement('div');
        modal.className = 'tt-modal';

        // currency country names for the dropdown
        var currNames = {
            'USD': 'US Dollar', 'EUR': 'Euro', 'GBP': 'British Pound',
            'JPY': 'Japanese Yen', 'CNY': 'Chinese Yuan', 'CAD': 'Canadian Dollar',
            'AUD': 'Australian Dollar', 'CHF': 'Swiss Franc', 'INR': 'Indian Rupee',
            'BRL': 'Brazilian Real', 'KRW': 'South Korean Won', 'MXN': 'Mexican Peso',
            'RUB': 'Russian Ruble', 'ZAR': 'South African Rand', 'TRY': 'Turkish Lira',
            'SEK': 'Swedish Krona', 'NOK': 'Norwegian Krone', 'DKK': 'Danish Krone',
            'PLN': 'Polish Zloty', 'THB': 'Thai Baht', 'IDR': 'Indonesian Rupiah',
            'MYR': 'Malaysian Ringgit', 'PHP': 'Philippine Peso', 'SGD': 'Singapore Dollar',
            'NZD': 'New Zealand Dollar', 'HKD': 'Hong Kong Dollar', 'ILS': 'Israeli Shekel',
            'EGP': 'Egyptian Pound', 'NGN': 'Nigerian Naira', 'PKR': 'Pakistani Rupee',
            'BDT': 'Bangladeshi Taka', 'VND': 'Vietnamese Dong', 'UAH': 'Ukrainian Hryvnia',
            'CZK': 'Czech Koruna', 'RON': 'Romanian Leu', 'HUF': 'Hungarian Forint',
            'ARS': 'Argentine Peso', 'COP': 'Colombian Peso', 'PEN': 'Peruvian Sol',
            'CLP': 'Chilean Peso', 'AED': 'UAE Dirham', 'SAR': 'Saudi Riyal',
            'TWD': 'Taiwan Dollar', 'BGN': 'Bulgarian Lev', 'HRK': 'Croatian Kuna',
            'ISK': 'Icelandic Krona', 'GEL': 'Georgian Lari', 'KZT': 'Kazakhstani Tenge',
            'QAR': 'Qatari Riyal', 'KWD': 'Kuwaiti Dinar', 'MAD': 'Moroccan Dirham',
            'JOD': 'Jordanian Dinar', 'BHD': 'Bahraini Dinar', 'OMR': 'Omani Rial',
            'LKR': 'Sri Lankan Rupee', 'MMK': 'Myanmar Kyat', 'KHR': 'Cambodian Riel',
            'MNT': 'Mongolian Tugrik', 'AFN': 'Afghan Afghani', 'ALL': 'Albanian Lek',
            'AMD': 'Armenian Dram', 'ANG': 'Netherlands Antillean Guilder', 'AOA': 'Angolan Kwanza',
            'AWG': 'Aruban Florin', 'AZN': 'Azerbaijani Manat', 'BAM': 'Bosnia Herzegovina Mark',
            'BBD': 'Barbadian Dollar', 'BIF': 'Burundian Franc', 'BMD': 'Bermudian Dollar',
            'BND': 'Brunei Dollar', 'BOB': 'Bolivian Boliviano', 'BSD': 'Bahamian Dollar',
            'BTN': 'Bhutanese Ngultrum', 'BWP': 'Botswana Pula', 'BZD': 'Belize Dollar',
            'CDF': 'Congolese Franc', 'CRC': 'Costa Rican Colon', 'CUP': 'Cuban Peso',
            'CVE': 'Cape Verdean Escudo', 'DJF': 'Djiboutian Franc', 'DOP': 'Dominican Peso',
            'DZD': 'Algerian Dinar', 'ERN': 'Eritrean Nakfa', 'ETB': 'Ethiopian Birr',
            'FJD': 'Fijian Dollar', 'FKP': 'Falkland Islands Pound', 'GHS': 'Ghanaian Cedi',
            'GIP': 'Gibraltar Pound', 'GMD': 'Gambian Dalasi', 'GNF': 'Guinean Franc',
            'GTQ': 'Guatemalan Quetzal', 'GYD': 'Guyanaese Dollar', 'HNL': 'Honduran Lempira',
            'HTG': 'Haitian Gourde', 'IRR': 'Iranian Rial', 'IQD': 'Iraqi Dinar',
            'JMD': 'Jamaican Dollar', 'KES': 'Kenyan Shilling', 'KGS': 'Kyrgyzstani Som',
            'KMF': 'Comorian Franc', 'KYD': 'Cayman Islands Dollar', 'LAK': 'Lao Kip',
            'LBP': 'Lebanese Pound', 'LRD': 'Liberian Dollar', 'LSL': 'Lesotho Loti',
            'LYD': 'Libyan Dinar', 'MDL': 'Moldovan Leu', 'MGA': 'Malagasy Ariary',
            'MKD': 'Macedonian Denar', 'MOP': 'Macanese Pataca', 'MRU': 'Mauritanian Ouguiya',
            'MUR': 'Mauritian Rupee', 'MVR': 'Maldivian Rufiyaa', 'MWK': 'Malawian Kwacha',
            'MZN': 'Mozambique Metical', 'NAD': 'Namibian Dollar', 'NIO': 'Nicaraguan Cordoba',
            'NPR': 'Nepalese Rupee', 'PAB': 'Panamanian Balboa', 'PGK': 'Papua New Guinean Kina',
            'PYG': 'Paraguayan Guarani', 'RSD': 'Serbian Dinar', 'RWF': 'Rwandan Franc',
            'SBD': 'Solomon Islands Dollar', 'SCR': 'Seychellois Rupee', 'SDG': 'Sudanese Pound',
            'SHP': 'Saint Helena Pound', 'SLE': 'Sierra Leonean Leone', 'SOS': 'Somali Shilling',
            'SRD': 'Surinamese Dollar', 'SSP': 'South Sudanese Pound', 'STN': 'Sao Tome Dobra',
            'SVC': 'Salvadoran Colon', 'SYP': 'Syrian Pound', 'SZL': 'Swazi Lilangeni',
            'TJS': 'Tajikistani Somoni', 'TMT': 'Turkmenistan Manat', 'TND': 'Tunisian Dinar',
            'TOP': 'Tongan Paanga', 'TTD': 'Trinidad Tobago Dollar', 'TZS': 'Tanzanian Shilling',
            'UGX': 'Ugandan Shilling', 'UYU': 'Uruguayan Peso', 'UZS': 'Uzbekistan Som',
            'VED': 'Venezuelan Bolivar', 'VES': 'Venezuelan Bolivar Soberano', 'VUV': 'Vanuatu Vatu',
            'WST': 'Samoan Tala', 'XAF': 'Central African CFA Franc', 'XCD': 'East Caribbean Dollar',
            'XOF': 'West African CFA Franc', 'XPF': 'CFP Franc', 'YER': 'Yemeni Rial',
            'ZMW': 'Zambian Kwacha', 'ZWL': 'Zimbabwean Dollar'
        };

        // build unique symbols for the symbol selector
        var symMap = {};
        for (var i = 0; i < CURRENCIES.length; i++) {
            var c = CURRENCIES[i];
            if (!symMap[c.sym]) symMap[c.sym] = c;
        }
        var symOpts = '';
        for (var s in symMap) {
            if (symMap.hasOwnProperty(s)) {
                var sel = s === config.symbol ? ' selected' : '';
                symOpts += '<option value="' + s.replace(/"/g, '&quot;') + '"' + sel + '>' + s + '</option>';
            }
        }

        // build currency options with flags and names
        var currOpts = '';
        for (var i = 0; i < CURRENCIES.length; i++) {
            var c = CURRENCIES[i];
            var sel = c.code === config.primaryCurrency ? ' selected' : '';
            var nm = currNames[c.code] || c.code;
            currOpts += '<option value="' + c.code + '"' + sel + '>' + c.flag + ' ' + c.code + ' ' + c.sym + ' - ' + nm + '</option>';
        }

        // build crypto options
        var cryptoOpts = '';
        for (var i = 0; i < CRYPTOS.length; i++) {
            var cr = CRYPTOS[i];
            var sel = cr.id === config.cryptoId ? ' selected' : '';
            cryptoOpts += '<option value="' + cr.id + '"' + sel + '>' + cr.name + ' (' + cr.sym + ')</option>';
        }

        // build favorite chips
        var chips = '';
        for (var i = 0; i < CURRENCIES.length; i++) {
            var c = CURRENCIES[i];
            var on = config.favoriteCurrencies.indexOf(c.code) !== -1 ? ' tt-on' : '';
            chips += '<div class="tt-chip' + on + '" data-code="' + c.code + '">' + c.flag + ' ' + c.sym + ' ' + c.code + '</div>';
        }

        var currSym = getSym(config.primaryCurrency);

        modal.innerHTML =
            '<span class="tt-close" id="tt-modal-close">&times;</span>' +
            '<h3>\ud83d\udcb5 Torn Real Value Converter v5.2</h3>' +
            '<div class="tt-f"><label>Rate Mode</label>' +
            '<select id="tt-mode">' +
            '  <option value="donator_fixed"' + (config.rateMode === 'donator_fixed' ? ' selected' : '') + '>Donator Pack $5/23.5M (fixed)</option>' +
            '  <option value="donator_live"' + (config.rateMode === 'donator_live' ? ' selected' : '') + '>Donator Pack (live market)</option>' +
            '  <option value="points_fixed"' + (config.rateMode === 'points_fixed' ? ' selected' : '') + '>Points (fixed $/pt)</option>' +
            '  <option value="points_live"' + (config.rateMode === 'points_live' ? ' selected' : '') + '>Points (live market)</option>' +
            '  <option value="crypto"' + (config.rateMode === 'crypto' ? ' selected' : '') + '>Cryptocurrency</option>' +
            '  <option value="millionaire"' + (config.rateMode === 'millionaire' ? ' selected' : '') + '>Millionaire Mode (\u00f71M)</option>' +
            '  <option value="billionaire"' + (config.rateMode === 'billionaire' ? ' selected' : '') + '>Billionaire Mode (\u00f71B)</option>' +
            '  <option value="broke"' + (config.rateMode === 'broke' ? ' selected' : '') + '>Broke Mode (\u00f71T)</option>' +
            '  <option value="custom"' + (config.rateMode === 'custom' ? ' selected' : '') + '>Custom Rate</option>' +
            '</select></div>' +
            '<div class="tt-f" id="tt-crypto-f" style="display:none"><label>Cryptocurrency</label>' +
            '<select id="tt-crypto">' + cryptoOpts + '</select></div>' +
            '<div class="tt-f" id="tt-pts-f" style="display:none"><label>$ per Point</label>' +
            '<span id="tt-pts-val" style="display:none;color:#999;font-size:12px"></span>' +
            '<input type="number" id="tt-pts" value="' + config.pointsPerDollar + '" step="0.001">' +
            '<div class="tt-hint" id="tt-pts-hint">e.g. 0.001 means 1 point = $0.001</div></div>' +
            '<div class="tt-f" id="tt-don-f" style="display:none"><label>Pack Price (USD)</label>' +
            '<input type="number" id="tt-dp" value="' + config.donatorPackPrice + '" step="0.01">' +
            '<div class="tt-hint">Price you pay for a donator pack in USD (default: $5)</div></div>' +
            '<div class="tt-f" id="tt-cust-f" style="display:none"><label>Custom Rate (1 Torn $ = X USD)</label>' +
            '<input type="number" id="tt-cr" value="' + config.customRate + '" step="0.000001">' +
            '<div class="tt-hint">e.g. 0.001 means \u00a71000 = $1</div></div>' +
            '<div class="tt-f"><label>Replacement Symbol</label>' +
            '<select id="tt-sym">' + symOpts + '</select>' +
            '<div class="tt-hint">What to replace $ with (default: \u00a7)</div></div>' +
            '<div class="tt-f"><label>Torn API Key</label>' +
            '<input type="text" id="tt-key" value="' + config.apiKey + '" placeholder="16-char key...">' +
            '<div class="tt-hint">Get one at torn.com/preferences.php#tab=api</div></div>' +
            '<div class="tt-f"><label>Primary Currency</label>' +
            '<select id="tt-pri">' + currOpts + '</select></div>' +
            '<div class="tt-f"><label>Favorites (click to toggle)</label>' +
            '<div class="tt-chips" id="tt-favs">' + chips + '</div>' +
            '<div class="tt-hint">Shown in tooltip</div></div>' +
            '<div class="tt-st" id="tt-st">Loading...</div>' +
            '<button class="tt-btn" id="tt-refresh">Refresh Rates</button>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('tt-modal-close').addEventListener('click', closeSettingsModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeSettingsModal();
        });

        function save() { GM_setValue('tt_config', JSON.stringify(config)); }

        function updateVisibility() {
            var mode = config.rateMode;
            modal.querySelector('#tt-crypto-f').style.display = mode === 'crypto' ? '' : 'none';
            modal.querySelector('#tt-pts-f').style.display = (mode === 'points_fixed' || mode === 'points_live') ? '' : 'none';
            modal.querySelector('#tt-don-f').style.display = (mode === 'donator_fixed' || mode === 'donator_live') ? '' : 'none';
            modal.querySelector('#tt-cust-f').style.display = mode === 'custom' ? '' : 'none';

            var ptsInput = modal.querySelector('#tt-pts');
            var ptsVal = modal.querySelector('#tt-pts-val');
            var ptsHint = modal.querySelector('#tt-pts-hint');
            if (mode === 'points_live') {
                ptsInput.style.display = 'none';
                ptsVal.style.display = '';
                ptsVal.textContent = '$' + getPointsRate() + ' per point (live)';
                ptsHint.textContent = 'Live market rate from Torn API';
            } else {
                ptsInput.style.display = '';
                ptsVal.style.display = 'none';
                ptsHint.textContent = 'e.g. 0.001 means 1 point = $0.001';
            }
        }

        // wire up inputs
        modal.querySelector('#tt-mode').addEventListener('change', function (e) {
            config.rateMode = e.target.value; save(); updateVisibility(); doRefresh();
        });
        modal.querySelector('#tt-crypto').addEventListener('change', function (e) {
            config.cryptoId = e.target.value; save(); doRefresh();
        });
        modal.querySelector('#tt-pts').addEventListener('change', function (e) {
            config.pointsPerDollar = parseFloat(e.target.value) || 0.075; save();
        });
        modal.querySelector('#tt-dp').addEventListener('change', function (e) {
            config.donatorPackPrice = parseFloat(e.target.value) || 5; save();
        });
        modal.querySelector('#tt-cr').addEventListener('change', function (e) {
            config.customRate = parseFloat(e.target.value) || 0.001; save();
        });
        modal.querySelector('#tt-sym').addEventListener('change', function (e) {
            config.symbol = e.target.value || '\u00a7'; save();
        });
        modal.querySelector('#tt-key').addEventListener('change', function (e) {
            config.apiKey = e.target.value.trim(); save();
        });
        modal.querySelector('#tt-pri').addEventListener('change', function (e) {
            config.primaryCurrency = e.target.value; save(); doRefresh();
        });

        // favorite chips
        var chipEls = modal.querySelectorAll('.tt-chip');
        for (var i = 0; i < chipEls.length; i++) {
            (function (ch) {
                ch.addEventListener('click', function () {
                    var code = ch.getAttribute('data-code');
                    var idx = config.favoriteCurrencies.indexOf(code);
                    if (idx !== -1) {
                        config.favoriteCurrencies.splice(idx, 1);
                        ch.classList.remove('tt-on');
                    } else {
                        config.favoriteCurrencies.push(code);
                        ch.classList.add('tt-on');
                    }
                    save();
                });
            })(chipEls[i]);
        }

        modal.querySelector('#tt-refresh').addEventListener('click', function () { doRefresh(); });
        updateVisibility();
        doRefresh();
    }

    function closeSettingsModal() {
        var overlay = document.getElementById('tt-modal-overlay');
        if (overlay) overlay.remove();
    }

    // ======== DASHBOARD WIDGET ========

    function injectDash() {
        if (!isBank()) return;
        var iw = document.querySelector('.invest-wrap');
        if (!iw) { setTimeout(injectDash, 1000); return; }
        if (document.getElementById('tt-dash')) return;

        var dash = document.createElement('div');
        dash.id = 'tt-dash';
        dash.className = 'tt-dash';
        updateDash(dash);

        var ic = iw.querySelector('.invest-cont');
        if (ic && ic.parentNode) ic.parentNode.insertBefore(dash, ic.nextSibling);
        else iw.appendChild(dash);
    }

    function updateDash(dash) {
        if (!dash) dash = document.getElementById('tt-dash');
        if (!dash) return;

        var rate = getRate();
        var sym = getSym(config.primaryCurrency);
        var div = getFixedDivisor();
        var perM = rate * 1e6;
        var perB = rate * 1e9;

        var h = '';
        if (isFixedMode()) {
            var label = div === 1e6 ? '\u00a71M' : div === 1e9 ? '\u00a71B' : '\u00a71T';
            var val = rate * div;
            var convVal = usdToCurr(val, config.primaryCurrency);
            h += '<div class="tt-dbig"><span class="tt-dsym">' + sym + '</span>' + fmt(convVal, '') + '</div>';
            h += '<div class="tt-dsub">per ' + label + ' \u00b7 ' + config.primaryCurrency + '</div>';
        } else {
            h += '<div class="tt-dbig"><span class="tt-dsym">' + sym + '</span>' + fmt(perM, '') + '</div>';
            h += '<div class="tt-dsub">per \u00a71M \u00b7 ' + config.primaryCurrency + '</div>';
        }
        h += '<div class="tt-dhr"></div>';
        h += '<div class="tt-drow"><span class="tt-dcode">\u00a71M</span><span class="tt-dval">' + fmt(usdToCurr(perM, config.primaryCurrency), sym) + '</span></div>';
        h += '<div class="tt-drow"><span class="tt-dcode">\u00a71B</span><span class="tt-dval">' + fmt(usdToCurr(perB, config.primaryCurrency), sym) + '</span></div>';

        for (var i = 0; i < config.favoriteCurrencies.length; i++) {
            var fav = config.favoriteCurrencies[i];
            if (fav === config.primaryCurrency) continue;
            var fs = getSym(fav);
            var fv = usdToCurr(perM, fav);
            h += '<div class="tt-drow"><span class="tt-dcode">\u00a71M in ' + fav + '</span><span class="tt-dval">' + fmt(fv, fs) + '</span></div>';
        }

        var prof = document.querySelector('.invest-success .profit');
        if (prof) {
            var v = parseFloat(prof.textContent.replace(/[\u00a7$,]/g, ''));
            if (!isNaN(v)) {
                var conv = usdToCurr(v * rate, config.primaryCurrency);
                h += '<div class="tt-dhr"></div>';
                h += '<div class="tt-dinv">Investment: <span class="tt-dinvv">' + fmt(conv, sym) + '</span> ' + config.primaryCurrency + '</div>';
            }
        }

        if (rates.stocks) {
            var stockCount = 0;
            for (var checkSid in rates.stocks) {
                if (rates.stocks.hasOwnProperty(checkSid)) stockCount++;
            }
            if (stockCount > 0) {
                h += '<div class="tt-dhr"></div><div class="tt-dstocks">';
                var cnt = 0;
                for (var sid in rates.stocks) {
                    if (!rates.stocks.hasOwnProperty(sid)) continue;
                    if (cnt >= 4) break;
                    var s = rates.stocks[sid];
                    var nm = s.name || sid;
                    var pr = s.current_price || s.price || 0;
                    var pct = s.change_percentage || 0;
                    var cls = pct >= 0 ? 'tt-dup' : 'tt-ddn';
                    var sg = pct >= 0 ? '+' : '';
                    h += '<div class="tt-dstock"><span>' + nm + '</span><span class="' + cls + '">' + pr.toFixed(2) + ' (' + sg + pct.toFixed(2) + '%)</span></div>';
                    cnt++;
                }
                h += '</div>';
            }
        }

        dash.innerHTML = h;
    }

    // ======== REFRESH ========

    function doRefresh() {
        var st = document.getElementById('tt-st');
        if (st) { st.textContent = 'Fetching...'; st.className = 'tt-st'; }

        var errs = fetchAllRates();

        if (errs.length) {
            if (st) { st.textContent = errs.join(' \u00b7 '); st.className = 'tt-st tt-warn'; }
        } else {
            var r = getRate();
            if (st) { st.textContent = '\u2713 1 Torn $ = $' + r.toFixed(8) + ' USD \u00b7 ' + new Date().toLocaleTimeString(); st.className = 'tt-st tt-ok'; }
        }

        updateDash();

        var stockDash = document.getElementById('tt-stock-dash');
        if (stockDash) updateDash(stockDash);

        var stockSt = document.getElementById('tt-stock-st');
        if (stockSt && !errs.length) {
            var r2 = getRate();
            stockSt.textContent = '\u2713 1 Torn $ = $' + r2.toFixed(8) + ' USD \u00b7 ' + new Date().toLocaleTimeString();
            stockSt.style.color = '#6a6';
        } else if (stockSt && errs.length) {
            stockSt.textContent = errs.join(' \u00b7 ');
            stockSt.style.color = '#ca0';
        }
    }

    // ======== DAILY RATE UPDATE ========

    function checkDailyUpdate() {
        var now = new Date();
        var estHour = (now.getUTCHours() - 5 + 24) % 24;
        var estMin = now.getUTCMinutes();
        var today = now.toISOString().slice(0, 10);

        if (estHour === 9 && estMin === 30 && config.lastRateUpdate !== today) {
            config.lastRateUpdate = today;
            GM_setValue('tt_config', JSON.stringify(config));
            var errs = fetchAllRates();
            updateDash();
            if (isBank() && !errs.length) playBell();
        }
    }

    function playBell() {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.5);
        } catch (e) { /* audio not available */ }
    }

    setInterval(checkDailyUpdate, 60000);

    // ======== LOAD / SAVE ========

    function load() {
        try {
            var s = JSON.parse(GM_getValue('tt_config', '{}'));
            for (var k in s) {
                if (s.hasOwnProperty(k) && config.hasOwnProperty(k)) config[k] = s[k];
            }
        } catch (e) { /* ignore bad data */ }
    }

    // ======== INIT ========

    function init() {
        load();
        ensureTip();
        attachHover();

        replaceSymbols();
        startObserver();

        if (isBank()) {
            injectBankUI();
            setTimeout(function () { injectBankUI(); }, 800);
            setTimeout(function () { injectBankUI(); }, 2000);
        }

        if (isStocks()) {
            injectStockUI();
            setTimeout(function () { injectStockUI(); }, 800);
            setTimeout(function () { injectStockUI(); }, 2000);
        }

        var lastUrl = location.href;
        setInterval(function () {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                if (isBank()) {
                    setTimeout(function () { injectBankUI(); }, 800);
                    setTimeout(function () { injectBankUI(); }, 2000);
                }
                if (isStocks()) {
                    setTimeout(function () { injectStockUI(); }, 800);
                    setTimeout(function () { injectStockUI(); }, 2000);
                }
            }
        }, 500);

        setTimeout(function () {
            fetchAllRates();
            updateDash();
        }, 1000);

        console.log('[TRT] Torn Real Value Converter v5.2.0 loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
