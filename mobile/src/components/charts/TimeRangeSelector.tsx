/**
 * TimeRangeSelector Component
 * Tab bar for selecting time ranges (1M, 3M, 6M, 1Y, All)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { TIME_RANGES, TimeRangeOption } from '@/types/labReport';

interface TimeRangeSelectorProps {
  selectedRange: TimeRangeOption;
  onRangeChange: (range: TimeRangeOption) => void;
  disabled?: boolean;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Time Range:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TIME_RANGES.map((range) => {
          const isSelected = selectedRange === range.value;
          return (
            <TouchableOpacity
              key={range.value}
              style={[
                styles.rangeButton,
                isSelected && styles.rangeButtonActive,
                disabled && styles.rangeButtonDisabled,
              ]}
              onPress={() => !disabled && onRangeChange(range.value)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.rangeButtonText,
                  isSelected && styles.rangeButtonTextActive,
                  disabled && styles.rangeButtonTextDisabled,
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  rangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    borderWidth: 1,
    borderColor: Colors.gray300,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rangeButtonDisabled: {
    opacity: 0.5,
  },
  rangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  rangeButtonTextActive: {
    color: Colors.white,
  },
  rangeButtonTextDisabled: {
    color: Colors.gray400,
  },
});
