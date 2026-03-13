import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withSequence } from 'react-native-reanimated';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { MedicationWithStatus } from '../types/medicationSchedule';

import { MedicationIcon, ICON_THEMES } from './medication/MedicationIcons';
import * as Haptics from 'expo-haptics';

interface MedicationCardProps {
    medication: MedicationWithStatus;
    doseNumber?: number;
    onTake: (medicationId: string, scheduledTime: string) => void;
    onSkip: (medicationId: string, scheduledTime: string) => void;
    onReschedule?: (medication: MedicationWithStatus) => void;
}

// Capitalize first letter
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Shorten food instruction to a compact pill label
const getMealLabel = (med: MedicationWithStatus): string => {
    const fr = med.food_relationship;
    if (!fr || fr === 'anytime') return '';
    const map: Record<string, string> = {
        empty_stomach: 'Empty Stomach',
        before_food: 'Before Food',
        with_food: 'With Food',
        after_food: 'After Food',
    };
    return map[fr] || '';
};

export default function MedicationCard({ medication, doseNumber, onTake, onSkip, onReschedule }: MedicationCardProps) {
    const isTaken = medication.status === 'taken';
    const isSkipped = medication.status === 'skipped';
    const isMissed = medication.status === 'missed';
    const isPending = medication.status === 'pending';

    const normalizedForm = medication.form?.toLowerCase() || 'default';
    const theme = ICON_THEMES[normalizedForm] || ICON_THEMES.default;

    // --- Subtle scale spring on status change ---
    const scale = useSharedValue(1);
    useEffect(() => {
        if (isTaken || isSkipped) {
            scale.value = withSequence(withSpring(1.03), withSpring(1));
        }
    }, [isTaken, isSkipped]);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    // --- Derive display values ---
    const displayName = medication.name
        ? medication.name.split(/\s(SOS|PRN|as\s+needed|for\s+)/i)[0].replace(/[,\s.-]+$/, '').split('(')[0].trim()
        : '';
    const dosage = medication.dosage || medication.strength || '';
    const formLabel = medication.form ? capitalize(medication.form) : '';
    const mealLabel = getMealLabel(medication);

    // --- Handlers ---
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

    // --- Status / Action area ---
    const StatusActions = () => {
        if (isTaken) {
            return (
                <View style={[styles.badge, styles.takenBadge]}>
                    <Feather name="check-circle" size={13} color={Colors.success} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: Colors.success }]}>Done</Text>
                </View>
            );
        }
        if (isSkipped) {
            return (
                <View style={[styles.badge, styles.skippedBadge]}>
                    <Feather name="slash" size={13} color={Colors.gray500} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: Colors.gray500 }]}>Skipped</Text>
                </View>
            );
        }
        if (isMissed) {
            return (
                <View style={[styles.badge, styles.missedBadge]}>
                    <Feather name="alert-circle" size={13} color={Colors.error} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: Colors.error }]}>Missed</Text>
                </View>
            );
        }
        // Pending — show action buttons
        return (
            <View style={styles.actionsGroup}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.skipBtn]}
                    onPress={handleSkipPress}
                    activeOpacity={0.75}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                    <Text style={styles.skipBtnText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.takeBtn]}
                    onPress={handleTakePress}
                    activeOpacity={0.75}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                    <MaterialCommunityIcons name="pill" size={15} color={Colors.white} style={{ marginRight: 5 }} />
                    <Text style={styles.takeBtnText}>Take</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const isDimmed = isTaken || isSkipped;

    return (
        <Animated.View style={[styles.card, animatedStyle, isMissed && styles.cardMissed, isDimmed && styles.cardDimmed]}>
            {/* Missed left-edge stripe */}
            {isMissed && <View style={styles.missedStripe} />}

            {/* Left: Icon */}
            <View style={[styles.iconWrap, isDimmed && { opacity: 0.45 }]}>
                <MedicationIcon form={normalizedForm} size={22} />
            </View>

            {/* Center: Info */}
            <View style={styles.info}>
                <Text
                    style={[styles.name, isDimmed && styles.dimmedText]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {displayName}
                </Text>

                <View style={styles.metaRow}>
                    {dosage ? (
                        <Text style={[styles.metaDosage, isDimmed && styles.dimmedSubtext]}>{dosage}</Text>
                    ) : null}

                    {formLabel ? (
                        <View style={styles.formPill}>
                            <Text style={styles.formPillText}>{formLabel}</Text>
                        </View>
                    ) : null}
                </View>

                {mealLabel ? (
                    <View style={styles.mealRow}>
                        <Feather name="coffee" size={10} color={Colors.gray400} style={{ marginRight: 3 }} />
                        <Text style={styles.mealText}>{mealLabel}</Text>
                    </View>
                ) : null}
            </View>

            {/* Right: Actions / Status */}
            <View style={styles.rightZone}>
                <StatusActions />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray100,
        paddingVertical: 12,
        paddingLeft: 12,
        paddingRight: 12,
        marginBottom: 10,
        minHeight: 80,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.045,
                shadowRadius: 8,
            },
            android: { elevation: 2 },
        }),
    },
    cardMissed: {
        borderColor: Colors.errorLight,
        backgroundColor: '#FFFBFB',
    },
    cardDimmed: {
        backgroundColor: Colors.gray50,
        borderColor: Colors.gray100,
    },
    missedStripe: {
        position: 'absolute',
        left: 0,
        top: 8,
        bottom: 8,
        width: 3,
        backgroundColor: Colors.error,
        borderRadius: 4,
    },

    // Icon
    iconWrap: {
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Info
    info: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 8,
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
        marginBottom: 3,
    },
    dimmedText: {
        color: Colors.gray400,
    },
    dimmedSubtext: {
        color: Colors.gray300,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    metaDosage: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.textSecondary,
        letterSpacing: 0.1,
    },
    formPill: {
        backgroundColor: Colors.gray100,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    formPillText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.gray600,
        letterSpacing: 0.2,
        textTransform: 'capitalize',
    },
    mealRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    mealText: {
        fontSize: 10,
        fontWeight: '500',
        color: Colors.gray400,
        letterSpacing: 0.1,
    },

    // Right actions / badge zone
    rightZone: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
    },
    actionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionBtn: {
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    skipBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.gray600,
    },
    takeBtn: {
        backgroundColor: Colors.primary,
        ...Platform.select({
            ios: {
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
            },
            android: { elevation: 4 },
        }),
    },
    takeBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.white,
    },

    // Status badges
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    takenBadge: {
        backgroundColor: Colors.successLight,
    },
    skippedBadge: {
        backgroundColor: Colors.gray100,
    },
    missedBadge: {
        backgroundColor: Colors.errorLight,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
});
