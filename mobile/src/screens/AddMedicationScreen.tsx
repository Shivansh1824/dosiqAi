import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Switch } from 'react-native';
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
    const [frequency, setFrequency] = useState<MedicationFrequency | 'specific_interval'>('once_daily');
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

    const isInternalSync = React.useRef(false);

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
        resetForm();
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

    // Frequency & Group Sync Logic (copied from modal)
    useEffect(() => {
        if (isInternalSync.current) return;
        if (timesPerDay === reminderTimes.length) return;
        
        if (timesPerDay > reminderTimes.length) {
            const needed = timesPerDay - reminderTimes.length;
            const newTimes = [...reminderTimes];
            const addedGroups = [...selectedGroups];
            
            const candidates = [
                { id: 'morning', val: parseTime(memberDoseTimes.morning) || parseTime("08:00:00") },
                { id: 'afternoon', val: parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00") },
                { id: 'night', val: parseTime(memberDoseTimes.night) || parseTime("21:00:00") }
            ];

            const isTimePresent = (t: Date) => newTimes.some(nt => nt.getHours() === t.getHours() && nt.getMinutes() === t.getMinutes());
            let addedCount = 0;
            
            for (const cand of candidates) {
                if (addedCount >= needed) break;
                if (cand.val && !isTimePresent(cand.val)) {
                    newTimes.push(cand.val);
                    if (!addedGroups.includes(cand.id)) addedGroups.push(cand.id);
                    addedCount++;
                }
            }
            
            while (addedCount < needed) {
                const base = newTimes.length > 0 ? newTimes[newTimes.length - 1] : parseTime("08:00:00");
                const next = new Date(base!.getTime());
                next.setHours(next.getHours() + 4);
                newTimes.push(next);
                addedCount++;
            }
            
            newTimes.sort((a, b) => a.getTime() - b.getTime());
            isInternalSync.current = true;
            setReminderTimes(newTimes);
            setSelectedGroups(addedGroups);
            setTimeout(() => isInternalSync.current = false, 0);
        } else if (timesPerDay < reminderTimes.length) {
             const newTimes = reminderTimes.slice(0, timesPerDay);
             const validGroups: string[] = [];
             const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
             const morningMins = (parseTime(memberDoseTimes.morning) || parseTime("08:00:00"))!.getHours() * 60 + (parseTime(memberDoseTimes.morning) || parseTime("08:00:00"))!.getMinutes();
             const afternoonMins = (parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00"))!.getHours() * 60 + (parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00"))!.getMinutes();
             const nightMins = (parseTime(memberDoseTimes.night) || parseTime("21:00:00"))!.getHours() * 60 + (parseTime(memberDoseTimes.night) || parseTime("21:00:00"))!.getMinutes();

             newTimes.forEach(t => {
                 const tm = toMinutes(t);
                 if (tm === morningMins && !validGroups.includes('morning')) validGroups.push('morning');
                 if (tm === afternoonMins && !validGroups.includes('afternoon')) validGroups.push('afternoon');
                 if (tm === nightMins && !validGroups.includes('night')) validGroups.push('night');
             });

             isInternalSync.current = true;
             setReminderTimes(newTimes);
             setSelectedGroups(validGroups);
             setTimeout(() => isInternalSync.current = false, 0);
        }
    }, [timesPerDay, memberDoseTimes]);

    useEffect(() => {
        if (isInternalSync.current) return;
        const newTimes: Date[] = [];
        if (selectedGroups.includes('morning')) {
            const t = parseTime(memberDoseTimes.morning) || parseTime("08:00:00");
            if (t) newTimes.push(t);
        }
        if (selectedGroups.includes('afternoon')) {
            const t = parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00");
            if (t) newTimes.push(t);
        }
        if (selectedGroups.includes('night')) {
             const t = parseTime(memberDoseTimes.night) || parseTime("21:00:00");
             if (t) newTimes.push(t);
        }
        newTimes.sort((a, b) => a.getTime() - b.getTime());
        isInternalSync.current = true;
        setReminderTimes(newTimes);
        setTimesPerDay(newTimes.length || 1);
        if (newTimes.length === 1) setFrequency('once_daily');
        else if (newTimes.length === 2) setFrequency('twice_daily');
        else if (newTimes.length === 3) setFrequency('three_times_daily');
        setTimeout(() => isInternalSync.current = false, 0);
    }, [selectedGroups, memberDoseTimes]);

    useEffect(() => {
        const defaults = MEDICINE_TYPE_DEFAULTS[selectedType] || MEDICINE_TYPE_DEFAULTS.default;
        setStrengthUnit(defaults.defaultStrengthUnit);
    }, [selectedType]);

    useEffect(() => {
        if (isInternalSync.current) return;
        let newTimesPerDay = timesPerDay;
        let newIntervalDays = intervalDays;
        if (frequency === 'once_daily') { newTimesPerDay = 1; newIntervalDays = '1'; }
        else if (frequency === 'twice_daily') { newTimesPerDay = 2; newIntervalDays = '1'; }
        else if (frequency === 'three_times_daily') { newTimesPerDay = 3; newIntervalDays = '1'; }
        else if (frequency === 'four_times_daily') { newTimesPerDay = 4; newIntervalDays = '1'; }
        else if (frequency === 'weekly') { newTimesPerDay = 1; newIntervalDays = '7'; }
        else if (frequency === 'monthly') { newTimesPerDay = 1; newIntervalDays = '30'; }
        else if (frequency === 'as_needed') { newTimesPerDay = 1; newIntervalDays = '0'; }

        if (newTimesPerDay !== timesPerDay || newIntervalDays !== intervalDays) {
            isInternalSync.current = true;
            setTimesPerDay(newTimesPerDay);
            setIntervalDays(newIntervalDays);
            setTimeout(() => isInternalSync.current = false, 0);
        }
    }, [frequency]);

    const handleSave = async () => {
        if (!user?.id) {
            alert('User not authenticated');
            return;
        }
        if (!name) {
            alert('Please fill in Medicine Name');
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
            time_of_day: reminderTimes.map(d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })),
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
                        style={styles.input}
                        placeholder="e.g., Amoxicillin"
                        value={name}
                        onChangeText={(text) => setName(text)}
                    />

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
                                style={[styles.typeCard, selectedType === type && styles.typeCardSelected]}
                                onPress={() => setSelectedType(type as MedicineType)}
                            >
                                <MedicationIcon form={type} size={24} />
                                <Text style={[styles.typeCardLabel, selectedType === type && styles.typeCardLabelSelected]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
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
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: Sizes.sm }}>
                                <Text style={styles.label}>Times/Day</Text>
                                <TextInput style={styles.input} keyboardType="numeric" value={timesPerDay.toString()} onChangeText={(t) => setTimesPerDay(parseInt(t) || 1)} />
                            </View>
                            <View style={{ flex: 1, marginLeft: Sizes.sm }}>
                                <Text style={styles.label}>Interval (Days)</Text>
                                <TextInput style={styles.input} keyboardType="numeric" value={intervalDays} onChangeText={setIntervalDays} />
                            </View>
                        </View>
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

                    <Text style={[styles.label, { marginTop: Sizes.md }]}>Duration</Text>
                    <View style={styles.card}>
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
                        <Text style={styles.pickerTitle}>Select Group</Text>
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
                        <TouchableOpacity style={[styles.saveButton, { marginTop: 20 }]} onPress={() => setShowGroupPicker(false)}>
                            <Text style={styles.saveButtonText}>Done</Text>
                        </TouchableOpacity>
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
    pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
    pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
    pickerItemSelected: { backgroundColor: Colors.primary + '10' },
    pickerItemText: { fontSize: 16, color: Colors.textSecondary },
    pickerItemTextSelected: { color: Colors.primary, fontWeight: '600' },
    groupOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.gray50, marginBottom: 8 },
    groupOptionSelected: { borderColor: Colors.primary, borderWidth: 1 },
    groupOptionText: { fontSize: 16, color: Colors.textSecondary }
});
