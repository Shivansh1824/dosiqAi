import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants';

interface AddReminderModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (time: string, mealLabel: string | null) => void;
}

/**
 * AddReminderModal - Specific modal to add a new reminder time
 * User picks a time and selects a meal relationship
 */
export default function AddReminderModal({ visible, onClose, onAdd }: AddReminderModalProps) {
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
        // On Android we don't close, we just update the state
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
        { label: 'With Food', value: 'With Food', icon: 'plus-circle' },
        { label: 'Empty Stomach', value: 'Empty Stomach', icon: 'circle' },
    ];

    // Dynamic context options based on time could be cool, but keeping it simple for now as requested
    // Maybe adding specific meals if needed?
    const TIME_SPECIFIC_OPTIONS = [
        { label: 'Before Breakfast', value: 'Before Breakfast' },
        { label: 'After Breakfast', value: 'After Breakfast' },
        { label: 'Before Lunch', value: 'Before Lunch' },
        { label: 'After Lunch', value: 'After Lunch' },
        { label: 'Before Dinner', value: 'Before Dinner' },
        { label: 'After Dinner', value: 'After Dinner' },
    ];

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
                        {/* Time Section */}
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
                                    <View style={styles.androidTimeButtonContainer}>
                                        <Text style={styles.androidTimeText}>
                                            {selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                        {/* Android usually requires a button to show the picker dialogue, 
                          but embedded is safer inside a custom modal UI flow. 
                          However, simplistic approach: simplified time display + optional edit button */}
                                        <TouchableOpacity
                                            style={styles.androidEditButton}
                                            onPress={() => {/* In a real app we'd show a separate picker here, but for now assuming iOS primary or simple Android flow */ }}
                                        >
                                            {/* Android picker handling is complex inside a modal, simplifying for this step */}
                                        </TouchableOpacity>
                                        <DateTimePicker
                                            value={selectedTime}
                                            mode="time"
                                            display="spinner"
                                            onChange={handleTimeChange}
                                        />
                                    </View>
                                )}
                            </View>
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

                            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>MEAL SPECIFIC</Text>
                            <View style={styles.optionsGrid}>
                                {TIME_SPECIFIC_OPTIONS.map((option) => (
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
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addButton} onPress={handleConfirm}>
                            <Feather name="plus" size={18} color={Colors.white} />
                            <Text style={styles.addButtonText}>Add Reminder</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
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
        fontWeight: '700',
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
        fontWeight: '700',
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
        fontWeight: '600',
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
        fontWeight: '500',
    },
    optionTextSelected: {
        color: Colors.primary,
        fontWeight: '600',
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
        fontWeight: '600',
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
        fontWeight: '600',
        color: Colors.white,
    },
});
