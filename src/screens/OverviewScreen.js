// OverviewScreen.js
// Displays the company's current price, daily change, key market data,
// and a 1-year price chart.
//
// DATA FLOW:
// 1. Screen mounts. useEffect reads the "ticker" parameter from navigation.
// 2. Two API calls fire in parallel: getCompanyProfile() and getHistoricalPrice().
// 3. While loading, LoadingSpinner is shown.
// 4. When both calls resolve, the data is stored in state and rendered.
//
// PARALLEL API CALLS:
// Promise.all() fires both requests simultaneously instead of sequentially.
// Sequential: profile takes 500ms, then prices take 500ms = 1000ms total.
// Parallel: both fire at once, total wait = max(500ms, 500ms) = 500ms.
// This cuts loading time roughly in half.
import { getCompanyProfile, getHistoricalPrice } from '../services/api';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { formatCurrency, formatPrice, formatPercent, formatLargeNumber, getChangeColor } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import colors from '../constants/colors';

const screenWidth = Dimensions.get('window').width;

const OverviewScreen = ({ route }) => {
  const { ticker } = route.params;
  const [profile, setProfile] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileData, historicalData] = await Promise.all([
          getCompanyProfile(ticker),
          getHistoricalPrice(ticker),
      
        ]);
        console.log('HISTORICAL:', JSON.stringify(historicalData?.slice(0, 2)));

        if (!profileData) {
          setError('Could not load company data. Check the ticker and try again.');
          setLoading(false);
          return;
        }

       
  setProfile(profileData);


        // Process historical price data for the chart.
        // API returns newest first. Reverse for left-to-right chronological.
        // Sample every 7th point to get ~52 data points (weekly) for a clean chart.
       if (historicalData && historicalData.length > 0) {
  // Take only the last ~1 year of trading days (252 trading days per year)
  const oneYear = historicalData.slice(0, 252);
  
  // Reverse so oldest is first (chart reads left to right)
  const reversed = [...oneYear].reverse();
  
  // Sample down to ~40 points for a clean chart
  const step = Math.ceil(reversed.length / 40);
  const sampled = reversed.filter((_, index) => index % step === 0);
  
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  
            setPriceData({
              labels: sampled.map((d, i) => {
                // Only show a label every 8th point, blank string otherwise
                if (i % 8 !== 0) return '';
                return months[parseInt(d.date.slice(5, 7), 10) - 1];
              }),
              prices: sampled.map((d) => d.close),
            });

        }
      } catch (err) {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    };

    fetchData();
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

    const change = profile.change || 0;
    const changePct = typeof profile.changePercentage === 'string'
    ? profile.changePercentage
   : `${(profile.changePercentage || 0).toFixed(2)}%`;
  const changeColor = getChangeColor(change, colors);
  const rangeparts = profile.range ? profile.range.split('-') : [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Company header */}
      <View style={styles.header}>
        <Text style={styles.companyName}>{profile.companyName}</Text>
        <Text style={styles.tickerText}>{profile.symbol} · {profile.exchangeShortName}</Text>
      </View>

      {/* Price and change */}
      <View style={styles.priceSection}>
        <Text style={styles.price}>{formatPrice(profile.price)}</Text>
        <View style={styles.changeRow}>
          <Text style={[styles.change, { color: changeColor }]}>
            {change >= 0 ? '+' : ''}{formatPrice(change)}
          </Text>
          <Text style={[styles.changePct, { color: changeColor }]}>
            ({changePct})
          </Text>
        </View>
      </View>

      {/* Price chart */}
      {priceData && priceData.prices && priceData.prices.length > 0 &&(
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>1-Year Price Chart</Text>
          <LineChart
            data={{
              labels: priceData.labels,
              datasets: [{ data: priceData.prices }],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(46, 80, 144, ${opacity})`,
              labelColor: () => colors.textSecondary,
              propsForDots: { r: '0' }, // Hide dots for cleaner line
              propsForBackgroundLines: {
                strokeDasharray: '', // Solid grid lines
                stroke: colors.border,
                strokeWidth: 0.5,
              },
            }}
            bezier
            style={styles.chart}
            withInnerLines={true}
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
          <Text style={styles.cardValue}>{rangeparts[1] ? `$${rangeparts[1].trim()}` : 'N/A'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>52W Low</Text>
          <Text style={styles.cardValue}>{rangeparts[0] ? `$${rangeparts[0].trim()}` : 'N/A'}</Text>
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
