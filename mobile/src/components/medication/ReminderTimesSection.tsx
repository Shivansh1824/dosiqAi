import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Platform, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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
    onTimeChange?: (index: number, newTime: string) => void;  // NEW: Callback for time changes

    // Note-related props (prepared for future functionality)
    defaultNotes?: Record<string, string>;  // { "08:00": "Take with water", ... }
    onDefaultNoteChange?: (time: string, note: string) => void;
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
 * ReminderTimesSection - Reminder time bars with toggle switches and expandable notes
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
    onTimeChange,
    defaultNotes = {},
    onDefaultNoteChange,
}: ReminderTimesSectionProps) {
    // Track which notes are expanded
    const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

    // Time picker state
    const [showTimePicker, setShowTimePicker] = useState<number | null>(null);  // Track which time picker is shown
    const [tempTime, setTempTime] = useState<Date>(new Date());  // Temporary time for the picker

    if (reminderTimes.length === 0) return null;

    const cleanName = getCleanMedicineName(medicineName);

    const toggleNoteExpansion = (index: number) => {
        setExpandedNotes(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    /**
     * Convert 24h time string to Date object for picker
     */
    const timeStringToDate = (timeString: string): Date => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    /**
     * Convert Date object to 24h time string
     */
    const dateToTimeString = (date: Date): string => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    /**
     * Handle time click - open the time picker
     */
    const handleTimeClick = (index: number, currentTime: string) => {
        setTempTime(timeStringToDate(currentTime));
        setShowTimePicker(index);
    };

    /**
     * Handle time picker change (called when user adjusts the picker)
     */
    const handleTimePickerChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            // Android: Dismiss picker immediately
            setShowTimePicker(null);

            if (event.type === 'set' && selectedDate && showTimePicker !== null) {
                const newTimeString = dateToTimeString(selectedDate);
                onTimeChange?.(showTimePicker, newTimeString);
            }
        } else {
            // iOS: Keep picker open, update temp time
            if (selectedDate) {
                setTempTime(selectedDate);
            }
        }
    };

    /**
     * Handle iOS time picker confirm
     */
    const handleIOSConfirm = () => {
        if (showTimePicker !== null) {
            const newTimeString = dateToTimeString(tempTime);
            onTimeChange?.(showTimePicker, newTimeString);
        }
        setShowTimePicker(null);
    };

    /**
     * Handle cancel
     */
    const handleCancel = () => {
        setShowTimePicker(null);
    };

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
                    const hasNote = !!defaultNotes[time];
                    const isExpanded = expandedNotes[index];

                    return (
                        <View key={`time-bar-${index}`} style={styles.barWithNoteContainer}>
                            {/* Main Reminder Bar */}
                            <View style={styles.timeBarModern}>
                                {/* LEFT: Time Display - Now Clickable */}
                                <TouchableOpacity
                                    onPress={() => handleTimeClick(index, time)}
                                    activeOpacity={0.7}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeBarTimeLeft}>{formatTimeDisplay(time)}</Text>
                                </TouchableOpacity>

                                {/* CENTER: Dynamic Meal Label */}
                                {mealLabel && (
                                    <Text style={styles.timeBarFoodRelation}>{mealLabel}</Text>
                                )}

                                {/* RIGHT GROUP: Label + Toggle + Note Icon */}
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

                                    {/* Note Icon */}
                                    <TouchableOpacity
                                        onPress={() => toggleNoteExpansion(index)}
                                        style={styles.noteIconButton}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons
                                            name={hasNote ? "clipboard-edit-outline" : "clipboard-edit-outline"}
                                            size={18}
                                            color={hasNote ? '#F59E0B' : Colors.gray400}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Expandable Note Section */}
                            {isExpanded && (
                                <View style={styles.noteSection}>
                                    <View style={styles.noteInputContainer}>
                                        <MaterialCommunityIcons name="comment-text-outline" size={16} color="#D97706" style={styles.noteInputIcon} />
                                        <TextInput
                                            style={styles.noteInput}
                                            value={defaultNotes[time] || ''}
                                            onChangeText={(text) => onDefaultNoteChange?.(time, text)}
                                            placeholder="Add reminder note (e.g., 'Take with water')..."
                                            placeholderTextColor={Colors.gray400}
                                            multiline
                                            maxLength={150}
                                        />
                                    </View>
                                    {defaultNotes[time] && (
                                        <Text style={styles.noteCharCount}>
                                            {defaultNotes[time].length}/150
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Time Picker Modal for iOS */}
            {Platform.OS === 'ios' && showTimePicker !== null && (
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={true}
                    onRequestClose={handleCancel}
                >
                    <View style={styles.centeredView}>
                        <View style={styles.modalView}>
                            <DateTimePicker
                                value={tempTime}
                                mode="time"
                                display="spinner"
                                onChange={handleTimePickerChange}
                                textColor={Colors.gray900}
                            />
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.buttonCancel]}
                                    onPress={handleCancel}
                                >
                                    <Text style={styles.textStyle}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.buttonConfirm]}
                                    onPress={handleIOSConfirm}
                                >
                                    <Text style={styles.textStyle}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Time Picker for Android */}
            {Platform.OS === 'android' && showTimePicker !== null && (
                <DateTimePicker
                    value={tempTime}
                    mode="time"
                    display="spinner"
                    onChange={handleTimePickerChange}
                />
            )}
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

    // Note-related styles
    barWithNoteContainer: {
        marginBottom: 0,
    },
    noteIconButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    noteSection: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FCD34D',
        borderRadius: 10,
        marginTop: 8,
        padding: 12,
    },
    noteInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    noteInputIcon: {
        marginTop: 2,
    },
    noteInput: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
        color: '#78716C',
        minHeight: 40,
        maxHeight: 80,
        padding: 0,
    },
    noteCharCount: {
        fontSize: 10,
        color: '#D97706',
        textAlign: 'right',
        marginTop: 6,
        fontWeight: '500',
    },

    // Time Picker Styles
    timeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 0,
        paddingVertical: 0,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    clockIcon: {
        marginRight: 4,
    },

    // iOS Modal Styles
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: '100%',
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        elevation: 2,
        alignItems: 'center',
    },
    buttonCancel: {
        backgroundColor: Colors.gray300,
    },
    buttonConfirm: {
        backgroundColor: Colors.primary,
    },
    textStyle: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },
});
