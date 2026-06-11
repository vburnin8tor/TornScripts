// ==UserScript==
// @name         Torn Real Value Converter v5
// @namespace    http://tampermonkey.net/
// @version      5.3.1
// @description  Converts Torn cash to real-world values everywhere. Replaces all $ with converted values inline. Bank/stocks page settings modal.
// @author       Lazuli for Shaul
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      api.torn.com
// @connect      api.coingecko.com
// @connect      open.er-api.com
// @connect      api.frankfurter.dev
// ==/UserScript==

/*
    Torn Real Value Converter v5.3.0
    ----------------------------------
    what this does:
    - replaces all $ on the page with converted real-world values
    - no tooltip, no hover — just straight up replaces the numbers
    - bank page gets a settings modal and a dashboard widget
    - stock page gets a settings button at the bottom

    conversion modes:
    - donator pack: fixed $5/23.5M (default) or live market via torn API
    - points: fixed $/pt or live market via torn API
    - crypto: BTC or any coin via coingecko keyless API (no key needed)
    - millionaire/billionaire/broke: fixed divisors
    - custom: you type your own rate

    base math: $5 USD per 23.5M Torn Money

    to go back to normal torn money, open the settings modal
    on the bank or stocks page and pick "Custom" with rate 1.0

    no frameworks, no build tools. vanilla JS.
*/

(function () {
    'use strict';

    // ======== DEFAULTS ========

    var DEFAULTS = {
        rateMode: 'donator_fixed',
        customRate: 0.001,
        pointsPerDollar: 0.075,
        donatorPackPrice: 5.00,
        donatorPackCash: 23500000,
        primaryCurrency: 'USD',
        cryptoId: 'bitcoin',
        apiKey: '',
        lastRateUpdate: ''
    };

    var config = {};
    for (var dk in DEFAULTS) {
        if (DEFAULTS.hasOwnProperty(dk)) config[dk] = DEFAULTS[dk];
    }

    // ======== CURRENCIES ========

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
    // uses coingecko keyless public API — no api key needed
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
        try {
            r.open('GET', url, false);
            r.timeout = 10000;
            r.send();
        } catch (e) {
            throw new Error('fetch failed');
        }
        if (r.status !== 200) throw new Error('HTTP ' + r.status);
        try {
            return JSON.parse(r.responseText);
        } catch (e) {
            throw new Error('bad response');
        }
    }

    // ======== FETCH RATES ========
    // currency: frankfurter → open.er-api → exchangerate-api (3 fallbacks, all free no key)
    // crypto: coingecko keyless (free, no key)
    // torn: needs your own api key

    function fetchAllRates() {
        var errors = [];
        var d;

        // --- currency exchange rates ---
        var ratesFetched = false;

        // try frankfurter first
        if (!ratesFetched) {
            try {
                d = xhrGet('https://api.frankfurter.dev/v1/latest?from=USD');
                rates.currencies = d.rates;
                ratesFetched = true;
            } catch (e) { /* fall through */ }
        }

        // try open.er-api second
        if (!ratesFetched) {
            try {
                d = xhrGet('https://open.er-api.com/v6/latest/USD');
                rates.currencies = d.rates;
                ratesFetched = true;
            } catch (e) { /* fall through */ }
        }

        // try exchangerate-api third (free tier, no key needed for basic)
        if (!ratesFetched) {
            try {
                d = xhrGet('https://api.exchangerate-api.com/v4/latest/USD');
                rates.currencies = d.rates;
                ratesFetched = true;
            } catch (e) { /* fall through */ }
        }

        if (!ratesFetched) {
            errors.push('Currency: could not reach any exchange rate API');
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
            } catch (e) { /* stocks optional */ }

        } else if (config.rateMode === 'points_live' || config.rateMode === 'donator_live') {
            errors.push('Need Torn API key');
        }

        // --- crypto price via coingecko keyless API ---
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

    var BASE_RATE = 5 / 23500000;  // ~2.128e-7 USD per Torn $

    function getRate() {
        switch (config.rateMode) {
            case 'millionaire':
            case 'billionaire':
            case 'broke':
                return BASE_RATE;
            case 'donator_fixed':
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
                return BASE_RATE;
            case 'custom':
                return config.customRate;
            default:
                return BASE_RATE;
        }
    }

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

    function usdToCurr(usd, code) {
        if (code === 'USD') return usd;
        if (!rates.currencies) return null;
        var r = rates.currencies[code];
        return r ? usd * r : null;
    }

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

    // ======== INLINE REPLACEMENT ========
    // the core loop: find $amount in text nodes, replace with converted value

    function processNode(node) {
        if (!node || node.nodeType !== 3) return;
        if (node.textContent.indexOf('$') === -1) return;
        if (!/\$\d/.test(node.textContent)) return;

        var p = node.parentElement;
        if (!p) return;
        if (isInsideOurStuff(p)) return;

        var rate = getRate();
        var sym = getSym(config.primaryCurrency);
        var text = node.textContent;

        // match $ followed by digits, optional commas/decimals, optional K/M/B
        var regex = /\$([\d,]+(?:\.\d+)?[KMBkmb]?)/g;
        var match, lastIdx = 0;
        var frag = document.createDocumentFragment();
        var found = false;

        while ((match = regex.exec(text)) !== null) {
            found = true;

            // text before the match
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            }

            // parse the torn amount
            var tornAmt = parseMoney('$' + match[1]);
            if (tornAmt !== null) {
                var usdVal = tornAmt * rate;
                var convVal = usdToCurr(usdVal, config.primaryCurrency);
                // replace $amount with converted value
                var span = document.createElement('span');
                span.className = 'tt-conv';
                span.textContent = fmt(convVal, sym);
                frag.appendChild(span);
            } else {
                // couldn't parse, keep original
                frag.appendChild(document.createTextNode('$' + match[1]));
            }

            lastIdx = regex.lastIndex;
        }

        if (found) {
            if (lastIdx < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx)));
            }
            node.parentNode.replaceChild(frag, node);
        }
    }

    function parseMoney(text) {
        var s = text.replace(/[$,]/g, '');
        var mult = 1;
        if (/[Kk]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
        else if (/[Mm]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
        else if (/[Bb]$/.test(s)) { mult = 1e9; s = s.slice(0, -1); }
        var n = parseFloat(s);
        return isNaN(n) ? null : n * mult;
    }

    function isInsideOurStuff(el) {
        var cur = el;
        while (cur) {
            if (cur.className && typeof cur.className === 'string') {
                if (cur.className.indexOf('tt-') !== -1) return true;
            }
            if (cur.tagName === 'SCRIPT' || cur.tagName === 'STYLE') return true;
            cur = cur.parentElement;
        }
        return false;
    }

    function processAllNodes() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var tn;
        while ((tn = walker.nextNode())) {
            processNode(tn);
        }
    }

    // ======== MUTATION OBSERVER ========

    var _ttObserver = null;
    var _ttDebounce = null;

    function startObserver() {
        if (_ttObserver) return;

        _ttObserver = new MutationObserver(function (muts) {
            var nodes = [];

            for (var i = 0; i < muts.length; i++) {
                for (var j = 0; j < muts[i].addedNodes.length; j++) {
                    var nd = muts[i].addedNodes[j];
                    if (nd.nodeType === 3) {
                        if (nd.textContent.indexOf('$') !== -1 && /\$\d/.test(nd.textContent)) {
                            nodes.push(nd);
                        }
                    } else if (nd.nodeType === 1) {
                        if (!isInsideOurStuff(nd)) {
                            // walk text nodes inside this element
                            var walker = document.createTreeWalker(nd, NodeFilter.SHOW_TEXT, null);
                            var tn;
                            while ((tn = walker.nextNode())) {
                                if (tn.textContent.indexOf('$') !== -1 && /\$\d/.test(tn.textContent)) {
                                    nodes.push(tn);
                                }
                            }
                        }
                    }
                }
            }

            if (nodes.length === 0) return;

            clearTimeout(_ttDebounce);
            _ttDebounce = setTimeout(function () {
                for (var n = 0; n < nodes.length; n++) {
                    if (nodes[n].parentNode) {
                        processNode(nodes[n]);
                    }
                }
            }, 200);
        });

        _ttObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ======== CSS ========
    // no tooltip styles needed anymore

    GM_addStyle(
        '.tt-conv{color:#888!important;font-size:inherit!important;white-space:nowrap!important}' +
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

        // currency country names
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

        // build currency options
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

        modal.innerHTML =
            '<span class="tt-close" id="tt-modal-close">&times;</span>' +
            '<h3>\ud83d\udcb5 Torn Real Value Converter v5.3</h3>' +
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
            '<input type="number" id="tt-pts" value="' + config.pointsPerDollar + '" step="0.001">' +
            '<div class="tt-hint">e.g. 0.001 means 1 point = $0.001</div></div>' +
            '<div class="tt-f" id="tt-don-f" style="display:none"><label>Pack Price (USD)</label>' +
            '<input type="number" id="tt-dp" value="' + config.donatorPackPrice + '" step="0.01">' +
            '<div class="tt-hint">Price you pay for a donator pack in USD (default: $5)</div></div>' +
            '<div class="tt-f" id="tt-cust-f" style="display:none"><label>Custom Rate (1 Torn $ = X USD)</label>' +
            '<input type="number" id="tt-cr" value="' + config.customRate + '" step="0.000001">' +
            '<div class="tt-hint">e.g. 0.001 means $1000 = $1 · use 1.0 to show raw torn values</div></div>' +
            '<div class="tt-f"><label>Torn API Key</label>' +
            '<input type="text" id="tt-key" value="' + config.apiKey + '" placeholder="16-char key...">' +
            '<div class="tt-hint">Get one at torn.com/preferences.php#tab=api</div></div>' +
            '<div class="tt-f"><label>Primary Currency</label>' +
            '<select id="tt-pri">' + currOpts + '</select></div>' +
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
        }

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
        modal.querySelector('#tt-key').addEventListener('change', function (e) {
            config.apiKey = e.target.value.trim(); save();
        });
        modal.querySelector('#tt-pri').addEventListener('change', function (e) {
            config.primaryCurrency = e.target.value; save(); doRefresh();
        });

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
            var label = div === 1e6 ? '$1M' : div === 1e9 ? '$1B' : '$1T';
            var val = rate * div;
            var convVal = usdToCurr(val, config.primaryCurrency);
            h += '<div class="tt-dbig"><span class="tt-dsym">' + sym + '</span>' + fmt(convVal, '') + '</div>';
            h += '<div class="tt-dsub">per ' + label + ' \u00b7 ' + config.primaryCurrency + '</div>';
        } else {
            h += '<div class="tt-dbig"><span class="tt-dsym">' + sym + '</span>' + fmt(perM, '') + '</div>';
            h += '<div class="tt-dsub">per $1M \u00b7 ' + config.primaryCurrency + '</div>';
        }
        h += '<div class="tt-dhr"></div>';
        h += '<div class="tt-drow"><span class="tt-dcode">$1M</span><span class="tt-dval">' + fmt(usdToCurr(perM, config.primaryCurrency), sym) + '</span></div>';
        h += '<div class="tt-drow"><span class="tt-dcode">$1B</span><span class="tt-dval">' + fmt(usdToCurr(perB, config.primaryCurrency), sym) + '</span></div>';

        var prof = document.querySelector('.invest-success .profit');
        if (prof) {
            var v = parseFloat(prof.textContent.replace(/[$,]/g, ''));
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

    // ======== DAILY UPDATE ========

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
        } catch (e) { /* ignore */ }
    }

    // ======== INIT ========

    function init() {
        load();

        // process existing DOM
        processAllNodes();
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

        // watch for url changes (torn is a SPA)
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

        // initial rate fetch
        setTimeout(function () {
            fetchAllRates();
            updateDash();
        }, 1000);

        // periodic sweep to catch anything the observer missed
        // aggressive at first, then slower
        var _sweepCount = 0;
        var _sweepInterval = setInterval(function () {
            processAllNodes();
            _sweepCount++;
            if (_sweepCount >= 15) {
                // after 30 seconds, slow down to every 5 seconds
                clearInterval(_sweepInterval);
                _sweepInterval = setInterval(function () {
                    processAllNodes();
                }, 5000);
            }
        }, 2000);

        console.log('[TRT] Torn Real Value Converter v5.3.0 loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
