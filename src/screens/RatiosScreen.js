// RatiosScreen.js
// Shows 20 financial ratios grouped into Valuation, Profitability, Leverage,
// and Efficiency, each in a RatioCard on a 2-column grid.

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { getKeyMetrics, getRatios, getCompanyProfile } from '../services/api';
import { formatMultiple, formatPercent } from '../utils/formatters';
import RatioCard from '../components/RatioCard';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

/**
 * Ratios screen. Combines /key-metrics (EV multiples, returns) with /ratios
 * (price multiples, margins, leverage, turnover) because FMP splits them
 * across two endpoints.
 *
 * @param {Object} props
 * @param {{params: {ticker: string}}} props.route React Navigation route; `ticker` picks the company.
 * @returns {JSX.Element}
 */
const RatiosScreen = ({ route }) => {
  const { ticker } = route.params;
  const [metrics, setMetrics] = useState(null);
  const [ratios, setRatios] = useState(null);
  const [profile, setProfile] = useState(null);   // ← add this line
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Prevents a slow response for the previous ticker from overwriting the
    // current one when the user switches companies quickly.
    let cancelled = false;

       const fetchData = async () => {
      setLoading(true);
      const [metricsData, ratiosData, profileData] = await Promise.all([
        getKeyMetrics(ticker),
        getRatios(ticker),
        getCompanyProfile(ticker),
      ]);
      if (cancelled) return;
      setMetrics(metricsData);
      setRatios(ratiosData);
      setProfile(profileData);
      setLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) return <LoadingSpinner message="Loading ratios..." />;
  if (!metrics && !ratios) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not load ratio data.</Text>
      </View>
    );
  }

  /**
   * Reads a field from the key-metrics response.
   * @param {string} key Field name. @returns {*} The value, or null if missing.
   */
  const m = (key) => metrics?.[key] ?? null;

  /**
   * Reads a field from the ratios response.
   * @param {string} key Field name. @returns {*} The value, or null if missing.
   */
  const r = (key) => ratios?.[key] ?? null;

  // FMP reports interest coverage as exactly 0 when a company doesn't break
  // out interest expense (Apple folds it into "other income"). A real coverage
  // of 0x would mean the company can't pay ANY interest, which is wildly
  // wrong for Apple, so 0 is treated as "not available."
// FMP reports 0 instead of null when a company doesn't report the underlying
// line item (no inventory, no separate interest expense). A true 0x would be
// meaningless or alarming, so 0 is treated as "not available."
const rNonZero = (key) => (r(key) === 0 ? null : r(key));

// EBITDA- and liquidity-based ratios don't apply to financial firms: interest
// is a bank's core business, and its "current assets" are mostly loans.
// Analysts value banks on P/E and P/B instead, so these show N/A.
const isFinancial = profile?.sector === 'Financial Services';
const notForBanks = (value) => (isFinancial ? null : value);
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Valuation</Text>
      <View style={styles.cardGrid}>
        <RatioCard label="P/E Ratio" value={formatMultiple(r('priceToEarningsRatio'))} />
        <RatioCard label="EV/EBITDA" value={formatMultiple(notForBanks(m('evToEBITDA')))} />      
        <RatioCard label="P/B Ratio" value={formatMultiple(r('priceToBookRatio'))} />
        <RatioCard label="P/S Ratio" value={formatMultiple(r('priceToSalesRatio'))} />
        <RatioCard label="PEG Ratio" value={formatMultiple(r('priceToEarningsGrowthRatio'))} />
        <RatioCard label="EV/Revenue" value={formatMultiple(notForBanks(m('evToSales')))} />      
      </View>

      <Text style={styles.sectionTitle}>Profitability</Text>
      <View style={styles.cardGrid}>
         <RatioCard label="Gross Margin" value={formatPercent(r('grossProfitMargin'))} />
        <RatioCard label="Operating Margin" value={formatPercent(r('operatingProfitMargin'))} />
        <RatioCard label="Net Margin" value={formatPercent(r('netProfitMargin'))} />
        <RatioCard label="ROE" value={formatPercent(m('returnOnEquity'))} />
        <RatioCard label="ROA" value={formatPercent(m('returnOnAssets'))} />
        <RatioCard label="ROIC" value={formatPercent(m('returnOnInvestedCapital'))} />
      </View>

      <Text style={styles.sectionTitle}>Leverage</Text>
      <View style={styles.cardGrid}>
        <RatioCard label="Debt/Equity" value={formatMultiple(r('debtToEquityRatio'))} />
        <RatioCard label="Debt Ratio" value={formatPercent(r('debtToAssetsRatio'))} />
        <RatioCard label="Interest Coverage" value={formatMultiple(rNonZero('interestCoverageRatio'))} />  
        <RatioCard label="Current Ratio" value={formatMultiple(notForBanks(r('currentRatio')))} />     
      </View>

      <Text style={styles.sectionTitle}>Efficiency</Text>
      <View style={styles.cardGrid}>
        <RatioCard label="Asset Turnover" value={formatMultiple(r('assetTurnover'))} />
        <RatioCard label="Inventory Turnover" value={formatMultiple(rNonZero('inventoryTurnover'))} /> 
        <RatioCard label="Receivables Turnover" value={formatMultiple(r('receivablesTurnover'))} />
        <RatioCard label="Quick Ratio" value={formatMultiple(notForBanks(r('quickRatio')))} />          
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 8, marginBottom: 12 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.negative },
});

export default RatiosScreen;
