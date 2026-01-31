import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Sizes, Typography } from '../constants';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FollowUpSelectionModal } from './FollowUpSelectionModal';

interface FollowUpRemindersSectionProps {
    value: number;
    onChange: (value: number) => void;
    snoozeDuration: number;
}

export const FollowUpRemindersSection: React.FC<FollowUpRemindersSectionProps> = ({ value, onChange, snoozeDuration }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const getSelectedLabel = () => {
        switch (value) {
            case 0: return 'None';
            case 1: return '1 Follow-up';
            case 2: return '2 Follow-ups';
            case 3: return '3 Follow-ups';
            default: return 'None';
        }
    };

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
            <FollowUpSelectionModal 
                visible={showModal}
                onClose={() => setShowModal(false)}
                selectedValue={value}
                onSelect={onChange}
                snoozeDuration={snoozeDuration}
            />

            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Follow-Up Reminders</Text>
                <TouchableOpacity onPress={() => setShowTooltip(true)} style={styles.infoButton}>
                    <Feather name="info" size={18} color={Colors.primary} />
                </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>How many times should we remind you if you miss a dose?</Text>

            <TouchableOpacity
                style={[styles.verificationBar, { height: 64, marginBottom: 8, backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
                onPress={() => setShowModal(true)}
                activeOpacity={0.9}
            >
                <View style={[styles.reminderIcon, { marginLeft: 12, backgroundColor: '#E0F2FE' }]}>
                    <Feather name="bell" size={24} color={Colors.primary} />
                </View>
                <View style={[styles.barContent, { paddingLeft: 12 }]}>
                    <Text style={[styles.barLabel, { color: Colors.gray800, fontSize: 16 }]}>{getSelectedLabel()}</Text>
                    <View style={styles.barRight}>
                        <Feather name="chevron-right" size={20} color={Colors.primary} opacity={0.8} />
                    </View>
                </View>
            </TouchableOpacity>
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
    // Unified interactive bars (2026 Glassmorphism style)
    verificationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    barContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 52,
        paddingRight: 12,
        zIndex: 2,
    },
    barLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    barRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    reminderIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
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
