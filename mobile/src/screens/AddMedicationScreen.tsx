import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Switch, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { MedicationFrequency, FoodRelationship, medicationColors } from '../types/medication';
import { MEDICINE_TYPE_DEFAULTS } from '../constants/medicationDefaults';
import { useMedicationsStore } from '../store/medicationsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { MedicationIcon, ICON_THEMES } from '../components/medication/MedicationIcons';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import TimePickerModal from '../components/TimePickerModal';
import DatePickerModal from '../components/DatePickerModal';
import { useNotifications } from '../hooks/useNotifications';
import * as Haptics from 'expo-haptics';
import { Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeOut, withSpring, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// Define MedicineType locally based on ICON_THEMES
type MedicineType = keyof typeof ICON_THEMES;

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
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [selectedType, setSelectedType] = useState<MedicineType>('tablet');
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');

    // Schedule
    const [intervalDays, setIntervalDays] = useState('1');
    const [frequency, setFrequency] = useState<MedicationFrequency | 'specific_interval' | 'manual'>('once_daily');
    const [timesPerDay, setTimesPerDay] = useState(1);
    const [reminderTimes, setReminderTimes] = useState<Date[]>([]);
    
    // Instructions
    const [foodRelationship, setFoodRelationship] = useState<FoodRelationship>('anytime');
    const [notes, setNotes] = useState('');

    // Duration
    const [isContinuous, setIsContinuous] = useState(true);
    const [durationDays, setDurationDays] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState<Date | null>(null);

    // UI States
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState<{show: boolean, index: number}>({show: false, index: -1});
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [groupSaveStatus, setGroupSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showErrors, setShowErrors] = useState(false);
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customSaveStatus, setCustomSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isNameFocused, setIsNameFocused] = useState(false);
    const [isStrengthFocused, setIsStrengthFocused] = useState(false);

    const isInternalSync = React.useRef(false);
    const isInitialGroupMount = React.useRef(true);
    const isInitialCustomMount = React.useRef(true);

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

    const parseTime = (timeStr?: string) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setFullYear(2025, 0, 1);
        d.setHours(h, m, 0, 0);
        return d;
    };
    
    const activeMember = familyMembers.find(m => m.id === selectedMemberId);
    const memberDoseTimes = useMemo(() => ({
        morning: activeMember?.morning_dose_time,
        afternoon: activeMember?.afternoon_dose_time,
        night: activeMember?.night_dose_time
}), [activeMember?.morning_dose_time, activeMember?.afternoon_dose_time, activeMember?.night_dose_time]);

// 1. Frequency -> TimesPerDay & Groups & Reminder Times
    useEffect(() => {
        if (isInternalSync.current) return;
        let newTimesPerDay = timesPerDay;
        let newIntervalDays = intervalDays;
        let newGroups = [...selectedGroups];
        let newTimes = [...reminderTimes];
        let syncNeeded = false;

        const candidates = [
            { id: 'morning', val: parseTime(memberDoseTimes.morning) || parseTime("08:00:00") },
            { id: 'afternoon', val: parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00") },
            { id: 'night', val: parseTime(memberDoseTimes.night) || parseTime("21:00:00") }
        ];
        
        if (frequency === 'once_daily' || frequency === 'weekly' || frequency === 'monthly') { 
            newTimesPerDay = 1; 
            newIntervalDays = frequency === 'weekly' ? '7' : (frequency === 'monthly' ? '30' : '1'); 
            newGroups = ['morning'];
            newTimes = [candidates[0].val!];
            syncNeeded = true;
        }
        else if (frequency === 'twice_daily') { 
            newTimesPerDay = 2; 
            newIntervalDays = '1'; 
            newGroups = ['morning', 'night'];
            newTimes = [candidates[0].val!, candidates[2].val!].sort((a,b) => a.getTime() - b.getTime());
            syncNeeded = true;
        }
        else if (frequency === 'three_times_daily') { 
            newTimesPerDay = 3; 
            newIntervalDays = '1'; 
            newGroups = ['morning', 'afternoon', 'night'];
            newTimes = candidates.map(c => c.val!).filter(v => !!v).sort((a,b) => a.getTime() - b.getTime()) as Date[];
            syncNeeded = true;
        }
        else if (frequency === 'as_needed') { 
            newTimesPerDay = 1; 
            newIntervalDays = '0'; 
            syncNeeded = newTimesPerDay !== timesPerDay || newIntervalDays !== intervalDays;
        }

        if (syncNeeded) {
            isInternalSync.current = true;
            setTimesPerDay(newTimesPerDay);
            setIntervalDays(newIntervalDays);
            if (['once_daily', 'twice_daily', 'three_times_daily', 'weekly', 'monthly'].includes(frequency)) {
                setSelectedGroups(newGroups);
                setReminderTimes(newTimes);
            }
            setTimeout(() => isInternalSync.current = false, 50);
        }
    }, [frequency, memberDoseTimes]);

    // 2. TimesPerDay -> Groups & Reminder Times
    useEffect(() => {
        if (isInternalSync.current) return;
        if (timesPerDay !== 0 && timesPerDay !== reminderTimes.length) {
            const morningBase = parseTime(memberDoseTimes.morning) || parseTime("08:00:00")!;
            const afternoonBase = parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00")!;
            const nightBase = parseTime(memberDoseTimes.night) || parseTime("21:00:00")!;

            const newTimes: Date[] = [];
            const newGroups: string[] = [];

            // Determine how many slots each group gets
            let mCount = 0, aCount = 0, nCount = 0;
            
            const count = timesPerDay;
            if (count === 1) { mCount = 1; }
            else if (count === 2) { mCount = 1; nCount = 1; }
            else if (count === 3) { mCount = 1; aCount = 1; nCount = 1; }
            else if (count === 4) { mCount = 2; aCount = 1; nCount = 1; }
            else if (count === 5) { mCount = 2; aCount = 2; nCount = 1; }
            else if (count === 6) { mCount = 2; aCount = 2; nCount = 2; }
            else if (count === 7) { mCount = 3; aCount = 2; nCount = 2; }
            else if (count === 8) { mCount = 3; aCount = 3; nCount = 2; }
            else if (count === 9) { mCount = 3; aCount = 3; nCount = 3; }
            else {
                // For > 9, distribute evenly
                const base = Math.floor(count / 3);
                const extra = count % 3;
                mCount = base + (extra >= 1 ? 1 : 0);
                aCount = base + (extra >= 2 ? 1 : 0);
                nCount = base;
            }

            const addSlots = (base: Date, num: number, groupId: string) => {
                if (num > 0 && !newGroups.includes(groupId)) newGroups.push(groupId);
                for (let i = 0; i < num; i++) {
                    const t = new Date(base.getTime());
                    if (num <= 2) {
                        t.setMinutes(t.getMinutes() + i * 60);
                    } else {
                        t.setMinutes(t.getMinutes() + i * 30);
                    }
                    newTimes.push(t);
                }
            };

            addSlots(morningBase, mCount, 'morning');
            addSlots(afternoonBase, aCount, 'afternoon');
            addSlots(nightBase, nCount, 'night');

            newTimes.sort((a, b) => a.getTime() - b.getTime());
            
            isInternalSync.current = true;
            setReminderTimes(newTimes);
            setSelectedGroups(newGroups);
        } else if (isInternalSync.current) {
            // If internal sync is already true, don't start a new one but don't stop mapping freq
        } else {
            isInternalSync.current = true;
        }

        // Atomic Frequency Update - Runs even if count matches to catch manual-to-custom-to-preset cases
        let detectedFreq: MedicationFrequency | 'specific_interval' | 'manual' = 'specific_interval';
        const count = timesPerDay;
        
        if (count === 0) {
            detectedFreq = 'manual'; // No chip selected
        } else if (intervalDays === '7') {
            detectedFreq = 'weekly';
        } else if (intervalDays === '1') {
            if (count === 1) detectedFreq = 'once_daily';
            else if (count === 2) detectedFreq = 'twice_daily';
            else if (count === 3) detectedFreq = 'three_times_daily';
        }
        
        if (detectedFreq !== frequency) {
            setFrequency(detectedFreq);
        }

        setTimeout(() => isInternalSync.current = false, 50);
    }, [timesPerDay, intervalDays, memberDoseTimes, frequency]);


    // 3. Groups -> Reminder Times & TimesPerDay & Frequency
    useEffect(() => {
        if (isInternalSync.current) return;
        const newTimes: Date[] = [];
        const candidates = [
            { id: 'morning', val: parseTime(memberDoseTimes.morning) || parseTime("08:00:00") },
            { id: 'afternoon', val: parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00") },
            { id: 'night', val: parseTime(memberDoseTimes.night) || parseTime("21:00:00") }
        ];

        selectedGroups.forEach(gid => {
            const cand = candidates.find(c => c.id === gid);
            if (cand?.val) newTimes.push(cand.val);
        });

        // Also keep any non-standard times that were manually added? 
        // For simplicity with "Group" sync, we let groups manage the list.
        
        newTimes.sort((a, b) => a.getTime() - b.getTime());
        
        isInternalSync.current = true;
        setReminderTimes(newTimes);
        
        // Update frequency label based on count and interval
        if (newTimes.length === 0) setFrequency('manual');
        else if (intervalDays === '7') setFrequency('weekly');
        else if (intervalDays === '1') {
            if (newTimes.length === 1) setFrequency('once_daily');
            else if (newTimes.length === 2) setFrequency('twice_daily');
            else if (newTimes.length === 3) setFrequency('three_times_daily');
            else setFrequency('specific_interval');
        } else {
            setFrequency('specific_interval');
        }

        setTimeout(() => isInternalSync.current = false, 50);
    }, [selectedGroups, memberDoseTimes]);

    // 4. ReminderTimes -> SelectedGroups & TimesPerDay & Frequency
    useEffect(() => {
        if (isInternalSync.current) return;
        
        const candidates = [
            { id: 'morning', val: parseTime(memberDoseTimes.morning) || parseTime("08:00:00") },
            { id: 'afternoon', val: parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00") },
            { id: 'night', val: parseTime(memberDoseTimes.night) || parseTime("21:00:00") }
        ];

        const newGroups: string[] = [];
        reminderTimes.forEach(t => {
            candidates.forEach(c => {
                if (c.val && t.getHours() === c.val.getHours() && t.getMinutes() === c.val.getMinutes()) {
                    if (!newGroups.includes(c.id)) newGroups.push(c.id);
                }
            });
        });

        isInternalSync.current = true;
        setSelectedGroups(newGroups);
        setTimesPerDay(reminderTimes.length);
        
        // Auto-select frequency label based on count and interval
        if (reminderTimes.length === 0) setFrequency('manual');
        else if (intervalDays === '7') setFrequency('weekly');
        else if (intervalDays === '1') {
            if (reminderTimes.length === 1) setFrequency('once_daily');
            else if (reminderTimes.length === 2) setFrequency('twice_daily');
            else if (reminderTimes.length === 3) setFrequency('three_times_daily');
            else setFrequency('specific_interval');
        } else {
            setFrequency('specific_interval');
        }

        setTimeout(() => isInternalSync.current = false, 50);
    }, [reminderTimes, intervalDays, memberDoseTimes]);

    // 5. Watch for group changes to show saving effect
    useEffect(() => {
        if (showGroupPicker) {
            if (isInitialGroupMount.current) {
                isInitialGroupMount.current = false;
                return;
            }
            
            setGroupSaveStatus('saving');
            const timer = setTimeout(() => {
                setGroupSaveStatus('saved');
                setTimeout(() => setGroupSaveStatus('idle'), 1500);
            }, 800);
            return () => clearTimeout(timer);
        } else {
            isInitialGroupMount.current = true;
            setGroupSaveStatus('idle');
        }
    }, [selectedGroups, showGroupPicker]);
    // 6. Watch for custom schedule changes to show saving effect
    useEffect(() => {
        if (showCustomModal) {
            if (isInitialCustomMount.current) {
                isInitialCustomMount.current = false;
                return;
            }
            
            setCustomSaveStatus('saving');
            const timer = setTimeout(() => {
                setCustomSaveStatus('saved');
                
                // Debounced Auto-Close: Close modal automatically for ANY valid schedule
                // after the user has seen the "Saved" indicator for a moment.
                const closeTimer = setTimeout(() => {
                    setShowCustomModal(false);
                }, 1200);
                
                const idleTimer = setTimeout(() => setCustomSaveStatus('idle'), 1500);
                
                return () => {
                    clearTimeout(closeTimer);
                    clearTimeout(idleTimer);
                };
            }, 800);
            return () => clearTimeout(timer);
        } else {
            isInitialCustomMount.current = true;
            setCustomSaveStatus('idle');
        }
    }, [timesPerDay, intervalDays, showCustomModal]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Medicine name is required';
        }

        if (!selectedType) {
            newErrors.type = 'Medicine type is required';
        }

        if (frequency === 'specific_interval') {
            if (!timesPerDay || timesPerDay <= 0) {
                newErrors.timesPerDay = 'Times per day is required';
            }
            if (!intervalDays || parseInt(intervalDays) <= 0) {
                newErrors.intervalDays = 'Interval (Days) is required';
            }
        }

        if (reminderTimes.length === 0) {
            newErrors.reminderTimes = 'At least one reminder time is required';
        }

        if (!isContinuous && !endDate) {
            newErrors.endDate = 'End date is required for non-continuous treatment';
        }

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

        const medication = {
            user_id: user.id,
            family_member_id: selectedMemberId,
            name,
            scientific_name: '',
            medicine_type: selectedType,
            medicine_purpose: '',
            form: selectedType,
            strength: strengthValue ? `${strengthValue} ${strengthUnit}` : '',
            dosage: '',
            frequency: (frequency === 'specific_interval' ? 'custom' : frequency) as any,
            time_of_day: reminderTimes.map(d => {
                const hh = d.getHours().toString().padStart(2, '0');
                const mm = d.getMinutes().toString().padStart(2, '0');
                return `${hh}:${mm}`;
            }),
            interval_days: parseInt(intervalDays) || 1,
            times_per_day: timesPerDay,
            start_date: startDate.toISOString().split('T')[0],
            end_date: (!isContinuous && endDate) ? endDate.toISOString().split('T')[0] : undefined,
            duration_days: (!isContinuous && durationDays) ? parseInt(durationDays) : undefined,
            food_relationship: foodRelationship,
            notes,
            reminder_enabled: true,
            instructions: notes || '', 
            color: medicationColors[0], // Required by type, though calculated on-the-fly by store
        };

        try {
            const newMed = await addMedication(medication);
            if (newMed) {
                await scheduleAllForMedication(newMed);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            navigation.goBack();
        } catch (error) {
            console.error('Failed to add medication:', error);
            alert('Failed to add medication. Please try again.');
        }
    };

    const resetForm = () => {
        isInternalSync.current = true;
        setName('');
        setStrengthValue('');
        setSelectedType('tablet');
        setFrequency('once_daily');
        setTimesPerDay(1);
        const morningT = parseTime(memberDoseTimes.morning) || parseTime("08:00:00");
        setReminderTimes(morningT ? [morningT] : []);
        setSelectedGroups(['morning']);
        setIsContinuous(true);
        setDurationDays('');
        setStartDate(new Date());
        setEndDate(null);
        setFoodRelationship('anytime');
        setNotes('');
        setShowSuggestions(false);
        setErrors({});
        setShowErrors(false);
        setTimeout(() => isInternalSync.current = false, 100);
    };

    const availableTypes = Object.keys(ICON_THEMES).filter(t => t !== 'default');
    
    const onStartDateChange = (dateStr: string) => {
        setStartDate(new Date(dateStr));
        setShowStartDatePicker(false);
    };
    
    const onEndDateChange = (dateStr: string) => {
        setEndDate(new Date(dateStr));
        setShowEndDatePicker(false);
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        const idx = showTimePicker.index;
        setShowTimePicker({show: false, index: -1});

        if (selectedDate) {
            const newTimes = [...reminderTimes];
            if (idx === reminderTimes.length) {
                newTimes.push(selectedDate);
            } else if (idx >= 0 && idx < reminderTimes.length) {
                newTimes[idx] = selectedDate;
            }
            newTimes.sort((a, b) => a.getTime() - b.getTime());
            setReminderTimes(newTimes);
        }
    };

    const handleAddTime = () => {
        setShowTimePicker({ show: true, index: reminderTimes.length });
    };

    const handleRemoveTime = (index: number) => {
        const newTimes = [...reminderTimes];
        newTimes.splice(index, 1);
        setReminderTimes(newTimes);
    };

    const getNextDefaultTime = () => {
        const nextTime = new Date();
        nextTime.setHours(8, 0, 0, 0); 
        if (reminderTimes.length > 0) {
            const lastTime = reminderTimes[reminderTimes.length - 1];
            nextTime.setTime(lastTime.getTime());
            nextTime.setHours(lastTime.getHours() + 1);
        }
        return nextTime;
    };

    return (
        <View style={styles.container}>
            {/* Ambient Background */}
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient
                    colors={['#F8FAFC', '#EFF6FF', '#FFFFFF']}
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

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: Sizes.xl }}
            >
                {/* Family Member Selection */}
                {familyMembers.length > 1 && (
                    <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>For Whom?</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberScrollContent}>
                            {familyMembers.map(member => (
                                <TouchableOpacity
                                    key={member.id}
                                    style={[styles.memberCard, selectedMemberId === member.id && styles.memberCardSelected]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setSelectedMemberId(member.id);
                                    }}
                                >
                                    <View style={[styles.memberAvatar, selectedMemberId === member.id && styles.memberAvatarActive]}>
                                        <MaterialIcons
                                            name={member.relationship === 'Self' ? 'person' : 'people'}
                                            size={20}
                                            color={selectedMemberId === member.id ? Colors.white : Colors.textSecondary}
                                        />
                                    </View>
                                    <Text style={[styles.memberCardName, selectedMemberId === member.id && styles.memberCardNameSelected]}>
                                        {member.name}
                                    </Text>
                                    {selectedMemberId === member.id && (
                                        <Animated.View entering={FadeIn.duration(200)} style={styles.memberCheckmark}>
                                            <MaterialIcons name="check-circle" size={14} color={Colors.primary} />
                                        </Animated.View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* Medication Details */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Medication Details</Text>
                    </View>
                    
                    <View style={styles.premiumInputCard}>
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
                                onChangeText={(text) => setName(text)}
                                onFocus={() => setIsNameFocused(true)}
                                onBlur={() => setIsNameFocused(false)}
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

                    <View style={[styles.inputLabelRow, { marginTop: Sizes.lg }]}>
                        <Text style={styles.premiumLabel}>Medicine Type</Text>
                        <Text style={styles.selectedTypeText}>{selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScrollContent}>
                        {availableTypes.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.typeCard, selectedType === type && styles.typeCardSelected, showErrors && errors.type && styles.typeCardError]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setSelectedType(type as MedicineType);
                                }}
                            >
                                <View style={[styles.typeIconContainer, selectedType === type && styles.typeIconContainerActive]}>
                                    <MedicationIcon form={type} size={24} color={selectedType === type ? Colors.white : Colors.textSecondary} />
                                </View>
                                <Text style={[styles.typeCardLabel, selectedType === type && styles.typeCardLabelSelected]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {showErrors && errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
                </Animated.View>

                {/* Dosage & Instructions */}
                <Animated.View style={styles.section} entering={FadeInDown.delay(300).duration(500)}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Dosage & Instructions</Text>
                    </View>

                    <View style={styles.premiumInputCard}>
                        <Text style={styles.premiumLabel}>Time of Day (Group)</Text>
                        <TouchableOpacity style={[styles.groupSelectorBar, { marginTop: 8 }]} onPress={() => setShowGroupPicker(true)}>
                            <Text style={[styles.groupSelectorText, selectedGroups.length === 0 && { color: Colors.textSecondary }]}>
                                {selectedGroups.length > 0 ? selectedGroups.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ') : 'Select group...'}
                            </Text>
                            <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <Text style={[styles.premiumLabel, { marginTop: 20 }]}>Food Relationship</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipContainer, { marginTop: 8, paddingBottom: 5 }]}>
                            {(['anytime', 'before_food', 'with_food', 'after_food', 'empty_stomach'] as FoodRelationship[]).map((rel) => (
                                <TouchableOpacity
                                    key={rel}
                                    style={[styles.chip, foodRelationship === rel && styles.chipSelected]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setFoodRelationship(rel);
                                    }}
                                >
                                    <Text style={[styles.chipText, foodRelationship === rel && styles.chipTextSelected]}>
                                        {rel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Animated.View>

                {/* Schedule */}
                <Animated.View style={styles.section} entering={FadeInDown.delay(400).duration(500)}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Schedule</Text>
                    </View>

                    <View style={styles.premiumInputCard}>
                        <Text style={styles.premiumLabel}>Frequency</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipContainer, { marginTop: 8, paddingBottom: 5 }]}>
                            {[
                                { label: 'Once Daily', val: 'once_daily' },
                                { label: 'Twice Daily', val: 'twice_daily' },
                                { label: '3x Daily', val: 'three_times_daily' },
                                { label: 'Weekly', val: 'weekly' },
                                { label: 'Custom', val: 'specific_interval' }
                            ].map((opt) => (
                                <TouchableOpacity
                                    key={opt.val}
                                    style={[styles.chip, frequency === opt.val && styles.chipSelected]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setFrequency(opt.val as any);
                                        if (opt.val === 'specific_interval') {
                                            setShowCustomModal(true);
                                        }
                                    }}
                                >
                                    <Text style={[styles.chipText, frequency === opt.val && styles.chipTextSelected]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {frequency === 'specific_interval' && timesPerDay > 0 && (
                            <TouchableOpacity 
                                style={[styles.customSummaryCard, { marginTop: 12 }, showErrors && (errors.timesPerDay || errors.intervalDays) && styles.inputError]} 
                                onPress={() => setShowCustomModal(true)}
                            >
                                <View style={styles.customSummaryLeft}>
                                    <View style={styles.customSummaryIcon}>
                                        <Feather name="settings" size={18} color={Colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.customSummaryTitle}>Schedule Config</Text>
                                        <Text style={styles.customSummaryText}>
                                            {timesPerDay} {timesPerDay === 1 ? 'Time' : 'Times'}, {parseInt(intervalDays) === 1 ? 'Everyday' : `Every ${intervalDays} Days`}
                                        </Text>
                                    </View>
                                </View>
                                <Feather name="edit-2" size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={[styles.premiumInputCard, { marginTop: 12 }]}>
                        <View style={styles.inputLabelRow}>
                            <Text style={styles.premiumLabel}>Reminder Times</Text>
                            <TouchableOpacity onPress={handleAddTime}>
                                <Feather name="plus-circle" size={22} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.timeGrid}>
                            {reminderTimes.map((time, index) => (
                                <View key={index} style={{ position: 'relative' }}>
                                    <TouchableOpacity 
                                        style={styles.timeChip} 
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setShowTimePicker({ show: true, index });
                                        }}
                                    >
                                        <Feather name="clock" size={14} color={Colors.primary} />
                                        <Text style={styles.timeChipText}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.removeTimeButton} 
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            handleRemoveTime(index);
                                        }}
                                    >
                                        <Feather name="minus" size={12} color={Colors.white} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        {showErrors && errors.reminderTimes && <Text style={styles.errorText}>{errors.reminderTimes}</Text>}
                    </View>
                </Animated.View>

                <Animated.View style={styles.section} entering={FadeInDown.delay(500).duration(500)}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Duration</Text>
                    </View>

                    <View style={[styles.premiumInputCard, showErrors && errors.endDate && styles.inputError]}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.cardLabel}>Continuous treatment</Text>
                            <Switch 
                                trackColor={{ false: Colors.gray200, true: Colors.primary }} 
                                thumbColor={Colors.white} 
                                onValueChange={(val) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsContinuous(val);
                                }} 
                                value={isContinuous} 
                            />
                        </View>
                        <View style={[styles.divider, { marginVertical: 8 }]} />
                        <TouchableOpacity 
                            style={styles.rowBetween} 
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowStartDatePicker(true);
                            }}
                        >
                            <Text style={styles.cardLabel}>Starts on</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.dateValue}>{startDate.toLocaleDateString()}</Text>
                                <Feather name="chevron-right" size={16} color={Colors.primary} />
                            </View>
                        </TouchableOpacity>
                        {!isContinuous && (
                            <>
                                <View style={[styles.divider, { marginVertical: 8 }]} />
                                <TouchableOpacity 
                                    style={styles.rowBetween} 
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setShowEndDatePicker(true);
                                    }}
                                >
                                    <Text style={styles.cardLabel}>Ends on</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={[styles.dateValue, !endDate && { color: Colors.textSecondary }]}>
                                            {endDate ? endDate.toLocaleDateString() : 'Select date'}
                                        </Text>
                                        <Feather name="chevron-right" size={16} color={Colors.primary} />
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                    {showErrors && errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
                </Animated.View>

                <Animated.View style={styles.section} entering={FadeInDown.delay(600).duration(500)}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Instructions</Text>
                    </View>
                    <View style={styles.premiumInputCard}>
                        <Text style={styles.premiumLabel}>Special Notes (Optional)</Text>
                        <TextInput 
                            style={[styles.input, { height: 100, textAlignVertical: 'top', marginTop: 8 }]} 
                            placeholder="e.g., Take with water only, avoid direct sunlight..." 
                            multiline 
                            value={notes} 
                            onChangeText={setNotes} 
                        />
                    </View>
                </Animated.View>

                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={styles.saveButton} 
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            handleSave();
                        }}
                    >
                        <Text style={styles.saveButtonText}>Add Medication</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Modals for Pickers */}
            <DatePickerModal visible={showStartDatePicker} date={startDate.toISOString().split('T')[0]} onConfirm={onStartDateChange} onCancel={() => setShowStartDatePicker(false)} title="Select Start Date" />
            <DatePickerModal visible={showEndDatePicker} date={endDate ? endDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} minimumDate={startDate.toISOString().split('T')[0]} onConfirm={onEndDateChange} onCancel={() => setShowEndDatePicker(false)} title="Select End Date" />
            <TimePickerModal visible={showTimePicker.show} time={showTimePicker.index >= 0 && showTimePicker.index < reminderTimes.length ? reminderTimes[showTimePicker.index] : getNextDefaultTime()} onConfirm={(date: Date) => onTimeChange(null, date)} onCancel={() => setShowTimePicker({ show: false, index: -1 })} title={showTimePicker.index >= 0 && showTimePicker.index < reminderTimes.length ? "Edit Time" : "Add Time"} />

            <Modal visible={showUnitPicker} transparent animationType="fade" onRequestClose={() => setShowUnitPicker(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowUnitPicker(false)}>
                    <View style={styles.pickerContent}>
                        <Text style={styles.pickerTitle}>Select Unit</Text>
                        {(MEDICINE_TYPE_DEFAULTS[selectedType]?.allowedStrengthUnits || []).map((unit) => (
                            <TouchableOpacity key={unit} style={[styles.pickerItem, strengthUnit === unit && styles.pickerItemSelected]} onPress={() => { setStrengthUnit(unit); setShowUnitPicker(false); }}>
                                <Text style={[styles.pickerItemText, strengthUnit === unit && styles.pickerItemTextSelected]}>{unit}</Text>
                                {strengthUnit === unit && <Feather name="check" size={20} color={Colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={showCustomModal} transparent animationType="fade" onRequestClose={() => setShowCustomModal(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCustomModal(false)}>
                    <View style={styles.pickerContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowCustomModal(false)} style={styles.modalCloseButton}>
                                <Feather name="x" size={20} color={Colors.textPrimary} />
                            </TouchableOpacity>
                            <Text style={styles.pickerTitle}>Custom Schedule</Text>
                            <View style={styles.headerStatusContainer}>
                                {customSaveStatus === 'saving' && (
                                    <View style={styles.statusIndicator}>
                                        <ActivityIndicator size="small" color={Colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
                                        <Text style={styles.statusText}>Saving...</Text>
                                    </View>
                                )}
                                {customSaveStatus === 'saved' && (
                                    <View style={styles.statusIndicator}>
                                        <Feather name="check" size={14} color="#10B981" />
                                        <Text style={[styles.statusText, { color: '#10B981' }]}>Saved</Text>
                                    </View>
                                )}
                                {customSaveStatus === 'idle' && <View style={{ width: 32 }} />}
                            </View>
                        </View>
                        
                        <Text style={styles.label}>Times Per Day</Text>
                        <TextInput 
                            style={[styles.input, { marginBottom: Sizes.md }]} 
                            keyboardType="numeric" 
                            autoFocus
                            value={timesPerDay === 0 ? '' : timesPerDay.toString()} 
                            onChangeText={(t) => {
                                const val = t === '' ? 0 : parseInt(t) || 0;
                                setTimesPerDay(val);
                            }} 
                            onBlur={() => {
                                // Enforce minimum 1 on blur
                                if (timesPerDay < 1) setTimesPerDay(1);
                            }}
                            placeholder="e.g., 4"
                        />
                        
                        <Text style={styles.label}>Interval (Days)</Text>
                        <TextInput 
                            style={styles.input} 
                            keyboardType="numeric" 
                            value={intervalDays === '0' || intervalDays === '' ? '' : intervalDays} 
                            onChangeText={(t) => {
                                const val = t === '' ? '0' : t;
                                setIntervalDays(val);
                            }}
                            onBlur={() => {
                                // Enforce minimum 1 on blur
                                const val = parseInt(intervalDays);
                                if (isNaN(val) || val < 1) setIntervalDays('1');
                            }}
                            placeholder="e.g., 7"
                        />
                        <Text style={styles.helperText}>Example: 3 times every 7 days means you take 3 doses on 1 day a week.</Text>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={showGroupPicker} transparent animationType="fade" onRequestClose={() => setShowGroupPicker(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowGroupPicker(false)}>
                    <View style={styles.pickerContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowGroupPicker(false)} style={styles.modalCloseButton}>
                                <Feather name="x" size={20} color={Colors.textPrimary} />
                            </TouchableOpacity>
                            <Text style={styles.pickerTitle}>Select Group</Text>
                            <View style={styles.headerStatusContainer}>
                                {groupSaveStatus === 'saving' && (
                                    <View style={styles.statusIndicator}>
                                        <ActivityIndicator size="small" color={Colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
                                        <Text style={styles.statusText}>Saving...</Text>
                                    </View>
                                )}
                                {groupSaveStatus === 'saved' && (
                                    <View style={styles.statusIndicator}>
                                        <Feather name="check" size={14} color="#10B981" />
                                        <Text style={[styles.statusText, { color: '#10B981' }]}>Saved</Text>
                                    </View>
                                )}
                                {groupSaveStatus === 'idle' && <View style={{ width: 32 }} />}
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.groupOption, selectedGroups.length === 0 && styles.groupOptionSelected]} onPress={() => { setSelectedGroups([]); setShowGroupPicker(false); }}>
                            <Text style={[styles.groupOptionText, selectedGroups.length === 0 && { color: Colors.primary }]}>None</Text>
                        </TouchableOpacity>
                        {['morning', 'afternoon', 'night'].map(g => (
                            <TouchableOpacity key={g} style={[styles.groupOption, selectedGroups.includes(g) && styles.groupOptionSelected]} onPress={() => {
                                const newGroups = selectedGroups.includes(g) ? selectedGroups.filter(x => x !== g) : [...selectedGroups, g];
                                setSelectedGroups(newGroups);
                            }}>
                                <Text style={[styles.groupOptionText, selectedGroups.includes(g) && { color: Colors.primary }]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                                {selectedGroups.includes(g) && <Feather name="check" size={20} color={Colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
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
    
    content: { flex: 1, paddingHorizontal: 0 },
    section: { marginTop: 15, width: '100%' },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
        paddingHorizontal: 20,
    },
    sectionTitle: { ...Typography.styles.h4, color: Colors.textPrimary, fontWeight: '700', marginBottom: 0 },
    
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
        backgroundColor: '#FCFDFF', // Ambient wash
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.gray100,
        width: '100%',
    },
    inputLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray50,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    input: { backgroundColor: Colors.gray50, borderRadius: 12, padding: 12, fontSize: 16, borderWidth: 1, borderColor: Colors.gray200 },
    inputError: { borderColor: Colors.error },
    premiumTextInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    errorText: { color: Colors.error, fontSize: 12, marginTop: 4, fontWeight: '500' },

    combinedInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors.white, 
        borderRadius: 14, 
        borderWidth: 1.5, 
        borderColor: Colors.gray100, 
        overflow: 'hidden',
    },
    inputUnstyled: { flex: 1, height: 48, paddingHorizontal: 16, fontSize: 16, color: Colors.textPrimary },
    verticalDivider: { width: 1, height: '50%', backgroundColor: Colors.gray200 },
    unitSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 4 },
    unitSelectorText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },

    selectedTypeText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    typeScrollContent: { paddingHorizontal: Sizes.lg, paddingBottom: 5, paddingTop: 4 },
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

    groupSelectorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.gray50, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.gray200 },
    groupSelectorText: { fontSize: 16, color: Colors.textPrimary },
    
    chipContainer: { flexDirection: 'row', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
    chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { fontSize: 14, color: Colors.textSecondary },
    chipTextSelected: { color: Colors.white, fontWeight: '600' },

    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    timeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '10', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 8 },
    timeChipText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
    removeTimeButton: { position: 'absolute', top: -8, left: -8, backgroundColor: Colors.primary, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
    
    card: { 
        backgroundColor: Colors.white, 
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.gray100,
        width: '100%',
    },
    rowBetween: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingVertical: 18,
        paddingHorizontal: Sizes.lg,
    },
    cardLabel: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
    dateValue: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
    divider: { height: 1, backgroundColor: Colors.gray100, marginHorizontal: Sizes.lg },
    row: { flexDirection: 'row', marginTop: 16 },
    
    footer: { paddingVertical: 32, paddingHorizontal: Sizes.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    saveButton: { backgroundColor: Colors.primary, borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    saveButtonText: { fontSize: 17, fontWeight: '700', color: Colors.white },
    
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    pickerContent: { backgroundColor: Colors.white, borderRadius: 24, padding: 24, width: '90%', maxHeight: '80%' },
    pickerTitle: { ...Typography.styles.h4, color: Colors.textPrimary, marginBottom: 8 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    modalCloseButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: Colors.gray50 },
    modalDoneButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: Colors.primary + '10' },
    
    pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
    pickerItemSelected: { backgroundColor: Colors.primary + '10' },
    pickerItemText: { fontSize: 16, color: Colors.textSecondary },
    pickerItemTextSelected: { color: Colors.primary, fontWeight: '600' },
    
    groupOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.gray50, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
    groupOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '05' },
    groupOptionText: { fontSize: 16, color: Colors.textSecondary },
    
    customSummaryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary + '05', borderRadius: 16, padding: 16, borderColor: Colors.primary + '20', borderWidth: 1, marginTop: 8 },
    customSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    customSummaryIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
    customSummaryTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
    customSummaryText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    helperText: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
    closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: Colors.gray50 },
    auraFocus: {
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
});
