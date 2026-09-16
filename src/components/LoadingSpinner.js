// LoadingSpinner.js
// A simple centered loading indicator shown while API data is being fetched.
// Every screen uses this during its loading state.
//
// WHY A SEPARATE COMPONENT:
// Every screen needs a loading state. Without this component, you'd copy-paste
// the same ActivityIndicator + "Loading..." text into 5 different files.
// When you want to change the spinner color or add an animation, you'd have
// to edit all 5. This component means one change updates everywhere.

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

// The "message" prop lets each screen customize the loading text.
// OverviewScreen passes "Loading company data..."
// FinancialsScreen passes "Loading financial statements..."
// This gives users feedback about what specifically is loading.
const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.spinner} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
});

export default LoadingSpinner;
