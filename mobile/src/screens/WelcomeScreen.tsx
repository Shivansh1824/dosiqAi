import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import Logo from '../components/Logo';
import { Button, ValueProposition } from '../components';
import { Colors, Sizes, Typography } from '../constants';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../../App';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { isAuthenticated } = useAuthStore();

  const showGetStartedButton = !isAuthenticated;
  const showSignInLink = !isAuthenticated;
  const showValueProps = !isAuthenticated;

  // Auto-navigation for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        navigation.replace('Home');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigation]);

  const handleGetStarted = () => {
    navigation.navigate('Onboarding1');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  // Modern, clean background color instead of generic gradient
  // Using a very subtle off-white/gray for a premium feel
  const backgroundColor = '#F8F9FA';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea}>

        {/* Main Content Area */}
        <View style={styles.contentContainer}>

          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoWrapper}>
              <Logo size={Sizes.xxl * 1.5} />
            </View>

            <Text style={styles.tagline}>
              Track Medicines with the power of Ai
            </Text>
          </View>

          {/* Features / Value Props */}
          {showValueProps && (
            <View style={styles.featuresContainer}>
              <ValueProposition
                icon="file-text"
                text="AI-Powered Report Analysis"
                subText="Extract insights from labs & prescriptions"
                index={0}
                staggerDelay={100}
              />
              <ValueProposition
                icon="bell"
                text="Smart Medication Management"
                subText="Never miss a dose with intelligent reminders"
                index={1}
                staggerDelay={100}
              />
              <ValueProposition
                icon="activity"
                text="Health Trends & Insights"
                subText="Visualize your recovery metrics over time"
                index={2}
                staggerDelay={100}
              />
            </View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          {showGetStartedButton && (
            <Button
              variant="primary"
              size="lg"
              onPress={handleGetStarted}
              fullWidth
              style={styles.mainButton}
            >
              Get Started
            </Button>
          )}

          {showSignInLink && (
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>
                Already have an account?{' '}
                <Text style={styles.signInLink} onPress={handleSignIn}>
                  Sign In
                </Text>
              </Text>
            </View>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    marginHorizontal: Sizes.contentPadding,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Sizes.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Sizes.xxl,
  },
  logoWrapper: {
    marginBottom: Sizes.lg,
    // Add a subtle shadow for depth if needed, or keep flat
  },
  tagline: {
    ...Typography.styles.h3,
    color: Colors.gray600,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: Sizes.sm,
    fontWeight: '500',
  },
  featuresContainer: {
    marginTop: Sizes.md,
    gap: Sizes.md,
  },
  bottomSection: {
    marginBottom: Sizes.xl,
  },
  mainButton: {
    marginBottom: Sizes.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  signInContainer: {
    alignItems: 'center',
  },
  signInText: {
    ...Typography.styles.body,
    color: Colors.gray500,
  },
  signInLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
