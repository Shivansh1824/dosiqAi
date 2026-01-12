import React, { useState, useEffect } from 'react';
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
    onAddPress?: () => void;
    customMealLabels?: Record<string, string>;

    // NEW: Configuration Mode
    onBatchToggle?: (batchId: string, isEnabled: boolean, defaultTime: string) => void;
    onUpdateReminderTimes?: (times: string[]) => void;
}

/**
 * Format time for display (24h -> 12h with AM/PM)
 */
const formatTimeDisplay = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    if (isNaN(minutes)) return ''; // Handle invalid format
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
    timingDosage?: string,
    customLabel?: string // NEW: Optional custom override
): string | null => {
    // 1. Priority: Custom Label
    // If it is explicitly an empty string, we return null (Not Specified)
    if (customLabel !== undefined) {
        return customLabel === "" ? null : customLabel;
    }

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
    onAddPress,
    customMealLabels,
    onBatchToggle,
    onUpdateReminderTimes
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

    // ... existing state ...



    // Tooltip State
    const [activeTooltip, setActiveTooltip] = useState<{ id: string, label: string, time: string } | null>(null);

    // Helper to render Grouped Batches
    const renderGroupedView = () => {
        // Define Batches
        const batches = [
            { id: 'morning', label: 'Morning Dose', icon: 'sunrise', defaultTime: '08:00' },
            { id: 'afternoon', label: 'Afternoon Dose', icon: 'sun', defaultTime: '14:00' },
            { id: 'night', label: 'Night Dose', icon: 'moon', defaultTime: '21:00' },
        ];

        // Dynamic Filtering based on dosage (e.g. "1-0-1")
        let rowsToRender = batches;

        if (totalTimesPerDay && totalTimesPerDay <= 3 && timingDosage) {
            const parts = timingDosage.split('-').map(Number);
            // Ensure we have exactly 3 parts for M-A-N
            if (parts.length === 3) {
                rowsToRender = batches.filter((_, index) => parts[index] > 0);
            }
        } else if (totalTimesPerDay && totalTimesPerDay > 3) {
            // Advanced Logic for > 3 doses
            // 1. Start with base 3
            rowsToRender = [...batches];

            // 2. Calculate how many extras needed
            const extrasNeeded = totalTimesPerDay - 3;

            // 3. Cycle and add
            // Sequence: Morning -> Afternoon -> Night
            const baseIds = ['morning', 'afternoon', 'night'];

            for (let i = 0; i < extrasNeeded; i++) {
                const cycleIndex = i % 3; // 0, 1, 2
                const offsetPass = Math.floor(i / 3) + 1; // 1, 1, 1, 2, 2, 2...

                const baseBatch = batches[cycleIndex];

                // Calculate new time
                // Format "HH:mm"
                const [h, m] = baseBatch.defaultTime.split(':').map(Number);
                let newHour = h + offsetPass;
                // Simple wrap for 24h, though realistic doses shouldn't wrap wildly
                if (newHour >= 24) newHour -= 24;

                const newTime = `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                rowsToRender.push({
                    id: `extra-${i}`,
                    label: 'Reminder', // Placeholder label
                    icon: 'clock',
                    defaultTime: newTime
                });
            }

            // 4. Sort chronologically
            rowsToRender.sort((a, b) => {
                const ta = parseInt(a.defaultTime.replace(':', ''));
                const tb = parseInt(b.defaultTime.replace(':', ''));
                return ta - tb;
            });
        }

        return rowsToRender;
    };

    // Effect: Auto-select visible batches if not already selected
    // This ensures that "1-0-1" or "4 doses" (dynamic) are ON by default
    useEffect(() => {
        const rows = renderGroupedView();
        const rowTimes = rows.map(r => r.defaultTime);

        // Check if we need to sync:
        // If current reminderTimes doesn't include all our dynamic rows, needed update
        const missingTimes = rowTimes.filter(t => !reminderTimes.includes(t));

        if (missingTimes.length > 0) {
            // We need to ADD the missing times to the current active list
            // Solution: Use onUpdateReminderTimes for ATOMIC update to prevent race conditions

            if (onUpdateReminderTimes) {
                // 1. Combine unique times
                const newTimes = Array.from(new Set([...reminderTimes, ...rowTimes]));

                // 2. Sort them chronologically
                newTimes.sort((a, b) => {
                    const ta = parseInt(a.replace(':', ''));
                    const tb = parseInt(b.replace(':', ''));
                    return ta - tb;
                });

                // 3. Single atomic update
                onUpdateReminderTimes(newTimes);
            } else {
                // Fallback (might have race conditions, but kept for safety)
                missingTimes.forEach(time => {
                    const row = rows.find(r => r.defaultTime === time);
                    if (row) {
                        onBatchToggle?.(row.id, true, time);
                    }
                });
            }
        }
    }, [totalTimesPerDay, timingDosage, reminderTimes]); // Re-run when definition changes or props update

    const rowsToRender = renderGroupedView();



    return (
        <View style={styles.reminderBarsContainer}>
            {/* Section Header */}
            <View style={styles.reminderHeader}>
                <View style={styles.reminderHeaderLeft}>
                    <Feather name="bell" size={16} color={Colors.primary} />
                    <Text style={styles.reminderTitle}>REMINDER SCHEDULE</Text>
                </View>
            </View>

            <Text style={styles.explanatoryText}>
                {totalTimesPerDay
                    ? `Our system detected that ${cleanName} is to be taken ${totalTimesPerDay} times daily. Please verify and adjust the reminders below.`
                    : `Please verify and adjust the reminders below.`}
            </Text>

            {/* Content Body */}
            <View style={styles.batchesContainer}>
                {rowsToRender.map((batch) => {
                    const isOn = reminderTimes.includes(batch.defaultTime);
                    return (
                        <View key={batch.id} style={styles.batchRow}>
                            <View style={styles.batchInfo}>
                                <View style={[styles.batchIcon, { backgroundColor: isOn ? Colors.primary + '15' : Colors.gray50 }]}>
                                    <Feather name={batch.icon as any} size={18} color={isOn ? Colors.primary : Colors.gray400} />
                                </View>
                                <View>
                                    <View style={styles.batchLabelContainer}>
                                        <Text style={[styles.batchLabel, isOn && styles.batchLabelActive]}>{batch.label}</Text>
                                        <TouchableOpacity
                                            onPress={() => setActiveTooltip({ id: batch.id, label: batch.label, time: batch.defaultTime })}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Feather name="info" size={14} color={Colors.gray400} style={styles.infoIcon} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.batchTimeHint}>{formatTimeDisplay(batch.defaultTime)}</Text>
                                </View>
                            </View>
                            <Switch
                                value={isOn}
                                onValueChange={(val) => onBatchToggle?.(batch.id, val, batch.defaultTime)}
                                trackColor={{ false: Colors.gray200, true: Colors.primary }}
                                thumbColor={Colors.white}
                            />
                        </View>
                    );
                })}

                {/* Always show Add Custom Time Button in Grouped View */}
                {onAddPress && (
                    <TouchableOpacity style={styles.addTimeCleanButton} onPress={onAddPress}>
                        <Feather name="plus-circle" size={18} color={Colors.primary} />
                        <Text style={styles.addTimeCleanText}>Add Reminder</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Time Picker Modal for iOS and Android... (Existing) */}
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
            {/* Tooltip Modal */}
            <Modal
                transparent={true}
                visible={!!activeTooltip}
                animationType="fade"
                onRequestClose={() => setActiveTooltip(null)}
            >
                <TouchableOpacity
                    style={styles.tooltipOverlay}
                    activeOpacity={1}
                    onPress={() => setActiveTooltip(null)}
                >
                    <View style={styles.tooltipCard}>
                        <View style={styles.tooltipHeader}>
                            <Feather name="info" size={20} color={Colors.primary} />
                            <Text style={styles.tooltipTitle}>About {activeTooltip?.label}</Text>
                        </View>
                        <Text style={styles.tooltipBody}>
                            Your {activeTooltip?.label} ({formatTimeDisplay(activeTooltip?.time || '')}) currently includes <Text style={{ color: Colors.gray800 }}>2 medicines</Text>. This update adds <Text style={{ color: Colors.gray800 }}>{cleanName}</Text> to this schedule.
                        </Text>
                        <TouchableOpacity
                            style={styles.tooltipCloseButton}
                            onPress={() => setActiveTooltip(null)}
                        >
                            <Text style={styles.tooltipCloseText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    tooltipOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    tooltipCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    tooltipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    tooltipTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray900,
    },
    tooltipBody: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.gray600,
        marginBottom: 24,
    },
    tooltipCloseButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    tooltipCloseText: {
        color: Colors.white,
        fontWeight: '600',
        fontSize: 16,
    },
    batchLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    infoIcon: {
        opacity: 0.6,
    },
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
    explanatoryText: {
        fontSize: 12,
        color: Colors.gray500,
        marginTop: -8, // Pull closer to header (offsetting the header's marginBottom)
        marginBottom: 12,
        lineHeight: 18,
    },
    boldText: {
        fontWeight: '700',
        color: Colors.gray700,
    },
    // Mode Selector Styles
    modeSelectorContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.gray100,
        borderRadius: 10,
        padding: 4,
        marginBottom: 12,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: 8,
    },
    modeButtonActive: {
        backgroundColor: Colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    modeButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.gray500,
    },
    modeButtonTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
    // Batches Styles
    batchesContainer: {
        gap: 8,
    },
    batchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    batchInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    batchIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    batchLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray800,
    },
    batchLabelActive: {
        color: Colors.primary,
    },
    batchTimeHint: {
        fontSize: 11,
        color: Colors.gray400,
        marginTop: 1,
    },
    // Existing Styles...
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
    timeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 0,
        paddingVertical: 0,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    addTimeCleanButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
        backgroundColor: Colors.primary + '05',
    },
    addTimeCleanText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
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
