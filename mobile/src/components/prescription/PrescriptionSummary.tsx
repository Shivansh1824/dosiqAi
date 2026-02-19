import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../../constants';

// Update Props to include style
interface PrescriptionSummaryProps {
    summary: string;
    otherInformation?: Array<{ value: string; category?: string }>;
    recommendedTests?: Array<{ test_name: string; reason?: string }>;
    style?: any;
    /** When true, the summary dropdown will be expanded by default (e.g., for invalid documents) */
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

    // Consolidated display logic: show nothing by default (except header), show all when expanded
    return (
        <Animated.View
            layout={LinearTransition.duration(300)}
            style={[styles.aiSummaryCard, style]}
        >
            <TouchableOpacity
                style={styles.aiSummaryHeader}
                onPress={handleToggle}
                activeOpacity={0.7}
            >
                <View style={styles.headerLeft}>
                    <MaterialCommunityIcons name="creation" size={22} color={Colors.primary} />
                    <Text style={styles.aiSummaryTitle}>AI Summary</Text>
                </View>
                <MaterialCommunityIcons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={Colors.gray500}
                />
            </TouchableOpacity>

            {isExpanded && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.contentContainer}
                >
                    <Text style={styles.aiSummaryText}>
                        {summary}
                    </Text>

                    {/* Follow-up Section - Normal Text Display */}
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


                    {/* Other Information Section - Simple Text List */}
                    {otherInformation && otherInformation.length > 0 && (
                        <View style={styles.sectionContainer}>
                            {otherInformation.map((info, index) => (
                                <Text key={index} style={[styles.aiSummaryText, { marginTop: 4 }]}>
                                    <Text style={styles.boldText}>{info.category || 'Note'}. </Text>
                                    {info.value}
                                </Text>
                            ))}
                        </View>
                    )}
                </Animated.View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    aiSummaryCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        marginBottom: 0,
        marginHorizontal: 16,
        marginTop: 8,
        padding: 0,
        borderWidth: 1,
        borderColor: Colors.gray200,
        shadowColor: '#1a1a2e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        overflow: 'hidden',
    },
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
        gap: 10,
    },
    contentContainer: {
        marginTop: 0,
        paddingHorizontal: 18,
        paddingBottom: 18,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
        paddingTop: 14,
    },
    aiSummaryTitle: {
        fontSize: 16,
        ...Typography.fontWeights.bold,
        color: Colors.gray900,
        letterSpacing: -0.2,
    },
    aiSummaryText: {
        fontSize: 14,
        lineHeight: 21,
        color: Colors.gray600,
        ...Typography.fontWeights.regular,
    },
    extraInfoContainer: {
        marginTop: 12,
        gap: 8,
    },
    sectionContainer: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 14,
        ...Typography.fontWeights.semibold,
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    infoRow: {
        marginBottom: 2,
    },
    boldText: {
        ...Typography.fontWeights.bold,
        color: Colors.gray800,
    }
});

