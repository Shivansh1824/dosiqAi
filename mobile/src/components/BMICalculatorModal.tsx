import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';

interface BMICalculatorModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (bmi: number, weight: number, height: number, weightUnit: string, heightUnit: string) => void;
    currentBMI?: number;
}

export default function BMICalculatorModal({ visible, onClose, onSave, currentBMI }: BMICalculatorModalProps) {
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [heightFeet, setHeightFeet] = useState('');
    const [heightInches, setHeightInches] = useState('');
    const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
    const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
    const [calculatedBMI, setCalculatedBMI] = useState<number | null>(currentBMI || null);

    const calculateBMI = () => {
        let weightKg = 0;
        let heightCm = 0;

        // Convert weight to kg
        if (weightUnit === 'kg') {
            weightKg = parseFloat(weight);
        } else {
            weightKg = parseFloat(weight) * 0.453592; // lbs to kg
        }

        // Convert height to cm
        if (heightUnit === 'cm') {
            heightCm = parseFloat(height);
        } else {
            const feet = parseFloat(heightFeet) || 0;
            const inches = parseFloat(heightInches) || 0;
            heightCm = (feet * 30.48) + (inches * 2.54); // ft+in to cm
        }

        // Validate inputs
        if (isNaN(weightKg) || isNaN(heightCm) || weightKg <= 0 || heightCm <= 0) {
            alert('Please enter valid weight and height values');
            return;
        }

        // Calculate BMI: weight(kg) / (height(m))^2
        const heightM = heightCm / 100;
        const bmi = weightKg / (heightM * heightM);
        const roundedBMI = Math.round(bmi * 10) / 10;

        setCalculatedBMI(roundedBMI);
    };

    const getBMICategory = (bmi: number): { category: string; color: string } => {
        if (bmi < 18.5) {
            return { category: 'Underweight', color: '#3B82F6' };
        } else if (bmi < 25) {
            return { category: 'Normal', color: '#10B981' };
        } else if (bmi < 30) {
            return { category: 'Overweight', color: '#F59E0B' };
        } else {
            return { category: 'Obese', color: '#EF4444' };
        }
    };

    const handleSave = () => {
        if (calculatedBMI) {
            onSave(calculatedBMI, parseFloat(weight), parseFloat(height), weightUnit, heightUnit);
            handleClose();
        }
    };

    const handleClose = () => {
        setWeight('');
        setHeight('');
        setHeightFeet('');
        setHeightInches('');
        setCalculatedBMI(null);
        onClose();
    };

    const bmiInfo = calculatedBMI ? getBMICategory(calculatedBMI) : null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {calculatedBMI ? `BMI: ${calculatedBMI}` : 'BMI Calculator'}
                        </Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Weight Input */}
                        <View style={styles.inputSection}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Weight</Text>
                                <View style={styles.unitToggle}>
                                    <TouchableOpacity
                                        style={[styles.unitButton, weightUnit === 'kg' && styles.unitButtonActive]}
                                        onPress={() => setWeightUnit('kg')}
                                    >
                                        <Text style={[styles.unitText, weightUnit === 'kg' && styles.unitTextActive]}>kg</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.unitButton, weightUnit === 'lbs' && styles.unitButtonActive]}
                                        onPress={() => setWeightUnit('lbs')}
                                    >
                                        <Text style={[styles.unitText, weightUnit === 'lbs' && styles.unitTextActive]}>lbs</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder={`Enter weight in ${weightUnit}`}
                                keyboardType="decimal-pad"
                                value={weight}
                                onChangeText={setWeight}
                            />
                        </View>

                        {/* Height Input */}
                        <View style={styles.inputSection}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Height</Text>
                                <View style={styles.unitToggle}>
                                    <TouchableOpacity
                                        style={[styles.unitButton, heightUnit === 'cm' && styles.unitButtonActive]}
                                        onPress={() => setHeightUnit('cm')}
                                    >
                                        <Text style={[styles.unitText, heightUnit === 'cm' && styles.unitTextActive]}>cm</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.unitButton, heightUnit === 'ft' && styles.unitButtonActive]}
                                        onPress={() => setHeightUnit('ft')}
                                    >
                                        <Text style={[styles.unitText, heightUnit === 'ft' && styles.unitTextActive]}>ft/in</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {heightUnit === 'cm' ? (
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter height in cm"
                                    keyboardType="decimal-pad"
                                    value={height}
                                    onChangeText={setHeight}
                                />
                            ) : (
                                <View style={styles.heightRow}>
                                    <TextInput
                                        style={[styles.input, styles.heightInput]}
                                        placeholder="Feet"
                                        keyboardType="number-pad"
                                        value={heightFeet}
                                        onChangeText={setHeightFeet}
                                    />
                                    <TextInput
                                        style={[styles.input, styles.heightInput]}
                                        placeholder="Inches"
                                        keyboardType="number-pad"
                                        value={heightInches}
                                        onChangeText={setHeightInches}
                                    />
                                </View>
                            )}
                        </View>

                        {/* Calculate Button */}
                        <TouchableOpacity style={styles.calculateButton} onPress={calculateBMI}>
                            <Text style={styles.calculateButtonText}>Calculate BMI</Text>
                        </TouchableOpacity>

                        {/* BMI Result */}
                        {calculatedBMI && bmiInfo && (
                            <View style={[styles.resultCard, { borderLeftColor: bmiInfo.color }]}>
                                <View style={styles.resultHeader}>
                                    <MaterialCommunityIcons name="scale-bathroom" size={32} color={bmiInfo.color} />
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultBMI}>{calculatedBMI}</Text>
                                        <Text style={[styles.resultCategory, { color: bmiInfo.color }]}>
                                            {bmiInfo.category}
                                        </Text>
                                    </View>
                                </View>

                                {/* BMI Scale */}
                                <View style={styles.bmiScale}>
                                    <View style={styles.scaleBar}>
                                        <View style={[styles.scaleSegment, { backgroundColor: '#3B82F6', flex: 18.5 }]} />
                                        <View style={[styles.scaleSegment, { backgroundColor: '#10B981', flex: 6.5 }]} />
                                        <View style={[styles.scaleSegment, { backgroundColor: '#F59E0B', flex: 5 }]} />
                                        <View style={[styles.scaleSegment, { backgroundColor: '#EF4444', flex: 10 }]} />
                                    </View>
                                    <View style={styles.scaleLabels}>
                                        <Text style={styles.scaleLabel}>18.5</Text>
                                        <Text style={styles.scaleLabel}>25</Text>
                                        <Text style={styles.scaleLabel}>30</Text>
                                    </View>
                                </View>

                                {/* Save Button */}
                                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                    <MaterialCommunityIcons name="content-save" size={20} color={Colors.white} />
                                    <Text style={styles.saveButtonText}>Save BMI</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
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
        alignItems: 'center',
        justifyContent: 'space-between',
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
    inputSection: {
        marginBottom: Sizes.lg,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Sizes.sm,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    unitToggle: {
        flexDirection: 'row',
        backgroundColor: Colors.gray100,
        borderRadius: 8,
        padding: 2,
    },
    unitButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 6,
    },
    unitButtonActive: {
        backgroundColor: Colors.primary,
    },
    unitText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    unitTextActive: {
        color: Colors.white,
    },
    input: {
        backgroundColor: Colors.bgSecondary,
        borderRadius: 12,
        padding: Sizes.md,
        fontSize: 16,
        color: Colors.textPrimary,
    },
    heightRow: {
        flexDirection: 'row',
        gap: Sizes.sm,
    },
    heightInput: {
        flex: 1,
    },
    calculateButton: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        padding: Sizes.md,
        alignItems: 'center',
        marginBottom: Sizes.lg,
    },
    calculateButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
    resultCard: {
        backgroundColor: Colors.bgSecondary,
        borderRadius: 16,
        padding: Sizes.lg,
        borderLeftWidth: 4,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Sizes.lg,
    },
    resultInfo: {
        marginLeft: Sizes.md,
    },
    resultBMI: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    resultCategory: {
        fontSize: 16,
        fontWeight: '600',
    },
    bmiScale: {
        marginBottom: Sizes.lg,
    },
    scaleBar: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 4,
    },
    scaleSegment: {
        height: '100%',
    },
    scaleLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    scaleLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: Colors.success || Colors.primary,
        borderRadius: 12,
        padding: Sizes.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Sizes.sm,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
});
