import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, ActivityIndicator, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { medicationColors } from '../types/medication';

import { useMedicationsStore } from '../store/medicationsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../hooks/useNotifications';
import * as Haptics from 'expo-haptics';
import { Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import DatePickerModal from '../components/DatePickerModal';
import { InfoModal } from '../components/InfoModal';
import { AddMedCoursePeriodSection as CoursePeriodSection } from '../components/medication/AddMedCoursePeriodSection';
import { AddMedReminderTimesSection as ReminderTimesSection } from '../components/medication/AddMedReminderTimesSection';
import AddReminderModal from '../components/medication/AddReminderModal';
import UnitPickerModal from '../components/UnitPickerModal';
import { SuccessAnimation } from '../components/ui/SuccessAnimation';
import { calculateEndDate, parseDateOnly } from '../utils/medicationParser';
import { normalizeTime } from '../types/medicationSchedule';

export default function AddMedicationScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const { addMedication } = useMedicationsStore();
    const { familyMembers, ensurePrimaryMemberExists } = useFamilyMembersStore();
    const { scheduleAllForMedication } = useNotifications();
    
    // Core Details
    const [name, setName] = useState('');
    const [strengthValue, setStrengthValue] = useState('');
    const [strengthUnit, setStrengthUnit] = useState('mg');
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');

    // UI States
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showErrors, setShowErrors] = useState(false);
    
    // Focus States
    const [isNameFocused, setIsNameFocused] = useState(false);
    const [isStrengthFocused, setIsStrengthFocused] = useState(false);

    // Schedule & Reminder State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    // Default Duration: 3 Days (Current + 2 days)
    const [endDate, setEndDate] = useState(calculateEndDate(new Date().toISOString().split('T')[0], 3));
    const [hasEndDate, setHasEndDate] = useState(true);
    const [interval, setInterval] = useState(1); // 1 = Daily
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    // Reminders
    // Default: NO reminders set initially (User must add them)
    // Was: ['09:00'] -> Now []
    const [customReminderTimes, setCustomReminderTimes] = useState<string[]>([]);
    const [reminderToggles, setReminderToggles] = useState<boolean[]>([]);
    const [reminderDefaultNotes, setReminderDefaultNotes] = useState<Record<string, string>>({});
    const [customMealLabels, setCustomMealLabels] = useState<Record<string, string>>({});
    const [inactiveReminders, setInactiveReminders] = useState<string[]>([]);
    const [showAddReminderModal, setShowAddReminderModal] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Info Modals State
    const [activeInfo, setActiveInfo] = useState<'medDetails' | 'coursePeriod' | 'doseSchedule' | null>(null);

    // Handlers
    const getReminderTimes = () => customReminderTimes;

    const handleReminderToggleChange = (index: number, value: boolean) => {
        const newToggles = [...reminderToggles];
        while (newToggles.length <= index) newToggles.push(false);
        newToggles[index] = value;
        setReminderToggles(newToggles);
    };

    const handleTimeChange = (oldTime: string, newTime: string) => {
        const currentTimes = [...customReminderTimes];
        const index = currentTimes.indexOf(oldTime);
        if (index !== -1) {
            currentTimes[index] = newTime;
        } else {
            currentTimes.push(newTime);
        }
        currentTimes.sort();
        setCustomReminderTimes(currentTimes);
    };

    const handleBatchToggle = (batchId: string, isEnabled: boolean, defaultTime: string) => {
        const currentTimes = [...customReminderTimes];
        const normalizedDefault = normalizeTime(defaultTime);
        
        let updatedTimes = currentTimes;

        if (isEnabled) {
            if (!updatedTimes.some(t => normalizeTime(t) === normalizedDefault)) {
                updatedTimes.push(defaultTime);
                updatedTimes.sort();
            }
             if (inactiveReminders.some(t => normalizeTime(t) === normalizedDefault)) {
                setInactiveReminders(prev => prev.filter(t => normalizeTime(t) !== normalizedDefault));
            }
        } else {
             updatedTimes = updatedTimes.filter(t => normalizeTime(t) !== normalizedDefault);
             if (!inactiveReminders.some(t => normalizeTime(t) !== normalizedDefault)) {
                setInactiveReminders(prev => [...prev, defaultTime]);
            }
        }
        setCustomReminderTimes(updatedTimes);
        if (updatedTimes.length > 0 && errors.reminderTimes) setErrors(prev => ({ ...prev, reminderTimes: '' }));
        // Optimistic toggle sync (all on)
        setReminderToggles(new Array(updatedTimes.length).fill(true));
    };

    const handleAddReminderObject = (time: string, mealLabel: string | null) => {
        const currentTimes = [...customReminderTimes];
        const normalizedNewTime = normalizeTime(time);

        if (currentTimes.some(t => normalizeTime(t) === normalizedNewTime)) {
            if (mealLabel !== null) {
                setCustomMealLabels(prev => ({ ...prev, [normalizedNewTime]: mealLabel }));
            }
            return;
        }

        const updatedTimes = [...currentTimes, time].sort();
        setCustomReminderTimes(updatedTimes);
        if (errors.reminderTimes) setErrors(prev => ({ ...prev, reminderTimes: '' }));

        if (inactiveReminders.some(t => normalizeTime(t) === normalizedNewTime)) {
             setInactiveReminders(prev => prev.filter(t => normalizeTime(t) !== normalizedNewTime));
        }

        setReminderToggles(prev => [...prev, true]);

        if (mealLabel !== null) {
             setCustomMealLabels(prev => ({ ...prev, [time]: mealLabel }));
             setReminderDefaultNotes(prev => ({ ...prev, [time]: mealLabel }));
        }
    };

    const handleDefaultNoteChange = (time: string, note: string) => {
        setReminderDefaultNotes(prev => ({ ...prev, [time]: note }));
    };

    const handleIntervalChange = (days: number) => {
        setInterval(days);
    };

    // Initialize
    useEffect(() => {
        const initMember = async () => {
            if (familyMembers.length === 0 && user?.id) {
                 const primary = await ensurePrimaryMemberExists(user.id, user.name || 'Me');
                 if (primary) setSelectedMemberId(primary.id);
            } else if (!selectedMemberId && familyMembers.length > 0) {
                 const self = familyMembers.find(m => m.relationship === 'Self');
                 setSelectedMemberId(self ? self.id : familyMembers[0].id);
            }
        };
        initMember();
    }, [user]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Medicine name is required';
        }

        if (customReminderTimes.length === 0) {
            newErrors.reminderTimes = 'At least one reminder time is required';
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!user?.id) {
            alert('User not authenticated');
            return;
        }

        const isValid = validateForm();
        if (!isValid) {
            setShowErrors(true);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (!selectedMemberId) {
             alert('Please select a family member');
             return;
        }

        // Calculate duration and prepare formatted notes
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const calculatedDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Format per-time notes
        const formattedNotes = Object.entries(reminderDefaultNotes)
            .filter(([_, note]) => note && note.trim().length > 0)
            .map(([time, note]) => `${time}: ${note}`)
            .join('\n');

        const medication = {
            user_id: user.id,
            family_member_id: selectedMemberId,
            name,
            scientific_name: '',
            medicine_type: null,
            medicine_purpose: '',
            form: null,
            strength: strengthValue ? `${strengthValue} ${strengthUnit}` : '',
            dosage: '',
            frequency: interval === 1 ? 'daily' : 'interval', 
            time_of_day: customReminderTimes,
            interval_days: interval,
            times_per_day: customReminderTimes.length,
            start_date: startDate,
            end_date: hasEndDate ? endDate : null,
            duration_days: hasEndDate ? calculatedDuration : null,
            food_relationship: null,
            notes: formattedNotes || '',
            reminder_enabled: customReminderTimes.length > 0,
            instructions: '', 
            color: medicationColors[0], 
        };

        try {
            // Optimistic Update: Show Success Immediately
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowSuccess(true); 

            // Perform Async Operations in Background
            // We don't await here to keep the UI unblocked. 
            // The SuccessAnimation duration (~2s) covers this time.
            addMedication(medication as any).then(async (newMed) => {
                 if (newMed) {
                    await scheduleAllForMedication(newMed);
                 }
            }).catch(error => {
                 console.error('Failed to add medication in background:', error);
                 // Optional: Revert success state or show alert if critical
                 // alert('Failed to save. Please try again.');
            });

        } catch (error) {
            console.error('Failed to initiate add medication:', error);
            alert('Failed to add medication. Please try again.');
        }
    };

    




// ... (existing imports)

    return (
        <View style={styles.container}>
            {/* Ambient Background - Standardized */}
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient
                    colors={['#F8FAFC', '#EFF6FF', '#FFFFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />
            </View>

            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Elite H-Level Header */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Add Medicine</Text>
                        <Text style={styles.headerSubtitle}>
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </Text>
                    </View>

                    <TouchableOpacity 
                        style={styles.doneButton}
                        onPress={handleSave}
                        activeOpacity={0.7}
                    >
                        <Feather name="check" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
                <View style={{ height: 1.5, backgroundColor: Colors.gray200, width: '100%' }} />

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: Sizes.xl }}
            >

                {/* Medication Details */}
                <Animated.View style={[styles.section, { marginTop: 24 }]}>
                    <View style={[styles.sectionHeader, { gap: 6, marginBottom: 0 }]}>
                        <MaterialCommunityIcons name="pill" size={14} color={Colors.primary} />
                        <Text style={styles.sectionTitle}>MED DETAILS</Text>
                        <TouchableOpacity 
                            onPress={() => setActiveInfo('medDetails')} 
                            hitSlop={10}
                            style={{ marginLeft: 4, padding: 2 }}
                        >
                            <Feather name="info" size={16} color={Colors.gray400} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.premiumInputCard}>
                        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                        <View style={styles.inputLabelRow}>
                            <Text style={styles.premiumLabel}>Medicine Name *</Text>
                            {name ? <Feather name="check" size={14} color={Colors.success} /> : null}
                        </View>
                        <View style={[
                            styles.inputContainer, 
                            isNameFocused && styles.auraFocus,
                            showErrors && errors.name && styles.inputError
                        ]}>
                            <TextInput
                                style={styles.premiumTextInput}
                                placeholder="e.g., Amoxicillin"
                                placeholderTextColor={Colors.textTertiary}
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                                }}
                                onFocus={() => setIsNameFocused(true)}
                                onBlur={() => setIsNameFocused(false)}
                                // autoFocus={true} // Removed to prevent "multi-cursor" rendering glitch on entry
                            />
                        </View>
                        {showErrors && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                        <View style={styles.inputLabelRow}>
                            <Text style={[styles.premiumLabel, { marginTop: Sizes.md }]}>Strength (Optional)</Text>
                        </View>
                        <View style={[styles.combinedInputContainer, isStrengthFocused && styles.auraFocus]}>
                            <TextInput
                                style={styles.inputUnstyled}
                                placeholder="e.g., 500"
                                placeholderTextColor={Colors.textTertiary}
                                keyboardType="numeric"
                                value={strengthValue}
                                onChangeText={setStrengthValue}
                                onFocus={() => setIsStrengthFocused(true)}
                                onBlur={() => setIsStrengthFocused(false)}
                            />
                            <View style={styles.verticalDivider} />
                            <TouchableOpacity 
                                style={styles.unitSelector}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowUnitPicker(true);
                                }}
                            >
                                <Text style={styles.unitSelectorText}>{strengthUnit}</Text>
                                <Feather name="chevron-down" size={16} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>


                </Animated.View>

                {/* Course Period & Schedule */}
                <Animated.View entering={FadeInDown.delay(300)}>
                     <CoursePeriodSection
                        startDate={startDate}
                        endDate={endDate}
                        interval={interval}
                        onStartDatePress={() => setShowDatePicker(true)}
                        onEndDatePress={() => setShowEndDatePicker(true)}
                        onIntervalChange={handleIntervalChange}
                        hasEndDate={hasEndDate}
                        onToggleEndDate={setHasEndDate}
                        onInfoPress={() => setActiveInfo('coursePeriod')}
                    />

                    <ReminderTimesSection
                        reminderTimes={getReminderTimes()}
                        intervalText={interval === 1 ? 'Daily' : `Every ${interval} Days`}
                        medicineName={name || 'Medicine'}
                        reminderToggles={reminderToggles}
                        onToggleChange={handleReminderToggleChange}
                        onTimeChange={handleTimeChange}
                        defaultNotes={reminderDefaultNotes}
                        onDefaultNoteChange={handleDefaultNoteChange}
                        onAddPress={() => setShowAddReminderModal(true)}
                        customMealLabels={customMealLabels}
                        onBatchToggle={handleBatchToggle}
                        onUpdateReminderTimes={(newTimes) => {
                            setCustomReminderTimes(newTimes);
                            if (newTimes.length > 0 && errors.reminderTimes) setErrors(prev => ({ ...prev, reminderTimes: '' }));
                            setReminderToggles(new Array(newTimes.length).fill(true));
                        }}
                        inactiveReminderTimes={inactiveReminders}
                        onDeleteCustomReminder={(time) => {
                            const currentTimes = [...customReminderTimes];
                            if (currentTimes.includes(time)) {
                                const updatedTimes = currentTimes.filter(t => t !== time);
                                setCustomReminderTimes(updatedTimes);
                            }
                            if (inactiveReminders.includes(time)) {
                                setInactiveReminders(prev => prev.filter(t => t !== time));
                            }
                        }}
                        preferredTimes={{
                            morning: familyMembers.find(m => m.id === selectedMemberId)?.morning_dose_time || '08:00',
                            afternoon: familyMembers.find(m => m.id === selectedMemberId)?.afternoon_dose_time || '14:00',
                            night: familyMembers.find(m => m.id === selectedMemberId)?.night_dose_time || '21:00',
                        }}
                        suppressDefaultBatches={true}
                        error={showErrors ? errors.reminderTimes : undefined}
                        onInfoPress={() => setActiveInfo('doseSchedule')}
                    />
                </Animated.View>

                {/* Modals */}
                 <DatePickerModal
                    visible={showDatePicker}
                    date={startDate}
                    onConfirm={(date) => {
                        setStartDate(date);
                        setShowDatePicker(false);
                    }}
                    onCancel={() => setShowDatePicker(false)}
                    minimumDate={new Date().toISOString().split('T')[0]}
                />

                <DatePickerModal
                    visible={showEndDatePicker}
                    date={endDate}
                    onConfirm={(date) => {
                        setEndDate(date);
                        setHasEndDate(true);
                        setShowEndDatePicker(false); 
                    }}
                    onCancel={() => setShowEndDatePicker(false)}
                    minimumDate={startDate}
                />

                {/* Info Modals */}
                <InfoModal
                    visible={activeInfo === 'medDetails'}
                    onClose={() => setActiveInfo(null)}
                    title="Medicine Details"
                    hideIcon={true}
                    content={[
                        {
                            label: 'What is this?',
                            text: 'Basic information about the medication such as name, strength, and type.'
                        },
                        {
                            label: 'Behavior',
                            text: 'This information helps identify the medication and ensure correct dosage tracking.'
                        }
                    ]}
                />
                <InfoModal
                    visible={activeInfo === 'coursePeriod'}
                    onClose={() => setActiveInfo(null)}
                    title="Course Period"
                    hideIcon={true}
                    content={[
                        {
                            label: 'What is this?',
                            text: 'The start and end dates for your medication regimen.'
                        },
                        {
                            label: 'Behavior',
                            text: 'Reminders will be scheduled within this date range. If no end date is set, it will continue indefinitely.'
                        }
                    ]}
                />
                <InfoModal
                    visible={activeInfo === 'doseSchedule'}
                    onClose={() => setActiveInfo(null)}
                    title="Dose Schedule"
                    hideIcon={true}
                    content={[
                        {
                            label: 'What is this?',
                            text: 'The specific times of day you need to take your medication.'
                        },
                        {
                            label: 'Behavior',
                            text: 'Notifications will be sent at these exact times locally on your device.'
                        }
                    ]}
                />


                <AddReminderModal
                    visible={showAddReminderModal}
                    onClose={() => setShowAddReminderModal(false)}
                    onAdd={handleAddReminderObject}
                    existingTimes={customReminderTimes}
                />

                <UnitPickerModal
                    visible={showUnitPicker}
                    onClose={() => setShowUnitPicker(false)}
                    onSelect={(unit) => {
                        setStrengthUnit(unit);
                        setShowUnitPicker(false);
                    }}
                    selectedUnit={strengthUnit}
                />

            </ScrollView>

            <SuccessAnimation 
                visible={showSuccess} 
                onAnimationFinish={() => navigation.goBack()} 
            />


            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.white },
    ambientBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 400,
        opacity: 0.6,
    },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: Sizes.lg,
        paddingVertical: Sizes.md,
        backgroundColor: 'transparent',
    },
    backButton: { 
        width: 44, 
        height: 44, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginLeft: -10,
    },
    headerContent: { 
        flex: 1,
        marginLeft: Sizes.xs,
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
    doneButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerStatusContainer: { width: 80, height: 32, justifyContent: 'center', alignItems: 'flex-end' },
    statusIndicator: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors.gray50, 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 10, 
        gap: 4 
    },
    statusText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
    
    content: { flex: 1, paddingHorizontal: 0, backgroundColor: 'rgba(255,255,255,0.6)' },
    section: { marginTop: 15, width: '100%' },

    
    label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
    premiumLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    memberScrollContent: { paddingHorizontal: Sizes.lg, paddingBottom: 5 },
    memberCard: {
        width: 85,
        height: 100,
        backgroundColor: Colors.white,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: Colors.gray100,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    memberCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '05',
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    memberAvatarActive: { backgroundColor: Colors.primary },
    memberCardName: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
    memberCardNameSelected: { color: Colors.primary, fontWeight: '700' },
    memberCheckmark: { position: 'absolute', top: 6, right: 6 },

    premiumInputCard: {
        paddingVertical: 24,
        paddingHorizontal: 16,
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
    },
    inputLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 4, // Slight inset for labels
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white, // Solid White
        borderRadius: 16,
        paddingHorizontal: 16, // Increased padding
        height: 56, // Fixed height for consistency
        borderWidth: 1,
        borderColor: Colors.gray100, // Subtle border
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.03, // Very subtle shadow
        shadowRadius: 8,
        elevation: 2,
    },
    input: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, fontSize: 16, borderWidth: 1, borderColor: Colors.gray200 },
    inputError: { borderColor: Colors.error },
    premiumTextInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.textPrimary,
        fontWeight: '500',
        height: '100%', // Fill container
    },
    errorText: { color: Colors.error, fontSize: 12, marginTop: 4, fontWeight: '500' },

    combinedInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors.white, // Solid White
        borderRadius: 16, 
        overflow: 'hidden',
        height: 56, // Fixed height
        borderWidth: 1,
        borderColor: Colors.gray100,
        // Shadow matches above
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    inputUnstyled: { flex: 1, height: '100%', paddingHorizontal: 16, fontSize: 16, color: Colors.textPrimary },
    verticalDivider: { width: 1, height: '60%', backgroundColor: Colors.gray100 },
    unitSelector: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        gap: 6,
        height: '100%', 
        justifyContent: 'center',
        backgroundColor: 'transparent', // Integrated look
    },
    unitSelectorText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },

    selectedTypeText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    typeScrollContent: { paddingHorizontal: 20, paddingBottom: 5, paddingTop: 4 },
    typeCard: {
        width: 85,
        height: 100,
        backgroundColor: Colors.white,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1.5,
        borderColor: Colors.gray100,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    typeCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '05',
    },
    typeCardError: { borderColor: Colors.error },
    typeIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    typeIconContainerActive: { backgroundColor: Colors.primary },
    typeCardLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
    typeCardLabelSelected: { color: Colors.primary, fontWeight: '700' },



    // Standardized Header Styles matching CoursePeriodSection
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 20, // Slightly more padding for the "floating" feel
    },
    sectionTitle: {
        fontSize: 16,
        ...Typography.fontWeights.extrabold,
        color: Colors.gray600,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },

    customSummaryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary + '05', borderRadius: 16, padding: 16, borderColor: Colors.primary + '20', borderWidth: 1, marginTop: 8 },
    customSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    customSummaryIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
    customSummaryTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
    customSummaryText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    helperText: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
    closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: Colors.gray50 },
    auraFocus: {
        borderColor: Colors.primary,
        // Shadow removed to prevent layout trashing/flicker on input focus
        // shadowColor: Colors.primary,
        // shadowOffset: { width: 0, height: 4 },
        // shadowOpacity: 0.2,
        // shadowRadius: 12, 
        // elevation: 8,
    },
});
