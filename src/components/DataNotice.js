// DataNotice.js
// Banner that lists data limitations for the current company.
// Yellow = data is missing; blue = data exists but some metrics don't apply.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PALETTE = {
  warning: { bg: '#FFF7E6', border: '#F5C26B', text: '#7A4B00', icon: '⚠️' },
  info: { bg: '#EEF4FF', border: '#9DB7F0', text: '#1E3A8A', icon: 'ℹ️' },
};

/**
 * Shows one banner per limitation. Renders nothing when there are none, so
 * fully supported companies like AAPL look exactly as before.
 *
 * @param {Object} props
 * @param {{level: 'warning'|'info', text: string}[]} props.warnings From getCoverageWarnings().
 * @returns {JSX.Element|null}
 */
const DataNotice = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;
  return (
    <View style={styles.wrapper}>
      {warnings.map((w) => {
        const p = PALETTE[w.level] || PALETTE.info;
        return (
          <View key={w.text} style={[styles.banner, { backgroundColor: p.bg, borderColor: p.border }]}>
            <Text style={[styles.text, { color: p.text }]}>{`${p.icon}  ${w.text}`}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingTop: 12 },
  banner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  text: { fontSize: 13, lineHeight: 18 },
});

export default DataNotice;