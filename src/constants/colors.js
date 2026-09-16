// colors.js
// Central color palette for the entire app. Every component imports colors
// from here instead of hardcoding hex values. This means you can retheme
// the entire app by changing values in one file.
//
// WHY THIS FILE EXISTS:
// Without it, you end up with "#1B2A4A" scattered across 15 files. When you
// want to change the primary color, you have to find-and-replace across the
// entire codebase and hope you don't miss one. With this file, you change
// it once and every component updates.

const colors = {
  // Primary brand color. Used for headers, navigation bar, primary buttons.
  primary: '#1B2A4A',

  // Secondary accent. Used for subheadings, active tab indicators, links.
  secondary: '#2E5090',

  // Financial positive (stock up, undervalued, good metrics).
  positive: '#1A7A2E',

  // Financial negative (stock down, overvalued, bad metrics).
  negative: '#CC0000',

  // App background. Slightly off-white so white cards stand out against it.
  background: '#F5F6FA',

  // Card/surface background. Pure white for contrast against the background.
  surface: '#FFFFFF',

  // Primary text. Near-black, easier on the eyes than pure #000000.
  textPrimary: '#1A1A2E',

  // Secondary text. Gray, used for labels, captions, less important info.
  textSecondary: '#6B7280',

  // Muted text. Lighter gray for timestamps, disclaimers, footnotes.
  textMuted: '#9CA3AF',

  // Border color for cards and dividers.
  border: '#E5E7EB',

  // Chart colors. Used for different data series in bar/line charts.
  chartBlue: '#3B82F6',
  chartGreen: '#10B981',
  chartOrange: '#F59E0B',
  chartPurple: '#8B5CF6',

  // Loading spinner color.
  spinner: '#2E5090',
};

export default colors;
