import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { Medication } from '../types/medication';

interface MedicationListItemProps {
  medication: Medication;
  onPress: (id: string) => void;
}

export default function MedicationListItem({ medication, onPress }: MedicationListItemProps) {
  const isInactive = !medication.is_active;

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const startDateFormatted = formatDate(medication.start_date);
  const endDateFormatted = medication.end_date
    ? formatDate(medication.end_date)
    : 'Ongoing';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isInactive && styles.containerInactive,
      ]}
      onPress={() => onPress(medication.id)}
      activeOpacity={0.7}
    >
      {/* Left: Medicine Icon */}
      <View style={[
        styles.iconContainer,
        { backgroundColor: medication.color + '15' },
        isInactive && styles.iconContainerInactive,
      ]}>
        <Feather
          name="package"
          size={20}
          color={isInactive ? Colors.gray400 : medication.color}
        />
      </View>

      {/* Center: Medicine Info */}
      <View style={styles.infoContainer}>
        <Text style={[
          styles.name,
          isInactive && styles.nameInactive,
        ]}>
          {medication.name}
        </Text>
        <Text style={[
          styles.dosage,
          isInactive && styles.dosageInactive,
        ]}>
          {medication.dosage}
        </Text>

        {/* Start Date */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Start: </Text>
          <Text style={styles.detailValue}>{startDateFormatted}</Text>
        </View>

        {/* End Date */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>End: </Text>
          <Text style={styles.detailValue}>{endDateFormatted}</Text>
        </View>

        {/* Notes - Prescription/Report Name */}
        {(medication.notes || medication.source_document_title) && (
          <View style={styles.notesRow}>
            <Feather name="file-text" size={12} color={Colors.gray400} />
            <Text style={styles.notesText} numberOfLines={1}>
              {medication.notes || `From: ${medication.source_document_title}`}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Sizes.md,
    marginBottom: Sizes.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  containerInactive: {
    backgroundColor: Colors.gray50,
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  iconContainerInactive: {
    backgroundColor: Colors.gray100,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  nameInactive: {
    color: Colors.textSecondary,
  },
  dosage: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dosageInactive: {
    color: Colors.gray400,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  notesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
});
