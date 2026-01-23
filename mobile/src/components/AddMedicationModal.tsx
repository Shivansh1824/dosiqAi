import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { MedicineType, generateCyclicReminderTimes } from '../types/medicationSchedule';
import { useMedicationsStore } from '../store/medicationsStore';
import { MedicationIcon, ICON_THEMES } from './medication/MedicationIcons';
import { useAuthStore } from '../store/authStore';

interface AddMedicationModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (medication: any) => void;
}

export default function AddMedicationModal({ visible, onClose, onSave }: AddMedicationModalProps) {
    const { user } = useAuthStore();
    const { getActiveMedications } = useMedicationsStore();
    
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [selectedType, setSelectedType] = useState<MedicineType>('tablet');
    const [intervalDays, setIntervalDays] = useState('1');
    const [timesPerDay, setTimesPerDay] = useState('1');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Filter active medications for suggestions
    const activeMeds = useMemo(() => getActiveMedications(), [visible]);

    const filteredSuggestions = useMemo(() => {
        if (!name || !showSuggestions) return [];
        return activeMeds.filter(med => 
            med.name.toLowerCase().includes(name.toLowerCase())
        ).slice(0, 5);
    }, [name, activeMeds, showSuggestions]);

    const handleSelectSuggestion = (med: any) => {
        setName(med.name);
        setDosage(med.dosage || '');
        setSelectedType((med.form?.toLowerCase() as MedicineType) || 'tablet');
        setIntervalDays(med.interval_days?.toString() || '1');
        setTimesPerDay(med.times_per_day?.toString() || '1');
        setShowSuggestions(false);
    };

    const frequencyLabel = useMemo(() => {
        const interval = parseInt(intervalDays) || 1;
        const times = parseInt(timesPerDay) || 1;

        if (interval === 1) {
            if (times === 1) return 'Once Daily';
            if (times === 2) return 'Twice Daily';
            return `${times} Times Daily`;
        }
        if (interval === 7) return 'Weekly';
        if (interval === 30) return 'Monthly';
        return `Every ${interval} days, ${times} times a day`;
    }, [intervalDays, timesPerDay]);

    const handleSave = () => {
        if (!name || !dosage) {
            alert('Please fill in all required fields');
            return;
        }

        const interval = parseInt(intervalDays) || 1;
        const times = parseInt(timesPerDay) || 1;

        const medication = {
            user_id: user?.id,
            name,
            dosage,
            type: selectedType,
            interval_days: interval,
            times_per_day: times,
            time_of_day: generateCyclicReminderTimes(times),
            frequency: frequencyLabel.toLowerCase().replace(/ /g, '_'),
            start_date: new Date().toISOString().split('T')[0],
            instructions: 'after_meal',
            reminder_enabled: true,
            is_active: true,
            family_member_id: user?.id, // Default to user themselves for now
        };

        onSave(medication);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setName('');
        setDosage('');
        setSelectedType('tablet');
        setIntervalDays('1');
        setTimesPerDay('1');
        setShowSuggestions(false);
    };

    useEffect(() => {
        if (!visible) resetForm();
    }, [visible]);

    const availableTypes = Object.keys(ICON_THEMES).filter(t => t !== 'default');

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Medication</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.content} 
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Medicine Name */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Medicine Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Amoxicillin"
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                            />
                            {showSuggestions && filteredSuggestions.length > 0 && (
                                <View style={styles.suggestionsContainer}>
                                    {filteredSuggestions.map((med) => (
                                        <TouchableOpacity
                                            key={med.id}
                                            style={styles.suggestionItem}
                                            onPress={() => handleSelectSuggestion(med)}
                                        >
                                            <MedicationIcon form={med.form || null} size={16} />
                                            <View style={styles.suggestionTextContainer}>
                                                <Text style={styles.suggestionName}>{med.name}</Text>
                                                <Text style={styles.suggestionDetails}>{med.dosage}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Dosage */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Dosage *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 500mg - 1 Tablet"
                                value={dosage}
                                onChangeText={setDosage}
                            />
                        </View>

                        {/* Medicine Type Horizontal Scroll */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Type</Text>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.typeScrollContent}
                            >
                                {availableTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.typeCard,
                                            selectedType === type && styles.typeCardSelected,
                                        ]}
                                        onPress={() => setSelectedType(type as MedicineType)}
                                    >
                                        <MedicationIcon form={type} size={24} />
                                        <Text
                                            style={[
                                                styles.typeCardLabel,
                                                selectedType === type && styles.typeCardLabelSelected,
                                            ]}
                                        >
                                            {type.charAt(0) ? type.charAt(0).toUpperCase() + type.slice(1) : type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Scheduling Grid */}
                        <View style={styles.row}>
                            <View style={[styles.section, { flex: 1, marginRight: Sizes.sm }]}>
                                <Text style={styles.label}>Interval (Days)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={intervalDays}
                                    onChangeText={setIntervalDays}
                                    placeholder="1"
                                />
                            </View>
                            <View style={[styles.section, { flex: 1, marginLeft: Sizes.sm }]}>
                                <Text style={styles.label}>Times per Day</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={timesPerDay}
                                    onChangeText={setTimesPerDay}
                                    placeholder="1"
                                />
                            </View>
                        </View>

                        {/* Frequency Preview */}
                        <View style={styles.frequencyPreview}>
                            <Feather name="clock" size={16} color={Colors.primary} />
                            <Text style={styles.frequencyPreviewText}>
                                {frequencyLabel}
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Add Medication</Text>
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
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '85%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 20,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.xl,
        paddingTop: Sizes.xl,
        paddingBottom: Sizes.md,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.gray100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: Sizes.xl,
    },
    section: {
        marginBottom: Sizes.lg,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Sizes.xs,
        marginLeft: 4,
    },
    input: {
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        padding: Sizes.md,
        fontSize: 16,
        color: Colors.textPrimary,
        borderWidth: 1.5,
        borderColor: Colors.gray100,
    },
    typeScrollContent: {
        paddingVertical: Sizes.sm,
        gap: Sizes.md,
    },
    typeCard: {
        width: 80,
        height: 100,
        backgroundColor: Colors.white,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.gray100,
        marginRight: Sizes.sm,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    typeCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '05',
    },
    typeCardLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: Sizes.xs,
        fontWeight: '500',
    },
    typeCardLabelSelected: {
        color: Colors.primary,
        fontWeight: '700',
    },
    suggestionsContainer: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        marginTop: Sizes.xs,
        borderWidth: 1,
        borderColor: Colors.gray200,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    suggestionTextContainer: {
        marginLeft: Sizes.sm,
        flex: 1,
    },
    suggestionName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    suggestionDetails: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    frequencyPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        padding: Sizes.md,
        borderRadius: 12,
        marginBottom: Sizes.xl,
        gap: 8,
    },
    frequencyPreviewText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
    footer: {
        padding: Sizes.xl,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 18,
        padding: Sizes.lg,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.white,
    },
});
