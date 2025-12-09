import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { ParsedMedication, VerificationConfidence } from '../types/medicationVerification';
import { getFrequencyText } from '../types/medication';
import { Medication } from '../types/medication';

interface MedicationVerificationCardProps {
  medication: ParsedMedication;
  documentId: string;
  documentTitle: string;
  onVerifyAndAdd: (medication: ParsedMedication) => Promise<void>;
  duplicateOf?: Medication;
}

export default function MedicationVerificationCard({
  medication: initialMedication,
  documentId,
  documentTitle,
  onVerifyAndAdd,
  duplicateOf,
}: MedicationVerificationCardProps) {
  const [medication, setMedication] = useState<ParsedMedication>(initialMedication);
  const [isEditing, setIsEditing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Editable fields state
  const [editedName, setEditedName] = useState(medication.name);
  const [editedDosage, setEditedDosage] = useState(medication.dosage);
  const [editedNotes, setEditedNotes] = useState(medication.notes);

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
      await onVerifyAndAdd(finalMedication);
    } catch (error) {
      console.error('[MedicationVerificationCard] Error adding medication:', error);
      Alert.alert('Error', 'Failed to add medication. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: confidenceStyle.borderColor }]}>
      {/* Confidence Badge */}
      <View style={styles.cardHeader}>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceStyle.badgeColor }]}>
          <Feather name={confidenceStyle.icon} size={14} color={confidenceStyle.badgeTextColor} />
          <Text style={[styles.confidenceText, { color: confidenceStyle.badgeTextColor }]}>
            {confidenceStyle.text}
          </Text>
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditing(!isEditing)}
          activeOpacity={0.7}
        >
          <Feather name={isEditing ? 'x' : 'edit-3'} size={16} color={Colors.gray500} />
        </TouchableOpacity>
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
          <Text style={styles.medicationName}>{medication.name}</Text>
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

        {/* Frequency */}
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Frequency</Text>
          <View style={styles.detailValueRow}>
            <Feather name="clock" size={14} color={Colors.gray500} />
            <Text style={styles.detailValue}>{getFrequencyText(medication.frequency)}</Text>
          </View>
          {medication.original_frequency_code && (
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

        {/* Time Slots */}
        {medication.time_of_day.length > 0 && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Times</Text>
            <View style={styles.timeSlotsContainer}>
              {medication.time_of_day.map((time, index) => (
                <View key={index} style={styles.timeSlot}>
                  <Text style={styles.timeSlotText}>{time}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.lg,
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
    gap: Sizes.md,
    marginTop: Sizes.md,
  },
  detailItem: {
    gap: 6,
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
});
