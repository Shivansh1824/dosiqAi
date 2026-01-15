import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants';
import { ParsedMedication } from '../types/medicationVerification';
import { Medication } from '../types/medication';
import DatePickerModal from './DatePickerModal';
import { calculateEndDate, isAsNeededFrequency } from '../utils/medicationParser';
import { generateCyclicReminderTimes } from '../types/medicationSchedule';
import { MedicationHeader } from './medication/MedicationHeader';
import { CoursePeriodSection } from './medication/CoursePeriodSection';
import { ReminderTimesSection } from './medication/ReminderTimesSection';
import AddReminderModal from './medication/AddReminderModal';
import { InfoModal } from './InfoModal';
import { AnimatedTooltip } from './AnimatedTooltip';

const getMealTimingLabel = (relation: string): string => {
  switch (relation) {
    case 'before_food': return 'Before Meal';
    case 'after_food': return 'After Meal';
    case 'with_food': return 'With Meal';
    case 'empty_stomach': return 'Empty Stomach';
    case 'anytime': return 'Anytime';
    default: return 'Anytime';
  }
};

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
  isFirstItem?: boolean;
  cardIndex?: number; // Index for alternating background colors
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
  isFirstItem = false,
  cardIndex = 0,
}: MedicationVerificationCardProps) {
  // Use white background for all cards
  const backgroundColor = '#FFFFFF';
  const [medication, setMedication] = useState<ParsedMedication>(initialMedication);
  const [isEditing, setIsEditing] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [startDate, setStartDate] = useState(suggestedStartDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  // Initialize endDate with the default calculated date so it doesn't float with startDate changes
  const [endDate, setEndDate] = useState<string>(
    calculateEndDate(suggestedStartDate, initialMedication.duration_days ?? 5)
  );

  // Editable fields state
  const [editedName, setEditedName] = useState(medication.name);
  const [editedNotes, setEditedNotes] = useState(medication.notes);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Reminder toggle states
  const [reminderToggles, setReminderToggles] = useState<boolean[]>([]);
  // NEW: Inactive custom reminders (toggled off but not deleted)
  const [inactiveReminders, setInactiveReminders] = useState<string[]>([]);

  // Reminder default notes state (for note feature)
  const [reminderDefaultNotes, setReminderDefaultNotes] = useState<Record<string, string>>({});

  // Helper to generate initial times
  const getInitialTimes = (): string[] => {
    const timesPerDay = initialMedication.total_times_per_day ?? initialMedication.source_raw?.timing?.total_times_per_day ?? 0;
    if (initialMedication.time_of_day?.length > 0) {
      return initialMedication.time_of_day;
    }
    if (timesPerDay > 0) {
      return generateCyclicReminderTimes(timesPerDay);
    }
    return [];
  };

  // Custom reminder times state (for time picker changes)
  // Initialize with defaults immediately so empty array is valid "all off" state
  const [customReminderTimes, setCustomReminderTimes] = useState<string[]>(getInitialTimes);
  // Custom meal labels state (overrides global logic per reminder)
  const [customMealLabels, setCustomMealLabels] = useState<Record<string, string>>({});
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);

  // Info Modal State
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState('');
  const [infoModalBody, setInfoModalBody] = useState('');

  // Floating Tooltip State
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [tooltipContent, setTooltipContent] = useState('');

  // State for forcing re-render of children
  const [resetKey, setResetKey] = useState(0);

  // Info Modal content state
  const [infoModalContent, setInfoModalContent] = useState<React.ReactNode | null>(null);

  // Calculate end date
  // const durationDays = medication.duration_days ?? 5; // internal Note: no longer needed for floating calculation
  // const computedEndDate = endDate ?? calculateEndDate(startDate, durationDays); // Replaced by fixed state


  // Check if frequency is "As Needed"
  const isAsNeeded = isAsNeededFrequency(
    medication.timing_dosage ?? medication.source_raw?.timing?.dosage,
    medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day
  );

  // Auto-generate reminder times is now handled by shared utility


  // Get reminder times
  const getReminderTimes = (): string[] => {
    return customReminderTimes;
  };

  // Helper to generate default notes based on food relationship
  const generateFoodRelationNotes = useCallback((times: string[]) => {
    const relation = medication.food_relationship || medication.source_raw?.timing?.relation_to_meal;
    if (!relation || relation === 'anytime' || relation === 'any') return {};

    const noteText = getMealTimingLabel(relation);
    const newNotes: Record<string, string> = {};

    times.forEach(time => {
      newNotes[time] = noteText;
    });

    return newNotes;
  }, [medication]);

  // Initial Population of Notes
  useEffect(() => {
    // Only populate if empty (initial load)
    if (Object.keys(reminderDefaultNotes).length === 0) {
      const times = getReminderTimes();
      const initialNotes = generateFoodRelationNotes(times);
      if (Object.keys(initialNotes).length > 0) {
        setReminderDefaultNotes(initialNotes);
      }
    }
  }, []); // Run once on mount (effectively) - usually we depend on medication but we only want initial population

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
      "This will revert all fields and schedules back to the original values detected by dosiq AI.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            // Reset all editable state to initial values
            setMedication(initialMedication);
            setEditedName(initialMedication.name);
            setEditedNotes(initialMedication.notes);
            setStartDate(suggestedStartDate);
            setStartDate(suggestedStartDate);
            // Reset to original calculated end date
            setEndDate(calculateEndDate(suggestedStartDate, initialMedication.duration_days ?? 5));

            // Re-calculate defaults for reset
            const resetTimesList = getInitialTimes(); // Re-use the helper
            setCustomReminderTimes(resetTimesList);

            setReminderToggles([]);
            setInactiveReminders([]); // Clear inactive reminders
            setReminderDefaultNotes({});
            setCustomMealLabels({});

            // UI state
            setIsEditing(false);
            setIsSummaryExpanded(false);

            // Broadcast live update if needed
            onLiveUpdate?.({ current_reminder_times: [] });

            // Re-populate default notes
            // We need to calculate times based on initialMedication since state update is async/batched
            // Re-using logic from getReminderTimes but with initialMedication
            // Actually, easier to let the effect run? No, we need explicit reset.
            let resetTimes = resetTimesList; // Use the list we just calculated

            // Generate notes for these times
            const relation = initialMedication.food_relationship || initialMedication.source_raw?.timing?.relation_to_meal;
            if (relation && relation !== 'anytime' && relation !== 'any') {
              const noteText = getMealTimingLabel(relation);
              const resetNotes: Record<string, string> = {};
              resetTimes.forEach(t => resetNotes[t] = noteText);
              setReminderDefaultNotes(resetNotes);
            }

            // Force re-render of child components (clears internal state like deletedBatchIds)
            setResetKey(prev => prev + 1);
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
      `${medication.name} will be hidden from this verification list.`,
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
  const handleTimeChange = (oldTime: string, newTime: string) => {
    const currentTimes = getReminderTimes();
    const updatedTimes = [...currentTimes];

    // Find the time to replace
    const index = updatedTimes.indexOf(oldTime);

    if (index !== -1) {
      updatedTimes[index] = newTime;
    } else {
      // If not found (edge case: maybe it was an implied time?), we add it?
      // For now, let's append it to be safe, ensuring it gets saved.
      updatedTimes.push(newTime);
    }

    updatedTimes.sort(); // Keep sorted
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
    // Remove from inactive if it was there (reactivating implies removing from inactive list)
    if (inactiveReminders.includes(time)) {
      setInactiveReminders(prev => prev.filter(t => t !== time));
    }
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

    // Add default note if food relationship exists
    // Add default note if food relationship exists OR if user selected a specific label
    const relation = medication.food_relationship || medication.source_raw?.timing?.relation_to_meal;
    let noteToApply = '';

    if (mealLabel) {
      noteToApply = mealLabel;
    } else if (relation && relation !== 'anytime' && relation !== 'any') {
      noteToApply = getMealTimingLabel(relation);
    }

    if (noteToApply) {
      setReminderDefaultNotes(prev => ({
        ...prev,
        [time]: noteToApply
      }));
    }
  };


  // Handle batch toggle (Morning/Afternoon/Evening/Night OR Custom)
  const handleBatchToggle = (batchId: string, isEnabled: boolean, defaultTime: string) => {
    const currentTimes = getReminderTimes();
    let updatedTimes = [...currentTimes];

    if (isEnabled) {
      // Add the default time if not present
      if (!updatedTimes.includes(defaultTime)) {
        updatedTimes.push(defaultTime);
        updatedTimes.sort(); // Keep sorted
      }
      // Also remove from inactive reminders since it's now active
      if (inactiveReminders.includes(defaultTime)) {
        setInactiveReminders(prev => prev.filter(t => t !== defaultTime));
      }
    } else {
      // Remove the specific default time from ACTIVE list
      updatedTimes = updatedTimes.filter(t => t !== defaultTime);

      // Add to inactive reminders to persist visibility (if not already there)
      // We do this for ALL reminders now purely to ensure robustness.
      // If it's a standard batch that is also generated by the section, deduplication in ReminderTimesSection handles it.
      // If it's a standard batch that is NOT generated (e.g. config mismatch), this ensures it stays visible as a custom row.
      if (!inactiveReminders.includes(defaultTime)) {
        setInactiveReminders(prev => [...prev, defaultTime]);
      }
    }

    setCustomReminderTimes(updatedTimes);
    // Broadcast live update
    onLiveUpdate?.({ current_reminder_times: updatedTimes });

    // Sync toggles state (optimistic)
    setReminderToggles(new Array(updatedTimes.length).fill(true));
  };

  // NEW: Handle explicit delete of custom reminder
  const handleDeleteCustomReminder = (time: string) => {
    // Remove from active
    const currentTimes = getReminderTimes();
    if (currentTimes.includes(time)) {
      const updatedTimes = currentTimes.filter(t => t !== time);
      setCustomReminderTimes(updatedTimes);
      onLiveUpdate?.({ current_reminder_times: updatedTimes });
    }

    // Remove from inactive
    if (inactiveReminders.includes(time)) {
      setInactiveReminders(prev => prev.filter(t => t !== time));
    }

    // Remove associated data
    setCustomMealLabels(prev => {
      const next = { ...prev };
      delete next[time];
      return next;
    });
    setReminderDefaultNotes(prev => {
      const next = { ...prev };
      delete next[time];
      return next;
    });
  };

  // Handle bulk update of reminder times (fix for race conditions in auto-sync)
  const handleUpdateReminderTimes = (newTimes: string[]) => {
    setCustomReminderTimes(newTimes);
    onLiveUpdate?.({ current_reminder_times: newTimes });
  };

  const handleIntervalChange = (days: number) => {
    setMedication(prev => ({
      ...prev,
      interval_days: days,
      verified_by_user: true
    }));
  };

  // Handle Analysis Detail Press
  const handleOpenAnalysisDetail = (title: string) => {
    setInfoModalTitle('dosiq Ai Analysis');
    setInfoModalContent(renderAIAnalysisContent());
    setInfoModalVisible(true);
  };

  // Handle Tooltip Press
  const handleTooltipPress = (event: any, content: string) => {
    const { pageX, pageY } = event.nativeEvent;
    setTooltipPosition({ x: pageX, y: pageY });
    setTooltipContent(content);
    setTooltipVisible(true);
  };

  const renderAIAnalysisContent = () => {
    const hasAttributes = !!(
      medication.dosage ||
      medication.duration_days ||
      medication.strength ||
      medication.form ||
      medication.scientific_name ||
      medication.food_relationship
    );

    return (
      <View style={styles.modalContent}>
        <Text style={styles.summaryTextModal}>
          dosiq Ai Analysis: This {medication.medicine_type || 'Medicine'} medicine helps with {medication.medicine_purpose || 'Treatment'}.
        </Text>

        {hasAttributes && (
          <View style={styles.expandedContentModal}>
            <View style={styles.tableBorderContainer}>
              {/* Note Row */}
              {medication.dosage && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Note</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.dosage}</Text>
                  </View>
                </View>
              )}

              {/* Attributes Rows */}
              {medication.duration_days && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Duration</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.duration_days} days</Text>
                  </View>
                </View>
              )}

              {medication.strength && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Strength</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.strength}</Text>
                  </View>
                </View>
              )}

              {medication.form && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Form</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.form}</Text>
                  </View>
                </View>
              )}

              {medication.scientific_name && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Sci Name</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.scientific_name}</Text>
                  </View>
                </View>
              )}

              {medication.food_relationship && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Directions</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{getMealTimingLabel(medication.food_relationship)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };


  return (
    <View style={[styles.card, { backgroundColor }]}>
      {/* Header */}
      <MedicationHeader
        name={medication.name}
        form={medication.form || null}
        confidence={medication.confidence}
        isEditing={isEditing}
        editedName={editedName}
        onEditedNameChange={setEditedName}
        onToggleEdit={() => setIsEditing(!isEditing)}
        onDelete={handleDelete}
        onResetToAI={handleResetToAI}
        onSave={handleSaveEdits}
        onCancel={handleCancelEdits}
        onAnalysisPress={() => handleOpenAnalysisDetail('dosiq Ai Analysis')}
        onNamePress={(e) => handleTooltipPress(e, medication.name)}
        serialNumber={medicineIndex !== undefined ? medicineIndex + 1 : undefined}
      />

      {/* AI Summary Static Labels */}
      <View style={styles.summaryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.aiButtonsRow}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={(e) => handleTooltipPress(e, 'Medication Type')}
          >
            <LinearGradient
              colors={['#FFFFFF', '#EFF6FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.aiButton}
            >
              <View style={styles.aiButtonIcon}>
                <Feather name="layers" size={10} color={Colors.primary} />
              </View>
              <Text style={styles.aiButtonText}>
                {medication.medicine_type || 'Medicine Type'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={(e) => handleTooltipPress(e, 'Medication Purpose')}
          >
            <LinearGradient
              colors={['#FFFFFF', '#EFF6FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.aiButton}
            >
              <View style={styles.aiButtonIcon}>
                <Feather name="activity" size={10} color={Colors.primary} />
              </View>
              <Text style={styles.aiButtonText}>
                {medication.medicine_purpose || 'Medicine Purpose'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.divider} />

      {/* Course Period Section */}
      {!isAsNeeded && (
        <CoursePeriodSection
          startDate={startDate}
          endDate={endDate}
          interval={medication.interval_days ?? medication.source_raw?.interval_days}
          onStartDatePress={() => setShowDatePicker(true)}
          onEndDatePress={() => setShowEndDatePicker(true)}
          onIntervalChange={handleIntervalChange}
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
        date={endDate}
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
            key={`times-section-${resetKey}`}
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
            onUpdateReminderTimes={handleUpdateReminderTimes}
            interval={medication.interval_days ?? medication.source_raw?.interval_days}
            sourceName={medication.source_raw?.exact_written_name}
            originalTotalTimes={medication.source_raw?.timing?.total_times_per_day}
            originalInterval={medication.source_raw?.interval_days}
            shouldAnimate={isFirstItem}
            inactiveReminderTimes={inactiveReminders}
            onDeleteCustomReminder={handleDeleteCustomReminder}
          />

          <AddReminderModal
            visible={showAddReminderModal}
            onClose={() => setShowAddReminderModal(false)}
            onAdd={handleAddReminderObject}
            existingTimes={getReminderTimes()}
          />
        </>
      )}


      {/* Notes Section (Compact) - Only for As Needed (SOS) or when editing */}
      {((medication.notes && isAsNeeded) || isEditing) && (
        <View style={styles.detailsGrid}>
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
        </View>
      )}

      {/* Duplicate Warning */}
      {duplicateOf && (
        <View style={styles.duplicateWarning}>
          <Feather name="alert-triangle" size={16} color={Colors.warning} />
          <Text style={styles.duplicateText}>
            Previously prescribed: {duplicateOf.name}
          </Text>
        </View>
      )}

      {/* Information Modal */}
      <InfoModal
        visible={infoModalVisible}
        title={infoModalTitle}
        onClose={() => setInfoModalVisible(false)}
        hideIcon={infoModalTitle === 'dosiq Ai Analysis'}
      >
        {infoModalContent}
      </InfoModal>

      {/* Floating Tooltip specifically for medicine type and purpose */}
      <AnimatedTooltip
        visible={tooltipVisible}
        content={tooltipContent}
        targetPosition={tooltipPosition}
        onClose={() => setTooltipVisible(false)}
        backgroundColor="#BFDBFE"
        textColor="#000000"
      />

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 30,
    marginHorizontal: 16,
    paddingTop: 0, // Header has its own padding
    paddingBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 80,
    marginTop: 12,
    marginBottom: 12,
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
    marginHorizontal: 18,
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
  summaryContainer: {
    marginTop: 0,
    marginBottom: 0,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.gray600,
    lineHeight: 18,
    fontWeight: '500',
  },
  interactiveText: {
    fontWeight: '700',
    color: Colors.gray600,
  },
  aiButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 16,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  aiButtonIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gray800,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  modalContent: {
    marginBottom: 20,
  },
  summaryTextModal: {
    fontSize: 15, // 13 + 2 as requested
    color: Colors.gray600,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'left',
  },
  expandedContentModal: {
    marginTop: 0,
  },


  // Table Layout Styles
  expandedContent: {
    marginTop: 12,
  },
  tableBorderContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden', // Ensures inner items don't overflow corners
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: Colors.white,
  },
  // Last row trick: The container has a border, but we can't easily target "last child" in RN styles without logic.
  // Instead, we can rely on the container border and make row borders separating.
  // Actually, standard RN way is marginBottom: -1 or just verify Logic.
  // Simplified: All rows have bottom border. The last one will double up with container bottom border unless we handle it.
  // We'll leave it simple for now, or we could add a `style={{borderBottomWidth: 0}}` to the last item rendered.
  // Given dynamic rendering, let's keep it consistent. The overflow hidden handles the radius.

  tableHeaderCell: {
    width: '30%', // Fixed width for "TH" column - Reduced to 30%
    paddingVertical: 8, // Reduced from 12
    paddingHorizontal: 10, // Reduced from 14
    backgroundColor: '#F9FAFB', // Light gray background for headers
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
  },
  tableValueCell: {
    flex: 1, // "TD" column takes remaining space
    paddingVertical: 8, // Reduced from 12
    paddingHorizontal: 10, // Reduced from 14
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gray500, // Matches Course Period
    letterSpacing: 0.5, // Matches Course Period
    textTransform: 'uppercase', // Matches Course Period
  },
  tableValueText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray600, // Matches analysis text
    lineHeight: 18,
  },
  readLessContainer: {
    marginTop: 8,
    alignItems: 'flex-start', // Left aligned
    flexDirection: 'row', // For icon
    gap: 4,
  },
  readMoreText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12, // Smaller size
  },
});
