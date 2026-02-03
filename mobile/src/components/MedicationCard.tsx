import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { MedicationWithStatus, getInstructionText } from '../types/medicationSchedule';
import { LinearGradient } from 'expo-linear-gradient';
import { ICON_THEMES } from './medication/MedicationIcons';
import * as Haptics from 'expo-haptics';

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

    const cleanName = (name: string) => {
        if (!name) return '';
        // Aggressively remove instructions and extra details from the name
        // e.g., "Ethoshine SOS for pain" -> "Ethoshine"
        return name
            .split(/\s(SOS|PRN|as\s+needed|for\s+|pc|ac|after\s+|before\s+|with\s+)/i)[0]
            .replace(/[,\s.-]+$/, '')
            .split('(')[0] // Remove strengths in parentheses if they are part of the name
            .trim();
    };
    
    const normalizedForm = medication.form?.toLowerCase() || 'tablet';
    const theme = ICON_THEMES[normalizedForm] || ICON_THEMES.default;

    // Animations
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (isTaken || isSkipped) {
            scale.value = withSequence(
                withSpring(1.05),
                withSpring(1)
            );
        }
    }, [isTaken, isSkipped]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
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

    const StatusContent = () => {
        if (isTaken) {
            return (
                <View style={styles.statusBadge}>
                    <Feather name="check" size={12} color={Colors.success} style={{ marginRight: 4 }} />
                    <Text style={styles.statusBadgeText}>Done</Text>
                </View>
            );
        }
        if (isSkipped) {
            return (
                <View style={[styles.statusBadge, { backgroundColor: Colors.gray100 }]}>
                    <Feather name="x" size={12} color={Colors.gray500} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: Colors.gray500 }]}>Skipped</Text>
                </View>
            );
        }
        return (
            <View style={styles.actionsGroup}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.skipButton]}
                    onPress={handleSkipPress}
                    activeOpacity={0.7}
                >
                    <Feather name="clock" size={16} color={Colors.gray500} style={{ marginRight: 6 }} />
                    <Text style={[styles.actionButtonText, { color: Colors.gray600 }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.takeButton]}
                    onPress={handleTakePress}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="pill" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                    <Text style={[styles.actionButtonText, { color: Colors.white }]}>Take</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <LinearGradient
                colors={isTaken || isSkipped ? ['#F8FAFC', '#F1F5F9'] : ['#FFFFFF', '#F8FAFC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.barGraphics}>
                {doseNumber !== undefined && (
                    <Text style={[
                        styles.doseNumber,
                        (isTaken || isSkipped) && styles.textMuted
                    ]}>{doseNumber}.</Text>
                )}
            </View>

            <View style={styles.barContent}>
                <View style={styles.mainInfo}>
                    <Text style={[
                        styles.name,
                        (isTaken || isSkipped) && styles.textMuted
                    ]} numberOfLines={1}>
                        {cleanName(medication.name)}
                    </Text>
                </View>

                <View style={styles.rightActions}>
                    <StatusContent />
                </View>
            </View>
            
            {medication.status === 'missed' && <View style={styles.missedIndicator} />}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 70, // More compact
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    barGraphics: {
        width: 52, // Professional spacing between number and name
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 6,
    },
    barContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 8,
    },
    mainInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    doseNumber: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.gray300,
        letterSpacing: -1,
        marginTop: -1,
    },
    name: {
        fontSize: 19,
        fontWeight: '900', // Even bolder for that 'perfect' look
        color: Colors.textPrimary,
        letterSpacing: -0.8, // Tighter for premium feel
    },
    dosage: {
        fontSize: 15, // Slightly larger
        fontWeight: '700', // Bolder to match name
        color: Colors.gray500,
        letterSpacing: -0.3,
    },
    textMuted: {
        color: Colors.gray400,
        opacity: 0.6,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionsGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    actionButton: {
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    skipButton: {
        backgroundColor: Colors.gray100,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    takeButton: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success + '15',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.success,
    },
    missedIndicator: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: Colors.error,
    },
});
