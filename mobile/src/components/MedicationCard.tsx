import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Sizes } from '../constants';
import { MedicationWithStatus, getMedicineTypeIcon, getMedicineTypeColor, getInstructionText } from '../types/medicationSchedule';

interface MedicationCardProps {
    medication: MedicationWithStatus;
    onTake: (medicationId: string, scheduledTime: string) => void;
}

export default function MedicationCard({ medication, onTake }: MedicationCardProps) {
    const navigation = useNavigation();
    const isTaken = medication.status === 'taken';
    const isMissed = medication.status === 'missed';
    const isPending = medication.status === 'pending';

    const iconName = getMedicineTypeIcon(medication.type);
    const iconColor = getMedicineTypeColor(medication.type);

    // Animation for checkmark bounce
    const scale = useSharedValue(1);

    useEffect(() => {
        if (isTaken) {
            // Bounce animation when taken
            scale.value = withSpring(1.2, {
                damping: 8,
                stiffness: 200,
            }, () => {
                scale.value = withSpring(1);
            });
        }
    }, [isTaken]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handleTakePress = () => {
        if (!isTaken) {
            onTake(medication.id, medication.scheduled_time);
        }
    };

    const handleSourcePress = () => {
        if (medication.source_document_id) {
            (navigation as any).navigate('PrescriptionSummary', {
                document: { id: medication.source_document_id }
            });
        }
    };

    return (
        <View style={[
            styles.container,
            isTaken && styles.containerTaken,
            isMissed && styles.containerMissed,
        ]}>
            {/* Left: Medicine Icon */}
            <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                <Feather
                    name={iconName as any}
                    size={24}
                    color={isTaken ? Colors.gray400 : iconColor}
                />
            </View>

            {/* Center: Medicine Info */}
            <View style={styles.infoContainer}>
                <Text style={[
                    styles.name,
                    isTaken && styles.nameTaken,
                ]}>
                    {medication.name}
                </Text>
                <Text style={[
                    styles.dosage,
                    isTaken && styles.dosageTaken,
                ]}>
                    {medication.dosage}
                </Text>

                {/* Instruction Badge */}
                <View style={styles.instructionBadge}>
                    <Text style={styles.instructionText}>
                        {getInstructionText(medication.instructions)}
                    </Text>
                </View>

                {/* Source Indicator - Show if AI-extracted from prescription */}
                {medication.ai_extracted && medication.source_document_title && (
                    <TouchableOpacity
                        style={styles.sourceIndicator}
                        onPress={handleSourcePress}
                        activeOpacity={0.7}
                    >
                        <Feather name="file-text" size={12} color={Colors.gray400} />
                        <Text style={styles.sourceText} numberOfLines={1}>
                            From: {medication.source_document_title}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Right: Take Button / Checkmark */}
            <View style={styles.actionButtonContainer}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        isTaken && styles.actionButtonTaken,
                    ]}
                    onPress={handleTakePress}
                    disabled={isTaken}
                    activeOpacity={0.7}
                >
                    {isTaken ? (
                        <Animated.View style={animatedStyle}>
                            <Feather name="check-circle" size={28} color={Colors.success} />
                        </Animated.View>
                    ) : (
                        <View style={styles.takeButton}>
                            <Text style={styles.takeButtonText}>Take</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Taken Time - Below checkmark */}
                {isTaken && medication.taken_at && (
                    <Text style={styles.takenTime}>
                        Taken at {new Date(medication.taken_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.md,
        marginBottom: Sizes.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    containerTaken: {
        opacity: 0.6,
        backgroundColor: Colors.gray50,
    },
    containerMissed: {
        borderLeftWidth: 3,
        borderLeftColor: Colors.error,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Sizes.md,
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    nameTaken: {
        color: Colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    dosage: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    dosageTaken: {
        color: Colors.gray400,
    },
    instructionBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.gray100,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    instructionText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.gray600,
    },
    actionButtonContainer: {
        marginLeft: Sizes.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButton: {
        // Container for take button or checkmark
    },
    actionButtonTaken: {
        // No additional styles needed
    },
    takeButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    takeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.white,
    },
    takenTime: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginTop: 4,
        textAlign: 'center',
    },
    sourceIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
    },
    sourceText: {
        fontSize: 11,
        color: Colors.gray400,
        flex: 1,
    },
});
