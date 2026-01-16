import { Platform } from 'react-native';

const androidFontFamilies = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extrabold: 'PlusJakartaSans-ExtraBold',
};

// Styles to use for specific weights on different platforms
const weightStyles = {
  regular: Platform.select({
    ios: { fontWeight: '400' as const, fontFamily: 'System' },
    android: { fontFamily: androidFontFamilies.regular },
  }),
  medium: Platform.select({
    ios: { fontWeight: '500' as const, fontFamily: 'System' },
    android: { fontFamily: androidFontFamilies.medium },
  }),
  semibold: Platform.select({
    ios: { fontWeight: '600' as const, fontFamily: 'System' },
    android: { fontFamily: androidFontFamilies.semibold },
  }),
  bold: Platform.select({
    ios: { fontWeight: '700' as const, fontFamily: 'System' },
    android: { fontFamily: androidFontFamilies.bold },
  }),
  extrabold: Platform.select({
    ios: { fontWeight: '800' as const, fontFamily: 'System' },
    android: { fontFamily: androidFontFamilies.extrabold },
  }),
};

export const Typography = {
  // Font Families (Platform-specific system fonts)
  // DEPRECATED: Use fontWeights instead for cross-platform weight correctness
  fontFamily: androidFontFamilies,

  // Font Weight Styles (Spread these into your style objects)
  fontWeights: weightStyles,

  // Font Sizes (in points for accessibility)
  h1: 36,
  h2: 28, // Updated for Welcome Screen title
  h3: 24,
  h4: 20,
  h5: 18,
  body: 16,
  bodyLarge: 18,
  bodySmall: 14,
  caption: 14,
  small: 12,
  tiny: 10,

  // Additional sizes for specific use cases
  buttonText: 16,
  inputText: 16,
  link: 14,
  tagline: 16, // For Welcome Screen tagline

  // Font Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  // Line Heights (multipliers)
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.6,
  lineHeightLoose: 1.8,

  // Letter Spacing (in pixels)
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },

  // Pre-defined text styles (combined properties for consistency)
  styles: {
    // Headings
    h1: {
      ...weightStyles.bold,
      fontSize: 36,

      lineHeight: 36 * 1.2,
      letterSpacing: -0.5,
    },
    h2: {
      ...weightStyles.bold,
      fontSize: 28,

      lineHeight: 28 * 1.2,
      letterSpacing: -0.5,
    },
    h3: {
      ...weightStyles.semibold,
      fontSize: 24,

      lineHeight: 24 * 1.3,
    },
    h4: {
      ...weightStyles.semibold,
      fontSize: 20,

      lineHeight: 20 * 1.4,
    },

    // Body text
    bodyLarge: {
      ...weightStyles.regular,
      fontSize: 18,

      lineHeight: 18 * 1.5,
    },
    body: {
      ...weightStyles.regular,
      fontSize: 16,

      lineHeight: 16 * 1.5,
    },
    bodySmall: {
      ...weightStyles.regular,
      fontSize: 14,

      lineHeight: 14 * 1.5,
    },

    // UI Elements
    button: {
      ...weightStyles.semibold,
      fontSize: 16,

      lineHeight: 16 * 1.2,
      letterSpacing: 0.5,
    },
    buttonSmall: {
      ...weightStyles.semibold,
      fontSize: 14,

      lineHeight: 14 * 1.2,
      letterSpacing: 0.5,
    },
    input: {
      ...weightStyles.regular,
      fontSize: 16,

      lineHeight: 16 * 1.5,
    },
    inputLabel: {
      ...weightStyles.medium,
      fontSize: 14,

      lineHeight: 14 * 1.4,
    },
    link: {
      ...weightStyles.medium,
      fontSize: 14,

      lineHeight: 14 * 1.4,
    },

    // Specialized
    tagline: {
      ...weightStyles.medium,
      fontSize: 16,

      lineHeight: 16 * 1.5,
    },
    caption: {
      ...weightStyles.regular,
      fontSize: 14,

      lineHeight: 14 * 1.4,
    },
    small: {
      ...weightStyles.regular,
      fontSize: 12,

      lineHeight: 12 * 1.4,
    },
  },
};
