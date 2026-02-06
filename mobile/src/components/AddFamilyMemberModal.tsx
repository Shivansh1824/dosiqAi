import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Sizes } from '../constants';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useAuthStore } from '../store/authStore';
import { RELATIONSHIPS, GENDERS, Relationship, Gender } from '../types/familyMember';

interface AddFamilyMemberModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddFamilyMemberModal({ visible, onClose, onSuccess }: AddFamilyMemberModalProps) {
    const { user } = useAuthStore();
    const { addFamilyMember } = useFamilyMembersStore();

    const [name, setName] = useState('');
    const [relationship, setRelationship] = useState<Relationship>('Self');
    const [gender, setGender] = useState<Gender>('Male');
    const [dateOfBirth, setDateOfBirth] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        // Validation
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Please enter a name');
            return;
        }

        if (name.trim().length < 2) {
            Alert.alert('Validation Error', 'Name must be at least 2 characters');
            return;
        }

        if (!user?.id) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        setIsSubmitting(true);

        try {
            await addFamilyMember({
                user_id: user.id,
                name: name.trim(),
                relationship,
                gender,
                date_of_birth: dateOfBirth.toISOString().split('T')[0], // YYYY-MM-DD format
            });

            Alert.alert('Success', `${name} has been added to your family`);
            if (onSuccess) onSuccess();
            handleClose();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to add family member');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setName('');
        setRelationship('Self');
        setGender('Male');
        setDateOfBirth(new Date());
        setShowDatePicker(false);
        onClose();
    };

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
                        <Text style={styles.title}>Add Family Member</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color={Colors.gray700} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Name Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter name"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                                placeholderTextColor={Colors.gray400}
                            />
                        </View>

                        {/* Relationship Picker */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Relationship *</Text>
                            <View style={styles.pickerContainer}>
                                {RELATIONSHIPS.map((rel) => (
                                    <TouchableOpacity
                                        key={rel}
                                        style={[
                                            styles.pickerOption,
                                            relationship === rel && styles.pickerOptionSelected,
                                        ]}
                                        onPress={() => setRelationship(rel)}
                                    >
                                        <Text
                                            style={[
                                                styles.pickerOptionText,
                                                relationship === rel && styles.pickerOptionTextSelected,
                                            ]}
                                        >
                                            {rel}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Gender Picker */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Gender *</Text>
                            <View style={styles.pickerContainer}>
                                {GENDERS.map((g) => (
                                    <TouchableOpacity
                                        key={g}
                                        style={[
                                            styles.pickerOption,
                                            gender === g && styles.pickerOptionSelected,
                                        ]}
                                        onPress={() => setGender(g)}
                                    >
                                        <Text
                                            style={[
                                                styles.pickerOptionText,
                                                gender === g && styles.pickerOptionTextSelected,
                                            ]}
                                        >
                                            {g}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Date of Birth */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Date of Birth *</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Feather name="calendar" size={20} color={Colors.primary} />
                                <Text style={styles.dateButtonText}>
                                    {dateOfBirth.toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={dateOfBirth}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(Platform.OS === 'ios');
                                    if (selectedDate) {
                                        setDateOfBirth(selectedDate);
                                    }
                                }}
                                maximumDate={new Date()}
                            />
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleClose}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.submitButtonText}>
                                {isSubmitting ? 'Adding...' : 'Add Member'}
                            </Text>
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
    title: {
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
    inputGroup: {
        marginBottom: Sizes.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Sizes.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 12,
        padding: Sizes.md,
        fontSize: 16,
        color: Colors.textPrimary,
        backgroundColor: Colors.white,
    },
    pickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Sizes.sm,
    },
    pickerOption: {
        paddingHorizontal: Sizes.md,
        paddingVertical: Sizes.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.gray200,
        backgroundColor: Colors.white,
    },
    pickerOptionSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    pickerOptionText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    pickerOptionTextSelected: {
        color: Colors.white,
        fontWeight: '600',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Sizes.sm,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 12,
        padding: Sizes.md,
        backgroundColor: Colors.white,
    },
    dateButtonText: {
        fontSize: 16,
        color: Colors.textPrimary,
    },
    footer: {
        flexDirection: 'row',
        gap: Sizes.md,
        padding: Sizes.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
    },
    cancelButton: {
        flex: 1,
        padding: Sizes.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.gray200,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    submitButton: {
        flex: 1,
        padding: Sizes.md,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
});
