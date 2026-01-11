import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView, ActivityIndicator, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { ParsedMedication, VerificationConfidence } from '../types/medicationVerification';
import { getFrequencyText, getFoodRelationshipText, FoodRelationship } from '../types/medication';
import { Medication } from '../types/medication';
import DatePickerModal from './DatePickerModal';
import { formatFrequencyDisplay } from '../utils/medicationParser';
import { getTimeOfDayCategory } from '../types/medicationSchedule';

interface MedicationVerificationCardProps {
  medication: ParsedMedication;
  documentId: string;
  documentTitle: string;
  suggestedStartDate: string; // YYYY-MM-DD format (AI-extracted or upload date)
  onVerifyAndAdd: (medication: ParsedMedication, startDate: string) => Promise<void>;
  duplicateOf?: Medication;

  // Dismiss functionality
  onDismiss?: () => void;
  medicineIndex?: number;
}

export default function MedicationVerificationCard({
  medication: initialMedication,
  documentId,
  documentTitle,
  suggestedStartDate,
  onVerifyAndAdd,
  duplicateOf,
  onDismiss,
  medicineIndex,
}: MedicationVerificationCardProps) {
  const [medication, setMedication] = useState<ParsedMedication>(initialMedication);
  const [isEditing, setIsEditing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [startDate, setStartDate] = useState(suggestedStartDate);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Editable fields state
  const [editedName, setEditedName] = useState(medication.name);
  const [editedDosage, setEditedDosage] = useState(medication.dosage);
  const [editedNotes, setEditedNotes] = useState(medication.notes);
  const [editedFrequency, setEditedFrequency] = useState(medication.frequency);
  const [editedTimeSlots, setEditedTimeSlots] = useState(medication.time_of_day);
  const [editedFoodRelationship, setEditedFoodRelationship] = useState<FoodRelationship | undefined>(medication.food_relationship || 'anytime');
  const [editedDuration, setEditedDuration] = useState<number>(medication.duration_days || 5);

  // Modal state for frequency, food relationship, and time slots
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showFoodRelationshipPicker, setShowFoodRelationshipPicker] = useState(false);
  const [showTimeSlotEditor, setShowTimeSlotEditor] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [tempTime, setTempTime] = useState(new Date());
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Reminder toggle states (OFF by default for each time slot)
  const [reminderToggles, setReminderToggles] = useState<boolean[]>([]);

  // Auto-generate reminder times based on total_times_per_day
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

  // Get reminder times (from medication or auto-generated)
  const getReminderTimes = (): string[] => {
    const timesPerDay = medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day ?? 0;
    if (medication.time_of_day?.length > 0) {
      return medication.time_of_day;
    }
    if (timesPerDay > 0) {
      return generateAutoReminderTimes(timesPerDay);
    }
    return [];
  };

  // Format time for display (24h -> 12h with AM/PM)
  const formatTimeDisplay = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
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

  // Get clean medicine name for display (without strength, Title Case)
  const getCleanMedicineName = (): string => {
    let name = medication.name || '';
    // Remove strength patterns like "200mg", "500 mg", "10ml", etc.
    name = name.replace(/\s*\d+\s*(mg|ml|mcg|g|iu|%)/gi, '').trim();
    // Remove bracketed numbers like "(200)", "(500)", "(250/5)", etc.
    name = name.replace(/\s*\(\s*[\d\/\.]+\s*(mg|ml|mcg|g)?\s*\)/gi, '').trim();
    // Convert to Title Case (first letter of each word capitalized)
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get food relation display text (null for 'any' to hide it)
  const getFoodRelation = (): string | null => {
    const relation = medication.food_relationship || medication.source_raw?.timing?.relation_to_meal;
    if (!relation || relation === 'any' || relation === 'anytime') return null;
    if (relation === 'after_food') return 'After Meal';
    if (relation === 'before_food') return 'Before Meal';
    if (relation === 'with_food') return 'With Meal';
    if (relation === 'empty_stomach') return 'Empty Stomach';
    return null;
  };

  // Get dynamic meal label based on time, dosage pattern, and total_times_per_day
  const getMealLabel = (time: string, index: number): string | null => {
    const relation = medication.food_relationship || medication.source_raw?.timing?.relation_to_meal;

    // If no meal relationship or it's 'any'/'anytime', return null
    if (!relation || relation === 'any' || relation === 'anytime') return null;

    // Determine prefix based on meal relationship
    const prefix = relation === 'before_food' ? 'Before' :
      relation === 'after_food' ? 'After' :
        relation === 'with_food' ? 'With' : null;

    if (!prefix) return null;

    // Get total times per day from AI analysis
    const totalTimesPerDay = medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day;

    // If total_times_per_day > 3, show generic meal label
    if (totalTimesPerDay && totalTimesPerDay > 3) {
      return `${prefix} Meal`;
    }

    // If total_times_per_day <= 3, show specific meal based on time of day
    if (totalTimesPerDay && totalTimesPerDay <= 3) {
      // Get dosage pattern (e.g., "1-0-1" or "1-1-1")
      const dosagePattern = medication.timing_dosage ?? medication.source_raw?.timing?.dosage;

      // Determine time category for this specific time slot
      const timeCategory = getTimeOfDayCategory(time);

      // Map time category to meal name
      const mealMap: Record<string, string> = {
        'morning': 'Breakfast',
        'afternoon': 'Lunch',
        'night': 'Dinner'
      };

      const mealName = mealMap[timeCategory];

      if (mealName) {
        return `${prefix} ${mealName}`;
      }
    }

    // Fallback: show generic meal label if we have data but couldn't determine specific meal
    if (totalTimesPerDay || medication.timing_dosage || medication.source_raw?.timing?.dosage) {
      return `${prefix} Meal`;
    }

    // No data available, return null
    return null;
  };

  // Duration Options (Medical Research based: Acute 1-14, Cycles 21-30, Chronic 60-90)
  const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 28, 30, 45, 60, 90];

  // Frequency options
  const FREQUENCY_OPTIONS = [
    { value: 'once_daily', label: 'Once Daily', icon: '1×' },
    { value: 'twice_daily', label: 'Twice Daily', icon: '2×' },
    { value: 'three_times_daily', label: '3 Times Daily', icon: '3×' },
    { value: 'four_times_daily', label: '4 Times Daily', icon: '4×' },

    { value: 'weekly', label: 'Weekly', icon: '1/wk' },
    { value: 'as_needed', label: 'As Needed', icon: 'PRN' },
  ];

  const FOOD_RELATIONSHIP_OPTIONS = [
    { value: 'empty_stomach', label: 'Empty Stomach', icon: '⏰', description: '30-60 min before food' },
    { value: 'before_food', label: 'Before Food', icon: '🍽️', description: '5-15 min before meals' },
    { value: 'with_food', label: 'With Food', icon: '🍴', description: 'During or immediately after' },
    { value: 'after_food', label: 'After Food', icon: '✅', description: '1-2 hours after meals' },
    { value: 'anytime', label: 'Anytime', icon: '🔄', description: 'No restriction' },
  ];

  // Helper to generate default time slots based on frequency
  const generateDefaultTimeSlots = (frequency: string): string[] => {
    switch (frequency) {
      case 'once_daily':
        return ['09:00'];
      case 'twice_daily':
        return ['09:00', '21:00'];
      case 'three_times_daily':
        return ['09:00', '14:00', '21:00'];
      case 'four_times_daily':
        return ['09:00', '13:00', '17:00', '21:00'];
      default:
        return [];
    }
  };

  // Helper to get max time slots allowed for a frequency
  const getMaxTimeSlotsForFrequency = (frequency: string): number | null => {
    switch (frequency) {
      case 'once_daily':
        return 1;
      case 'twice_daily':
        return 2;
      case 'three_times_daily':
        return 3;
      case 'four_times_daily':
        return 4;
      case 'every_other_day':
        return 1;
      case 'weekly':
        return 1;
      case 'as_needed':
        return null; // No limit
      default:
        return null;
    }
  };

  // Get confidence indicator styling
  const getConfidenceStyles = (confidence: VerificationConfidence) => {
    switch (confidence) {
      case 'high':
        return {
          badgeColor: '#E6F4EA', // Soft green background
          badgeTextColor: '#1E4620', // Dark green text
          iconColor: '#137333', // Medium green icon
          icon: 'check-circle' as const,
          text: 'AI Confident',
        };
      case 'medium':
        return {
          badgeColor: '#FEF7E0', // Soft yellow background
          badgeTextColor: '#5F370E', // Dark yellow/brown text
          iconColor: '#F9AB00', // Medium yellow icon
          icon: 'alert-circle' as const,
          text: 'AI Uncertain',
        };
      case 'low':
        return {
          badgeColor: '#FCE8E6', // Soft red background
          badgeTextColor: '#8C1D18', // Dark red text
          iconColor: '#C5221F', // Medium red icon
          icon: 'alert-triangle' as const,
          text: 'AI Assumed',
        };
    }
  };

  const confidenceStyle = getConfidenceStyles(medication.confidence);

  // Handle save edits
  const handleSaveEdits = () => {
    setMedication({
      ...medication,
      name: editedName,
      dosage: editedDosage,
      notes: editedNotes,
      frequency: editedFrequency,
      time_of_day: editedTimeSlots,
      food_relationship: editedFoodRelationship,
      duration_days: editedDuration, // Save the edited duration
      verified_by_user: true, // Mark as user-verified after editing
    });
    setIsEditing(false);
  };

  // Handle cancel edits
  const handleCancelEdits = () => {
    setEditedName(medication.name);
    setEditedDosage(medication.dosage);
    setEditedNotes(medication.notes);
    setEditedFrequency(medication.frequency);
    setEditedTimeSlots(medication.time_of_day);
    setEditedFoodRelationship(medication.food_relationship);
    setEditedDuration(medication.duration_days || 5); // Reset duration
    setIsEditing(false);
  };

  // Handle Reset to AI (Original Values)
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
            setEditedDosage(initialMedication.dosage);
            setEditedNotes(initialMedication.notes);
            setEditedFrequency(initialMedication.frequency);
            setEditedTimeSlots(initialMedication.time_of_day);
            setEditedFoodRelationship(initialMedication.food_relationship);
            setEditedDuration(initialMedication.duration_days || 5);
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

  // Handle delete/dismiss medication
  const handleDelete = () => {
    Alert.alert(
      'Remove Medication?',
      `${medication.name} will be hidden from this verification list. You can always re-scan the document to see it again.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (onDismiss) {
              onDismiss();
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.card}>
      {/* Header Row: Name & Confidence Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Feather name="package" size={20} color={Colors.primary} />
          </View>
          <View style={styles.headerTitleContainer}>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Medication name"
                autoFocus
                multiline
              />
            ) : (
              <Text style={styles.medicationName} numberOfLines={2} adjustsFontSizeToFit>
                {medication.name}
              </Text>
            )}

            <View style={styles.subtitleRow}>
              {/* Confidence Badge moved here to prevent title squeezing */}
              {!isEditing && (
                <>
                  <View style={[styles.confidenceBadge, { backgroundColor: confidenceStyle.badgeColor, paddingVertical: 2, paddingHorizontal: 6 }]}>
                    <Feather name={confidenceStyle.icon} size={10} color={confidenceStyle.iconColor} />
                    <Text style={[styles.confidenceText, { color: confidenceStyle.badgeTextColor, fontSize: 9 }]}>
                      {confidenceStyle.text}
                    </Text>
                  </View>

                  {/* Strength & Form Display */}
                  {(medication.strength || medication.form) && (
                    <Text style={[styles.tableHeaderText, { textTransform: 'lowercase' }]}>
                      {medication.strength}
                      {medication.strength && medication.form ? ' ' : ''}
                      {medication.form && (
                        <Text style={{ textTransform: 'capitalize' }}>
                          {medication.form}
                        </Text>
                      )}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setIsEditing(!isEditing)}
              activeOpacity={0.7}
            >
              <Feather name={isEditing ? 'x' : 'edit-3'} size={18} color={Colors.gray500} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={18} color={Colors.gray500} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Medicine Info Table - Scientific Name, Type, Purpose */}
      {(medication.scientific_name || medication.medicine_type || medication.medicine_purpose) && (
        <View style={styles.medicineInfoTable}>
          {/* Sci Name Row */}
          {medication.scientific_name && (
            <View style={styles.tableRow}>
              <View style={styles.tableLabelCell}>
                <Text style={styles.tableHeaderText}>Sci Name</Text>
              </View>
              <View style={styles.tableValueCell}>
                <Text style={styles.tableDataText} numberOfLines={2}>
                  {medication.scientific_name}
                </Text>
              </View>
            </View>
          )}
          {/* Med Type Row */}
          {medication.medicine_type && (
            <View style={styles.tableRow}>
              <View style={styles.tableLabelCell}>
                <Text style={styles.tableHeaderText}>Med Type</Text>
              </View>
              <View style={styles.tableValueCell}>
                <Text style={styles.tableDataText} numberOfLines={2}>
                  {medication.medicine_type}
                </Text>
              </View>
            </View>
          )}
          {/* Med Purpose Row */}
          {medication.medicine_purpose && (
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={styles.tableLabelCell}>
                <Text style={styles.tableHeaderText}>Med Purpose</Text>
              </View>
              <View style={styles.tableValueCell}>
                <Text style={styles.tableDataText} numberOfLines={2}>
                  {medication.medicine_purpose}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Frequency & Duration Table */}
      {(medication.source_raw?.timing || medication.timing_dosage || medication.total_times_per_day || medication.interval_days !== undefined || medication.duration_days || medication.source_raw?.duration_days) && (
        <View style={styles.medicineInfoTable}>
          {/* Frequency Row */}
          <View style={styles.tableRow}>
            <View style={styles.tableLabelCell}>
              <Text style={styles.tableHeaderText}>Frequency</Text>
            </View>
            <View style={styles.tableValueCell}>
              <Text style={styles.tableDataText} numberOfLines={2}>
                {formatFrequencyDisplay(
                  medication.timing_dosage ?? medication.source_raw?.timing?.dosage,
                  medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day,
                  medication.interval_days ?? medication.source_raw?.interval_days
                )}
              </Text>
            </View>
          </View>

          {/* Duration Row */}
          {(medication.duration_days || medication.source_raw?.duration_days) && (
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={styles.tableLabelCell}>
                <Text style={styles.tableHeaderText}>Duration</Text>
              </View>
              <View style={styles.tableValueCell}>
                <Text style={styles.tableDataText}>
                  {medication.duration_days ?? medication.source_raw?.duration_days} Days
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REMINDER TIME BARS SECTION
          Time on LEFT, Dose label CENTER, Toggle switch RIGHT (OFF default)
      ═══════════════════════════════════════════════════════════════════ */}
      {getReminderTimes().length > 0 && (
        <View style={styles.reminderBarsContainer}>
          {/* Section Header */}
          <View style={styles.reminderHeader}>
            <View style={styles.reminderHeaderLeft}>
              <Feather name="bell" size={16} color={Colors.primary} />
              <Text style={styles.reminderTitle}>REMINDER TIMES</Text>
              {getIntervalText() && (
                <View style={styles.intervalBadge}>
                  <Text style={styles.intervalText}>{getIntervalText()}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Time Bars - Modern Design: Time | Label + Toggle */}
          <View style={styles.timeBarsWrapper}>
            {getReminderTimes().map((time, index) => (
              <TouchableOpacity
                key={`time-bar-${index}`}
                style={styles.timeBarModern}
                activeOpacity={0.9}
                onPress={() => {
                  if (isEditing) {
                    setEditingTimeIndex(index);
                    const [h, m] = time.split(':').map(Number);
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    setTempTime(d);
                    setShowTimeSlotEditor(true);
                  }
                }}
              >
                {/* LEFT: Time Display - Stylish */}
                <Text style={styles.timeBarTimeLeft}>{formatTimeDisplay(time)}</Text>

                {/* CENTER: Dynamic Meal Label (specific to time and dosage) */}
                {getMealLabel(time, index) && (
                  <Text style={styles.timeBarFoodRelation}>{getMealLabel(time, index)}</Text>
                )}

                {/* RIGHT GROUP: Label + Toggle (closer together) */}
                <View style={styles.timeBarRightGroup}>
                  <Text style={styles.timeBarDoseLabel} numberOfLines={1}>
                    {getCleanMedicineName()}
                  </Text>
                  <Switch
                    value={reminderToggles[index] || false}
                    onValueChange={(value) => {
                      const newToggles = [...reminderToggles];
                      while (newToggles.length <= index) {
                        newToggles.push(false);
                      }
                      newToggles[index] = value;
                      setReminderToggles(newToggles);
                    }}
                    trackColor={{
                      false: Colors.gray300,
                      true: Colors.primary
                    }}
                    thumbColor={Colors.white}
                    ios_backgroundColor={Colors.gray300}
                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Medication Details Grid */}
      {/* Medication Details Grid - Compact Layout */}
      <View style={styles.detailsGrid}>

        {/* Vitals Row: Dosage | Frequency | Food */}
        <View style={styles.vitalsContainer}>
          {/* Dosage */}
          <View style={styles.vitalItem}>
            <View style={styles.vitalIconBadge}>
              <Feather name="layers" size={14} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.vitalLabel}>DOSAGE</Text>
              {isEditing ? (
                <TextInput
                  style={styles.vitalInput}
                  value={editedDosage}
                  onChangeText={setEditedDosage}
                  placeholder="e.g. 500mg"
                />
              ) : (
                <Text style={styles.vitalValue}>{medication.dosage || '--'}</Text>
              )}
            </View>
          </View>

          <View style={styles.verticalDivider} />

          {/* Frequency */}
          <View style={styles.vitalItem}>
            <View style={styles.vitalIconBadge}>
              <Feather name="clock" size={14} color={Colors.secondary} />
            </View>
            <View>
              <Text style={styles.vitalLabel}>FREQ</Text>
              {isEditing ? (
                <TouchableOpacity onPress={() => setShowFrequencyPicker(true)}>
                  <Text style={styles.vitalValueLink}>
                    {getFrequencyText(editedFrequency).replace(/ daily/i, '\ndaily').replace('As needed', 'As\nneeded')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.vitalValue}>
                  {getFrequencyText(medication.frequency).replace(/ daily/i, '\ndaily').replace('As needed', 'As\nneeded')}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.verticalDivider} />

          {/* Food */}
          <View style={styles.vitalItem}>
            <View style={styles.vitalIconBadge}>
              <Feather name="coffee" size={14} color={Colors.warning} />
            </View>
            <View>
              <Text style={styles.vitalLabel}>TAKE</Text>
              {isEditing ? (
                <TouchableOpacity onPress={() => setShowFoodRelationshipPicker(true)}>
                  <Text style={styles.vitalValueLink}>
                    {getFoodRelationshipText(editedFoodRelationship).replace(' ', '\n')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.vitalValue}>
                  {getFoodRelationshipText(medication.food_relationship).replace(' ', '\n')}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Time Slots - Horizontal Scroll (The "Potato" Fix) */}
        {(medication.time_of_day.length > 0 || isEditing) && (
          <View style={styles.sectionItem}>
            <View style={styles.compactHeaderRow}>
              <Text style={styles.detailLabel}>SCHEDULE</Text>
              {isEditing && (
                <TouchableOpacity
                  style={styles.addTimeTinyButton}
                  onPress={() => {
                    const maxSlots = getMaxTimeSlotsForFrequency(editedFrequency);
                    if (maxSlots === null || editedTimeSlots.length < maxSlots) {
                      setEditingTimeIndex(null);
                      setTempTime(new Date());
                      setShowTimeSlotEditor(true);
                    } else {
                      Alert.alert('Limit Reached', 'Change frequency to add more.');
                    }
                  }}
                >
                  <Feather name="plus" size={12} color={Colors.primary} />
                  <Text style={styles.addTimeTinyText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeScrollContainer}>
              {(isEditing ? editedTimeSlots : medication.time_of_day).map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.timeChipCompact}
                  activeOpacity={isEditing ? 0.7 : 1}
                  onPress={() => {
                    if (isEditing) {
                      setEditingTimeIndex(index);
                      // Robust Parsing
                      try {
                        const [h, m] = time.split(':').map(Number);
                        if (!isNaN(h) && !isNaN(m)) {
                          const d = new Date();
                          d.setHours(h);
                          d.setMinutes(m);
                          d.setSeconds(0);
                          d.setMilliseconds(0);
                          setTempTime(d);
                        } else {
                          setTempTime(new Date()); // Fallback to now
                        }
                      } catch (e) {
                        setTempTime(new Date());
                      }
                      setShowTimeSlotEditor(true);
                    }
                  }}
                >
                  <Feather name="watch" size={10} color={Colors.primary} />
                  <Text style={styles.timeChipTextCompact}>{time}</Text>
                  {isEditing && (
                    <TouchableOpacity
                      onPress={() => {
                        const updated = editedTimeSlots.filter((_, i) => i !== index);
                        setEditedTimeSlots(updated);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Easier to hit
                    >
                      <Feather name="x" size={10} color={Colors.primary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
              {(!isEditing && medication.time_of_day.length === 0) && (
                <Text style={styles.emptyStateText}>No specific times</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Duration / Start Date */}
        <View style={styles.sectionItem}>
          <Text style={styles.detailLabel}>DURATION & START</Text>
          <View style={styles.durationRow}>
            <TouchableOpacity
              style={styles.dateCompactSelector}
              onPress={() => setShowDatePicker(true)}
              disabled={!isEditing && startDate === suggestedStartDate}
            >
              <Feather name="calendar" size={14} color={Colors.textSecondary} />
              <Text style={styles.dateCompactText}>
                Starts {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              {isEditing && <Feather name="edit-2" size={10} color={Colors.primary} />}
            </TouchableOpacity>

            {isEditing ? (
              <TouchableOpacity
                style={styles.durationBadge}
                onPress={() => setShowDurationPicker(true)}
              >
                <Text style={styles.durationTextLink}>{editedDuration} Days</Text>
                <Feather name="chevron-down" size={12} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              medication.duration_days && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{medication.duration_days} Days</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* Notes / Special Instructions (Collapsible) */}
        {(medication.notes || isEditing) && (
          <View style={styles.notesCompactContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsNotesExpanded(!isNotesExpanded)}
              style={styles.notesCompactHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="info" size={14} color={Colors.textSecondary} />
                <Text style={[styles.detailLabel, { marginBottom: 0 }]}>INSTRUCTIONS</Text>
              </View>
              <Feather name={isNotesExpanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.gray400} />
            </TouchableOpacity>

            {isEditing ? (
              <TextInput
                style={styles.notesInput}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="Add special instructions..."
                multiline
              />
            ) : (
              <View>
                <Text
                  style={styles.notesText}
                  numberOfLines={isNotesExpanded ? undefined : 2}
                >
                  {medication.notes}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Duplicate Warning */}
      {
        duplicateOf && (
          <View style={styles.duplicateWarning}>
            <Feather name="alert-triangle" size={16} color={Colors.warning} />
            <Text style={styles.duplicateText}>
              Previously prescribed: {duplicateOf.name}
            </Text>
          </View>
        )
      }

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {isEditing ? (
          <>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetToAI}
              activeOpacity={0.7}
            >
              <Feather name="rotate-ccw" size={16} color={Colors.gray500} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelEdits}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveEdits}
              activeOpacity={0.7}
            >
              <Feather name="check" size={18} color={Colors.white} />
              <Text style={styles.saveButtonText}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
            onPress={handleVerifyAndAdd}
            disabled={isVerifying}
            activeOpacity={0.7}
          >
            {isVerifying ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Feather name="check" size={18} color={Colors.white} />
                <Text style={styles.verifyButtonText}>Verify & Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Re-including modals (DatePicker, FrequencyPicker, etc.) - same logic as before, just kept for context */}
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
      {/* ... Other modals (Frequency, Food, Time) would follow here ... */}

      {/* Frequency Picker Modal */}
      {
        showFrequencyPicker && (
          <Modal
            visible={showFrequencyPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowFrequencyPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.frequencyPickerContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Frequency</Text>
                  <TouchableOpacity onPress={() => setShowFrequencyPicker(false)}>
                    <Feather name="x" size={24} color={Colors.gray600} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.frequencyOptions}>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.frequencyOption,
                        editedFrequency === option.value && styles.frequencyOptionSelected
                      ]}
                      onPress={() => {
                        setEditedFrequency(option.value as any);
                        setShowFrequencyPicker(false);

                        // Auto-adjust time slots based on new frequency
                        const newTimeSlots = generateDefaultTimeSlots(option.value);
                        const maxSlots = getMaxTimeSlotsForFrequency(option.value);

                        if (newTimeSlots.length > 0) {
                          // Use default time slots for the new frequency
                          setEditedTimeSlots(newTimeSlots);
                        } else if (maxSlots !== null && editedTimeSlots.length > maxSlots) {
                          // Trim existing slots to fit new frequency limit
                          setEditedTimeSlots(editedTimeSlots.slice(0, maxSlots));
                        }
                      }}
                    >
                      <View style={styles.frequencyIconBadge}>
                        <Text style={styles.frequencyIconText}>{option.icon}</Text>
                      </View>
                      <Text style={styles.frequencyOptionText}>{option.label}</Text>
                      {editedFrequency === option.value && (
                        <Feather name="check" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )
      }

      {/* Food Relationship Picker Modal */}
      {
        showFoodRelationshipPicker && (
          <Modal
            visible={showFoodRelationshipPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowFoodRelationshipPicker(false)}
          >
            {/* ... existing food picker content ... reuse similarly structured component or update manually if needed */}
            <View style={styles.modalOverlay}>
              <View style={styles.frequencyPickerContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Food Relationship</Text>
                  <TouchableOpacity onPress={() => setShowFoodRelationshipPicker(false)}>
                    <Feather name="x" size={24} color={Colors.gray600} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.frequencyOptions}>
                  {FOOD_RELATIONSHIP_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.frequencyOption,
                        editedFoodRelationship === option.value && styles.frequencyOptionSelected
                      ]}
                      onPress={() => {
                        setEditedFoodRelationship(option.value as any);
                        setShowFoodRelationshipPicker(false);
                      }}
                    >
                      <View style={styles.frequencyIconBadge}>
                        <Text style={styles.frequencyIconText}>{option.icon}</Text>
                      </View>
                      <Text style={styles.frequencyOptionText}>{option.label}</Text>
                      {editedFoodRelationship === option.value && (
                        <Feather name="check" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )
      }

      {/* Duration Picker Modal */}
      {
        showDurationPicker && (
          <Modal
            visible={showDurationPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDurationPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.frequencyPickerContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Duration</Text>
                  <TouchableOpacity onPress={() => setShowDurationPicker(false)}>
                    <Feather name="x" size={24} color={Colors.gray600} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.frequencyOptions}>
                  {DURATION_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.frequencyOption,
                        editedDuration === days && styles.frequencyOptionSelected
                      ]}
                      onPress={() => {
                        setEditedDuration(days);
                        setShowDurationPicker(false);
                      }}
                    >
                      <View style={styles.frequencyIconBadge}>
                        <Feather name="calendar" size={16} color={Colors.gray600} />
                      </View>
                      <Text style={styles.frequencyOptionText}>{days} Days</Text>
                      {editedDuration === days && (
                        <Feather name="check" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )
      }

      {/* Time Slot Editor Modal */}
      {
        showTimeSlotEditor && (
          <Modal
            visible={showTimeSlotEditor}
            transparent
            animationType="slide"
            onRequestClose={() => setShowTimeSlotEditor(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.timePickerContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingTimeIndex !== null ? 'Edit Time' : 'Add Time'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowTimeSlotEditor(false)}>
                    <Feather name="x" size={24} color={Colors.gray600} />
                  </TouchableOpacity>
                </View>

                <View style={{ height: 200, width: '100%', justifyContent: 'center' }}>
                  <DateTimePicker
                    value={tempTime}
                    mode="time"
                    display="spinner"
                    is24Hour={false}
                    locale="en-US"
                    themeVariant="light"
                    textColor="black"
                    minimumDate={new Date(2000, 0, 1)}
                    maximumDate={new Date(2100, 0, 1)}
                    onChange={(event, selectedTime) => {
                      if (selectedTime) {
                        setTempTime(selectedTime);
                      }
                    }}
                    style={{ height: 200, width: '100%' }}
                  />
                </View>

                <View style={styles.timePickerActions}>
                  <TouchableOpacity
                    style={styles.timePickerCancelButton}
                    onPress={() => setShowTimeSlotEditor(false)}
                  >
                    <Text style={styles.timePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timePickerSaveButton}
                    onPress={() => {
                      const hours = tempTime.getHours().toString().padStart(2, '0');
                      const minutes = tempTime.getMinutes().toString().padStart(2, '0');
                      const timeString = `${hours}:${minutes}`;

                      if (editingTimeIndex !== null) {
                        const updated = [...editedTimeSlots];
                        updated[editingTimeIndex] = timeString;
                        setEditedTimeSlots(updated);
                      } else {
                        setEditedTimeSlots([...editedTimeSlots, timeString]);
                      }

                      setShowTimeSlotEditor(false);
                    }}
                  >
                    <Text style={styles.timePickerSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )
      }
    </View >
  );
}

const styles = StyleSheet.create({
  card: {
    // Removed: backgroundColor, borderRadius, shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation, borderWidth, borderColor
    marginBottom: 12, // Reduced from 20
    paddingTop: 12,   // Reduced from 20
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16, // Reduced from 20
    paddingBottom: 10, // Reduced from 12
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF', // Blue-50
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: 8,
    justifyContent: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: 10,
  },
  divider: {
    height: 0, // Hidden - removed divider line after medication name
    backgroundColor: Colors.gray100,
    marginHorizontal: 20,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    alignSelf: 'flex-start', // Important for wrapping
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  medicationName: {
    fontSize: 20, // Slightly reduced from 22 to fit better
    fontWeight: '800',
    color: Colors.gray900,
    fontFamily: 'System',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  scientificName: {
    fontSize: 13,
    color: Colors.gray500,
    fontWeight: '500',
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray900,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
    minWidth: 150,
  },

  // --- Medicine Info Table ---
  medicineInfoTable: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  tableHeaderCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  tableDataRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
  },
  tableDataCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.gray100,
  },
  tableDataText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.gray700,
    textAlign: 'left',
    lineHeight: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  tableLabelCell: {
    minWidth: 105,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 12,
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.gray200,
  },
  tableValueCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },

  // --- Compact Details Grid ---
  detailsGrid: {
    padding: 16, // Reduced from 20
    gap: 16, // Reduced from 20
  },
  vitalsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100, // Darker gray for better visibility
    borderRadius: 16,
    padding: 12, // Reduced from 16
    gap: 12, // Reduced from 16
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vitalItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.gray200,
  },
  vitalIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gray400,
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  vitalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray800,
    textAlign: 'center',
    lineHeight: 16, // Tighter leading for multiline
  },
  vitalValueLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  vitalInput: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray900,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    minWidth: 40,
  },

  // --- Sections ---
  sectionItem: {
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray500,
    letterSpacing: 0.5,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  // --- Time Scroll ---
  timeScrollContainer: {
    gap: 8,
    paddingRight: 20,
  },
  timeChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  timeChipTextCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  emptyStateText: {
    fontSize: 13,
    color: Colors.gray400,
    fontStyle: 'italic',
  },

  // --- Start / Duration ---
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateCompactSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dateCompactText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray700,
  },
  durationBadge: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
  },
  durationTextLink: {
    fontSize: 12,
    fontWeight: '700', // Bolder to indicate interaction
    color: Colors.primary,
    textDecorationLine: 'underline',
  },

  // --- Notes ---
  notesCompactContainer: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderStyle: 'dashed', // Keep dashed reference
    borderRadius: 12,
    overflow: 'hidden',
  },
  notesCompactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.gray50,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.gray700,
    padding: 12,
    paddingTop: 8,
  },
  notesInput: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.gray900,
    padding: 12,
    minHeight: 60,
  },

  // --- Footer ---
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
  actionRow: {
    padding: 20,
    paddingTop: 0,
    flexDirection: 'row',
    gap: 12,
  },
  verifyButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    // Removed shadow properties for flat design
  },
  verifyButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  verifyButtonDisabled: {
    backgroundColor: Colors.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  cancelButtonText: {
    color: Colors.gray600,
    fontWeight: '600',
    fontSize: 15,
  },
  resetButton: {
    width: 44, // Square touch target
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 12, // Slightly rounded square
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.success,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },

  // --- Modals (Keep/Update) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  frequencyPickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
    ...Sizes.shadows.xl,
  },
  timePickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    ...Sizes.shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray900,
  },
  frequencyOptions: {
    marginBottom: 20,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    gap: 16,
  },
  frequencyOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  frequencyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frequencyIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray600,
  },
  frequencyOptionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.gray800,
    fontWeight: '500',
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  timePickerCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 14,
  },
  timePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray600,
  },
  timePickerSaveButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
  },
  timePickerSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },

  // Helpers
  addTimeTinyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  addTimeTinyText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ═══════════════════════════════════════════════════════════════════
  // REMINDER TIME BARS STYLES
  // ═══════════════════════════════════════════════════════════════════

  reminderBarsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reminderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reminderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray500,
    letterSpacing: 0.5,
  },
  intervalBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  intervalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },

  timeBarsWrapper: {
    gap: 10,
  },

  // ══════ DESIGN B: Minimal Flat ══════
  timeBarFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  timeBarFlatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  timeBarLabelFlat: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray600,
  },
  timeBarFlatRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBarTimeFlat: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray900,
  },

  // ══════ MODERN DESIGN: Time | Label | Toggle ══════
  timeBarModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF', // Light blue matching app theme (blue-50)
    borderRadius: 12, // Matches table border radius
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8, // Reduced right padding to align toggle more right
  },
  timeBarTimeLeft: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray900,
    letterSpacing: -0.3,
    minWidth: 75,
  },
  timeBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Tighter spacing between name and toggle
  },
  timeBarDoseLabel: {
    fontSize: 9, // Reduced size
    fontWeight: '700', // More bold
    color: Colors.gray600,
    maxWidth: 90,
  },
  timeBarFoodRelation: {
    fontSize: 9, // Same as medicine name
    fontWeight: '700', // Same as medicine name
    color: Colors.gray600, // Same as medicine name
  },
});
