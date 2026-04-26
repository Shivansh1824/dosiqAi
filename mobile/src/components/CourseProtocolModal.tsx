import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';

interface CourseProtocolModalProps {
    visible: boolean;
    initialDuration: number;
    initialInterval: number; // 0 for SOS, 1 for Everyday, etc.
    onConfirm: (duration: number, interval: number) => void;
    onCancel: () => void;
}

const { width } = Dimensions.get('window');

export default function CourseProtocolModal({
    visible,
    initialDuration,
    initialInterval,
    onConfirm,
    onCancel,
}: CourseProtocolModalProps) {
    const [selectedDuration, setSelectedDuration] = useState(initialDuration || 5);
    const [selectedInterval, setSelectedInterval] = useState(initialInterval !== undefined ? initialInterval : 1);
    const [activeTab, setActiveTab] = useState<'duration' | 'interval'>('duration');

    // Sync state when visible changes
    useEffect(() => {
        if (visible) {
            setSelectedDuration(initialDuration || 5);
            setSelectedInterval(initialInterval !== undefined ? initialInterval : 1);
            setActiveTab('duration'); // Reset to duration tab
        }
    }, [visible, initialDuration, initialInterval]);

    // Generate Duration numbers (1 to 120)
    const durationData = Array.from({ length: 120 }, (_, i) => i + 1);

    // Generate Interval numbers (0 to 60)
    const intervalData = Array.from({ length: 61 }, (_, i) => i);

    const handleConfirm = () => {
        onConfirm(selectedDuration, selectedInterval);
    };

    const renderDurationItem = ({ item }: { item: number }) => {
        const isSelected = item === selectedDuration;
        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                onPress={() => setSelectedDuration(item)}
            >
                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                    {item === 1 ? '1 Day' : `${item} Days`}
                </Text>
                {isSelected && <Feather name="check" size={20} color={Colors.primary} />}
            </TouchableOpacity>
        );
    };

    const renderIntervalItem = ({ item }: { item: number }) => {
        const isSelected = item === selectedInterval;
        const getLabel = (val: number) => {
            if (val === 0) return 'As Needed (S.O.S)';
            if (val === 1) return 'Everyday';
            return `Every ${val} Days`;
        };

        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                onPress={() => setSelectedInterval(item)}
            >
                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                    {getLabel(item)}
                </Text>
                {isSelected && <Feather name="check" size={20} color={Colors.primary} />}
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
                                <Text style={styles.title}>Medication Protocol</Text>
                            </View>

                            {/* Tab Switcher */}
                            <View style={styles.tabContainer}>
                                <TouchableOpacity 
                                    style={[styles.tab, activeTab === 'duration' && styles.activeTab]}
                                    onPress={() => setActiveTab('duration')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'duration' && styles.activeTabText]}>
                                        Duration
                                    </Text>
                                    <Text style={styles.tabValueText}>
                                        {selectedDuration === 1 ? '1 Day' : `${selectedDuration} Days`}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.tab, activeTab === 'interval' && styles.activeTab]}
                                    onPress={() => setActiveTab('interval')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'interval' && styles.activeTabText]}>
                                        Frequency
                                    </Text>
                                    <Text style={styles.tabValueText}>
                                        {selectedInterval === 0 ? 'S.O.S' : selectedInterval === 1 ? 'Everyday' : `Every ${selectedInterval} Days`}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* List Container */}
                            <View style={styles.listContainer}>
                                {activeTab === 'duration' ? (
                                    <FlatList
                                        data={durationData}
                                        renderItem={renderDurationItem}
                                        keyExtractor={(item) => item.toString()}
                                        showsVerticalScrollIndicator={false}
                                        getItemLayout={(data, index) => ({ length: 64, offset: 64 * index, index })}
                                        initialScrollIndex={Math.max(0, selectedDuration - 3)}
                                    />
                                ) : (
                                    <FlatList
                                        data={intervalData}
                                        renderItem={renderIntervalItem}
                                        keyExtractor={(item) => item.toString()}
                                        showsVerticalScrollIndicator={false}
                                        getItemLayout={(data, index) => ({ length: 64, offset: 64 * index, index })}
                                        initialScrollIndex={Math.max(0, selectedInterval - 2)}
                                    />
                                )}
                            </View>

                            {/* Confirm Button */}
                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                                <Text style={styles.confirmButtonText}>Confirm Protocol</Text>
                            </TouchableOpacity>

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
        maxHeight: '80%',
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginBottom: Sizes.lg,
        gap: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.gray100,
        borderRadius: 12,
        padding: 4,
        marginBottom: Sizes.md,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: Colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 12,
        color: Colors.gray500,
        ...Typography.fontWeights.medium,
        marginBottom: 2,
    },
    activeTabText: {
        color: Colors.primaryDark,
        ...Typography.fontWeights.bold,
    },
    tabValueText: {
        fontSize: 14,
        color: Colors.textPrimary,
        ...Typography.fontWeights.bold,
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
        height: 56,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedItem: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
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
    confirmButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: Sizes.md,
    },
    confirmButtonText: {
        color: Colors.white,
        fontSize: 16,
        ...Typography.fontWeights.bold,
    },
});
