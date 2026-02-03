import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Switch } from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
// Removed unused import generateCyclicReminderTimes and MedicineType which caused errors
import { MedicationFrequency, FoodRelationship } from '../types/medication';
import { useMedicationsStore } from '../store/medicationsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { MedicationIcon, ICON_THEMES } from './medication/MedicationIcons';
import { useAuthStore } from '../store/authStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import TimePickerModal from './TimePickerModal';

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
    const [name, setName] = useState('');
    const [strength, setStrength] = useState('');
    const [dosage, setDosage] = useState(''); // e.g., "1 Tablet"
    const [selectedType, setSelectedType] = useState<MedicineType>('tablet');
    
    // For Whom
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');

    // Schedule
    const [intervalDays, setIntervalDays] = useState('1'); // Derived from frequency usually
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

    // Update reminder times when timesPerDay changes
    useEffect(() => {
        const generateTimes = () => {
             // Generate default times starting from 8:00 AM spaced out
             const times: Date[] = [];
             const startHour = 8;
             const interval = Math.floor(12 / (timesPerDay || 1)); // Spread over 12 hours (8am to 8pm)
             
             for (let i = 0; i < timesPerDay; i++) {
                 const d = new Date();
                 d.setHours(startHour + (i * interval), 0, 0, 0);
                 times.push(d);
             }
             return times;
        };

        // Preserve existing times if possible, otherwise regenerate
        if (reminderTimes.length !== timesPerDay) {
            const defaults = generateTimes();
            // Try to keep as many existing user-set times as matched
            const merged = defaults.map((def, i) => reminderTimes[i] || def);
            setReminderTimes(merged);
        }
    }, [timesPerDay]);

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

    // Filter active medications for suggestions
    const activeMeds = useMemo(() => getActiveMedications(), [visible]);
    const filteredSuggestions = useMemo(() => {
        if (!name || !showSuggestions) return [];
        return activeMeds.filter(med => 
            med.name.toLowerCase().includes(name.toLowerCase())
        ).slice(0, 5);
    }, [name, activeMeds, showSuggestions]);

    const handleSelectSuggestion = (med: any) => {
        setName(med.name);
        setStrength(med.strength || '');
        setDosage(med.dosage || '');
        setSelectedType((med.form?.toLowerCase() as MedicineType) || 'tablet');
        
        // Try to map frequency/schedule
        if (med.frequency) {
             const freq = med.frequency as MedicationFrequency;
             setFrequency(freq);
        }
        
        setShowSuggestions(false);
    };

    const handleSave = () => {
        if (!name || !dosage) {
            alert('Please fill in Medicine Name and Dosage');
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
            strength,
            
            dosage: dosage,
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
        setStrength('');
        setDosage('');
        setSelectedType('tablet');
        setFrequency('once_daily');
        setTimesPerDay(1);
        setIsContinuous(true);
        setDurationDays('');
        setStartDate(new Date());
        setEndDate(null);
        setFoodRelationship('anytime');
        setNotes('');
        setShowSuggestions(false);
    };

    const availableTypes = Object.keys(ICON_THEMES).filter(t => t !== 'default');
    
    // Helpers for Date/Time pickers
    const onStartDateChange = (event: any, selectedDate?: Date) => {
        setShowStartDatePicker(Platform.OS === 'ios');
        if (selectedDate) setStartDate(selectedDate);
    };
    
    const onEndDateChange = (event: any, selectedDate?: Date) => {
        setShowEndDatePicker(Platform.OS === 'ios');
        if (selectedDate) setEndDate(selectedDate);
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
                                {showSuggestions && filteredSuggestions.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        {filteredSuggestions.map((med) => (
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
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 500mg"
                                value={strength}
                                onChangeText={setStrength}
                            />

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

                        {/* 3. Dosage & Instructions */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Dosage & Instructions</Text>

                            <Text style={styles.label}>Dosage Quantity *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 1 Tablet, 5ml"
                                value={dosage}
                                onChangeText={setDosage}
                            />

                            <Text style={[styles.label, { marginTop: Sizes.md }]}>When to take?</Text>
                            <View style={styles.chipGrid}>
                                {(['before_food', 'with_food', 'after_food', 'empty_stomach', 'anytime'] as FoodRelationship[]).map((rel) => (
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
                            </View>
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
                
                {showStartDatePicker && (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                            if (Platform.OS !== 'ios') setShowStartDatePicker(false);
                            if (d) setStartDate(d);
                        }}
                    />
                )}
                 {showEndDatePicker && (
                    <DateTimePicker
                        value={endDate || new Date()}
                        minimumDate={startDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                            if (Platform.OS !== 'ios') setShowEndDatePicker(false);
                            if (d) setEndDate(d);
                        }}
                    />
                )}
                
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
});
