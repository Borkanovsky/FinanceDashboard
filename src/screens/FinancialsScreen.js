// FinancialsScreen.js
// Displays 5 years of income statement, balance sheet, and cash flow data
// with bar charts and data tables. The user toggles between statements
// using buttons at the top.

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { getIncomeStatement, getBalanceSheet, getCashFlow } from '../services/api';
import { formatCurrency, formatFiscalYear } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

const screenWidth = Dimensions.get('window').width;

const TABS = ['Income', 'Balance Sheet', 'Cash Flow'];

const FinancialsScreen = ({ route }) => {
  const { ticker } = route.params;
  const [activeTab, setActiveTab] = useState(0);
  const [incomeData, setIncomeData] = useState([]);
  const [balanceData, setBalanceData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [income, balance, cashFlow] = await Promise.all([
        getIncomeStatement(ticker),
        getBalanceSheet(ticker),
        getCashFlow(ticker),
      ]);
      // Reverse all arrays so oldest year is first (left side of chart).
      setIncomeData([...(income || [])].reverse());
      setBalanceData([...(balance || [])].reverse());
      setCashFlowData([...(cashFlow || [])].reverse());
      setLoading(false);
    };
    fetchData();
  }, [ticker]);

  if (loading) return <LoadingSpinner message="Loading financial statements..." />;

  // Determine which data to display based on the active tab.
  const getChartData = () => {
    let data, labels, label;
    if (activeTab === 0 && incomeData.length > 0) {
      data = incomeData.map((d) => d.revenue / 1e9);
      labels = incomeData.map((d) => formatFiscalYear(d.date));
      label = 'Revenue ($B)';
    } else if (activeTab === 1 && balanceData.length > 0) {
      data = balanceData.map((d) => d.totalAssets / 1e9);
      labels = balanceData.map((d) => formatFiscalYear(d.date));
      label = 'Total Assets ($B)';
    } else if (activeTab === 2 && cashFlowData.length > 0) {
      data = cashFlowData.map((d) => Math.max(0, (d.operatingCashFlow || 0) / 1e9));
      labels = cashFlowData.map((d) => formatFiscalYear(d.date));
      label = 'Operating Cash Flow ($B)';
    } else {
      return null;
    }
    return { data, labels, label };
  };

  // Build the detail rows for the data table below the chart.
  const getTableRows = () => {
    if (activeTab === 0) {
      return [
        { label: 'Revenue', key: 'revenue' },
        { label: 'Gross Profit', key: 'grossProfit' },
        { label: 'Operating Income', key: 'operatingIncome' },
        { label: 'Net Income', key: 'netIncome' },
        { label: 'EBITDA', key: 'ebitda' },
      ];
    } else if (activeTab === 1) {
      return [
        { label: 'Total Assets', key: 'totalAssets' },
        { label: 'Total Liabilities', key: 'totalLiabilities' },
        { label: 'Total Equity', key: 'totalStockholdersEquity' },
        { label: 'Total Debt', key: 'totalDebt' },
        { label: 'Cash & Equivalents', key: 'cashAndCashEquivalents' },
      ];
    } else {
      return [
        { label: 'Operating CF', key: 'operatingCashFlow' },
        { label: 'Capital Expenditure', key: 'capitalExpenditure' },
        { label: 'Free Cash Flow', key: 'freeCashFlow' },
        { label: 'Dividends Paid', key: 'dividendsPaid' },
      ];
    }
  };

  const currentData = activeTab === 0 ? incomeData : activeTab === 1 ? balanceData : cashFlowData;
  const chartInfo = getChartData();
  const tableRows = getTableRows();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Tab buttons */}
      <View style={styles.tabRow}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && styles.activeTab]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bar chart */}
      {chartInfo && (
        <View style={styles.chartSection}>
          <Text style={styles.chartLabel}>{chartInfo.label}</Text>
          <BarChart
            data={{
              labels: chartInfo.labels,
              datasets: [{ data: chartInfo.data }],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              labelColor: () => colors.textSecondary,
              barPercentage: 0.6,
              propsForBackgroundLines: { stroke: colors.border, strokeWidth: 0.5 },
            }}
            style={styles.chart}
            showValuesOnTopOfBars={true}
            fromZero={true}
          />
        </View>
      )}

      {/* Data table */}
      {currentData.length > 0 && (
        <View style={styles.tableSection}>
          {/* Table header row with fiscal years */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.tableLabelCell]}>Metric</Text>
            {currentData.map((d) => (
              <Text key={d.date} style={styles.tableHeaderCell}>
                {formatFiscalYear(d.date)}
              </Text>
            ))}
          </View>

          {/* Table data rows */}
          {tableRows.map((row, rowIndex) => (
            <View
              key={row.key}
              style={[styles.tableRow, rowIndex % 2 === 0 && styles.tableRowShaded]}
            >
              <Text style={[styles.tableCell, styles.tableLabelCell]}>{row.label}</Text>
              {currentData.map((d) => (
                <Text key={d.date + row.key} style={styles.tableCell}>
                  {formatCurrency(d[row.key])}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.surface, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  activeTab: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  activeTabText: { color: '#FFFFFF' },
  chartSection: { paddingHorizontal: 20, paddingTop: 16 },
  chartLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  chart: { borderRadius: 10 },
  tableSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  tableHeaderRow: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: colors.primary,
  },
  tableHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  tableLabelCell: { flex: 1.5, textAlign: 'left' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowShaded: { backgroundColor: '#F8F9FC' },
  tableCell: { flex: 1, fontSize: 11, color: colors.textPrimary, textAlign: 'center' },
});

export default FinancialsScreen;
