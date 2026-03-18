import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';

import { useLabReport, TestResult } from '../../src/hooks/useLabReport';
import { Colors, Sizes, Typography } from '../../src/constants';
import { StatusBar } from 'expo-status-bar';

export default function LabReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const documentId = params.id as string;
  const insets = useSafeAreaInsets();

  const { document, reportData, pastValues, isLoading, error } = useLabReport(documentId);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const handleBack = () => router.back();

  const toggleExpand = (testId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  // Filter functionality
  const filteredActionRequired = reportData.actionRequired.filter(t => 
    t.test_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredOptimalResults = reportData.optimalResults.filter(t => 
    t.test_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const HeaderLeft = () => (
    <TouchableOpacity 
      onPress={handleBack} 
      activeOpacity={0.7}
      style={styles.backButtonContainer}
    >
      <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerTransparent: true, headerTitle: '', headerLeft: () => <HeaderLeft /> }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Lab Report...</Text>
      </View>
    );
  }

  if (error || (!document && !isLoading)) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerTitle: 'Error', headerLeft: () => <HeaderLeft /> }} />
        <Feather name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error || 'Failed to load report'}</Text>
      </View>
    );
  }

  const patientName = document?.patient_name || 'Patient Report';
  const reportDate = document?.ai_analysis_result?.visit_date 
    ? new Date(document.ai_analysis_result.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : document?.ai_analyzed_at ? new Date(document.ai_analyzed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';

  const HeaderTitle = () => (
    <View style={{ gap: 2, alignItems: 'center' }}>
      <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: 'PlusJakartaSans-Bold', color: Colors.textPrimary }}>
        {patientName}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'PlusJakartaSans-Medium', color: Colors.textSecondary }}>
        {reportDate}
      </Text>
    </View>
  );

  const isAnalyzing = document?.ai_analysis_status === 'processing' || document?.ai_analysis_status === 'pending';
  const isEmpty = reportData.actionRequired.length === 0 && reportData.optimalResults.length === 0;

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitle: () => <HeaderTitle />,
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderLeft />
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Platform.OS === 'android' ? insets.top + Sizes.xl : Sizes.xxxl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View layout={LinearTransition.duration(300)} style={styles.headerSection}>
          {reportData.actionRequired.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: Sizes.sm }}>
              <View style={styles.attentionBadge}>
                <View style={styles.attentionBadgeDot} />
                <Text style={styles.attentionBadgeText}>{reportData.actionRequired.length} items need attention</Text>
              </View>
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color={Colors.gray400} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search specific tests (e.g. Glucose)"
              placeholderTextColor={Colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <Feather name="x-circle" size={16} color={Colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {isAnalyzing ? (
          <View style={styles.emptyStateContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.emptyStateTitle}>Analyzing Report</Text>
            <Text style={styles.emptyStateDesc}>Please wait while dosiq Ai extracts test results from this document.</Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyStateContainer}>
            <Feather name="file-minus" size={48} color={Colors.gray400} />
            <Text style={styles.emptyStateTitle}>No Test Results</Text>
            <Text style={styles.emptyStateDesc}>We couldn't detect any structured lab test results in this report.</Text>
          </View>
        ) : (
          <>
            {/* Action Required Section */}
        {filteredActionRequired.length > 0 && (
          <Animated.View layout={LinearTransition.duration(300)} style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ACTION REQUIRED</Text>
              <View style={styles.highPriorityBadge}>
                <Text style={styles.highPriorityText}>High Priority</Text>
              </View>
            </View>
            
            <View style={{ gap: Sizes.md }}>
              {filteredActionRequired.map((test, index) => (
                <BiomarkerCard 
                  key={test.id} 
                  test={test} 
                  expanded={expandedCards.has(test.id)}
                  onToggle={() => toggleExpand(test.id)}
                  pastValues={test.biomarker_id ? pastValues[test.biomarker_id] : []}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Optimal Results Section */}
        {filteredOptimalResults.length > 0 && (
          <Animated.View layout={LinearTransition.duration(300)} style={[styles.sectionContainer, { marginTop: Sizes.xl }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OPTIMAL RESULTS</Text>
              <View style={styles.optimalBadge}>
                <Text style={styles.optimalBadgeText}>{reportData.optimalResults.length} Items</Text>
              </View>
            </View>
            
            <View style={styles.optimalResultsCard}>
              {filteredOptimalResults.map((test, index) => (
                <View key={test.id}>
                  <OptimalResultRow test={test} />
                  {index < filteredOptimalResults.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </Animated.View>
        )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Subcomponents

const RangeVisualization = ({ test }: { test: TestResult }) => {
  const min = test.ref_min ?? 0;
  const max = test.ref_max ?? 100;
  const val = parseFloat(test.value || '0');
  
  // Calculate bounds for visualization
  const rangeSpan = Math.abs(max - min);
  const visualMin = Math.max(0, min - (rangeSpan * 0.5));
  const visualMax = max + (rangeSpan * 0.5);
  const visualSpan = visualMax - visualMin;
  
  // Percentages for the layout
  const normalStartPct = Math.max(0, ((min - visualMin) / visualSpan) * 100);
  const normalWidthPct = Math.min(100 - normalStartPct, ((max - min) / visualSpan) * 100);
  
  const isHigh = val > max;
  const isLow = val < min;
  
  // Pin val to 0-100%
  let markerPct = ((val - visualMin) / visualSpan) * 100;
  if (markerPct < 0) markerPct = 0;
  if (markerPct > 100) markerPct = 100;

  let highlightColor: string = Colors.success;
  let highlightBgColor: string = Colors.successLight;
  if (isHigh) {
    highlightColor = Colors.error;
    highlightBgColor = Colors.errorLight;
  } else if (isLow) {
    highlightColor = Colors.warning;
    highlightBgColor = Colors.warningLight;
  }

  return (
    <View style={{ marginVertical: Sizes.sm }}>
      <View style={styles.rangeBarTrack}>
        <View style={[styles.rangeSegment, { left: 0, width: `${normalStartPct}%`, backgroundColor: isLow ? Colors.warning : Colors.gray300 }]} />
        <View style={[styles.rangeSegment, { left: `${normalStartPct}%`, width: `${normalWidthPct}%`, backgroundColor: Colors.success }]} />
        <View style={[styles.rangeSegment, { left: `${normalStartPct + normalWidthPct}%`, width: `${100 - (normalStartPct + normalWidthPct)}%`, backgroundColor: isHigh ? Colors.error : Colors.gray300 }]} />
        
        {/* Marker */}
        <View style={[styles.rangeMarker, { left: `${markerPct}%` }]} />
      </View>
      
      <View style={styles.rangeLabelsContainer}>
        <Text style={styles.rangeLabelText}>{Math.round(visualMin)}</Text>
        <Text style={styles.rangeNormalLabelText}>Normal ( {min} - {max} )</Text>
        <Text style={styles.rangeLabelText}>{Math.round(visualMax)}+</Text>
      </View>
    </View>
  );
};

const BiomarkerCard = ({ test, expanded, onToggle, pastValues }: { test: TestResult, expanded: boolean, onToggle: () => void, pastValues?: TestResult[] }) => {
  const isHigh = test.status?.toUpperCase() === 'HIGH';
  const isLow = test.status?.toUpperCase() === 'LOW';
  
  const bgColor = isHigh ? Colors.errorLight : (isLow ? Colors.warningLight : Colors.gray50);
  const borderColor = isHigh ? Colors.errorLight : (isLow ? Colors.warningLight : Colors.gray100);
  const iconColor = isHigh ? Colors.error : (isLow ? Colors.warning : Colors.gray500);
  const textColor = isHigh ? Colors.errorDark : (isLow ? Colors.warningDark : Colors.textPrimary);
  const message = isHigh ? "Elevated risk levels detected" : (isLow ? "Insufficient levels detected" : "Levels need review");
  // Simple insight generation based on status
  let description = "Your levels are outside the optimal range. Please consult your physician.";
  if (isHigh) {
    description = `Your ${test.test_name} level is higher than the recommended range of ${test.ref_max}. High levels may be linked to specific health risks.`;
  } else if (isLow) {
    description = `Your ${test.test_name} level is lower than the recommended range of ${test.ref_min}. Low levels can impact overall well-being.`;
  }

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={[styles.biomarkerCard, { backgroundColor: bgColor, borderColor }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={onToggle} style={{ padding: Sizes.md }}>
        <View style={styles.biomarkerHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Sizes.xs }}>
              <Text style={styles.biomarkerTitleText}>{test.test_name}</Text>
              <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.gray400} />
            </View>
            <Text style={[styles.biomarkerSubtitleText, { color: iconColor }]}>{message}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.biomarkerValueText}>{test.value}</Text>
              {test.unit && <Text style={styles.biomarkerUnitText}>{test.unit}</Text>}
            </View>
          </View>
        </View>

        <RangeVisualization test={test} />

        {expanded && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <View style={[styles.insightBox, { borderColor: borderColor }]}>
              <Text style={styles.insightText}>{description}</Text>
            </View>
            
            {pastValues && pastValues.length > 0 && (
              <View style={[styles.pastValuesContainer, { borderTopColor: borderColor }]}>
                <Text style={styles.pastValuesTitle}>PAST VALUES</Text>
                <View style={{ gap: Sizes.sm }}>
                  {pastValues.slice(0, 3).map((pastTest) => (
                    <View key={pastTest.id} style={styles.pastValueRow}>
                      <Text style={styles.pastValueDateText}>
                        {new Date(pastTest.report_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric'})}
                      </Text>
                      <Text style={styles.pastValueNumText}>
                        {pastTest.value} {pastTest.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const OptimalResultRow = ({ test }: { test: TestResult }) => {
  return (
    <View style={styles.optimalRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Sizes.sm }}>
        <View style={styles.optimalDot} />
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.optimalTitleText}>{test.test_name}</Text>
          </View>
          {(test.ref_min !== null || test.ref_max !== null) && (
            <Text style={styles.optimalRangeText}>Range: {test.ref_min} - {test.ref_max} {test.unit}</Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.optimalValueText}>{test.value}</Text>
        <Text style={styles.optimalStatusText}>NORMAL</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Sizes.md,
    fontFamily: 'PlusJakartaSans-Medium',
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
  },
  errorText: {
    marginTop: Sizes.md,
    fontFamily: 'PlusJakartaSans-Medium',
    color: Colors.error,
    fontSize: Typography.body,
  },
  backButtonContainer: {
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: Colors.white, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginLeft: process.env.EXPO_OS === 'android' ? 4 : 0,
    ...Platform.select({
      ios: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)"
      },
      android: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }
    })
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.lg,
    paddingBottom: Sizes.xxxl * 2,
    gap: Sizes.xl,
  },
  
  // Header section
  headerSection: {
    gap: Sizes.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientNameText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.h3,
    color: Colors.textPrimary,
  },
  reportDateText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  attentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Sizes.radiusFull,
    gap: 6,
  },
  attentionBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
  },
  attentionBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: Typography.small,
    color: Colors.errorDark,
  },
  
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.xxxl,
    paddingHorizontal: Sizes.xl,
    gap: Sizes.md,
  },
  emptyStateTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    marginTop: Sizes.sm,
  },
  emptyStateDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: Sizes.radiusLg,
    paddingHorizontal: Sizes.md,
    height: 48,
  },
  searchIcon: {
    marginRight: Sizes.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
  },
  
  // Sections
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
  },
  highPriorityBadge: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizes.radiusSm,
  },
  highPriorityText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.tiny,
    color: Colors.error,
  },
  optimalBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizes.radiusSm,
  },
  optimalBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.tiny,
    color: Colors.successDark,
  },
  
  // Biomarker Card
  biomarkerCard: {
    borderRadius: Sizes.radiusLg,
    borderWidth: 1,
    ...Platform.select({
      ios: { boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)" },
      android: { elevation: 2 }
    })
  },
  biomarkerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Sizes.sm,
  },
  biomarkerTitleText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  biomarkerSubtitleText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.small,
    marginTop: 2,
  },
  biomarkerValueText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.h3,
    color: Colors.gray900,
  },
  biomarkerUnitText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.small,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  
  // Range Bar
  rangeBarTrack: {
    height: 8,
    backgroundColor: Colors.gray200,
    borderRadius: Sizes.radiusFull,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    marginTop: Sizes.xs,
  },
  rangeSegment: {
    position: 'absolute',
    height: '100%',
  },
  rangeMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.gray900,
    zIndex: 10,
    marginLeft: -2,
    borderRadius: 2,
  },
  rangeLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  rangeLabelText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: Colors.textTertiary,
  },
  rangeNormalLabelText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: Colors.textPrimary,
  },
  
  // Card Expanded Content
  insightBox: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: Sizes.md,
    borderRadius: Sizes.radiusMd,
    borderWidth: 1,
    marginTop: Sizes.md,
  },
  insightText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: Typography.small,
    color: Colors.gray600,
    lineHeight: 18,
  },
  pastValuesContainer: {
    marginTop: Sizes.md,
    borderTopWidth: 1,
    paddingTop: Sizes.md,
  },
  pastValuesTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: Colors.gray500,
    letterSpacing: 1,
    marginBottom: Sizes.sm,
  },
  pastValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pastValueDateText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.small,
    color: Colors.textSecondary,
  },
  pastValueNumText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: Typography.small,
    color: Colors.textPrimary,
  },
  
  // Optimal Results
  optimalResultsCard: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusLg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Sizes.md,
    ...Platform.select({
      ios: { boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)" },
      android: { elevation: 2 }
    })
  },
  optimalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optimalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  optimalTitleText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
  },
  optimalRangeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  optimalValueText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
  },
  optimalStatusText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Sizes.md,
  }
});
