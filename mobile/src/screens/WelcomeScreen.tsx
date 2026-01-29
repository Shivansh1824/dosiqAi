import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Logo from '../components/Logo';
import { Button, ValueProposition } from '../components';
import { Colors, Sizes, Typography } from '../constants';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../../App';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { isAuthenticated, hasSeenOnboarding } = useAuthStore();

  // Determine what to show
  const showGetStartedButton = !isAuthenticated;
  const showSignInLink = !isAuthenticated;
  const showValueProps = !isAuthenticated;

  // Auto-navigation for authenticated users to Home screen
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        navigation.replace('Home');
      }, 500); // Small delay to show logo but move quickly

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigation]);

  // For now, disable animations to ensure screen is always visible
  // TODO: Re-enable animations once Reanimated is properly configured
  const logoStyle = { opacity: 1, transform: [{ scale: 1 }] };
  const appNameStyle = { opacity: 1 };
  const taglineStyle = { opacity: 1, transform: [{ translateY: 0 }] };
  const buttonStyle = { opacity: 1, transform: [{ translateY: 0 }] };
  const signInStyle = { opacity: 1 };
  const versionStyle = { opacity: 1 };

  // Handle navigation
  const handleGetStarted = () => {
    navigation.navigate('Onboarding1');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  // Get app version from package.json
  const appVersion = '1.0.0';

  return (
    <LinearGradient colors={Colors.gradients.welcome} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Logo */}
          <View style={[styles.logoContainer, logoStyle]}>
            <Logo size={Sizes.logoSize} />
          </View>

          {/* App Name */}
          <View style={appNameStyle}>
            <Text style={styles.appName}>FamilyCare Health</Text>
          </View>

          {/* Tagline */}
          <View style={taglineStyle}>
            <Text style={styles.tagline}>
              Your family's health journey, simplified and secure
            </Text>
          </View>

          {/* Value Propositions - Only show if not authenticated */}
          {showValueProps && (
            <View style={styles.valuePropsContainer}>
              <ValueProposition
                icon="lock"
                text="Bank-level security for all records"
                index={0}
                staggerDelay={150}
              />
              <ValueProposition
                icon="users"
                text="Manage entire family in one place"
                index={1}
                staggerDelay={150}
              />
              <ValueProposition
                icon="trending-up"
                text="Track health trends with AI insights"
                index={2}
                staggerDelay={150}
              />
            </View>
          )}
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          {/* Get Started Button */}
          {showGetStartedButton && (
            <View style={[styles.buttonContainer, buttonStyle]}>
              <Button
                variant="primary"
                size="lg"
                onPress={handleGetStarted}
                fullWidth
              >
                Get Started
              </Button>
            </View>
          )}

          {/* Sign In Link */}
          {showSignInLink && (
            <View style={[styles.signInContainer, signInStyle]}>
              <Text style={styles.signInText}>
                Already have an account?{' '}
                <Text style={styles.signInLink} onPress={handleSignIn}>
                  Sign In
                </Text>
              </Text>
            </View>
          )}

          {/* Version Number */}
          <View style={[styles.versionContainer, versionStyle]}>
            <Text style={styles.versionText}>v{appVersion}</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Sizes.contentPadding,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Sizes.xl,
  },
  logoContainer: {
    marginBottom: Sizes.lg,
  },
  appName: {
    ...Typography.styles.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Sizes.md,
  },
  tagline: {
    ...Typography.styles.tagline,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: Sizes.xl,
  },
  valuePropsContainer: {
    width: '100%',
    maxWidth: 360,
    marginTop: Sizes.sm,
  },
  ctaSection: {
    paddingBottom: Sizes.xl,
  },
  buttonContainer: {
    marginBottom: Sizes.md,
  },
  signInContainer: {
    alignItems: 'center',
    marginBottom: Sizes.lg,
  },
  signInText: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  signInLink: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
    textDecorationLine: 'underline',
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    ...Typography.styles.small,
    color: Colors.gray400,
  },
});
