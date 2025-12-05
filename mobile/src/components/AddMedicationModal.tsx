import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { MedicineType } from '../types/medicationSchedule';

interface AddMedicationModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (medication: any) => void;
}

export default function AddMedicationModal({ visible, onClose, onSave }: AddMedicationModalProps) {
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [selectedType, setSelectedType] = useState<MedicineType>('tablet');
    const [frequency, setFrequency] = useState('once_daily');

    const medicineTypes: { type: MedicineType; icon: string; label: string }[] = [
        { type: 'tablet', icon: 'circle', label: 'Tablet' },
        { type: 'capsule', icon: 'circle', label: 'Capsule' },
        { type: 'syrup', icon: 'droplet', label: 'Syrup' },
        { type: 'injection', icon: 'activity', label: 'Injection' },
    ];

    const frequencies = [
        { value: 'once_daily', label: 'Once Daily' },
        { value: 'twice_daily', label: 'Twice Daily' },
        { value: 'three_times_daily', label: '3 Times Daily' },
    ];

    const handleSave = () => {
        // Basic validation
        if (!name || !dosage) {
            alert('Please fill in all required fields');
            return;
        }

        // Create medication object
        const medication = {
            name,
            dosage,
            type: selectedType,
            frequency,
            times: frequency === 'once_daily' ? ['08:00'] : frequency === 'twice_daily' ? ['08:00', '20:00'] : ['08:00', '14:00', '20:00'],
            start_date: new Date().toISOString().split('T')[0],
            instructions: 'after_meal',
            reminder_enabled: true,
            is_active: true,
        };

        onSave(medication);

        // Reset form
        setName('');
        setDosage('');
        setSelectedType('tablet');
        setFrequency('once_daily');

        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Medication</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Medicine Name */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Medicine Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Amoxicillin"
                                value={name}
                                onChangeText={setName}
                            />
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

                        {/* Medicine Type */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Type</Text>
                            <View style={styles.typeGrid}>
                                {medicineTypes.map((item) => (
                                    <TouchableOpacity
                                        key={item.type}
                                        style={[
                                            styles.typeButton,
                                            selectedType === item.type && styles.typeButtonSelected,
                                        ]}
                                        onPress={() => setSelectedType(item.type)}
                                    >
                                        <Feather
                                            name={item.icon as any}
                                            size={24}
                                            color={selectedType === item.type ? Colors.primary : Colors.gray400}
                                        />
                                        <Text
                                            style={[
                                                styles.typeLabel,
                                                selectedType === item.type && styles.typeLabelSelected,
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Frequency */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Frequency</Text>
                            {frequencies.map((item) => (
                                <TouchableOpacity
                                    key={item.value}
                                    style={[
                                        styles.frequencyButton,
                                        frequency === item.value && styles.frequencyButtonSelected,
                                    ]}
                                    onPress={() => setFrequency(item.value)}
                                >
                                    <Text
                                        style={[
                                            styles.frequencyLabel,
                                            frequency === item.value && styles.frequencyLabelSelected,
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                    {frequency === item.value && (
                                        <Feather name="check" size={20} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Save Button */}
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
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Sizes.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: Sizes.lg,
    },
    section: {
        marginBottom: Sizes.xl,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Sizes.sm,
    },
    input: {
        backgroundColor: Colors.gray50,
        borderRadius: 12,
        padding: Sizes.md,
        fontSize: 16,
        color: Colors.textPrimary,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Sizes.sm,
    },
    typeButton: {
        width: '48%',
        backgroundColor: Colors.gray50,
        borderRadius: 12,
        padding: Sizes.md,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeButtonSelected: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
    },
    typeLabel: {
        fontSize: 13,
        color: Colors.gray600,
        marginTop: 6,
        fontWeight: '500',
    },
    typeLabelSelected: {
        color: Colors.primary,
        fontWeight: '600',
    },
    frequencyButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.gray50,
        borderRadius: 12,
        padding: Sizes.md,
        marginBottom: Sizes.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    frequencyButtonSelected: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
    },
    frequencyLabel: {
        fontSize: 15,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    frequencyLabelSelected: {
        color: Colors.primary,
        fontWeight: '600',
    },
    footer: {
        padding: Sizes.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        padding: Sizes.md,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
});
