import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { BiomarkerTrendChart } from '@/components';
import { Colors, Sizes } from '@/constants';
import { TestResult } from '@/hooks/useLabReport';
import { CollapsibleText } from '@/components/common/CollapsibleText';
import { DietarySuggestionsBlock } from './DietarySuggestionsBlock';
import { formatReferenceRange } from '@/utils/stringUtils';

interface BiomarkerExpandedContentProps {
  test: TestResult;
  pastTests?: TestResult[];
}

export const BiomarkerExpandedContent = ({ test, pastTests }: BiomarkerExpandedContentProps) => {
  const displayResults = React.useMemo(() => {
    return [test, ...(pastTests || [])]
      .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
      .slice(0, 6);
  }, [test, pastTests]);

  return (
    <>
      {test.biomarker?.test_results && (
        <View style={styles.biomarkerInfoContainer}>
          <CollapsibleText text={test.biomarker.test_results} style={styles.biomarkerDescription} />
        </View>
      )}

      <View style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            {process.env.EXPO_OS === 'ios' ? (
              <Image source="sf:chart.line.uptrend.xyaxis" style={{ width: 14, height: 14 }} tintColor={Colors.primary} />
            ) : (
              <Feather name="activity" size={14} color={Colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{test.test_name} History</Text>
            <Text style={styles.cardSubtitle}>Tracking your trends over time</Text>
          </View>
        </View>

        {test.biomarker && (test.ref_min != null || test.ref_max != null) && (
          <View style={styles.normalRangeTextContainer}>
            <Text style={styles.normalRangeText}>
              The green section indicates the normal range ({formatReferenceRange(test.ref_min, test.ref_max, test.unit)})
            </Text>
          </View>
        )}

        <BiomarkerTrendChart currentTest={test} pastTests={pastTests || []} />

        <View style={styles.pastValuesList}>
          {displayResults.map((past) => {
            const isCurrent = past.id === test.id;
            return (
              <View
                key={past.id}
                style={[styles.pastValueItem, isCurrent && styles.currentPastValueItem]}
              >
                <View style={styles.pastValueLeft}>
                  {isCurrent && <View style={styles.currentIndicator} />}
                  <Text style={[styles.pastValueDate, isCurrent && styles.currentPastValueText]} selectable>
                    {new Date(past.report_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                  </Text>
                </View>
                <Text style={[styles.pastValueText, isCurrent && styles.currentPastValueText]} selectable>
                  {past.value} {past.unit}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <DietarySuggestionsBlock
        biomarker={test.biomarker}
        testName={test.test_name}
        isOptimal={test.status?.toUpperCase() === 'NORMAL' || !test.status}
      />
    </>
  );
};

const styles = StyleSheet.create({
  biomarkerInfoContainer: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Sizes.radiusMd,
    borderCurve: 'continuous',
    padding: Sizes.md,
  },
  biomarkerDescription: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  historyCard: {
    marginTop: Sizes.md,
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusMd,
    borderCurve: 'continuous',
    padding: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Sizes.sm,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  pastValuesList: {
    gap: Sizes.xs,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Sizes.radiusMd,
    borderCurve: 'continuous',
    padding: Sizes.md,
    marginTop: Sizes.sm / 2,
  },
  normalRangeTextContainer: {
    marginTop: Sizes.xs,
    marginBottom: Sizes.xs,
  },
  normalRangeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'left',
  },
  pastValueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  pastValueDate: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  pastValueText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  currentPastValueItem: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusSm,
    borderCurve: 'continuous',
    paddingHorizontal: Sizes.md,
    paddingVertical: 2,
    marginHorizontal: -Sizes.md,
  },
  pastValueLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentIndicator: {
    width: 3,
    height: 14,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    position: 'absolute',
    left: -12,
  },
  currentPastValueText: {
    color: Colors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
});
