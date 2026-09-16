// SearchScreen.js
// The first screen the user sees. A search bar at the top, and as the user
// types a stock ticker or company name, matching results appear below.
// Tapping a result navigates to the company dashboard.
//
// KEY CONCEPT: DEBOUNCING
// Without debouncing, every keystroke fires an API call. Typing "AAPL"
// triggers 4 calls: "A", "AA", "AAP", "AAPL". That wastes API requests
// and creates flickering results. Debouncing waits until the user STOPS
// typing for 400ms before making the call. This means typing "AAPL"
// quickly fires only 1 call with the full query.
//
// HOW DEBOUNCING WORKS HERE:
// 1. User types a character. The text state updates immediately (so the
//    input field feels responsive).
// 2. A setTimeout is set for 400ms in the future.
// 3. If the user types another character before 400ms, the old timeout
//    is cleared (via clearTimeout) and a new one is set.
// 4. When the user finally stops typing, the 400ms timer expires and
//    the API call fires.
//
// NAVIGATION:
// When the user taps a search result, this screen calls
// navigation.navigate('Dashboard', { ticker: 'AAPL' })
// which pushes the Dashboard (tab navigator) onto the screen stack
// and passes the ticker as a parameter. Every dashboard screen reads
// this parameter to know which company to load data for.

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

const SearchScreen = ({ navigation }) => {
  // The text currently in the search input field.
  const [query, setQuery] = useState('');

  // The array of search results returned by the API.
  const [results, setResults] = useState([]);

  // Whether we're currently waiting for API results.
  const [isSearching, setIsSearching] = useState(false);

  // useRef stores the timeout ID so we can clear it when the user
  // types again before the debounce period expires. useRef persists
  // across re-renders without causing additional renders itself.
  const debounceTimer = useRef(null);

  // This useEffect runs every time "query" changes (every keystroke).
  // It implements the debounce logic described above.
  useEffect(() => {
    // If the search field is empty or has fewer than 1 character,
    // clear results and don't make an API call.
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }

    // Clear any existing debounce timer from the previous keystroke.
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set a new timer. If no more keystrokes come in the next 400ms,
    // the API call will fire.
    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      const data = await searchTicker(query);
      setResults(data);
      setIsSearching(false);
    }, 400);

    // Cleanup function: if this component unmounts (user navigates away)
    // while a timer is pending, clear it to prevent a memory leak or
    // a state update on an unmounted component.
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  // Called when the user taps a search result.
  const handleSelectCompany = (ticker) => {
    Keyboard.dismiss(); // Hide the keyboard
    navigation.navigate('Dashboard', { ticker });
  };

  // Renders a single search result in the list.
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectCompany(item.symbol)}
      activeOpacity={0.7}
    >
      <View style={styles.resultLeft}>
        <Text style={styles.ticker}>{item.symbol}</Text>
        <Text style={styles.exchange}>{item.exchangeShortName}</Text>
      </View>
      <Text style={styles.companyName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Finance Dashboard</Text>
        <Text style={styles.subtitle}>Search any publicly traded company</Text>
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

      {isSearching && (
        <Text style={styles.searchingText}>Searching...</Text>
      )}

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.symbol}
        style={styles.resultsList}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 0 && !isSearching ? (
            <Text style={styles.emptyText}>No results found</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    paddingVertical: 10,
  },
  resultsList: {
    paddingHorizontal: 20,
  },
  resultItem: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultLeft: {
    marginRight: 12,
    minWidth: 70,
  },
  ticker: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  exchange: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  companyName: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
    paddingTop: 20,
  },
});

export default SearchScreen;
