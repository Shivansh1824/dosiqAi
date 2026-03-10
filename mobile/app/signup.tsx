import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import {     } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Button, Input } from '../src/components';
import { Colors, Sizes, Typography } from '../src/constants';
import { useAuthStore } from '../src/store/authStore';
import { useFadeSlideUp, useFadeIn } from '../src/utils/animations';




export default function SignupScreen() {
    const router = useRouter();
    const { signup } = useAuthStore();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Animations
    const headerStyle = useFadeSlideUp(20, 100, 400);
    const formStyle = useFadeSlideUp(20, 300, 400);
    const footerStyle = useFadeIn(700, 400);

    // Email validation
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Password validation
    const validatePassword = (password: string): boolean => {
        return password.length >= 6;
    };

    // Handle signup
    const handleSignup = async () => {
        // Reset errors
        setNameError('');
        setEmailError('');
        setPasswordError('');
        setConfirmPasswordError('');

        // Validate name
        if (!name.trim()) {
            setNameError('Name is required');
            return;
        }

        // Validate email
        if (!email) {
            setEmailError('Email is required');
            return;
        }

        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email');
            return;
        }

        // Validate password
        if (!password) {
            setPasswordError('Password is required');
            return;
        }

        if (!validatePassword(password)) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        // Validate confirm password
        if (password !== confirmPassword) {
            setConfirmPasswordError('Passwords do not match');
            return;
        }

        try {
            setIsLoading(true);

            await signup(email, password, name);

            // Navigate to home after successful signup
            router.replace('/home');
        } catch (error) {
            console.error('Signup error:', error);
            setEmailError(error instanceof Error ? error.message : 'Signup failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = () => {
        router.push('/login');
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
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Sign up to get started</Text>
                    </Animated.View>

                    {/* Form */}
                    <Animated.View style={[styles.form, formStyle]}>
                        {/* Name Input */}
                        <Input
                            label="Full Name"
                            placeholder="Enter your full name"
                            value={name}
                            onChangeText={(text) => {
                                setName(text);
                                setNameError('');
                            }}
                            autoCapitalize="words"
                            autoCorrect={false}
                            leftIcon="user"
                            error={nameError}
                        />

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
                            placeholder="Create a password"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                setPasswordError('');
                            }}
                            secureTextEntry
                            leftIcon="lock"
                            error={passwordError}
                        />

                        {/* Confirm Password Input */}
                        <Input
                            label="Confirm Password"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChangeText={(text) => {
                                setConfirmPassword(text);
                                setConfirmPasswordError('');
                            }}
                            secureTextEntry
                            leftIcon="lock"
                            error={confirmPasswordError}
                        />

                        {/* Sign Up Button */}
                        <Button
                            variant="primary"
                            size="lg"
                            onPress={handleSignup}
                            loading={isLoading}
                            disabled={isLoading}
                            fullWidth
                        >
                            Create Account
                        </Button>
                    </Animated.View>

                    {/* Sign In Link */}
                    <Animated.View style={[styles.signInContainer, footerStyle]}>
                        <Text style={styles.signInText}>
                            Already have an account?{' '}
                            <Text style={styles.signInLink} onPress={handleSignIn}>
                                Sign In
                            </Text>
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
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
    signInContainer: {
        alignItems: 'center',
        marginTop: Sizes.lg,
        paddingVertical: Sizes.md,
    },
    signInText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    signInLink: {
        color: Colors.primary,
        fontWeight: '700',
    },
});
