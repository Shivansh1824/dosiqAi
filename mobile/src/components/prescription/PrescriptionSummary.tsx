import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants';

interface PrescriptionSummaryProps {
    summary: string;
}

/**
 * PrescriptionSummary - AI Summary card for prescriptions with read more functionality
 * Extracted from DocumentDetailScreen.tsx
 */
export function PrescriptionSummary({ summary }: PrescriptionSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Truncate text to 80 characters without cutting off words
    const truncateText = (text: string, maxLength: number): string => {
        if (text.length <= maxLength) {
            return text;
        }

        // Find the last space before maxLength
        const truncated = text.slice(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');

        // If there's a space, truncate at that point; otherwise use the full maxLength
        return lastSpaceIndex > 0 ? text.slice(0, lastSpaceIndex) : truncated;
    };

    const shouldShowReadMore = summary.length > 80;
    const displayText = shouldShowReadMore && !isExpanded
        ? truncateText(summary, 80)
        : summary;

    return (
        <View style={styles.aiSummaryCard}>
            <View style={styles.aiSummaryHeader}>
                <MaterialCommunityIcons name="creation" size={22} color={Colors.primary} />
                <Text style={styles.aiSummaryTitle}>AI Summary</Text>
            </View>
            <Text style={styles.aiSummaryText}>
                {displayText}
                {shouldShowReadMore && !isExpanded && '... '}
                {shouldShowReadMore && (
                    <Text
                        style={styles.readMoreText}
                        onPress={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? 'read less' : 'read more'}
                    </Text>
                )}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    aiSummaryCard: {
        backgroundColor: 'rgba(59, 130, 246, 0.05)', // Subtle Blue Tint (matches original)
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
    },
    aiSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    aiSummaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    aiSummaryText: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.gray700,
        fontWeight: '400',
    },
    readMoreText: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.primary,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});

