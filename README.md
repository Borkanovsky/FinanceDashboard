# Finance Dashboard

A mobile stock analysis app built with React Native and Expo. Search any US-listed company to see its price history, five years of financial statements, 20 financial ratios, and an interactive discounted cash flow (DCF) valuation.

<!-- DEMO VIDEO: on github.com, click the pencil icon to edit this file, delete this
     comment, and drag your demo .mp4 onto this spot. GitHub will insert the video link. -->

## Screenshots

| Search | Overview | Ratios | DCF |
|---|---|---|---|
| <img src="screenshots/search.png" width="200"> | <img src="screenshots/overview.png" width="200"> | <img src="screenshots/ratios.png" width="200"> | <img src="screenshots/dcf.png" width="200"> |

## Features

- **Company search** by ticker or company name, debounced to limit API calls, with protection against out-of-order responses showing stale results.
- **Overview**: current price, daily change, 1-year price chart, market cap, sector, and 52-week range.
- **Financial statements**: income statement, balance sheet, and cash flow for the last five fiscal years, as bar charts and tables. Chart units switch between billions and millions to fit the company's size.
- **20 financial ratios** across valuation, profitability, leverage, and efficiency.
- **Interactive DCF model**: adjust growth rate, discount rate (WACC), and terminal multiple to see the implied share price update instantly. The starting growth rate is estimated from the company's own free cash flow history.

## Finance-aware edge cases

Financial data is messy, so the app handles cases where a naive calculation would mislead:

- **Banks and insurers**: EV/EBITDA, liquidity ratios, and the DCF are hidden for financial companies, because interest is a bank's core business and its cash flow includes lending and deposit activity. The app points users to P/E, P/B, and ROE instead.
- **Negative free cash flow**: the DCF warns that projecting "growth" on negative cash flow produces unreliable valuations.
- **Missing line items**: the data provider reports 0 instead of null when a company doesn't break out a figure (for example, Apple's interest expense). The app shows N/A instead of a misleading 0.0x.
- **Coverage limits**: OTC, international, and fund tickers show a banner explaining which data isn't available, instead of empty screens.

## How it works

```
src/
├── screens/      Search, Overview, Financials, Ratios, DCF (UI only)
├── services/     api.js: the only file that talks to the data provider
├── utils/        dcfCalculator.js (valuation math), formatters.js,
│                 apiErrors.js, dataCoverage.js
├── components/   Reusable UI: RatioCard, LoadingSpinner, DataNotice
└── constants/    Colors and API configuration
```

- **Service layer**: every network request goes through `api.js`. When the data provider deprecated its v3 API in 2025, the migration to the new `/stable/` endpoints only touched this one file.
- **Errors never crash the app**: API functions return empty results on failure, and screens explain *why* data is missing (invalid key, data not included in the plan, rate limit, or no connection). Requests time out after 10 seconds instead of spinning forever.
- **Separation of math and UI**: the DCF calculation lives in a pure function that can be tested without the app.

## Tech stack

React Native · Expo · JavaScript · Axios · React Navigation · react-native-chart-kit · Financial Modeling Prep API

## Running it locally

Live data requires your own [Financial Modeling Prep](https://site.financialmodelingprep.com/) API key. The app isn't hosted publicly because of data licensing terms.

1. Clone the repo and install dependencies:
   ```
   git clone https://github.com/Borkanovsky/FinanceDashboard.git
   cd FinanceDashboard
   npm install
   ```
2. Open `src/constants/config.js` and replace `YOUR_API_KEY_HERE` with your key. Never commit your real key.
3. Start the app and scan the QR code with Expo Go:
   ```
   npx expo start
   ```

## Data coverage

Full data is available for US stocks listed on NYSE, NASDAQ, and AMEX. OTC and international companies have limited or no data on the API plan used here.

## Disclaimer

This project is for educational purposes only and is not financial advice. Data provided by Financial Modeling Prep.
