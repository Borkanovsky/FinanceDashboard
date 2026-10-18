// api.js
// Central API service layer. Every screen gets financial data through the
// functions in this file; no screen ever builds a URL or calls axios itself.
//
// WHY THIS ARCHITECTURE:
// FMP has already changed its API once (from /api/v3/ to /stable/). Because
// screens call getCompanyProfile() instead of raw URLs, a change like that is
// fixed in THIS file only. This is the "service layer" pattern.
//
// FMP API MIGRATION NOTE (2025):
// FMP deprecated the /api/v3/ endpoints in August 2025. The differences:
//   OLD: https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=KEY
//   NEW: https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=KEY
// Path parameters (/AAPL) became query parameters (?symbol=AAPL), some
// endpoint names changed (/search → /search-symbol), and many FIELD NAMES
// changed too (mktCap → marketCap, peRatio → priceToEarningsRatio, etc.).
//
// ERROR HANDLING STRATEGY:
// No function here ever throws. List endpoints return [] on failure and
// single-record endpoints return null. Screens check for those values and show
// an error message. Returning [] (not null) for lists matters because screens
// call .map() on the result, and [].map() is safe while null.map() crashes.
//
// COMMON ERRORS:
// - 401: API key invalid or missing. Check config.js.
// - 402: The endpoint (or parameter) needs a paid FMP plan.
// - 429: Rate limit hit (free tier is about 250 requests/day). Wait and retry.
// - "Legacy Endpoint": an old /api/v3/ URL. Use /stable/ instead.
// - Network Error / timeout: no internet, or phone and computer on different Wi-Fi.

import axios from 'axios';
import config from '../constants/config';

const { FMP_BASE_URL, FMP_API_KEY } = config;

// A dedicated axios client with a timeout. Without one, a dropped connection
// leaves the request pending forever and the screen spins indefinitely.
const http = axios.create({ timeout: 10000 });
// The most recent failure for each API function, keyed by function name.
// Screens read this (via getApiError) to explain WHY data is missing,
// without changing the [] / null return values they already rely on.
const apiErrors = {};

/**
 * Returns the first recorded error among the given API functions.
 *
 * @param {...string} labels Function names, e.g. 'getRatios', 'getKeyMetrics'.
 * @returns {{status?: number, detail?: string, message?: string}|null}
 */
export const getApiError = (...labels) => labels.map((l) => apiErrors[l]).find(Boolean) || null;
/**
 * Builds a full FMP URL with the API key attached.
 *
 * Every request needs `apikey`, so it's added here once instead of in every
 * function (forgetting it is the #1 cause of 401 errors).
 *
 * @param {string} endpoint  Path after the base URL, e.g. "/profile".
 * @param {string} [params]  Extra query string WITHOUT a leading "&",
 *                           e.g. "symbol=AAPL&limit=5". Values must already be
 *                           URL-encoded.
 * @returns {string} The complete request URL.
 */
const buildUrl = (endpoint, params = '') => {
  const separator = params ? '&' : '';
  return `${FMP_BASE_URL}${endpoint}?apikey=${FMP_API_KEY}${separator}${params}`;
};

/**
 * URL-encodes a ticker for use in a query string.
 * Tickers like "BRK.B" are safe as-is, but anything with a space, "&" or "#"
 * (pasted text, unusual international symbols) would otherwise break the URL
 * or inject extra parameters.
 *
 * @param {string} ticker Raw ticker symbol.
 * @returns {string} Encoded symbol.
 */
const encodeTicker = (ticker) => encodeURIComponent(String(ticker || '').trim());

/**
 * Normalizes a list response to an array.
 *
 * FMP sometimes answers with HTTP 200 and an error OBJECT, e.g.
 * { "Error Message": "Invalid API KEY" }. The old `response.data || []`
 * passed that object through, and the screen crashed calling .map() on it.
 *
 * @param {*} data       response.data from axios.
 * @param {string} label Function name, used in the log message.
 * @returns {Array} The data if it's an array, otherwise [].
 */
const asArray = (data, label) => {
  delete apiErrors[label];
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    console.error(`${label}: unexpected response`, data['Error Message'] || data);
  }
  return [];
};

/**
 * Returns the first record of a list response, or null.
 * FMP wraps single-company endpoints (profile, ratios…) in an array.
 *
 * @param {*} data       response.data from axios.
 * @param {string} label Function name, used in the log message.
 * @returns {Object|null} First element, or null if the list is empty/invalid.
 */
const firstOrNull = (data, label) => {
  const list = asArray(data, label);
  return list.length > 0 ? list[0] : null;
};

/**
 * Logs a failed request without leaking the API key.
 * axios's error.message doesn't include the URL, but error.config.url does,
 * so we deliberately log only the message and HTTP status.
 *
 * @param {string} label Function name.
 * @param {Error & {response?: {status?: number}}} error The axios error.
 * @returns {void}
 */
const logError = (label, error) => {
  const status = error?.response?.status;
  // FMP's response body explains 401/402/429 in plain English and never
  // contains the API key, so it's safe to log and show.
  const body = error?.response?.data;
  const detail = typeof body === 'string' ? body : body?.['Error Message'] || body?.message;
  apiErrors[label] = { status, detail, message: error?.message };
  console.error(`${label} error:`, status ? `HTTP ${status}` : '', error?.message, detail || '');
};


// ============================================================
// SEARCH
// ============================================================

/**
 * Searches for companies matching what the user typed.
 * Called by SearchScreen (after the debounce delay).
 *
 * ENDPOINT: /stable/search-symbol?query=AAPL
 *
 * @param {string} query Ticker, partial ticker, or company name ("AAPL", "Apple").
 * @returns {Promise<Array<{symbol: string, name: string, currency: string,
 *   exchange: string, exchangeFullName: string}>>} Matches, or [] on failure or
 *   empty input. (The old v3 field `exchangeShortName` is `exchange` in /stable/.)
 */
export const searchTicker = async (query) => {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim();

  // FMP writes share classes with a dash (BRK-B), but people type BRK.B.
  const symbolQuery = q.replace(/\./g, '-');

  // Runs one search and never throws, so one failing search
  // can't wipe out the results of the other.
  const safeSearch = async (endpoint, text) => {
    try {
      const response = await http.get(buildUrl(endpoint, `query=${encodeURIComponent(text)}`));
      return asArray(response.data, 'searchTicker');
    } catch (error) {
      logError('searchTicker', error);
      return [];
    }
  };

  // search-symbol only matches tickers ("AAPL"); search-name matches company
  // names ("Apple", "AT&T"). Run both at once and merge, so either works.
  const [bySymbol, byName] = await Promise.all([
    safeSearch('/search-symbol', symbolQuery),
    safeSearch('/search-name', q),
  ]);

  // The same company often appears in both lists, so drop repeats.
  const seen = new Set();
  return [...bySymbol, ...byName].filter((item) => {
    if (!item?.symbol || seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });
};


// ============================================================
// COMPANY PROFILE
// ============================================================

/**
 * Fetches a company's profile and current market data.
 * Called by OverviewScreen and DCFScreen (for the current price).
 *
 * ENDPOINT: /stable/profile?symbol=AAPL
 *
 * Fields used by the app (/stable/ names):
 *   companyName, symbol, price, change (daily $ change),
 *   changePercentage (number OR string like "-0.68%"; OverviewScreen handles both),
 *   marketCap, sector, industry, exchange, range ("124.17-198.23"),
 *   averageVolume, description, image.
 *
 * @param {string} ticker Stock symbol, e.g. "AAPL".
 * @returns {Promise<Object|null>} The profile object, or null if the ticker
 *   doesn't exist (FMP returns an empty array) or the request fails.
 */
export const getCompanyProfile = async (ticker) => {
  try {
    const response = await http.get(buildUrl('/profile', `symbol=${encodeTicker(ticker)}`));
    return firstOrNull(response.data, 'getCompanyProfile');
  } catch (error) {
    logError('getCompanyProfile', error);
    return null;
  }
};


// ============================================================
// FINANCIAL STATEMENTS
// ============================================================

/**
 * Shared fetcher for the three annual statements, which use identical
 * parameters and response shapes.
 *
 * @param {string} endpoint FMP statement endpoint.
 * @param {string} ticker   Stock symbol.
 * @param {string} label    Function name for logging.
 * @returns {Promise<Object[]>} One object per fiscal year, NEWEST FIRST, or [].
 */
const fetchStatement = async (endpoint, ticker, label) => {
  try {
    const url = buildUrl(endpoint, `symbol=${encodeTicker(ticker)}&limit=${config.FINANCIAL_YEARS}`);
    const response = await http.get(url);
    return asArray(response.data, label);
  } catch (error) {
    logError(label, error);
    return [];
  }
};

/**
 * Fetches annual income statements (default: last 5 years).
 * Called by FinancialsScreen.
 *
 * ENDPOINT: /stable/income-statement?symbol=AAPL&limit=5
 * Key fields: date, revenue, grossProfit, operatingIncome, netIncome, ebitda, eps.
 *
 * Data arrives NEWEST FIRST; FinancialsScreen reverses it so charts read
 * left-to-right in time order.
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Object[]>} Yearly income statements, or [] on failure.
 */
export const getIncomeStatement = (ticker) =>
  fetchStatement('/income-statement', ticker, 'getIncomeStatement');

/**
 * Fetches annual balance sheets.
 * Called by FinancialsScreen and DCFScreen (to compute net debt).
 *
 * ENDPOINT: /stable/balance-sheet-statement?symbol=AAPL&limit=5
 * Key fields: totalAssets, totalLiabilities, totalStockholdersEquity,
 * totalDebt, cashAndCashEquivalents, netDebt.
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Object[]>} Yearly balance sheets, newest first, or [].
 */
export const getBalanceSheet = (ticker) =>
  fetchStatement('/balance-sheet-statement', ticker, 'getBalanceSheet');

/**
 * Fetches annual cash flow statements.
 * Called by FinancialsScreen and DCFScreen (for Free Cash Flow).
 *
 * ENDPOINT: /stable/cash-flow-statement?symbol=AAPL&limit=5
 * Key fields: operatingCashFlow, capitalExpenditure (NEGATIVE), freeCashFlow
 * (= operatingCashFlow + capitalExpenditure), dividendsPaid (NEGATIVE).
 *
 * FCF is the most important input to the DCF: it's the cash left after running
 * and maintaining the business, which is what can repay debt or go to owners.
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Object[]>} Yearly cash flow statements, newest first, or [].
 */
export const getCashFlow = (ticker) =>
  fetchStatement('/cash-flow-statement', ticker, 'getCashFlow');


// ============================================================
// RATIOS AND METRICS
// ============================================================

/**
 * Fetches the most recent year of key metrics (limit=1, because the Ratios
 * screen only shows current values).
 *
 * ENDPOINT: /stable/key-metrics?symbol=AAPL&limit=1
 * Fields used (/stable/ names): evToEBITDA, evToSales, returnOnEquity,
 * returnOnAssets, returnOnInvestedCapital.
 * (P/E, P/B and P/S moved to /ratios in the /stable/ API.)
 *
 * Some fields are null for certain companies: banks have no meaningful
 * EBITDA, REITs have unusual capital structures. The formatters show "N/A".
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Object|null>} Latest metrics, or null on failure.
 */
export const getKeyMetrics = async (ticker) => {
  try {
    const response = await http.get(buildUrl('/key-metrics', `symbol=${encodeTicker(ticker)}&limit=1`));
    return firstOrNull(response.data, 'getKeyMetrics');
  } catch (error) {
    logError('getKeyMetrics', error);
    return null;
  }
};

/**
 * Fetches the most recent year of financial ratios.
 *
 * ENDPOINT: /stable/ratios?symbol=AAPL&limit=1
 * Fields used (/stable/ names): priceToEarningsRatio, priceToBookRatio,
 * priceToSalesRatio, priceToEarningsGrowthRatio, grossProfitMargin,
 * operatingProfitMargin, netProfitMargin, debtToEquityRatio, debtToAssetsRatio,
 * interestCoverageRatio, currentRatio, quickRatio, assetTurnover,
 * inventoryTurnover, receivablesTurnover.
 *
 * WHY TWO RATIO ENDPOINTS: FMP splits the data. /key-metrics is EV- and
 * return-focused; /ratios has price multiples, margins and turnover.
 * RatiosScreen fetches both in parallel and combines them.
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Object|null>} Latest ratios, or null on failure.
 */
export const getRatios = async (ticker) => {
  try {
    const response = await http.get(buildUrl('/ratios', `symbol=${encodeTicker(ticker)}&limit=1`));
    return firstOrNull(response.data, 'getRatios');
  } catch (error) {
    logError('getRatios', error);
    return null;
  }
};


// ============================================================
// HISTORICAL PRICES
// ============================================================

/**
 * Fetches daily end-of-day prices for the 1-year chart.
 *
 * ENDPOINT: /stable/historical-price-eod/full?symbol=AAPL
 *
 * The response is usually a flat array of { date, open, high, low, close,
 * volume }, but older-style responses wrap it as { symbol, historical: [...] }.
 * The old code only handled the flat array, so the wrapped shape silently
 * produced an empty chart even though the comment said both were supported.
 *
 * DATA ORDER: NEWEST FIRST. OverviewScreen reverses and samples it.
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Array<{date: string, close: number}>>} Daily prices, or [].
 */
export const getHistoricalPrice = async (ticker) => {
  delete apiErrors.getHistoricalPrice;
  try {
    const response = await http.get(buildUrl('/historical-price-eod/full', `symbol=${encodeTicker(ticker)}`));
    const { data } = response;
    if (data && Array.isArray(data.historical)) return data.historical;
    return asArray(data, 'getHistoricalPrice');
  } catch (error) {
    logError('getHistoricalPrice', error);
    return [];
  }
};


// ============================================================
// ENTERPRISE VALUE (used by DCF calculator)
// ============================================================

/**
 * Fetches enterprise-value data, mainly for the share count the DCF needs.
 *
 * ENDPOINT: /stable/enterprise-values?symbol=AAPL&limit=1
 * Key fields: numberOfShares (divides equity value into a per-share price),
 * enterpriseValue (reference only; the DCF calculates its own).
 *
 * WHY A SEPARATE ENDPOINT FOR SHARES: the profile endpoint doesn't reliably
 * include shares outstanding, and without it the DCF can't produce a price.
 *
 * @param {string} ticker Stock symbol.
 * @returns {Promise<Object|null>} Latest enterprise-value record, or null.
 */
export const getEnterpriseValue = async (ticker) => {
  try {
    const response = await http.get(buildUrl('/enterprise-values', `symbol=${encodeTicker(ticker)}&limit=1`));
    return firstOrNull(response.data, 'getEnterpriseValue');
  } catch (error) {
    logError('getEnterpriseValue', error);
    return null;
  }
};
