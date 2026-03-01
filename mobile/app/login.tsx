import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {     } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Button, Input, Divider, PhoneLoginModal } from '../src/components';
import { Colors, Sizes, Typography } from '../src/constants';
import { useAuthStore } from '../src/store/authStore';
import { useFadeSlideUp, useFadeIn } from '../src/utils/animations';


type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Animations
  const headerStyle = useFadeSlideUp(20, 100, 400);
  const formStyle = useFadeSlideUp(20, 300, 400);
  const socialStyle = useFadeIn(700, 400);

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle login (placeholder - no actual authentication yet)
  const handleLogin = async () => {
    // Reset errors
    setEmailError('');

    // Validate email
    if (!email) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      return;
    }

    if (!password) {
      // Just show alert for now
      console.log('Password is required');
      return;
    }

    try {
      setIsLoading(true);

      await login(email, password);

      // Navigate to home after successful login
      router.replace('/home');
    } catch (error) {
      console.error('Login error:', error);
      setEmailError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Social login handlers
  const handleGoogleLogin = async () => {
    try {
      setOauthLoading('google');
      await loginWithGoogle();
      // OAuth flow will handle navigation via deep link
    } catch (error) {
      console.error('Google login error:', error);
      setEmailError(error instanceof Error ? error.message : 'Google login failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  };

  const handlePhoneLogin = () => {
    setShowPhoneModal(true);
  };

  const handlePhoneLoginSuccess = () => {
    // Navigate directly to Home
    router.replace('/home');
  };

  const handleForgotPassword = () => {
    console.log('Forgot password clicked - To be implemented');
  };

  const handleSignUp = () => {
    router.push('/signup');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/welcome');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* Header */}
          <Animated.View style={[styles.header, headerStyle]}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[styles.form, formStyle]}>
            {/* Email Input */}
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="mail"
              error={emailError}
            />

            {/* Password Input */}
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock"
            />

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
            >
              Sign In
            </Button>
          </Animated.View>

          {/* Divider */}
          <Animated.View style={[styles.dividerContainer, socialStyle]}>
            <Divider text="OR" spacing="lg" />
          </Animated.View>

          {/* Social Login Buttons */}
          <Animated.View style={[styles.socialButtons, socialStyle]}>
            <View style={styles.socialButtonWrapper}>
              <Button
                variant="social"
                size="lg"
                socialProvider="google"
                onPress={handleGoogleLogin}
                loading={oauthLoading === 'google'}
                disabled={oauthLoading !== null}
                hapticFeedback
              >
                Continue with Google
              </Button>
            </View>



            <View style={styles.socialButtonWrapper}>
              <Button
                variant="social"
                size="lg"
                socialProvider="phone"
                onPress={handlePhoneLogin}
                disabled={oauthLoading !== null || isLoading}
                hapticFeedback
              >
                Continue with Phone
              </Button>
            </View>
          </Animated.View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>
              Don't have an account?{' '}
              <Text style={styles.signUpLink} onPress={handleSignUp}>
                Sign Up
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phone Login Modal */}
      <PhoneLoginModal
        visible={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onSuccess={handlePhoneLoginSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Sizes.lg,
    paddingBottom: Sizes.xxl,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: Sizes.sm,
    marginBottom: Sizes.md,
  },
  header: {
    marginBottom: Sizes.xl,
    marginTop: Sizes.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  form: {
    marginBottom: Sizes.xl,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Sizes.lg,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  dividerContainer: {
    marginVertical: Sizes.lg,
  },
  socialButtons: {
    gap: Sizes.md,
  },
  socialButtonWrapper: {
    marginBottom: 0,
  },
  signUpContainer: {
    alignItems: 'center',
    marginTop: Sizes.xxl,
    paddingVertical: Sizes.md,
  },
  signUpText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  signUpLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
