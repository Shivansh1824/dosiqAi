import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { MedicationWithStatus, TimeOfDayCategory, getTimeOfDayText, getTimeOfDayIcon } from '../types/medicationSchedule';
import MedicationCard from './MedicationCard';

interface TimeSectionProps {
    category: TimeOfDayCategory;
    medications: MedicationWithStatus[];
    onTakeMedication: (medicationId: string, scheduledTime: string) => void;
    onReschedule?: (medication: MedicationWithStatus) => void;
}

export default function TimeSection({ category, medications, onTakeMedication, onReschedule }: TimeSectionProps) {
    const title = getTimeOfDayText(category);
    const iconName = getTimeOfDayIcon(category);

    // Get icon color based on category
    const getIconColor = () => {
        switch (category) {
            case 'morning':
                return '#F59E0B'; // Warm orange for sunrise
            case 'afternoon':
                return '#EF4444'; // Red for bright sun
            case 'evening':
                return '#F97316'; // Sunset orange
            case 'night':
                return '#3B82F6'; // Blue for night
        }
    };

    const iconColor = getIconColor();

    return (
        <View style={styles.container}>
            {/* Section Header */}
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                    <Feather name={iconName as any} size={20} color={iconColor} />
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.count}>
                    {medications.length} {medications.length === 1 ? 'medication' : 'medications'}
                </Text>
            </View>

            {/* Medications List */}
            {medications.length === 0 ? (
                <View style={styles.emptyState}>
                    <Feather name="check-circle" size={32} color={Colors.success} />
                    <Text style={styles.emptyText}>All clear for {title.toLowerCase()}</Text>
                </View>
            ) : (
                <View style={styles.medicationsList}>
                    {medications.map((med) => (
                        <MedicationCard
                            key={`${med.id}-${med.scheduled_time}`}
                            medication={med}
                            onTake={onTakeMedication}
                            onReschedule={onReschedule}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Sizes.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Sizes.md,
        paddingHorizontal: Sizes.xs,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Sizes.sm,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        flex: 1,
    },
    count: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    medicationsList: {
        // Cards have their own margin
    },
    emptyState: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.xl,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: Sizes.sm,
        fontWeight: '500',
    },
});
