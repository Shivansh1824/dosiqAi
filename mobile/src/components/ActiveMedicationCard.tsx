import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { Medication, getFrequencyText } from '../types/medication';
import { MedicationIcon } from './medication/MedicationIcons';

const ACCENT = '#1B4332';

interface ActiveMedicationCardProps {
  medication: Medication;
}

export default function ActiveMedicationCard({ medication }: ActiveMedicationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useSharedValue(0);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimes = (times: string[]): string => {
    if (!times || times.length === 0) return 'Not specified';
    return times.join(', ');
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    animatedHeight.value = withTiming(isExpanded ? 0 : 1, { duration: 280 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: animatedHeight.value,
    maxHeight: animatedHeight.value * 400,
    overflow: 'hidden',
  }));

  const endDisplay = medication.end_date
    ? formatDateShort(medication.end_date)
    : 'Ongoing';

  return (
    <View style={styles.container}>
      {/* Active left accent bar */}
      <View style={styles.accentBar} />

      {/* Collapsed header — always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={styles.iconWrapper}>
          <MedicationIcon form={medication.form || 'default'} size={22} />
        </View>

        {/* Center info */}
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>{medication.name}</Text>
          <Text style={styles.dosage} numberOfLines={1}>{medication.dosage}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{getFrequencyText(medication.frequency)}</Text>
            {medication.time_of_day.length > 0 && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.metaText}>
                  {medication.time_of_day.slice(0, 2).join(', ')}
                  {medication.time_of_day.length > 2 && ` +${medication.time_of_day.length - 2}`}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Right: active badge + chevron */}
        <View style={styles.rightCol}>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
          <Feather
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.gray400}
            style={{ marginTop: 6 }}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded detail 2-column grid */}
      {isExpanded && (
        <Animated.View style={[styles.expandedContent, animatedStyle]}>
          <View style={styles.divider} />
          <View style={styles.detailGrid}>
            {/* Row 1: Start | End */}
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>START</Text>
              <Text style={styles.detailValue}>{formatDate(medication.start_date)}</Text>
            </View>
            <View style={[styles.detailCell, styles.detailCellRight]}>
              <Text style={styles.detailLabel}>END</Text>
              <Text style={styles.detailValue}>{endDisplay}</Text>
            </View>

            {/* Row 2: Times | Source */}
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>TIMES</Text>
              <Text style={styles.detailValue}>{formatTimes(medication.time_of_day)}</Text>
            </View>
            {medication.source_document_title && (
              <View style={[styles.detailCell, styles.detailCellRight]}>
                <Text style={styles.detailLabel}>FROM</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {medication.source_document_title}
                </Text>
              </View>
            )}

            {/* Row 3: Notes (full width if present) */}
            {medication.notes && (
              <View style={[styles.detailCell, styles.detailCellFull]}>
                <Text style={styles.detailLabel}>NOTES</Text>
                <Text style={styles.detailValue}>{medication.notes}</Text>
              </View>
            )}

            {/* Row 4: Generic name (full width if present) */}
            {medication.generic_name && (
              <View style={[styles.detailCell, styles.detailCellFull]}>
                <Text style={styles.detailLabel}>GENERIC NAME</Text>
                <Text style={styles.detailValue}>{medication.generic_name}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: Sizes.md,
    borderWidth: 0.5,
    borderColor: '#E8E8E0',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: ACCENT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
    paddingLeft: Sizes.md + 3, // offset for accent bar
  },
  iconWrapper: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  dosage: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.gray300,
    marginHorizontal: 6,
  },
  rightCol: {
    alignItems: 'center',
    marginLeft: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT,
    marginRight: 5,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginHorizontal: Sizes.md,
  },
  expandedContent: {
    paddingBottom: Sizes.md,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Sizes.md,
    paddingTop: Sizes.md,
    gap: 12,
  },
  detailCell: {
    flex: 1,
    minWidth: '40%',
  },
  detailCellRight: {
    alignItems: 'flex-end',
  },
  detailCellFull: {
    flexBasis: '100%',
    flex: undefined,
    minWidth: '100%',
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
});
