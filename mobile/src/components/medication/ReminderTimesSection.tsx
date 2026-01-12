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
    onTimeChange?: (oldTime: string, newTime: string) => void;
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

// ... helpers getMealLabel, getCleanMedicineName kept as is via context ... Actually I can't skip helpers if I replace a large chunk.
// I will target specific blocks to be safer.

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
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

    // Time picker state - using time string as ID instead of index
    const [editingTime, setEditingTime] = useState<string | null>(null);
    const [tempTime, setTempTime] = useState<Date>(new Date());

    if (reminderTimes.length === 0) return null;

    const cleanName = getCleanMedicineName(medicineName);

    const toggleNoteExpansion = (id: string) => {
        setExpandedNotes(prev => ({
            ...prev,
            [id]: !prev[id]
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
    const handleTimeClick = (currentTime: string) => {
        setTempTime(timeStringToDate(currentTime));
        setEditingTime(currentTime);
    };

    /**
     * Handle time picker change
     */
    const handleTimePickerChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            const timeToUpdate = editingTime;
            setEditingTime(null); // Dismiss immediately
            if (event.type === 'set' && selectedDate && timeToUpdate) {
                const newTimeString = dateToTimeString(selectedDate);
                onTimeChange?.(timeToUpdate, newTimeString);
            }
        } else {
            // iOS
            if (selectedDate) setTempTime(selectedDate);
        }
    };

    /**
     * Handle iOS time picker confirm
     */
    const handleIOSConfirm = () => {
        if (editingTime) {
            const newTimeString = dateToTimeString(tempTime);
            onTimeChange?.(editingTime, newTimeString);
        }
        setEditingTime(null);
    };

    /**
     * Handle cancel
     */
    const handleCancel = () => {
        setEditingTime(null);
    };

    // Tooltip State
    const [activeTooltip, setActiveTooltip] = useState<{ id: string, label: string, time: string } | null>(null);

    // Helper to render Grouped Batches
    const renderGroupedView = () => {
        const batches = [
            { id: 'morning', label: 'Morning Dose', icon: 'sunrise', defaultTime: '08:00' },
            { id: 'afternoon', label: 'Afternoon Dose', icon: 'sun', defaultTime: '14:00' },
            { id: 'night', label: 'Night Dose', icon: 'moon', defaultTime: '21:00' },
        ];

        let rows: any[] = [];

        // 1. Generate standard batches based on dosage
        if (totalTimesPerDay && totalTimesPerDay <= 3 && timingDosage) {
            const parts = timingDosage.split('-').map(Number);
            if (parts.length === 3) {
                rows = batches.filter((_, index) => parts[index] > 0);
            } else {
                rows = batches; // Fallback
            }
        } else if (totalTimesPerDay && totalTimesPerDay > 3) {
            rows = [...batches];
            const extrasNeeded = totalTimesPerDay - 3;
            for (let i = 0; i < extrasNeeded; i++) {
                // Cyclical Logic: 
                // i=0 -> Morning + 1h
                // i=1 -> Afternoon + 1h
                // i=2 -> Night + 1h
                // i=3 -> Morning + 2h
                const cycleIndex = i % 3; // 0, 1, 2
                const offsetPass = Math.floor(i / 3) + 1; // 1, 1, 1, 2, 2, 2...
                const baseBatch = batches[cycleIndex];

                const [h, m] = baseBatch.defaultTime.split(':').map(Number);
                let newHour = h + offsetPass;
                if (newHour >= 24) newHour -= 24; // Simple wrap-around, though unlikely for usual doses

                const newTime = `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                rows.push({
                    id: `extra-${i}`,
                    label: 'Reminder', // Label is always Reminder for extras
                    icon: 'clock',
                    defaultTime: newTime
                });
            }
        } else {
            // Default logic if no meta info
            rows = batches;
        }

        // 2. Add extra rows for any active reminder times that aren't covered by the generated rows
        const coveredTimes = new Set(rows.map(r => r.defaultTime));

        // We iterate reminderTimes (the active ones)
        reminderTimes.forEach((time, index) => {
            if (!coveredTimes.has(time)) {
                rows.push({
                    id: `custom-${index}-${time}`,
                    label: 'Reminder',
                    icon: 'clock',
                    defaultTime: time
                });
                coveredTimes.add(time);
            }
        });

        // 3. Sort
        rows.sort((a, b) => {
            const ta = parseInt(a.defaultTime.replace(':', ''));
            const tb = parseInt(b.defaultTime.replace(':', ''));
            return ta - tb;
        });

        return rows;
    };

    // Effect: Auto-select visible batches... (Kept as is, but logic uses renderGroupedView)
    // We should be careful: renderGroupedView now includes reminderTimes. 
    // So rowTimes will include reminderTimes. 
    // The missingTimes filter `rowTimes.filter(t => !reminderTimes.includes(t))`
    // will now only catch the Generated ones that are NOT in reminderTimes.
    // Which is exactly what we want (to auto-enable the generated ones).

    useEffect(() => {
        const rows = renderGroupedView();
        const rowTimes = rows.map(r => r.defaultTime);
        const missingTimes = rowTimes.filter(t => !reminderTimes.includes(t));

        if (missingTimes.length > 0) {
            if (onUpdateReminderTimes) {
                const newTimes = Array.from(new Set([...reminderTimes, ...rowTimes]));
                newTimes.sort((a, b) => parseInt(a.replace(':', '')) - parseInt(b.replace(':', '')));
                onUpdateReminderTimes(newTimes);
            } else {
                // Fallback
                missingTimes.forEach(time => {
                    const row = rows.find(r => r.defaultTime === time);
                    if (row) onBatchToggle?.(row.id, true, time);
                });
            }
        }
    }, [totalTimesPerDay, timingDosage, reminderTimes]);

    const rowsToRender = renderGroupedView();
    let activeCounter = 0; // Tracking active reminders for dynamic numbering



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
                {rowsToRender.map((batch, index) => {
                    const isOn = reminderTimes.includes(batch.defaultTime);
                    const isCustomReminder = batch.label === 'Reminder' || batch.id.startsWith('extra-');

                    // Calculate number to show
                    let numberToShow = null;
                    if (isOn) {
                        activeCounter++;
                        numberToShow = activeCounter;
                    }

                    if (isCustomReminder) {
                        // Modern Layout for Custom Reminders
                        return (
                            <View key={batch.id} style={styles.numberedRowContainer}>
                                {/* Dynamic Numbering Column */}
                                <View style={styles.numberColumn}>
                                    <Text style={styles.numberText}>
                                        {numberToShow ? `${numberToShow}.` : ''}
                                    </Text>
                                </View>

                                <View style={styles.barWithNoteContainer}>
                                    <View style={styles.timeBarModern}>
                                        {/* Left: Clickable Time */}
                                        <TouchableOpacity
                                            onPress={() => handleTimeClick(batch.defaultTime)} // Note: using time value now
                                            style={styles.timeButton}
                                        >
                                            <Text style={styles.timeBarTimeLeft}>{formatTimeDisplay(batch.defaultTime)}</Text>
                                            <View style={[styles.intervalBadge, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '30' }]}>
                                                <Feather name="clock" size={10} color={Colors.primary} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Right Group */}
                                        <View style={styles.timeBarRightGroup}>
                                            <Text style={styles.timeBarDoseLabel} numberOfLines={1}>{cleanName}</Text>

                                            <Switch
                                                value={isOn}
                                                onValueChange={(val) => onBatchToggle?.(batch.id, val, batch.defaultTime)}
                                                trackColor={{ false: Colors.gray200, true: Colors.primary }}
                                                thumbColor={Colors.white}
                                                style={{ transform: [{ scaleX: 0.88 }, { scaleY: 0.85 }] }} // Approx 45x26.5
                                            />

                                            <TouchableOpacity
                                                style={styles.noteIconButton}
                                                onPress={() => toggleNoteExpansion(batch.id)}
                                            >
                                                <MaterialCommunityIcons
                                                    name={(defaultNotes[batch.defaultTime] || '').length > 0 ? "note-text" : "note-text-outline"}
                                                    size={20}
                                                    color={(defaultNotes[batch.defaultTime] || '').length > 0 ? "#D97706" : Colors.gray400}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Creating Note Input */}
                                    {expandedNotes[batch.id] && (
                                        <View style={styles.noteSection}>
                                            <View style={styles.noteInputContainer}>
                                                <TouchableOpacity style={styles.noteInputIcon}>
                                                    <Feather name="edit-3" size={14} color={Colors.gray400} />
                                                </TouchableOpacity>
                                                <TextInput
                                                    style={styles.noteInput}
                                                    value={defaultNotes[batch.defaultTime] || ''}
                                                    onChangeText={(text) => {
                                                        if (text.length <= 150) {
                                                            onDefaultNoteChange?.(batch.defaultTime, text);
                                                        }
                                                    }}
                                                    placeholder="Add instructions (e.g. Take with warm water)"
                                                    placeholderTextColor={Colors.gray400}
                                                    multiline
                                                    maxLength={150}
                                                />
                                            </View>
                                            <Text style={styles.noteCharCount}>
                                                {(defaultNotes[batch.defaultTime] || '').length}/150
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    }

                    // Standard Layout for Morning/Afternoon/Night
                    return (
                        <View key={batch.id} style={styles.numberedRowContainer}>
                            {/* Dynamic Numbering Column */}
                            <View style={styles.numberColumn}>
                                <Text style={styles.numberText}>
                                    {numberToShow ? `${numberToShow}.` : ''}
                                </Text>
                            </View>

                            <View style={styles.barWithNoteContainer}>
                                <View style={styles.batchRow}>
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

                                    <View style={styles.timeBarRightGroup}>
                                        <Switch
                                            value={isOn}
                                            onValueChange={(val) => onBatchToggle?.(batch.id, val, batch.defaultTime)}
                                            trackColor={{ false: Colors.gray200, true: Colors.primary }}
                                            thumbColor={Colors.white}
                                            style={{ transform: [{ scaleX: 0.88 }, { scaleY: 0.85 }] }} // Approx 45x26.5
                                        />

                                        <TouchableOpacity
                                            style={styles.noteIconButton}
                                            onPress={() => toggleNoteExpansion(batch.id)}
                                        >
                                            <MaterialCommunityIcons
                                                name={(defaultNotes[batch.defaultTime] || '').length > 0 ? "note-text" : "note-text-outline"}
                                                size={20}
                                                color={(defaultNotes[batch.defaultTime] || '').length > 0 ? "#D97706" : Colors.gray400}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Creating Note Input */}
                                {expandedNotes[batch.id] && (
                                    <View style={styles.noteSection}>
                                        <View style={styles.noteInputContainer}>
                                            <TouchableOpacity style={styles.noteInputIcon}>
                                                <Feather name="edit-3" size={14} color={Colors.gray400} />
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.noteInput}
                                                value={defaultNotes[batch.defaultTime] || ''}
                                                onChangeText={(text) => {
                                                    if (text.length <= 150) {
                                                        onDefaultNoteChange?.(batch.defaultTime, text);
                                                    }
                                                }}
                                                placeholder="Add instructions (e.g. Take with warm water)"
                                                placeholderTextColor={Colors.gray400}
                                                multiline
                                                maxLength={150}
                                            />
                                        </View>
                                        <Text style={styles.noteCharCount}>
                                            {(defaultNotes[batch.defaultTime] || '').length}/150
                                        </Text>
                                    </View>
                                )}
                            </View>
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
            {
                Platform.OS === 'ios' && editingTime !== null && (
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
                )
            }

            {/* Time Picker for Android */}
            {
                Platform.OS === 'android' && editingTime !== null && (
                    <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display="spinner"
                        onChange={handleTimePickerChange}
                    />
                )
            }
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
    // Numbering Styles
    numberedRowContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Align number with top of bar
    },
    numberColumn: {
        width: 24, // Fixed width for number
        paddingTop: 12, // Align visually with text in bar
        marginRight: 4,
    },
    numberText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray500,
        textAlign: 'right',
    },
    // Batches Styles
    batchesContainer: {
        gap: 8,
    },
    // Updated container to flex: 1 to fill remaining space next to number
    barWithNoteContainer: {
        flex: 1,
        marginBottom: 8, // Moved spacing here
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
        paddingHorizontal: 8, // Standardized 8
        paddingLeft: 12, // Ensure left alignment matches custom
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
        paddingVertical: 8,
        paddingLeft: 12,
        paddingRight: 8, // Standardized 8
    },
    timeBarTimeLeft: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.gray900,
        letterSpacing: -0.3,
        minWidth: 65, // Reduced from 75
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
    noteIconButton: {
        width: 22, // Tighter width
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ scaleX: 0.75 }], // Scale visual icon width
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
