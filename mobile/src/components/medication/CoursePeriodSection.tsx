import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';
import NumberPickerModal from '../NumberPickerModal';

interface CoursePeriodSectionProps {
    startDate: string;
    endDate: string;
    interval?: number;
    onStartDatePress: () => void;
    onEndDatePress: () => void;
    onIntervalChange?: (days: number) => void;
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
    interval = 1,
    onStartDatePress,
    onEndDatePress,
    onIntervalChange,
}: CoursePeriodSectionProps) {
    const [showIntervalPicker, setShowIntervalPicker] = useState(false);

    const getIntervalLabel = () => {
        if (!interval || interval === 1) return 'EVERYDAY';
        return `EVERY ${interval} DAYS`;
    };

    return (
        <View style={styles.coursePeriodContainer}>
            <View style={styles.coursePeriodHeader}>
                <View style={styles.headerLeft}>
                    <Feather name="calendar" size={16} color={Colors.primary} />
                    <Text style={styles.coursePeriodTitle}>COURSE PERIOD</Text>
                </View>
                {onIntervalChange && (
                    <TouchableOpacity onPress={() => setShowIntervalPicker(true)}>
                        <Text style={styles.placeholderButton}>{getIntervalLabel()}</Text>
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.coursePeriodCards}>
                {/* Start Date Card - Clickable */}
                <TouchableOpacity
                    style={[styles.dateCard, styles.startDateCard]}
                    onPress={onStartDatePress}
                    activeOpacity={0.7}
                >
                    <View style={styles.dateCardContent}>
                        <Text style={[styles.dateCardLabel, styles.startDateLabel]}>START DATE</Text>
                        <Text style={styles.dateCardValue}>{formatDateDisplay(startDate)}</Text>
                    </View>
                    <Feather name="edit-2" size={12} color={Colors.success} style={styles.dateCardEditIcon} />
                </TouchableOpacity>

                {/* Arrow */}
                <Feather name="arrow-right" size={14} color={Colors.gray400} />

                {/* End Date Card - Clickable */}
                <TouchableOpacity
                    style={[styles.dateCard, styles.endDateCard]}
                    onPress={onEndDatePress}
                    activeOpacity={0.7}
                >
                    <View style={styles.dateCardContent}>
                        <Text style={[styles.dateCardLabel, styles.endDateLabel]}>END DATE</Text>
                        <Text style={styles.dateCardValue}>{formatDateDisplay(endDate)}</Text>
                    </View>
                    <Feather name="edit-2" size={12} color={Colors.error} style={styles.dateCardEditIcon} />
                </TouchableOpacity>
            </View>

            <NumberPickerModal
                visible={showIntervalPicker}
                initialValue={interval}
                onConfirm={(val) => {
                    onIntervalChange?.(val);
                    setShowIntervalPicker(false);
                }}
                onCancel={() => setShowIntervalPicker(false)}
                title="Select Frequency"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    coursePeriodContainer: {
        paddingHorizontal: 16,
        marginTop: 8,
        marginBottom: 12,
    },
    coursePeriodHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    startDateCard: {
        backgroundColor: '#ECFDF5', // Emerald-50: soft green tint
    },
    endDateCard: {
        backgroundColor: '#FEF2F2', // Rose-50: soft red tint
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
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    startDateLabel: {
        color: Colors.successDark, // Dark green for start
    },
    endDateLabel: {
        color: Colors.errorDark, // Dark red for end
    },
    dateCardValue: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.gray800,
    },
    placeholderButton: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
});
