// RatioCard.js
// A small card showing one financial ratio and its label. RatiosScreen lays
// these out in a 2-column grid.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

/**
 * Displays a single labeled ratio.
 *
 * @param {Object} props
 * @param {string} props.label Ratio name, e.g. "P/E Ratio".
 * @param {string} [props.value] Already-formatted value, e.g. "28.5x". Formatting
 *   happens in the screen (via utils/formatters) so this card stays a dumb
 *   display component. Falls back to "N/A" if nothing is passed.
 * @returns {JSX.Element}
 */
const RatioCard = ({ label, value }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value ?? 'N/A'}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    // 47% (not 50%) leaves a gap between the two columns; the parent's
    // flexWrap + justifyContent: 'space-between' does the actual layout.
    width: '47%',
    marginBottom: 12,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    // Android ignores the shadow* props and uses elevation instead.
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default RatioCard;
