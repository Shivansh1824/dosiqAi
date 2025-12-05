export const Colors = {
  // Primary Colors (updated for medical trust)
  primary: '#3B82F6', // Medical blue
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  secondary: '#06B6D4', // Trust teal
  secondaryDark: '#0891B2',
  secondaryLight: '#22D3EE',

  // Semantic Colors
  success: '#10B981', // Green
  successDark: '#059669',
  successLight: '#D1FAE5', // Light green background
  warning: '#F59E0B', // Amber
  warningDark: '#D97706',
  warningLight: '#FBB024',
  error: '#EF4444', // Red
  errorDark: '#DC2626',
  errorLight: '#FEE2E2', // Light red background
  info: '#3B82F6', // Blue (same as primary)

  // Accent Colors (legacy)
  orange: '#FB8C00',
  red: '#EF5350',
  purple: '#AB47BC',
  green: '#66BB6A',

  // Gray Scale (updated for better contrast)
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Basic Colors
  white: '#FFFFFF',
  black: '#000000',

  // Text Colors
  textPrimary: '#1F2937', // gray800
  textSecondary: '#6B7280', // gray500
  textTertiary: '#9CA3AF', // gray400
  textInverse: '#FFFFFF',

  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  bgTertiary: '#F3F4F6',
  bgLight: '#F5F5F5', // legacy
  bgDark: '#212121', // legacy

  // Gradients (as arrays for LinearGradient)
  gradients: {
    primary: ['#3B82F6', '#06B6D4'], // Blue to teal
    welcome: ['#F0F9FF', '#FFFFFF'], // Soft blue to white
    card: ['#FFFFFF', '#F9FAFB'], // White to light gray
    success: ['#10B981', '#059669'], // Green gradient
    error: ['#EF4444', '#DC2626'], // Red gradient
  },

  // State Colors
  focus: '#3B82F6',
  active: '#2563EB',
  disabled: '#D1D5DB',
  hover: '#60A5FA',

  // Social Login Brand Colors
  google: '#DB4437',
  apple: '#000000',
  facebook: '#1877F2',
  microsoft: '#00A4EF',

  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
  overlayWhite: 'rgba(255, 255, 255, 0.9)',

  // Border Colors
  border: '#E5E7EB', // gray200
  borderLight: '#F3F4F6', // gray100
  borderDark: '#D1D5DB', // gray300
  borderFocus: '#3B82F6', // primary
} as const;
