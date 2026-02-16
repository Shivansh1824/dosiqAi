import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TouchableWithoutFeedback } from 'react-native';
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
                onPress={() => {
                    setSelectedValue(item);
                    onConfirm(item); // Auto save
                }}
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
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContent}>
                            <View style={styles.header}>
                                <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                                    <Feather name="x" size={24} color={Colors.textPrimary} />
                                </TouchableOpacity>
                                <Text style={styles.title}>{title}</Text>
                            </View>

                            <View style={styles.listContainer}>
                                <FlatList
                                    data={data}
                                    renderItem={renderItem}
                                    keyExtractor={(item) => item.toString()}
                                    showsVerticalScrollIndicator={false}
                                    getItemLayout={(data, index) => (
                                        { length: 64, offset: 64 * index, index } // Updated height
                                    )}
                                    initialScrollIndex={Math.max(0, (initialValue || 1) - min - 2)}
                                />
                            </View>
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
        maxHeight: '60%',
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start', // Left align
        marginBottom: Sizes.xl, // More space
        gap: 16,
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
        height: 300,
        marginVertical: Sizes.sm,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: Colors.gray50,
    },
    selectedItem: {
        backgroundColor: Colors.primary + '10',
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
});
