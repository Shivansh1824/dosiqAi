import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';

interface NumberPickerModalProps {
    visible: boolean;
    initialValue: number;
    onConfirm: (value: number) => void;
    onCancel: () => void;
    title?: string;
    min?: number;
    max?: number;
}

export default function NumberPickerModal({
    visible,
    initialValue,
    onConfirm,
    onCancel,
    title = "Select Interval",
    min = 1,
    max = 120,
}: NumberPickerModalProps) {
    const [selectedValue, setSelectedValue] = useState(initialValue);

    // Sync state when visible or initialValue changes
    useEffect(() => {
        if (visible) {
            setSelectedValue(initialValue || 1);
        }
    }, [visible, initialValue]);

    // Generate numbers
    const data = Array.from({ length: max - min + 1 }, (_, i) => i + min);

    const renderItem = ({ item }: { item: number }) => {
        const isSelected = item === selectedValue;
        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                onPress={() => setSelectedValue(item)}
            >
                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                    {item === 1 ? 'Everyday' : `Every ${item} Days`}
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
            animationType="slide"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                            <Feather name="x" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.listContainer}>
                        <FlatList
                            data={data}
                            renderItem={renderItem}
                            keyExtractor={(item) => item.toString()}
                            showsVerticalScrollIndicator={false}
                            getItemLayout={(data, index) => (
                                { length: 48, offset: 48 * index, index }
                            )}
                            initialScrollIndex={Math.max(0, (initialValue || 1) - min - 2)} // Roughly center the selection
                        />
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => onConfirm(selectedValue)}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: Sizes.lg,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Sizes.md,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    closeButton: {
        padding: Sizes.xs,
    },
    listContainer: {
        height: 300,
        marginVertical: Sizes.sm,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    selectedItem: {
        backgroundColor: '#EFF6FF', // Light blue background
    },
    itemText: {
        fontSize: 16,
        color: Colors.gray800,
    },
    selectedItemText: {
        color: Colors.primary,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: Sizes.md,
        marginTop: Sizes.lg,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: Sizes.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.gray300,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: Sizes.md,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
});
