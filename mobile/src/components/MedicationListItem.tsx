import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { Medication } from '../types/medication';
import { MedicationIcon } from './medication/MedicationIcons';

const ACCENT = '#1B4332';

interface MedicationListItemProps {
  medication: Medication;
  onPress: (id: string) => void;
}

export default function MedicationListItem({ medication, onPress }: MedicationListItemProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = medication.end_date ? new Date(medication.end_date) : null;
  if (endDate) endDate.setHours(0, 0, 0, 0);

  const isInactive = endDate ? endDate < today : false;

  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const startDateFormatted = formatDateShort(medication.start_date);
  const endDateFormatted = medication.end_date
    ? formatDateShort(medication.end_date)
    : 'Ongoing';

  return (
    <TouchableOpacity
      style={[styles.container, isInactive && styles.containerInactive]}
      onPress={() => onPress(medication.id)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconWrapper, isInactive && styles.iconWrapperInactive]}>
        <MedicationIcon form={medication.form || 'default'} size={18} />
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        {/* Name + dosage on one line */}
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, isInactive && styles.nameInactive]}
            numberOfLines={1}
          >
            {medication.name}
          </Text>
          {medication.dosage ? (
            <Text style={styles.dosage} numberOfLines={1}>
              {' · '}{medication.dosage}
            </Text>
          ) : null}
        </View>

        {/* Date range */}
        <View style={styles.dateRow}>
          <Feather name="calendar" size={11} color={Colors.textTertiary} style={{ marginRight: 4 }} />
          <Text style={styles.dateText}>
            {startDateFormatted}
            {medication.end_date && ` → ${endDateFormatted}`}
            {!medication.end_date && ' · Ongoing'}
          </Text>
        </View>

        {/* Source doc */}
        {(medication.notes || medication.source_document_title) && (
          <View style={styles.sourceRow}>
            <Feather name="file-text" size={10} color={Colors.textTertiary} style={{ marginRight: 4 }} />
            <Text style={styles.sourceText} numberOfLines={1}>
              {medication.notes || medication.source_document_title}
            </Text>
          </View>
        )}
      </View>

      {/* Right: status chip + chevron */}
      <View style={styles.rightCol}>
        {isInactive ? (
          <View style={styles.pastChip}>
            <Text style={styles.pastChipText}>PAST</Text>
          </View>
        ) : (
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>ACTIVE</Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color={Colors.gray300} style={{ marginTop: 6 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: Sizes.md,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#E8E8E0',
  },
  containerInactive: {
    backgroundColor: Colors.gray50,
    borderColor: '#EBEBEB',
  },
  iconWrapper: {
    marginRight: 12,
  },
  iconWrapperInactive: {
    opacity: 0.4,
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  nameInactive: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dosage: {
    fontSize: 13,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sourceText: {
    fontSize: 11,
    color: Colors.textTertiary,
    flex: 1,
  },
  rightCol: {
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  pastChip: {
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pastChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.gray400,
    letterSpacing: 0.8,
  },
  activeChip: {
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  activeChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 0.8,
  },
});
