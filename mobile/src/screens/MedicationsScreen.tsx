import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { useNavigation } from '@react-navigation/native';
import CalendarStrip from '../components/CalendarStrip';
import TimeSection from '../components/TimeSection';
import AddMedicationModal from '../components/AddMedicationModal';
import CalendarModal, { CalendarEvent } from '../components/CalendarModal';
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
    const [showCalendarModal, setShowCalendarModal] = useState(false);

    // Fetch medications on mount
    useEffect(() => {
        if (user?.id) {
            fetchMedications(user.id, true); // silent fetch
        }
    }, [user?.id, fetchMedications]);

    // Convert store medications to scheduled format with date filtering
    const convertToScheduledMedications = (meds: Medication[], selectedDate: Date): MedicationWithStatus[] => {
        const result: MedicationWithStatus[] = [];

        // Normalize selected date to start of day (YYYY-MM-DD) for comparison
        const selectedDateStr = selectedDate.toISOString().split('T')[0];

        // Filter medications that are:
        // 1. Active (is_active = true)
        // 2. Started on or before selected date
        // 3. Not ended OR ended on or after selected date
        const activeMeds = meds.filter(med => {
            if (!med.is_active) return false;

            // Check if medication has started
            if (med.start_date > selectedDateStr) {
                return false; // Medication hasn't started yet
            }

            // Check if medication has ended
            if (med.end_date && med.end_date < selectedDateStr) {
                return false; // Medication already ended
            }

            return true; // Medication is active on selected date
        });

        // Create scheduled entries for valid medications
        activeMeds.forEach(med => {
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

        const scheduledMeds = convertToScheduledMedications(medications, selectedDate);

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

    // Generate calendar events from medications
    const getCalendarEvents = (): Record<string, CalendarEvent> => {
        const events: Record<string, CalendarEvent> = {};

        medications.forEach(med => {
            if (!med.is_active) return;

            const startDate = new Date(med.start_date);
            const endDate = med.end_date ? new Date(med.end_date) : null;

            // Generate entries for each day in the medication's range
            const currentDate = new Date(startDate);
            const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

            while (true) {
                const dateStr = currentDate.toISOString().split('T')[0];

                // Add or increment medication count
                if (!events[dateStr]) {
                    events[dateStr] = { type: 'medication', count: 0 };
                }
                events[dateStr].count += 1;

                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);

                // Stop conditions:
                // 1. If end_date exists and we've reached it
                // 2. If no end_date, stop after 1 year to prevent infinite loop
                if (endDate && currentDate > endDate) break;
                if (!endDate && currentDate > oneYearFromNow) break;
            }
        });

        return events;
    };

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

            {/* Full Calendar Button */}
            <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowCalendarModal(true)}
                activeOpacity={0.7}
            >
                <Feather name="calendar" size={16} color={Colors.primary} />
                <Text style={styles.calendarButtonText}>View Full Calendar</Text>
            </TouchableOpacity>

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

            {/* Calendar Modal */}
            <CalendarModal
                visible={showCalendarModal}
                selectedDate={selectedDate}
                events={getCalendarEvents()}
                onClose={() => setShowCalendarModal(false)}
                onDateSelect={setSelectedDate}
                filterType="medication"
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
    calendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginHorizontal: Sizes.lg,
        marginTop: Sizes.sm,
        marginBottom: Sizes.md,
        backgroundColor: Colors.primary + '10',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary + '20',
    },
    calendarButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
});
