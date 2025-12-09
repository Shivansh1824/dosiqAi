import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { useNavigation } from '@react-navigation/native';
import CalendarStrip from '../components/CalendarStrip';
import TimeSection from '../components/TimeSection';
import AddMedicationModal from '../components/AddMedicationModal';
import { MedicationWithStatus, getTimeOfDayCategory } from '../types/medicationSchedule';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAuthStore } from '../store/authStore';
import { Medication, getFrequencyText } from '../types/medication';

export default function MedicationsScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const { medications, fetchMedications, isLoading } = useMedicationsStore();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Fetch medications on mount
    useEffect(() => {
        if (user?.id) {
            fetchMedications(user.id, true); // silent fetch
        }
    }, [user?.id, fetchMedications]);

    // Convert store medications to scheduled format
    const convertToScheduledMedications = (meds: Medication[]): MedicationWithStatus[] => {
        const result: MedicationWithStatus[] = [];

        // Filter active medications only
        const activeMeds = meds.filter(med => med.is_active);

        activeMeds.forEach(med => {
            // Create one entry per time slot
            med.time_of_day.forEach(time => {
                result.push({
                    ...med,
                    scheduled_time: time,
                    status: 'pending', // TODO: Determine status based on logs
                    dosage: med.dosage,
                    frequency: getFrequencyText(med.frequency),
                    times: med.time_of_day,
                    type: 'tablet', // Default type
                    reminder_enabled: true,
                });
            });
        });

        return result;
    };

    // Group medications by time of day
    const groupMedicationsByTimeOfDay = () => {
        const grouped = {
            morning: [] as MedicationWithStatus[],
            afternoon: [] as MedicationWithStatus[],
            evening: [] as MedicationWithStatus[],
            night: [] as MedicationWithStatus[],
        };

        const scheduledMeds = convertToScheduledMedications(medications);

        scheduledMeds.forEach((med) => {
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
        if (!user?.id) return;
        setRefreshing(true);
        try {
            await fetchMedications(user.id);
        } catch (error) {
            console.error('Failed to refresh medications:', error);
        } finally {
            setRefreshing(false);
        }
    }, [user?.id, fetchMedications]);

    // Handle add medication
    const handleAddMedication = () => {
        setShowAddModal(true);
    };

    // Handle save medication
    const handleSaveMedication = async (medication: any) => {
        console.log('Saving medication:', medication);
        // TODO: Connect to addMedication from store
        setShowAddModal(false);
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
