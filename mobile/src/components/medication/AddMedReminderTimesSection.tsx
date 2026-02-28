import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Platform, Modal, Dimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line, G, Circle } from 'react-native-svg';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Colors, Typography } from '../../constants';
import { getTimeOfDayCategory, normalizeTime } from '../../types/medicationSchedule';
import { cleanMedicationName } from '../../utils/medicationParser';
import { InfoModal } from '../InfoModal';

interface AddMedReminderTimesSectionProps {
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
    shouldAnimate?: boolean; // New prop to control animation
    inactiveReminderTimes?: string[];
    onDeleteCustomReminder?: (time: string) => void;
    isVerified?: boolean;
    preferredTimes?: {
        morning?: string;
        afternoon?: string;
        night?: string;
    };
    suppressDefaultBatches?: boolean;
    error?: string;
    onInfoPress?: () => void;
}

// --- Helpers ---

const formatTimeDisplay = (time: string) => {
    if (!time) return '';
    try {
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes);
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return time;
    }
};

const AnimatedNumber = ({ number, style }: { number: number | null, style?: any }) => {
    if (number === null) return null;
    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
        >
            <Text style={style}>{number}</Text>
        </Animated.View>
    );
};

export function AddMedReminderTimesSection({
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
    originalInterval,
    shouldAnimate = false,
    inactiveReminderTimes = [],
    onDeleteCustomReminder,
    isVerified = false,
    preferredTimes,
    suppressDefaultBatches = false,
    error,
    onInfoPress,
}: AddMedReminderTimesSectionProps) {
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

    // Track which batch is currently swiped open (for dynamic border radius)
    const [swipedOpenBatchId, setSwipedOpenBatchId] = useState<string | null>(null);

    const cleanName = cleanMedicationName(medicineName);

    // Initial Onboarding Animation - Trigger when visible
    useEffect(() => {
        if (!shouldAnimate || hasAnimated) return;

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
    }, [hasAnimated, shouldAnimate]);



    const handleDelete = (id: string, time: string) => {
        // If it's a preset (morning/afternoon/night/extra), we "hide" it by adding to deleted list
        // and ensuring it is toggled OFF.
        if (id === 'morning' || id === 'afternoon' || id === 'night' || id.startsWith('extra-')) {
            setDeletedBatchIds(prev => [...prev, id]);
            onBatchToggle?.(id, false, time);
        } else {
            // It's a custom time. If the new handler is provided, use it.
            if (onDeleteCustomReminder) {
                onDeleteCustomReminder(time);
            } else if (onUpdateReminderTimes) {
                // Fallback for backward compatibility
                const newTimes = reminderTimes.filter(t => t !== time);
                onUpdateReminderTimes(newTimes);
            }
        }
    };

    // Helper to render Grouped Batches
    const renderGroupedView = () => {
        const batches = [
            { id: 'morning', label: 'Morning Dose', icon: 'sunrise', defaultTime: preferredTimes?.morning ? normalizeTime(preferredTimes.morning) : undefined },
            { id: 'afternoon', label: 'Afternoon Dose', icon: 'sun', defaultTime: preferredTimes?.afternoon ? normalizeTime(preferredTimes.afternoon) : undefined },
            { id: 'night', label: 'Night Dose', icon: 'moon', defaultTime: preferredTimes?.night ? normalizeTime(preferredTimes.night) : undefined },
        ];

        let rows: any[] = [];

        if (suppressDefaultBatches) {
            // Manual Mode: Start empty, only render what is in reminderTimes (via Step 2)
            rows = [];
        } else if (totalTimesPerDay && totalTimesPerDay <= 3 && timingDosage) {
            const parts = timingDosage.split('-').map(Number);
            if (parts.length === 3) {
                // Standard 3-batch pattern: Morning-Afternoon-Night
                rows = batches.filter((_, index) => parts[index] > 0);
            } else if (parts.length === 4) {
                // Handle 4-part dosage by mapping to 3 batches (skip evening, index 2)
                // Map: [0]=morning, [1]=afternoon, [3]=night (evening at [2] is ignored)
                const mappedParts = [parts[0], parts[1], parts[3]];
                rows = batches.filter((_, index) => mappedParts[index] > 0);
            } else {
                rows = batches; // Fallback
            }
        } else if (totalTimesPerDay && totalTimesPerDay > 3) {
            rows = [...batches];
            const extrasNeeded = totalTimesPerDay - 3;
            for (let i = 0; i < extrasNeeded; i++) {
                const cycleIndex = i % 3; // 0, 1, 2 (Morning, Afternoon, Night)
                const offsetPass = Math.floor(i / 3) + 1; // 1, 1, 1, 2, 2, 2...
                const baseBatch = batches[cycleIndex];
                if (!baseBatch.defaultTime) continue; // Skip if base time is not defined

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

        // Filter out rows that don't have a valid time (from family settings)
        rows = rows.filter(r => r.defaultTime);

        // 2. Add extra rows for any active reminder times that aren't covered by the generated rows
        const coveredTimes = new Set(rows.map(r => normalizeTime(r.defaultTime)));

        // Create a combined list of all custom times (active + inactive) to ensure we render them
        // We use a Set to avoid duplicates if something is weirdly in both
        // We also want to preserve the order relative to active reminderTimes if possible, but simplest is to just collect all unique times
        const allCustomTimes = Array.from(new Set([...reminderTimes, ...inactiveReminderTimes]));

        // However, we want to maintain the sort order of reminderTimes generally.
        // Let's iterate the combined distinct times, sorting them to be nice.
        allCustomTimes.sort((a, b) => parseInt(a.replace(':', '')) - parseInt(b.replace(':', '')));

        allCustomTimes.forEach((time, index) => {
            const normalizedTime = normalizeTime(time);
            if (!coveredTimes.has(normalizedTime)) {

                // Check if this time matches a standard batch
                const standardBatch = batches.find(b => b.defaultTime && normalizeTime(b.defaultTime) === normalizedTime);

                if (standardBatch) {
                    rows.push({
                        ...standardBatch,
                        defaultTime: time // Keep the actual time string (including seconds if any)
                    });
                } else {
                    rows.push({
                        id: `custom-${normalizedTime.replace(':', '')}`, // Use time as stable ID part
                        label: 'Reminder',
                        icon: 'clock',
                        defaultTime: time
                    });
                }
                coveredTimes.add(normalizedTime);
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
        const rowTimes = rows.map(r => normalizeTime(r.defaultTime));
        const normalizedReminderTimes = reminderTimes.map(normalizeTime);
        const normalizedInactiveTimes = inactiveReminderTimes.map(normalizeTime);

        // Filter out times that are already active OR explicitly inactive
        const missingTimes = rowTimes.filter(t =>
            !normalizedReminderTimes.includes(t) && !normalizedInactiveTimes.includes(t)
        );

        if (missingTimes.length > 0) {
            if (onUpdateReminderTimes) {
                // Only add times that are NOT in inactiveReminderTimes
                const timesToAdd = rows
                    .map(r => r.defaultTime)
                    .filter(t => !normalizedInactiveTimes.includes(normalizeTime(t)));

                const newTimes = Array.from(new Set([...reminderTimes, ...timesToAdd]));
                newTimes.sort((a, b) => {
                    const ta = parseInt(normalizeTime(a).replace(':', ''));
                    const tb = parseInt(normalizeTime(b).replace(':', ''));
                    return ta - tb;
                });
                onUpdateReminderTimes(newTimes);
            } else {
                // Fallback
                missingTimes.forEach(time => {
                    const row = rows.find(r => normalizeTime(r.defaultTime) === time);
                    if (row) onBatchToggle?.(row.id, true, row.defaultTime);
                });
            }
        }
        // Removing reminderTimes from dependency array to prevent auto-re-enabling when user toggles off
    }, [totalTimesPerDay, timingDosage, preferredTimes]); // Added preferredTimes to trigger re-sync when preferences change

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






    // Verify and revive deleted batches if they are in reminderTimes
    useEffect(() => {
        const activeNormalizedTimes = reminderTimes.map(normalizeTime);
        const revivedBatches = deletedBatchIds.filter(id => {
            // Find the batch definition
            // Simple mapping for verification context
            let defaultTime: string | undefined;
            if (id === 'morning') defaultTime = preferredTimes?.morning || '08:00';
            else if (id === 'afternoon') defaultTime = preferredTimes?.afternoon || '14:00';
            else if (id === 'night') defaultTime = preferredTimes?.night || '21:00';
            // Note: Extras are harder to map back from ID alone without reconstructing rows, 
            // but for standard morning/afternoon/night causing the issue, this is sufficient.

            if (defaultTime && activeNormalizedTimes.includes(normalizeTime(defaultTime))) {
                return true;
            }
            return false;
        });

        if (revivedBatches.length > 0) {
            setDeletedBatchIds(prev => prev.filter(id => !revivedBatches.includes(id)));
        }
    }, [reminderTimes, preferredTimes, deletedBatchIds]);

    const rowsToRender = renderGroupedView();
    let activeCounter = 0; // Tracking active reminders for dynamic numbering

    return (
        <View style={styles.reminderBarsContainer}>
            {/* Section Header */}
            <View style={styles.reminderHeader}>
                <View style={styles.reminderHeaderLeft}>
                    <Feather name="bell" size={14} color={Colors.primary} />
                    <Text style={styles.reminderTitle}>DOSE SCHEDULE</Text>
                    <TouchableOpacity
                        onPress={onInfoPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Feather name="info" size={16} color={Colors.gray400} />
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <View style={{ marginBottom: 12, marginTop: -8 }}>
                    <Text style={{ color: Colors.error, fontSize: 12, ...Typography.fontWeights.medium }}>
                        {error}
                    </Text>
                </View>
            )}

            {/* Removed inline explanatoryText */}

            {/* Content Body */}
            <View style={styles.batchesContainer}>
                {rowsToRender.map((batch, index) => {
                    const normalizedBatchTime = normalizeTime(batch.defaultTime);
                    const isOn = reminderTimes.some(t => normalizeTime(t) === normalizedBatchTime);

                    if (deletedBatchIds.includes(batch.id)) {
                        return null;
                    }

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
                        // Check if this batch is currently swiped open
                        const isSwiped = swipedOpenBatchId === batch.id;
                        const swipedRightRadiusStyle = isSwiped ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {};

                        // ALWAYS use Modern Layout for Add Medicine Screen (Screenshot matching)
                        return (
                            <View style={styles.numberedRowContainer}>
                                {/* Dynamic Numbering Column */}
                                <View style={styles.numberColumn}>
                                    <AnimatedNumber number={numberToShow} style={styles.numberText} />
                                </View>

                                <View style={styles.barWithNoteContainer}>
                                    <View style={[styles.timeBarModern, swipedRightRadiusStyle]}>
                                        {/* Left: Clickable Time */}
                                        <TouchableOpacity
                                            onPress={() => handleTimeClick(batch.defaultTime)}
                                            style={styles.timeButton}
                                        >
                                            <Text style={styles.timeBarTimeLeft}>{formatTimeDisplay(batch.defaultTime)}</Text>
                                        </TouchableOpacity>

                                        {/* Right Group */}
                                        <View style={styles.timeBarRightGroup}>
                                            <Text style={styles.timeBarDoseLabel} numberOfLines={1}>{cleanName || 'Medicine'}</Text>

                                            <Switch
                                                value={isOn}
                                                onValueChange={(val) => onBatchToggle?.(batch.id, val, batch.defaultTime)}
                                                trackColor={{ false: Colors.gray200, true: '#10B981' }} // Vibrant Green from screenshot
                                                thumbColor={Colors.white}
                                                style={{ transform: [{ scaleX: 0.88 }, { scaleY: 0.85 }] }}
                                                disabled={isVerified}
                                            />

                                            <TouchableOpacity
                                                style={styles.noteIconButton}
                                                onPress={() => toggleNoteExpansion(batch.id)}
                                            >
                                                <MaterialCommunityIcons
                                                    name={(defaultNotes[batch.defaultTime] || '').length > 0 ? "note-text" : "note-text-outline"}
                                                    size={20}
                                                    color={(defaultNotes[batch.defaultTime] || '').length > 0 ? "#3B82F6" : Colors.gray400} // Blue tint for active note
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Creating Note Input */}
                                    {expandedNotes[batch.id] && (
                                        <View style={styles.noteSection}>
                                            <View style={styles.noteInputContainer}>
                                                <TouchableOpacity style={styles.noteInputIcon} disabled={isVerified}>
                                                    {!isVerified && <Feather name="edit-3" size={14} color={Colors.gray400} />}
                                                </TouchableOpacity>
                                                <TextInput
                                                    style={styles.noteInput}
                                                    value={defaultNotes[batch.defaultTime] || ''}
                                                    editable={!isVerified}
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
                        <Animated.View
                            key={batch.id}
                            ref={index === 0 ? firstItemRef : null}
                            collapsable={false} // Ensure measurement works on Android
                            layout={LinearTransition.duration(250)}
                            entering={FadeIn.duration(300)}
                            exiting={FadeOut.duration(200)}
                        >
                            <Swipeable
                                ref={swipeableRef}
                                renderRightActions={isVerified ? undefined : renderRightActions}
                                containerStyle={{ marginBottom: 8 }} // Margin moved here to exclude from swipe height
                                childrenContainerStyle={{}}
                                onSwipeableOpen={() => setSwipedOpenBatchId(batch.id)}
                                onSwipeableClose={() => setSwipedOpenBatchId(null)}
                            >
                                {renderRowContent()}
                            </Swipeable>
                        </Animated.View>
                    );
                })}

                {/* Always show Add Custom Time Button in Grouped View */}
                {onAddPress && !isVerified && (
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
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.semibold,
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
        paddingHorizontal: 20,
        marginTop: 24, // Increased spacing from Course Period
        marginBottom: 0,
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
        fontSize: 12,
        ...Typography.fontWeights.extrabold,
        color: Colors.gray500,
        letterSpacing: 1,
    },
    explanatoryText: {
        fontSize: 12,
        color: Colors.gray600,
        // marginTop: -8, // REMOVED to match Course Period spacing (12px)
        marginBottom: 18,
        lineHeight: 17,
        ...Typography.fontWeights.medium,
    },
    boldText: {
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.medium,
        color: Colors.gray500,
    },
    modeButtonTextActive: {
        color: Colors.primary,
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.extrabold,
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
        // The Row itself has margin bottom to separate from next row.
        // This is correct.
    },
    // Updated container to flex: 1 to fill remaining space next to number
    barWithNoteContainer: {
        flex: 1,
        // marginBottom: 8, // REMOVED to fix vertical
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
        ...Typography.fontWeights.semibold,
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
        ...Typography.fontWeights.semibold,
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
        ...Typography.fontWeights.semibold,
        color: '#059669',
    },
    timeBarsWrapper: {
        gap: 10,
    },
    timeBarModern: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EFF6FF', // Solid Light Blue
        borderRadius: 16,
        height: 52,
        paddingLeft: 16,
        paddingRight: 8,
        overflow: 'hidden',
        // borderWidth: 1, // Removed border for cleaner look
        // borderColor: 'transparent',
    },
    timeBarTimeLeft: {
        fontSize: 15,
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.bold,
        color: Colors.gray600,
        maxWidth: 90,
    },
    timeBarFoodRelation: {
        fontSize: 9,
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.medium,
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
        paddingVertical: 14,
        borderRadius: 30, // Pill Shape
        backgroundColor: Colors.primary + '08', // Very subtle fill
        borderWidth: 1,
        borderColor: Colors.primary + '30', // Soft solid border
        // borderStyle: 'dashed', // Removed
    },
    addTimeCleanText: {
        fontSize: 13,
        ...Typography.fontWeights.semibold,
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
        ...Typography.fontWeights.bold,
        fontSize: 16,
    },
});
