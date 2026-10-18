// LoadingSpinner.js
// Centered loading indicator shown while API data is being fetched.
//
// WHY A SEPARATE COMPONENT:
// Every screen needs a loading state. One shared component means changing the
// spinner's color or text style is a one-file edit instead of five.

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

/**
 * Full-screen loading indicator with a short status message.
 *
 * @param {Object} props
 * @param {string} [props.message='Loading...'] Text under the spinner. Screens
 *   pass something specific ("Loading financial statements...") so the user
 *   knows what they're waiting for.
 * @returns {JSX.Element}
 */
const LoadingSpinner = ({ message = 'Loading...' }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={colors.spinner} />
    <Text style={styles.text}>{message}</Text>
  </View>
);

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
