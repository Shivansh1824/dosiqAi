import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants';
import { ParsedMedication } from '../types/medicationVerification';
import { Medication } from '../types/medication';
import { FamilyMember } from '../types/familyMember';
import { normalizeTime } from '../types/medicationSchedule';
import DatePickerModal from './DatePickerModal';
import { calculateEndDate, isAsNeededFrequency, parseDateOnly } from '../utils/medicationParser';
import { MedicationHeader } from './medication/MedicationHeader';
import { CoursePeriodSection } from './medication/CoursePeriodSection';
import { ReminderTimesSectionLegacy } from './medication/ReminderTimesSectionLegacy';
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
  onLiveUpdate?: (updates: {
    current_reminder_times?: string[];
    start_date?: string;
    end_date?: string;
    duration_days?: number;
  }) => void;
  isFirstItem?: boolean;
  cardIndex?: number; // Index for alternating background colors
  isVerified?: boolean; // NEW: Whether medication is already added to tracker
  isDismissed?: boolean; // NEW: Whether medication is dismissed/deleted
  onRestore?: () => void; // NEW: Callback to restore dismissed medication
  familyMember?: FamilyMember;
  followUpDays?: number; // NEW: Default duration for SOS
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
  isVerified = false,
  isDismissed = false,
  onRestore,
  familyMember,
  followUpDays,
}: MedicationVerificationCardProps) {
  // Use white background for all cards
  const backgroundColor = isVerified ? Colors.gray50 : '#FFFFFF';
  const [medication, setMedication] = useState<ParsedMedication>(initialMedication);
  const [isEditing, setIsEditing] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [startDate, setStartDate] = useState(parseDateOnly(suggestedStartDate));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  // Initialize endDate with the default calculated date so it doesn't float with startDate changes
  const [endDate, setEndDate] = useState<string>(
    calculateEndDate(parseDateOnly(suggestedStartDate), initialMedication.duration_days ?? followUpDays ?? 5)
  );

  // Editable fields state
  const [editedName, setEditedName] = useState(medication.name);
  const [editedNotes, setEditedNotes] = useState(medication.notes);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Reminder toggle states
  const [reminderToggles, setReminderToggles] = useState<boolean[]>([]);
  // NEW: Inactive custom reminders (toggled off but not deleted)
  const [inactiveReminders, setInactiveReminders] = useState<string[]>([]);

  // Helper to compute initial reminder times (moved before state declarations that depend on it)
  const getInitialTimes = (): string[] => {
    const timesPerDay = medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day ?? 0;

    // 1. If prescription has explicit times, use them
    if (medication.time_of_day?.length > 0) {
      return medication.time_of_day;
    }

    // 2. If it has a frequency (times per day), use user's preferred times
    if (timesPerDay > 0) {
      const morning = familyMember?.morning_dose_time || '';
      const afternoon = familyMember?.afternoon_dose_time || '';
      const night = familyMember?.night_dose_time || '';

      if (timesPerDay === 1) return [morning];
      if (timesPerDay === 2) return [morning, night];
      if (timesPerDay === 3) return [morning, afternoon, night];

      const baseTimes = [morning, afternoon, night];
      const result = [...baseTimes];
      const extrasNeeded = timesPerDay - 3;

      for (let i = 0; i < extrasNeeded; i++) {
        const cycleIndex = i % 3;
        const offsetPass = Math.floor(i / 3) + 1;
        const baseTime = baseTimes[cycleIndex];
        const [h, m] = baseTime.split(':').map(Number);
        let newHour = h + offsetPass;
        if (newHour >= 24) newHour -= 24;
        const newTime = `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        result.push(newTime);
      }
      return result.sort();
    }
    return [];
  };

  // Reminder default notes state — initialized SYNCHRONOUSLY so notes are available from first paint.
  // useEffect runs AFTER paint, so lazy useState is the only way to guarantee notes on first frame.
  const [reminderDefaultNotes, setReminderDefaultNotes] = useState<Record<string, string>>(() => {
    const relation = initialMedication.food_relationship || initialMedication.source_raw?.timing?.relation_to_meal;
    if (!relation || relation === 'anytime' || relation === 'any') return {};

    const noteText = getMealTimingLabel(relation);
    const initialTimes = getInitialTimes();

    // Also pre-compute the "expected" batch times from family preferences,
    // since the child component will auto-add these anyway.
    // This ensures notes are ready even for times that getInitialTimes doesn't return
    // (e.g., getInitialTimes returns [morning] but dosage pattern shows Night only).
    const allPossibleTimes = new Set<string>(initialTimes.filter(t => t));

    // Add all family member preferred times — the child's renderGroupedView will show these
    if (familyMember?.morning_dose_time) allPossibleTimes.add(familyMember.morning_dose_time);
    if (familyMember?.afternoon_dose_time) allPossibleTimes.add(familyMember.afternoon_dose_time);
    if (familyMember?.night_dose_time) allPossibleTimes.add(familyMember.night_dose_time);

    const notes: Record<string, string> = {};
    allPossibleTimes.forEach(time => {
      notes[time] = noteText;
    });
    return notes;
  });

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
  const isPureAsNeeded = isAsNeededFrequency(
    medication.timing_dosage ?? medication.source_raw?.timing?.dosage,
    medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day
  );

  // If it's SOS but user has added reminders, we treat it as NOT as-needed for UI purposes (show schedule)
  const isAsNeeded = isPureAsNeeded && customReminderTimes.length === 0;

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

  // Reactive Population of Notes — fires whenever customReminderTimes changes
  // (including the child's auto-sync on mount). Fills gaps without overwriting user edits.
  useEffect(() => {
    if (customReminderTimes.length > 0) {
      const newNotes = generateFoodRelationNotes(customReminderTimes);
      if (Object.keys(newNotes).length > 0) {
        setReminderDefaultNotes(prev => {
          // Merge: new defaults fill gaps, existing user edits take priority
          const merged = { ...newNotes, ...prev };
          // Only update if there are actual changes to avoid unnecessary re-renders
          if (JSON.stringify(merged) !== JSON.stringify(prev)) {
            return merged;
          }
          return prev;
        });
      }
    }
  }, [customReminderTimes, generateFoodRelationNotes]);

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
      // Calculate duration_days based on current state (exact difference)
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Ensure we are comparing dates at the same time of day to avoid timezone/DST issues
      const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

      const diffTime = endUTC - startUTC;
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

      // Include user-edited reminder times in the final medication object
      const activeReminderTimes = customReminderTimes.filter(t => !inactiveReminders.includes(t));
      const finalMedication = {
        ...medication,
        duration_days: diffDays,
        start_date: startDate,
        verified_by_user: true,
        time_of_day: activeReminderTimes, // Use user-edited times, not defaults
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
    const normalizedNewTime = normalizeTime(time);

    // Check if time already exists to avoid duplicates
    if (currentTimes.some(t => normalizeTime(t) === normalizedNewTime)) {
      // Just update the label if it exists
      if (mealLabel !== null) {
        setCustomMealLabels(prev => ({ ...prev, [normalizedNewTime]: mealLabel }));
      }
      return;
    }

    const updatedTimes = [...currentTimes, time].sort();
    setCustomReminderTimes(updatedTimes);
    // Remove from inactive if it was there (reactivating implies removing from inactive list)
    // FIX: Use normalization for robust check
    if (inactiveReminders.some(t => normalizeTime(t) === normalizedNewTime)) {
      setInactiveReminders(prev => prev.filter(t => normalizeTime(t) !== normalizedNewTime));
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


  // Handle batch toggle (Morning/Afternoon/Night OR Custom)
  const handleBatchToggle = (batchId: string, isEnabled: boolean, defaultTime: string) => {
    const currentTimes = getReminderTimes();
    let updatedTimes = [...currentTimes];

    const normalizedDefault = normalizeTime(defaultTime);

    if (isEnabled) {
      // Add the default time if not present
      if (!updatedTimes.some(t => normalizeTime(t) === normalizedDefault)) {
        updatedTimes.push(defaultTime);
        updatedTimes.sort(); // Keep sorted
      }
      // Also remove from inactive reminders since it's now active
      if (inactiveReminders.some(t => normalizeTime(t) === normalizedDefault)) {
        setInactiveReminders(prev => prev.filter(t => normalizeTime(t) !== normalizedDefault));
      }
    } else {
      // Remove the specific default time from ACTIVE list
      updatedTimes = updatedTimes.filter(t => normalizeTime(t) !== normalizedDefault);

      // Add to inactive reminders to persist visibility
      if (!inactiveReminders.some(t => normalizeTime(t) === normalizedDefault)) {
        setInactiveReminders(prev => [...prev, defaultTime]);
      }
    }

    setCustomReminderTimes(updatedTimes);
    // Broadcast live update
    onLiveUpdate?.({ current_reminder_times: updatedTimes });

    // Populate note if adding
    if (isEnabled) {
      const defaults = generateFoodRelationNotes([defaultTime]);
      setReminderDefaultNotes(prev => ({ ...defaults, ...prev }));
    }

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

    // Populate notes for these times (filling gaps)
    const defaults = generateFoodRelationNotes(newTimes);
    setReminderDefaultNotes(prev => ({ ...defaults, ...prev }));
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
      medication.source_raw?.dosage_instruction ||
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
              {(medication.source_raw?.dosage_instruction || medication.dosage) && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Note</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>
                      {medication.source_raw?.dosage_instruction || medication.dosage}
                    </Text>
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
    <View style={[
      styles.card,
      {
        backgroundColor,
        paddingBottom: isVerified || isDismissed ? 12 : 24,
        opacity: isVerified ? 0.95 : 1,
        borderWidth: 1,
        borderColor: Colors.gray200,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }
    ]}>
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
        onRestore={onRestore}
        isDismissed={isDismissed}
        onResetToAI={handleResetToAI}
        onSave={handleSaveEdits}
        onCancel={handleCancelEdits}
        onAnalysisPress={() => handleOpenAnalysisDetail('dosiq Ai Analysis')}
        onNamePress={(e) => handleTooltipPress(e, medication.name)}
        serialNumber={medicineIndex !== undefined ? medicineIndex + 1 : undefined}
        isVerified={isVerified}
      />

      {isDismissed ? null : (
        <>
          {/* Verified Banner - Show at top when verified */}


          {/* Full Card Content - Show greyed out when verified */}
          {/* Full Card Content - Clean Read-Only Mode when verified */}
          <View style={{ paddingBottom: 20 }}>
            {/* AI Summary Static Labels */}
            <View style={styles.summaryContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.aiButtonsRow}
              >
                {medication.medicine_type && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                        {medication.medicine_type}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {medication.medicine_purpose && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                        {medication.medicine_purpose}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {(medication.medicine_type || medication.medicine_purpose) && <View style={styles.divider} />}

            {/* Course Period Section */}
            {/* Course Period Section */}
            <CoursePeriodSection
              startDate={startDate}
              endDate={endDate}
              interval={medication.interval_days ?? medication.source_raw?.interval_days}
              onStartDatePress={() => setShowDatePicker(true)}
              onEndDatePress={() => setShowEndDatePicker(true)}
              onIntervalChange={handleIntervalChange}
              isVerified={isVerified}
              fixedFrequencyText={isAsNeeded && customReminderTimes.length === 0 ? "SOS FOR PAIN" : undefined}
            />

            {/* Start Date Picker Modal */}
            <DatePickerModal
              visible={showDatePicker}
              date={startDate}
              onConfirm={(date) => {
                setStartDate(date);
                setShowDatePicker(false);

                // Calculate new duration and broadcast live update
                const start = new Date(date);
                const end = new Date(endDate);
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                onLiveUpdate?.({
                  start_date: date,
                  end_date: endDate,
                  duration_days: diffDays
                });
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

                // Calculate new duration and broadcast live update
                const start = new Date(startDate);
                const end = new Date(date);
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                onLiveUpdate?.({
                  start_date: startDate,
                  end_date: date,
                  duration_days: diffDays
                });
              }}
              onCancel={() => setShowEndDatePicker(false)}
              minimumDate={startDate}
              maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            />

            {/* Reminder Times Section */}
            {!isAsNeeded && (
              <>
                <ReminderTimesSectionLegacy
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
                  isVerified={isVerified}
                  preferredTimes={{
                    morning: familyMember?.morning_dose_time || undefined,
                    afternoon: familyMember?.afternoon_dose_time || undefined,
                    night: familyMember?.night_dose_time || undefined,
                  }}
                />

              </>
            )}

            <AddReminderModal
              visible={showAddReminderModal}
              onClose={() => setShowAddReminderModal(false)}
              onAdd={handleAddReminderObject}
              existingTimes={getReminderTimes()}
              preferredTimes={{
                morning: familyMember?.morning_dose_time || undefined,
                afternoon: familyMember?.afternoon_dose_time || undefined,
                night: familyMember?.night_dose_time || undefined,
              }}
              timingDosage={medication.timing_dosage}
            />


            {/* Notes Section Removed as per user request */}

            {/* Duplicate Warning */}
          </View>

          {/* Action Status / Warning Banner */}
          {!isVerified && duplicateOf && (
            <View style={styles.duplicateWarning}>
              <Feather name="alert-triangle" size={16} color={Colors.warning} />
              <Text style={styles.duplicateText}>
                Previously prescribed: {duplicateOf.name}
              </Text>
            </View>
          )}
        </>
      )}

      {/* SOS / As Needed Reminder Button */}
      {isPureAsNeeded && customReminderTimes.length === 0 && !isVerified && (
        <View style={styles.sosReminderContainer}>
          <View style={styles.sosHeader}>
            <View style={styles.sosHeaderLeft}>
              <Feather name="bell" size={16} color={Colors.primary} />
              <Text style={styles.sosTitle}>DOSE SCHEDULE</Text>
              <Feather name="info" size={14} color={Colors.gray400} />
            </View>
          </View>

          {/* Indented Container to match ReminderTimesSectionLegacy layout */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 32, marginRight: 4 }} />
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={styles.addSOSReminderButton}
                onPress={() => setShowAddReminderModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="plus-circle" size={18} color={Colors.primary} />
                <Text style={styles.addSOSReminderText}>Add Reminder</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    marginBottom: 12,
    marginHorizontal: 16,
    paddingTop: 0, // Header has its own padding
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
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
    fontFamily: Typography.fontFamily.bold,
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
    fontFamily: Typography.fontFamily.bold,
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
    fontFamily: Typography.fontFamily.medium,
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
    fontFamily: Typography.fontFamily.bold,
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
    borderWidth: 1,
    borderColor: '#93C5FD', // Darker blue border (Blue-300) for visibility
    backgroundColor: '#F0F9FF', // Slight blue tint (Sky-50) solid background
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
    fontFamily: Typography.fontFamily.bold,
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
    fontFamily: Typography.fontFamily.medium,
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
    fontFamily: Typography.fontFamily.bold,
    color: Colors.gray500, // Matches Course Period
    letterSpacing: 0.5, // Matches Course Period
    textTransform: 'uppercase', // Matches Course Period
  },
  tableValueText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
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
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12, // Smaller size
  },
  sosReminderContainer: {
    padding: 16,
    paddingTop: 8,
  },
  sosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sosHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosTitle: {
    fontSize: 11, // Standard: 11
    fontFamily: Typography.fontFamily.bold,
    color: Colors.gray500,
    letterSpacing: 0.5, // Standard: 0.5
  },
  addSOSReminderButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.white, // Changed from light blue to white as per request
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, // Standard: 12
    gap: 6, // Standard: 6
  },
  addSOSReminderText: {
    fontSize: 13, // Standard: 13
    fontFamily: Typography.fontFamily.semibold, // Standard: semibold
    color: Colors.primary,
  },
  // Removed unused styles
});
