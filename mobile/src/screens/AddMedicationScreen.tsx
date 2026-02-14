import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
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

    const isInternalSync = React.useRef(false);
    const isInitialGroupMount = React.useRef(true);

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
        if (timesPerDay === 0 || timesPerDay === reminderTimes.length) return;

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
                    // offsets: 0, 60 mins
                    t.setMinutes(t.getMinutes() + i * 60);
                } else {
                    // offsets: 0, 30, 60, 90... mins
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

        // Update frequency if it matches defaults
        if (intervalDays === '1') {
            if (count === 1) setFrequency('once_daily');
            else if (count === 2) setFrequency('twice_daily');
            else if (count === 3) setFrequency('three_times_daily');
            else setFrequency('specific_interval');
        } else if (intervalDays === '7' && count === 1) {
            setFrequency('weekly');
        } else {
            setFrequency('specific_interval');
        }

        setTimeout(() => isInternalSync.current = false, 50);
    }, [timesPerDay, intervalDays, memberDoseTimes]);

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
        if (intervalDays === '1') {
            if (newTimes.length === 1) setFrequency('once_daily');
            else if (newTimes.length === 2) setFrequency('twice_daily');
            else if (newTimes.length === 3) setFrequency('three_times_daily');
            else setFrequency('specific_interval');
        } else if (intervalDays === '7' && newTimes.length === 1) {
            setFrequency('weekly');
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
        if (intervalDays === '1') {
            if (reminderTimes.length === 1) setFrequency('once_daily');
            else if (reminderTimes.length === 2) setFrequency('twice_daily');
            else if (reminderTimes.length === 3) setFrequency('three_times_daily');
            else setFrequency('specific_interval');
        } else if (intervalDays === '7' && reminderTimes.length === 1) {
            setFrequency('weekly');
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
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Medication</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: Sizes.xl }}
            >
                {/* Family Member Selection */}
                {familyMembers.length > 1 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>For Whom?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                            {familyMembers.map(member => (
                                <TouchableOpacity
                                    key={member.id}
                                    style={[styles.chip, selectedMemberId === member.id && styles.chipSelected]}
                                    onPress={() => setSelectedMemberId(member.id)}
                                >
                                    <MaterialIcons
                                        name={member.relationship === 'Self' ? 'person' : 'people'}
                                        size={16}
                                        color={selectedMemberId === member.id ? Colors.white : Colors.textSecondary}
                                    />
                                    <Text style={[styles.chipText, selectedMemberId === member.id && styles.chipTextSelected]}>
                                        {member.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Medication Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medication Details</Text>
                    <Text style={styles.label}>Medicine Name *</Text>
                    <TextInput
                        style={[styles.input, showErrors && errors.name && styles.inputError]}
                        placeholder="e.g., Amoxicillin"
                        value={name}
                        onChangeText={(text) => setName(text)}
                    />
                    {showErrors && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                    <Text style={[styles.label, { marginTop: Sizes.md }]}>Strength (Optional)</Text>
                    <View style={styles.combinedInputContainer}>
                        <TextInput
                            style={[styles.inputUnstyled, { flex: 1 }]}
                            placeholder="e.g., 500"
                            keyboardType="numeric"
                            value={strengthValue}
                            onChangeText={setStrengthValue}
                        />
                        <View style={styles.verticalDivider} />
                        <TouchableOpacity 
                            style={styles.unitSelector}
                            onPress={() => setShowUnitPicker(true)}
                        >
                            <Text style={styles.unitSelectorText}>{strengthUnit}</Text>
                            <Feather name="chevron-down" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { marginTop: Sizes.md }]}>Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScrollContent}>
                        {availableTypes.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.typeCard, selectedType === type && styles.typeCardSelected, showErrors && errors.type && styles.typeCardError]}
                                onPress={() => setSelectedType(type as MedicineType)}
                            >
                                <MedicationIcon form={type} size={24} />
                                <Text style={[styles.typeCardLabel, selectedType === type && styles.typeCardLabelSelected]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {showErrors && errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
                </View>

                {/* Group & Instructions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Dosage & Instructions</Text>
                    <Text style={styles.label}>Group</Text>
                    <TouchableOpacity style={styles.groupSelectorBar} onPress={() => setShowGroupPicker(true)}>
                        <Text style={[styles.groupSelectorText, selectedGroups.length === 0 && { color: Colors.textSecondary }]}>
                            {selectedGroups.length > 0 ? selectedGroups.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ') : 'None'}
                        </Text>
                        <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <Text style={[styles.label, { marginTop: Sizes.md }]}>When to take?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                        {(['anytime', 'before_food', 'with_food', 'after_food', 'empty_stomach'] as FoodRelationship[]).map((rel) => (
                            <TouchableOpacity
                                key={rel}
                                style={[styles.chip, foodRelationship === rel && styles.chipSelected]}
                                onPress={() => setFoodRelationship(rel)}
                            >
                                <Text style={[styles.chipText, foodRelationship === rel && styles.chipTextSelected]}>
                                    {rel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Schedule */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Schedule</Text>
                    <Text style={styles.label}>Frequency</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
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
                                onPress={() => setFrequency(opt.val as any)}
                            >
                                <Text style={[styles.chipText, frequency === opt.val && styles.chipTextSelected]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {frequency === 'specific_interval' && (
                        <>
                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: Sizes.sm }}>
                                    <Text style={styles.label}>Times/Day</Text>
                                    <TextInput 
                                        style={[styles.input, showErrors && errors.timesPerDay && styles.inputError]} 
                                        keyboardType="numeric" 
                                        value={timesPerDay === 0 ? '' : timesPerDay.toString()} 
                                        onChangeText={(t) => setTimesPerDay(t === '' ? 0 : parseInt(t) || 0)} 
                                    />
                                    {showErrors && errors.timesPerDay && <Text style={styles.errorText}>{errors.timesPerDay}</Text>}
                                </View>
                                <View style={{ flex: 1, marginLeft: Sizes.sm }}>
                                    <Text style={styles.label}>Interval (Days)</Text>
                                    <TextInput 
                                        style={[styles.input, showErrors && errors.intervalDays && styles.inputError]} 
                                        keyboardType="numeric" 
                                        value={intervalDays === '0' || intervalDays === '' ? '' : intervalDays} 
                                        onChangeText={(t) => setIntervalDays(t === '' ? '0' : t)} 
                                    />
                                    {showErrors && errors.intervalDays && <Text style={styles.errorText}>{errors.intervalDays}</Text>}
                                </View>
                            </View>
                        </>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Sizes.md }}>
                        <Text style={styles.label}>Reminder Times</Text>
                        <TouchableOpacity onPress={handleAddTime}>
                            <Feather name="plus-circle" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.timeGrid}>
                        {reminderTimes.map((time, index) => (
                            <View key={index} style={{ position: 'relative' }}>
                                <TouchableOpacity style={styles.timeChip} onPress={() => setShowTimePicker({ show: true, index })}>
                                    <Feather name="clock" size={14} color={Colors.primary} />
                                    <Text style={styles.timeChipText}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.removeTimeButton} onPress={() => handleRemoveTime(index)}>
                                    <Feather name="minus" size={12} color={Colors.white} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                    {showErrors && errors.reminderTimes && <Text style={styles.errorText}>{errors.reminderTimes}</Text>}

                    <Text style={[styles.label, { marginTop: Sizes.md }]}>Duration</Text>
                    <View style={[styles.card, showErrors && errors.endDate && styles.inputError]}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.cardLabel}>Continuous Treatment</Text>
                            <Switch trackColor={{ false: Colors.gray200, true: Colors.primary }} thumbColor={Colors.white} onValueChange={setIsContinuous} value={isContinuous} />
                        </View>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.rowBetween} onPress={() => setShowStartDatePicker(true)}>
                            <Text style={styles.cardLabel}>Start Date</Text>
                            <Text style={styles.dateValue}>{startDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        {!isContinuous && (
                            <>
                                <View style={styles.divider} />
                                <TouchableOpacity style={styles.rowBetween} onPress={() => setShowEndDatePicker(true)}>
                                    <Text style={styles.cardLabel}>End Date</Text>
                                    <Text style={[styles.dateValue, !endDate && { color: Colors.textSecondary }]}>
                                        {endDate ? endDate.toLocaleDateString() : 'Select Date'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                    {showErrors && errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="e.g., Take with water only" multiline value={notes} onChangeText={setNotes} />
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
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
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.white },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Sizes.lg, paddingVertical: Sizes.md, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
    headerTitle: { ...Typography.styles.h3, color: Colors.textPrimary },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    modalCloseButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: Colors.gray50 },
    modalDoneButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: Colors.primary + '10' },
    headerStatusContainer: { minWidth: 70, height: 32, justifyContent: 'center', alignItems: 'flex-end' },
    statusIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    statusText: { fontSize: 10, fontWeight: '700', color: Colors.gray600 },
    pickerTitle: { ...Typography.styles.h4, color: Colors.textPrimary, marginBottom: 0 },
    closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: Colors.gray50 },
    content: { flex: 1, paddingHorizontal: Sizes.lg },
    section: { marginTop: Sizes.xl },
    sectionTitle: { ...Typography.styles.h4, color: Colors.textPrimary, marginBottom: Sizes.sm },
    label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
    input: { backgroundColor: Colors.gray50, borderRadius: 12, padding: Sizes.md, fontSize: 16, borderWidth: 1, borderColor: Colors.gray200 },
    chipContainer: { flexDirection: 'row', gap: Sizes.sm },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
    chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { fontSize: 14, color: Colors.textSecondary },
    chipTextSelected: { color: Colors.white, fontWeight: '600' },
    combinedInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray200, overflow: 'hidden' },
    inputUnstyled: { flex: 1, padding: Sizes.md, fontSize: 16 },
    verticalDivider: { width: 1, height: '60%', backgroundColor: Colors.gray200 },
    unitSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Sizes.md, gap: 4 },
    unitSelectorText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
    typeScrollContent: { paddingVertical: 4, gap: Sizes.md },
    typeCard: { width: 70, height: 85, backgroundColor: Colors.white, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.gray100, marginRight: Sizes.sm },
    typeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    typeCardLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
    typeCardLabelSelected: { color: Colors.primary, fontWeight: '700' },
    groupSelectorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.gray50, borderRadius: 12, padding: Sizes.md, borderWidth: 1, borderColor: Colors.gray200 },
    groupSelectorText: { fontSize: 16, color: Colors.textPrimary },
    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Sizes.md, marginTop: Sizes.sm },
    timeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '10', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 6 },
    timeChipText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
    removeTimeButton: { position: 'absolute', top: -8, left: -8, backgroundColor: Colors.primary, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
    card: { backgroundColor: Colors.gray50, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray200 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Sizes.md },
    cardLabel: { fontSize: 15, color: Colors.textPrimary },
    dateValue: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
    divider: { height: 1, backgroundColor: Colors.gray200 },
    row: { flexDirection: 'row', marginTop: Sizes.md },
    footer: { paddingVertical: Sizes.xl, backgroundColor: Colors.white },
    saveButton: { backgroundColor: Colors.primary, borderRadius: 12, padding: Sizes.lg, alignItems: 'center' },
    saveButtonText: { fontSize: 17, fontWeight: '700', color: Colors.white },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    pickerContent: { backgroundColor: Colors.white, borderRadius: 20, padding: Sizes.xl, width: '85%' },
    pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
    pickerItemSelected: { backgroundColor: Colors.primary + '10' },
    pickerItemText: { fontSize: 16, color: Colors.textSecondary },
    pickerItemTextSelected: { color: Colors.primary, fontWeight: '600' },
    groupOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.gray50, marginBottom: 8 },
    groupOptionSelected: { borderColor: Colors.primary, borderWidth: 1 },
    groupOptionText: { fontSize: 16, color: Colors.textSecondary },
    inputError: { borderColor: '#FF4D4D' },
    typeCardError: { borderColor: '#FF4D4D' },
    errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4, fontWeight: '500' }
});
