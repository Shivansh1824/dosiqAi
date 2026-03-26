import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Colors, Sizes, Typography } from '@/constants';
import { TestResult } from '@/hooks/useLabReport';
import { LabReportResultRow, ResultRowDivider } from './LabReportResultRow';

interface LabReportActionSectionProps {
  tests: TestResult[];
  expandedCards: Set<string>;
  onToggleExpand: (id: string) => void;
  pastValues: Record<string, TestResult[]>;
}

export const LabReportActionSection = ({ tests, expandedCards, onToggleExpand, pastValues }: LabReportActionSectionProps) => {
  return (
    <Animated.View layout={LinearTransition.duration(300)} style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>ACTION REQUIRED</Text>
        <View style={styles.highPriorityBadge}>
          <Text style={styles.highPriorityText}>{tests.length} Priority</Text>
        </View>
      </View>

      <View style={styles.actionRequiredCard}>
        {tests.map((test, index) => (
          <View key={test.id}>
            <LabReportResultRow
              test={test}
              expanded={expandedCards.has(test.id)}
              onToggle={() => onToggleExpand(test.id)}
              pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []}
              type="action"
            />
            {index < tests.length - 1 && <ResultRowDivider />}
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    gap: Sizes.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.small,
    color: Colors.gray400,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  highPriorityBadge: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizes.radiusSm,
    borderCurve: 'continuous',
  },
  highPriorityText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.tiny,
    color: Colors.error,
  },
  actionRequiredCard: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusLg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Sizes.md,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
});
