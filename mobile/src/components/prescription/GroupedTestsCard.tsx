import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Platform, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants';
import DatePickerModal from '../DatePickerModal';

interface TestReminder {
    id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    note: string;
    isEnabled: boolean;
}

interface RecommendedTest {
    test_name: string;
    reason?: string | null;
}

interface GroupedTestsCardProps {
    tests: RecommendedTest[];
    onSave?: (reminders: TestReminder[]) => void;
}

/**
 * GroupedTestsCard
 * Displays all recommended tests in a single "Lab Visit" card with a unified reminder.
 */
export const GroupedTestsCard: React.FC<GroupedTestsCardProps> = ({
    tests,
    onSave
}) => {
    // We only need ONE reminder state for the whole group (initially empty or one default)
    // But for consistency with the UI pattern, let's allow adding multiple "Visits" if needed, 
    // or just keep it simple with a list of reminders like the previous card.
    // The user requirement is "one reminder/alarm for all tests". 
    // So we will stick to the same pattern: User clicks "Add Reminder" to add a planned visit.

    const [reminders, setReminders] = useState<TestReminder[]>([]);
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [activeReminderId, setActiveReminderId] = useState<string | null>(null);

    // Time Picker State
    const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
    const [tempTime, setTempTime] = useState<Date>(new Date());

    // Handle Add Reminder
    const handleAddReminder = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const newReminder: TestReminder = {
            id: Math.random().toString(36).substr(2, 9),
            date: dateStr,
            time: '09:00', // Default 9 AM
            note: '',
            isEnabled: true,
        };

        setReminders(prev => [...prev, newReminder]);
    };

    // Handle Delete Reminder
    const handleDeleteReminder = (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id));
    };

    // Handle Toggle
    const handleToggle = (id: string, value: boolean) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, isEnabled: value } : r));
    };

    // Handle Date Change
    const initiateDateChange = (id: string) => {
        setActiveReminderId(id);
        setShowDatePicker(true);
    };

    const handleDateConfirm = (date: string) => {
        if (activeReminderId) {
            setReminders(prev => prev.map(r => r.id === activeReminderId ? { ...r, date } : r));
        }
        setShowDatePicker(false);
        setActiveReminderId(null);
    };

    // Handle Time Change
    const initiateTimeChange = (id: string, currentTime: string) => {
        const [hours, minutes] = currentTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setTempTime(date);
        setShowTimePicker(id);
    };

    const handleTimePickerChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(null);
            if (event.type === 'set' && selectedDate && showTimePicker) {
                updateTime(showTimePicker, selectedDate);
            }
        } else {
            // iOS
            if (selectedDate) setTempTime(selectedDate);
        }
    };

    const handleIOSConfirmTime = () => {
        if (showTimePicker) {
            updateTime(showTimePicker, tempTime);
        }
        setShowTimePicker(null);
    };

    const updateTime = (id: string, date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        setReminders(prev => prev.map(r => r.id === id ? { ...r, time: `${hours}:${minutes}` } : r));
    };

    // Handle Note
    const toggleNote = (id: string) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const updateNote = (id: string, text: string) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, note: text } : r));
    };

    // Format Helpers
    const formatDateDisplay = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    };

    const formatTimeDisplay = (time24: string) => {
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    return (
        <LinearGradient
            colors={['#E0F2FE', '#F0F9FF', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.container}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <View style={styles.iconBadge}>
                        <SymbolView
                            name={{ ios: 'waveform.path.ecg', android: 'monitor_heart' }}
                            size={16}
                            tintColor={Colors.primary}
                            fallback={<Feather name="activity" size={16} color={Colors.primary} />}
                        />
                    </View>
                    <View>
                        <Text style={styles.cardTitle}>Lab Visit</Text>
                        <Text style={styles.cardSubtitle}>Recommended for {tests.length} tests</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddReminder}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <View style={styles.addBtnContainer}>
                        <SymbolView
                            name={{ ios: 'plus', android: 'add' }}
                            size={16}
                            tintColor={Colors.white}
                            fallback={<Feather name="plus" size={16} color={Colors.white} />}
                        />
                        <Text style={styles.addBtnText}>Reminder</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Test List (Chips) */}
            <View style={styles.testsContainer}>
                {tests.map((test, index) => (
                    <View key={index} style={styles.testChip}>
                        <Text style={styles.testChipText}>{test.test_name}</Text>
                    </View>
                ))}
            </View>

            {/* Reminders List */}
            <View style={styles.remindersList}>
                {reminders.map((reminder) => {
                    const isNoteExpanded = expandedNotes[reminder.id];
                    const hasNote = reminder.note.length > 0;

                    return (
                        <View key={reminder.id} style={styles.reminderItemContainer}>
                            <View style={styles.reminderBar}>
                                {/* Date Picker Trigger */}
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => initiateDateChange(reminder.id)}
                                    activeOpacity={0.7}
                                >
                                    <SymbolView
                                        name={{ ios: 'calendar', android: 'calendar_today' }}
                                        size={14}
                                        tintColor={Colors.gray600}
                                        fallback={<Feather name="calendar" size={14} color={Colors.gray600} />}
                                    />
                                    <Text style={styles.dateText}>{formatDateDisplay(reminder.date)}</Text>
                                </TouchableOpacity>

                                {/* Vertical Divider */}
                                <View style={styles.verticalDivider} />

                                {/* Time Picker Trigger */}
                                <TouchableOpacity
                                    style={styles.timeButton}
                                    onPress={() => initiateTimeChange(reminder.id, reminder.time)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.timeText}>{formatTimeDisplay(reminder.time)}</Text>
                                </TouchableOpacity>

                                <View style={{ flex: 1 }} />

                                {/* Actions */}
                                <View style={styles.actionsRow}>
                                    {/* Switch */}
                                    <Switch
                                        value={reminder.isEnabled}
                                        onValueChange={(val) => handleToggle(reminder.id, val)}
                                        trackColor={{ false: Colors.gray300, true: Colors.primary }}
                                        thumbColor={Colors.white}
                                        ios_backgroundColor={Colors.gray300}
                                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                    />

                                    {/* Note Toggle */}
                                    <TouchableOpacity
                                        onPress={() => toggleNote(reminder.id)}
                                        style={styles.iconButton}
                                        activeOpacity={0.7}
                                    >
                                        <SymbolView
                                            name={{ ios: 'square.and.pencil', android: 'edit' }}
                                            size={20}
                                            tintColor={hasNote ? '#F59E0B' : Colors.gray400}
                                            fallback={<MaterialCommunityIcons name="clipboard-edit-outline" size={20} color={hasNote ? '#F59E0B' : Colors.gray400} />}
                                        />
                                    </TouchableOpacity>
                                    {/* Delete Button */}
                                    <TouchableOpacity
                                        onPress={() => handleDeleteReminder(reminder.id)}
                                        style={styles.iconButton}
                                        activeOpacity={0.7}
                                    >
                                        <SymbolView
                                            name={{ ios: 'trash', android: 'delete' }}
                                            size={18}
                                            tintColor={Colors.error}
                                            fallback={<Feather name="trash-2" size={18} color={Colors.error} />}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Expandable Note Area */}
                            {isNoteExpanded && (
                                <View style={styles.noteSection}>
                                    <View style={styles.noteInputContainer}>
                                        <SymbolView
                                            name={{ ios: 'bubble.left', android: 'chat_bubble' }}
                                            size={16}
                                            tintColor="#D97706"
                                            fallback={<MaterialCommunityIcons name="comment-text-outline" size={16} color="#D97706" />}
                                        />
                                        <TextInput
                                            style={styles.noteInput}
                                            value={reminder.note}
                                            onChangeText={(text) => updateNote(reminder.id, text)}
                                            placeholder="Add instructions (e.g., 'Fasting required')..."
                                            placeholderTextColor={Colors.gray400}
                                            multiline
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Shared Date Picker Modal */}
            <DatePickerModal
                visible={showDatePicker}
                date={activeReminderId ? reminders.find(r => r.id === activeReminderId)?.date || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                onConfirm={handleDateConfirm}
                onCancel={() => setShowDatePicker(false)}
                minimumDate={new Date().toISOString().split('T')[0]}
            />

            {/* Shared Time Picker (iOS Modal) */}
            {Platform.OS === 'ios' && showTimePicker && (
                <Modal transparent animationType="fade" visible={true}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <DateTimePicker
                                value={tempTime}
                                mode="time"
                                display="spinner"
                                onChange={handleTimePickerChange}
                                textColor={Colors.gray900}
                            />
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowTimePicker(null)}>
                                    <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleIOSConfirmTime}>
                                    <Text style={styles.modalBtnTextConfirm}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Android Time Picker */}
            {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker
                    value={tempTime}
                    mode="time"
                    display="default"
                    onChange={handleTimePickerChange}
                />
            )}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#BAE6FD', // Soft sky blue border
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        overflow: 'hidden', // Ensure gradient respects border radius
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.1)', // Primary tint
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray900,
    },
    cardSubtitle: {
        fontSize: 12,
        color: Colors.gray500,
        marginTop: 2,
    },
    addButton: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    addBtnContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 4,
    },
    addBtnText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: '600',
    },
    testsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    testChip: {
        backgroundColor: 'transparent', // Transparent to blend with gradient
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.25)', // Subtle blue border for definition
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    testChipText: {
        fontSize: 13,
        color: Colors.gray900, // Black text
        fontWeight: '500',
    },
    remindersList: {
        gap: 10,
        marginTop: 12,
    },
    reminderItemContainer: {
    },
    reminderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF', // Blue reminder bar (original)
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        minHeight: 48,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray800,
    },
    verticalDivider: {
        width: 1,
        height: 20,
        backgroundColor: Colors.gray300,
        marginHorizontal: 12,
    },
    timeButton: {
        justifyContent: 'center',
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray900,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0, // Remove gap between icons
    },
    iconButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noteSection: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FCD34D',
        borderRadius: 10,
        marginTop: 8,
        padding: 10,
    },
    noteInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    noteInputIcon: {
        marginTop: 2,
    },
    noteInput: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        color: '#78716C',
        minHeight: 36,
        padding: 0,
        textAlignVertical: 'top',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: Colors.gray100,
    },
    confirmBtn: {
        backgroundColor: Colors.primary,
    },
    modalBtnTextCancel: {
        color: Colors.gray700,
        fontWeight: '600',
    },
    modalBtnTextConfirm: {
        color: 'white',
        fontWeight: '600',
    },
});
