import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants';

interface AddMedicationModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (name: string) => void;
}

/**
 * AddMedicationModal - Modal to add a new medication manually by name.
 * Creates an empty editable card in the verification list.
 */
export default function AddMedicationModal({
    visible,
    onClose,
    onAdd,
}: AddMedicationModalProps) {
    const [medicationName, setMedicationName] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setMedicationName('');
        }
    }, [visible]);

    const handleConfirm = () => {
        const trimmedName = medicationName.trim();
        if (trimmedName) {
            onAdd(trimmedName);
            onClose();
        }
    };

    const isButtonDisabled = medicationName.trim().length === 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <View style={styles.container}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Add Medication</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <Feather name="x" size={20} color={Colors.gray500} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.content}>
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>MEDICATION NAME</Text>
                                    <View style={styles.inputContainer}>
                                        <Feather name="plus-circle" size={18} color={Colors.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.textInput}
                                            value={medicationName}
                                            onChangeText={setMedicationName}
                                            placeholder="e.g. Paracetamol"
                                            placeholderTextColor={Colors.gray400}
                                            autoFocus={true}
                                            autoCapitalize="words"
                                            returnKeyType="done"
                                            onSubmitEditing={handleConfirm}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.addButton,
                                        isButtonDisabled && styles.addButtonDisabled
                                    ]}
                                    onPress={handleConfirm}
                                    disabled={isButtonDisabled}
                                >
                                    <Feather name="plus" size={18} color={isButtonDisabled ? Colors.gray400 : Colors.white} />
                                    <Text style={[
                                        styles.addButtonText,
                                        isButtonDisabled && styles.addButtonTextDisabled
                                    ]}>Add Medication</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
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
    keyboardView: {
        width: '100%',
        alignItems: 'center',
    },
    container: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        width: '100%',
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
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 12,
        ...Typography.fontWeights.bold,
        color: Colors.gray500,
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 12,
        paddingHorizontal: 16,
        backgroundColor: Colors.white,
        height: 54,
    },
    inputIcon: {
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.gray900,
        ...Typography.fontWeights.medium,
        height: '100%',
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
});
