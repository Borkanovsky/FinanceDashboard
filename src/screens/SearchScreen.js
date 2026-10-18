// SearchScreen.js
// The first screen the user sees: a search bar, with matching companies
// listed below as the user types. Tapping a result opens the dashboard.
//
// KEY CONCEPT: DEBOUNCING
// Without debouncing, typing "AAPL" fires 4 API calls ("A", "AA", "AAP",
// "AAPL"), burning free-tier requests and making results flicker. Instead we
// wait until the user STOPS typing for 400ms, then search once.
//
// KEY CONCEPT: STALE RESPONSES
// Debouncing alone isn't enough. If the "AA" request is still in flight when
// the "AAPL" request starts, and "AA" happens to finish LAST, its results
// would overwrite the correct ones. We remember the latest query in a ref and
// throw away any response that doesn't match it.
//
// NAVIGATION:
// Tapping a result calls navigation.navigate('Dashboard', { ticker }), which
// opens the tab navigator; every dashboard screen reads `ticker` from its route.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { searchTicker } from '../services/api';
import colors from '../constants/colors';

/** Milliseconds of typing inactivity before a search fires. */
const DEBOUNCE_MS = 400;

/**
 * Ticker search screen.
 *
 * @param {Object} props
 * @param {{navigate: (screen: string, params?: Object) => void}} props.navigation React Navigation object.
 * @returns {JSX.Element}
 */
const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // The query of the most recent search we started. Stored in a ref (not
  // state) because updating it must not trigger a re-render, and the async
  // callback needs the CURRENT value, not the one captured when it was created.
  const latestQuery = useRef('');

  useEffect(() => {
    const trimmed = query.trim();
    latestQuery.current = trimmed;

    if (trimmed.length === 0) {
      setResults([]);
      setIsSearching(false);
      return undefined;
    }

    // Each keystroke re-runs this effect; the cleanup below cancels the
    // previous timer, so only the last keystroke's timer survives.
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const data = await searchTicker(trimmed);
      // Drop results for a query the user has already changed (see header).
      if (latestQuery.current !== trimmed) return;
      setResults(data);
      setIsSearching(false);
    }, DEBOUNCE_MS);

    // Runs before the next keystroke's effect AND on unmount, so a pending
    // search never fires after the user has typed more or left the screen.
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Opens the dashboard for the tapped company.
   * @param {string} ticker Selected symbol.
   * @returns {void}
   */
  const handleSelectCompany = (ticker) => {
    Keyboard.dismiss();
    navigation.navigate('Dashboard', { ticker });
  };

  /**
   * Renders one search result row.
   * @param {{item: {symbol: string, name: string, exchange?: string, exchangeShortName?: string}}} param0
   * @returns {JSX.Element}
   */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectCompany(item.symbol)}
      activeOpacity={0.7}
    >
      <View style={styles.resultLeft}>
        <Text style={styles.ticker}>{item.symbol}</Text>
        {/* /stable/search-symbol returns `exchange`; `exchangeShortName` was the
            old v3 name, so the exchange line used to render blank. */}
        <Text style={styles.exchange}>{item.exchange || item.exchangeShortName || ''}</Text>
      </View>
      <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Finance Dashboard</Text>
        <Text style={styles.subtitle}>Search any publicly traded company</Text>
        <Text style={styles.coverageNote}>
          Full data for US stocks on NYSE, NASDAQ, and AMEX. OTC and international companies have limited data.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter ticker or company name..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {isSearching && <Text style={styles.searchingText}>Searching...</Text>}

      <FlatList
        data={results}
        renderItem={renderItem}
        // The same symbol can appear on multiple exchanges, and duplicate keys
        // make React drop or mis-render rows, so the exchange is part of the key.
        keyExtractor={(item, index) => `${item.symbol}-${item.exchange || item.exchangeShortName || index}`}
        style={styles.resultsList}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length > 0 && !isSearching ? (
            <Text style={styles.emptyText}>No results found</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  searchContainer: { paddingHorizontal: 20, paddingVertical: 10 },
  searchInput: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16,
    color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  searchingText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, paddingVertical: 10 },
  resultsList: { paddingHorizontal: 20 },
  resultItem: {
    backgroundColor: colors.surface, padding: 14, borderRadius: 10, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  resultLeft: { marginRight: 12, minWidth: 70 },
  ticker: { fontSize: 16, fontWeight: '700', color: colors.primary },
  exchange: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  companyName: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingTop: 20 },
  coverageNote: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
});

export default SearchScreen;
