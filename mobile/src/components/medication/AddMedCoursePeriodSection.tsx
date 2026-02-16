import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Typography } from '../../constants';
import NumberPickerModal from '../NumberPickerModal';

interface AddMedCoursePeriodSectionProps {
    startDate: string;
    endDate: string;
    interval?: number;
    onStartDatePress: () => void;
    onEndDatePress: () => void;
    onIntervalChange?: (days: number) => void;
    isVerified?: boolean;
    hasEndDate?: boolean;
    onToggleEndDate?: (value: boolean) => void;
    onInfoPress?: () => void;
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
 * AddMedCoursePeriodSection - Independent component for Add Medication Screen
 * Decoupled from MedicationVerificationCard
 */
export function AddMedCoursePeriodSection({
    startDate,
    endDate,
    interval = 1,
    onStartDatePress,
    onEndDatePress,
    onIntervalChange,
    isVerified = false,
    hasEndDate = true,
    onToggleEndDate,
    onInfoPress,
}: AddMedCoursePeriodSectionProps) {
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
                    <TouchableOpacity onPress={onInfoPress} style={styles.infoButton} hitSlop={10}>
                        <Feather name="info" size={16} color={Colors.gray400} />
                    </TouchableOpacity>
                </View>
                {onIntervalChange && (
                    <TouchableOpacity 
                        onPress={() => setShowIntervalPicker(true)}
                        disabled={isVerified}
                        style={styles.frequencyChip} // New Chip Style
                    >
                        <Text style={styles.frequencyText}>{getIntervalLabel()}</Text>
                        {!isVerified && <Feather name="chevron-down" size={14} color={Colors.primary} />}
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.coursePeriodCards}>
                {/* Start Date Card - Green Box */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onStartDatePress}
                    disabled={isVerified}
                    style={{ flex: 1 }}
                >
                    <BlurView intensity={20} tint="light" style={[styles.bentoCard, styles.startDateBorder]}>
                        <View style={styles.cardTopRow}>
                            <View style={styles.bentoIconBadge}>
                                <Feather name="calendar" size={16} color={Colors.success} />
                            </View>
                        </View>
                        <View>
                            <Text style={styles.bentoLabel}>Start Date</Text>
                            <Text style={styles.bentoValue} numberOfLines={1}>{formatDateDisplay(startDate)}</Text>
                        </View>
                    </BlurView>
                </TouchableOpacity>

                {/* Directional Flow Arrow */}
                <View style={styles.flowConnector}>
                   <View style={styles.flowLine} />
                   <Feather name="arrow-right" size={16} color={Colors.gray400} />
                </View>

                {/* End Date Card - Red Box */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onEndDatePress}
                    disabled={isVerified || !hasEndDate} // Still clickable if has end date to edit
                    style={{ flex: 1, opacity: hasEndDate ? 1 : 0.8 }}
                >
                    <BlurView intensity={20} tint="light" style={[styles.bentoCard, styles.endDateBorder]}>
                        <View style={styles.cardTopRow}>
                            <View style={styles.bentoIconBadge}>
                                <Feather name="flag" size={16} color={Colors.error} />
                            </View>
                            {/* Toggle Restored */}
                            {onToggleEndDate && !isVerified && (
                                <Switch
                                    value={hasEndDate}
                                    onValueChange={onToggleEndDate}
                                    trackColor={{ false: '#FEE2E2', true: '#EF4444' }} // Red shade for off, Red for on
                                    thumbColor={Colors.white}
                                    style={{ transform: [{ scale: 0.7 }] }}
                                />
                            )}
                        </View>
                        <View>
                            <Text style={styles.bentoLabel}>End Date</Text>
                            <Text style={styles.bentoValue} numberOfLines={1}>
                                {hasEndDate ? formatDateDisplay(endDate) : 'Continuous'}
                            </Text>
                        </View>
                    </BlurView>
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
        paddingHorizontal: 20,
        marginTop: 4,
        marginBottom: 8,
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
        gap: 6,
    },
    coursePeriodTitle: {
        fontSize: 16,
        ...Typography.fontWeights.extrabold,
        color: Colors.gray600,
        letterSpacing: 1.2,
    },
    infoButton: {
        marginLeft: 4,
        padding: 2,
    },
    coursePeriodCards: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    bentoCard: {
        flex: 1,
        // Boxier Vertical Layout
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 110, // Taller size
        borderWidth: 1,
        borderColor: 'transparent',
    },
    startDateBorder: {
        borderColor: 'rgba(16, 185, 129, 0.5)', // Darker border
        backgroundColor: '#D1FAE5', // Darker Green (Emerald 100)
    },
    endDateBorder: {
        borderColor: 'rgba(239, 68, 68, 0.5)', // Darker border
        backgroundColor: '#FEE2E2', // Darker Red (Red 100)
    },
    flowConnector: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    flowLine: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: Colors.gray200,
        opacity: 0.5,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    bentoIconBadge: {
        width: 36, // Slightly larger icon container
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0, 
    },
    bentoLabel: {
        fontSize: 11, // Larger label
        ...Typography.fontWeights.bold,
        color: Colors.gray600,
        marginTop: 4,
        marginBottom: 2,
    },
    bentoValue: {
        fontSize: 15, // Larger date text
        ...Typography.fontWeights.extrabold,
        color: Colors.gray900,
        letterSpacing: -0.3,
        lineHeight: 20,
    },
    frequencyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        gap: 6,
    },
    frequencyText: {
        fontSize: 11,
        ...Typography.fontWeights.bold,
        color: '#3B82F6',
        letterSpacing: 0.5,
    },
});
