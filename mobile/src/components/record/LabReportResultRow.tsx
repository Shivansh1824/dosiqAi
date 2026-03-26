import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Sizes, Typography } from '@/constants';
import { TestResult } from '@/hooks/useLabReport';
import { BiomarkerExpandedContent } from './BiomarkerExpandedContent';
import { RefRangeText } from './RefRangeText';

interface LabReportResultRowProps {
  test: TestResult;
  expanded: boolean;
  onToggle: () => void;
  pastTests?: TestResult[];
  type: 'action' | 'optimal';
}

export const LabReportResultRow = ({ test, expanded, onToggle, pastTests, type }: LabReportResultRowProps) => {
  const isAction = type === 'action';
  const isHigh = test.status?.toUpperCase() === 'HIGH';
  const isLow = test.status?.toUpperCase() === 'LOW';

  const statusColor = isAction ? ((isHigh || isLow) ? Colors.error : Colors.warning) : Colors.success;
  const statusLabel = isAction ? (test.status?.toUpperCase() || 'REVIEW') : 'NORMAL';

  const isBiomarker = !!test.biomarker_id;

  return (
    <View style={isAction ? styles.actionItemContainer : styles.optimalRowContainer}>
      <TouchableOpacity
        activeOpacity={isBiomarker ? 0.7 : 1}
        onPress={isBiomarker ? onToggle : undefined}
        style={isAction ? styles.actionItemHeader : styles.optimalRowHeader}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isAction ? 12 : Sizes.sm, flex: 1 }}>
          <View style={isAction ? [styles.statusDot, { backgroundColor: statusColor }] : styles.optimalDot} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={isAction ? styles.actionItemName : styles.optimalTitleText} selectable>{test.test_name}</Text>
              {isBiomarker && (
                process.env.EXPO_OS === 'ios' ? (
                  <Image source={expanded ? 'sf:chevron.up' : 'sf:chevron.down'} style={{ width: 14, height: 14 }} tintColor={Colors.gray400} />
                ) : (
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.gray400} />
                )
              )}
            </View>
            <RefRangeText
              refMin={test.ref_min}
              refMax={test.ref_max}
              unit={test.unit}
              style={isAction ? styles.actionItemRef : styles.optimalRangeText}
            />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', marginRight: isAction ? Sizes.sm : 0 }}>
          <Text style={isAction ? [styles.actionItemValue, { color: statusColor }] : styles.optimalValueText} selectable>{test.value}</Text>
          <Text style={isAction ? [styles.actionItemStatus, { color: statusColor }] : styles.optimalStatusText}>{statusLabel}</Text>
        </View>
      </TouchableOpacity>

      {expanded && isBiomarker && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={isAction ? styles.actionItemExpanded : styles.optimalExpandedContent}
        >
          <BiomarkerExpandedContent test={test} pastTests={pastTests} />
        </Animated.View>
      )}
    </View>
  );
};

export const ResultRowDivider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  // Action item
  actionItemContainer: {
    backgroundColor: Colors.white,
  },
  actionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actionItemName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  actionItemRef: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  actionItemValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.h4,
  },
  actionItemStatus: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    marginTop: -2,
  },
  actionItemExpanded: {
    paddingBottom: Sizes.md,
  },

  // Optimal item
  optimalRowContainer: {
    backgroundColor: Colors.white,
  },
  optimalRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.md,
  },
  optimalExpandedContent: {
    paddingBottom: Sizes.md,
  },
  optimalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  optimalTitleText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  optimalRangeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  optimalValueText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  optimalStatusText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: Colors.success,
    marginTop: -2,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
  },
});
