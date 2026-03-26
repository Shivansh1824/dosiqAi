import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
  hintAnimation?: boolean;
}

export const LabReportResultRow = ({ test, expanded, onToggle, pastTests, type, hintAnimation }: LabReportResultRowProps) => {
  const isAction = type === 'action';
  const isHigh = test.status?.toUpperCase() === 'HIGH';
  const isLow = test.status?.toUpperCase() === 'LOW';

  const statusColor = isAction ? ((isHigh || isLow) ? Colors.error : Colors.warning) : Colors.success;
  const statusLabel = isAction ? (test.status?.toUpperCase() || 'REVIEW') : 'NORMAL';

  const isBiomarker = !!test.biomarker_id;

  const expandProgress = useSharedValue(expanded ? 1 : 0);
  const hintProgress = useSharedValue(0);
  const chipScale = useSharedValue(1);

  useEffect(() => {
    expandProgress.value = withTiming(expanded ? 1 : 0, { duration: 250 });
  }, [expanded]);

  useEffect(() => {
    if (hintAnimation && isBiomarker) {
      // Chevron briefly rotates down then back, hinting it can expand
      hintProgress.value = withDelay(700,
        withSequence(
          withTiming(1, { duration: 220 }),
          withTiming(0, { duration: 220 }),
        )
      );
      // Chip pulses slightly after chevron hint
      chipScale.value = withDelay(1000,
        withSequence(
          withTiming(1.1, { duration: 160 }),
          withTiming(1, { duration: 160 }),
        )
      );
    }
  }, []);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandProgress.value * 180 + hintProgress.value * 35}deg` }],
  }));

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chipScale.value }],
  }));

  const handleToggle = () => {
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    onToggle();
  };

  return (
    <View style={isAction ? styles.actionItemContainer : styles.optimalRowContainer}>
      <TouchableOpacity
        activeOpacity={isBiomarker ? 0.7 : 1}
        onPress={isBiomarker ? handleToggle : undefined}
        style={isAction ? styles.actionItemHeader : styles.optimalRowHeader}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isAction ? 12 : Sizes.sm, flex: 1 }}>
          <View style={isAction ? [styles.statusDot, { backgroundColor: statusColor }] : styles.optimalDot} />
          <View style={{ flex: 1 }}>
            <Text style={isAction ? styles.actionItemName : styles.optimalTitleText} selectable>{test.test_name}</Text>
            <RefRangeText
              refMin={test.ref_min}
              refMax={test.ref_max}
              unit={test.unit}
              style={isAction ? styles.actionItemRef : styles.optimalRangeText}
            />
            {isBiomarker && !expanded && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.detailsChip, chipStyle]}>
                {process.env.EXPO_OS === 'ios' ? (
                  <Image source="sf:chart.xyaxis.line" style={{ width: 11, height: 11 }} tintColor={Colors.primary} />
                ) : (
                  <Feather name="trending-up" size={11} color={Colors.primary} />
                )}
                <Text style={styles.detailsChipText}>Trend & Details</Text>
              </Animated.View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Sizes.sm }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={isAction ? [styles.actionItemValue, { color: statusColor }] : styles.optimalValueText} selectable>{test.value}</Text>
            <Text style={isAction ? [styles.actionItemStatus, { color: statusColor }] : styles.optimalStatusText}>{statusLabel}</Text>
          </View>
          {isBiomarker && (
            <Animated.View style={chevronStyle}>
              {process.env.EXPO_OS === 'ios' ? (
                <Image source="sf:chevron.down" style={{ width: 16, height: 16 }} tintColor={Colors.primary} />
              ) : (
                <Feather name="chevron-down" size={16} color={Colors.primary} />
              )}
            </Animated.View>
          )}
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
  detailsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  detailsChipText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
});
