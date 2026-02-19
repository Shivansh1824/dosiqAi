import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Animated2, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';

// ─── Gradient Sparkles Icon (Blue theme) ─────────────────────────────────────
const GradientSparklesIcon = ({ size = 24 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
            <SvgLinearGradient id="sparklesGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#1E40AF" stopOpacity="1" />
                <Stop offset="0.5" stopColor="#3B82F6" stopOpacity="1" />
                <Stop offset="1" stopColor="#60A5FA" stopOpacity="1" />
            </SvgLinearGradient>
        </Defs>
        <Path
            d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"
            fill="url(#sparklesGradient)"
        />
    </Svg>
);

// ─── Breathing Diagonal Gradient Background ──────────────────────────────────
// Continuous, clean animation: fades from a slightly darker shade at top-left
// to a very light shade at bottom-right, pulsing gently and repeatedly.
const BreathingGradientBG = () => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                // Breathe in: gradient becomes more visible
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 2500,
                    useNativeDriver: true,
                }),
                // Breathe out: gradient fades back
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 2500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { opacity }]}
            pointerEvents="none"
        >
            {/* Diagonal gradient: top-left slightly darker → bottom-right very light */}
            <LinearGradient
                colors={[
                    'rgba(59, 130, 246, 0.07)',   // Top-left: a little darker blue
                    'rgba(96, 165, 250, 0.04)',   // Middle: softer
                    'rgba(147, 197, 253, 0.015)', // Bottom-right: almost transparent
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
        </Animated.View>
    );
};

// ─── Icon Glow — diagonal cut gradient before the logo ────────────────────────
// A rotated gradient block that sits behind/before the sparkles icon, creating
// the "diagonal cut" effect seen in the screenshot.
const IconGlow = () => {
    const opacity = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1.0, duration: 2500, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.5, duration: 2500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                left: -20,
                top: -40,
                width: 140,
                height: 180,
                transform: [{ rotate: '25deg' }], // Diagonal tilt
                opacity,
            }}
            pointerEvents="none"
        >
            <LinearGradient
                colors={[
                    'rgba(59, 130, 246, 0.25)',  // Blue core
                    'rgba(124, 58, 237, 0.15)', // Violet mid
                    'rgba(96, 165, 250, 0.05)', // Sky-blue edge
                    'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }} // Horizontal gradient (relative to rotation)
                style={{ flex: 1 }}
            />
        </Animated.View>
    );
};


// ─── Props ────────────────────────────────────────────────────────────────────
interface PrescriptionSummaryProps {
    summary: string;
    otherInformation?: Array<{ value: string; category?: string }>;
    recommendedTests?: Array<{ test_name: string; reason?: string }>;
    style?: any;
    defaultExpanded?: boolean;
    followUp?: {
        follow_up_date?: string;
        follow_up_days?: number;
        follow_up_notes?: string;
    };
    expanded?: boolean;
    onToggle?: (expanded: boolean) => void;
}

/**
 * PrescriptionSummary - AI Summary card for prescriptions with read more functionality
 * Extracted from PrescriptionSummaryScreen.tsx
 */
export function PrescriptionSummary({ summary, otherInformation, recommendedTests, style, defaultExpanded = false, followUp, expanded, onToggle }: PrescriptionSummaryProps) {
    const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
    const isExpanded = expanded !== undefined ? expanded : localExpanded;

    const handleToggle = () => {
        if (onToggle) {
            onToggle(!isExpanded);
        } else {
            setLocalExpanded(!isExpanded);
        }
    };

    return (
        <Animated.View
            layout={LinearTransition.duration(300)}
            style={[styles.aiSummaryCard, style]}
        >
            <LinearGradient
                colors={['#EFF6FF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <TouchableOpacity
                style={styles.aiSummaryHeader}
                onPress={handleToggle}
                activeOpacity={0.7}
            >
                <View style={styles.headerLeft}>
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="creation" size={18} color={Colors.white} />
                    </View>
                    <Text style={styles.aiSummaryTitle}>Ai Summary</Text>
                </View>
                <MaterialCommunityIcons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={Colors.primary}
                />
            </TouchableOpacity>

            {/* ── Expanded Content (dropdown) ── */}
            {isExpanded && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.contentContainer}
                >
                    <Text style={styles.infoLabel}>SUMMARY</Text>
                    <Text style={styles.aiSummaryText}>{summary}</Text>

                    {/* Follow-up */}
                    {followUp && (followUp.follow_up_date || followUp.follow_up_days) && (
                        <Text style={[styles.aiSummaryText, { marginTop: 12 }]}>
                            <Text style={styles.boldText}>Follow Up. </Text>
                            {followUp.follow_up_days && followUp.follow_up_date
                                ? `Advised to follow up with the doctor after ${followUp.follow_up_days} days, on ${followUp.follow_up_date}.`
                                : followUp.follow_up_date
                                    ? `Advised to follow up with the doctor on ${followUp.follow_up_date}.`
                                    : `Advised to follow up with the doctor in ${followUp.follow_up_days} days.`
                            }
                        </Text>
                    )}

                    {/* Other Information */}
                    {otherInformation && otherInformation.length > 0 && (
                        <View style={styles.sectionContainer}>
                            {otherInformation.map((info, index) => (
                                <View key={index} style={styles.infoBlock}>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>{info.category || 'Note'}</Text>
                                        <Text style={styles.infoValue}>{info.value}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </Animated2.View>
            )}

            {/* Bottom divider */}
            <View style={styles.bottomDivider} />
        </Animated2.View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    aiSummaryCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        marginBottom: 0,
        marginHorizontal: 16,
        marginTop: 8,
        padding: 0,
        borderWidth: 1.5,
        borderColor: Colors.primaryLight,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 4,
        overflow: 'hidden',
    },
    bottomDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginTop: 16,
        marginHorizontal: -16,
    },

    // Shimmer
    shimmerWrapper: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 350,
        zIndex: 10,
    },
    shimmerGradient: {
        flex: 1,
    },

    // Header
    aiSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
        paddingVertical: 14,
        paddingHorizontal: 18,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    iconContainer: {
        backgroundColor: Colors.primary,
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    contentContainer: {
        marginTop: 0,
        paddingHorizontal: 18,
        paddingBottom: 18,
        borderTopWidth: 1.25,
        borderTopColor: 'rgba(59, 130, 246, 0.1)', // Light primary border
        paddingTop: 14,
    },
    aiSummaryTitle: {
        fontSize: 18,
        ...Typography.fontWeights.extrabold,
        color: Colors.primaryDark,
        letterSpacing: -0.3,
    },
    aiSummaryText: {
        fontSize: 14,
        lineHeight: 21,
        color: Colors.gray700,
        ...Typography.fontWeights.regular,
    },
    extraInfoContainer: {
        marginTop: 12,
        gap: 8,
    },
    sectionContainer: {
        marginTop: 8,
    },
    infoBlock: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    infoIcon: {
        marginTop: 2,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#2563EB',
        ...Typography.fontWeights.extrabold,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    infoValue: {
        fontSize: 15,
        color: Colors.gray700,
        lineHeight: 24,
        ...Typography.fontWeights.regular,
    },
});
