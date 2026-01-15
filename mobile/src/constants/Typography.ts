import { Platform } from 'react-native';

const fontFamilies = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  semibold: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: 'System',
  }),
};

export const Typography = {
  // Font Families (Platform-specific system fonts)
  fontFamily: fontFamilies,

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
      fontFamily: fontFamilies.bold,
      fontSize: 36,
      fontWeight: '700' as const,
      lineHeight: 36 * 1.2,
      letterSpacing: -0.5,
    },
    h2: {
      fontFamily: fontFamilies.bold,
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 28 * 1.2,
      letterSpacing: -0.5,
    },
    h3: {
      fontFamily: fontFamilies.semibold,
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 24 * 1.3,
    },
    h4: {
      fontFamily: fontFamilies.semibold,
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 20 * 1.4,
    },

    // Body text
    bodyLarge: {
      fontFamily: fontFamilies.regular,
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 18 * 1.5,
    },
    body: {
      fontFamily: fontFamilies.regular,
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 16 * 1.5,
    },
    bodySmall: {
      fontFamily: fontFamilies.regular,
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 14 * 1.5,
    },

    // UI Elements
    button: {
      fontFamily: fontFamilies.semibold,
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 16 * 1.2,
      letterSpacing: 0.5,
    },
    buttonSmall: {
      fontFamily: fontFamilies.semibold,
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 14 * 1.2,
      letterSpacing: 0.5,
    },
    input: {
      fontFamily: fontFamilies.regular,
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 16 * 1.5,
    },
    inputLabel: {
      fontFamily: fontFamilies.medium,
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 14 * 1.4,
    },
    link: {
      fontFamily: fontFamilies.medium,
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 14 * 1.4,
    },

    // Specialized
    tagline: {
      fontFamily: fontFamilies.medium,
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 16 * 1.5,
    },
    caption: {
      fontFamily: fontFamilies.regular,
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 14 * 1.4,
    },
    small: {
      fontFamily: fontFamilies.regular,
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 12 * 1.4,
    },
  },
};
