import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Typography } from '../../constants';
import NumberPickerModal from '../NumberPickerModal';

interface CoursePeriodSectionProps {
    startDate: string;
    endDate: string;
    interval?: number;
    onStartDatePress: () => void;
    onEndDatePress: () => void;
    onIntervalChange?: (days: number) => void;
    isVerified?: boolean;
    hasEndDate?: boolean;
    onToggleEndDate?: (value: boolean) => void;
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
    isVerified = false,
    hasEndDate = true,
    onToggleEndDate,
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
                    <TouchableOpacity 
                        onPress={() => setShowIntervalPicker(true)}
                        disabled={isVerified}
                        style={styles.frequencyChip} // New Chip Style
                    >
                        <Text style={styles.frequencyText}>{getIntervalLabel()}</Text>
                        <Feather name="chevron-down" size={14} color={Colors.primary} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.coursePeriodCards}>
                {/* Start Date Card - Green Box */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onStartDatePress}
                    disabled={isVerified}
                    style={{ flex: 1, flexBasis: '40%' }} // Force equal width
                >
                    <BlurView intensity={20} tint="light" style={[styles.bentoCard, styles.startDateBorder]}>
                        <View style={[styles.bentoIconBadge, { backgroundColor: '#ECFDF5' }]}>
                             <Feather name="calendar" size={14} color={Colors.success} />
                        </View>
                        <View>
                            <Text style={styles.bentoLabel}>START DATE</Text>
                            <Text style={styles.bentoValue}>{formatDateDisplay(startDate)}</Text>
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
                    disabled={isVerified || !hasEndDate}
                    style={{ flex: 1, flexBasis: '40%', opacity: hasEndDate ? 1 : 0.6 }} // Force equal width
                >
                    <BlurView intensity={20} tint="light" style={[styles.bentoCard, styles.endDateBorder]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <View style={[styles.bentoIconBadge, { backgroundColor: '#FEF2F2', marginBottom: 0 }]}>
                                 <Feather name="flag" size={14} color={Colors.error} />
                            </View>
                            {onToggleEndDate && !isVerified && (
                                <Switch
                                    value={hasEndDate}
                                    onValueChange={onToggleEndDate}
                                    trackColor={{ false: Colors.gray200, true: Colors.error + '50' }}
                                    thumbColor={hasEndDate ? Colors.error : Colors.gray400}
                                    style={{ transform: [{ scale: 0.6 }], marginRight: -8, marginTop: -8 }}
                                />
                            )}
                        </View>
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.bentoLabel}>END DATE</Text>
                            <Text style={styles.bentoValue}>
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
        paddingHorizontal: 20, // Aligned with Medicine Details (was 16)
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
        fontSize: 13,
        ...Typography.fontWeights.extrabold,
        color: Colors.gray600,
        letterSpacing: 1.2,
    },
    coursePeriodCards: {
        flexDirection: 'row',
        alignItems: 'center', // Center vertically for the arrow
        gap: 0, // Gap handled by connector
    },
    bentoCard: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12, // Move logo up
        paddingBottom: 18, // Lift text from bottom
        borderRadius: 20,
        overflow: 'hidden',
        alignItems: 'flex-start',
        justifyContent: 'space-between', 
        height: 105, // Slight increase for breathing room 
        borderWidth: 1.5,
        borderColor: 'transparent', // Default transparent
    },
    startDateBorder: {
        borderColor: 'rgba(16, 185, 129, 0.4)', // Darker Green Border
        backgroundColor: 'rgba(236, 253, 245, 0.5)', // Slightly richer tint
    },
    endDateBorder: {
        borderColor: 'rgba(239, 68, 68, 0.4)', // Darker Red Border
        backgroundColor: 'rgba(254, 242, 242, 0.5)', // Slightly richer tint
    },
    flowConnector: {
        width: 30,
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
    bentoIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    bentoLabel: {
        fontSize: 10,
        ...Typography.fontWeights.bold,
        color: Colors.gray500,
        letterSpacing: 0.5,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    bentoValue: {
        fontSize: 15,
        ...Typography.fontWeights.extrabold,
        color: Colors.gray800,
        letterSpacing: -0.5,
    },
    frequencyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: Colors.primary + '10',
        borderRadius: 8,
        gap: 4,
    },
    frequencyText: {
        fontSize: 11,
        ...Typography.fontWeights.bold,
        color: Colors.primary,
        letterSpacing: 0.5,
    },
});
