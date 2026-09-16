// formatters.js
// Utility functions for displaying numbers in human-readable formats.
// Financial data from the API arrives as raw integers (e.g., revenue of
// 394328000000). Displaying that raw number is unreadable. These functions
// convert it to "$394.3B" or "28.5x" or "15.2%" depending on context.
//
// WHY THIS FILE EXISTS:
// Without centralized formatters, every screen reinvents number formatting
// with slightly different logic. One screen might show "$394B" while another
// shows "$394,328,000,000" for the same number. Centralizing ensures
// consistency across the entire app.
//
// EVERY FORMATTER HANDLES NULL/UNDEFINED:
// API data frequently contains null values (e.g., a company might not report
// EBITDA, or a ratio might not be calculable). Every function here checks
// for null/undefined and returns a safe fallback string like "N/A" instead
// of crashing the app with "Cannot read property of null."

// Formats large dollar amounts into abbreviated strings.
// 394328000000 becomes "$394.3B"
// 12500000 becomes "$12.5M"
// 850000 becomes "$850.0K"
// 1234 becomes "$1,234"
//
// HOW IT WORKS:
// Check the magnitude of the number by comparing against thresholds
// (1 trillion, 1 billion, 1 million, 1 thousand). Divide by the
// appropriate factor and append the suffix. toFixed(1) ensures one
// decimal place for consistency.
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e12) {
    return `${sign}$${(absValue / 1e12).toFixed(1)}T`;
  }
  if (absValue >= 1e9) {
    return `${sign}$${(absValue / 1e9).toFixed(1)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}$${(absValue / 1e6).toFixed(1)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}$${(absValue / 1e3).toFixed(1)}K`;
  }
  return `${sign}$${absValue.toFixed(2)}`;
};

// Formats large numbers WITHOUT a dollar sign (for shares outstanding, etc.).
// 15400000000 becomes "15.4B"
// 250000000 becomes "250.0M"
export const formatLargeNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e12) return `${sign}${(absValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${sign}${(absValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${sign}${(absValue / 1e6).toFixed(1)}M`;
  if (absValue >= 1e3) return `${sign}${(absValue / 1e3).toFixed(1)}K`;
  return `${sign}${absValue.toFixed(0)}`;
};

// Formats a decimal as a percentage string.
// 0.1523 becomes "15.2%"
// -0.034 becomes "-3.4%"
// null becomes "N/A"
//
// IMPORTANT: The FMP API is inconsistent about whether ratios are returned
// as decimals (0.15) or percentages (15.0). Some endpoints return gross
// margin as 0.43 (meaning 43%), others return it as 43.0. Check the raw
// data for each field. If the value is already > 1 and you know it's a
// percentage, don't multiply by 100.
export const formatPercent = (value, alreadyPercent = false) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const pct = alreadyPercent ? value : value * 100;
  return `${pct.toFixed(1)}%`;
};

// Formats a ratio/multiple with "x" suffix.
// 28.5 becomes "28.5x"
// Used for P/E, EV/EBITDA, terminal multiples, etc.
export const formatMultiple = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(1)}x`;
};

// Formats a stock price with 2 decimal places.
// 178.7234 becomes "$178.72"
export const formatPrice = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `$${Number(value).toFixed(2)}`;
};

// Formats a date string from the API into a readable format.
// "2023-09-30" becomes "Sep 2023"
// Used for chart labels and table headers.
//
// WHY "Sep 2023" INSTEAD OF "9/30/2023":
// Chart labels need to be short to fit on the x-axis without overlapping.
// "Sep 2023" is 8 characters. "9/30/2023" is 9. "September 30, 2023" is 18
// and would cause labels to collide on a phone screen.
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = dateString.split('-');
  if (parts.length < 2) return dateString;
  const monthIndex = parseInt(parts[1], 10) - 1;
  return `${months[monthIndex]} ${parts[0]}`;
};

// Formats a date string into short year format for compact chart labels.
// "2023-09-30" becomes "FY23"
// Used when 5 years of labels need to fit on a small bar chart.
export const formatFiscalYear = (dateString) => {
  if (!dateString) return 'N/A';
  const year = dateString.split('-')[0];
  return `FY${year.slice(2)}`;
};

// Determines the color for a price change (green for positive, red for negative).
// Used by OverviewScreen to color the daily change indicator.
export const getChangeColor = (value, colors) => {
  if (value === null || value === undefined) return colors.textSecondary;
  return value >= 0 ? colors.positive : colors.negative;
};
