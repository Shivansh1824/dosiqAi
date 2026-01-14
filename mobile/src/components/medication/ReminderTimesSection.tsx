import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Platform, Modal, Dimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors } from '../../constants';
import { getTimeOfDayCategory } from '../../types/medicationSchedule';
import { cleanMedicationName } from '../../utils/medicationParser';
import { InfoModal } from '../InfoModal';

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
    interval?: number;
    sourceName?: string;
    originalTotalTimes?: number;
    originalInterval?: number;
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
    onUpdateReminderTimes,
    interval,
    sourceName,
    originalTotalTimes,
    originalInterval
}: ReminderTimesSectionProps) {
    // Track which notes are expanded
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

    // Time picker state - using time string as ID instead of index
    const [editingTime, setEditingTime] = useState<string | null>(null);
    const [tempTime, setTempTime] = useState<Date>(new Date());

    // NEW: Swipe to delete state
    const [deletedBatchIds, setDeletedBatchIds] = useState<string[]>([]);
    const firstSwipeableRef = React.useRef<Swipeable>(null);
    const firstItemRef = React.useRef<View>(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    // Initial Onboarding Animation - Trigger when visible
    useEffect(() => {
        if (hasAnimated) return;

        const screenHeight = Dimensions.get('window').height;

        // Poll for visibility
        const interval = setInterval(() => {
            if (firstItemRef.current) {
                firstItemRef.current.measureInWindow((x, y, width, height) => {
                    // Check if item is roughly in the viewport (with some buffer)
                    // y > 0 means top is visible
                    // y < screenHeight means it's within screen bounds
                    const isVisible = y > 0 && y < (screenHeight - 100);

                    if (isVisible) {
                        // Trigger Animation
                        if (firstSwipeableRef.current) {
                            firstSwipeableRef.current.openRight();
                            setTimeout(() => {
                                firstSwipeableRef.current?.close();
                            }, 1200); // Keep open for 1.2s then close

                            setHasAnimated(true);
                            clearInterval(interval);
                        }
                    }
                });
            }
        }, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, [hasAnimated]);

    const handleDelete = (id: string, time: string) => {
        // If it's a preset (morning/afternoon/night/extra), we "hide" it by adding to deleted list
        // and ensuring it is toggled OFF.
        if (id === 'morning' || id === 'afternoon' || id === 'night' || id.startsWith('extra-')) {
            setDeletedBatchIds(prev => [...prev, id]);
            onBatchToggle?.(id, false, time);
        } else {
            // It's a custom time (custom-X-TIME), we actually remove it from the array
            if (onUpdateReminderTimes) {
                const newTimes = reminderTimes.filter(t => t !== time);
                onUpdateReminderTimes(newTimes);
            }
        }
    };

    if (reminderTimes.length === 0) return null;

    const cleanName = cleanMedicationName(medicineName);

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

    // Info Modal State
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [infoModalTitle, setInfoModalTitle] = useState('');
    const [infoModalBody, setInfoModalBody] = useState('');

    const handleInfoPress = (label: string, time: string) => {
        setInfoModalTitle(`About ${label}`);
        setInfoModalBody(`Your ${label} (${formatTimeDisplay(time)}) currently includes 2 medicines. This update adds ${cleanName} to this schedule.`);
        setInfoModalVisible(true);
    };

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
        // Removing reminderTimes from dependency array to prevent auto-re-enabling when user toggles off
    }, [totalTimesPerDay, timingDosage]);

    const rowsToRender = renderGroupedView();
    let activeCounter = 0; // Tracking active reminders for dynamic numbering



    return (
        <View style={styles.reminderBarsContainer}>
            {/* Section Header */}
            <View style={styles.reminderHeader}>
                <View style={styles.reminderHeaderLeft}>
                    <Feather name="bell" size={16} color={Colors.primary} />
                    <Text style={styles.reminderTitle}>DOSE SCHEDULE</Text>
                </View>
            </View>

            <Text style={styles.explanatoryText}>
                {(() => {
                    // Use original values from JSON for this text, falling back to current if not provided (safety)
                    // But explicitly prioritizing the 'original' props as requested.
                    const times = originalTotalTimes ?? totalTimesPerDay;
                    const days = originalInterval ?? interval ?? 1;
                    const name = cleanName;

                    if (!times) return "Please verify and adjust the reminders below.";

                    // Case 1: 1 time everyday
                    if (days === 1 && times === 1) {
                        return `dosiq AI identified that this dose is to be taken 1 time everyday. Please verify and adjust the schedule below.`;
                    }

                    // Case 3: x times everyday
                    if (days === 1 && times > 1) {
                        return `dosiq AI identified that this dose is to be taken ${times} times everyday. Please verify and adjust the schedule below.`;
                    }

                    // Case 4: 1 time, every y days
                    if (days > 1 && times === 1) {
                        return `dosiq AI identified that this dose is to be taken 1 time, every ${days} days. Please verify and adjust the schedule below.`;
                    }

                    // Case 2: x times a day, every y days (and fallback)
                    return `dosiq AI identified that this dose is to be taken ${times} times a day, after every ${days} days. Please verify the schedule below.`;
                })()}
            </Text>

            {/* Content Body */}
            <View style={styles.batchesContainer}>
                {rowsToRender.map((batch, index) => {
                    const isOn = reminderTimes.includes(batch.defaultTime);
                    // Skip if hidden/deleted
                    if (deletedBatchIds.includes(batch.id)) return null;

                    const isCustomReminder = batch.label === 'Reminder' || batch.id.startsWith('extra-');

                    // Calculate number to show
                    let numberToShow = null;
                    if (isOn) {
                        activeCounter++;
                        numberToShow = activeCounter;
                    }

                    // Onboarding animation ref for the first item
                    const swipeableRef = index === 0 ? firstSwipeableRef : null;

                    const renderRightActions = (progress: any, dragX: any) => {
                        return (
                            <TouchableOpacity
                                style={styles.deleteAction}
                                onPress={() => handleDelete(batch.id, batch.defaultTime)}
                            >
                                <View style={styles.deleteActionContent}>
                                    <Feather name="trash-2" size={20} color={Colors.white} />
                                    <Text style={styles.deleteActionText}>Delete</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    };

                    // Wrapper to keep styling clean
                    const renderRowContent = () => {
                        if (isCustomReminder) {
                            // Modern Layout for Custom Reminders
                            return (
                                <View style={styles.numberedRowContainer}>
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
                                                onPress={() => handleTimeClick(batch.defaultTime)}
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
                                                    style={{ transform: [{ scaleX: 0.88 }, { scaleY: 0.85 }] }}
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
                            <View style={styles.numberedRowContainer}>
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
                                                        onPress={() => handleInfoPress(batch.label, batch.defaultTime)}
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
                                                style={{ transform: [{ scaleX: 0.88 }, { scaleY: 0.85 }] }}
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
                    };

                    return (
                        <View
                            key={batch.id}
                            ref={index === 0 ? firstItemRef : null}
                            collapsable={false} // Ensure measurement works on Android
                        >
                            <Swipeable
                                ref={swipeableRef}
                                renderRightActions={renderRightActions}
                                containerStyle={{ marginBottom: 8 }} // Margin moved here to exclude from swipe height
                                childrenContainerStyle={{}}
                            >
                                {renderRowContent()}
                            </Swipeable>
                        </View>
                    );
                })}

                {/* Always show Add Custom Time Button in Grouped View */}
                {onAddPress && (
                    <View style={styles.numberedRowContainer}>
                        {/* Empty Number Column for alignment */}
                        <View style={styles.numberColumn} />

                        <View style={styles.barWithNoteContainer}>
                            <TouchableOpacity style={styles.addTimeCleanButton} onPress={onAddPress}>
                                <Feather name="plus-circle" size={18} color={Colors.primary} />
                                <Text style={styles.addTimeCleanText}>Add Reminder</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
            {/* Information Modal */}
            <InfoModal
                visible={infoModalVisible}
                title={infoModalTitle}
                body={infoModalBody}
                onClose={() => setInfoModalVisible(false)}
            />
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
        paddingHorizontal: 16,
        marginTop: 8,
        marginBottom: 0,
    },
    reminderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
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
        color: Colors.gray600,
        // marginTop: -8, // REMOVED to match Course Period spacing (12px)
        marginBottom: 12,
        lineHeight: 17,
        fontWeight: '500',
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
        alignItems: 'center', // Align number with center of bar
        // marginBottom: 8, // REMOVED: Moved to Swipeable container to fix Delete button height
    },
    numberColumn: {
        width: 32, // Increased width to accommodate larger font size
        marginRight: 4,
    },
    numberText: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.gray500,
        textAlign: 'left',
    },
    // Batches Styles
    batchesContainer: {
        gap: 8, // This provides gap between items if not using marginBottom, but we used marginBottom on container.
        // Actually, batchesContainer has gap: 8. So we might double up spacing if we also have marginBottom.
        // Let's rely on gap from batchesContainer and REMOVE marginBottom from children if possible, 
        // OR rely on marginBottom and remove gap. 
        // Previous code had gap: 8 AND marginBottom: 8 on barWithNoteContainer. 
        // Let's keep marginBottom on numberedRowContainer as requested for vertical centering logic context, 
        // but strictly speaking, if we move it to numberedRowContainer, the centering logic (alignItems: center) works on the row's children (number + bar).
        // If bar has NO margin, it is centered to number.
        // The Row itself has margin bottom to separate from next row. 
        // This is correct.
    },
    // Updated container to flex: 1 to fill remaining space next to number
    barWithNoteContainer: {
        flex: 1,
        // marginBottom: 8, // REMOVED to fix vertical centering
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
    // DELETE ACTION STYLES
    deleteAction: {
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        // Match the height/style of the row essentially.
        // But since we are inside Swipeable, we usually match height of children.
        // We will make it fill height.
        height: '100%',
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12, // match row radius if possible
    },
    deleteActionContent: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    deleteActionText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: '600',
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
        paddingTop: 18,
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
        paddingHorizontal: 18,
        paddingTop: 18,
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
