import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants';

interface PrescriptionSummaryProps {
    summary: string;
}

/**
 * PrescriptionSummary - AI Summary card for prescriptions
 * Extracted from DocumentDetailScreen.tsx
 */
export function PrescriptionSummary({ summary }: PrescriptionSummaryProps) {
    return (
        <View style={styles.aiSummaryCard}>
            <View style={styles.aiSummaryHeader}>
                <MaterialCommunityIcons name="creation" size={22} color={Colors.primary} />
                <Text style={styles.aiSummaryTitle}>AI Summary</Text>
            </View>
            <Text style={styles.aiSummaryText}>{summary}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    aiSummaryCard: {
        backgroundColor: Colors.white,
        padding: 16,
        marginBottom: 8,
    },
    aiSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    aiSummaryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    aiSummaryText: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.textPrimary,
        letterSpacing: 0.2,
    },
});
