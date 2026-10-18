// formatters.js
// Turns raw API numbers into readable strings. The API returns revenue as
// 394328000000; the UI should show "$394.3B".
//
// WHY THIS FILE EXISTS:
// Without one shared set of formatters, each screen invents its own rules and
// the same number shows up as "$394B" on one screen and "$394,328,000,000" on
// another. Centralizing keeps the whole app consistent.
//
// EVERY FORMATTER HANDLES BAD INPUT:
// FMP data often contains null (a bank has no meaningful EBITDA, a ratio can't
// be calculated, etc.). Every function returns a safe fallback like "N/A"
// instead of crashing or printing "NaN" / "Infinity" on screen.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts a value to a finite number, or returns null if that's impossible.
 * Number.isFinite is stricter than isNaN: isNaN(Infinity) is false, so the old
 * checks let Infinity through and rendered "$InfinityT" (e.g. a ratio divided
 * by zero upstream).
 *
 * @param {*} value Anything the API might send (number, numeric string, null…).
 * @returns {number|null} A finite number, or null when the value is unusable.
 */
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Scales a number into T/B/M/K form. Shared by formatCurrency and
 * formatLargeNumber so the thresholds can never drift apart.
 *
 * @param {number} num            A finite number.
 * @param {string} prefix         Text placed after the sign (e.g. "$" or "").
 * @param {number} smallDecimals  Decimal places for values under 1,000.
 * @returns {string} e.g. "-$12.5M" or "15.4B".
 */
const abbreviate = (num, prefix, smallDecimals) => {
  const absValue = Math.abs(num);
  // The sign goes BEFORE the "$" ("-$5.0M", not "$-5.0M"), which is how
  // financial statements write negatives.
  const sign = num < 0 ? '-' : '';

  if (absValue >= 1e12) return `${sign}${prefix}${(absValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${sign}${prefix}${(absValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${sign}${prefix}${(absValue / 1e6).toFixed(1)}M`;
  if (absValue >= 1e3) return `${sign}${prefix}${(absValue / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${absValue.toFixed(smallDecimals)}`;
};

/**
 * Formats a dollar amount in abbreviated form.
 *
 * @param {number|string|null|undefined} value Raw dollar amount.
 * @returns {string} e.g. "$394.3B", "$12.5M", "$850.0K", "$12.34", or "N/A".
 *
 * @example
 * formatCurrency(394328000000); // "$394.3B"
 * formatCurrency(-5e6);         // "-$5.0M"
 */
export const formatCurrency = (value) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  return abbreviate(num, '$', 2);
};

/**
 * Formats a large count WITHOUT a dollar sign (shares outstanding, volume).
 *
 * @param {number|string|null|undefined} value Raw count.
 * @returns {string} e.g. "15.4B", "250.0M", "980", or "N/A".
 */
export const formatLargeNumber = (value) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  return abbreviate(num, '', 0);
};

/**
 * Formats a ratio as a percentage with one decimal place.
 *
 * FMP is inconsistent: most /stable/ endpoints return margins as decimals
 * (0.43 = 43%), but a few fields come back already multiplied (43.0). Check
 * the raw value for a field once, then pass `alreadyPercent` if needed.
 *
 * @param {number|string|null|undefined} value Decimal ratio (0.1523) or percent (15.23).
 * @param {boolean} [alreadyPercent=false] True if `value` is already a percent.
 * @returns {string} e.g. "15.2%", "-3.4%", or "N/A".
 */
export const formatPercent = (value, alreadyPercent = false) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  const pct = alreadyPercent ? num : num * 100;
  return `${pct.toFixed(1)}%`;
};

/**
 * Formats a valuation multiple or ratio with an "x" suffix (P/E, EV/EBITDA…).
 *
 * @param {number|string|null|undefined} value The multiple.
 * @returns {string} e.g. "28.5x" or "N/A".
 */
export const formatMultiple = (value) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  return `${num.toFixed(1)}x`;
};

/**
 * Formats a stock price (or price change) with two decimals.
 *
 * @param {number|string|null|undefined} value Price in dollars.
 * @returns {string} e.g. "$178.72", "-$1.23", or "N/A".
 */
export const formatPrice = (value) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  // Previously a negative daily change rendered as "$-1.23".
  const sign = num < 0 ? '-' : '';
  return `${sign}$${Math.abs(num).toFixed(2)}`;
};

/**
 * Formats an API date ("2023-09-30") as "Sep 2023".
 *
 * Short labels matter on a phone: "September 30, 2023" is 18 characters and
 * makes chart labels collide; "Sep 2023" is 8.
 *
 * @param {string|null|undefined} dateString Date in YYYY-MM-DD form.
 * @returns {string} e.g. "Sep 2023"; the original string if it can't be parsed;
 *                   "N/A" if empty.
 */
export const formatDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return 'N/A';
  const [year, month] = dateString.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  // Guard the month lookup: "2023-13-01" or "2023" used to print "undefined 2023".
  if (!year || !(monthIndex >= 0 && monthIndex < 12)) return dateString;
  return `${MONTHS[monthIndex]} ${year}`;
};

/**
 * Formats an API date as a short fiscal-year label for compact bar charts.
 *
 * Uses the calendar year of the period-end date. That matches how most
 * companies name their fiscal year (Apple's year ending Sep 2025 is FY25).
 *
 * @param {string|null|undefined} dateString Date in YYYY-MM-DD form.
 * @returns {string} e.g. "FY23", or "N/A".
 */
export const formatFiscalYear = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return 'N/A';
  const year = dateString.split('-')[0];
  if (!/^\d{4}$/.test(year)) return 'N/A';
  return `FY${year.slice(2)}`;
};

/**
 * Picks green for gains and red for losses.
 *
 * @param {number|null|undefined} value  The price change.
 * @param {{textSecondary: string, positive: string, negative: string}} colors Palette.
 * @returns {string} A hex color. Neutral gray when the change is unknown, so a
 *                   missing value isn't shown as a red "loss."
 */
export const getChangeColor = (value, colors) => {
  const num = toFiniteNumber(value);
  if (num === null) return colors.textSecondary;
  return num >= 0 ? colors.positive : colors.negative;
};
