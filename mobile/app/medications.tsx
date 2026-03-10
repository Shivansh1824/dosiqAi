import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../src/constants';
import { useRouter } from 'expo-router';
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

// ─── Helper: 12-hour time display ─────────────────────────────────────────────
const formatTime12h = (timeStr: string): string => {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

export default function MedicationsScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { scheduleAllForMedication } = useNotifications();
    const [selectedDate, setSelectedDate] = useState(getTodayLocal());
    const [showCalendarModal, setShowCalendarModal] = useState(false);

    const { medications, medicationsByTime, refreshing, onRefresh, markAsTaken } =
        useMedicationSync(selectedDate);

    // Rescheduling state
    const [reschedulingMed, setReschedulingMed] = useState<MedicationWithStatus | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // ── Next upcoming dose ──────────────────────────────────────────────────
    const getNextDoseTime = () => {
        const now = new Date();
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const isToday = toLocalDateString(selectedDate) === toLocalDateString(getTodayLocal());
        if (!isToday) return null;
        for (const time of Object.keys(medicationsByTime).sort()) {
            if (time > currentTimeStr && medicationsByTime[time].some(m => m.status === 'pending')) {
                return time;
            }
        }
        return null;
    };
    const nextDoseTime = getNextDoseTime();

    // ── Calendar events calculation ─────────────────────────────────────────
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
            case 'weekly': dayIncrement = 7; break;
            case 'monthly': dayIncrement = 30; break;
            case 'as_needed': return [];
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
            calculateMedicationOccurrences(med.start_date, med.end_date || null, med.frequency).forEach(dateStr => {
                if (!events[dateStr]) events[dateStr] = { type: 'medication', count: 0 };
                events[dateStr].count += 1;
            });
        });
        return events;
    };

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleTakeMedication = useCallback(async (medicationId: string, scheduledTime: string) => {
        if (!user?.id) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await markAsTaken(user.id, medicationId, toLocalDateString(selectedDate), scheduledTime);
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
    }, [user?.id, selectedDate, markAsTaken, medications]);

    const handleSkipMedication = useCallback(async (medicationId: string, scheduledTime: string) => {
        if (!user?.id) return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await useMedicationLogsStore.getState().markAsSkipped(user.id, medicationId, toLocalDateString(selectedDate), scheduledTime);
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
            console.error('Failed to skip medication:', error);
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
                if (updatedMed) {
                    await scheduleAllForMedication(updatedMed);
                }
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

    // ── Stats for header summary bar ────────────────────────────────────────
    const allMeds = Object.values(medicationsByTime).flat();
    const takenCount = allMeds.filter(m => m.status === 'taken').length;
    const totalCount = allMeds.length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Medications</Text>
                    <Text style={styles.headerSubtitle}>
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                    </Text>
                </View>

                <TouchableOpacity style={styles.addBtn} onPress={handleAddMedication} activeOpacity={0.7}>
                    <Feather name="plus" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.hairline} />

            {/* ── Progress bar (only when meds exist) ── */}
            {totalCount > 0 && (
                <View style={styles.progressRow}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${Math.round((takenCount / totalCount) * 100)}%` as any }]} />
                    </View>
                    <Text style={styles.progressLabel}>{takenCount}/{totalCount} taken</Text>
                </View>
            )}

            {/* ── Calendar strip ── */}
            <CalendarStrip
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                events={getCalendarEvents()}
            />

            {/* ── Full calendar button ── */}
            <TouchableOpacity style={styles.calendarBtn} onPress={() => setShowCalendarModal(true)} activeOpacity={0.75}>
                <Feather name="calendar" size={14} color={Colors.primary} />
                <Text style={styles.calendarBtnText}>View Full Calendar</Text>
            </TouchableOpacity>

            <View style={styles.hairline} />

            {/* ── Timeline content ── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {Object.keys(medicationsByTime).length === 0 ? (
                    /* ── Empty state ── */
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Feather name="check-circle" size={36} color={Colors.success} />
                        </View>
                        <Text style={styles.emptyTitle}>All Clear</Text>
                        <Text style={styles.emptySubtitle}>No medications scheduled{'\n'}for this day.</Text>
                        <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAddMedication} activeOpacity={0.8}>
                            <Feather name="plus" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.emptyAddBtnText}>Add Medication</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    Object.entries(medicationsByTime).map(([time, meds]) => {
                        const isNext = time === nextDoseTime;
                        let slotIndex = 0;
                        return (
                            <View key={time} style={styles.timeSlot}>
                                {/* Slot header */}
                                <View style={styles.slotHeader}>
                                    <View style={styles.slotTimeWrap}>
                                        <View style={[styles.slotDot, isNext && styles.slotDotActive]} />
                                        <Text style={[styles.slotTime, isNext && styles.slotTimeActive]}>
                                            {formatTime12h(time)}
                                        </Text>
                                    </View>
                                    {isNext && (
                                        <View style={styles.nextBadge}>
                                            <Text style={styles.nextBadgeText}>UP NEXT</Text>
                                        </View>
                                    )}
                                    <Text style={styles.slotCount}>{meds.length} med{meds.length !== 1 ? 's' : ''}</Text>
                                </View>

                                {/* Divider line */}
                                <View style={styles.slotDivider} />

                                {/* Cards */}
                                <View style={styles.cardList}>
                                    {meds.map(med => {
                                        slotIndex++;
                                        return (
                                            <MedicationCard
                                                key={`${med.id}-${med.scheduled_time}`}
                                                medication={med}
                                                doseNumber={slotIndex}
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

            {/* ── Calendar modal ── */}
            <CalendarModal
                visible={showCalendarModal}
                selectedDate={selectedDate}
                events={getCalendarEvents()}
                onClose={() => setShowCalendarModal(false)}
                onDateSelect={setSelectedDate}
                filterType="medication"
            />

            {/* ── Time picker ── */}
            {showTimePicker && (
                <DateTimePicker
                    value={(() => {
                        const [h, m] = (reschedulingMed?.scheduled_time || '08:00').split(':').map(Number);
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
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
        backgroundColor: '#F8FAFC',
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: '#F8FAFC',
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.gray100,
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.4,
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.textSecondary,
        marginTop: 1,
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.primary + '12',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary + '20',
    },

    // ── Hairline divider ────────────────────────────────────────────────────
    hairline: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.gray200,
    },

    // ── Progress bar ────────────────────────────────────────────────────────
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingVertical: 10,
        gap: 10,
        backgroundColor: '#F8FAFC',
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: Colors.gray200,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.success,
        borderRadius: 4,
    },
    progressLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
        minWidth: 60,
        textAlign: 'right',
    },

    // ── Calendar button ─────────────────────────────────────────────────────
    calendarBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginHorizontal: Sizes.lg,
        marginTop: 10,
        marginBottom: 12,
        paddingVertical: 9,
        backgroundColor: Colors.primary + '0A',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.primary + '1A',
    },
    calendarBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
    },

    // ── Scroll / content ────────────────────────────────────────────────────
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: Sizes.md,
        paddingTop: Sizes.md,
        paddingBottom: Sizes.xl,
    },

    // ── Time slot ────────────────────────────────────────────────────────────
    timeSlot: {
        marginBottom: 28,
    },
    slotHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    slotTimeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    slotDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.gray300,
    },
    slotDotActive: {
        backgroundColor: Colors.primary,
    },
    slotTime: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    slotTimeActive: {
        color: Colors.primary,
    },
    nextBadge: {
        backgroundColor: Colors.primary + '14',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
    },
    nextBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: 0.8,
    },
    slotCount: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.textTertiary,
    },
    slotDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.gray200,
        marginBottom: 10,
    },
    cardList: {
        gap: 2,
    },

    // ── Empty state ─────────────────────────────────────────────────────────
    emptyState: {
        alignItems: 'center',
        paddingTop: 72,
        paddingBottom: 40,
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: Colors.successLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        fontWeight: '400',
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    emptyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '08',
    },
    emptyAddBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
});
