import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { Sizes } from '../constants/Sizes';
import { useButtonPress } from '../utils/animations';

// Social provider logo images
const GOOGLE_LOGO = require('../../assets/google-logo.png');
const APPLE_LOGO = require('../../assets/apple-logo.png');

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'social';
type ButtonSize = 'sm' | 'md' | 'lg';
type SocialProvider = 'google' | 'apple' | 'facebook' | 'phone';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  children: string;
  socialProvider?: SocialProvider;
  fullWidth?: boolean;
  hapticFeedback?: boolean;
  style?: ViewStyle;
}

const socialConfig = {
  google: {
    icon: 'globe' as const, // Placeholder, unused as we use logo image
    logo: GOOGLE_LOGO,
    color: Colors.google,
    label: 'Continue with Google',
  },
  apple: {
    icon: 'globe' as const, // Placeholder, unused as we use logo image
    logo: APPLE_LOGO,
    color: Colors.apple,
    label: 'Continue with Apple',
  },
  facebook: {
    icon: 'facebook' as const,
    color: Colors.facebook,
    label: 'Continue with Facebook',
  },
  phone: {
    icon: 'smartphone' as const,
    color: Colors.primary,
    label: 'Continue with Phone',
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  onPress,
  disabled = false,
  loading = false,
  icon,
  children,
  socialProvider,
  fullWidth = true,
  hapticFeedback = true,
  style,
}) => {
  const { animatedStyle, onPressIn, onPressOut } = useButtonPress();

  const handlePress = () => {
    if (disabled || loading) return;

    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress();
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return Sizes.buttonSm;
      case 'md':
        return Sizes.buttonMd;
      case 'lg':
      default:
        return Sizes.buttonLg;
    }
  };

  const renderContent = () => {
    const iconName = socialProvider ? socialConfig[socialProvider].icon : icon;
    const textContent = socialProvider ? socialConfig[socialProvider].label : children;
    const hasLogo = socialProvider && (socialProvider === 'google' || socialProvider === 'apple');

    return (
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? Colors.white : Colors.primary}
            size="small"
          />
        ) : (
          <>
            {hasLogo ? (
              <Image
                source={socialConfig[socialProvider].logo}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : iconName ? (
              <Feather
                name={iconName}
                size={size === 'sm' ? 18 : 20}
                color={
                  variant === 'primary'
                    ? Colors.white
                    : socialProvider
                      ? socialConfig[socialProvider].color
                      : Colors.primary
                }
                style={styles.icon}
              />
            ) : null}
            <Text
              style={[
                styles.text,
                variant === 'primary' && styles.textPrimary,
                variant === 'secondary' && styles.textSecondary,
                variant === 'text' && styles.textLink,
                variant === 'social' && styles.textSocial,
                size === 'sm' && styles.textSmall,
                disabled && styles.textDisabled,
              ]}
            >
              {textContent}
            </Text>
          </>
        )}
      </View>
    );
  };

  const containerStyle: ViewStyle = {
    height: getHeight(),
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
  };

  // Primary button with gradient
  if (variant === 'primary') {
    return (
      <AnimatedTouchable
        style={[containerStyle, style, animatedStyle]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={children}
        accessibilityState={{ disabled }}
      >
        <LinearGradient
          colors={Colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.button, styles.buttonPrimary]}
        >
          {renderContent()}
        </LinearGradient>
      </AnimatedTouchable>
    );
  }

  // All other button variants
  return (
    <AnimatedTouchable
      style={[
        containerStyle,
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'text' && styles.buttonText,
        variant === 'social' && styles.buttonSocial,
        style,
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled }}
    >
      {renderContent()}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Sizes.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: Sizes.minTouchTarget,
  },
  buttonPrimary: {
    height: '100%',
    ...Sizes.shadows.md,
  },
  buttonSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Sizes.shadows.sm,
  },
  buttonText: {
    backgroundColor: 'transparent',
    minHeight: Sizes.minTouchTarget,
  },
  buttonSocial: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Sizes.shadows.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Sizes.lg,
  },
  icon: {
    marginRight: Sizes.sm,
  },
  logoImage: {
    width: 20,
    height: 20,
    marginRight: Sizes.sm,
  },
  text: {
    ...Typography.styles.button,
    textAlign: 'center',
  },
  textPrimary: {
    color: Colors.white,
  },
  textSecondary: {
    color: Colors.primary,
  },
  textLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  textSocial: {
    color: Colors.textPrimary,
  },
  textSmall: {
    ...Typography.styles.buttonSmall,
  },
  textDisabled: {
    color: Colors.disabled,
  },
});
