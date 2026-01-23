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
import { useMedicationLogsStore } from '../store/medicationLogsStore';
import { useAuthStore } from '../store/authStore';
import { Medication, getFrequencyText } from '../types/medication';
import { toLocalDateString, fromLocalDateString, getTodayLocal } from '../utils/dateUtils';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function MedicationsScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const { medications, fetchMedications, isLoading } = useMedicationsStore();
    const { logs, fetchLogsForDate, markAsTaken } = useMedicationLogsStore();
    const [selectedDate, setSelectedDate] = useState(getTodayLocal());
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    
    // Rescheduling state
    const [reschedulingMed, setReschedulingMed] = useState<MedicationWithStatus | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Fetch medications on mount
    useEffect(() => {
        if (user?.id) {
            fetchMedications(user.id, true); // silent fetch
        }
    }, [user?.id, fetchMedications]);

    // Fetch logs for selected date
    useEffect(() => {
        if (user?.id) {
            fetchLogsForDate(user.id, selectedDate);
        }
    }, [selectedDate, user?.id, fetchLogsForDate]);

    // Convert store medications to scheduled format with date filtering
    const convertToScheduledMedications = (meds: Medication[], selectedDate: Date): MedicationWithStatus[] => {
        const result: MedicationWithStatus[] = [];

        // Normalize selected date to local date string (no UTC conversion)
        const selectedDateStr = toLocalDateString(selectedDate);

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
                // Check if log exists for this medication/date/time
                const log = useMedicationLogsStore.getState().getLog(
                    med.id,
                    selectedDateStr,
                    time
                );

                result.push({
                    ...med,
                    scheduled_time: time,
                    status: log?.status || 'pending',
                    taken_at: log?.taken_at,
                    dosage: med.dosage,
                    frequency: getFrequencyText(med.frequency),
                    times: med.time_of_day,
                    type: 'tablet', // Default type
                    reminder_enabled: true,
                    instructions: 'other', // Default instruction
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

    // Helper function to calculate medication occurrences based on frequency
    const calculateMedicationOccurrences = (
        startDateStr: string,    // Changed: now accepts string instead of Date
        endDateStr: string | null,
        frequency: string
    ): string[] => {
        const occurrences: string[] = [];

        // Convert to local Date objects
        const currentDate = fromLocalDateString(startDateStr);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        const maxDate = endDateStr ? fromLocalDateString(endDateStr) : oneYearFromNow;

        // Determine increment based on frequency
        let dayIncrement = 1;
        switch (frequency) {
            case 'once_daily':
            case 'twice_daily':
            case 'three_times_daily':
            case 'four_times_daily':
                dayIncrement = 1; // Every day
                break;
            case 'weekly':
                dayIncrement = 7; // Every 7 days
                break;
            case 'monthly':
                dayIncrement = 30; // Approximate monthly (every 30 days)
                break;
            case 'as_needed':
                // PRN medications don't show on calendar
                return [];
            default:
                dayIncrement = 1;
        }

        // Generate occurrence dates (using local date strings)
        while (currentDate <= maxDate) {
            occurrences.push(toLocalDateString(currentDate));
            currentDate.setDate(currentDate.getDate() + dayIncrement);
        }

        return occurrences;
    };

    // Generate calendar events from medications (respects frequency)
    const getCalendarEvents = (): Record<string, CalendarEvent> => {
        const events: Record<string, CalendarEvent> = {};

        medications.forEach(med => {
            if (!med.is_active) return;

            // Calculate actual occurrence dates based on frequency
            // Pass date strings directly (no Date object conversion)
            const occurrenceDates = calculateMedicationOccurrences(
                med.start_date,      // Already a string like "2025-12-09"
                med.end_date || null,
                med.frequency
            );

            // Add events for each occurrence date
            occurrenceDates.forEach(dateStr => {
                if (!events[dateStr]) {
                    events[dateStr] = { type: 'medication', count: 0 };
                }
                events[dateStr].count += 1;
            });
        });

        return events;
    };

    // Handle medication take action
    const handleTakeMedication = useCallback(async (medicationId: string, scheduledTime: string) => {
        if (!user?.id) return;

        try {
            // Haptic feedback
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const selectedDateStr = toLocalDateString(selectedDate);

            // Mark as taken in database
            await markAsTaken(user.id, medicationId, selectedDateStr, scheduledTime);

            console.log('✅ Medication taken:', medicationId, 'at', scheduledTime);
        } catch (error) {
            console.error('Failed to mark medication as taken:', error);
        }
    }, [user?.id, selectedDate, markAsTaken]);

    // Handle rescheduling medication
    const handleReschedule = useCallback((medication: MedicationWithStatus) => {
        setReschedulingMed(medication);
        setShowTimePicker(true);
    }, []);

    const onTimeChange = async (event: any, selectedTime?: Date) => {
        setShowTimePicker(false);
        
        if (selectedTime && reschedulingMed && user?.id) {
            const timeString = selectedTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            });

            try {
                // Update the medication's schedule in the store
                const updatedTimes = reschedulingMed.times.map((t: string) => 
                    t === reschedulingMed.scheduled_time ? timeString : t
                );
                
                await useMedicationsStore.getState().updateMedication(reschedulingMed.id, {
                    time_of_day: updatedTimes.sort()
                });
                
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
                console.error('Failed to reschedule medication:', error);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        }
        setReschedulingMed(null);
    };

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
        try {
            await useMedicationsStore.getState().addMedication(medication);
            setShowAddModal(false);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Failed to add medication:', error);
            alert('Failed to add medication. Please try again.');
        }
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
                    onReschedule={handleReschedule}
                />

                <TimeSection
                    category="evening"
                    medications={medicationsByTime.evening}
                    onTakeMedication={handleTakeMedication}
                    onReschedule={handleReschedule}
                />

                <TimeSection
                    category="night"
                    medications={medicationsByTime.night}
                    onTakeMedication={handleTakeMedication}
                    onReschedule={handleReschedule}
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

            {/* Time Picker for Rescheduling */}
            {showTimePicker && (
                <DateTimePicker
                    value={(() => {
                        const [hours, minutes] = (reschedulingMed?.scheduled_time || "08:00").split(':').map(Number);
                        const d = new Date();
                        d.setHours(hours, minutes, 0, 0);
                        return d;
                    })()}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={onTimeChange}
                />
            )}
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
