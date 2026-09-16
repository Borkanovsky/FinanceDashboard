// DCFScreen.js
// Interactive DCF valuation calculator. Pre-populates with real company
// data and lets the user adjust growth rate, discount rate, and terminal
// multiple using sliders. The implied share price updates in real-time.
//
// DATA FLOW:
// 1. Screen mounts. Fetches cash flow data (for FCF), balance sheet (for
//    net debt), and enterprise value data (for shares outstanding).
// 2. Extracts the most recent FCF, net debt, and shares outstanding.
// 3. Sets default slider values based on the company's historical data.
// 4. Runs calculateDCF() with these defaults and displays the result.
// 5. When the user moves any slider, React re-renders with new values
//    and calculateDCF() runs again with the updated inputs.

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { getCashFlow, getBalanceSheet, getEnterpriseValue, getCompanyProfile } from '../services/api';
import { calculateDCF } from '../utils/dcfCalculator';
import { formatCurrency, formatPrice, formatPercent } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

const DCFScreen = ({ route }) => {
  const { ticker } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw data from APIs
  const [currentFCF, setCurrentFCF] = useState(0);
  const [netDebt, setNetDebt] = useState(0);
  const [sharesOutstanding, setSharesOutstanding] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);

  // User-adjustable inputs (slider values)
  const [growthRate, setGrowthRate] = useState(0.10);
  const [discountRate, setDiscountRate] = useState(0.10);
  const [terminalMultiple, setTerminalMultiple] = useState(15);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cashFlowData, balanceData, evData, profileData] = await Promise.all([
          getCashFlow(ticker),
          getBalanceSheet(ticker),
          getEnterpriseValue(ticker),
          getCompanyProfile(ticker),
        ]);

        // Extract most recent FCF.
        if (cashFlowData && cashFlowData.length > 0) {
          setCurrentFCF(cashFlowData[0].freeCashFlow || 0);
        }

        // Extract net debt (total debt minus cash).
        if (balanceData && balanceData.length > 0) {
          const debt = balanceData[0].totalDebt || 0;
          const cash = balanceData[0].cashAndCashEquivalents || 0;
          setNetDebt(debt - cash);
        }

        // Extract shares outstanding.
        if (evData && evData.numberOfShares) {
          setSharesOutstanding(evData.numberOfShares);
        }

        // Extract current market price for comparison.
        if (profileData && profileData.price) {
          setCurrentPrice(profileData.price);
        }

        // Set initial growth rate based on actual revenue growth if available.
        if (cashFlowData && cashFlowData.length >= 2) {
          const recentFCF = cashFlowData[0].freeCashFlow || 1;
          const olderFCF = cashFlowData[Math.min(2, cashFlowData.length - 1)].freeCashFlow || 1;
          if (olderFCF > 0 && recentFCF > 0) {
            const years = Math.min(2, cashFlowData.length - 1);
            const impliedGrowth = Math.pow(recentFCF / olderFCF, 1 / years) - 1;
            const clampedGrowth = Math.max(-0.10, Math.min(0.30, impliedGrowth));
            setGrowthRate(parseFloat(clampedGrowth.toFixed(2)));
          }
        }
      } catch (err) {
        setError('Could not load data for DCF calculation.');
      }
      setLoading(false);
    };
    fetchData();
  }, [ticker]);

  // useMemo recalculates the DCF only when inputs change.
  // Without useMemo, the calculation would run on every render,
  // including renders caused by unrelated state changes.
  const dcfResult = useMemo(() => {
    return calculateDCF(
      currentFCF,
      growthRate,
      discountRate,
      terminalMultiple,
      netDebt,
      sharesOutstanding
    );
  }, [currentFCF, growthRate, discountRate, terminalMultiple, netDebt, sharesOutstanding]);

  if (loading) return <LoadingSpinner message="Loading valuation data..." />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const impliedPrice = dcfResult.impliedSharePrice;
  const isUndervalued = impliedPrice > currentPrice;
  const verdictColor = isUndervalued ? colors.positive : colors.negative;
  const verdictText = isUndervalued ? 'Potentially Undervalued' : 'Potentially Overvalued';
  const upside = currentPrice > 0
    ? ((impliedPrice - currentPrice) / currentPrice * 100).toFixed(1)
    : 0;

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
          <Text style={styles.dataValue}>{formatPrice(currentPrice)}</Text>
        </View>
      </View>

      {/* Sliders */}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>
  {[-0.05,0,0.05,0.10,0.15,0.20,0.25,0.30].map((rate)=>(
    <TouchableOpacity key={rate} onPress={()=>setGrowthRate(rate)}
      style={{paddingVertical:8,paddingHorizontal:14,borderRadius:8,
        backgroundColor:growthRate===rate?colors.primary:colors.surface,
        borderWidth:1,borderColor:colors.border}}>
      <Text style={{color:growthRate===rate?'#FFF':colors.textPrimary,
        fontSize:13,fontWeight:'600'}}>{(rate*100).toFixed(0)}%</Text>
    </TouchableOpacity>
  ))}
</View>

    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>
  {[0.06,0.08,0.10,0.12,0.14].map((rate)=>(
    <TouchableOpacity key={rate} onPress={()=>setDiscountRate(rate)}
      style={{paddingVertical:8,paddingHorizontal:14,borderRadius:8,
        backgroundColor:discountRate===rate?colors.primary:colors.surface,
        borderWidth:1,borderColor:colors.border}}>
      <Text style={{color:discountRate===rate?'#FFF':colors.textPrimary,
        fontSize:13,fontWeight:'600'}}>{(rate*100).toFixed(0)}%</Text>
    </TouchableOpacity>
  ))}
</View>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>
  {[8,10,12,15,18,20,25].map((mult)=>(
    <TouchableOpacity key={mult} onPress={()=>setTerminalMultiple(mult)}
      style={{paddingVertical:8,paddingHorizontal:14,borderRadius:8,
        backgroundColor:terminalMultiple===mult?colors.primary:colors.surface,
        borderWidth:1,borderColor:colors.border}}>
      <Text style={{color:terminalMultiple===mult?'#FFF':colors.textPrimary,
        fontSize:13,fontWeight:'600'}}>{mult}x</Text>
    </TouchableOpacity>
  ))}
</View>

      {/* Projected FCF Table */}
      <View style={styles.projectionCard}>
        <Text style={styles.projectionTitle}>Projected Free Cash Flow</Text>
        {dcfResult.projectedFCF.map((fcf, i) => (
          <View key={i} style={styles.projRow}>
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
        <Text style={[styles.resultPrice, { color: verdictColor }]}>
          {formatPrice(impliedPrice)}
        </Text>
        <Text style={styles.resultVs}>
          vs. Market Price: {formatPrice(currentPrice)}
        </Text>
        <Text style={[styles.verdict, { color: verdictColor }]}>{verdictText}</Text>
        <Text style={[styles.upside, { color: verdictColor }]}>
          {upside > 0 ? '+' : ''}{upside}% {isUndervalued ? 'upside' : 'downside'}
        </Text>
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
          <Text style={styles.summaryLabel}>Less: Net Debt</Text>
          <Text style={styles.summaryValue}>({formatCurrency(netDebt)})</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Equity Value</Text>
          <Text style={styles.summaryTotalValue}>{formatCurrency(dcfResult.equityValue)}</Text>
        </View>
      </View>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        This is a simplified DCF model for educational and analytical purposes only.
        It is not financial advice. Actual company valuations involve significantly
        more complexity, including detailed revenue projections, margin analysis,
        working capital modeling, and scenario analysis.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, paddingTop: 16 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  dataCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  dataLabel: { fontSize: 14, color: colors.textSecondary },
  dataValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sliderSection: { marginBottom: 20 },
  sliderLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  rangeText: { fontSize: 12, color: colors.textMuted },
  projectionCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
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
    alignItems: 'center', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  resultLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  resultPrice: { fontSize: 36, fontWeight: '800' },
  resultVs: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  verdict: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  upside: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  summaryCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  summaryTotalRow: { borderTopWidth: 2, borderTopColor: colors.primary, marginTop: 4, paddingTop: 8 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.primary },
  summaryTotalValue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  disclaimer: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 40, textAlign: 'center', paddingHorizontal: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.negative },
});

export default DCFScreen;
