import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { METRIC_STATUS_COLORS, MetricStatus } from '../../types/medicalReport';

interface StatusBadgeProps {
  status: MetricStatus;
  label?: string;
  size?: 'small' | 'medium';
}

export default function StatusBadge({ status, label, size = 'small' }: StatusBadgeProps) {
  const colors = METRIC_STATUS_COLORS[status];
  const displayLabel = label || (status === 'normal' ? 'NORMAL' : 'ABNORMAL');

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.light },
        size === 'medium' && styles.containerMedium,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      <Text
        style={[
          styles.text,
          { color: colors.dark },
          size === 'medium' && styles.textMedium,
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  containerMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
  textMedium: {
    fontSize: 12,
  },
});
