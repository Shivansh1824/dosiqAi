import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { ParsedMedication, VerificationConfidence } from '../types/medicationVerification';
import { getFrequencyText } from '../types/medication';
import { Medication } from '../types/medication';
import DatePickerModal from './DatePickerModal';

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

  // Modal state for frequency and time slots
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showTimeSlotEditor, setShowTimeSlotEditor] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  // Frequency options
  const FREQUENCY_OPTIONS = [
    { value: 'once_daily', label: 'Once Daily', icon: '1×' },
    { value: 'twice_daily', label: 'Twice Daily', icon: '2×' },
    { value: 'three_times_daily', label: '3 Times Daily', icon: '3×' },
    { value: 'four_times_daily', label: '4 Times Daily', icon: '4×' },
    { value: 'every_other_day', label: 'Every Other Day', icon: 'Alt' },
    { value: 'weekly', label: 'Weekly', icon: '1/wk' },
    { value: 'as_needed', label: 'As Needed', icon: 'PRN' },
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

  // Get confidence indicator styling
  const getConfidenceStyles = (confidence: VerificationConfidence) => {
    switch (confidence) {
      case 'high':
        return {
          borderColor: Colors.success,
          badgeColor: Colors.successLight,
          badgeTextColor: Colors.success,
          icon: 'check-circle' as const,
          text: 'AI Confident',
        };
      case 'medium':
        return {
          borderColor: Colors.warning,
          badgeColor: '#FEF3C7', // Light yellow
          badgeTextColor: Colors.warning,
          icon: 'alert-circle' as const,
          text: 'AI Uncertain',
        };
      case 'low':
        return {
          borderColor: Colors.error,
          badgeColor: Colors.errorLight,
          badgeTextColor: Colors.error,
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
      verified_by_user: true, // Mark as user-verified after editing
    });
    setIsEditing(false);
  };

  // Handle cancel edits
  const handleCancelEdits = () => {
    setEditedName(medication.name);
    setEditedDosage(medication.dosage);
    setEditedNotes(medication.notes);
    setIsEditing(false);
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
    <View style={[
      styles.card,
      { borderLeftColor: confidenceStyle.borderColor }
    ]}>
      {/* Confidence Badge */}
      <View style={styles.cardHeader}>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceStyle.badgeColor }]}>
          <Feather name={confidenceStyle.icon} size={14} color={confidenceStyle.badgeTextColor} />
          <Text style={[styles.confidenceText, { color: confidenceStyle.badgeTextColor }]}>
            {confidenceStyle.text}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardHeaderActions}>
          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={16} color={Colors.gray500} />
          </TouchableOpacity>

          {/* Edit Button */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
            activeOpacity={0.7}
          >
            <Feather name={isEditing ? 'x' : 'edit-3'} size={16} color={Colors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Medication Name */}
      <View style={styles.nameRow}>
        <Feather name="package" size={20} color={Colors.primary} />
        {isEditing ? (
          <TextInput
            style={styles.nameInput}
            value={editedName}
            onChangeText={setEditedName}
            placeholder="Medication name"
            autoFocus
          />
        ) : (
          <Text style={styles.medicationName}>
            {medication.name}
          </Text>
        )}
      </View>

      {/* Scientific Name */}
      {medication.scientific_name && (
        <Text style={styles.scientificName}>({medication.scientific_name})</Text>
      )}

      {/* Medication Details Grid */}
      <View style={styles.detailsGrid}>
        {/* Dosage */}
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Dosage</Text>
          {isEditing ? (
            <TextInput
              style={styles.detailInput}
              value={editedDosage}
              onChangeText={setEditedDosage}
              placeholder="e.g., 500mg"
            />
          ) : (
            <View style={styles.detailValueRow}>
              <Feather name="droplet" size={14} color={Colors.gray500} />
              <Text style={styles.detailValue}>{medication.dosage}</Text>
            </View>
          )}
        </View>

        {/* Frequency - Editable */}
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Frequency</Text>
          {isEditing ? (
            <TouchableOpacity
              style={styles.frequencyPickerButton}
              onPress={() => setShowFrequencyPicker(true)}
            >
              <Feather name="clock" size={14} color={Colors.primary} />
              <Text style={styles.frequencyButtonText}>
                {getFrequencyText(editedFrequency)}
              </Text>
              <Feather name="chevron-down" size={16} color={Colors.gray500} />
            </TouchableOpacity>
          ) : (
            <View style={styles.detailValueRow}>
              <Feather name="clock" size={14} color={Colors.gray500} />
              <Text style={styles.detailValue}>{getFrequencyText(medication.frequency)}</Text>
            </View>
          )}
          {medication.original_frequency_code && !isEditing && (
            <Text style={styles.originalCode}>({medication.original_frequency_code})</Text>
          )}
        </View>

        {/* Duration */}
        {medication.duration_days !== null && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Duration</Text>
            <View style={styles.detailValueRow}>
              <Feather name="calendar" size={14} color={Colors.gray500} />
              <Text style={styles.detailValue}>
                {medication.duration_days} {medication.duration_days === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>
        )}

        {/* Time Slots - Editable */}
        {(medication.time_of_day.length > 0 || isEditing) && (
          <View style={styles.detailItem}>
            <View style={styles.timeSlotsHeader}>
              <Text style={styles.detailLabel}>Times</Text>
              {isEditing && (
                <TouchableOpacity
                  style={styles.addTimeButton}
                  onPress={() => {
                    setEditingTimeIndex(null);
                    setShowTimeSlotEditor(true);
                  }}
                >
                  <Feather name="plus" size={14} color={Colors.primary} />
                  <Text style={styles.addTimeText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.timeSlotsContainer}>
              {(isEditing ? editedTimeSlots : medication.time_of_day).map((time, index) => (
                <View key={index} style={styles.timeSlot}>
                  {isEditing ? (
                    <>
                      <TouchableOpacity
                        style={styles.timeSlotEditable}
                        onPress={() => {
                          setEditingTimeIndex(index);
                          const [hours, minutes] = time.split(':');
                          const date = new Date();
                          date.setHours(parseInt(hours), parseInt(minutes));
                          setTempTime(date);
                          setShowTimeSlotEditor(true);
                        }}
                      >
                        <Feather name="clock" size={12} color={Colors.primary} />
                        <Text style={styles.timeSlotTextEditable}>{time}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeTimeButton}
                        onPress={() => {
                          const updated = editedTimeSlots.filter((_, i) => i !== index);
                          setEditedTimeSlots(updated);
                        }}
                      >
                        <Feather name="x" size={12} color={Colors.error} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.timeSlotText}>{time}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Notes */}
      {(medication.notes || isEditing) && (
        <View style={styles.notesSection}>
          <Text style={styles.detailLabel}>Special Instructions</Text>
          {isEditing ? (
            <TextInput
              style={styles.notesInput}
              value={editedNotes}
              onChangeText={setEditedNotes}
              placeholder="Add special instructions..."
              multiline
              numberOfLines={3}
            />
          ) : (
            <Text style={styles.notesText}>{medication.notes}</Text>
          )}
        </View>
      )}

      {/* Start Date - Simple Inline Text */}
      <View style={styles.detailItem}>
        <Text style={styles.detailLabel}>Start Date</Text>
        <TouchableOpacity
          style={styles.dateValueButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateValueText}>
            {new Date(startDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Feather name="edit-2" size={12} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Date Assumption Hint - Simple Text */}
      {startDate !== suggestedStartDate && (
        <Text style={styles.dateHintText}>
          Date modified from suggested: {suggestedStartDate}
        </Text>
      )}

      {/* Duplicate Warning */}
      {duplicateOf && (
        <View style={styles.duplicateWarning}>
          <Feather name="alert-triangle" size={16} color={Colors.warning} />
          <Text style={styles.duplicateText}>
            Similar to existing medication: {duplicateOf.name}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {isEditing ? (
          <>
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
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
            onPress={handleVerifyAndAdd}
            disabled={isVerifying}
            activeOpacity={0.7}
          >
            <Feather name="check-circle" size={18} color={Colors.white} />
            <Text style={styles.verifyButtonText}>
              {isVerifying ? 'Adding...' : 'Verify & Add to Tracker'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Picker Modal */}
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

      {/* Frequency Picker Modal */}
      {showFrequencyPicker && (
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
                      const newTimeSlots = generateDefaultTimeSlots(option.value);
                      if (newTimeSlots.length > 0) {
                        setEditedTimeSlots(newTimeSlots);
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
      )}

      {/* Time Slot Editor Modal */}
      {showTimeSlotEditor && (
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

              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (selectedTime) {
                    setTempTime(selectedTime);
                  }
                }}
              />

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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.md,
    marginBottom: Sizes.md,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.sm,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.sm,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
  },
  deleteButton: {
    padding: Sizes.xs,
  },
  editButton: {
    padding: Sizes.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
    marginBottom: 4,
  },
  medicationName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 4,
  },
  scientificName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 28,
    marginBottom: Sizes.md,
  },
  detailsGrid: {
    gap: Sizes.sm,
    marginTop: Sizes.sm,
  },
  detailItem: {
    gap: Sizes.xs,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailInput: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    paddingHorizontal: Sizes.sm,
    paddingVertical: 8,
  },
  originalCode: {
    fontSize: 11,
    color: Colors.gray400,
    marginLeft: 20,
    marginTop: 2,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.xs,
  },
  timeSlot: {
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: Sizes.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  timeSlotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.xs,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Sizes.xs,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight + '20',
  },
  addTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  timeSlotEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Sizes.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '20',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  timeSlotTextEditable: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  removeTimeButton: {
    padding: 2,
    marginLeft: 4,
  },
  notesSection: {
    marginTop: Sizes.md,
    gap: 6,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    backgroundColor: Colors.gray50,
    padding: Sizes.sm,
    borderRadius: 8,
  },
  notesInput: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textPrimary,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    padding: Sizes.sm,
    borderRadius: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  duplicateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    backgroundColor: '#FEF3C7', // Light yellow
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 8,
    marginTop: Sizes.md,
  },
  duplicateText: {
    flex: 1,
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Sizes.sm,
    marginTop: Sizes.lg,
  },
  verifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    gap: Sizes.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray600,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    gap: Sizes.xs,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  dateSection: {
    marginTop: Sizes.md,
    padding: Sizes.md,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Sizes.sm,
  },
  dateSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  modifiedBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modifiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Sizes.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dateValueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
  },
  dateValueText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  dateHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Sizes.xs,
    fontStyle: 'normal',
  },
  frequencyPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  frequencyPickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Sizes.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Sizes.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  frequencyOptions: {
    padding: Sizes.md,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
    borderRadius: 12,
    marginBottom: Sizes.xs,
    backgroundColor: Colors.gray50,
  },
  frequencyOptionSelected: {
    backgroundColor: Colors.primaryLight + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  frequencyIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.sm,
  },
  frequencyIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  frequencyOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  timePickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Sizes.xl,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: Sizes.sm,
    padding: Sizes.lg,
  },
  timePickerCancelButton: {
    flex: 1,
    padding: Sizes.md,
    borderRadius: 12,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray600,
  },
  timePickerSaveButton: {
    flex: 1,
    padding: Sizes.md,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  timePickerSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
