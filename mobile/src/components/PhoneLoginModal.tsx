import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Button } from './Button';
import { Input } from './Input';
import { Colors, Sizes, Typography } from '../constants';
import { useAuthStore } from '../store/authStore';
import { useFadeSlideUp, useFadeIn } from '../utils/animations';

interface PhoneLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PhoneLoginModal: React.FC<PhoneLoginModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { sendPhoneOTP, verifyPhoneOTP } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // OTP input refs
  const otpInputs = useRef<Array<TextInput | null>>([]);

  // Animations
  const contentStyle = useFadeSlideUp(20, 100, 400);
  const fadeStyle = useFadeIn(200, 300);

  // Format phone number with country code
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Add +1 if not present (assuming US/Canada)
    if (cleaned.length === 10) {
      return '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return '+' + cleaned;
    } else if (cleaned.startsWith('+')) {
      return phone;
    }

    return '+' + cleaned;
  };

  // Validate phone number
  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10;
  };

  // Handle send OTP
  const handleSendOTP = async () => {
    setError('');
    setSuccessMessage('');

    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setIsLoading(true);
      const formattedPhone = formatPhoneNumber(phoneNumber);

      console.log('[PhoneModal] Sending OTP to:', formattedPhone);
      const result = await sendPhoneOTP(formattedPhone);
      console.log('[PhoneModal] OTP sent successfully:', result);

      setSuccessMessage(result.message);
      setStep('otp');

      // Dismiss keyboard and auto-focus first OTP input
      Keyboard.dismiss();
      setTimeout(() => otpInputs.current[0]?.focus(), 500);
    } catch (err) {
      console.error('[PhoneModal] Send OTP error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take only last character
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (index === 5 && value) {
      const completeOtp = newOtp.join('');
      if (completeOtp.length === 6) {
        handleVerifyOTP(completeOtp);
      }
    }
  };

  // Handle OTP backspace
  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Handle verify OTP
  const handleVerifyOTP = async (otpValue?: string) => {
    setError('');

    const otpCode = otpValue || otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      const formattedPhone = formatPhoneNumber(phoneNumber);

      console.log('[PhoneModal] Verifying OTP:', { phone: formattedPhone, otpLength: otpCode.length });
      await verifyPhoneOTP(formattedPhone, otpCode);
      console.log('[PhoneModal] OTP verified successfully');

      // Success! Dismiss keyboard first
      Keyboard.dismiss();

      // Small delay for better UX
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 300);
    } catch (err) {
      console.error('[PhoneModal] Verify OTP error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setError(errorMessage);

      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpInputs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setPhoneNumber('');
    setOtp(['', '', '', '', '', '']);
    setStep('phone');
    setError('');
    setSuccessMessage('');
    onClose();
  };

  // Handle back to phone input
  const handleBackToPhone = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setSuccessMessage('');
  };

  // Dismiss keyboard when closing modal
  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={step === 'otp' ? handleBackToPhone : handleClose}
              accessibilityRole="button"
              accessibilityLabel={step === 'otp' ? 'Go back' : 'Close'}
            >
              <Feather
                name={step === 'otp' ? 'arrow-left' : 'x'}
                size={24}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Phone Login</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View style={[styles.content, contentStyle]}>
              {step === 'phone' ? (
                // Phone Number Input Step
                <>
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <Feather name="smartphone" size={32} color={Colors.primary} />
                    </View>
                  </View>

                  <Text style={styles.title}>Enter Your Phone Number</Text>
                  <Text style={styles.subtitle}>
                    We'll send you a verification code to confirm your number
                  </Text>

                  <View style={styles.form}>
                    <Input
                      label="Phone Number"
                      placeholder="+1 (555) 000-0000"
                      value={phoneNumber}
                      onChangeText={(text) => {
                        setPhoneNumber(text);
                        setError('');
                      }}
                      keyboardType="phone-pad"
                      autoFocus
                      leftIcon="smartphone"
                      error={error}
                    />

                    {successMessage ? (
                      <Animated.View style={[styles.successBanner, fadeStyle]}>
                        <Feather name="check-circle" size={16} color={Colors.success} />
                        <Text style={styles.successText}>{successMessage}</Text>
                      </Animated.View>
                    ) : null}

                    <Button
                      variant="primary"
                      size="lg"
                      onPress={handleSendOTP}
                      loading={isLoading}
                      disabled={isLoading || !phoneNumber}
                      fullWidth
                    >
                      Send Code
                    </Button>
                  </View>
                </>
              ) : (
                // OTP Verification Step
                <>
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <Feather name="lock" size={32} color={Colors.primary} />
                    </View>
                  </View>

                  <Text style={styles.title}>Enter Verification Code</Text>
                  <Text style={styles.subtitle}>
                    We sent a 6-digit code to{'\n'}
                    <Text style={styles.phoneDisplay}>{phoneNumber}</Text>
                  </Text>

                  <View style={styles.form}>
                    {/* OTP Input */}
                    <View style={styles.otpContainer}>
                      {otp.map((digit, index) => (
                        <TextInput
                          key={index}
                          ref={(ref) => { otpInputs.current[index] = ref; }}
                          style={[
                            styles.otpInput,
                            digit && styles.otpInputFilled,
                            error && styles.otpInputError,
                          ]}
                          value={digit}
                          onChangeText={(value) => handleOtpChange(index, value)}
                          onKeyPress={({ nativeEvent: { key } }) => handleOtpKeyPress(index, key)}
                          keyboardType="number-pad"
                          maxLength={1}
                          selectTextOnFocus
                          accessibilityLabel={`OTP digit ${index + 1}`}
                        />
                      ))}
                    </View>

                    {error ? (
                      <Animated.View style={[styles.errorBanner, fadeStyle]}>
                        <Feather name="alert-circle" size={16} color={Colors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                      </Animated.View>
                    ) : null}

                    {isLoading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.loadingText}>Verifying code...</Text>
                      </View>
                    ) : null}

                    <Button
                      variant="primary"
                      size="lg"
                      onPress={() => handleVerifyOTP()}
                      loading={isLoading}
                      disabled={isLoading || otp.join('').length !== 6}
                      fullWidth
                    >
                      Verify Code
                    </Button>

                    {/* Resend Code */}
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={handleSendOTP}
                      disabled={isLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Resend code"
                    >
                      <Text style={styles.resendText}>
                        Didn't receive the code?{' '}
                        <Text style={styles.resendLink}>Resend</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Sizes.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.contentPadding,
    paddingVertical: Sizes.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: Sizes.minTouchTarget,
    height: Sizes.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...Typography.styles.h4,
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: Sizes.minTouchTarget,
  },
  content: {
    paddingHorizontal: Sizes.contentPadding,
    paddingTop: Sizes.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Sizes.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.styles.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Sizes.sm,
  },
  subtitle: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Sizes.xl,
    lineHeight: 22,
  },
  phoneDisplay: {
    fontSize: 16,
    fontWeight: Typography.semibold,
    color: Colors.primary,
  },
  form: {
    marginTop: Sizes.lg,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Sizes.lg,
    paddingHorizontal: Sizes.sm,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Sizes.radiusMd,
    backgroundColor: Colors.white,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  otpInputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    padding: Sizes.md,
    borderRadius: Sizes.radiusMd,
    marginBottom: Sizes.md,
  },
  successText: {
    ...Typography.styles.body,
    color: Colors.success,
    marginLeft: Sizes.sm,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: Sizes.md,
    borderRadius: Sizes.radiusMd,
    marginBottom: Sizes.md,
  },
  errorText: {
    ...Typography.styles.body,
    color: Colors.error,
    marginLeft: Sizes.sm,
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.md,
  },
  loadingText: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    marginLeft: Sizes.sm,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: Sizes.lg,
    paddingVertical: Sizes.md,
  },
  resendText: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
  },
  resendLink: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
    textDecorationLine: 'underline',
  },
});
