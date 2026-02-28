import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary to catch unhandled React errors
 * Prevents the app from showing a white screen on crash
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.title}>Oops! Something went wrong.</Text>
                        <Text style={styles.message}>
                            We encountered an unexpected error. Please try again.
                        </Text>
                        {this.state.error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>
                                    {this.state.error.toString()}
                                </Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleRetry}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
    },
    title: {
        ...Typography.styles.h3,
        color: Colors.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        ...Typography.styles.body,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    errorContainer: {
        backgroundColor: Colors.errorLight,
        padding: 12,
        borderRadius: 8,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.error,
    },
    errorText: {
        ...Typography.styles.small,
        color: Colors.errorDark,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    button: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        elevation: 2,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    buttonText: {
        ...Typography.styles.button,
        color: Colors.white,
    },
});
