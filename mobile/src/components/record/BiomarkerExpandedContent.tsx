import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BiomarkerTrendChart } from '@/components';
import { Colors, Sizes } from '@/constants';
import { TestResult } from '@/hooks/useLabReport';
import { CollapsibleText } from '@/components/common/CollapsibleText';
import { DietarySuggestionsBlock } from './DietarySuggestionsBlock';

interface BiomarkerExpandedContentProps {
  test: TestResult;
  pastTests?: TestResult[];
}

export const BiomarkerExpandedContent = ({ test, pastTests }: BiomarkerExpandedContentProps) => {
  return (
    <>
      {test.biomarker?.test_results && (
        <View style={styles.biomarkerInfoContainer}>
          <CollapsibleText text={test.biomarker.test_results} style={styles.biomarkerDescription} />
        </View>
      )}

      <Text style={styles.expandSectionTitle} numberOfLines={1} ellipsizeMode="tail">
        {test.test_name} Trend:
      </Text>
      <View style={{ marginHorizontal: -Sizes.md }}>
        <BiomarkerTrendChart currentTest={test} pastTests={pastTests || []} />
      </View>

      <Text style={styles.expandSectionTitle} numberOfLines={1} ellipsizeMode="tail">
        Past {test.test_name} results:
      </Text>
      <View style={styles.pastValuesList}>
        {[test, ...(pastTests || [])]
          .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
          .slice(0, 6)
          .map((past) => {
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
  expandSectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: Colors.gray400,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Sizes.md,
    marginBottom: Sizes.xs,
  },
  pastValuesList: {
    gap: Sizes.xs,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Sizes.radiusMd,
    borderCurve: 'continuous',
    padding: Sizes.md,
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
