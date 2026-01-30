export const Sizes = {
  // Spacing (8px base scale)
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Border Radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusFull: 9999,

  // Icon Sizes
  iconXs: 16,
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  iconXl: 48,
  iconXxl: 64,

  // Button Heights
  buttonSm: 40,
  buttonMd: 48,
  buttonLg: 56,

  // Input Heights
  inputSm: 40,
  inputMd: 48,
  inputLg: 56,

  // Container
  maxWidth: 428, // Mobile phone width
  contentPadding: 24, // Standard screen horizontal padding

  // Logo
  logoSize: 132, // Welcome Screen logo
  logoSizeSm: 88, // Smaller logo variant

  // Touch Targets (iOS HIG & Material Design)
  minTouchTarget: 44, // Minimum interactive element size
  minTouchTargetAndroid: 48, // Android Material Design minimum

  // Shadow/Elevation Scale (for both iOS and Android)
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 1,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },
  },

  // Animation Durations (milliseconds)
  animation: {
    fastest: 150,
    fast: 200,
    normal: 300,
    slow: 500,
    slowest: 700,
    splash: 2500, // Welcome Screen auto-navigate delay
  },

  // Animation Easing (for Reanimated)
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'spring',
  },

  // Z-Index Scale (layering)
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    overlay: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    notification: 1080,
  },

  // Safe Area Insets (defaults, will be overridden by useSafeAreaInsets)
  safeArea: {
    top: 44, // Typical iOS status bar + notch
    bottom: 34, // Typical iOS home indicator
    left: 0,
    right: 0,
  },
} as const;
