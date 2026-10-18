// dataCoverage.js
// Decides which data limitations apply to a company, so the app can warn the
// user BEFORE they hit empty screens.
//
// WHY: The app runs on FMP's Starter plan, which covers US-listed stocks.
// OTC and international companies return HTTP 402 for most endpoints, and
// some data (EBITDA multiples, DCF) isn't meaningful for banks or funds even
// when it loads. Warning up front is clearer than unexplained "N/A"s.

import { getApiError } from '../services/api';

// Major US exchanges included in the Starter plan.
const SUPPORTED_EXCHANGES = ['NASDAQ', 'NYSE', 'AMEX', 'NYSE AMERICAN', 'NYSEARCA', 'BATS', 'CBOE'];

/**
 * Builds the list of limitation warnings for a company.
 *
 * @param {Object|null} profile Company profile from getCompanyProfile().
 * @returns {{level: 'warning'|'info', text: string}[]} Warnings to display,
 *   most serious first. Empty when the company is fully supported.
 */
export const getCoverageWarnings = (profile) => {
  if (!profile) return [];
  const warnings = [];
  const exchange = String(profile.exchange || profile.exchangeShortName || '').toUpperCase();
  const country = String(profile.country || '').toUpperCase();

  // Coverage limits: data will be missing, not just less useful.
  if (exchange.includes('OTC') || exchange.includes('PNK')) {
    warnings.push({
      level: 'warning',
      text: 'This company trades over-the-counter (OTC). The price chart, financial statements, ratios, and DCF are not available on the current data plan.',
    });
  } else if (country && country !== 'US') {
    warnings.push({
      level: 'warning',
      text: `This company is based outside the US (${profile.country}). Most financial data is not available on the current data plan.`,
    });
  } else if (exchange && !SUPPORTED_EXCHANGES.some((e) => exchange.includes(e))) {
    warnings.push({
      level: 'warning',
      text: `This company is listed on ${exchange}, which may have limited data coverage.`,
    });
  }

  // A 402 means the data really is paywalled, even if the checks above
  // didn't predict it (FMP's coverage rules aren't fully published).
  if (warnings.length === 0 && getApiError('getHistoricalPrice')?.status === 402) {
    warnings.push({
      level: 'warning',
      text: 'Some data for this company is not included in the current data plan.',
    });
  }

  // Applicability limits: the data loads, but some metrics mislead.
  if (profile.sector === 'Financial Services') {
    warnings.push({
      level: 'info',
      text: 'Financial company: EV/EBITDA, liquidity ratios, and the DCF model do not apply to banks and insurers. Use P/E, P/B, and ROE instead.',
    });
  }
  if (profile.isEtf || profile.isFund) {
    warnings.push({
      level: 'info',
      text: 'This is a fund or ETF. Company financial statements, ratios, and DCF do not apply.',
    });
  }

  return warnings;
};