import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants';
import { ParsedMedication } from '../types/medicationVerification';
import { Medication } from '../types/medication';
import DatePickerModal from './DatePickerModal';
import { calculateEndDate, isAsNeededFrequency } from '../utils/medicationParser';
import { MedicationHeader } from './medication/MedicationHeader';
import { MedicineInfoTable } from './medication/MedicineInfoTable';
import { CoursePeriodSection } from './medication/CoursePeriodSection';
import { ReminderTimesSection } from './medication/ReminderTimesSection';
import AddReminderModal from './medication/AddReminderModal';

interface MedicationVerificationCardProps {
  medication: ParsedMedication;
  documentId: string;
  documentTitle: string;
  suggestedStartDate: string;
  onVerifyAndAdd: (medication: ParsedMedication, startDate: string) => Promise<void>;
  duplicateOf?: Medication;
  onDismiss?: () => void;
  medicineIndex?: number;
  onLiveUpdate?: (updates: { current_reminder_times: string[] }) => void;
}

/**
 * MedicationVerificationCard - Card for reviewing and adding AI-extracted medications
 * Refactored to use extracted sub-components
 */
export default function MedicationVerificationCard({
  medication: initialMedication,
  documentId,
  documentTitle,
  suggestedStartDate,
  onVerifyAndAdd,
  duplicateOf,
  onDismiss,
  medicineIndex,
  onLiveUpdate,
}: MedicationVerificationCardProps) {
  const [medication, setMedication] = useState<ParsedMedication>(initialMedication);
  const [isEditing, setIsEditing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [startDate, setStartDate] = useState(suggestedStartDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Editable fields state
  const [editedName, setEditedName] = useState(medication.name);
  const [editedNotes, setEditedNotes] = useState(medication.notes);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Reminder toggle states
  const [reminderToggles, setReminderToggles] = useState<boolean[]>([]);

  // Reminder default notes state (for note feature)
  const [reminderDefaultNotes, setReminderDefaultNotes] = useState<Record<string, string>>({});

  // Custom reminder times state (for time picker changes)
  const [customReminderTimes, setCustomReminderTimes] = useState<string[]>([]);
  // Custom meal labels state (overrides global logic per reminder)
  const [customMealLabels, setCustomMealLabels] = useState<Record<string, string>>({});
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);

  // Calculate end date
  const durationDays = medication.duration_days ?? 5;
  const computedEndDate = endDate ?? calculateEndDate(startDate, durationDays);

  // Check if frequency is "As Needed"
  const isAsNeeded = isAsNeededFrequency(
    medication.timing_dosage ?? medication.source_raw?.timing?.dosage,
    medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day
  );

  // Auto-generate reminder times
  const generateAutoReminderTimes = (timesPerDay: number): string[] => {
    const defaultTimes: Record<number, string[]> = {
      1: ['09:00'],
      2: ['09:00', '21:00'],
      3: ['08:00', '14:00', '21:00'],
      4: ['08:00', '12:00', '18:00', '22:00'],
      5: ['07:00', '11:00', '15:00', '19:00', '22:00'],
      6: ['06:00', '10:00', '14:00', '18:00', '21:00', '23:00'],
    };
    return defaultTimes[timesPerDay] || defaultTimes[3];
  };

  // Get reminder times
  const getReminderTimes = (): string[] => {
    // Use custom times if set
    if (customReminderTimes.length > 0) {
      return customReminderTimes;
    }

    const timesPerDay = medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day ?? 0;
    if (medication.time_of_day?.length > 0) {
      return medication.time_of_day;
    }
    if (timesPerDay > 0) {
      return generateAutoReminderTimes(timesPerDay);
    }
    return [];
  };

  // Get interval display text
  const getIntervalText = (): string => {
    const intervalDays = medication.interval_days ?? medication.source_raw?.interval_days;
    if (intervalDays === undefined || intervalDays === null) return '';
    if (intervalDays === 1) return 'Daily';
    if (intervalDays === 2) return 'Alternate Days';
    if (intervalDays === 7) return 'Weekly';
    return `Every ${intervalDays} Days`;
  };

  // Handle save edits
  const handleSaveEdits = () => {
    setMedication({
      ...medication,
      name: editedName,
      notes: editedNotes,
      verified_by_user: true,
    });
    setIsEditing(false);
  };

  // Handle cancel edits
  const handleCancelEdits = () => {
    setEditedName(medication.name);
    setEditedNotes(medication.notes);
    setIsEditing(false);
  };

  // Handle Reset to AI
  const handleResetToAI = () => {
    Alert.alert(
      "Reset to AI Defaults?",
      "This will revert all fields to the original values detected by AI.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setEditedName(initialMedication.name);
            setEditedNotes(initialMedication.notes);
          }
        }
      ]
    );
  };

  // Handle verify and add
  const handleVerifyAndAdd = async () => {
    setIsVerifying(true);
    try {
      const finalMedication = {
        ...medication,
        verified_by_user: true,
      };
      await onVerifyAndAdd(finalMedication, startDate);
    } catch (error) {
      console.error('[MedicationVerificationCard] Error adding medication:', error);
      Alert.alert('Error', 'Failed to add medication. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle delete/dismiss
  const handleDelete = () => {
    Alert.alert(
      'Remove Medication?',
      `${medication.name} will be hidden from this verification list. You can always re-scan the document to see it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onDismiss?.(),
        },
      ],
      { cancelable: true }
    );
  };

  // Handle reminder toggle change
  const handleReminderToggleChange = (index: number, value: boolean) => {
    const newToggles = [...reminderToggles];
    while (newToggles.length <= index) {
      newToggles.push(false);
    }
    newToggles[index] = value;
    setReminderToggles(newToggles);
  };

  // Handle default note change
  const handleDefaultNoteChange = (time: string, note: string) => {
    setReminderDefaultNotes(prev => ({
      ...prev,
      [time]: note
    }));
  };

  // Handle time change from time picker
  const handleTimeChange = (index: number, newTime: string) => {
    const currentTimes = getReminderTimes();
    const updatedTimes = [...currentTimes];
    updatedTimes[index] = newTime;
    updatedTimes[index] = newTime;
    setCustomReminderTimes(updatedTimes);
    // Broadcast live update
    onLiveUpdate?.({ current_reminder_times: updatedTimes });
  };

  // Handle adding new reminder from modal
  const handleAddReminderObject = (time: string, mealLabel: string | null) => {
    const currentTimes = getReminderTimes();
    // Check if time already exists to avoid duplicates
    if (currentTimes.includes(time)) {
      // Just update the label if it exists
      if (mealLabel !== null) {
        setCustomMealLabels(prev => ({ ...prev, [time]: mealLabel }));
      }
      return;
    }

    const updatedTimes = [...currentTimes, time].sort();
    setCustomReminderTimes(updatedTimes);
    // Broadcast live update
    onLiveUpdate?.({ current_reminder_times: updatedTimes });

    // Update toggles - keeping it simple, user can toggle
    // Ideally we'd sync toggles with sort but that requires refactor of toggle state to be a map
    // For now we just append a true toggle which might not align directly if sorted mid-list
    // Optimistic approach:
    setReminderToggles(prev => [...prev, true]);

    // Update Meal Label
    if (mealLabel !== null) {
      setCustomMealLabels(prev => ({
        ...prev,
        [time]: mealLabel
      }));
    }
  };




  // Handle batch toggle (Morning/Afternoon/Evening/Night)
  const handleBatchToggle = (batchId: string, isEnabled: boolean, defaultTime: string) => {
    const currentTimes = getReminderTimes();
    let updatedTimes = [...currentTimes];

    if (isEnabled) {
      // Add the default time if not present
      if (!updatedTimes.includes(defaultTime)) {
        updatedTimes.push(defaultTime);
        updatedTimes.sort(); // Keep sorted
      }
    } else {
      // Remove the specific default time
      // Improvement: Could also remove any time *within* that batch's range, but for now strict default time is safer/simpler
      updatedTimes = updatedTimes.filter(t => t !== defaultTime);
    }

    setCustomReminderTimes(updatedTimes);
    // Broadcast live update
    onLiveUpdate?.({ current_reminder_times: updatedTimes });

    // Sync toggles state (optimistic)
    // In grouped mode, we don't strictly use reminderToggles index mapping like Separate mode
    // But we need to keep the state valid for the backend.
    // Re-generating toggles array to match new times length
    setReminderToggles(new Array(updatedTimes.length).fill(true));
  };


  return (
    <View style={styles.card}>
      {/* Header */}
      <MedicationHeader
        name={medication.name}
        strength={medication.strength}
        form={medication.form}
        confidence={medication.confidence}
        isEditing={isEditing}
        editedName={editedName}
        onEditedNameChange={setEditedName}
        onToggleEdit={() => setIsEditing(!isEditing)}
        onDelete={handleDelete}
      />

      <View style={styles.divider} />

      {/* Medicine Info Table */}
      <MedicineInfoTable medication={medication} />

      {/* Course Period Section */}
      {!isAsNeeded && (
        <CoursePeriodSection
          startDate={startDate}
          endDate={computedEndDate}
          onStartDatePress={() => setShowDatePicker(true)}
          onEndDatePress={() => setShowEndDatePicker(true)}
        />
      )}

      {/* Start Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        date={startDate}
        onConfirm={(date) => {
          setStartDate(date);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        maximumDate={new Date().toISOString().split('T')[0]}
        minimumDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
      />

      {/* End Date Picker Modal */}
      <DatePickerModal
        visible={showEndDatePicker}
        date={computedEndDate}
        onConfirm={(date) => {
          setEndDate(date);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        minimumDate={startDate}
        maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
      />

      {/* Reminder Times Section */}
      {!isAsNeeded && (
        <>
          <ReminderTimesSection
            reminderTimes={getReminderTimes()}
            intervalText={getIntervalText()}
            medicineName={medication.name}
            reminderToggles={reminderToggles}
            totalTimesPerDay={medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day}
            timingDosage={medication.timing_dosage ?? medication.source_raw?.timing?.dosage}
            foodRelationship={medication.food_relationship || medication.source_raw?.timing?.relation_to_meal || undefined}
            onToggleChange={handleReminderToggleChange}
            onTimeChange={handleTimeChange}
            defaultNotes={reminderDefaultNotes}
            onDefaultNoteChange={handleDefaultNoteChange}
            onAddPress={() => setShowAddReminderModal(true)}
            customMealLabels={customMealLabels}

            onBatchToggle={handleBatchToggle}
          />

          <AddReminderModal
            visible={showAddReminderModal}
            onClose={() => setShowAddReminderModal(false)}
            onAdd={handleAddReminderObject}
          />
        </>
      )}


      {/* Notes Section (Compact) */}
      <View style={styles.detailsGrid}>
        {(medication.notes || isEditing) && (
          <View style={styles.notesCompactContainer}>
            {!isEditing ? (
              <View style={styles.notesRow}>
                <View style={styles.notesHeaderGroup}>
                  <Feather name="info" size={14} color={Colors.textSecondary} />
                  <Text style={styles.notesLabel}>Note :</Text>
                </View>
                <Text style={styles.notesValue}>
                  {medication.notes}
                </Text>
              </View>
            ) : (
              <View style={styles.notesEditContainer}>
                <View style={styles.notesHeaderGroup}>
                  <Feather name="info" size={14} color={Colors.textSecondary} />
                  <Text style={styles.notesLabel}>Note :</Text>
                </View>
                <TextInput
                  style={styles.notesInput}
                  value={editedNotes}
                  onChangeText={setEditedNotes}
                  placeholder="Add note..."
                  multiline
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Duplicate Warning */}
      {duplicateOf && (
        <View style={styles.duplicateWarning}>
          <Feather name="alert-triangle" size={16} color={Colors.warning} />
          <Text style={styles.duplicateText}>
            Previously prescribed: {duplicateOf.name}
          </Text>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    paddingTop: 12,
    overflow: 'hidden',
  },
  divider: {
    height: 0,
    backgroundColor: Colors.gray100,
    marginHorizontal: 20,
  },
  detailsGrid: {
    padding: 16,
    gap: 16,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray500,
    letterSpacing: 0.5,
  },
  notesCompactContainer: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 12,
    padding: 12,
    // Removed dashed style for a cleaner look
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  notesEditContainer: {
    gap: 8,
  },
  notesHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 1, // Visual alignment
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray500,
  },
  notesValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.gray800,
  },
  notesInput: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.gray900,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
    padding: 8,
    minHeight: 40,
  },
  duplicateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  duplicateText: {
    fontSize: 12,
    color: Colors.warningDark,
    flex: 1,
    fontWeight: '500',
  },

});
