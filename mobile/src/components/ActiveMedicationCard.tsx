import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { Medication, getFrequencyText } from '../types/medication';

interface ActiveMedicationCardProps {
  medication: Medication;
}

export default function ActiveMedicationCard({ medication }: ActiveMedicationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useSharedValue(0);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format times for display
  const formatTimes = (times: string[]): string => {
    if (!times || times.length === 0) return 'Not specified';
    return times.join(', ');
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    animatedHeight.value = withTiming(isExpanded ? 0 : 1, { duration: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animatedHeight.value,
      maxHeight: animatedHeight.value * 500, // max height when expanded
    };
  });

  return (
    <View style={styles.container}>
      {/* Collapsed View - Always Visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        {/* Left: Medicine Icon */}
        <View style={[styles.iconContainer, { backgroundColor: medication.color + '15' }]}>
          <Feather
            name="package"
            size={24}
            color={medication.color}
          />
        </View>

        {/* Center: Medicine Info */}
        <View style={styles.headerInfo}>
          {/* Active Badge */}
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>

          <Text style={styles.name}>{medication.name}</Text>
          <Text style={styles.dosage}>{medication.dosage}</Text>

          <View style={styles.frequencyRow}>
            <Text style={styles.frequencyText}>
              {getFrequencyText(medication.frequency)}
            </Text>
            {medication.time_of_day.length > 0 && (
              <>
                <Text style={styles.bullet}> • </Text>
                <Text style={styles.timesText}>
                  {medication.time_of_day.slice(0, 2).join(', ')}
                  {medication.time_of_day.length > 2 && '...'}
                </Text>
              </>
            )}
          </View>

          {/* Document Provenance */}
          {medication.source_document_title && (
            <View style={styles.sourceChip}>
              <Feather name="file-text" size={12} color={Colors.success} />
              <Text style={styles.sourceText} numberOfLines={1}>
                Verified from {medication.source_document_title}
              </Text>
            </View>
          )}
        </View>

        {/* Right: Expand Icon */}
        <Feather
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={Colors.gray400}
          style={styles.expandIcon}
        />
      </TouchableOpacity>

      {/* Expanded View - Details */}
      {isExpanded && (
        <Animated.View style={[styles.expandedContent, animatedStyle]}>
          {/* Start Date */}
          <View style={styles.detailRow}>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Start Date</Text>
              <Text style={styles.readOnlyValue}>
                {formatDate(medication.start_date)}
              </Text>
            </View>
          </View>

          {/* End Date */}
          <View style={styles.detailRow}>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>End Date</Text>
              <Text style={styles.readOnlyValue}>
                {medication.end_date ? formatDate(medication.end_date) : 'Ongoing'}
              </Text>
            </View>
          </View>

          {/* Times */}
          <View style={styles.detailRow}>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Times</Text>
              <Text style={styles.readOnlyValue}>
                {formatTimes(medication.time_of_day)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {medication.notes && (
            <View style={styles.detailRow}>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Notes</Text>
                <Text style={styles.readOnlyValue}>
                  {medication.notes}
                </Text>
              </View>
            </View>
          )}

          {/* Scientific Name */}
          {medication.scientific_name && (
            <View style={styles.detailRow}>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Scientific Name</Text>
                <Text style={styles.readOnlyValue}>
                  {medication.scientific_name}
                </Text>
              </View>
            </View>
          )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  headerInfo: {
    flex: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.success + '15',
    borderWidth: 1,
    borderColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  dosage: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  frequencyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  bullet: {
    fontSize: 13,
    color: Colors.gray300,
  },
  timesText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.success + '10',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  sourceText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
  },
  expandIcon: {
    marginLeft: Sizes.xs,
  },
  expandedContent: {
    paddingHorizontal: Sizes.md,
    paddingBottom: Sizes.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  detailRow: {
    marginBottom: Sizes.sm,
    marginTop: Sizes.sm,
  },
  readOnlyField: {
    backgroundColor: Colors.gray100,
    borderRadius: 8,
    padding: Sizes.md,
  },
  readOnlyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
});
