// OverviewScreen.js
// Shows the company's current price, daily change, key market data, and a
// 1-year price chart.
//
// DATA FLOW:
// 1. Screen mounts and reads the "ticker" route parameter.
// 2. getCompanyProfile() and getHistoricalPrice() run in parallel.
// 3. LoadingSpinner shows until both resolve, then the data renders.
//
// WHY PARALLEL CALLS:
// Promise.all() starts both requests at once, so the wait is the slower of
// the two (~500ms) instead of their sum (~1000ms).

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getCompanyProfile, getHistoricalPrice } from '../services/api';
import { formatCurrency, formatPrice, formatLargeNumber, getChangeColor } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';
import DataNotice from '../components/DataNotice';
import { getCoverageWarnings } from '../utils/dataCoverage';
const screenWidth = Dimensions.get('window').width;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// ~252 trading days in a year (weekends and market holidays excluded).
const TRADING_DAYS_PER_YEAR = 252;
// A phone-width chart becomes an unreadable smear past ~40 points, so the
// daily series is down-sampled to roughly this many.
const TARGET_CHART_POINTS = 40;
// With ~40 points, labeling every one would overlap; every 8th gives ~5 labels.
const LABEL_EVERY_N_POINTS = 8;

/**
 * Turns raw daily prices (newest first) into chart-ready labels and values.
 *
 * Bad rows are dropped first: react-native-chart-kit crashes on NaN or
 * undefined values, and FMP occasionally returns days with a null close.
 *
 * @param {Array<{date: string, close: number}>} historicalData Daily prices, newest first.
 * @returns {{labels: string[], prices: number[]}|null} Chart data, or null if
 *   there aren't enough valid points to draw a line.
 */
const buildChartData = (historicalData) => {
  const valid = (historicalData || []).filter(
    (d) => d && typeof d.date === 'string' && Number.isFinite(d.close)
  );
  // A line needs at least 2 points; chart-kit also errors on an empty dataset.
  if (valid.length < 2) return null;

  // Newest-first → keep the last year → flip to oldest-first so the chart
  // reads left to right in time order.
  const chronological = valid.slice(0, TRADING_DAYS_PER_YEAR).reverse();

  const step = Math.max(1, Math.ceil(chronological.length / TARGET_CHART_POINTS));
  const sampled = chronological.filter((_, index) => index % step === 0);

  return {
    labels: sampled.map((d, i) => {
      if (i % LABEL_EVERY_N_POINTS !== 0) return '';
      const monthIndex = parseInt(d.date.slice(5, 7), 10) - 1;
      return MONTHS[monthIndex] || '';
    }),
    prices: sampled.map((d) => d.close),
  };
};

/**
 * Normalizes FMP's changePercentage, which can be a number (-0.68) or an
 * already-formatted string ("-0.68%"), into a display string.
 *
 * @param {number|string|null|undefined} value Raw changePercentage.
 * @returns {string} e.g. "-0.68%", or "N/A".
 */
const formatChangePercent = (value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.includes('%') ? value : `${value}%`;
  }
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : 'N/A';
};

/**
 * Splits FMP's 52-week range string ("124.17-198.23") into low and high.
 *
 * @param {string|undefined} range Hyphenated range string.
 * @returns {{low: string|null, high: string|null}} Trimmed parts, or nulls.
 */
const parseRange = (range) => {
  if (typeof range !== 'string') return { low: null, high: null };
  const [low, high] = range.split('-').map((s) => s.trim());
  return { low: low || null, high: high || null };
};

/**
 * Company overview screen: price, daily change, 1-year chart, key stats.
 *
 * @param {Object} props
 * @param {{params: {ticker: string}}} props.route React Navigation route; `ticker` picks the company.
 * @returns {JSX.Element|null}
 */
const OverviewScreen = ({ route }) => {
  const { ticker } = route.params;
  const [profile, setProfile] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Ignore responses that arrive after the user has moved to another ticker,
    // so a slow request can't overwrite the newer company's data.
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setPriceData(null);
      try {
        const [profileData, historicalData] = await Promise.all([
          getCompanyProfile(ticker),
          getHistoricalPrice(ticker),
        ]);
        if (cancelled) return;

        if (!profileData) {
          setError('Could not load company data. Check the ticker and try again.');
          return;
        }

        setProfile(profileData);
        setPriceData(buildChartData(historicalData));
      } catch (err) {
        // api.js never throws, but buildChartData or a state update could, and
        // a crash here would leave the spinner up forever.
        console.error('OverviewScreen error:', err?.message);
        if (!cancelled) setError('Something went wrong. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) return <LoadingSpinner message="Loading company data..." />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!profile) return null;

  const change = Number.isFinite(profile.change) ? profile.change : null;
  const changePct = formatChangePercent(profile.changePercentage);
  const changeColor = getChangeColor(change, colors);
  const { low, high } = parseRange(profile.range);
  // /stable/ renamed exchangeShortName to exchange; fall back for older data.
  const exchange = profile.exchange || profile.exchangeShortName;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Company header */}
      <View style={styles.header}>
        <Text style={styles.companyName}>{profile.companyName}</Text>
        <Text style={styles.tickerText}>
          {profile.symbol}{exchange ? ` · ${exchange}` : ''}
        </Text>
      </View>
      <DataNotice warnings={getCoverageWarnings(profile)} />
      {/* Price and change */}
      <View style={styles.priceSection}>
        <Text style={styles.price}>{formatPrice(profile.price)}</Text>
        <View style={styles.changeRow}>
          <Text style={[styles.change, { color: changeColor }]}>
            {change !== null && change >= 0 ? '+' : ''}{formatPrice(change)}
          </Text>
          <Text style={[styles.changePct, { color: changeColor }]}>({changePct})</Text>
        </View>
      </View>

      {/* Price chart */}
      {priceData && (
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>1-Year Price Chart</Text>
          <LineChart
            data={{ labels: priceData.labels, datasets: [{ data: priceData.prices }] }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(46, 80, 144, ${opacity})`,
              labelColor: () => colors.textSecondary,
              propsForDots: { r: '0' }, // Hide dots; ~40 dots would clutter the line.
              propsForBackgroundLines: { strokeDasharray: '', stroke: colors.border, strokeWidth: 0.5 },
            }}
            bezier
            style={styles.chart}
            withInnerLines
            withOuterLines={false}
          />
        </View>
      )}

      {/* Key data cards */}
      <View style={styles.cardsGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>Market Cap</Text>
          <Text style={styles.cardValue}>{formatCurrency(profile.marketCap)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>Sector</Text>
          <Text style={styles.cardValue} numberOfLines={1}>{profile.sector || 'N/A'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>Industry</Text>
          <Text style={styles.cardValue} numberOfLines={2}>{profile.industry || 'N/A'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>52W High</Text>
          <Text style={styles.cardValue}>{high ? formatPrice(high) : 'N/A'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>52W Low</Text>
          <Text style={styles.cardValue}>{low ? formatPrice(low) : 'N/A'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>Avg Volume</Text>
          <Text style={styles.cardValue}>{formatLargeNumber(profile.averageVolume)}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  companyName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  tickerText: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  priceSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  price: { fontSize: 36, fontWeight: '700', color: colors.textPrimary },
  changeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  change: { fontSize: 16, fontWeight: '600', marginRight: 6 },
  changePct: { fontSize: 16, fontWeight: '500' },
  chartContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  chart: { borderRadius: 10 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 30 },
  infoCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14,
    width: '47%', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.negative, textAlign: 'center' },
});

export default OverviewScreen;
