import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Sizes, Typography } from '../constants';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface FollowUpRemindersSectionProps {
    value: number;
    onChange: (value: number) => void;
    snoozeDuration: number;
}

export const FollowUpRemindersSection: React.FC<FollowUpRemindersSectionProps> = ({ value, onChange, snoozeDuration }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    const options = [
        { count: 0, label: 'None', desc: 'No follow-up reminders' },
        { count: 1, label: '1 Follow-up', desc: `Reminds again after ${snoozeDuration}m` },
        { count: 2, label: '2 Follow-ups', desc: `Recommended for reliability` },
        { count: 3, label: '3 Follow-ups', desc: `Maximum persistence` },
    ];

    const renderTooltip = () => (
        <Modal
            visible={showTooltip}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowTooltip(false)}
        >
            <Pressable style={styles.tooltipOverlay} onPress={() => setShowTooltip(false)}>
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.tooltipContent}>
                    <View style={styles.tooltipHeader}>
                        <Feather name="bell" size={20} color={Colors.primary} />
                        <Text style={styles.tooltipTitle}>Follow-Up Reminders</Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipText}>
                            On iOS, we can schedule a fixed number of follow-up notifications to ensure you don't miss your dose.
                        </Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipText}>
                            If you mark a medication as <Text style={{ fontWeight: '700' }}>Taken</Text> or <Text style={{ fontWeight: '700' }}>Skipped</Text>, all remaining follow-ups for that dose will be automatically cancelled.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.closeTooltipButton} onPress={() => setShowTooltip(false)}>
                        <Text style={styles.closeTooltipButtonText}>Got it</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>
        </Modal>
    );

    return (
        <View style={styles.sectionContainer}>
            {renderTooltip()}
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Follow-Up Reminders</Text>
                <TouchableOpacity onPress={() => setShowTooltip(true)} style={styles.infoButton}>
                    <Feather name="info" size={18} color={Colors.primary} />
                </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>How many times should we remind you if you miss a dose?</Text>

            <View style={styles.optionsContainer}>
                {options.map((option) => {
                    const isSelected = value === option.count;
                    return (
                        <TouchableOpacity
                            key={option.count}
                            style={[
                                styles.optionCard,
                                isSelected && styles.optionCardActive
                            ]}
                            onPress={() => onChange(option.count)}
                            activeOpacity={0.7}
                        >
                            {isSelected && (
                                <LinearGradient
                                    colors={['#E0F2FE', '#F0F9FF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            )}

                            <View style={styles.optionContent}>
                                <View style={[styles.radioButton, isSelected && styles.radioButtonActive]}>
                                    {isSelected && <View style={styles.radioButtonInner} />}
                                </View>

                                <View style={styles.textContainer}>
                                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                                        {option.label}
                                    </Text>
                                    <Text style={styles.optionDesc}>{option.desc}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionContainer: {
        marginTop: 0,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: Typography.h5,
        fontWeight: '700',
        color: Colors.gray800,
    },
    infoButton: {
        marginLeft: 8,
        padding: 4,
    },
    sectionSubtitle: {
        fontSize: Typography.bodySmall,
        color: Colors.gray500,
        marginBottom: Sizes.lg,
    },
    optionsContainer: {
        gap: 12,
    },
    optionCard: {
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        overflow: 'hidden',
    },
    optionCardActive: {
        borderColor: Colors.primary + '80',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        zIndex: 2,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.gray300,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: Colors.white,
    },
    radioButtonActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.white,
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
    },
    textContainer: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray800,
        marginBottom: 2,
    },
    optionLabelActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
    optionDesc: {
        fontSize: 12,
        color: Colors.gray500,
    },
    // Tooltip Styles
    tooltipOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Sizes.xl,
    },
    tooltipContent: {
        backgroundColor: Colors.white,
        borderRadius: Sizes.radiusLg,
        padding: Sizes.xl,
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    tooltipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Sizes.lg,
    },
    tooltipTitle: {
        fontSize: Typography.h5,
        fontWeight: '700',
        color: Colors.gray800,
        marginLeft: Sizes.sm,
    },
    tooltipSection: {
        marginBottom: Sizes.lg,
    },
    tooltipText: {
        fontSize: Typography.bodySmall,
        color: Colors.gray600,
        lineHeight: 20,
    },
    closeTooltipButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: Sizes.radiusFull,
        alignItems: 'center',
        marginTop: Sizes.sm,
    },
    closeTooltipButtonText: {
        color: Colors.white,
        fontSize: Typography.body,
        fontWeight: '600',
    },
});
