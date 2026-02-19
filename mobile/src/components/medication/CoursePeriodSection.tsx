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
    fixedFrequencyText?: string; // NEW: Override for SOS/Fixed display
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
    fixedFrequencyText,
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
                {(onIntervalChange || fixedFrequencyText) && (
                    <TouchableOpacity
                        onPress={() => !fixedFrequencyText && setShowIntervalPicker(true)}
                        disabled={isVerified || !!fixedFrequencyText}
                        style={[styles.frequencyChip, fixedFrequencyText && { backgroundColor: Colors.primary + '15' }]}
                    >
                        <Text style={styles.frequencyText}>{fixedFrequencyText || getIntervalLabel()}</Text>
                        {!isVerified && !fixedFrequencyText && <Feather name="chevron-down" size={14} color={Colors.primary} />}
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
                        <View style={{ flex: 1 }}>
                            <Text style={styles.bentoLabel}>START DATE</Text>
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
                    disabled={isVerified || !hasEndDate}
                    style={{ flex: 1, flexBasis: '40%', opacity: hasEndDate ? 1 : 0.6 }} // Force equal width
                >
                    <BlurView intensity={20} tint="light" style={[styles.bentoCard, styles.endDateBorder]}>
                        <View style={[styles.bentoIconBadge, { backgroundColor: '#FEF2F2' }]}>
                            <Feather name="flag" size={14} color={Colors.error} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.bentoLabel}>END DATE</Text>
                            <Text style={styles.bentoValue} numberOfLines={1}>
                                {hasEndDate ? formatDateDisplay(endDate) : 'Continuous'}
                            </Text>
                        </View>
                        {onToggleEndDate && !isVerified && (
                            <Switch
                                value={hasEndDate}
                                onValueChange={onToggleEndDate}
                                trackColor={{ false: Colors.gray200, true: Colors.error + '50' }}
                                thumbColor={hasEndDate ? Colors.error : Colors.gray400}
                                style={{ transform: [{ scale: 0.7 }] }} // Slightly larger than 0.6 for touch
                            />
                        )}
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
        marginTop: 16,
        marginBottom: 22,
    },
    coursePeriodHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8, // Reduced from 12
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    coursePeriodTitle: {
        fontSize: 12, // Reduced from 13
        ...Typography.fontWeights.extrabold,
        color: Colors.gray500, // Softer color
        letterSpacing: 1,
    },
    coursePeriodCards: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    bentoCard: {
        flex: 1,
        flexDirection: 'row', // Horizontal layout
        alignItems: 'center',
        paddingHorizontal: 10, // Reduced from 12 for better fit
        paddingVertical: 10, // Reduced from 12
        borderRadius: 16, // Slightly tighter radius
        overflow: 'hidden',
        height: 'auto', // Auto height
        minHeight: 56, // Reduced minimum height
        borderWidth: 1, // Thinner border
        borderColor: 'transparent',
    },
    startDateBorder: {
        borderColor: 'rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(236, 253, 245, 0.6)',
    },
    endDateBorder: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(254, 242, 242, 0.6)',
    },
    flowConnector: {
        width: 24, // Reduced from 30
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
        marginBottom: 0, // Removed bottom margin
        marginRight: 6, // Reduced gap from 8 to 6
    },
    bentoLabel: {
        fontSize: 9,
        ...Typography.fontWeights.bold,
        color: Colors.gray500,
        letterSpacing: 0.5,
        marginBottom: 0, // Tighter
        textTransform: 'uppercase',
    },
    bentoValue: {
        fontSize: 13, // Reduced from 14 to fit long dates
        ...Typography.fontWeights.extrabold,
        color: Colors.gray800,
        letterSpacing: -0.2, // Tighter tracking
        lineHeight: 16, // Fixed line height
    },
    frequencyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4, // Reduced
        paddingHorizontal: 8, // Reduced
        backgroundColor: Colors.primary + '10',
        borderRadius: 6,
        gap: 4,
    },
    frequencyText: {
        fontSize: 10, // Reduced
        ...Typography.fontWeights.bold,
        color: Colors.primary,
        letterSpacing: 0.5,
    },
});
