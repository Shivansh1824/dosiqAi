import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants';

// Update Props to include style
interface PrescriptionSummaryProps {
    summary: string;
    otherInformation?: Array<{ value: string; category?: string }>;
    recommendedTests?: Array<{ test_name: string; reason?: string }>;
    style?: any;
    /** When true, the summary dropdown will be expanded by default (e.g., for invalid documents) */
    defaultExpanded?: boolean;
}

/**
 * PrescriptionSummary - AI Summary card for prescriptions with read more functionality
 * Extracted from DocumentDetailScreen.tsx
 */
export function PrescriptionSummary({ summary, otherInformation, recommendedTests, style, defaultExpanded = false }: PrescriptionSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Consolidated display logic: show nothing by default (except header), show all when expanded
    return (
        <View style={[styles.aiSummaryCard, style]}>
            <TouchableOpacity
                style={styles.aiSummaryHeader}
                onPress={() => setIsExpanded(!isExpanded)}
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
                <View style={styles.contentContainer}>
                    <Text style={styles.aiSummaryText}>
                        {summary}
                    </Text>

                    {/* Recommended Tests Section */}
                    {recommendedTests && recommendedTests.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Recommended Investigations:</Text>
                            <Text style={styles.aiSummaryText}>
                                {recommendedTests.map(t => t.test_name).join(', ')}
                            </Text>
                        </View>
                    )}

                    {/* Other Information Section */}
                    {otherInformation && otherInformation.length > 0 && (
                        <View style={styles.sectionContainer}>
                            {otherInformation.map((info, index) => (
                                <View key={index} style={styles.infoRow}>
                                    <Text style={styles.aiSummaryText}>
                                        <Text style={styles.boldText}>{info.category ? `${info.category}: ` : 'Note: '}</Text>
                                        {info.value}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    aiSummaryCard: {
        backgroundColor: 'transparent',
        borderRadius: 0,
        marginBottom: 0,
        padding: 16,
    },
    aiSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0, // Removing bottom margin when collapsed
        paddingVertical: 4, // Add touch target helper
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    contentContainer: {
        marginTop: 12, // Move margin here so it only applies when expanded
    },
    aiSummaryTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.gray900,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    aiSummaryText: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.gray700,
        fontWeight: '400',
    },
    // Removed readMore styles as they are no longer needed
    extraInfoContainer: {
        marginTop: 12,
        gap: 8,
    },
    sectionContainer: {
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    infoRow: {
        marginBottom: 2,
    },
    boldText: {
        fontWeight: '600',
        color: Colors.gray800,
    }
});

