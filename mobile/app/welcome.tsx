import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Logo from '../src/components/Logo';
import { Colors, Sizes, Typography } from '../src/constants';
import { useAuthStore } from '../src/store/authStore';


const { width, height } = Dimensions.get('window');

const FeatureCard = ({ icon, title, description, index }: { icon: keyof typeof Feather.glyphMap, title: string, description: string, index: number }) => (
  <Animated.View
    entering={FadeInDown.delay(300 + (index * 100)).springify()}
    style={styles.featureCard}
  >
    <View style={styles.iconCircle}>
      <Feather name={icon} size={24} color={Colors.primary} />
    </View>
    <View style={styles.featureTextContent}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </Animated.View>
);

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const showGetStartedButton = !isAuthenticated;
  const showSignInLink = !isAuthenticated;
  const showValueProps = !isAuthenticated;

  // Auto-navigation for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        router.replace('/home');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  const handleGetStarted = () => {
    router.push('/onboarding1');
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  return (
    <View style={styles.container}>
      {/* Background with Gradient Mesh Effect */}
      <LinearGradient
        colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative blurred circles for depth */}
      <View style={[styles.decorativeCircle, styles.circle1]} />
      <View style={[styles.decorativeCircle, styles.circle2]} />
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.headerSection}>
            <View style={styles.logoWrapper}>
              <Logo size={Sizes.xxl * 1.8} />
            </View>
            <Text style={styles.headline}>
              Your Personal
              {'\n'}
              <Text style={{ color: Colors.primary }}>Health Companion</Text>
            </Text>
            <Text style={styles.subheadline}>
              Manage medications, track prescriptions, and stay healthy with the power of AI.
            </Text>
          </Animated.View>

          {/* Features Section */}
          {showValueProps && (
            <View style={styles.featuresSection}>
              <FeatureCard
                icon="camera"
                title="Scan Prescriptions"
                description="Instantly digitize your meds with a photo."
                index={0}
              />
              <FeatureCard
                icon="bell"
                title="Smart Reminders"
                description="Never miss a dose with timely alerts."
                index={1}
              />
              <FeatureCard
                icon="activity"
                title="Track Progress"
                description="Monitor your health journey over time."
                index={2}
              />
            </View>
          )}

          {/* Spacer to push buttons to bottom on large screens */}
          <View style={{ flex: 1 }} />

          {/* Bottom Actions */}
          <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.bottomSection}>
            {showGetStartedButton && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleGetStarted}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={[Colors.primary, '#0D9488']} // Example gradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.primaryButtonText}>Get Started</Text>
                  <Feather name="arrow-right" size={20} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {showSignInLink && (
              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>Already have an account?</Text>
                <TouchableOpacity onPress={handleSignIn}>
                  <Text style={styles.signInLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.xl,
    paddingBottom: Sizes.xxl,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
  },
  circle1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: '#CCFBF1', // Light teal
    top: -width * 0.2,
    right: -width * 0.2,
  },
  circle2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#E0E7FF', // Light indigo
    bottom: -width * 0.1,
    left: -width * 0.2,
  },
  headerSection: {
    alignItems: 'flex-start',
    marginBottom: Sizes.xxl,
    marginTop: Sizes.md,
    paddingHorizontal: Sizes.xs,
  },
  logoWrapper: {
    marginBottom: Sizes.lg,
    marginLeft: -Sizes.sm, // Slight negative margin to offset logo's internal padding if any
    // Add shadow to logo for depth
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headline: {
    fontSize: 32,
    ...Typography.fontWeights.extrabold,
    color: '#111827',
    textAlign: 'left',
    lineHeight: 40,
    marginBottom: Sizes.sm,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 16,
    ...Typography.fontWeights.regular,
    color: '#6B7280',
    textAlign: 'left',
    lineHeight: 24,
    maxWidth: '100%',
  },
  featuresSection: {
    marginBottom: Sizes.xl,
    gap: Sizes.md,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Sizes.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDFA', // Light teal bg
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  featureTextContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    ...Typography.fontWeights.bold,
    color: '#1F2937',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    ...Typography.fontWeights.regular,
    color: '#6B7280',
    lineHeight: 18,
  },
  bottomSection: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: Sizes.md,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    ...Typography.fontWeights.bold,
    letterSpacing: 0.5,
  },
  signInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signInText: {
    fontSize: 15,
    color: '#6B7280',
  },
  signInLink: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
