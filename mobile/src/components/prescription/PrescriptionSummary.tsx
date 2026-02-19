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

    return (
        <Animated2.View
            layout={LinearTransition.duration(250)}
            style={[styles.outerShell, style]}
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
                        <GradientSparklesIcon size={24} />
                    </View>
                    <View style={styles.titleStack}>
                        <Text style={styles.aiSummaryTitle}>AI SUMMARY</Text>
                        <Text style={styles.aiSummarySubtitle}>
                            Generated by dosiq A<Text style={{ fontSize: 9 }}>I</Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.chevronContainer}>
                    <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color="#60A5FA"
                    />
                </View>
            </TouchableOpacity>

            {/* ── Expanded Content (dropdown) ── */}
            {isExpanded && (
                <Animated2.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
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

            {/* Bottom divider */}
            <View style={styles.bottomDivider} />
        </Animated2.View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    outerShell: {
        width: '100%',
        backgroundColor: 'transparent', // Transparent to let screen gradient flow through
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 0,
        position: 'relative',
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
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    iconContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleStack: {
        gap: 1,
    },
    aiSummaryTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.gray900,
        letterSpacing: 0.8,
    },
    aiSummarySubtitle: {
        fontSize: 11,
        color: '#2563EB',
        ...Typography.fontWeights.extrabold,
        letterSpacing: 0.2,
        opacity: 1,
    },

    // Chevron
    chevronContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.06)',
        borderRadius: 16,
    },

    // Content
    contentContainer: {
        marginTop: 16,
        gap: 4,
    },
    aiSummaryText: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.gray700,
        ...Typography.fontWeights.regular,
        marginTop: 2,
        marginBottom: 8,
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
