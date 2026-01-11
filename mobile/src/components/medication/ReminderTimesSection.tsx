import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { getTimeOfDayCategory } from '../../types/medicationSchedule';

interface ReminderTimesSectionProps {
    reminderTimes: string[];
    intervalText: string;
    medicineName: string;
    reminderToggles: boolean[];
    totalTimesPerDay?: number;
    timingDosage?: string;
    foodRelationship?: string;
    onToggleChange: (index: number, value: boolean) => void;
}

/**
 * Format time for display (24h -> 12h with AM/PM)
 */
const formatTimeDisplay = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Get dynamic meal label based on time, dosage pattern, and total_times_per_day
 */
const getMealLabel = (
    time: string,
    index: number,
    foodRelationship?: string,
    totalTimesPerDay?: number,
    timingDosage?: string
): string | null => {
    // If no meal relationship or it's 'any'/'anytime', return null
    if (!foodRelationship || foodRelationship === 'any' || foodRelationship === 'anytime') return null;

    // Determine prefix based on meal relationship
    const prefix = foodRelationship === 'before_food' ? 'Before' :
        foodRelationship === 'after_food' ? 'After' :
            foodRelationship === 'with_food' ? 'With' : null;

    if (!prefix) return null;

    // If total_times_per_day > 3, show generic meal label
    if (totalTimesPerDay && totalTimesPerDay > 3) {
        return `${prefix} Meal`;
    }

    // If total_times_per_day <= 3, show specific meal based on time of day
    if (totalTimesPerDay && totalTimesPerDay <= 3) {
        const timeCategory = getTimeOfDayCategory(time);

        const mealMap: Record<string, string> = {
            'morning': 'Breakfast',
            'afternoon': 'Lunch',
            'night': 'Dinner'
        };

        const mealName = mealMap[timeCategory];

        if (mealName) {
            return `${prefix} ${mealName}`;
        }
    }

    // Fallback: show generic meal label if we have data but couldn't determine specific meal
    if (totalTimesPerDay || timingDosage) {
        return `${prefix} Meal`;
    }

    return null;
};

/**
 * Get clean medicine name for display (without strength, Title Case)
 */
const getCleanMedicineName = (name: string): string => {
    let cleanName = name || '';
    cleanName = cleanName.replace(/\s*\d+\s*(mg|ml|mcg|g|iu|%)/gi, '').trim();
    cleanName = cleanName.replace(/\s*\(\s*[\d\/\.]+\s*(mg|ml|mcg|g)?\s*\)/gi, '').trim();
    return cleanName
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * ReminderTimesSection - Reminder time bars with toggle switches
 * Extracted from MedicationVerificationCard.tsx
 */
export function ReminderTimesSection({
    reminderTimes,
    intervalText,
    medicineName,
    reminderToggles,
    totalTimesPerDay,
    timingDosage,
    foodRelationship,
    onToggleChange,
}: ReminderTimesSectionProps) {
    if (reminderTimes.length === 0) return null;

    const cleanName = getCleanMedicineName(medicineName);

    return (
        <View style={styles.reminderBarsContainer}>
            {/* Section Header */}
            <View style={styles.reminderHeader}>
                <View style={styles.reminderHeaderLeft}>
                    <Feather name="bell" size={16} color={Colors.primary} />
                    <Text style={styles.reminderTitle}>REMINDER TIMES</Text>
                    {intervalText && (
                        <View style={styles.intervalBadge}>
                            <Text style={styles.intervalText}>{intervalText}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Time Bars */}
            <View style={styles.timeBarsWrapper}>
                {reminderTimes.map((time, index) => {
                    const mealLabel = getMealLabel(time, index, foodRelationship, totalTimesPerDay, timingDosage);

                    return (
                        <TouchableOpacity
                            key={`time-bar-${index}`}
                            style={styles.timeBarModern}
                            activeOpacity={0.9}
                        >
                            {/* LEFT: Time Display */}
                            <Text style={styles.timeBarTimeLeft}>{formatTimeDisplay(time)}</Text>

                            {/* CENTER: Dynamic Meal Label */}
                            {mealLabel && (
                                <Text style={styles.timeBarFoodRelation}>{mealLabel}</Text>
                            )}

                            {/* RIGHT GROUP: Label + Toggle */}
                            <View style={styles.timeBarRightGroup}>
                                <Text style={styles.timeBarDoseLabel} numberOfLines={1}>
                                    {cleanName}
                                </Text>
                                <Switch
                                    value={reminderToggles[index] || false}
                                    onValueChange={(value) => onToggleChange(index, value)}
                                    trackColor={{
                                        false: Colors.gray300,
                                        true: Colors.primary
                                    }}
                                    thumbColor={Colors.white}
                                    ios_backgroundColor={Colors.gray300}
                                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    reminderBarsContainer: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    reminderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    reminderHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    reminderTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.gray500,
        letterSpacing: 0.5,
    },
    intervalBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    intervalText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    timeBarsWrapper: {
        gap: 10,
    },
    timeBarModern: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        paddingVertical: 10,
        paddingLeft: 14,
        paddingRight: 8,
    },
    timeBarTimeLeft: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.gray900,
        letterSpacing: -0.3,
        minWidth: 75,
    },
    timeBarRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeBarDoseLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.gray600,
        maxWidth: 90,
    },
    timeBarFoodRelation: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.gray600,
    },
});
