import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming, withRepeat } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants';
import { ParsedMedication } from '../types/medicationVerification';
import { Medication } from '../types/medication';
import { FamilyMember } from '../types/familyMember';
import { normalizeTime } from '../types/medicationSchedule';
import DatePickerModal from './DatePickerModal';
import { calculateEndDate, isAsNeededFrequency, parseDateOnly, generateDefaultTimeSlots, getMealTimingLabel } from '../utils/medicationParser';
import { MedicationHeader } from './medication/MedicationHeader';
import { CoursePeriodSection } from './medication/CoursePeriodSection';
import { ReminderTimesSectionLegacy } from './medication/ReminderTimesSectionLegacy';
import AddReminderModal from './medication/AddReminderModal';
import { InfoModal } from './InfoModal';
import { AnimatedTooltip } from './AnimatedTooltip';
import { IconGlow } from './medication/IconGlow';
import { AIAnalysisModalContent } from './medication/AIAnalysisModalContent';
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
  confidenceScore?: number; // NEW: Document-level confidence score (0.0-1.0)
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
  confidenceScore,
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
    const timesPerDay = medication.total_times_per_day ?? 0;

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
    const relation = initialMedication.food_relationship;
    if (!relation || relation === 'anytime') return {};

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

  // Calculate end date
  // const durationDays = medication.duration_days ?? 5; // internal Note: no longer needed for floating calculation
  // const computedEndDate = endDate ?? calculateEndDate(startDate, durationDays); // Replaced by fixed state


  // Check if frequency is "As Needed"
  const isPureAsNeeded = isAsNeededFrequency(
    medication.timing_dosage ?? medication.dosage,
    medication.total_times_per_day
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
    const relation = medication.food_relationship;
    if (!relation || relation === 'anytime') return {};

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

  // NEW FIX: Broadcast state immediately and when custom times/dates change so parent has the generated reminder times
  useEffect(() => {
    onLiveUpdate?.({
      current_reminder_times: customReminderTimes,
      start_date: startDate,
      end_date: endDate,
    });
  }, [customReminderTimes, startDate, endDate]);

  // Get interval display text
  const getIntervalText = (): string => {
    const intervalDays = medication.interval_days;
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
            const relation = initialMedication.food_relationship;
            if (relation && relation !== 'anytime') {
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
    // DEBUG: Time formatting matching trace
    console.log(`[handleTimeChange] Old Time: ${oldTime} (Normalized: ${normalizeTime(oldTime)}), New Time: ${newTime}`);

    const currentTimes = getReminderTimes();
    const updatedTimes = [...currentTimes];

    // Find the time to replace by comparing normalized times
    const index = updatedTimes.findIndex(t => normalizeTime(t) === normalizeTime(oldTime));

    if (index !== -1) {
      console.log(`[handleTimeChange] Found match at index ${index} - replacing with ${newTime}`);
      updatedTimes[index] = newTime;
    } else {
      console.log(`[handleTimeChange] Match not found for ${oldTime}! Appending ${newTime} instead.`);
      // If not found (edge case: maybe it was an implied time?), we add it?
      // For now, let's append it to be safe, ensuring it gets saved.
      updatedTimes.push(newTime);
    }

    // Flag oldTime as inactive so ReminderTimesSectionLegacy doesn't automatically re-add it
    // ONLY if it was a required standard/default time.
    const morning = familyMember?.morning_dose_time ? normalizeTime(familyMember.morning_dose_time) : '08:00';
    const afternoon = familyMember?.afternoon_dose_time ? normalizeTime(familyMember.afternoon_dose_time) : '14:00';
    const night = familyMember?.night_dose_time ? normalizeTime(familyMember.night_dose_time) : '21:00';
    const initials = getInitialTimes().map(normalizeTime);
    const normalizedOld = normalizeTime(oldTime);

    const isStandardTime = normalizedOld === morning || normalizedOld === afternoon || normalizedOld === night || initials.includes(normalizedOld);

    if (isStandardTime) {
      setInactiveReminders(prev => {
        if (prev.some(t => normalizeTime(t) === normalizedOld)) {
          return prev;
        }
        return [...prev, oldTime];
      });
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
    const relation = medication.food_relationship;
    let noteToApply = '';

    if (mealLabel) {
      noteToApply = mealLabel;
    } else if (relation && relation !== 'anytime') {
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
    setMedication(prev => {
      return {
        ...prev,
        interval_days: days === 0 ? null : days,
        verified_by_user: true
      };
    });
  };

  // Handle Analysis Detail Press
  const handleOpenAnalysisDetail = (title: string) => {
    setInfoModalTitle('dosiq Ai Analysis');
    setInfoModalVisible(true);
  };

  // Handle Tooltip Press
  const handleTooltipPress = (event: any, content: string) => {
    const { pageX, pageY } = event.nativeEvent;
    setTooltipPosition({ x: pageX, y: pageY });
    setTooltipContent(content);
    setTooltipVisible(true);
  };




  return (
    <View style={[
      styles.card,
      {
        backgroundColor,
        paddingBottom: isVerified || isDismissed ? 10 : 8,
        opacity: isVerified ? 0.95 : 1,
        borderWidth: 1,
        borderColor: Colors.gray200,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden', // Required for IconGlow clipping
      }
    ]}>
      {/* Pulsing glow background */}
      <IconGlow />

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
        onNamePress={() => handleOpenAnalysisDetail('dosiq Ai Analysis')}
        serialNumber={medicineIndex !== undefined ? medicineIndex + 1 : undefined}
        isVerified={isVerified}
      />

      {isDismissed ? null : (
        <>
          {/* Verified Banner - Show at top when verified */}


          {/* Full Card Content - Show greyed out when verified */}
          {/* Full Card Content - Clean Read-Only Mode when verified */}
          <View style={{ paddingBottom: 8 }}>
            {/* AI Summary Static Labels */}
            <View style={styles.summaryContainer}>
              <View style={styles.aiButtonsRow}>
                {/* 1. Purpose — highlighted */}
                {medication.medicine_purpose && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => handleTooltipPress(e, 'Medication Purpose')}
                  >
                    <View style={styles.aiButtonPurpose}>
                      <View style={styles.aiButtonIcon}>
                        <Feather name="activity" size={10} color="#6D28D9" />
                      </View>
                      <Text style={styles.aiButtonTextPurpose}>
                        {medication.medicine_purpose}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 2. Meal Relation — highlighted */}
                {medication.food_relationship && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => handleTooltipPress(e, 'Meal Relation')}
                  >
                    <View style={styles.aiButtonMeal}>
                      <View style={styles.aiButtonIcon}>
                        <Feather name="coffee" size={10} color="#B45309" />
                      </View>
                      <Text style={styles.aiButtonTextMeal}>
                        {getMealTimingLabel(medication.food_relationship)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 3. Note / Instructions — highlighted */}
                {(medication.source_raw?.instructions || medication.dosage) && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => handleTooltipPress(e, 'Note')}
                  >
                    <View style={styles.aiButtonInstruction}>
                      <View style={styles.aiButtonIcon}>
                        <Feather name="file-text" size={10} color="#059669" />
                      </View>
                      <Text style={styles.aiButtonTextInstruction}>
                        {medication.source_raw?.instructions || medication.dosage}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 4. Strength */}
                {medication.strength && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => handleTooltipPress(e, 'Strength')}
                  >
                    <View style={styles.aiButton}>
                      <View style={styles.aiButtonIcon}>
                        <Feather name="zap" size={10} color={Colors.gray600} />
                      </View>
                      <Text style={styles.aiButtonText}>
                        {medication.strength}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 5. Type */}
                {medication.medicine_type && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => handleTooltipPress(e, 'Medication Type')}
                  >
                    <View style={styles.aiButton}>
                      <View style={styles.aiButtonIcon}>
                        <Feather name="layers" size={10} color={Colors.gray600} />
                      </View>
                      <Text style={styles.aiButtonText}>
                        {medication.medicine_type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 6. Duration */}
                {medication.duration_days && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => handleTooltipPress(e, 'Duration')}
                  >
                    <View style={styles.aiButton}>
                      <View style={styles.aiButtonIcon}>
                        <Feather name="clock" size={10} color={Colors.gray600} />
                      </View>
                      <Text style={styles.aiButtonText}>
                        {medication.duration_days} Days
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {(medication.medicine_type || medication.medicine_purpose) && <View style={styles.divider} />}

            {/* Course Period Section */}
            <CoursePeriodSection
              startDate={startDate}
              endDate={endDate}
              interval={medication.interval_days ?? medication.source_raw?.gap_between_days}
              onStartDatePress={() => setShowDatePicker(true)}
              onEndDatePress={() => setShowEndDatePicker(true)}
              onIntervalChange={handleIntervalChange}
              isVerified={isVerified}
              fixedFrequencyText={(medication.interval_days === null || medication.interval_days === 0) ? "S.O.S" : undefined}
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
                  totalTimesPerDay={medication.total_times_per_day}
                  timingDosage={medication.timing_dosage}
                  foodRelationship={medication.food_relationship || undefined}
                  onToggleChange={handleReminderToggleChange}
                  onTimeChange={handleTimeChange}
                  defaultNotes={reminderDefaultNotes}
                  onDefaultNoteChange={handleDefaultNoteChange}
                  onAddPress={() => setShowAddReminderModal(true)}
                  customMealLabels={customMealLabels}

                  onBatchToggle={handleBatchToggle}
                  onUpdateReminderTimes={handleUpdateReminderTimes}
                  interval={medication.interval_days ?? medication.source_raw?.gap_between_days}
                  sourceName={medication.source_raw?.name_as_written || medication.name}
                  originalTotalTimes={medication.total_times_per_day}
                  originalInterval={medication.interval_days ?? undefined}
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
              initialMealLabel={
                (medication.food_relationship === 'before_food') ? 'Before Meal' :
                  (medication.food_relationship === 'after_food') ? 'After Meal' :
                    (medication.food_relationship === 'empty_stomach') ? 'Empty Stomach' : null
              }
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
        <AIAnalysisModalContent medication={medication} confidenceScore={confidenceScore} />
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
    paddingHorizontal: 10,
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
    paddingHorizontal: 8,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F3F4F6', // Colors.gray100
    gap: 6,
  },
  aiButtonIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#4B5563', // Colors.gray600
    letterSpacing: 0,
  },
  // ── Highlighted chip: Medication Purpose (indigo/purple) ──
  aiButtonPurpose: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#EDE9FE', // violet-100
    borderWidth: 1,
    borderColor: '#C4B5FD', // violet-300
    gap: 6,
  },
  aiButtonTextPurpose: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#5B21B6', // violet-800
    letterSpacing: 0,
  },
  // ── Highlighted chip: Meal Relation (amber/warm) ──
  aiButtonMeal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FEF3C7', // amber-100
    borderWidth: 1,
    borderColor: '#FCD34D', // amber-300
    gap: 6,
  },
  aiButtonTextMeal: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#92400E', // amber-800
    letterSpacing: 0,
  },
  // ── Highlighted chip: Instructions (emerald/green) ──
  aiButtonInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#D1FAE5', // emerald-100
    borderWidth: 1,
    borderColor: '#6EE7B7', // emerald-300
    gap: 6,
  },
  aiButtonTextInstruction: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#065F46', // emerald-800
    letterSpacing: 0,
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
    paddingTop: 4,
    paddingBottom: 4,
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
