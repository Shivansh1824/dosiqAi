import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Switch } from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
// Removed unused import generateCyclicReminderTimes and MedicineType which caused errors
import { MedicationFrequency, FoodRelationship } from '../types/medication';
import { MEDICINE_TYPE_DEFAULTS } from '../constants/medicationDefaults';
import { useMedicationsStore } from '../store/medicationsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { MedicationIcon, ICON_THEMES } from './medication/MedicationIcons';
import { useAuthStore } from '../store/authStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import TimePickerModal from './TimePickerModal';
import DatePickerModal from './DatePickerModal';

// Define MedicineType locally based on ICON_THEMES
type MedicineType = keyof typeof ICON_THEMES;

interface AddMedicationModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (medication: any) => void;
}

export default function AddMedicationModal({ visible, onClose, onSave }: AddMedicationModalProps) {
    const { user } = useAuthStore();
    const { getActiveMedications } = useMedicationsStore();
    const { familyMembers, ensurePrimaryMemberExists } = useFamilyMembersStore();
    
    // Core Details
    // Core Details
    // Core Details
    const [name, setName] = useState('');
    // Split strength into value and unit for better control
    const [strengthValue, setStrengthValue] = useState('');
    const [strengthUnit, setStrengthUnit] = useState('mg');
    // Group Selection State
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]); // 'morning', 'afternoon', 'night'
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    
    // Dynamic Logic Helper
    // currentUnit tracks the *default* unit for the type, but strengthUnit enables user override
    const [currentForm, setCurrentForm] = useState('Tablet');

    const [selectedType, setSelectedType] = useState<MedicineType>('tablet');
    
    // For Whom
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');

    // Schedule
    const [intervalDays, setIntervalDays] = useState('1'); // Derived from frequency usually
    const [frequency, setFrequency] = useState<MedicationFrequency | 'specific_interval'>('once_daily');
    const [timesPerDay, setTimesPerDay] = useState(1);
    const [reminderTimes, setReminderTimes] = useState<Date[]>([]); // Default empty
    
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
    const [showDosageUnitPicker, setShowDosageUnitPicker] = useState(false);

    // Ref to prevent infinite loops between sync effects
    const isInternalSync = React.useRef(false);

    // Initialize
    useEffect(() => {
        if (visible) {
            // Ensure we have a default family member selected
            const initMember = async () => {
                if (familyMembers.length === 0 && user?.id) {
                     // Try to ensure primary member exists if list is empty
                     // Fixed user.user_metadata access to user.name
                     const primary = await ensurePrimaryMemberExists(user.id, user.name || 'Me');
                     if (primary) setSelectedMemberId(primary.id);
                } else if (!selectedMemberId && familyMembers.length > 0) {
                     // Default to Self or first member
                     const self = familyMembers.find(m => m.relationship === 'Self');
                     setSelectedMemberId(self ? self.id : familyMembers[0].id);
                }
            };
            initMember();
            resetForm();
        }
    }, [visible, user]);

    // Helper to parse time string "HH:mm:ss" to Date
    // Normalizes to a fixed date to ensure consistent comparisons
    const parseTime = (timeStr?: string) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setFullYear(2025, 0, 1); // Fixed date
        d.setHours(h, m, 0, 0); // Zero seconds/ms
        return d;
    };
    
    // Memoize the active member's dose times to avoid effect thrashing
    const activeMember = familyMembers.find(m => m.id === selectedMemberId);
    const memberDoseTimes = useMemo(() => ({
        morning: activeMember?.morning_dose_time,
        afternoon: activeMember?.afternoon_dose_time,
        night: activeMember?.night_dose_time
    }), [activeMember?.morning_dose_time, activeMember?.afternoon_dose_time, activeMember?.night_dose_time]);

    // Update reminder times when timesPerDay changes (Frequency Sync)
    useEffect(() => {
        // If syncing internally from another source (Group/Reverse), SKIP this logic
        if (isInternalSync.current) return;

        // If 0 or matching length, do nothing
        if (timesPerDay === reminderTimes.length) return;
        
        // If we need MORE times
        if (timesPerDay > reminderTimes.length) {
            const needed = timesPerDay - reminderTimes.length;
            const newTimes = [...reminderTimes];
            const addedGroups = [...selectedGroups]; // Start with current groups
            
            // Candidate slots in order of preference if not already present
            const candidates = [
                { id: 'morning', val: parseTime(memberDoseTimes.morning) || parseTime("08:00:00") },
                { id: 'afternoon', val: parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00") },
                { id: 'night', val: parseTime(memberDoseTimes.night) || parseTime("21:00:00") }
            ];

            // Comparison using hours/minutes only
            const isTimePresent = (t: Date) => newTimes.some(nt => nt.getHours() === t.getHours() && nt.getMinutes() === t.getMinutes());
            
            let addedCount = 0;
            
            // 1. Try to fill from standard candidates first
            for (const cand of candidates) {
                if (addedCount >= needed) break;
                if (cand.val && !isTimePresent(cand.val)) {
                    newTimes.push(cand.val);
                    if (!addedGroups.includes(cand.id)) {
                        addedGroups.push(cand.id);
                    }
                    addedCount++;
                }
            }
            
            // 2. If still need more, add purely default calculated times
            while (addedCount < needed) {
                const base = newTimes.length > 0 ? newTimes[newTimes.length - 1] : parseTime("08:00:00");
                const next = new Date(base!.getTime());
                next.setHours(next.getHours() + 4);
                newTimes.push(next);
                addedCount++;
            }
            
            newTimes.sort((a, b) => a.getTime() - b.getTime());
            
            // Start Block
            isInternalSync.current = true;
            setReminderTimes(newTimes);
            setSelectedGroups(addedGroups);
            setTimeout(() => isInternalSync.current = false, 0);
        }
        
        // If we need FEWER times
        else if (timesPerDay < reminderTimes.length) {
             const newTimes = reminderTimes.slice(0, timesPerDay);
             
             // Also trim groups? 
             // Logic: Re-evaluate which groups are valid for the NEW list of times
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

             // Start Block
             isInternalSync.current = true;
             setReminderTimes(newTimes);
             setSelectedGroups(validGroups);
             setTimeout(() => isInternalSync.current = false, 0);
        }
        
    }, [timesPerDay, memberDoseTimes]); // Use memoized dose times

    // Update reminder times when Group changes (Group Sync)
    useEffect(() => {
        // Prepare to update times based on groups.
        // If this update was triggered by Frequency or Manual Time change, SKIP to avoid overwriting/looping.
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
        
        // Robust Compare: "HH:mm" strings
        const toHM = (d: Date) => `${d.getHours()}:${d.getMinutes()}`;
        const currentSig = reminderTimes.map(toHM).sort().join(',');
        const newSig = newTimes.map(toHM).sort().join(',');
        
        if (currentSig !== newSig) {
            isInternalSync.current = true;
            setReminderTimes(newTimes);
            setTimesPerDay(newTimes.length || 1);
            
            if (newTimes.length === 1) setFrequency('once_daily');
            else if (newTimes.length === 2) setFrequency('twice_daily');
            else if (newTimes.length === 3) setFrequency('three_times_daily');

             setTimeout(() => isInternalSync.current = false, 0);
        }
    }, [selectedGroups, memberDoseTimes]);

    // Reverse Sync: If reminderTimes changes, update selectedGroups
    useEffect(() => {
        const morningTime = (parseTime(memberDoseTimes.morning) || parseTime("08:00:00"))!.getHours() * 60 + (parseTime(memberDoseTimes.morning) || parseTime("08:00:00"))!.getMinutes();
        const afternoonTime = (parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00"))!.getHours() * 60 + (parseTime(memberDoseTimes.afternoon) || parseTime("13:00:00"))!.getMinutes();
        const nightTime = (parseTime(memberDoseTimes.night) || parseTime("21:00:00"))!.getHours() * 60 + (parseTime(memberDoseTimes.night) || parseTime("21:00:00"))!.getMinutes();

        const currentMinutes = reminderTimes.map(d => d.getHours() * 60 + d.getMinutes());

        const newGroups: string[] = [];
        if (currentMinutes.includes(morningTime)) newGroups.push('morning');
        if (currentMinutes.includes(afternoonTime)) newGroups.push('afternoon');
        if (currentMinutes.includes(nightTime)) newGroups.push('night');

        // Robust Compare
        const groupsChanged = 
            newGroups.length !== selectedGroups.length || 
            !newGroups.every(g => selectedGroups.includes(g));

        if (groupsChanged) {
             // If manual time change, we MUST update groups to reflect that strict groups are no longer met.
             // But we set internal sync so Group Sync doesn't fire back and delete the manually edited time.
             isInternalSync.current = true;
             setSelectedGroups(newGroups);
             setTimeout(() => isInternalSync.current = false, 0);
        }
    }, [reminderTimes, memberDoseTimes]); // Reacts to DB changes of dose times

    // Initial default time is REMOVED as requested -> starts empty/none


    // Update defaults when Type changes
    useEffect(() => {
        const defaults = MEDICINE_TYPE_DEFAULTS[selectedType] || MEDICINE_TYPE_DEFAULTS.default;
        
        // Update Strength Unit
        setStrengthUnit(defaults.defaultStrengthUnit);
        
        // No need for simplistic checks here as we have explicit units now
    }, [selectedType]);

    // Handle Frequency Change
    useEffect(() => {
        if (frequency === 'once_daily') { setTimesPerDay(1); setIntervalDays('1'); }
        else if (frequency === 'twice_daily') { setTimesPerDay(2); setIntervalDays('1'); }
        else if (frequency === 'three_times_daily') { setTimesPerDay(3); setIntervalDays('1'); }
        else if (frequency === 'four_times_daily') { setTimesPerDay(4); setIntervalDays('1'); }
        else if (frequency === 'weekly') { setTimesPerDay(1); setIntervalDays('7'); }
        else if (frequency === 'monthly') { setTimesPerDay(1); setIntervalDays('30'); }
        else if (frequency === 'as_needed') { setTimesPerDay(1); setIntervalDays('0'); }
    }, [frequency]);

    const { medications } = useMedicationsStore();
    
    // Filter suggestions from FULL history (de-duplicated)
    const suggestions = useMemo(() => {
        if (!name || !showSuggestions) return [];
        
        const needle = name.toLowerCase();
        const seenNames = new Set<string>();
        
        // Use all medications (history), assuming they are sorted by recency in store (which they are)
        return medications.filter(med => {
            if (!med.name.toLowerCase().includes(needle)) return false;
            
            // Deduplicate by name to avoid showing 5 "Amoxicillin" entries
            const key = med.name.toLowerCase().trim();
            if (seenNames.has(key)) return false;
            
            seenNames.add(key);
            return true;
        }).slice(0, 5);
    }, [name, medications, showSuggestions]);

    const handleSelectSuggestion = (med: any) => {
        setName(med.name);
        
        // Parse Strength
        const strMatch = (med.strength || '').match(/^(\d+(\.\d+)?)\s*(.*)$/);
        if (strMatch) {
            setStrengthValue(strMatch[1]);
            setStrengthUnit(strMatch[3] || MEDICINE_TYPE_DEFAULTS.default.defaultStrengthUnit);
        } else {
             setStrengthValue(med.strength || '');
        }

        // Parse Dosage (Legacy support - keeps quantity empty now)
        // We could infer groups from dosage string if it contained "Morning" etc., but for now skip.

        setSelectedType((med.form?.toLowerCase() as MedicineType) || 'tablet');
        
        // Map Scheduler/Frequency
        if (med.frequency) {
             setFrequency(med.frequency as MedicationFrequency);
        }
        if (med.times_per_day) setTimesPerDay(med.times_per_day);
        if (med.interval_days) setIntervalDays(med.interval_days.toString());
        
        // Map Instructions
        if (med.food_relationship) setFoodRelationship(med.food_relationship);
        // We generally don't copy detailed 'notes' as they might be specific to previous illness, 
        // but 'instructions' might be useful if strictly medical.
        // For now, let's keep notes blank to avoid confusion.
        
        setShowSuggestions(false);
    };

    const handleSave = () => {
        if (!name) {
            alert('Please fill in Medicine Name');
            return;
        }
        if (!selectedMemberId) {
             alert('Please select a family member');
             return;
        }

        const medication = {
            user_id: user?.id,
            family_member_id: selectedMemberId,
            name,
            scientific_name: '', // Could be enriched by AI later
            medicine_type: selectedType, // Using strict type for DB consistency
            medicine_purpose: '',
            form: selectedType,
            strength: strengthValue ? `${strengthValue} ${strengthUnit}` : '',
            
            dosage: '', // Dosage quantity removed, allow valid null/empty
            frequency: frequency === 'specific_interval' ? 'custom' : frequency,
            time_of_day: reminderTimes.map(d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })),
            interval_days: parseInt(intervalDays) || 1,
            times_per_day: timesPerDay,
            
            start_date: startDate.toISOString().split('T')[0],
            end_date: (!isContinuous && endDate) ? endDate.toISOString().split('T')[0] : null,
            duration_days: (!isContinuous && durationDays) ? parseInt(durationDays) : null,
            
            food_relationship: foodRelationship,
            notes,
            reminder_enabled: true,
            
            // Legacy/Compat fields if store needs them directly
            instructions: notes || '', 
        };

        onSave(medication);
        onClose();
    };

    const resetForm = () => {
        setName('');
        setStrengthValue('');
        // Default to Morning group as requested ("Once Daily" default)
        setSelectedGroups(['morning']);
        // Logic will auto-reset units via useEffect when type resets to tablet
        setSelectedType('tablet');
        setFrequency('once_daily');
        setTimesPerDay(1);
        setReminderTimes([]); // Clear times so Group Sync can populate the morning slot
        setIsContinuous(true);
        setDurationDays('');
        setStartDate(new Date());
        setEndDate(null);
        setFoodRelationship('anytime');
        setNotes('');
        setShowSuggestions(false);
        // Reset sync lock
        isInternalSync.current = false;
    };

    const availableTypes = Object.keys(ICON_THEMES).filter(t => t !== 'default');
    
    // Helpers for Date/Time pickers
    const onStartDateChange = (dateStr: string) => {
        setStartDate(new Date(dateStr));
        setShowStartDatePicker(false);
    };
    
    const onEndDateChange = (dateStr: string) => {
        setEndDate(new Date(dateStr));
        setShowEndDatePicker(false);
    };

    // Helper to get default time for new slot
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

    const onTimeChange = (event: any, selectedDate?: Date) => {
        const idx = showTimePicker.index;
        setShowTimePicker({show: false, index: -1}); // Close on both platforms

        if (selectedDate) {
            if (idx === reminderTimes.length) {
                // Add new time ONLY on confirm
                setReminderTimes([...reminderTimes, selectedDate]);
            } else if (idx >= 0 && idx < reminderTimes.length) {
                // Update existing time
                const newTimes = [...reminderTimes];
                newTimes[idx] = selectedDate;
                setReminderTimes(newTimes);
            }
        }
    };

    // Add a new reminder time - Opens picker first
    const handleAddTime = () => {
        // Just open picker for the potential new slot (index = length)
        setShowTimePicker({ show: true, index: reminderTimes.length });
    };

    // Remove a reminder time
    const handleRemoveTime = (index: number) => {
        const newTimes = [...reminderTimes];
        newTimes.splice(index, 1);
        setReminderTimes(newTimes);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Medication</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 20 }}
                    >
                        {/* 1. Family Member Selection (Conditional) */}
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

                        {/* 2. Medication Details */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Medication Details</Text>

                            {/* Name Input with Autocomplete */}
                            <Text style={styles.label}>Medicine Name *</Text>
                            <View style={{ zIndex: 10 }}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., Amoxicillin"
                                    value={name}
                                    onChangeText={(text) => {
                                        setName(text);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        {suggestions.map((med) => (
                                            <TouchableOpacity
                                                key={med.id}
                                                style={styles.suggestionItem}
                                                onPress={() => handleSelectSuggestion(med)}
                                            >
                                                <MedicationIcon form={med.form || null} size={16} />
                                                <View style={styles.suggestionTextContainer}>
                                                    <Text style={styles.suggestionName}>{med.name}</Text>
                                                    <Text style={styles.suggestionDetails}>{med.strength} • {med.dosage}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Strength */}
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

                            {/* Type Selector */}
                            <Text style={[styles.label, { marginTop: Sizes.md }]}>Type</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.typeScrollContent}
                            >
                                {availableTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.typeCard,
                                            selectedType === type && styles.typeCardSelected,
                                        ]}
                                        onPress={() => setSelectedType(type as MedicineType)}
                                    >
                                        <MedicationIcon form={type} size={24} />
                                        <Text
                                            style={[
                                                styles.typeCardLabel,
                                                selectedType === type && styles.typeCardLabelSelected,
                                            ]}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* 3. Group & Instructions */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Dosage & Instructions</Text>

                            {/* Group Selection */}
                            <Text style={styles.label}>Group</Text>
                            <TouchableOpacity 
                                style={styles.groupSelectorBar}
                                onPress={() => setShowGroupPicker(true)}
                            >
                                <Text style={[
                                    styles.groupSelectorText, 
                                    selectedGroups.length === 0 && { color: Colors.textSecondary }
                                ]}>
                                    {selectedGroups.length > 0 
                                        ? selectedGroups.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ') 
                                        : 'None'}
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

                        {/* 4. Schedule & Duration */}
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

                            {/* Specific Interval Input */}
                            {frequency === 'specific_interval' && (
                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: Sizes.sm }}>
                                        <Text style={styles.label}>Times per Day</Text>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="numeric"
                                            value={timesPerDay.toString()}
                                            onChangeText={(t) => setTimesPerDay(parseInt(t) || 1)}
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: Sizes.sm }}>
                                        <Text style={styles.label}>Interval (Days)</Text>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="numeric"
                                            value={intervalDays}
                                            onChangeText={setIntervalDays}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Reminder Times */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Sizes.md, marginBottom: 8 }}>
                                <Text style={[styles.label, { marginBottom: 0 }]}>Reminder Times</Text>
                                <TouchableOpacity onPress={handleAddTime} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Feather name="plus-circle" size={24} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.timeGrid}>
                                {reminderTimes.map((time, index) => (
                                    <View key={index} style={{ position: 'relative' }}>
                                        <TouchableOpacity
                                            style={[styles.timeChip, { paddingLeft: 16 }]}
                                            onPress={() => setShowTimePicker({ show: true, index })}
                                        >
                                            <Feather name="clock" size={14} color={Colors.primary} />
                                            <Text style={styles.timeChipText}>
                                                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </TouchableOpacity>
                                        {/* Remove Button - Top Left */}
                                        <TouchableOpacity
                                            style={styles.removeTimeButton}
                                            onPress={() => handleRemoveTime(index)}
                                            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                                        >
                                            <Feather name="minus" size={12} color={Colors.white} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                             {/* Duration and Start Date */}
                            <Text style={[styles.label, { marginTop: Sizes.md }]}>Duration</Text>
                            <View style={styles.card}>
                                <View style={styles.rowBetween}>
                                    <Text style={styles.cardLabel}>Continuous Treatment</Text>
                                    <Switch
                                        trackColor={{ false: Colors.gray200, true: Colors.primary }}
                                        thumbColor={Colors.white}
                                        onValueChange={setIsContinuous}
                                        value={isContinuous}
                                    />
                                </View>

                                {/* Date Pickers inside Card */}
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

                        {/* 5. Notes */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Notes (Optional)</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="e.g., Doctor advised to take with water only"
                                multiline
                                value={notes}
                                onChangeText={setNotes}
                            />
                        </View>
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Add Medication</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Date / Time Modals */}
                {/* Note: Android handling is built-in to the TimePickerModal component logic or handled via native standard */}
                
                {/* Date Pickers */}
                <DatePickerModal 
                    visible={showStartDatePicker}
                    date={startDate.toISOString().split('T')[0]}
                    onConfirm={onStartDateChange}
                    onCancel={() => setShowStartDatePicker(false)}
                    title="Select Start Date"
                />

                <DatePickerModal 
                    visible={showEndDatePicker}
                    date={endDate ? endDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    minimumDate={startDate.toISOString().split('T')[0]}
                    onConfirm={onEndDateChange}
                    onCancel={() => setShowEndDatePicker(false)}
                    title="Select End Date"
                />
                
                <TimePickerModal
                    visible={showTimePicker.show}
                    time={
                        showTimePicker.index < reminderTimes.length 
                            ? reminderTimes[showTimePicker.index] 
                            : getNextDefaultTime()
                    }
                    onConfirm={(date: Date) => onTimeChange(null, date)}
                    onCancel={() => setShowTimePicker({ show: false, index: -1 })}
                    title={showTimePicker.index < reminderTimes.length ? "Edit Reminder Time" : "Add Reminder Time"}
                />

                {/* Unit Picker Modal */}
                <Modal
                    visible={showUnitPicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowUnitPicker(false)}
                >
                    <TouchableOpacity 
                        style={styles.overlay} 
                        activeOpacity={1} 
                        onPress={() => setShowUnitPicker(false)}
                    >
                        <View style={styles.pickerContainer}>
                            <Text style={styles.pickerTitle}>Select Unit</Text>
                            <ScrollView style={{ maxHeight: 300 }}>
                                {(MEDICINE_TYPE_DEFAULTS[selectedType]?.allowedStrengthUnits || []).map((unit) => (
                                    <TouchableOpacity
                                        key={unit}
                                        style={[styles.pickerItem, strengthUnit === unit && styles.pickerItemSelected]}
                                        onPress={() => {
                                            setStrengthUnit(unit);
                                            setShowUnitPicker(false);
                                        }}
                                    >
                                        <Text style={[styles.pickerItemText, strengthUnit === unit && styles.pickerItemTextSelected]}>
                                            {unit}
                                        </Text>
                                        {strengthUnit === unit && <Feather name="check" size={20} color={Colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Group Selection Modal */}
                <Modal
                    visible={showGroupPicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowGroupPicker(false)}
                >
                    <TouchableOpacity 
                        style={styles.overlay} 
                        activeOpacity={1} 
                        onPress={() => setShowGroupPicker(false)}
                    >
                        <View style={styles.pickerContainer}>
                            <Text style={styles.pickerTitle}>Select Group</Text>
                            
                            {/* None Option */}
                            <TouchableOpacity
                                style={[styles.groupOption, selectedGroups.length === 0 && styles.groupOptionSelected]}
                                onPress={() => { setSelectedGroups([]); setShowGroupPicker(false); }}
                            >
                                <Text style={[styles.groupOptionText, selectedGroups.length === 0 && { color: Colors.primary, fontWeight: '600' }]}>
                                    None
                                </Text>
                                {selectedGroups.length === 0 && <Feather name="check" size={20} color={Colors.primary} />}
                            </TouchableOpacity>

                            {/* Morning */}
                            <TouchableOpacity
                                style={[styles.groupOptionCard, { backgroundColor: '#FFF4E5' }, selectedGroups.includes('morning') && styles.groupCardSelected]}
                                onPress={() => {
                                    // Toggle logic
                                    const newGroups = selectedGroups.includes('morning')
                                        ? selectedGroups.filter(g => g !== 'morning')
                                        : [...selectedGroups, 'morning'];
                                    
                                    // If toggling morning ON, verify we don't duplicate logic here, useEffect handles sync
                                    // Actually, we must set state here to trigger useEffect
                                    setSelectedGroups(newGroups);
                                }}
                            >
                                <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                                    <Feather name="sun" size={24} color="#FF9500" />
                                    <Text style={[styles.groupCardTitle, { color: '#FF9500' }]}>Morning</Text>
                                </View>
                                {selectedGroups.includes('morning') && <Feather name="check-circle" size={24} color="#FF9500" />}
                            </TouchableOpacity>

                             {/* Afternoon */}
                             <TouchableOpacity
                                style={[styles.groupOptionCard, { backgroundColor: '#FFF9C4', marginTop: 12 }, selectedGroups.includes('afternoon') && styles.groupCardSelected]}
                                onPress={() => {
                                    const newGroups = selectedGroups.includes('afternoon')
                                        ? selectedGroups.filter(g => g !== 'afternoon')
                                        : [...selectedGroups, 'afternoon'];
                                    setSelectedGroups(newGroups);
                                }}
                            >
                                <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                                    <Feather name="sun" size={24} color="#FBC02D" />
                                    <Text style={[styles.groupCardTitle, { color: '#FBC02D' }]}>Afternoon</Text>
                                </View>
                                {selectedGroups.includes('afternoon') && <Feather name="check-circle" size={24} color="#FBC02D" />}
                            </TouchableOpacity>

                             {/* Night */}
                             <TouchableOpacity
                                style={[styles.groupOptionCard, { backgroundColor: '#E8EAF6', marginTop: 12 }, selectedGroups.includes('night') && styles.groupCardSelected]}
                                onPress={() => {
                                    const newGroups = selectedGroups.includes('night')
                                        ? selectedGroups.filter(g => g !== 'night')
                                        : [...selectedGroups, 'night'];
                                    setSelectedGroups(newGroups);
                                }}
                            >
                                <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                                    <Feather name="moon" size={24} color="#5C6BC0" />
                                    <Text style={[styles.groupCardTitle, { color: '#5C6BC0' }]}>Night</Text>
                                </View>
                                {selectedGroups.includes('night') && <Feather name="check-circle" size={24} color="#5C6BC0" />}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.saveButton, { marginTop: 24, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14 }]} 
                                onPress={() => setShowGroupPicker(false)}
                            >
                                <Text style={[styles.saveButtonText, { fontSize: 16, fontWeight: '600' }]}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '92%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 20,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.xl,
        paddingTop: Sizes.xl,
        paddingBottom: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    closeButton: {
        padding: 4,
        backgroundColor: Colors.gray100,
        borderRadius: 20,
    },
    content: {
        paddingHorizontal: Sizes.xl,
    },
    section: {
        marginTop: Sizes.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Sizes.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 8,
        marginLeft: 2,
    },
    input: {
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        padding: Sizes.md,
        fontSize: 16,
        color: Colors.textPrimary,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    chipContainer: {
        flexDirection: 'row',
        gap: Sizes.sm,
        paddingRight: Sizes.xl,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Sizes.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 20,
        paddingHorizontal: Sizes.md,
        paddingVertical: 8,
        gap: 6,
        marginRight: 8,
    },
    chipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    chipTextSelected: {
        color: Colors.white,
        fontWeight: '600',
    },
    
    // Type Cards
    typeScrollContent: {
        paddingVertical: 4,
        gap: Sizes.md,
    },
    typeCard: {
        width: 72,
        height: 90,
        backgroundColor: Colors.white,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.gray100,
        marginRight: Sizes.sm,
    },
    typeCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '08',
    },
    typeCardLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 6,
        fontWeight: '500',
    },
    typeCardLabelSelected: {
        color: Colors.primary,
        fontWeight: '700',
    },

    // Suggestions
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: Colors.gray200,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray50,
    },
    suggestionTextContainer: {
        marginLeft: 10,
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    suggestionDetails: {
        fontSize: 12,
        color: Colors.textSecondary,
    },

    // Card Styles
    card: {
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray200,
        overflow: 'hidden',
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Sizes.md,
    },
    cardLabel: {
        fontSize: 15,
        color: Colors.textPrimary,
        fontWeight: '500', 
    },
    dateValue: {
        fontSize: 15,
        color: Colors.primary,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.gray200,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // Time Grid
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Sizes.md,
        marginTop: Sizes.sm,
    },


    
    timeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    timeChipText: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '600',
    },
    removeTimeButton: {
        position: 'absolute',
        top: -6,
        left: -8,
        backgroundColor: Colors.primary, 
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.white,
        zIndex: 10,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },

    // Footer
    footer: {
        padding: Sizes.xl,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
        marginBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 18,
        padding: Sizes.lg,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.white,
    },

    // Combined Input & Unit Picker
    combinedInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray200,
        overflow: 'hidden',
    },
    inputUnstyled: {
        fontSize: 16,
        color: Colors.textPrimary,
        padding: Sizes.md,
        height: '100%',
    },
    verticalDivider: {
        width: 1,
        height: '60%',
        backgroundColor: Colors.gray200,
    },
    unitSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Sizes.md,
        paddingVertical: Sizes.md,
        gap: 4,
        backgroundColor: Colors.gray50,
    },
    unitSelectorText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },

    // Group Selector Styles
    groupSelectorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.gray50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray200,
        padding: Sizes.md,
        height: 56,
    },
    groupSelectorText: {
        fontSize: 16,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    groupOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: Colors.white,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.gray100, // Subtle border
    },
    groupOptionSelected: {
        backgroundColor: Colors.white,
        borderColor: Colors.primary,
        borderWidth: 1,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    groupOptionText: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    groupOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    groupCardSelected: {
        // Border color is set dynamically via inline styles for specific colors
    },
    groupCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // Picker Modal - Refined Premium Styling
    pickerContainer: {
        backgroundColor: Colors.white,
        borderRadius: 24, // Smoother corners
        padding: 24,
        width: '85%',
        alignSelf: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
        marginTop: 'auto',
        marginBottom: 'auto',
    },
    pickerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 20,
        textAlign: 'center',
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12, 
    },
    pickerItemSelected: {
        backgroundColor: Colors.primary + '08',
    },
    pickerItemText: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
    pickerItemTextSelected: {
        color: Colors.primary,
        fontWeight: '600',
    },
});
