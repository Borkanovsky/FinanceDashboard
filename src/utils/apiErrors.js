// apiErrors.js
// Turns API failures into messages a user can understand.
//
// WHY: api.js returns [] or null on failure so screens never crash, but that
// hides WHY data is missing. A paywalled company and a dead internet
// connection both looked like "Could not load data." This maps each failure
// type to a specific, actionable message.

/**
 * Builds a user-facing explanation for a failed API call.
 *
 * @param {{status?: number, detail?: string, message?: string}|null} error
 *   The error recorded by api.js (see getApiError), or null.
 * @param {string} [fallback] Message to use when no error was recorded.
 * @returns {string} A short explanation to show on screen.
 */
export const explainApiError = (error, fallback = 'Data is not available for this company.') => {
  if (!error) return fallback;

  switch (error.status) {
    case 401:
      return 'Error 401: The API key is invalid or missing. Check the key in config.js.';
    case 402:
      // FMP's own text says exactly what's restricted (endpoint vs. symbol).
      return `Error 402: This data isn't included in the current FMP plan for this company.${
        error.detail ? `\n\nFMP says: "${error.detail}"` : ''
      }`;
    case 403:
      return 'Error 403: Access to this data was denied by FMP.';
    case 429:
      return 'Error 429: Too many requests. The daily API limit was reached; try again later.';
    default:
      break;
  }

  // No HTTP status means the request never got a response.
  if (/timeout/i.test(error.message || '')) {
    return 'The request timed out. Check your internet connection and try again.';
  }
  if (/network/i.test(error.message || '')) {
    return 'Network error. Check that your phone is online and try again.';
  }
  return fallback;
};