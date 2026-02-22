import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, Typography } from '../../constants';
import { AndroidTimePicker } from './AndroidTimePicker';
import { getTimeOfDayCategory } from '../../types/medicationSchedule';
import { useMedicationsStore } from '../../store/medicationsStore';

interface AddReminderModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (time: string, mealLabel: string | null) => void;
    existingTimes?: string[];
    preferredTimes?: {
        morning?: string;
        afternoon?: string;
        night?: string;
    };
    timingDosage?: string;
    initialMealLabel?: string | null;
}

/**
 * AddReminderModal - Specific modal to add a new reminder time
 * User picks a time and selects a meal relationship
 */
export default function AddReminderModal({
    visible,
    onClose,
    onAdd,
    existingTimes = [],
    preferredTimes,
    timingDosage,
    initialMealLabel
}: AddReminderModalProps) {
    const [selectedTime, setSelectedTime] = useState(new Date());
    const [selectedLabel, setSelectedLabel] = useState<string | null>(initialMealLabel || null);
    const [suggestion, setSuggestion] = useState<{ time: string, matchingMedName: string } | null>(null);

    const medications = useMedicationsStore(state => state.medications);
    const getActiveMedications = useMedicationsStore(state => state.getActiveMedications);

    // Animation for suggestion entrance
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        if (suggestion) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(10);
        }
    }, [suggestion]);

    // Reset state to the top of the next hour when modal opens
    useEffect(() => {
        if (visible) {
            const now = new Date();
            // Round up to the next hour (e.g., 11:15 becomes 12:00)
            now.setHours(now.getHours() + 1);
            now.setMinutes(0);
            now.setSeconds(0);
            now.setMilliseconds(0);

            setSelectedTime(now);
            setSelectedLabel(initialMealLabel || null);
        }
    }, [visible, initialMealLabel]);

    const handleTimeChange = (event: DateTimePickerEvent, date?: Date) => {
        // Defensive: Ignore 1970 dates (iOS bug/glitch)
        if (date && date.getFullYear() > 2000) {
            setSelectedTime(date);
        }
    };

    // ... 

    // Calculate suggestion based on other active medications
    useEffect(() => {
        if (!visible) return;

        // Defer calculation to allow the modal to open smoothly first
        const timer = setTimeout(() => {
            // Dosiq AI Logic: Consider active medications AND those finished in the last 14 days
            // AI should "remember" your usual schedule slots even if a specific course just ended
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const fourteenDaysAgo = new Date(today);
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const relevantMedications = medications.filter(med => {
                if (!med.end_date) return true;
                const endDate = new Date(med.end_date);
                endDate.setHours(0, 0, 0, 0);
                return endDate >= fourteenDaysAgo;
            });

            let bestSuggestion: { time: string, matchingMedName: string, diff: number } | null = null;

            const currentHours = selectedTime.getHours();
            const currentMinutes = selectedTime.getMinutes();
            const currentTotalMinutes = currentHours * 60 + currentMinutes;

            for (const med of relevantMedications) {
                if (!med.time_of_day) continue;

                for (const timeStr of med.time_of_day) {
                    const [h, m] = timeStr.split(':').map(Number);
                    const targetTotalMinutes = h * 60 + m;

                    let diff = Math.abs(currentTotalMinutes - targetTotalMinutes);
                    if (diff > 720) diff = 1440 - diff;

                    // Only suggest if it's a DIFFERENT time (diff > 0) or if it's the exact same time but not flagged as duplicate yet
                    if (diff > 0 && diff <= 30) {
                        if (!bestSuggestion || diff < bestSuggestion.diff) {
                            bestSuggestion = {
                                time: timeStr,
                                matchingMedName: med.name,
                                diff: diff
                            };
                        }
                    }
                }
            }

            if (bestSuggestion) {
                setSuggestion({
                    time: bestSuggestion.time,
                    matchingMedName: bestSuggestion.matchingMedName
                });
            } else {
                setSuggestion(null);
            }
        }, 300); // 300ms delay after modal appears or time changes

        return () => clearTimeout(timer);
    }, [selectedTime, medications, visible, getActiveMedications]);

    const handleApplySuggestion = () => {
        if (!suggestion) return;
        const [h, m] = suggestion.time.split(':').map(Number);
        const newDate = new Date(selectedTime);
        newDate.setHours(h);
        newDate.setMinutes(m);
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
        setSelectedTime(newDate);
        setSuggestion(null);
    };

    const handleConfirm = () => {
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        onAdd(timeString, selectedLabel || "");
        onClose();
    };

    // Static options moved out or memoized
    const MEAL_OPTIONS = [
        { label: 'Meal Independent', value: null, icon: 'slash' },
        { label: 'Before Meal', value: 'Before Meal', icon: 'chevron-left' },
        { label: 'After Meal', value: 'After Meal', icon: 'chevron-right' },
        { label: 'Empty Stomach', value: 'Empty Stomach', icon: 'circle' },
    ];

    const DOSE_GROUPS = [
        { id: 'morning', label: 'Morning Dose', icon: 'sunrise', defaultTime: preferredTimes?.morning || '08:00' },
        { id: 'afternoon', label: 'Afternoon Dose', icon: 'sun', defaultTime: preferredTimes?.afternoon || '14:00' },
        { id: 'night', label: 'Night Dose', icon: 'moon', defaultTime: preferredTimes?.night || '21:00' },
    ];

    const availableGroups = DOSE_GROUPS.filter(group => {
        if (!group.defaultTime) return false;
        const groupCategory = getTimeOfDayCategory(group.defaultTime);
        if (!groupCategory) return false;

        const hasExistingInCategory = existingTimes.some(time => {
            const cat = getTimeOfDayCategory(time);
            return cat === groupCategory;
        });

        return !hasExistingInCategory;
    });

    const handleGroupSelect = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const newDate = new Date();
        newDate.setHours(hours);
        newDate.setMinutes(minutes);
        newDate.setSeconds(0);
        setSelectedTime(newDate);
    };

    // Check for duplicate time
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    const isDuplicate = existingTimes.includes(timeString);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Reminder</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={20} color={Colors.gray500} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollArea} bounces={false}>
                        <View style={styles.content}>
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>TIME</Text>
                                <View style={styles.timePickerContainer}>
                                    {Platform.OS === 'ios' ? (
                                        <DateTimePicker
                                            value={selectedTime}
                                            mode="time"
                                            display="spinner"
                                            onChange={handleTimeChange}
                                            style={{ height: 120, width: '100%' }}
                                            textColor={Colors.gray900}
                                            minimumDate={new Date(2000, 0, 1)}
                                        />
                                    ) : (
                                        <View style={{ paddingVertical: 10 }}>
                                            <AndroidTimePicker
                                                value={selectedTime}
                                                onChange={(date) => setSelectedTime(date)}
                                            />
                                        </View>
                                    )}
                                </View>
                                {isDuplicate && (
                                    <View style={styles.errorContainer}>
                                        <Feather name="alert-circle" size={14} color={Colors.error} />
                                        <Text style={styles.errorText}>This time is already set for this medicine</Text>
                                    </View>
                                )}

                                {suggestion && !isDuplicate && (
                                    <Animated.View style={{
                                        opacity: fadeAnim,
                                        transform: [{ translateY: slideAnim }]
                                    }}>
                                        <TouchableOpacity
                                            activeOpacity={0.9}
                                            onPress={handleApplySuggestion}
                                        >
                                            <LinearGradient
                                                colors={['#F0F7FF', '#FFFFFF']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.suggestionContainer}
                                            >
                                                <View style={styles.aiIconWrapper}>
                                                    <Image
                                                        source={require('../../../assets/ai-icon.png')}
                                                        style={styles.aiIcon}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <View style={styles.suggestionHeader}>
                                                        <Text style={styles.aiBadgeText}>DOSIQ AI SUGGESTION</Text>
                                                    </View>
                                                    <Text style={styles.suggestionTitle}>
                                                        Suggested: {suggestion.time}
                                                    </Text>
                                                    <Text style={styles.suggestionSubtitle}>
                                                        Matches {suggestion.matchingMedName} schedule
                                                    </Text>
                                                </View>
                                                <View style={styles.applyButton}>
                                                    <Feather name="check" size={14} color={Colors.white} />
                                                </View>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </View>

                            {/* Meal Relation Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>RELATION TO MEAL</Text>
                                <View style={styles.optionsGrid}>
                                    {MEAL_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.label}
                                            style={[
                                                styles.optionChip,
                                                selectedLabel === option.value && styles.optionChipSelected
                                            ]}
                                            onPress={() => setSelectedLabel(option.value)}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                selectedLabel === option.value && styles.optionTextSelected
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                            </View>

                            {/* Dose Group Section */}
                            {availableGroups.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>DOSE GROUP</Text>
                                    <View style={styles.optionsGrid}>
                                        {availableGroups.map((group) => (
                                            <TouchableOpacity
                                                key={group.id}
                                                style={[
                                                    styles.optionChip,
                                                    selectedTime.getHours() === parseInt(group.defaultTime!.split(':')[0]) &&
                                                    selectedTime.getMinutes() === parseInt(group.defaultTime!.split(':')[1]) &&
                                                    styles.optionChipSelected
                                                ]}
                                                onPress={() => handleGroupSelect(group.defaultTime!)}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Feather
                                                        name={group.icon as any}
                                                        size={14}
                                                        color={
                                                            selectedTime.getHours() === parseInt(group.defaultTime!.split(':')[0]) &&
                                                                selectedTime.getMinutes() === parseInt(group.defaultTime!.split(':')[1])
                                                                ? Colors.primary
                                                                : Colors.gray500
                                                        }
                                                    />
                                                    <Text style={[
                                                        styles.optionText,
                                                        selectedTime.getHours() === parseInt(group.defaultTime!.split(':')[0]) &&
                                                        selectedTime.getMinutes() === parseInt(group.defaultTime!.split(':')[1]) &&
                                                        styles.optionTextSelected
                                                    ]}>
                                                        {group.label}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                isDuplicate && styles.addButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={isDuplicate}
                        >
                            <Feather name="plus" size={18} color={isDuplicate ? Colors.gray400 : Colors.white} />
                            <Text style={[
                                styles.addButtonText,
                                isDuplicate && styles.addButtonTextDisabled
                            ]}>Add Reminder</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View >
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        width: '100%',
        maxHeight: '85%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    title: {
        fontSize: 18,
        ...Typography.fontWeights.bold,
        color: Colors.gray900,
    },
    closeButton: {
        padding: 4,
    },
    scrollArea: {
        flexShrink: 1,
    },
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        ...Typography.fontWeights.bold,
        color: Colors.gray500,
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    timePickerContainer: {
        alignItems: 'center',
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        overflow: 'hidden',
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.gray200,
        backgroundColor: Colors.white,
    },
    optionChipSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: Colors.primary,
    },
    optionText: {
        fontSize: 13,
        color: Colors.gray600,
        ...Typography.fontWeights.medium,
    },
    optionTextSelected: {
        color: Colors.primary,
        ...Typography.fontWeights.semibold,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    cancelButtonText: {
        fontSize: 15,
        ...Typography.fontWeights.semibold,
        color: Colors.gray600,
    },
    addButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        gap: 8,
    },
    addButtonText: {
        fontSize: 15,
        ...Typography.fontWeights.semibold,
        color: Colors.white,
    },
    addButtonDisabled: {
        backgroundColor: Colors.gray200,
    },
    addButtonTextDisabled: {
        color: Colors.gray400,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        alignSelf: 'center',
    },
    errorText: {
        fontSize: 13,
        color: Colors.error,
        ...Typography.fontWeights.medium,
    },
    suggestionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        gap: 12,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    aiIconWrapper: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiIcon: {
        width: 24,
        height: 24,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    aiBadgeText: {
        fontSize: 9,
        ...Typography.fontWeights.bold,
        color: Colors.primary,
        letterSpacing: 1,
        backgroundColor: '#EBF5FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    suggestionTitle: {
        fontSize: 15,
        color: Colors.gray900,
        ...Typography.fontWeights.bold,
    },
    suggestionSubtitle: {
        fontSize: 12,
        color: Colors.gray500,
        marginTop: 1,
    },
    applyButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
