import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';

interface CoursePeriodSectionProps {
    startDate: string;
    endDate: string;
    onStartDatePress: () => void;
    onEndDatePress: () => void;
}

/**
 * Format date for display (e.g., "Jan 12, 2026")
 */
const formatDateDisplay = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
};

/**
 * CoursePeriodSection - Start date and end date cards with edit icons
 * Extracted from MedicationVerificationCard.tsx
 */
export function CoursePeriodSection({
    startDate,
    endDate,
    onStartDatePress,
    onEndDatePress,
}: CoursePeriodSectionProps) {
    return (
        <View style={styles.coursePeriodContainer}>
            <View style={styles.coursePeriodHeader}>
                <Feather name="calendar" size={16} color={Colors.primary} />
                <Text style={styles.coursePeriodTitle}>COURSE PERIOD</Text>
            </View>
            <View style={styles.coursePeriodCards}>
                {/* Start Date Card - Clickable */}
                <TouchableOpacity
                    style={styles.dateCard}
                    onPress={onStartDatePress}
                    activeOpacity={0.7}
                >
                    <View style={styles.dateCardContent}>
                        <Text style={styles.dateCardLabel}>START DATE</Text>
                        <Text style={styles.dateCardValue}>{formatDateDisplay(startDate)}</Text>
                    </View>
                    <Feather name="edit-2" size={12} color={Colors.gray400} style={styles.dateCardEditIcon} />
                </TouchableOpacity>

                {/* Arrow */}
                <Feather name="arrow-right" size={14} color={Colors.gray400} />

                {/* End Date Card - Clickable */}
                <TouchableOpacity
                    style={styles.dateCard}
                    onPress={onEndDatePress}
                    activeOpacity={0.7}
                >
                    <View style={styles.dateCardContent}>
                        <Text style={styles.dateCardLabel}>END DATE</Text>
                        <Text style={styles.dateCardValue}>{formatDateDisplay(endDate)}</Text>
                    </View>
                    <Feather name="edit-2" size={12} color={Colors.gray400} style={styles.dateCardEditIcon} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    coursePeriodContainer: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    coursePeriodHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    coursePeriodTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.gray500,
        letterSpacing: 0.5,
    },
    coursePeriodCards: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateCard: {
        flex: 1,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateCardContent: {
        flex: 1,
    },
    dateCardEditIcon: {
        marginLeft: 8,
        marginRight: 4,
    },
    dateCardLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.gray500,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    dateCardValue: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.gray800,
    },
});
