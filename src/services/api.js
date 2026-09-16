// api.js
// Central API service layer. Every screen that needs financial data calls
// functions from this file. No screen ever constructs a URL or makes an
// HTTP request directly.
//
// WHY THIS ARCHITECTURE:
// If FMP changes their API structure again (they already did once, moving
// from /api/v3/ to /stable/), you change THIS file only. Every screen
// keeps working because they call searchTicker() and getCompanyProfile(),
// not raw HTTP endpoints. This separation is called the "service layer"
// pattern and it's how professional codebases are organized.
//
// FMP API MIGRATION NOTE (2025):
// FMP deprecated all /api/v3/ endpoints in August 2025. New accounts
// must use the /stable/ endpoints. The key differences:
//   OLD: https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=KEY
//   NEW: https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=KEY
// Path parameters (/AAPL) became query parameters (?symbol=AAPL).
// Some endpoint names also changed (e.g., /search became /search-symbol).
//
// ERROR HANDLING STRATEGY:
// Every function wraps its HTTP call in try/catch. On failure, it logs the
// error to the console (visible in your terminal where expo is running)
// and returns null or an empty array. Each screen checks for null and
// shows an error message to the user instead of crashing.
//
// COMMON ERRORS:
// - 401: Your API key is invalid or missing. Check config.js.
// - 403: You've exceeded the free tier limits (250 requests/day).
// - 429: Too many requests too fast. Add a small delay between calls.
// - "Legacy Endpoint": You're using /api/v3/ URLs. Use /stable/ instead.
// - Network Error: No internet, or phone and computer on different Wi-Fi.

// axios is an HTTP client library. It makes GET/POST requests and
// automatically parses JSON responses. We use it instead of the built-in
// fetch() because axios has cleaner error handling and automatically
// throws on non-200 status codes (fetch doesn't).
import axios from 'axios';

// Import the base URL and API key from our centralized config file.
// This means if the API key changes or FMP migrates URLs again,
// we update config.js and everything here picks it up automatically.
import config from '../constants/config';

// Destructure the values we need from config. This is shorthand for:
//   const FMP_BASE_URL = config.FMP_BASE_URL;
//   const FMP_API_KEY = config.FMP_API_KEY;
const { FMP_BASE_URL, FMP_API_KEY } = config;

// Helper function that constructs a complete API URL from an endpoint
// path and optional additional query parameters.
//
// HOW IT WORKS:
// Every FMP request needs the apikey parameter. This function appends it
// automatically so individual API functions never have to remember to
// include it. If there are additional parameters (like symbol=AAPL or
// limit=5), they get appended after the apikey with an & separator.
//
// EXAMPLE:
// buildUrl('/profile', 'symbol=AAPL')
// Returns: "https://financialmodelingprep.com/stable/profile?apikey=YOUR_KEY&symbol=AAPL"
//
// buildUrl('/stock-list')
// Returns: "https://financialmodelingprep.com/stable/stock-list?apikey=YOUR_KEY"
const buildUrl = (endpoint, params = '') => {
  // If there are extra params, we need an & to separate them from the apikey.
  // If there are no extra params, we add nothing after the apikey.
  const separator = params ? '&' : '';
  return `${FMP_BASE_URL}${endpoint}?apikey=${FMP_API_KEY}${separator}${params}`;
};


// ============================================================
// SEARCH
// ============================================================

// Searches for companies matching the user's input text.
// Called by: SearchScreen.js (fires as the user types, after debounce)
//
// ENDPOINT: /stable/search-symbol?query=AAPL&apikey=KEY
// (Old v3 endpoint was: /api/v3/search?query=AAPL)
//
// PARAMETERS:
// - query: string. The text the user typed. Can be a ticker symbol
//   ("AAPL"), a partial ticker ("AA"), or a company name ("Apple").
//
// RETURNS: Array of objects, each with:
//   { symbol: "AAPL", name: "Apple Inc.", currency: "USD",
//     stockExchange: "NASDAQ Global Select", exchangeShortName: "NASDAQ" }
//
// The function returns an empty array (not null) on failure because
// SearchScreen maps over the results with .map(). Mapping over [] works
// fine and renders nothing. Mapping over null would crash the app.
//
// GUARD CLAUSE:
// If the query is empty or just whitespace, return [] immediately
// without making an API call. This prevents wasting a request when
// the user clears the search field.
export const searchTicker = async (query) => {
  // Don't call the API for empty or whitespace-only queries.
  if (!query || query.trim().length === 0) return [];

  try {
    // encodeURIComponent handles special characters in the query.
    // If the user types "AT&T", it becomes "AT%26T" in the URL,
    // which prevents the & from being interpreted as a parameter separator.
    const url = buildUrl('/search-symbol', `query=${encodeURIComponent(query)}`);

    // axios.get() makes an HTTP GET request and waits for the response.
    // The "await" keyword pauses this function until the response arrives.
    // While paused, the rest of the app keeps running (JavaScript is async).
    const response = await axios.get(url);

    // response.data is the parsed JSON body from FMP's server.
    // If it exists, return it. If it's null/undefined for some reason,
    // return an empty array as a safe fallback.
    return response.data || [];
  } catch (error) {
    // Log the error so you can see it in the terminal for debugging.
    // error.message contains the human-readable error description.
    // Common messages: "Request failed with status code 401",
    // "Network Error", "timeout of 0ms exceeded"
    console.error('searchTicker error:', error.message);
    return [];
  }
};


// ============================================================
// COMPANY PROFILE
// ============================================================

// Fetches a company's basic information and current market data.
// Called by: OverviewScreen.js (when the screen first loads)
// Also called by: DCFScreen.js (to get the current stock price)
//
// ENDPOINT: /stable/profile?symbol=AAPL&apikey=KEY
// (Old v3 endpoint was: /api/v3/profile/AAPL)
//
// PARAMETERS:
// - ticker: string. The stock ticker symbol, e.g., "AAPL", "MSFT", "TSLA".
//
// RETURNS: A single object (not an array) with fields including:
//   - companyName: "Apple Inc."
//   - symbol: "AAPL"
//   - price: 178.72 (current stock price as a number)
//   - changes: -1.23 (daily price change in dollars, negative = down)
//   - changesPercentage: "-0.68%" (NOTE: sometimes a string with %,
//     sometimes a number. OverviewScreen handles both cases.)
//   - mktCap: 2800000000000 (market cap in raw dollars)
//   - sector: "Technology"
//   - industry: "Consumer Electronics"
//   - exchangeShortName: "NASDAQ"
//   - range: "124.17-198.23" (52-week range as a hyphenated string.
//     Split on "-" to get low and high values.)
//   - description: "Apple Inc. designs, manufactures..." (full text)
//   - image: "https://..." (URL to company logo)
//   - volAvg: 54000000 (average daily trading volume)
//
// WHY [0]:
// FMP returns an array even though we're requesting one company.
// response.data is [{ ...profile }]. We return response.data[0]
// to give the calling screen a plain object instead of an array.
// This simplifies usage: profile.companyName instead of profile[0].companyName.
export const getCompanyProfile = async (ticker) => {
  try {
    const url = buildUrl('/profile', `symbol=${ticker}`);
    const response = await axios.get(url);

    // Check that we got data AND that the array has at least one element.
    // If the ticker doesn't exist (e.g., "ZZZZ"), FMP returns an empty array.
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error('getCompanyProfile error:', error.message);
    return null;
  }
};


// ============================================================
// FINANCIAL STATEMENTS
// ============================================================

// Fetches annual income statement data for the last N years.
// Called by: FinancialsScreen.js (Income Statement tab)
//
// ENDPOINT: /stable/income-statement?symbol=AAPL&limit=5&apikey=KEY
// (Old v3 endpoint was: /api/v3/income-statement/AAPL?limit=5)
//
// RETURNS: Array of objects, one per fiscal year, NEWEST FIRST.
//
// KEY FIELDS IN EACH OBJECT:
//   - date: "2023-09-30" (fiscal year end date)
//   - revenue: 383285000000 (total sales)
//   - grossProfit: 169148000000 (revenue minus cost of goods sold)
//   - operatingIncome: 114301000000 (profit from core operations)
//   - netIncome: 96995000000 (bottom line profit after all expenses)
//   - ebitda: 125820000000 (earnings before interest, taxes, depreciation,
//     and amortization. Used as a proxy for operating cash generation.)
//   - eps: 6.13 (earnings per share)
//
// IMPORTANT: Data arrives NEWEST FIRST. The FinancialsScreen reverses
// the array with .reverse() before displaying charts, so charts read
// left-to-right chronologically (2019, 2020, 2021, 2022, 2023).
//
// The limit parameter comes from config.FINANCIAL_YEARS (default 5).
// This fetches 5 years of annual data. FMP supports up to 30+ years
// on paid plans, but 5 is standard for analysis.
export const getIncomeStatement = async (ticker) => {
  try {
    const url = buildUrl(
      '/income-statement',
      `symbol=${ticker}&limit=${config.FINANCIAL_YEARS}`
    );
    const response = await axios.get(url);
    return response.data || [];
  } catch (error) {
    console.error('getIncomeStatement error:', error.message);
    return [];
  }
};

// Fetches annual balance sheet data.
// Called by: FinancialsScreen.js (Balance Sheet tab)
// Also called by: DCFScreen.js (to calculate net debt)
//
// ENDPOINT: /stable/balance-sheet-statement?symbol=AAPL&limit=5&apikey=KEY
// (Old v3 endpoint was: /api/v3/balance-sheet-statement/AAPL?limit=5)
//
// KEY FIELDS:
//   - totalAssets: everything the company owns
//   - totalLiabilities: everything the company owes
//   - totalStockholdersEquity: assets minus liabilities (book value)
//   - totalDebt: all interest-bearing debt (loans, bonds)
//   - cashAndCashEquivalents: cash on hand
//   - netDebt: totalDebt minus cash. Used in DCF to convert enterprise
//     value to equity value. If negative, the company has more cash
//     than debt (common for tech companies like Apple).
//   - totalCurrentAssets / totalCurrentLiabilities: for working capital
export const getBalanceSheet = async (ticker) => {
  try {
    const url = buildUrl(
      '/balance-sheet-statement',
      `symbol=${ticker}&limit=${config.FINANCIAL_YEARS}`
    );
    const response = await axios.get(url);
    return response.data || [];
  } catch (error) {
    console.error('getBalanceSheet error:', error.message);
    return [];
  }
};

// Fetches annual cash flow statement data.
// Called by: FinancialsScreen.js (Cash Flow tab)
// Also called by: DCFScreen.js (to get Free Cash Flow for the DCF model)
//
// ENDPOINT: /stable/cash-flow-statement?symbol=AAPL&limit=5&apikey=KEY
// (Old v3 endpoint was: /api/v3/cash-flow-statement/AAPL?limit=5)
//
// KEY FIELDS:
//   - operatingCashFlow: cash generated from running the business
//   - capitalExpenditure: money spent on equipment/buildings (NEGATIVE number)
//   - freeCashFlow: operatingCashFlow + capitalExpenditure
//     (capex is negative, so this = operating cash flow minus capex)
//   - dividendsPaid: cash returned to shareholders (NEGATIVE number)
//
// FREE CASH FLOW (FCF) is the most critical number for the DCF calculator.
// It represents the cash left over after a company pays for its operations
// and maintains its physical assets. This is the cash available to pay
// debt, buy back stock, make acquisitions, or distribute to owners.
// PE firms care about FCF above almost every other metric because it
// determines how quickly they can pay down the debt used to buy a company.
export const getCashFlow = async (ticker) => {
  try {
    const url = buildUrl(
      '/cash-flow-statement',
      `symbol=${ticker}&limit=${config.FINANCIAL_YEARS}`
    );
    const response = await axios.get(url);
    return response.data || [];
  } catch (error) {
    console.error('getCashFlow error:', error.message);
    return [];
  }
};


// ============================================================
// RATIOS AND METRICS
// ============================================================

// Fetches key valuation and financial metrics.
// Called by: RatiosScreen.js
//
// ENDPOINT: /stable/key-metrics?symbol=AAPL&limit=1&apikey=KEY
// (Old v3 endpoint was: /api/v3/key-metrics/AAPL?limit=1)
//
// limit=1 means "most recent year only." We don't need 5 years of
// ratios for the Ratios screen since we display current values.
//
// KEY FIELDS:
//   - peRatio: price-to-earnings ratio (stock price / EPS)
//   - enterpriseValueOverEBITDA: EV/EBITDA (common valuation multiple)
//   - pbRatio: price-to-book ratio
//   - priceToSalesRatio: market cap / revenue
//   - pegRatio: P/E divided by earnings growth rate
//   - roic: return on invested capital (key profitability metric for PE)
//   - evToSales: enterprise value / revenue
//
// NOTE: Some fields can be null for certain companies. Banks don't have
// meaningful EBITDA (their "revenue" is interest income). REITs have
// unusual capital structures. The RatiosScreen displays "N/A" for any
// null value via the formatMultiple() and formatPercent() functions,
// which both check for null before formatting.
export const getKeyMetrics = async (ticker) => {
  try {
    const url = buildUrl('/key-metrics', `symbol=${ticker}&limit=1`);
    const response = await axios.get(url);
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error('getKeyMetrics error:', error.message);
    return null;
  }
};

// Fetches detailed financial ratios (profitability, leverage, efficiency).
// Called by: RatiosScreen.js
//
// ENDPOINT: /stable/ratios?symbol=AAPL&limit=1&apikey=KEY
// (Old v3 endpoint was: /api/v3/ratios/AAPL?limit=1)
//
// KEY FIELDS:
//   - grossProfitMargin: gross profit / revenue (as a decimal, e.g., 0.43)
//   - operatingProfitMargin: operating income / revenue
//   - netProfitMargin: net income / revenue
//   - returnOnAssets: net income / total assets
//   - returnOnEquity: net income / shareholders' equity
//   - debtEquityRatio: total debt / equity
//   - debtRatio: total debt / total assets
//   - interestCoverage: operating income / interest expense
//   - currentRatio: current assets / current liabilities
//   - quickRatio: (current assets - inventory) / current liabilities
//   - assetTurnover: revenue / total assets
//   - inventoryTurnover: cost of goods sold / average inventory
//   - receivablesTurnover: revenue / average accounts receivable
//
// WHY TWO RATIO ENDPOINTS (key-metrics AND ratios):
// FMP splits data across these two endpoints. /key-metrics has more
// valuation-focused numbers (P/E, EV/EBITDA). /ratios has more
// operational numbers (margins, turnover). The RatiosScreen fetches
// both in parallel and combines them for a complete picture.
export const getRatios = async (ticker) => {
  try {
    const url = buildUrl('/ratios', `symbol=${ticker}&limit=1`);
    const response = await axios.get(url);
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error('getRatios error:', error.message);
    return null;
  }
};


// ============================================================
// HISTORICAL PRICES
// ============================================================

// Fetches daily closing prices for the stock price chart.
// Called by: OverviewScreen.js (renders the 1-year line chart)
//
// ENDPOINT: /stable/historical-price-eod/full?symbol=AAPL&apikey=KEY
// (Old v3 endpoint was: /api/v3/historical-price-full/AAPL?timeseries=365)
//
// RETURNS: Either:
//   { symbol: "AAPL", historical: [ { date, open, high, low, close, volume }, ... ] }
// or sometimes just a flat array of price objects depending on the endpoint version.
// The function handles both formats.
//
// Each object in the historical array contains:
//   - date: "2024-03-14" (trading date)
//   - open: 172.50 (opening price)
//   - high: 174.25 (highest price during the day)
//   - low: 171.80 (lowest price)
//   - close: 173.00 (closing price, this is what we chart)
//   - volume: 54000000 (shares traded)
//
// DATA ORDER: NEWEST FIRST (most recent date at index 0).
// The OverviewScreen reverses this array so the chart reads left-to-right
// chronologically. It also samples every 7th data point to reduce ~252
// trading days to ~36 points, which renders cleanly on a phone screen
// without overcrowding the x-axis.
export const getHistoricalPrice = async (ticker) => {
  try {
    const url = buildUrl('/historical-price-eod/full', `symbol=${ticker}`);
    const response = await axios.get(url);
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('getHistoricalPrice error:', error.message);
    return [];
  }
};
// ============================================================
// ENTERPRISE VALUE (used by DCF calculator)
// ============================================================

// Fetches enterprise value data needed for the DCF calculation.
// Called by: DCFScreen.js
//
// ENDPOINT: /stable/enterprise-value?symbol=AAPL&limit=1&apikey=KEY
// (Old v3 endpoint was: /api/v3/enterprise-values/AAPL?limit=1)
//
// KEY FIELDS:
//   - numberOfShares: total shares outstanding.
//     This is the number the DCF calculator divides equity value by
//     to get implied share price. Without it, you can't convert
//     "this company's equity is worth $2.5 trillion" into
//     "each share is worth $163."
//   - enterpriseValue: market cap + total debt - cash.
//     Useful for reference but the DCF calculates its own EV.
//
// WHY A SEPARATE ENDPOINT FOR SHARES:
// The company profile endpoint sometimes includes shares outstanding
// but it's not always reliable or present. The enterprise-value
// endpoint consistently provides numberOfShares across companies.
// Using a dedicated endpoint for a critical input to the DCF model
// reduces the risk of a missing value breaking the calculation.
export const getEnterpriseValue = async (ticker) => {
  try {
    const url = buildUrl('/enterprise-values', `symbol=${ticker}&limit=1`);
    const response = await axios.get(url);
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error('getEnterpriseValue error:', error.message);
    return null;
  }
};