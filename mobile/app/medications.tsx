import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Sizes, Typography } from '../src/constants';
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
    const { deleteAllMedications } = useMedicationsStore();
    const { scheduleAllForMedication } = useNotifications();
    const [selectedDate, setSelectedDate] = useState(getTodayLocal());
    const [showCalendarModal, setShowCalendarModal] = useState(false);

    const { medications, medicationsByTime, refreshing, onRefresh, markAsTaken } =
        useMedicationSync(selectedDate);
    const { clearAllLogsForUser } = useMedicationLogsStore();

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

    const handleDeleteAll = () => {
        if (!user?.id) return;
        Alert.alert(
            "Delete All Medications",
            "Are you sure you want to delete all your medications? This action cannot be undone and will also clear all log history.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete All", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            await deleteAllMedications(user.id);
                            await clearAllLogsForUser(user.id); // Add this hook
                            // Refresh local sync state immediately
                            onRefresh();
                        } catch (error) {
                            console.error('Failed to delete all medications or logs:', error);
                            Alert.alert("Error", "Could not delete medications. Please try again.");
                        }
                    } 
                }
            ]
        );
    };

    // ── Adherence Stats ────────────────────────────────────────────────────
    const allMedsForDay = Object.values(medicationsByTime).flat();
    const totalCount = allMedsForDay.length;
    const takenCount = allMedsForDay.filter(m => m.status === 'taken').length;
    const progressPercent = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient
                colors={['#EFF6FF', '#F8FAFC', '#FFFFFF']}
                style={StyleSheet.absoluteFill}
            />
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
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

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDeleteAll}
                        activeOpacity={0.7}
                    >
                        <Feather name="trash-2" size={20} color={Colors.error} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={handleAddMedication}
                        activeOpacity={0.7}
                    >
                        <Feather name="plus" size={24} color={Colors.white} />
                    </TouchableOpacity>
                </View>
            </View>


            {/* ── Calendar Selection Area ── */}
            <View style={styles.calendarStripContainer}>
                <CalendarStrip
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    events={getCalendarEvents()}
                />

                <TouchableOpacity style={styles.calendarBtn} onPress={() => setShowCalendarModal(true)} activeOpacity={0.75}>
                    <Feather name="calendar" size={14} color={Colors.primary} />
                    <Text style={styles.calendarBtnText}>View Full Calendar</Text>
                </TouchableOpacity>
            </View>

            {/* ── Segmented Edge-to-Edge Progress Indicator (Acts as Divider) ── */}
            {totalCount > 0 ? (
                <View style={styles.segmentedHeroContainer}>
                    <View style={styles.segmentedHeroHeader}>
                        <Text style={styles.segmentedHeroText}>
                            {takenCount === totalCount ? 'All Caught Up!' : `${takenCount} of ${totalCount} doses taken`}
                        </Text>
                        {takenCount === totalCount && (
                            <Feather name="check" size={14} color="#10B981" />
                        )}
                    </View>
                    <View style={styles.segmentedBarContainer}>
                        {Array.from({ length: totalCount }).map((_, i) => (
                            <View key={i} style={styles.segment}>
                                <LinearGradient
                                    colors={i < takenCount ? ['#10B981', '#34D399'] : ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.06)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFillObject}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            ) : (
                <View style={styles.hairline} />
            )}

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
                                <View style={styles.slotDivider} />
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

            <CalendarModal
                visible={showCalendarModal}
                selectedDate={selectedDate}
                events={getCalendarEvents()}
                onClose={() => setShowCalendarModal(false)}
                onDateSelect={setSelectedDate}
                filterType="medication"
            />

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
        backgroundColor: Colors.white,
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingTop: Sizes.md,
        paddingBottom: Sizes.md,
        backgroundColor: 'transparent',
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
        ...Typography.styles.h2,
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    headerSubtitle: {
        ...Typography.styles.bodySmall,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    deleteButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.error + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.gray200,
        width: '100%',
        opacity: 0.8,
    },

    // ── Calendar Strip Container ──
    calendarStripContainer: {
        backgroundColor: 'transparent',
        paddingBottom: 2,
    },
    calendarBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginHorizontal: Sizes.lg,
        marginTop: 2,
        marginBottom: 8,
        paddingVertical: 7,
        backgroundColor: Colors.primary + '0A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary + '1A',
    },
    calendarBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },

    // ── Segmented Progress Bar (Structural Divider) ──
    segmentedHeroContainer: {
        paddingBottom: 0,
        paddingTop: 8,
        width: '100%',
    },
    segmentedHeroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingHorizontal: Sizes.lg, // Keep text padded
    },
    segmentedHeroText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    segmentedBarContainer: {
        flexDirection: 'row',
        height: 6, // Sleeker 6px height
        width: '100%',
        gap: 1.5, // Tighter gap for cohesion
    },
    segment: {
        flex: 1,
        height: '100%',
        overflow: 'hidden',
    },

    // ── Hairline divider ────────────────────────────────────────────────────
    hairline: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.gray200,
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

    // ── Empty state ──
    emptyState: {
        alignItems: 'center',
        paddingTop: 64,
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
