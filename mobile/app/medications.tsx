import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../src/constants';
import {     } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import CalendarStrip from '../src/components/CalendarStrip';
import MedicationCard from '../src/components/MedicationCard';
import CalendarModal, { CalendarEvent } from '../src/components/CalendarModal';
import { MedicationWithStatus } from '../src/types/medicationSchedule';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { useMedicationLogsStore } from '../src/store/medicationLogsStore';
import { useAuthStore } from '../src/store/authStore';
import { cancelReminder } from '../src/services/notificationService';
import { toLocalDateString, fromLocalDateString, getTodayLocal } from '../src/utils/dateUtils';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNotifications } from '../src/hooks/useNotifications';
import { useMedicationSync } from '../src/hooks/useMedicationSync';
import { MedicationIcon } from '../src/components/medication/MedicationIcons';

const ACCENT = '#1B4332';

export default function MedicationsScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { scheduleAllForMedication } = useNotifications();
    const [selectedDate, setSelectedDate] = useState(getTodayLocal());
    const [showCalendarModal, setShowCalendarModal] = useState(false);

    const {
        medications,
        medicationsByTime,
        refreshing,
        onRefresh,
        markAsTaken
    } = useMedicationSync(selectedDate);

    const [reschedulingMed, setReschedulingMed] = useState<MedicationWithStatus | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const getNextDoseTime = () => {
        const now = new Date();
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayStr = toLocalDateString(getTodayLocal());
        const isToday = toLocalDateString(selectedDate) === todayStr;

        if (!isToday) return null;

        const times = Object.keys(medicationsByTime).sort();
        for (const time of times) {
            if (time > currentTimeStr) {
                const hasPending = medicationsByTime[time].some(m => m.status === 'pending');
                if (hasPending) return time;
            }
        }
        return null;
    };

    const nextDoseTime = getNextDoseTime();

    const calculateMedicationOccurrences = (
        startDateStr: string,
        endDateStr: string | null,
        frequency: string
    ): string[] => {
        const occurrences: string[] = [];
        const currentDate = fromLocalDateString(startDateStr);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        const maxDate = endDateStr ? fromLocalDateString(endDateStr) : oneYearFromNow;

        let dayIncrement = 1;
        switch (frequency) {
            case 'once_daily': case 'twice_daily': case 'three_times_daily': case 'four_times_daily':
                dayIncrement = 1; break;
            case 'weekly': dayIncrement = 7; break;
            case 'monthly': dayIncrement = 30; break;
            case 'as_needed': return [];
            default: dayIncrement = 1;
        }

        while (currentDate <= maxDate) {
            occurrences.push(toLocalDateString(currentDate));
            currentDate.setDate(currentDate.getDate() + dayIncrement);
        }
        return occurrences;
    };

    const getCalendarEvents = (): Record<string, CalendarEvent> => {
        const events: Record<string, CalendarEvent> = {};
        medications.forEach(med => {
            const occurrenceDates = calculateMedicationOccurrences(med.start_date, med.end_date || null, med.frequency);
            occurrenceDates.forEach(dateStr => {
                if (!events[dateStr]) events[dateStr] = { type: 'medication', count: 0 };
                events[dateStr].count += 1;
            });
        });
        return events;
    };

    const handleTakeMedication = useCallback(async (medicationId: string, scheduledTime: string) => {
        if (!user?.id) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const selectedDateStr = toLocalDateString(selectedDate);
            await markAsTaken(user.id, medicationId, selectedDateStr, scheduledTime);
            const med = medications.find(m => m.id === medicationId);
            if (med) {
                const doseIndex = med.time_of_day.indexOf(scheduledTime);
                if (doseIndex !== -1) {
                    const baseId = `${medicationId}_dose_${doseIndex}`;
                    await cancelReminder(baseId);
                    await cancelReminder(`${baseId}_followup`);
                }
            }
        } catch (error) {
            console.error('Failed to mark medication as taken:', error);
        }
    }, [user?.id, selectedDate, markAsTaken]);

    const handleSkipMedication = useCallback(async (medicationId: string, scheduledTime: string) => {
        if (!user?.id) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const selectedDateStr = toLocalDateString(selectedDate);
            await useMedicationLogsStore.getState().markAsSkipped(user.id, medicationId, selectedDateStr, scheduledTime);
            const med = medications.find(m => m.id === medicationId);
            if (med) {
                const doseIndex = med.time_of_day.indexOf(scheduledTime);
                if (doseIndex !== -1) {
                    const baseId = `${medicationId}_dose_${doseIndex}`;
                    await cancelReminder(baseId);
                    await cancelReminder(`${baseId}_followup`);
                }
            }
        } catch (error) {
            console.error('Failed to mark medication as skipped:', error);
        }
    }, [user?.id, selectedDate, medications]);

    const handleReschedule = useCallback((medication: MedicationWithStatus) => {
        setReschedulingMed(medication);
        setShowTimePicker(true);
    }, []);

    const onTimeChange = async (event: any, selectedTime?: Date) => {
        setShowTimePicker(false);
        if (selectedTime && reschedulingMed && user?.id) {
            const timeString = selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            try {
                const updatedTimes = reschedulingMed.times.map((t: string) =>
                    t === reschedulingMed.scheduled_time ? timeString : t
                );
                const updatedMed = await useMedicationsStore.getState().updateMedication(reschedulingMed.id, {
                    time_of_day: updatedTimes.sort()
                });
                if (updatedMed) await scheduleAllForMedication(updatedMed);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
                console.error('Failed to reschedule medication:', error);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        }
        setReschedulingMed(null);
    };

    const handleAddMedication = () => {
        // @ts-ignore
        router.push('/addmedication');
    };

    // Compute stats for header
    const takenCount = Object.values(medicationsByTime)
        .flat()
        .filter(m => m.status === 'taken').length;
    const totalCount = Object.values(medicationsByTime).flat().length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Crisp clean background */}
            <View style={StyleSheet.absoluteFill} />

            {/* ── Header ─────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={26} color={Colors.textPrimary} />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Medications</Text>
                    <Text style={styles.headerSubtitle}>
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                </View>

                <TouchableOpacity style={styles.addButton} onPress={handleAddMedication} activeOpacity={0.8}>
                    <Feather name="plus" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Progress bar if there are meds today */}
            {totalCount > 0 && (
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(takenCount / totalCount) * 100}%` as any }]} />
                </View>
            )}

            {/* ── Calendar Strip ─────────────────────────── */}
            <CalendarStrip
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                events={getCalendarEvents()}
            />

            {/* Full calendar link */}
            <TouchableOpacity style={styles.calendarLink} onPress={() => setShowCalendarModal(true)} activeOpacity={0.7}>
                <Feather name="calendar" size={13} color={Colors.textTertiary} />
                <Text style={styles.calendarLinkText}>Full Calendar</Text>
                <Feather name="chevron-right" size={13} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.sectionDivider} />

            {/* ── Medications Timeline ────────────────────── */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={ACCENT}
                    />
                }
            >
                {Object.keys(medicationsByTime).length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconBg}>
                            <MedicationIcon form="default" size={32} />
                        </View>
                        <Text style={styles.emptyTitle}>All clear</Text>
                        <Text style={styles.emptySubtitle}>No medications scheduled for this day.</Text>
                        <TouchableOpacity style={styles.emptyCta} onPress={handleAddMedication} activeOpacity={0.8}>
                            <Feather name="plus" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyCtaText}>Add Medication</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    Object.entries(medicationsByTime).map(([time, meds]) => {
                        const isNextDose = time === nextDoseTime;
                        let slotDoseIndex = 0;
                        return (
                            <View key={time} style={styles.timelineSlot}>
                                {/* Time header */}
                                <View style={styles.timeHeader}>
                                    <View style={styles.timeLabelRow}>
                                        <View style={[styles.timeAccentLine, isNextDose && styles.timeAccentLineNext]} />
                                        <Text style={[styles.timeText, isNextDose && styles.timeTextNext]}>
                                            {time}
                                        </Text>
                                    </View>

                                    {isNextDose && (
                                        <View style={styles.upNextBadge}>
                                            <View style={styles.pulseDot} />
                                            <Text style={styles.upNextText}>UP NEXT</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Medication cards */}
                                <View style={styles.medicationsList}>
                                    {meds.map((med) => {
                                        slotDoseIndex++;
                                        return (
                                            <MedicationCard
                                                key={`${med.id}-${med.scheduled_time}`}
                                                medication={med}
                                                doseNumber={slotDoseIndex}
                                                onTake={handleTakeMedication}
                                                onSkip={handleSkipMedication}
                                                onReschedule={handleReschedule}
                                            />
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Calendar Modal */}
            <CalendarModal
                visible={showCalendarModal}
                selectedDate={selectedDate}
                events={getCalendarEvents()}
                onClose={() => setShowCalendarModal(false)}
                onDateSelect={setSelectedDate}
                filterType="medication"
            />

            {/* Time Picker */}
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
        backgroundColor: '#FAFAF9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingTop: Sizes.sm,
        paddingBottom: Sizes.sm,
        backgroundColor: '#FAFAF9',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 1,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.textTertiary,
        letterSpacing: 0.1,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    progressBar: {
        height: 2,
        backgroundColor: Colors.gray100,
        marginHorizontal: Sizes.lg,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 2,
    },
    progressFill: {
        height: 2,
        backgroundColor: ACCENT,
        borderRadius: 2,
    },
    calendarLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Sizes.lg,
        paddingVertical: 8,
        alignSelf: 'flex-start',
    },
    calendarLinkText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: Colors.gray100,
        marginHorizontal: Sizes.lg,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Sizes.lg,
        paddingTop: Sizes.md,
        paddingBottom: Sizes.xl,
    },
    timelineSlot: {
        marginBottom: 28,
    },
    timeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    timeLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timeAccentLine: {
        width: 3,
        height: 20,
        borderRadius: 2,
        backgroundColor: Colors.gray200,
    },
    timeAccentLineNext: {
        backgroundColor: ACCENT,
    },
    timeText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    timeTextNext: {
        color: ACCENT,
    },
    upNextBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 6,
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        opacity: 0.9,
    },
    upNextText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.8,
    },
    medicationsList: {
        gap: 0,
    },
    emptyContainer: {
        paddingTop: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIconBg: {
        marginBottom: 20,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 40,
        marginBottom: 28,
        lineHeight: 20,
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyCtaText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
