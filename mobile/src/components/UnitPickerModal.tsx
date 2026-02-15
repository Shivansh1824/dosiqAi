import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TouchableWithoutFeedback, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';

interface UnitPickerModalProps {
    visible: boolean;
    onSelect: (unit: string) => void;
    onClose: () => void;
    selectedUnit: string;
}

const COMMON_UNITS = [
    { label: 'mg (Milligrams)', value: 'mg' },
    { label: 'ml (Milliliters)', value: 'ml' },
    { label: 'g (Grams)', value: 'g' },
    { label: 'mcg (Micrograms)', value: 'mcg' },
    { label: 'IU (International Units)', value: 'IU' },
    { label: 'tablets', value: 'tablets' },
    { label: 'capsules', value: 'capsules' },
    { label: 'puffs', value: 'puffs' },
    { label: 'drops', value: 'drops' },
    { label: 'teaspoon', value: 'tsp' },
    { label: 'tablespoon', value: 'tbsp' },
];

export default function UnitPickerModal({
    visible,
    onSelect,
    onClose,
    selectedUnit,
}: UnitPickerModalProps) {
    const [isCustom, setIsCustom] = React.useState(false);
    const [customText, setCustomText] = React.useState('');

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setIsCustom(false);
            setCustomText('');
        }
    }, [visible]);

    const handleCustomSubmit = () => {
        if (customText.trim()) {
            onSelect(customText.trim());
        }
    };

    const renderItem = ({ item }: { item: typeof COMMON_UNITS[0] }) => {
        const isSelected = item.value === selectedUnit;
        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                onPress={() => onSelect(item.value)}
            >
                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                    {item.label}
                </Text>
                {isSelected && (
                    <Feather name="check" size={20} color={Colors.primary} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContent}>
                            <View style={styles.header}>
                                <TouchableOpacity onPress={() => isCustom ? setIsCustom(false) : onClose()} style={styles.closeButton}>
                                    <Feather name={isCustom ? "arrow-left" : "x"} size={24} color={Colors.textPrimary} />
                                </TouchableOpacity>
                                <Text style={styles.title}>{isCustom ? 'Enter Unit' : 'Select Strength Unit'}</Text>
                                <View style={{ width: 24 }} /> 
                            </View>

                            {!isCustom ? (
                                <>
                                    <View style={{ maxHeight: 300 }}>
                                        <FlatList
                                            data={COMMON_UNITS}
                                            renderItem={renderItem}
                                            keyExtractor={(item) => item.value}
                                            showsVerticalScrollIndicator={false}
                                            contentContainerStyle={styles.listContainer}
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.customButton}
                                        onPress={() => setIsCustom(true)}
                                    >
                                        <Feather name="edit-2" size={18} color={Colors.primary} />
                                        <Text style={styles.customButtonText}>Enter Custom Unit</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <View style={styles.customInputContainer}>
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            style={styles.customInput}
                                            placeholder="e.g., sprays, patches"
                                            placeholderTextColor={Colors.textTertiary}
                                            value={customText}
                                            onChangeText={setCustomText}
                                            autoFocus
                                            onSubmitEditing={handleCustomSubmit}
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        style={[styles.confirmButton, !customText.trim() && styles.disabledButton]}
                                        onPress={handleCustomSubmit}
                                        disabled={!customText.trim()}
                                    >
                                        <Text style={styles.confirmButtonText}>Confirm</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: Sizes.lg,
        maxHeight: '80%', // Increased for keyboard
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Sizes.md,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    listContainer: {
        paddingBottom: 10,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: Colors.gray50,
    },
    selectedItem: {
        backgroundColor: Colors.primary + '10', // 10% opacity primary
        borderColor: Colors.primary,
        borderWidth: 1,
    },
    itemText: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    selectedItemText: {
        color: Colors.primary,
        fontWeight: '700',
    },
    customButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        marginTop: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
        borderStyle: 'dashed',
        backgroundColor: Colors.primary + '05',
    },
    customButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.primary,
    },
    customInputContainer: {
        gap: 16,
        paddingBottom: 200, // Keyboard buffer
    },
    inputWrapper: {
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    customInput: {
        height: 50,
        fontSize: 16,
        color: Colors.textPrimary,
    },
    confirmButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: Colors.gray300,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.white,
    },
});
