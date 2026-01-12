import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, TextInput, Platform, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants';

interface Medicine {
    exact_written_name: string;
    timing?: {
        dosage?: string | null;
        relation_to_meal?: string | null;
        total_times_per_day?: number | null;
    };
    current_reminder_times?: string[];
}

interface GroupedBatchRemindersProps {
    medicines: Medicine[];
}

interface BatchData {
    id: string;
    label: string;
    icon: string;
    defaultTime: string;
    medicines: { name: string; mealRelation: string | null }[];
}

const getMealLabel = (batch: string, relationToMeal: string | null | undefined, totalTimesPerDay: number | null | undefined): string | null => {
    if (!relationToMeal || relationToMeal === 'any') return null;
    if (totalTimesPerDay && totalTimesPerDay <= 3) {
        if (relationToMeal === 'after_food') {
            switch (batch) {
                case 'morning': return 'After Breakfast';
                case 'afternoon': return 'After Lunch';
                case 'night': return 'After Dinner';
                default: return 'After Meal';
            }
        }
        if (relationToMeal === 'before_food') {
            switch (batch) {
                case 'morning': return 'Before Breakfast';
                case 'afternoon': return 'Before Lunch';
                case 'night': return 'Before Dinner';
                default: return 'Before Meal';
            }
        }
    }
    if (relationToMeal === 'after_food') return 'After Meal';
    if (relationToMeal === 'before_food') return 'Before Meal';
    if (relationToMeal === 'with_food') return 'With Food';
    if (relationToMeal === 'empty_stomach') return 'Empty Stomach';
    return null;
};

const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const dateToTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const parseDosage = (dosage: string | null | undefined): { morning: boolean; afternoon: boolean; night: boolean } => {
    if (!dosage) return { morning: false, afternoon: false, night: false };
    const parts = dosage.split('-').map(Number);
    return {
        morning: parts[0] > 0,
        afternoon: parts[1] > 0,
        night: parts[2] > 0,
    };
};

const isMedicineInBatch = (med: Medicine, batchId: string): boolean => {
    if (med.current_reminder_times && med.current_reminder_times.length > 0) {
        if (batchId === 'morning') return med.current_reminder_times.includes('08:00');
        if (batchId === 'afternoon') return med.current_reminder_times.includes('14:00');
        if (batchId === 'night') return med.current_reminder_times.includes('21:00');
    } else {
        const dosageInfo = parseDosage(med.timing?.dosage);
        if (batchId === 'morning') return dosageInfo.morning;
        if (batchId === 'afternoon') return dosageInfo.afternoon;
        if (batchId === 'night') return dosageInfo.night;
    }
    return false;
};

const getCustomTimesForMed = (med: Medicine): string[] => {
    if (!med.current_reminder_times) return [];
    const standardTimes = ['08:00', '14:00', '21:00'];
    return med.current_reminder_times.filter(t => !standardTimes.includes(t));
};

export const GroupedBatchReminders: React.FC<GroupedBatchRemindersProps> = ({ medicines }) => {
    const [toggles, setToggles] = useState<Record<string, boolean>>({
        morning: true,
        afternoon: true,
        night: true,
        custom: true
    });
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
    const [notesContent, setNotesContent] = useState<Record<string, string>>({});
    const [manualCustomTimes, setManualCustomTimes] = useState<string[]>([]);

    // Time Editing State
    const [isTimePickerVisible, setTimePickerVisible] = useState(false);
    const [tempTime, setTempTime] = useState(new Date());
    const [editingId, setEditingId] = useState<string | null>(null); // 'morning', 'afternoon', 'custom-12:00'
    const [timeOverrides, setTimeOverrides] = useState<Record<string, string>>({});

    const customMeds = medicines.filter(med => getCustomTimesForMed(med).length > 0);
    const derivedCustomTimes = Array.from(new Set(
        customMeds.flatMap(med => getCustomTimesForMed(med))
    ));

    const allCustomTimes = Array.from(new Set([...derivedCustomTimes, ...manualCustomTimes])).sort();

    useEffect(() => {
        const initialNotes: Record<string, string> = { ...notesContent };

        const generateNoteString = (batchMeds: { name: string; mealRelation: string | null }[]) => {
            if (batchMeds.length === 0) return '';
            return batchMeds.map(m => `• ${m.name}${m.mealRelation ? ` (${m.mealRelation})` : ''}`).join('\n');
        };

        const standardBatches = ['morning', 'afternoon', 'night'];
        standardBatches.forEach(batchId => {
            const batchMeds = medicines
                .filter(m => isMedicineInBatch(m, batchId))
                .map(m => ({
                    name: m.exact_written_name,
                    mealRelation: getMealLabel(batchId, m.timing?.relation_to_meal, m.timing?.total_times_per_day)
                }));
            if (!notesContent[batchId]) {
                initialNotes[batchId] = generateNoteString(batchMeds);
            }
        });

        allCustomTimes.forEach(time => {
            const timeMeds = medicines
                .filter(m => getCustomTimesForMed(m).includes(time))
                .map(m => ({
                    name: m.exact_written_name,
                    mealRelation: getMealLabel('custom', m.timing?.relation_to_meal, m.timing?.total_times_per_day)
                }));
            const key = `custom-${time}`;
            if (!notesContent[key] && timeMeds.length > 0) {
                initialNotes[key] = generateNoteString(timeMeds);
            }
        });

        setNotesContent(initialNotes);
    }, [medicines, allCustomTimes.join(',')]);

    const getBatchCount = (batchId: string) => medicines.filter(med => isMedicineInBatch(med, batchId)).length;

    const batches: BatchData[] = [
        { id: 'morning', label: `Morning Dose (${getBatchCount('morning')})`, icon: 'sunrise', defaultTime: '08:00', medicines: [] },
        { id: 'afternoon', label: `Afternoon Dose (${getBatchCount('afternoon')})`, icon: 'sun', defaultTime: '14:00', medicines: [] },
        { id: 'night', label: `Night Dose (${getBatchCount('night')})`, icon: 'moon', defaultTime: '21:00', medicines: [] },
    ];

    const toggleBatch = (batchId: string) => {
        setToggles(prev => ({ ...prev, [batchId]: !prev[batchId] }));
    };

    const toggleCustomTime = (time: string) => {
        const key = `custom-${time}`;
        const current = toggles[key] !== false;
        setToggles(prev => ({ ...prev, [key]: !current }));
    };

    const toggleNoteExpansion = (id: string) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleNoteChange = (id: string, text: string) => {
        setNotesContent(prev => ({ ...prev, [id]: text }));
    };

    // Time Picker Logic
    const openTimePicker = (id: string, currentTimeString: string) => {
        setEditingId(id);
        const [hours, minutes] = currentTimeString.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes);
        setTempTime(date);
        setTimePickerVisible(true);
    };

    const handleAddCustomPress = () => {
        setEditingId('NEW_CUSTOM'); // Special ID for new custom time
        setTempTime(new Date());
        setTimePickerVisible(true);
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setTimePickerVisible(false);
            if (event.type === 'set' && selectedDate) {
                confirmTimeSelection(selectedDate);
            }
        } else {
            if (selectedDate) setTempTime(selectedDate);
        }
    };

    const handleIOSConfirm = () => {
        confirmTimeSelection(tempTime);
        setTimePickerVisible(false);
    };

    const confirmTimeSelection = (date: Date) => {
        const timeStr = dateToTimeString(date);

        if (editingId === 'NEW_CUSTOM') {
            setManualCustomTimes(prev => [...prev, timeStr]);
            setToggles(prev => ({ ...prev, [`custom-${timeStr}`]: true }));
        } else if (editingId) {
            // Update override for existing batch
            setTimeOverrides(prev => ({ ...prev, [editingId]: timeStr }));
        }
        setEditingId(null);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Feather name="clock" size={16} color={Colors.primary} />
                    <Text style={styles.headerTitle}>DAILY ROUTINES</Text>
                </View>
            </View>

            <View style={styles.batchesContainer}>
                {batches.map((batch) => {
                    const isOn = toggles[batch.id];
                    const isExpanded = expandedNotes[batch.id];
                    const count = getBatchCount(batch.id);
                    const hasNotes = count > 0;

                    // Display Time: Override -> Default
                    const displayTime = timeOverrides[batch.id] || batch.defaultTime;

                    return (
                        <View key={batch.id} style={styles.batchBarWrapper}>
                            <View style={[styles.batchBar, isOn && styles.batchBarActive]}>
                                <View style={styles.batchLeft}>
                                    <View style={[styles.batchIcon, isOn && styles.batchIconActive]}>
                                        <Feather name={batch.icon as any} size={16} color={isOn ? Colors.primary : Colors.gray400} />
                                    </View>
                                    <TouchableOpacity onPress={() => openTimePicker(batch.id, displayTime)}>
                                        <Text style={[styles.batchTime, isOn && styles.batchTimeActive]}>{formatTime(displayTime)}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.batchCenter}>
                                    <Text style={[styles.batchName, isOn && styles.batchNameActive]}>{batch.label}</Text>
                                </View>
                                <View style={styles.batchRight}>
                                    <Switch
                                        value={isOn}
                                        onValueChange={() => toggleBatch(batch.id)}
                                        trackColor={{ false: Colors.gray200, true: Colors.primary }}
                                        thumbColor={Colors.white}
                                        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                    />
                                    <TouchableOpacity onPress={() => toggleNoteExpansion(batch.id)} style={styles.noteIconButton}>
                                        <MaterialCommunityIcons name="clipboard-text-outline" size={18} color={hasNotes ? '#F59E0B' : Colors.gray400} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {isExpanded && (
                                <View style={styles.notesSection}>
                                    <Text style={styles.notesTitle}>Medicines & Notes:</Text>
                                    <TextInput
                                        style={styles.notesInput}
                                        value={notesContent[batch.id]}
                                        onChangeText={(text) => handleNoteChange(batch.id, text)}
                                        multiline
                                        placeholder="Add notes..."
                                        placeholderTextColor={Colors.gray400}
                                    />
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* CUSTOM SECTION */}
                <View style={[styles.batchBarWrapper, { marginTop: 4 }]}>
                    <View style={[styles.batchBar, toggles.custom && styles.batchBarActive]}>
                        <View style={styles.batchLeft}>
                            <View style={[styles.batchIcon, toggles.custom && styles.batchIconActive]}>
                                <Feather name="clock" size={16} color={toggles.custom ? Colors.primary : Colors.gray400} />
                            </View>
                            <Text style={[styles.batchName, toggles.custom && styles.batchNameActive, { marginLeft: 10 }]}>
                                Custom ({allCustomTimes.filter(time => toggles[`custom-${time}`] !== false).length})
                            </Text>
                        </View>
                        <View style={styles.batchRight}>
                            <TouchableOpacity onPress={handleAddCustomPress} style={styles.inlineAddButton}>
                                <Feather name="plus" size={16} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => toggleBatch('custom')} style={styles.noteIconButton}>
                                <Feather name={toggles.custom ? "chevron-up" : "chevron-down"} size={20} color={Colors.gray400} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Sub-List for Custom Times */}
                    {toggles.custom && (
                        <View style={{ marginTop: 8, gap: 8 }}>
                            {allCustomTimes.map((time) => {
                                const noteKey = `custom-${time}`;
                                const isNotesExpanded = expandedNotes[noteKey];
                                const countAtTime = medicines.filter(m => getCustomTimesForMed(m).includes(time)).length;
                                const isSubToggleOn = toggles[noteKey] !== false;

                                // Custom Time Override logic
                                // We key overrides by the ORIGINAL time for stability
                                const displayTime = timeOverrides[noteKey] || time;

                                return (
                                    <View key={time} style={{ marginLeft: 16 }}>
                                        <View style={[styles.batchBar, isSubToggleOn && styles.batchBarActive, { paddingVertical: 8, borderColor: isSubToggleOn ? Colors.primary + '30' : Colors.gray200 }]}>
                                            <View style={styles.batchLeft}>
                                                <View style={[styles.batchIcon, isSubToggleOn && styles.batchIconActive, { width: 24, height: 24 }]}>
                                                    <Feather name="clock" size={14} color={isSubToggleOn ? Colors.primary : Colors.gray400} />
                                                </View>
                                                {/* CLICKABLE TIME */}
                                                <TouchableOpacity onPress={() => openTimePicker(noteKey, displayTime)}>
                                                    <Text style={[styles.batchTime, isSubToggleOn && styles.batchTimeActive, { marginLeft: 4 }]}>
                                                        {formatTime(displayTime)}
                                                    </Text>
                                                </TouchableOpacity>
                                                {countAtTime > 0 && (
                                                    <Text style={{ fontSize: 11, color: Colors.gray400, marginLeft: 4 }}>
                                                        ({countAtTime})
                                                    </Text>
                                                )}
                                            </View>

                                            <View style={styles.batchRight}>
                                                <Switch
                                                    value={isSubToggleOn}
                                                    onValueChange={() => toggleCustomTime(time)}
                                                    trackColor={{ false: Colors.gray200, true: Colors.primary }}
                                                    thumbColor={Colors.white}
                                                    style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                                                />
                                                <TouchableOpacity onPress={() => toggleNoteExpansion(noteKey)} style={[styles.noteIconButton, { width: 28 }]}>
                                                    <MaterialCommunityIcons name="clipboard-text-outline" size={16} color="#F59E0B" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {isNotesExpanded && (
                                            <View style={[styles.notesSection, { marginTop: 6 }]}>
                                                <Text style={styles.notesTitle}>Medicines:</Text>
                                                <TextInput
                                                    style={styles.notesInput}
                                                    value={notesContent[noteKey]}
                                                    onChangeText={(text) => handleNoteChange(noteKey, text)}
                                                    multiline
                                                    placeholder="Notes..."
                                                    placeholderTextColor={Colors.gray400}
                                                />
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>

            {isTimePickerVisible && (
                Platform.OS === 'ios' ? (
                    <Modal transparent animationType="fade">
                        <View style={styles.centeredView}>
                            <View style={styles.modalView}>
                                <DateTimePicker
                                    value={tempTime}
                                    mode="time"
                                    display="spinner"
                                    onChange={handleTimeChange}
                                />
                                <View style={styles.modalButtonContainer}>
                                    <TouchableOpacity style={[styles.modalButton, styles.buttonCancel]} onPress={() => setTimePickerVisible(false)}>
                                        <Text style={styles.textStyle}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalButton, styles.buttonConfirm]} onPress={handleIOSConfirm}>
                                        <Text style={styles.textStyle}>Confirm</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                ) : (
                    <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display="default"
                        onChange={handleTimeChange}
                    />
                )
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 16, marginBottom: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 11, fontWeight: '700', color: Colors.gray500, letterSpacing: 0.5 },
    batchesContainer: { gap: 10 },
    batchBarWrapper: { marginBottom: 0 },
    batchBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.gray50, borderRadius: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, borderWidth: 1, borderColor: Colors.gray200 },
    batchBarActive: { backgroundColor: '#EFF6FF', borderColor: Colors.primary + '30' },
    batchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    batchIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center' },
    batchIconActive: { backgroundColor: Colors.primary + '15' },
    batchTime: { fontSize: 14, fontWeight: '700', color: Colors.gray500, minWidth: 70 },
    batchTimeActive: { color: Colors.gray900 },
    batchCenter: { flex: 1, marginLeft: 8 },
    batchName: { fontSize: 13, fontWeight: '600', color: Colors.gray500 },
    batchNameActive: { color: Colors.primary },
    mealLabel: { fontSize: 10, fontWeight: '500', color: Colors.gray400, marginTop: 1 },
    batchRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    noteIconButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    notesSection: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 10, marginTop: 8, padding: 12 },
    notesTitle: { fontSize: 11, fontWeight: '600', color: '#92400E', marginBottom: 8 },
    notesInput: { fontSize: 12, color: '#78716C', minHeight: 40, textAlignVertical: 'top', lineHeight: 18 },

    // Inline Add Button
    inlineAddButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4
    },

    // Modal
    centeredView: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, alignItems: 'center' },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20, gap: 10 },
    modalButton: { flex: 1, borderRadius: 10, padding: 10, elevation: 2 },
    buttonCancel: { backgroundColor: Colors.gray400 },
    buttonConfirm: { backgroundColor: Colors.primary },
    textStyle: { color: 'white', fontWeight: 'bold', textAlign: 'center' }
});
