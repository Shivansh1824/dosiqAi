import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { useNavigation } from '@react-navigation/native';
import CalendarStrip from '../components/CalendarStrip';
import TimeSection from '../components/TimeSection';
import AddMedicationModal from '../components/AddMedicationModal';
import { MedicationWithStatus, getTimeOfDayCategory } from '../types/medicationSchedule';

// Mock data for now - will be replaced with real data from store
const MOCK_MEDICATIONS: MedicationWithStatus[] = [
    {
        id: '1',
        user_id: 'user1',
        name: 'Amoxicillin',
        dosage: '500mg - 1 Tablet',
        type: 'tablet',
        frequency: 'Twice daily',
        times: ['08:00', '20:00'],
        start_date: '2025-12-01',
        instructions: 'after_meal',
        reminder_enabled: true,
        is_active: true,
        color: '#3B82F6',
        created_at: '2025-12-01',
        updated_at: '2025-12-01',
        scheduled_time: '08:00',
        status: 'taken',
        taken_at: '2025-12-04T08:05:00',
    },
    {
        id: '2',
        user_id: 'user1',
        name: 'Vitamin D3',
        dosage: '2000 IU - 1 Capsule',
        type: 'capsule',
        frequency: 'Once daily',
        times: ['09:00'],
        start_date: '2025-12-01',
        instructions: 'with_food',
        reminder_enabled: true,
        is_active: true,
        color: '#F59E0B',
        created_at: '2025-12-01',
        updated_at: '2025-12-01',
        scheduled_time: '09:00',
        status: 'pending',
    },
    {
        id: '3',
        user_id: 'user1',
        name: 'Cough Syrup',
        dosage: '10ml',
        type: 'syrup',
        frequency: 'Three times daily',
        times: ['08:00', '14:00', '20:00'],
        start_date: '2025-12-01',
        end_date: '2025-12-07',
        instructions: 'after_meal',
        reminder_enabled: true,
        is_active: true,
        color: '#8B5CF6',
        created_at: '2025-12-01',
        updated_at: '2025-12-01',
        scheduled_time: '14:00',
        status: 'pending',
    },
    {
        id: '4',
        user_id: 'user1',
        name: 'Melatonin',
        dosage: '5mg - 1 Tablet',
        type: 'tablet',
        frequency: 'Once daily',
        times: ['22:00'],
        start_date: '2025-12-01',
        instructions: 'before_sleep',
        reminder_enabled: true,
        is_active: true,
        color: '#3B82F6',
        created_at: '2025-12-01',
        updated_at: '2025-12-01',
        scheduled_time: '22:00',
        status: 'pending',
    },
];

export default function MedicationsScreen() {
    const navigation = useNavigation();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Group medications by time of day
    const groupMedicationsByTimeOfDay = () => {
        const grouped = {
            morning: [] as MedicationWithStatus[],
            afternoon: [] as MedicationWithStatus[],
            evening: [] as MedicationWithStatus[],
            night: [] as MedicationWithStatus[],
        };

        MOCK_MEDICATIONS.forEach((med) => {
            const category = getTimeOfDayCategory(med.scheduled_time);
            grouped[category].push(med);
        });

        // Sort by time within each category
        Object.keys(grouped).forEach((key) => {
            grouped[key as keyof typeof grouped].sort((a, b) =>
                a.scheduled_time.localeCompare(b.scheduled_time)
            );
        });

        return grouped;
    };

    const medicationsByTime = groupMedicationsByTimeOfDay();

    // Handle medication take action
    const handleTakeMedication = useCallback((medicationId: string, scheduledTime: string) => {
        console.log('Taking medication:', medicationId, 'at', scheduledTime);
        // TODO: Implement actual medication logging
        // This will call the medication logs store to mark as taken
    }, []);

    // Handle refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // TODO: Fetch medications from store
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    // Handle add medication
    const handleAddMedication = () => {
        setShowAddModal(true);
    };

    // Handle save medication
    const handleSaveMedication = (medication: any) => {
        console.log('Saving medication:', medication);
        // TODO: Save to store
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Medications</Text>
                    <Text style={styles.headerSubtitle}>
                        {selectedDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddMedication}
                    activeOpacity={0.7}
                >
                    <Feather name="plus" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Calendar Strip */}
            <CalendarStrip
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
            />

            {/* Medications Timeline */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
            >
                <TimeSection
                    category="morning"
                    medications={medicationsByTime.morning}
                    onTakeMedication={handleTakeMedication}
                />

                <TimeSection
                    category="afternoon"
                    medications={medicationsByTime.afternoon}
                    onTakeMedication={handleTakeMedication}
                />

                <TimeSection
                    category="evening"
                    medications={medicationsByTime.evening}
                    onTakeMedication={handleTakeMedication}
                />

                <TimeSection
                    category="night"
                    medications={medicationsByTime.night}
                    onTakeMedication={handleTakeMedication}
                />

                {/* Extra padding for bottom */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Add Medication Modal */}
            <AddMedicationModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={handleSaveMedication}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingVertical: Sizes.md,
        backgroundColor: Colors.white,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Sizes.sm,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Sizes.sm,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: Sizes.lg,
    },
});
