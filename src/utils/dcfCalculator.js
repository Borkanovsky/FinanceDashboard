// dcfCalculator.js
// The math behind the DCF screen. The screen handles the UI (preset buttons,
// display); this file only does the valuation math, so it can be tested on
// its own without React.
//
// WHAT A DCF DOES (in plain English):
// A company is worth the total of all the cash it will generate in the future,
// adjusted for the fact that money today is worth more than money tomorrow.
// 1. Take the company's current Free Cash Flow (FCF)
// 2. Project it forward 5 years using an assumed growth rate
// 3. Estimate what the company would sell for at the end of year 5
//    (the "terminal value") using an exit multiple
// 4. Discount all of those future cash flows back to today's dollars
//    using a discount rate (WACC)
// 5. Add them up to get Enterprise Value
// 6. Subtract net debt to get Equity Value
// 7. Divide by shares outstanding to get the Implied Share Price
//
// WHY THIS MATTERS FOR PE:
// PE firms use this same model (with more detail) to decide how much to pay
// for a company. If the DCF says a company is worth $500M and you can buy it
// for $400M, that's a potential investment.

/** Number of years we project cash flows before applying the terminal value. */
const PROJECTION_YEARS = 5;

/**
 * @typedef {Object} DCFResult
 * @property {number[]} projectedFCF        Projected FCF for years 1–5.
 * @property {number[]} discountedFCF       Present value of each projected FCF.
 * @property {number}   terminalValue       Estimated sale value at the end of year 5.
 * @property {number}   discountedTerminalValue Terminal value in today's dollars.
 * @property {number}   enterpriseValue     Sum of discounted FCFs + discounted terminal value.
 * @property {number}   equityValue         Enterprise value minus net debt (can be negative).
 * @property {number}   impliedSharePrice   Equity value per share, floored at 0.
 * @property {number}   totalPVofFCF        Sum of the discounted annual FCFs only.
 * @property {boolean}  isValid             False when inputs were missing/invalid and
 *                                          the result is a zeroed placeholder.
 */

/**
 * Builds the all-zero result returned when the inputs can't produce a
 * meaningful valuation. Returning the same shape (instead of null) means the
 * screen can always render the table without extra null checks.
 *
 * @returns {DCFResult}
 */
const emptyResult = () => ({
  projectedFCF: Array(PROJECTION_YEARS).fill(0),
  discountedFCF: Array(PROJECTION_YEARS).fill(0),
  terminalValue: 0,
  discountedTerminalValue: 0,
  enterpriseValue: 0,
  equityValue: 0,
  impliedSharePrice: 0,
  totalPVofFCF: 0,
  isValid: false,
});

/**
 * Runs a 5-year DCF using the exit-multiple method for terminal value.
 *
 * @param {number} currentFCF        Most recent annual Free Cash Flow in dollars
 *                                   (e.g. 111443000000 for Apple). Must be non-zero.
 * @param {number} growthRate        Annual FCF growth as a decimal (0.10 = 10%).
 *                                   Higher growth → higher valuation.
 * @param {number} discountRate      Discount rate / WACC as a decimal (0.10 = 10%).
 *                                   Higher rate → LOWER valuation, because future cash
 *                                   is worth less today. Think "skepticism factor."
 * @param {number} terminalMultiple  EV/FCF exit multiple applied to year-5 FCF
 *                                   (15 = "sells for 15× its year-5 FCF").
 * @param {number} [netDebt=0]       Total debt minus cash. Negative when the company
 *                                   holds more cash than debt, which RAISES equity value.
 * @param {number} sharesOutstanding Share count used to convert equity value to a
 *                                   per-share price. Must be > 0.
 * @returns {DCFResult} The full valuation breakdown. `isValid` is false (and all
 *                      numbers are 0) when any required input is missing or invalid.
 *
 * @example
 * calculateDCF(100e9, 0.10, 0.10, 15, -50e9, 15e9).impliedSharePrice; // ≈ 136.67
 */
export const calculateDCF = (
  currentFCF,
  growthRate,
  discountRate,
  terminalMultiple,
  netDebt = 0,
  sharesOutstanding
) => {
  // Guard against inputs that would silently produce NaN or Infinity.
  // Number.isFinite rejects null, undefined, NaN, Infinity AND numeric strings,
  // which the old `!value` check let through (e.g. growthRate = undefined made
  // every projection NaN). A discount rate of -100% or lower would divide by
  // zero or flip signs, so it's rejected too.
  const inputsAreValid =
    Number.isFinite(currentFCF) && currentFCF !== 0 &&
    Number.isFinite(growthRate) &&
    Number.isFinite(discountRate) && discountRate > -1 &&
    Number.isFinite(terminalMultiple) &&
    Number.isFinite(sharesOutstanding) && sharesOutstanding > 0;

  if (!inputsAreValid) return emptyResult();

  // A missing net debt shouldn't kill the whole valuation; treating it as 0
  // just means "assume debt and cash cancel out."
  const safeNetDebt = Number.isFinite(netDebt) ? netDebt : 0;

  const projectedFCF = [];
  const discountedFCF = [];

  // STEP 1 + 2: Project each year's FCF, then discount it to today.
  // Projection compounds from the current FCF:  FCF × (1 + g)^year
  // Discounting reverses that with the WACC:     FCF_year / (1 + r)^year
  //
  // Why discount at all? $100 a year from now is worth less than $100 today,
  // because today's $100 could be invested at r and grow. At r = 10%, $110
  // next year is worth exactly $100 today. The further out the cash, the more
  // the discount compounds.
  //
  // NOTE ON NEGATIVE FCF: if currentFCF < 0, "growth" makes the losses grow
  // too, which drives the valuation down. That is mathematically consistent
  // but usually not what an analyst intends for a cash-burning company, so the
  // screen shows a warning in that case instead of hiding it here.
  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    const fcf = currentFCF * Math.pow(1 + growthRate, year);
    projectedFCF.push(fcf);
    discountedFCF.push(fcf / Math.pow(1 + discountRate, year));
  }

  const totalPVofFCF = discountedFCF.reduce((sum, val) => sum + val, 0);

  // STEP 3: Terminal value (exit-multiple method).
  // The company doesn't stop existing after year 5, so we capture everything
  // beyond the projection window in one number: what a buyer would pay for it
  // at the end of year 5, expressed as a multiple of that year's FCF.
  const terminalValue = projectedFCF[PROJECTION_YEARS - 1] * terminalMultiple;

  // STEP 4: The sale happens at the END of year 5, so it is discounted back
  // the full 5 years, same as the year-5 cash flow.
  const discountedTerminalValue = terminalValue / Math.pow(1 + discountRate, PROJECTION_YEARS);

  // STEP 5: Enterprise value = value of the whole business (debt + equity claims).
  const enterpriseValue = totalPVofFCF + discountedTerminalValue;

  // STEP 6: Debt holders get paid before shareholders, so subtract net debt to
  // isolate what belongs to equity holders. Cash-rich companies (negative net
  // debt, like Apple) get a boost here.
  const equityValue = enterpriseValue - safeNetDebt;

  // STEP 7: Per-share value to compare against the market price.
  // The share price is floored at 0 because a stock can't trade below zero
  // (shareholders have limited liability). equityValue is intentionally NOT
  // floored, so the summary table still shows a negative equity value
  // honestly when debt exceeds the business's value.
  const impliedSharePrice = Math.max(0, equityValue / sharesOutstanding);

  return {
    projectedFCF,
    discountedFCF,
    terminalValue,
    discountedTerminalValue,
    enterpriseValue,
    equityValue,
    impliedSharePrice,
    totalPVofFCF,
    isValid: true,
  };
};
