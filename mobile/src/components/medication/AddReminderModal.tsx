import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography } from '../../constants';
import { AndroidTimePicker } from './AndroidTimePicker';

interface AddReminderModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (time: string, mealLabel: string | null) => void;
    existingTimes?: string[];
}

/**
 * AddReminderModal - Specific modal to add a new reminder time
 * User picks a time and selects a meal relationship
 */
export default function AddReminderModal({ visible, onClose, onAdd, existingTimes = [] }: AddReminderModalProps) {
    const [selectedTime, setSelectedTime] = useState(new Date());
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            const now = new Date();
            // Round to next hour for convenience
            now.setMinutes(0);
            now.setHours(now.getHours() + 1);
            setSelectedTime(now);
            setSelectedLabel(null); // Default to Not Specified
        }
    }, [visible]);

    const handleTimeChange = (event: any, date?: Date) => {
        if (date) {
            setSelectedTime(date);
        }
    };

    const handleConfirm = () => {
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        // Pass null if "Not Specified" logic is desired, but our implementation plan said:
        // "Not Specified" -> store empty string to suppress global.
        // However, the `onAdd` signature here expects string | null.
        // Let's refine: The parent should decide how to store. 
        // Here we pass 'Not Specified' as a distinct value OR null.
        // Let's standardize: 
        // - Specific Label -> string
        // - Not Specified -> "" (empty string) to indicate "suppress" or "nothing"

        onAdd(timeString, selectedLabel || "");
        onClose();
    };

    const MEAL_OPTIONS = [
        { label: 'Not Specified', value: null, icon: 'slash' },
        { label: 'Before Meal', value: 'Before Meal', icon: 'chevron-left' },
        { label: 'After Meal', value: 'After Meal', icon: 'chevron-right' },
        { label: 'Empty Stomach', value: 'Empty Stomach', icon: 'circle' },
    ];

    // Dynamic context options based on time could be cool, but keeping it simple for now as requested
    // Maybe adding specific meals if needed?
    const DOSE_GROUPS = [
        { id: 'morning', label: 'Morning Dose', icon: 'sunrise', defaultTime: '08:00' },
        { id: 'afternoon', label: 'Afternoon Dose', icon: 'sun', defaultTime: '14:00' },
        { id: 'night', label: 'Night Dose', icon: 'moon', defaultTime: '21:00' },
    ];

    // Filter out groups that are already in existingTimes
    const availableGroups = DOSE_GROUPS.filter(group => !existingTimes.includes(group.defaultTime));

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
            animationType="fade"
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

                    <ScrollView style={styles.content}>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>TIME</Text>
                            <View style={styles.timePickerContainer}>
                                {Platform.OS === 'ios' ? (
                                    <DateTimePicker
                                        value={selectedTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={handleTimeChange}
                                        style={{ height: 120 }}
                                        textColor={Colors.gray900}
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
                                    <Text style={styles.errorText}>Reminder already exists for this time</Text>
                                </View>
                            )}
                        </View>

                        {/* Meal Relation Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>WHEN TO TAKE</Text>
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
                                                selectedTime.getHours() === parseInt(group.defaultTime.split(':')[0]) &&
                                                selectedTime.getMinutes() === parseInt(group.defaultTime.split(':')[1]) &&
                                                styles.optionChipSelected
                                            ]}
                                            onPress={() => handleGroupSelect(group.defaultTime)}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Feather
                                                    name={group.icon as any}
                                                    size={14}
                                                    color={
                                                        selectedTime.getHours() === parseInt(group.defaultTime.split(':')[0]) &&
                                                            selectedTime.getMinutes() === parseInt(group.defaultTime.split(':')[1])
                                                            ? Colors.primary
                                                            : Colors.gray500
                                                    }
                                                />
                                                <Text style={[
                                                    styles.optionText,
                                                    selectedTime.getHours() === parseInt(group.defaultTime.split(':')[0]) &&
                                                    selectedTime.getMinutes() === parseInt(group.defaultTime.split(':')[1]) &&
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
    androidTimeButtonContainer: {
        padding: 20,
        alignItems: 'center',
    },
    androidTimeText: {
        fontSize: 24,
        ...Typography.fontWeights.semibold,
        color: Colors.primary,
    },
    androidEditButton: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0
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
        justifyContent: 'center', // Center it
        gap: 6,
        marginTop: 12, // More space
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#FEF2F2', // Light red bg
        borderRadius: 12,
        alignSelf: 'center', // Center in parent
    },
    errorText: {
        fontSize: 13,
        color: Colors.error,
        ...Typography.fontWeights.medium,
    },
});
