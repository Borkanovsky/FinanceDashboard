// dcfCalculator.js
// Contains the math for the Discounted Cash Flow valuation model.
// This is the financial logic behind the DCF screen. The screen handles
// UI (sliders, display). This file handles the math.
//
// WHAT A DCF DOES (in plain English):
// A company is worth the total of all cash it will generate in the future,
// adjusted for the fact that money today is worth more than money tomorrow.
// The DCF model:
// 1. Takes the company's current Free Cash Flow (FCF)
// 2. Projects it forward for 5 years using an assumed growth rate
// 3. Estimates what the company would sell for at the end of year 5
//    (the "terminal value") using an exit multiple
// 4. Discounts all those future cash flows back to today's dollars
//    using a discount rate (WACC)
// 5. Adds them up to get Enterprise Value
// 6. Subtracts net debt to get Equity Value
// 7. Divides by shares outstanding to get Implied Share Price
//
// WHY THIS MATTERS FOR PE:
// PE firms use this exact model (with more complexity) to decide how much
// to pay for a company. If the DCF says a company is worth $500M and
// you can buy it for $400M, that's a potential investment. The DCF is
// the single most important valuation tool in private equity.

// Main DCF calculation function.
//
// PARAMETERS:
// - currentFCF: number. The company's most recent annual Free Cash Flow
//   in dollars. Pulled from the cash flow statement API response.
//   Example: 111443000000 (Apple's FCF)
//
// - growthRate: number between 0 and 1. The annual rate at which you
//   expect FCF to grow. 0.10 means 10% per year. The user adjusts this
//   with a slider. Higher growth = higher valuation.
//
// - discountRate: number between 0 and 1. Also called WACC (Weighted
//   Average Cost of Capital). Represents the minimum return investors
//   require. 0.10 means 10%. Higher discount rate = LOWER valuation
//   because future cash flows are worth less in today's dollars.
//   Think of it as the "skepticism factor." More skepticism = higher
//   discount rate = lower value.
//
// - terminalMultiple: number. The EV/FCF multiple used to estimate
//   what the company would sell for at the end of the projection period.
//   15 means "the company sells for 15 times its year-5 FCF." Higher
//   multiple = higher terminal value = higher valuation.
//
// - netDebt: number. Total debt minus cash and equivalents. Subtracted
//   from enterprise value to get equity value. If the company has more
//   cash than debt, this is negative (which INCREASES equity value).
//
// - sharesOutstanding: number. Total shares. Used to convert total
//   equity value into a per-share price for comparison with the market.
//
// RETURNS: An object with:
// - projectedFCF: array of 5 numbers (projected FCF for each year)
// - discountedFCF: array of 5 numbers (present value of each year's FCF)
// - terminalValue: number (estimated sale price at end of year 5)
// - discountedTerminalValue: number (terminal value in today's dollars)
// - enterpriseValue: number (sum of discounted FCFs + discounted TV)
// - equityValue: number (enterprise value minus net debt)
// - impliedSharePrice: number (equity value divided by shares)
// - totalPVofFCF: number (sum of just the discounted annual FCFs)

export const calculateDCF = (
  currentFCF,
  growthRate,
  discountRate,
  terminalMultiple,
  netDebt,
  sharesOutstanding
) => {
  // Guard against invalid inputs that would produce NaN or Infinity.
  // If any critical input is missing, return a zeroed-out result.
  if (!currentFCF || !sharesOutstanding || sharesOutstanding === 0) {
    return {
      projectedFCF: [0, 0, 0, 0, 0],
      discountedFCF: [0, 0, 0, 0, 0],
      terminalValue: 0,
      discountedTerminalValue: 0,
      enterpriseValue: 0,
      equityValue: 0,
      impliedSharePrice: 0,
      totalPVofFCF: 0,
    };
  }

  const years = 5;
  const projectedFCF = [];
  const discountedFCF = [];

  // STEP 1: Project FCF forward for 5 years.
  // Year 1 FCF = current FCF * (1 + growth rate)
  // Year 2 FCF = Year 1 FCF * (1 + growth rate)
  // Each year compounds on the previous year.
  //
  // EXAMPLE with FCF = $100B and growth = 10%:
  // Year 1: $100B * 1.10 = $110B
  // Year 2: $110B * 1.10 = $121B
  // Year 3: $121B * 1.10 = $133.1B
  // Year 4: $133.1B * 1.10 = $146.4B
  // Year 5: $146.4B * 1.10 = $161.1B
  for (let i = 1; i <= years; i++) {
    const fcf = currentFCF * Math.pow(1 + growthRate, i);
    projectedFCF.push(fcf);
  }

  // STEP 2: Discount each projected FCF to present value.
  // Present Value = Future Value / (1 + discount rate) ^ year
  //
  // WHY WE DISCOUNT:
  // $100 a year from now is worth less than $100 today because you
  // could invest $100 today and have $110 next year (at 10% return).
  // So $100 next year is really worth about $90.91 today (100/1.10).
  // The further into the future, the more the discount compounds.
  //
  // EXAMPLE with discount rate = 10%:
  // Year 1: $110B / (1.10)^1 = $100B
  // Year 2: $121B / (1.10)^2 = $100B
  // Year 3: $133.1B / (1.10)^3 = $100B
  // (In this example, 10% growth and 10% discount cancel out perfectly)
  for (let i = 0; i < years; i++) {
    const pv = projectedFCF[i] / Math.pow(1 + discountRate, i + 1);
    discountedFCF.push(pv);
  }

  // Sum of discounted annual FCFs.
  const totalPVofFCF = discountedFCF.reduce((sum, val) => sum + val, 0);

  // STEP 3: Calculate Terminal Value.
  // This estimates what the company would be worth at the end of year 5.
  // Terminal Value = Year 5 FCF * exit multiple
  //
  // WHY A TERMINAL VALUE:
  // The company doesn't stop existing after year 5. It keeps generating
  // cash forever (theoretically). The terminal value captures all that
  // future value beyond your projection period in a single number.
  // Using a multiple (e.g., 15x FCF) is the "exit multiple method,"
  // which assumes you could sell the company at that multiple.
  const terminalValue = projectedFCF[years - 1] * terminalMultiple;

  // STEP 4: Discount the Terminal Value to present.
  // The terminal value occurs at the end of year 5, so we discount it
  // back 5 years.
  const discountedTerminalValue = terminalValue / Math.pow(1 + discountRate, years);

  // STEP 5: Enterprise Value = sum of discounted FCFs + discounted TV.
  // This is the total value of the business (debt + equity).
  const enterpriseValue = totalPVofFCF + discountedTerminalValue;

  // STEP 6: Equity Value = Enterprise Value - Net Debt.
  // Enterprise value includes both debt holders' and equity holders' claims.
  // Subtracting net debt gives you the value belonging to equity holders only.
  //
  // If net debt is negative (company has more cash than debt), this
  // INCREASES equity value. Cash-rich companies like Apple get a boost here.
  const equityValue = enterpriseValue - netDebt;

  // STEP 7: Implied Share Price = Equity Value / Shares Outstanding.
  // This is the number you compare to the current market price.
  // If implied > market price, the model suggests the stock is undervalued.
  // If implied < market price, the model suggests overvaluation.
  const impliedSharePrice = equityValue / sharesOutstanding;

  return {
    projectedFCF,
    discountedFCF,
    terminalValue,
    discountedTerminalValue,
    enterpriseValue,
    equityValue,
    impliedSharePrice: Math.max(0, impliedSharePrice), // floor at 0
    totalPVofFCF,
  };
};
