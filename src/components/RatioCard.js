// RatioCard.js
// A small card that displays a single financial ratio with its label.
// Used by RatiosScreen.js to display 20+ ratios in an organized grid.
//
// Each card shows:
// - A label (e.g., "P/E Ratio")
// - A formatted value (e.g., "28.5x")

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

const RatioCard = ({ label, value }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    // "width: '47%'" makes two cards fit per row with spacing between them.
    // The parent View uses flexWrap: 'wrap' and justifyContent: 'space-between'
    // to arrange cards in a 2-column grid.
    width: '47%',
    marginBottom: 12,
    // Shadow for iOS:
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    // Shadow for Android:
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
