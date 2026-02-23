import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Animated2, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming, withRepeat } from 'react-native-reanimated';
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
// OPTIMIZED: Uses Reanimated for UI thread performance
const BreathingGradientBG = () => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, { duration: 2500 }),
            -1,
            true
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    return (
        <Animated2.View
            style={[StyleSheet.absoluteFill, style]}
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
        </Animated2.View>
    );
};

// ─── Icon Glow — diagonal cut gradient before the logo ────────────────────────
// A rotated gradient block that sits behind/before the sparkles icon.
// OPTIMIZED: Uses Reanimated to prevent JS thread blocking
const IconGlow = () => {
    const opacity = useSharedValue(0.6);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1.0, { duration: 2500 }),
            -1,
            true
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ rotate: '25deg' }]
    }));

    return (
        <Animated2.View
            style={[
                {
                    position: 'absolute',
                    left: -20,
                    top: -40,
                    width: 140,
                    height: 180,
                },
                style
            ]}
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
        </Animated2.View>
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
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PrescriptionSummary({
    summary,
    otherInformation,
    recommendedTests,
    style,
    defaultExpanded = false,
    followUp,
}: PrescriptionSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Dynamic style based on expansion
    // OPTIMIZED: No layout thrashing (borderWidth is constant)
    const containerStyle = useAnimatedStyle(() => {
        return {
            borderColor: withTiming(isExpanded ? '#BFDBFE' : 'transparent', { duration: 250 }), // Lighter blue (Blue-200)
        };
    }, [isExpanded]);

    return (
        <Animated2.View
            // Use standard duration for no-bounce, high-performance transition
            // Tuned to 250ms for snappier feel
            layout={LinearTransition.duration(250)}
            style={[styles.outerShell, style, containerStyle, { borderWidth: 0 }]}
        >
            {/* Pulsing blue-violet aura glow just behind/before the icon - Always visible */}
            <IconGlow />

            {/* ── Header Row (always visible, tappable dropdown) ── */}
            <TouchableOpacity
                style={styles.aiSummaryHeader}
                onPress={() => setIsExpanded(prev => !prev)}
                activeOpacity={0.7}
            >
                <View style={styles.headerLeft}>
                    <View style={styles.iconContainer}>
                        <GradientSparklesIcon size={28} />
                    </View>
                    <View style={styles.titleStack}>
                        <Text style={styles.aiSummaryTitle}>AI ANALYSIS</Text>
                        <Text style={styles.aiSummarySubtitle}>
                            Generated by dosiq A<Text style={{ fontSize: 10 }}>I</Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.chevronContainer}>
                    <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color="#60A5FA"
                    />
                </View>
            </TouchableOpacity>

            {/* ── Expanded Content (dropdown) ── */}
            {isExpanded && (
                <Animated2.View
                    entering={FadeIn.duration(400)}
                    exiting={FadeOut.duration(200)}
                    style={styles.contentContainer}
                >
                    <Text style={styles.infoLabel}>SUMMARY</Text>
                    <Text style={styles.aiSummaryText}>{summary}</Text>


                    {/* Follow-up */}
                    {followUp && (followUp.follow_up_date || followUp.follow_up_days) && (
                        <View style={styles.infoBlock}>
                            <View style={styles.infoIcon}>
                                <MaterialCommunityIcons name="calendar-clock" size={18} color="#60A5FA" />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Follow Up</Text>
                                <Text style={styles.infoValue}>
                                    {followUp.follow_up_days && followUp.follow_up_date
                                        ? `After ${followUp.follow_up_days} days, on ${followUp.follow_up_date}`
                                        : followUp.follow_up_date
                                            ? `On ${followUp.follow_up_date}`
                                            : `In ${followUp.follow_up_days} days`}
                                </Text>
                            </View>
                        </View>
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


        </Animated2.View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    outerShell: {
        backgroundColor: Colors.white,
        borderRadius: 24, // More rounded for modern feel
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 20, // Increased padding
        paddingTop: 18,        // Increased top padding
        paddingBottom: 20,     // Increased bottom padding
        position: 'relative', 
        overflow: 'hidden',
        // Card Shadows
        shadowColor: '#1a1a2e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    // bottomDivider removed (no longer needed for card design)

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
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Increased gap
        flex: 1,
    },
    iconContainer: {
        width: 40, // Increased icon container size
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.08)', // subtle background for icon
        borderRadius: 12,
    },
    titleStack: {
        gap: 2,
    },
    aiSummaryTitle: {
        fontSize: 20, // Increased title size
        fontWeight: '800',
        color: Colors.gray900,
        letterSpacing: 0.5,
    },
    aiSummarySubtitle: {
        fontSize: 12, // Increased subtitle size
        color: '#2563EB',
        ...Typography.fontWeights.extrabold,
        letterSpacing: 0.2,
        opacity: 1,
    },

    // Chevron
    chevronContainer: {
        width: 36, // Increased hit area
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderRadius: 12,
    },

    // Content
    contentContainer: {
        marginTop: 20, // Increased spacing
        gap: 6,
    },
    aiSummaryText: {
        fontSize: 16, // Increased body text size
        lineHeight: 26, // Increased line height for readability
        color: Colors.gray700,
        ...Typography.fontWeights.regular,
        marginTop: 4,
        marginBottom: 10,
    },
    sectionContainer: {
        gap: 12,
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
