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
    onReschedule?: (medication: MedicationWithStatus) => void;
}

export default function MedicationCard({ medication, onTake, onReschedule }: MedicationCardProps) {
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
            <View style={styles.leftSection}>
                <View style={[styles.iconContainer, { backgroundColor: iconColor + '10' }]}>
                    <View style={[styles.iconLargeCircle, { borderColor: iconColor + '30' }]}>
                        <Feather
                            name={iconName as any}
                            size={28}
                            color={isTaken ? Colors.gray400 : iconColor}
                        />
                    </View>
                </View>
            </View>
            
            {/* Center: Medicine Info */}
            <View style={styles.infoContainer}>
                <View style={styles.nameRow}>
                    <Text style={[
                        styles.name,
                        isTaken && styles.nameTaken,
                    ]} numberOfLines={1}>
                        {medication.name}
                    </Text>
                </View>
                
                <View style={styles.detailsRow}>
                    {/* Time & Reschedule */}
                    <TouchableOpacity 
                        style={styles.timeContainer} 
                        onPress={() => onReschedule?.(medication)}
                        disabled={isTaken}
                        activeOpacity={0.6}
                    >
                        <Feather name="clock" size={12} color={Colors.primary} />
                        <Text style={styles.timeText}>{medication.scheduled_time}</Text>
                        {!isTaken && <Feather name="chevron-down" size={12} color={Colors.primary} />}
                    </TouchableOpacity>

                    <View style={styles.verticalDivider} />

                    <Text style={styles.dosageText} numberOfLines={1}>
                        {medication.dosage}
                    </Text>
                </View>

                <View style={styles.tagRow}>
                    <View style={styles.typeTag}>
                        <Text style={styles.tagText}>{medication.type.charAt(0).toUpperCase() + medication.type.slice(1)}</Text>
                    </View>
                    <View style={styles.instructionTag}>
                        <Text style={styles.tagText}>{getInstructionText(medication.instructions)}</Text>
                    </View>
                </View>
            </View>

            {/* Right: Take Button / Checkmark */}
            <View style={styles.actionButtonContainer}>
                {isTaken ? (
                    <View style={styles.statusContainer}>
                        <Animated.View style={[styles.checkmarkCircle, animatedStyle]}>
                            <Feather name="check" size={20} color={Colors.white} />
                        </Animated.View>
                        {medication.taken_at && (
                            <Text style={styles.takenAtText}>
                                {new Date(medication.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.takeButton}
                        onPress={handleTakePress}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.takeButtonText}>Take</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        alignItems: 'center',
    },
    containerTaken: {
        opacity: 0.8,
        backgroundColor: '#F9FAFB',
    },
    containerMissed: {
        borderLeftWidth: 4,
        borderLeftColor: Colors.error,
    },
    leftSection: {
        marginRight: 14,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconLargeCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
    },
    infoContainer: {
        flex: 1,
    },
    nameRow: {
        marginBottom: 4,
    },
    name: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    nameTaken: {
        color: Colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 4,
    },
    timeText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary,
    },
    verticalDivider: {
        width: 1,
        height: 12,
        backgroundColor: Colors.gray200,
        marginHorizontal: 8,
    },
    dosageText: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '500',
        flexShrink: 1,
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
    },
    typeTag: {
        backgroundColor: Colors.gray100,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    instructionTag: {
        backgroundColor: Colors.gray100,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    tagText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.gray600,
        textTransform: 'uppercase',
    },
    actionButtonContainer: {
        marginLeft: 10,
        width: 65,
        alignItems: 'center',
    },
    takeButton: {
        backgroundColor: Colors.primary,
        width: '100%',
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    takeButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.white,
    },
    statusContainer: {
        alignItems: 'center',
    },
    checkmarkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    takenAtText: {
        fontSize: 9,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginTop: 4,
    },
});
