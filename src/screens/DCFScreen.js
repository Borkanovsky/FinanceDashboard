// DCFScreen.js
// Interactive DCF valuation calculator. Pre-fills with the company's real
// data and lets the user pick the growth rate, discount rate, and terminal
// multiple from preset buttons. The implied share price updates instantly.
//
// DATA FLOW:
// 1. Screen mounts and fetches cash flow (FCF), balance sheet (net debt),
//    enterprise value (shares outstanding), and profile (market price).
// 2. If FCF or share count is missing, it shows an error instead of a
//    misleading $0.00 valuation.
// 3. The starting growth rate is estimated from the company's own FCF history.
// 4. Every button press updates state, and useMemo re-runs calculateDCF().

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { getCashFlow, getBalanceSheet, getEnterpriseValue, getCompanyProfile } from '../services/api';
import { calculateDCF } from '../utils/dcfCalculator';
import { formatCurrency, formatPrice } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

// Preset choices for each assumption. Kept as constants (not inline in JSX) so
// the ranges are easy to find and tune in one place.
const GROWTH_PRESETS = [-0.05, 0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
const DISCOUNT_PRESETS = [0.06, 0.08, 0.10, 0.12, 0.14];
const MULTIPLE_PRESETS = [8, 10, 12, 15, 18, 20, 25];

// The auto-estimated growth rate is clamped to this range. Historical FCF can
// swing wildly (one bad year makes growth look like +200%), and projecting
// that forward 5 years would produce absurd valuations.
const MIN_AUTO_GROWTH = -0.10;
const MAX_AUTO_GROWTH = 0.30;

/**
 * Compares two rates with a small tolerance. Floating-point math means a
 * computed 0.1 isn't always exactly equal to the literal 0.10, so `===` can
 * fail to highlight the matching preset button.
 *
 * @param {number} a
 * @param {number} b
 * @returns {boolean} True if the values are effectively equal.
 */
const sameRate = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * Estimates a starting growth rate from historical FCF using a CAGR over up to
 * 2 years: (recent / older)^(1/years) − 1.
 *
 * A CAGR only makes sense when both endpoints are positive (the ratio of a
 * negative and a positive number has no real root), so in that case we return
 * null and the screen keeps its 10% default. The old code substituted 1 for a
 * missing FCF, which turned "no data" into a −100% growth estimate.
 *
 * @param {Object[]} cashFlowData Cash flow statements, newest first.
 * @returns {number|null} Growth rate rounded to 2 decimals, or null if it can't be estimated.
 */
const estimateGrowthRate = (cashFlowData) => {
  if (!Array.isArray(cashFlowData) || cashFlowData.length < 2) return null;
  const years = Math.min(2, cashFlowData.length - 1);
  const recent = cashFlowData[0]?.freeCashFlow;
  const older = cashFlowData[years]?.freeCashFlow;
  if (!(recent > 0) || !(older > 0)) return null;

  const cagr = Math.pow(recent / older, 1 / years) - 1;
  const clamped = Math.max(MIN_AUTO_GROWTH, Math.min(MAX_AUTO_GROWTH, cagr));
  return Number(clamped.toFixed(2));
};

/**
 * One labeled row of preset buttons (e.g. "Growth Rate: 10%").
 *
 * @param {Object} props
 * @param {string} props.label             Row title.
 * @param {number[]} props.options         Preset values.
 * @param {number} props.value             Currently selected value.
 * @param {(v: number) => void} props.onSelect Called with the tapped value.
 * @param {(v: number) => string} props.format Turns a value into button text.
 * @returns {JSX.Element}
 */
const PresetRow = ({ label, options, value, onSelect, format }) => (
  <View style={styles.inputSection}>
    {/* Showing the current value matters because the auto-estimated growth
        rate (e.g. 7%) often isn't one of the presets, so no button lights up. */}
    <Text style={styles.inputLabel}>
      {label}: <Text style={styles.inputValue}>{format(value)}</Text>
    </Text>
    <View style={styles.presetRow}>
      {options.map((option) => {
        const selected = sameRate(option, value);
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.presetButton, selected && styles.presetButtonSelected]}
          >
            <Text style={[styles.presetText, selected && styles.presetTextSelected]}>
              {format(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

/** @param {number} rate Decimal rate. @returns {string} Whole-number percent, e.g. "10%". */
const pct = (rate) => `${Math.round(rate * 100)}%`;

/**
 * DCF valuation screen.
 *
 * @param {Object} props
 * @param {{params: {ticker: string}}} props.route React Navigation route; `ticker` picks the company.
 * @returns {JSX.Element}
 */
const DCFScreen = ({ route }) => {
  const { ticker } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw data from the API.
  const [currentFCF, setCurrentFCF] = useState(0);
  const [netDebt, setNetDebt] = useState(0);
  const [sharesOutstanding, setSharesOutstanding] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [isFinancial, setIsFinancial] = useState(false);
  // User-adjustable assumptions.
  const [growthRate, setGrowthRate] = useState(0.10);
  const [discountRate, setDiscountRate] = useState(0.10);
  const [terminalMultiple, setTerminalMultiple] = useState(15);

  useEffect(() => {
    // If the user switches tickers before this request finishes, the old
    // response must not overwrite the new company's data. The cleanup
    // function flips this flag so late responses are ignored.
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIsFinancial(false);
      // The api.js functions never throw; they return [] or null on failure.
      // That's why the old try/catch here never fired: missing data showed up
      // as a "$0.00 – Potentially Overvalued" result instead of an error.
      const [cashFlowData, balanceData, evData, profileData] = await Promise.all([
        getCashFlow(ticker),
        getBalanceSheet(ticker),
        getEnterpriseValue(ticker),
        getCompanyProfile(ticker),
      ]);
      if (cancelled) return;
       // A free-cash-flow DCF doesn't work for banks and insurers. Their
      // "operating cash flow" includes loans made and deposits received, so it
      // swings by tens of billions a year, and debt is raw material for the
      // business rather than financing. Feeding those numbers in produced a
      // meaningless $0.00 price for JPM, so we stop here and explain instead.
      if (profileData?.sector === 'Financial Services') {
        setIsFinancial(true);
        setLoading(false);
        return;
      }
      const fcf = cashFlowData[0]?.freeCashFlow;
      const shares = evData?.numberOfShares;

      if (!Number.isFinite(fcf) || fcf === 0 || !(shares > 0)) {
        setError(`Not enough data to value ${ticker}: free cash flow or share count is missing.`);
        setLoading(false);
        return;
      }

      setCurrentFCF(fcf);
      setSharesOutstanding(shares);

      if (balanceData.length > 0) {
        const debt = balanceData[0].totalDebt || 0;
        const cash = balanceData[0].cashAndCashEquivalents || 0;
        setNetDebt(debt - cash);
      }

      setCurrentPrice(profileData?.price > 0 ? profileData.price : 0);

      const estimated = estimateGrowthRate(cashFlowData);
      if (estimated !== null) setGrowthRate(estimated);

      setLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [ticker]);
   
  // Memoized so the valuation only recalculates when an input changes, not on
  // every unrelated re-render.
  const dcfResult = useMemo(
    () => calculateDCF(currentFCF, growthRate, discountRate, terminalMultiple, netDebt, sharesOutstanding),
    [currentFCF, growthRate, discountRate, terminalMultiple, netDebt, sharesOutstanding]
  );

  if (loading) return <LoadingSpinner message="Loading valuation data..." />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
    if (isFinancial) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.bankTitle}>DCF not applicable</Text>
        <Text style={styles.bankText}>
          {ticker} is a financial company. A free-cash-flow DCF isn't meaningful for banks
          and insurers because their cash flows include lending and deposit activity.
          Use P/E, P/B, and ROE on the Ratios tab instead.
        </Text>
      </View>
    );
  }

  const impliedPrice = dcfResult.impliedSharePrice;
  // Without a market price there's nothing to compare against. The old code
  // labeled every stock "Potentially Undervalued" with "0% upside" in that case.
  const hasMarketPrice = currentPrice > 0;
  const isUndervalued = hasMarketPrice && impliedPrice > currentPrice;
  const verdictColor = !hasMarketPrice
    ? colors.textSecondary
    : isUndervalued ? colors.positive : colors.negative;
  const verdictText = !hasMarketPrice
    ? 'Market price unavailable'
    : isUndervalued ? 'Potentially Undervalued' : 'Potentially Overvalued';
  const upsidePct = hasMarketPrice ? ((impliedPrice - currentPrice) / currentPrice) * 100 : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>DCF Valuation</Text>
      <Text style={styles.subtitle}>{ticker} · Discounted Cash Flow Model</Text>

      {/* Current data summary */}
      <View style={styles.dataCard}>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Current FCF</Text>
          <Text style={styles.dataValue}>{formatCurrency(currentFCF)}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Net Debt</Text>
          <Text style={styles.dataValue}>{formatCurrency(netDebt)}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Market Price</Text>
          <Text style={styles.dataValue}>{hasMarketPrice ? formatPrice(currentPrice) : 'N/A'}</Text>
        </View>
      </View>

      {currentFCF < 0 && (
        <Text style={styles.warning}>
          This company's free cash flow is negative, so "growth" projects larger losses.
          A DCF is unreliable for cash-burning companies.
        </Text>
      )}

      {/* Assumption pickers. These rows previously had no labels, so users
          couldn't tell which row controlled growth vs. discount rate. */}
      <PresetRow label="FCF Growth Rate" options={GROWTH_PRESETS} value={growthRate} onSelect={setGrowthRate} format={pct} />
      <PresetRow label="Discount Rate (WACC)" options={DISCOUNT_PRESETS} value={discountRate} onSelect={setDiscountRate} format={pct} />
      <PresetRow label="Terminal Multiple" options={MULTIPLE_PRESETS} value={terminalMultiple} onSelect={setTerminalMultiple} format={(m) => `${m}x`} />

      {/* Projected FCF table */}
      <View style={styles.projectionCard}>
        <Text style={styles.projectionTitle}>Projected Free Cash Flow</Text>
        {dcfResult.projectedFCF.map((fcf, i) => (
          <View key={`year-${i}`} style={styles.projRow}>
            <Text style={styles.projLabel}>Year {i + 1}</Text>
            <Text style={styles.projValue}>{formatCurrency(fcf)}</Text>
            <Text style={styles.projPV}>PV: {formatCurrency(dcfResult.discountedFCF[i])}</Text>
          </View>
        ))}
        <View style={[styles.projRow, styles.projTotalRow]}>
          <Text style={styles.projTotalLabel}>Terminal Value</Text>
          <Text style={styles.projTotalValue}>{formatCurrency(dcfResult.terminalValue)}</Text>
          <Text style={styles.projPV}>PV: {formatCurrency(dcfResult.discountedTerminalValue)}</Text>
        </View>
      </View>

      {/* Result */}
      <View style={[styles.resultCard, { borderColor: verdictColor }]}>
        <Text style={styles.resultLabel}>Implied Share Price</Text>
        <Text style={[styles.resultPrice, { color: verdictColor }]}>{formatPrice(impliedPrice)}</Text>
        {hasMarketPrice && (
          <Text style={styles.resultVs}>vs. Market Price: {formatPrice(currentPrice)}</Text>
        )}
        <Text style={[styles.verdict, { color: verdictColor }]}>{verdictText}</Text>
        {upsidePct !== null && (
          <Text style={[styles.upside, { color: verdictColor }]}>
            {upsidePct > 0 ? '+' : ''}{upsidePct.toFixed(1)}% {isUndervalued ? 'upside' : 'downside'}
          </Text>
        )}
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>PV of Projected FCFs</Text>
          <Text style={styles.summaryValue}>{formatCurrency(dcfResult.totalPVofFCF)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>PV of Terminal Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(dcfResult.discountedTerminalValue)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Enterprise Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(dcfResult.enterpriseValue)}</Text>
        </View>
        <View style={styles.summaryRow}>
          {/* Net debt is SUBTRACTED. When it's negative (more cash than debt),
              subtracting it adds value, so label it as a plus for clarity. */}
          <Text style={styles.summaryLabel}>{netDebt >= 0 ? 'Less: Net Debt' : 'Plus: Net Cash'}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(Math.abs(netDebt))}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Equity Value</Text>
          <Text style={styles.summaryTotalValue}>{formatCurrency(dcfResult.equityValue)}</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        This is a simplified DCF model for educational and analytical purposes only.
        It is not financial advice. Real valuations involve much more, including detailed
        revenue projections, margin analysis, working capital modeling, and scenario analysis.
      </Text>
    </ScrollView>
  );
};

const cardShadow = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, paddingTop: 16 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  dataCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16, ...cardShadow },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  dataLabel: { fontSize: 14, color: colors.textSecondary },
  dataValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  warning: { fontSize: 13, color: colors.negative, marginBottom: 12, lineHeight: 18 },
  inputSection: { marginBottom: 14 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  inputValue: { color: colors.secondary, fontWeight: '800' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetButton: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  presetButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  presetTextSelected: { color: '#FFF' },
  projectionCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16, ...cardShadow },
  projectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  projRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  projLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  projValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1, textAlign: 'center' },
  projPV: { fontSize: 12, color: colors.textMuted, flex: 1, textAlign: 'right' },
  projTotalRow: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: colors.primary, marginTop: 4, paddingTop: 8 },
  projTotalLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, flex: 1 },
  projTotalValue: { fontSize: 13, fontWeight: '700', color: colors.primary, flex: 1, textAlign: 'center' },
  resultCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 20, marginBottom: 16,
    alignItems: 'center', borderWidth: 2, ...cardShadow,
  },
  resultLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  resultPrice: { fontSize: 36, fontWeight: '800' },
  resultVs: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  verdict: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  upside: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16, ...cardShadow },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  summaryTotalRow: { borderTopWidth: 2, borderTopColor: colors.primary, marginTop: 4, paddingTop: 8 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.primary },
  summaryTotalValue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  disclaimer: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 40, textAlign: 'center', paddingHorizontal: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.negative, textAlign: 'center' },
  bankTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 8, textAlign: 'center' },
  bankText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

export default DCFScreen;
