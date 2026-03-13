import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { useMedicationLogsStore } from '../store/medicationLogsStore';
import { toLocalDateString, fromLocalDateString } from '../utils/dateUtils';
import { MedicationWithStatus, mapFoodRelationshipToInstruction } from '../types/medicationSchedule';
import { Medication } from '../types/medication';

export function useMedicationSync(selectedDate: Date) {
    const { user } = useAuthStore();
    const { medications, fetchMedications, isLoading } = useMedicationsStore();
    const { logs, fetchLogsForDateRange, markAsTaken } = useMedicationLogsStore();
    const [refreshing, setRefreshing] = useState(false);

    // Fetch medications on mount
    useEffect(() => {
        if (user?.id) {
            fetchMedications(user.id, true); // silent fetch
        }
    }, [user?.id, fetchMedications]);

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

    // Convert store medications to scheduled format with date filtering (Local Schedule Resolver)
    const convertToScheduledMedications = useCallback((meds: Medication[], date: Date): MedicationWithStatus[] => {
        const result: MedicationWithStatus[] = [];
        const selectedDateStr = toLocalDateString(date);
        const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const activeMeds = meds.filter(med => {
            // 1. Basic Date Range Check
            if (med.start_date > selectedDateStr) return false;
            if (med.end_date && med.end_date < selectedDateStr) return false;

            // 2. Frequency/Interval Logic
            const startDate = fromLocalDateString(med.start_date);
            const diffTime = startOfDay.getTime() - startDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            switch (med.frequency) {
                case 'once_daily':
                case 'twice_daily':
                case 'three_times_daily':
                case 'four_times_daily':
                    // These are daily - if in range, they exist
                    return true;
                
                case 'weekly':
                    // Check if it's the same day of the week as the start date
                    // (Assuming weekly means same day every week)
                    return dayOfWeek === startDate.getDay();
                
                case 'monthly':
                    // Check if it's the same date of the month
                    return date.getDate() === startDate.getDate();

                case 'as_needed':
                    // For now, only show PRN if they have a log on this day
                    return useMedicationLogsStore.getState().logs.some(
                        (l) => l.medication_id === med.id && l.scheduled_date === selectedDateStr
                    );

                default:
                    // Interval Days logic (e.g. Every 2 days)
                    if (med.interval_days && med.interval_days > 0) {
                        return diffDays % med.interval_days === 0;
                    }
                    return false;
            }
        });


        console.log(`[Sync] Found ${activeMeds.length} active meds for ${selectedDateStr}`);
        if (activeMeds.length > 0) {
            console.log(`[Sync] Active names:`, activeMeds.map(m => m.name).join(', '));
        }

        // Create scheduled entries
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
                    frequency: med.frequency,
                    times: med.time_of_day,
                    type: (med.medicine_type || med.form || 'tablet') as any,
                    form: med.form || med.medicine_type,
                    reminder_enabled: true,
                    instructions: mapFoodRelationshipToInstruction(med.food_relationship),
                });
            });
        });

        return result.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
    }, [logs]);

    // Fetch logs for selected date (Windowed Sync & Wastage Filter)
    useEffect(() => {
        if (!user?.id) return;

        // 1. Local Schedule Resolver: Check if ANY medicine actually exists on this day
        const medsForDay = convertToScheduledMedications(medications, selectedDate);
        if (medsForDay.length === 0) {
            console.log(`[Sync] Skipping fetch for ${toLocalDateString(selectedDate)} (No medications scheduled)`);
            return;
        }

        // 2. Windowed Fetch: Fetch 7 days back and 7 days forward to reduce future calls
        const startWindow = new Date(selectedDate);
        startWindow.setDate(startWindow.getDate() - 7);
        const endWindow = new Date(selectedDate);
        endWindow.setDate(endWindow.getDate() + 7);

        fetchLogsForDateRange(
            user.id, 
            toLocalDateString(startWindow), 
            toLocalDateString(endWindow)
        );
    }, [selectedDate, user?.id, medications, fetchLogsForDateRange, convertToScheduledMedications]);

    // Group medications by exact scheduled time
    const medicationsByTime = useMemo(() => {
        const grouped: Record<string, MedicationWithStatus[]> = {};
        const scheduledMeds = convertToScheduledMedications(medications, selectedDate);

        scheduledMeds.forEach((med) => {
            const time = med.scheduled_time;
            if (!grouped[time]) {
                grouped[time] = [];
            }
            grouped[time].push(med);
        });

        // Sort the times keys
        const sortedTimes = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        
        // Create an object with sorted keys
        const sortedGrouped: Record<string, MedicationWithStatus[]> = {};
        sortedTimes.forEach(time => {
            sortedGrouped[time] = grouped[time];
        });

        return sortedGrouped;
    }, [medications, selectedDate, convertToScheduledMedications]);

    return {
        medications,
        isLoading,
        refreshing,
        onRefresh,
        medicationsByTime,
        markAsTaken
    };
}
