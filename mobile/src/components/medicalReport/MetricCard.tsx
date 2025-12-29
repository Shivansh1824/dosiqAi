import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Sizes } from '../../constants';
import { MedicalReportMetric, METRIC_STATUS_COLORS } from '../../types/medicalReport';
import StatusBadge from './StatusBadge';

interface MetricCardProps {
  metric: MedicalReportMetric;
}

export default function MetricCard({ metric }: MetricCardProps) {
  const borderColor = metric.is_abnormal
    ? METRIC_STATUS_COLORS.abnormal.primary
    : METRIC_STATUS_COLORS.normal.primary;

  return (
    <View style={[styles.container, { borderLeftColor: borderColor }]}>
      {/* Header: Test Name + Status Badge */}
      <View style={styles.header}>
        <Text style={styles.testName} numberOfLines={1}>
          {metric.test_name}
        </Text>
        {metric.is_abnormal && (
          <StatusBadge status="abnormal" label="ABNORMAL" size="small" />
        )}
      </View>

      {/* Value */}
      <Text style={styles.value}>
        {metric.value} {metric.unit || ''}
      </Text>

      {/* Reference Range */}
      {metric.reference_range && (
        <Text style={styles.reference}>
          Reference: {metric.reference_range}
        </Text>
      )}

      {/* Method (if available) */}
      {metric.method && (
        <Text style={styles.method}>
          Method: {metric.method}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray50,
    borderRadius: Sizes.radiusSm,
    padding: 12,
    borderLeftWidth: 3,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  reference: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  method: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});
