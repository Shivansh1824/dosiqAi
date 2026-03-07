import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withSequence } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants';
import { MedicationWithStatus, getInstructionText } from '../types/medicationSchedule';
import { MedicationIcon } from './medication/MedicationIcons';
import * as Haptics from 'expo-haptics';

// 2026 professional dark-green accent
const ACCENT = '#1B4332';
const ACCENT_LIGHT = '#D1FAE5';

interface MedicationCardProps {
    medication: MedicationWithStatus;
    doseNumber?: number;
    onTake: (medicationId: string, scheduledTime: string) => void;
    onSkip: (medicationId: string, scheduledTime: string) => void;
    onReschedule?: (medication: MedicationWithStatus) => void;
}

export default function MedicationCard({ medication, doseNumber, onTake, onSkip, onReschedule }: MedicationCardProps) {
    const isTaken = medication.status === 'taken';
    const isSkipped = medication.status === 'skipped';
    const isMissed = medication.status === 'missed';
    const isPending = !isTaken && !isSkipped && !isMissed;

    const cleanName = (name: string) => {
        if (!name) return '';
        return name
            .split(/\s(SOS|PRN|as\s+needed|for\s+|pc|ac|after\s+|before\s+|with\s+)/i)[0]
            .replace(/[,\s.-]+$/, '')
            .split('(')[0]
            .trim();
    };

    const instructionText = getInstructionText(medication);

    // Animations
    const scale = useSharedValue(1);

    useEffect(() => {
        if (isTaken || isSkipped) {
            scale.value = withSequence(
                withSpring(1.02, { damping: 12 }),
                withSpring(1, { damping: 15 })
            );
        }
    }, [isTaken, isSkipped]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handleTakePress = async () => {
        if (!isTaken) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onTake(medication.id, medication.scheduled_time);
        }
    };

    const handleSkipPress = async () => {
        if (!isSkipped) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSkip(medication.id, medication.scheduled_time);
        }
    };

    const getCardBgColor = () => {
        if (isTaken) return '#F0FDF4';
        if (isSkipped) return '#F9FAFB';
        if (isMissed) return '#FFF5F5';
        return '#FFFFFF';
    };

    const StatusContent = () => {
        if (isTaken) {
            return (
                <View style={styles.statusBadgeTaken}>
                    <Feather name="check" size={11} color={ACCENT} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: ACCENT }]}>Taken</Text>
                </View>
            );
        }
        if (isSkipped) {
            return (
                <View style={styles.statusBadgeSkipped}>
                    <Feather name="minus" size={11} color={Colors.gray400} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: Colors.gray400 }]}>Skipped</Text>
                </View>
            );
        }
        if (isMissed) {
            return (
                <View style={styles.statusBadgeMissed}>
                    <Feather name="alert-circle" size={11} color={Colors.error} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: Colors.error }]}>Missed</Text>
                </View>
            );
        }
        return (
            <View style={styles.actionsGroup}>
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleSkipPress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.takeButton}
                    onPress={handleTakePress}
                    activeOpacity={0.8}
                >
                    <Feather name="check" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                    <Text style={styles.takeButtonText}>Take</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <Animated.View style={[
            styles.container,
            { backgroundColor: getCardBgColor() },
            (isTaken || isSkipped || isMissed) && styles.containerDone,
            animatedStyle,
        ]}>
            {/* Missed accent left bar */}
            {isMissed && <View style={styles.missedBar} />}
            {/* Taken accent left bar */}
            {isTaken && <View style={styles.takenBar} />}

            {/* Icon column with dose number superscript */}
            <View style={styles.iconColumn}>
                {doseNumber !== undefined && (
                    <Text style={[styles.doseNumber, (isTaken || isSkipped || isMissed) && styles.doseNumberMuted]}>
                        {doseNumber}
                    </Text>
                )}
                <View style={(isTaken || isSkipped || isMissed) ? styles.iconWrapperMuted : undefined}>
                    <MedicationIcon form={medication.form || 'default'} size={22} />
                </View>
            </View>

            {/* Content column */}
            <View style={styles.contentColumn}>
                <Text
                    style={[styles.name, (isTaken || isSkipped) && styles.nameResolved]}
                    numberOfLines={1}
                >
                    {cleanName(medication.name)}
                </Text>
                {medication.dosage ? (
                    <Text style={styles.dosage} numberOfLines={1}>
                        {medication.dosage}
                    </Text>
                ) : null}
                {instructionText && isPending ? (
                    <View style={styles.instructionChip}>
                        <Text style={styles.instructionText}>{instructionText}</Text>
                    </View>
                ) : null}
            </View>

            {/* Actions column */}
            <View style={styles.actionsColumn}>
                <StatusContent />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingRight: 12,
        borderWidth: 0.5,
        borderColor: '#E8E8E0',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
            },
            android: { elevation: 2 },
        }),
    },
    containerDone: {
        borderColor: 'transparent',
    },
    missedBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: Colors.error,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    takenBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: ACCENT,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    iconColumn: {
        width: 62,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    iconWrapperMuted: {
        opacity: 0.4,
    },
    doseNumber: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.gray400,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    doseNumberMuted: {
        color: Colors.gray300,
    },
    contentColumn: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 8,
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    nameResolved: {
        color: Colors.gray400,
        fontWeight: '500',
    },
    dosage: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.textSecondary,
        letterSpacing: 0.1,
    },
    instructionChip: {
        marginTop: 5,
        alignSelf: 'flex-start',
        backgroundColor: '#FEF9EC',
        borderRadius: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderWidth: 0.5,
        borderColor: '#F6D87D',
    },
    instructionText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#92680B',
        letterSpacing: 0.2,
    },
    actionsColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
    },
    actionsGroup: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    skipButton: {
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.gray200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    skipButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.gray500,
    },
    takeButton: {
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: ACCENT,
        ...Platform.select({
            ios: {
                shadowColor: ACCENT,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
            },
            android: { elevation: 4 },
        }),
    },
    takeButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Status badges
    statusBadgeTaken: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT_LIGHT,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusBadgeSkipped: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray100,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusBadgeMissed: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
});
