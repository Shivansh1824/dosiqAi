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
    showSOS?: boolean; // NEW: Option to show SOS
    mode?: 'interval' | 'duration'; // NEW: formatting mode
}

export default function NumberPickerModal({
    visible,
    initialValue,
    onConfirm,
    onCancel,
    title = "Select Interval",
    min = 1,
    max = 120,
    showSOS = false,
    mode = 'interval',
}: NumberPickerModalProps) {
    const [selectedValue, setSelectedValue] = useState(initialValue);

    // Sync state when visible or initialValue changes
    useEffect(() => {
        if (visible) {
            setSelectedValue(initialValue !== undefined ? initialValue : 1);
        }
    }, [visible, initialValue]);

    // Generate numbers
    const data = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    // Prepend SOS if requested
    if (showSOS) {
        data.unshift(0);
    }

    const renderItem = ({ item }: { item: number }) => {
        const isSelected = item === selectedValue;
        const getLabel = (val: number) => {
            if (mode === 'duration') {
                return val === 1 ? '1 Day' : `${val} Days`;
            }
            return val === 0 ? 'As Needed (S.O.S)' : val === 1 ? 'Everyday' : `Every ${val} Days`;
        };

        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                onPress={() => {
                    setSelectedValue(item);
                    onConfirm(item); // Auto save
                }}
            >
                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                    {getLabel(item)}
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
        paddingHorizontal: 20,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: Colors.gray50,
        height: 56, // Hardcoded to match getItemLayout (56 + 8 margin = 64)
        borderWidth: 1,
        borderColor: 'transparent',
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
