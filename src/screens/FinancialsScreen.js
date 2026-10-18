// FinancialsScreen.js
// Shows 5 years of income statement, balance sheet, and cash flow data as a
// bar chart plus a table. Buttons at the top switch between statements.

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { getIncomeStatement, getBalanceSheet, getCashFlow } from '../services/api';
import { formatCurrency, formatFiscalYear } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

const screenWidth = Dimensions.get('window').width;

const TABS = ['Income', 'Balance Sheet', 'Cash Flow'];

// Chart + table definition for each tab. Keeping this as data (instead of
// if/else chains in two separate functions) means the chart metric and the
// table rows for a tab can't fall out of sync.
const TAB_CONFIG = [
  {
    chartKey: 'revenue',
    chartLabel: 'Revenue',
    rows: [
      { label: 'Revenue', key: 'revenue' },
      { label: 'Gross Profit', key: 'grossProfit' },
      { label: 'Operating Income', key: 'operatingIncome' },
      { label: 'Net Income', key: 'netIncome' },
      { label: 'EBITDA', key: 'ebitda' },
    ],
  },
  {
    chartKey: 'totalAssets',
    chartLabel: 'Total Assets',
    rows: [
      { label: 'Total Assets', key: 'totalAssets' },
      { label: 'Total Liabilities', key: 'totalLiabilities' },
      { label: 'Total Equity', key: 'totalStockholdersEquity' },
      { label: 'Total Debt', key: 'totalDebt' },
      { label: 'Cash & Equivalents', key: 'cashAndCashEquivalents' },
    ],
  },
  {
    chartKey: 'operatingCashFlow',
    chartLabel: 'Operating Cash Flow',
    rows: [
      { label: 'Operating CF', key: 'operatingCashFlow' },
      { label: 'Capital Expenditure', key: 'capitalExpenditure' },
      { label: 'Free Cash Flow', key: 'freeCashFlow' },
      { label: 'Dividends Paid', key: 'dividendsPaid' },
    ],
  },
];

/**
 * Builds bar-chart data for one statement.
 *
 * Two edge cases are handled here:
 * - Missing values become 0, because react-native-chart-kit crashes on NaN.
 * - The unit switches from $B to $M when every value is under $1B. With a
 *   fixed $B unit, a small company's bars all rendered as "0.0".
 *
 * Negative values are clamped to 0 because chart-kit's BarChart can't draw
 * bars below the axis. The table below still shows the true negative numbers.
 *
 * @param {Object[]} rows      Statement rows, oldest first.
 * @param {string} key         Field to chart, e.g. "revenue".
 * @param {string} baseLabel   Human label, e.g. "Revenue".
 * @returns {{data: number[], labels: string[], label: string}|null} Chart data,
 *   or null when there's nothing to chart.
 */
const buildChartData = (rows, key, baseLabel) => {
  if (!rows || rows.length === 0) return null;

  const raw = rows.map((d) => (Number.isFinite(d[key]) ? d[key] : 0));
  const maxAbs = Math.max(...raw.map(Math.abs));
  const [divisor, unit] = maxAbs >= 1e9 ? [1e9, 'B'] : [1e6, 'M'];

  return {
    data: raw.map((v) => Math.max(0, v / divisor)),
    labels: rows.map((d) => formatFiscalYear(d.date)),
    label: `${baseLabel} ($${unit})`,
  };
};

/**
 * Financial statements screen with chart + table per statement.
 *
 * @param {Object} props
 * @param {{params: {ticker: string}}} props.route React Navigation route; `ticker` picks the company.
 * @returns {JSX.Element}
 */
const FinancialsScreen = ({ route }) => {
  const { ticker } = route.params;
  const [activeTab, setActiveTab] = useState(0);
  const [incomeData, setIncomeData] = useState([]);
  const [balanceData, setBalanceData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ignore late responses after the ticker changes (see OverviewScreen).
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const [income, balance, cashFlow] = await Promise.all([
        getIncomeStatement(ticker),
        getBalanceSheet(ticker),
        getCashFlow(ticker),
      ]);
      if (cancelled) return;
      // The API returns newest year first; reverse (on a copy, since
      // .reverse() mutates) so charts read left-to-right in time order.
      setIncomeData([...income].reverse());
      setBalanceData([...balance].reverse());
      setCashFlowData([...cashFlow].reverse());
      setLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) return <LoadingSpinner message="Loading financial statements..." />;

  const currentData = [incomeData, balanceData, cashFlowData][activeTab];
  const { chartKey, chartLabel, rows: tableRows } = TAB_CONFIG[activeTab];
  const chartInfo = buildChartData(currentData, chartKey, chartLabel);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.tabRow}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && styles.activeTab]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Previously an empty statement rendered a blank screen with no explanation. */}
      {currentData.length === 0 && (
        <Text style={styles.emptyText}>No {TABS[activeTab].toLowerCase()} data available for {ticker}.</Text>
      )}

      {chartInfo && (
        <View style={styles.chartSection}>
          <Text style={styles.chartLabel}>{chartInfo.label}</Text>
          <BarChart
            data={{ labels: chartInfo.labels, datasets: [{ data: chartInfo.data }] }}
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
            showValuesOnTopOfBars
            fromZero
          />
        </View>
      )}

      {currentData.length > 0 && (
        <View style={styles.tableSection}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.tableLabelCell]}>Metric</Text>
            {currentData.map((d, i) => (
              // Index fallback: a row with a missing date would otherwise
              // produce duplicate React keys ("undefined").
              <Text key={d.date || `col-${i}`} style={styles.tableHeaderCell}>
                {formatFiscalYear(d.date)}
              </Text>
            ))}
          </View>

          {tableRows.map((row, rowIndex) => (
            <View key={row.key} style={[styles.tableRow, rowIndex % 2 === 0 && styles.tableRowShaded]}>
              <Text style={[styles.tableCell, styles.tableLabelCell]}>{row.label}</Text>
              {currentData.map((d, i) => (
                <Text key={`${d.date || i}-${row.key}`} style={styles.tableCell}>
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
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingTop: 24, paddingHorizontal: 20 },
  chartSection: { paddingHorizontal: 20, paddingTop: 16 },
  chartLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  chart: { borderRadius: 10 },
  tableSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: colors.primary },
  tableHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  tableLabelCell: { flex: 1.5, textAlign: 'left' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowShaded: { backgroundColor: '#F8F9FC' },
  tableCell: { flex: 1, fontSize: 11, color: colors.textPrimary, textAlign: 'center' },
});

export default FinancialsScreen;
