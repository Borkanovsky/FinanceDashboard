// RatiosScreen.js
// Displays 20+ financial ratios organized by category:
// Valuation, Profitability, Leverage, and Efficiency.
// Each ratio is displayed in a RatioCard component arranged in a 2-column grid.

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { getKeyMetrics, getRatios } from '../services/api';
import { formatMultiple, formatPercent } from '../utils/formatters';
import RatioCard from '../components/RatioCard';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

const RatiosScreen = ({ route }) => {
  const { ticker } = route.params;
  const [metrics, setMetrics] = useState(null);
  const [ratios, setRatios] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [metricsData, ratiosData] = await Promise.all([
        getKeyMetrics(ticker),
        getRatios(ticker),
      ]);
      setMetrics(metricsData);
      setRatios(ratiosData);
      console.log('METRICS:', JSON.stringify(metricsData, null, 2));
      console.log('RATIOS:', JSON.stringify(ratiosData, null, 2));
      setLoading(false);
    };
    fetchData();
  }, [ticker]);

  if (loading) return <LoadingSpinner message="Loading ratios..." />;
  if (!metrics && !ratios) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not load ratio data.</Text>
      </View>
    );
  }

  // Helper to safely get a value from either metrics or ratios objects.
  const m = (key) => metrics?.[key] ?? null;
  const r = (key) => ratios?.[key] ?? null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Valuation Ratios */}
      <Text style={styles.sectionTitle}>Valuation</Text>
      <View style={styles.cardGrid}>
    <RatioCard label="P/E Ratio" value={formatMultiple(r('priceToEarningsRatio'))} />
    <RatioCard label="EV/EBITDA" value={formatMultiple(m('evToEBITDA'))} />
    <RatioCard label="P/B Ratio" value={formatMultiple(r('priceToBookRatio'))} />
    <RatioCard label="P/S Ratio" value={formatMultiple(r('priceToSalesRatio'))} />
    <RatioCard label="PEG Ratio" value={formatMultiple(r('priceToEarningsGrowthRatio'))} />
    <RatioCard label="EV/Revenue" value={formatMultiple(m('evToSales'))} />
      </View>

      {/* Profitability Ratios */}
      <Text style={styles.sectionTitle}>Profitability</Text>
      <View style={styles.cardGrid}>
     <RatioCard label="Gross Margin" value={formatPercent(r('grossProfitMargin'))} />
    <RatioCard label="Operating Margin" value={formatPercent(r('operatingProfitMargin'))} />
    <RatioCard label="Net Margin" value={formatPercent(r('netProfitMargin'))} />
    <RatioCard label="ROE" value={formatPercent(m('returnOnEquity'))} />
    <RatioCard label="ROA" value={formatPercent(m('returnOnAssets'))} />
    <RatioCard label="ROIC" value={formatPercent(m('returnOnInvestedCapital'))} />

      </View>

      {/* Leverage Ratios */}
      <Text style={styles.sectionTitle}>Leverage</Text>
      <View style={styles.cardGrid}>
      <RatioCard label="Debt/Equity" value={formatMultiple(r('debtToEquityRatio'))} />
      <RatioCard label="Debt Ratio" value={formatMultiple(r('debtToAssetsRatio'))} />
      <RatioCard label="Interest Coverage" value={formatMultiple(r('interestCoverageRatio'))} />
      <RatioCard label="Current Ratio" value={formatMultiple(r('currentRatio'))} />
      </View>

      {/* Efficiency Ratios */}
      <Text style={styles.sectionTitle}>Efficiency</Text>
      <View style={styles.cardGrid}>
      <RatioCard label="Asset Turnover" value={formatMultiple(r('assetTurnover'))} />
      <RatioCard label="Inventory Turnover" value={formatMultiple(r('inventoryTurnover'))} />
      <RatioCard label="Receivables Turnover" value={formatMultiple(r('receivablesTurnover'))} />
      <RatioCard label="Quick Ratio" value={formatMultiple(r('quickRatio'))} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: {
    fontSize: 18, fontWeight: '800', color: colors.primary,
    marginTop: 8, marginBottom: 12,
  },
  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', marginBottom: 8,
  },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.negative },
});

export default RatiosScreen;
