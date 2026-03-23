import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { useLabReport, TestResult } from '../../src/hooks/useLabReport';
import { useDocumentFile } from '../../src/hooks/useDocumentFile';
import { useDocumentActions } from '../../src/hooks/useDocumentActions';
import { useAnalysisPDF } from '../../src/hooks/useAnalysisPDF';
import LoadingOverlay from '../../src/components/LoadingOverlay';
import ShareModal from '../../src/components/ShareModal';
import DocumentOptionsModal from '../../src/components/DocumentOptionsModal';
import { Colors, Sizes, Typography } from '../../src/constants';
import { BiomarkerTrendChart } from '../../src/components';
import { StatusBar } from 'expo-status-bar';
import { DocumentPreviewCard } from '../../src/components/prescription/DocumentPreviewCard';
import FullScreenImageModal from '../../src/components/FullScreenImageModal';

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

  const HeaderIcon = ({ iosName, androidName, onPress, color }: { iosName: string, androidName: any, onPress: () => void, color: string }) => (
    <TouchableOpacity onPress={onPress} hitSlop={10} activeOpacity={0.7}>
      {process.env.EXPO_OS === 'ios' ? (
        <Image 
          source={`sf:${iosName}`} 
          style={{ width: 22, height: 22 }} 
          tintColor={color} 
        />
      ) : (
        <Feather name={androidName} size={22} color={color} />
      )}
    </TouchableOpacity>
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

  const displayTitle = document?.ai_analysis_result?.patient?.name || (document?.local_file_path?.split('/').pop() || 'Medical Document');

  const {
    imageUri,
    fileNotFound,
    downloading,
    isPdf,
    showFullScreenImage,
    setShowFullScreenImage,
    handleViewFullDocument,
    handleDownload,
  } = useDocumentFile(document, displayTitle);

  const {
    showShareModal,
    setShowShareModal,
    showOptionsModal,
    setShowOptionsModal,
    confirmDelete,
    handleShare,
    handleShareDocument,
  } = useDocumentActions(document, imageUri, handleBack);

  const documentType = document?.ai_analysis_result?.document_type?.toLowerCase() === 'prescription' ? 'prescription' : 'report';

  const { isGenerating: isGeneratingAnalysis, generateAndShare: handleShareAnalysis } = useAnalysisPDF({
    analysis: document?.ai_analysis_result,
    documentType,
    imageUri,
    displayTitle
  });

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
  const reportDate = document?.visit_date
    ? new Date(document.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : document?.ai_analysis_result?.visit_date 
      ? new Date(document.ai_analysis_result.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : document?.ai_analyzed_at ? new Date(document.ai_analyzed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';


  const isAnalyzing = document?.ai_analysis_status === 'processing' || document?.ai_analysis_status === 'pending';
  const isEmpty = reportData.actionRequired.length === 0 && reportData.optimalResults.length === 0;

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: 'systemUltraThinMaterial',
          headerTitle: () => <HeaderTitle patientName={patientName} reportDate={reportDate} />,
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderLeft />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <HeaderIcon 
                iosName="square.and.arrow.up" 
                androidName="share-2" 
                onPress={handleShare} 
                color={Colors.primary} 
              />
              <HeaderIcon 
                iosName="ellipsis" 
                androidName="more-vertical" 
                onPress={() => setShowOptionsModal(true)} 
                color={Colors.textPrimary} 
              />
            </View>
          ),
          headerBackground: () => process.env.EXPO_OS === 'android' ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.85)' }]} />
          ) : undefined
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Platform.OS === 'android' ? insets.top + Sizes.xl : Sizes.md }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Preview Card */}
        <DocumentPreviewCard
          fileNotFound={fileNotFound}
          isPdf={!!isPdf}
          imageUri={imageUri}
          handleViewFullDocument={handleViewFullDocument}
          handleDownload={handleDownload}
          downloading={downloading}
        />

        <Animated.View layout={LinearTransition.duration(300)} style={styles.headerSection}>
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
          <ActionRequiredSection 
            tests={filteredActionRequired}
            expandedCards={expandedCards}
            onToggleExpand={toggleExpand}
            pastValues={pastValues}
          />
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
                  <OptimalResultRow 
                    test={test} 
                    expanded={expandedCards.has(test.id)}
                    onToggle={() => toggleExpand(test.id)}
                    pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []}
                  />
                  {index < filteredOptimalResults.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </Animated.View>
        )}
          </>
        )}
      </ScrollView>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentType={documentType}
        onShareDocument={handleShareDocument}
        onShareAnalysis={handleShareAnalysis}
      />

      <LoadingOverlay visible={isGeneratingAnalysis} message="Preparing your health analysis..." />

      {/* Document Options Modal */}
      <DocumentOptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        onDelete={confirmDelete}
      />

      {/* Full Screen Image Modal */}
      {imageUri && (
        <FullScreenImageModal
          visible={showFullScreenImage}
          imageUri={imageUri}
          onClose={() => setShowFullScreenImage(false)}
        />
      )}
    </View>
  );
}

// Subcomponents

const HeaderTitle = ({ patientName, reportDate }: { patientName: string, reportDate: string }) => (
  <View style={{ gap: 2, alignItems: 'center' }}>
    <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: 'PlusJakartaSans-Bold', color: Colors.textPrimary }}>
      {patientName}
    </Text>
    <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'PlusJakartaSans-Medium', color: Colors.textSecondary }}>
      {reportDate}
    </Text>
  </View>
);


const ActionRequiredItem = ({ 
  test, 
  expanded, 
  onToggle, 
  pastTests 
}: { 
  test: TestResult, 
  expanded: boolean, 
  onToggle: () => void, 
  pastTests?: TestResult[] 
}) => {
  const isHigh = test.status?.toUpperCase() === 'HIGH';
  const isLow = test.status?.toUpperCase() === 'LOW';
  
  const statusColor = (isHigh || isLow) ? Colors.error : Colors.warning;
  const statusLabel = test.status?.toUpperCase() || 'REVIEW';

  const isBiomarker = !!test.biomarker_id;

  return (
    <View style={styles.actionItemContainer}>
      <TouchableOpacity 
        activeOpacity={isBiomarker ? 0.7 : 1} 
        onPress={isBiomarker ? onToggle : undefined}
        style={styles.actionItemHeader}
      >
        <View style={styles.actionItemLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.actionItemName}>{test.test_name}</Text>
              {isBiomarker && (
                <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.gray400} />
              )}
            </View>
            {(test.ref_min !== null || test.ref_max !== null) && (
              <Text style={styles.actionItemRef}>
                Ref: {test.ref_min !== null ? (test.ref_max !== null ? `${test.ref_min} - ${test.ref_max}` : `> ${test.ref_min}`) : `< ${test.ref_max}`} {test.unit}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.actionItemRight}>
          <View style={{ alignItems: 'flex-end', marginRight: Sizes.sm }}>
            <Text style={[styles.actionItemValue, { color: statusColor }]}>{test.value}</Text>
            <Text style={[styles.actionItemStatus, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.actionItemExpanded}>
          <BiomarkerExpandedContent test={test} pastTests={pastTests} />
        </Animated.View>
      )}
    </View>
  );
};

const ActionRequiredSection = ({ 
  tests, 
  expandedCards, 
  onToggleExpand, 
  pastValues 
}: { 
  tests: TestResult[], 
  expandedCards: Set<string>, 
  onToggleExpand: (id: string) => void,
  pastValues: Record<string, TestResult[]>
}) => {
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
            <ActionRequiredItem 
              test={test} 
              expanded={expandedCards.has(test.id)}
              onToggle={() => onToggleExpand(test.id)}
              pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []}
            />
            {index < tests.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const OptimalResultRow = ({ 
  test, 
  expanded, 
  onToggle, 
  pastTests 
}: { 
  test: TestResult, 
  expanded: boolean, 
  onToggle: () => void,
  pastTests?: TestResult[]
}) => {
  const isBiomarker = !!test.biomarker_id;

  return (
    <View style={styles.optimalRowContainer}>
      <TouchableOpacity 
        activeOpacity={isBiomarker ? 0.7 : 1} 
        onPress={isBiomarker ? onToggle : undefined}
        style={styles.optimalRowHeader}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Sizes.sm, flex: 1 }}>
          <View style={styles.optimalDot} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.optimalTitleText}>{test.test_name}</Text>
              {isBiomarker && (
                <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.gray400} />
              )}
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
      </TouchableOpacity>

      {expanded && isBiomarker && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.optimalExpandedContent}>
          <BiomarkerExpandedContent test={test} pastTests={pastTests} />
        </Animated.View>
      )}
    </View>
  );
};

const BiomarkerExpandedContent = ({ test, pastTests }: { test: TestResult, pastTests?: TestResult[] }) => {
  return (
    <>
      {test.biomarker?.test_results && (
        <View style={styles.biomarkerInfoContainer}>
          <Text style={styles.biomarkerDescription}>{test.biomarker.test_results}</Text>
        </View>
      )}

      {(pastTests && pastTests.length > 0) ? (
        <>
          <BiomarkerTrendChart currentTest={test} pastTests={pastTests} />
          <View style={[styles.pastValuesList, { marginTop: Sizes.md }]}>
            {[test, ...pastTests]
              .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
              .slice(0, 6)
              .map((past) => {
                const isCurrent = past.id === test.id;
                return (
                  <View 
                    key={past.id} 
                    style={[
                      styles.pastValueItem, 
                      isCurrent && styles.currentPastValueItem
                    ]}
                  >
                    <View style={styles.pastValueLeft}>
                      {isCurrent && <View style={styles.currentIndicator} />}
                      <Text style={[styles.pastValueDate, isCurrent && styles.currentPastValueText]}>
                        {new Date(past.report_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric'})}
                      </Text>
                    </View>
                    <Text style={[styles.pastValueText, isCurrent && styles.currentPastValueText]}>
                      {past.value} {past.unit}
                    </Text>
                  </View>
                );
              })}
          </View>
        </>
      ) : (
        <>
          <View style={styles.pastValuesList}>
            <View style={[styles.pastValueItem, styles.currentPastValueItem]}>
              <View style={styles.pastValueLeft}>
                <View style={styles.currentIndicator} />
                <Text style={[styles.pastValueDate, styles.currentPastValueText]}>
                  {new Date(test.report_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric'})}
                </Text>
              </View>
              <Text style={[styles.pastValueText, styles.currentPastValueText]}>
                {test.value} {test.unit}
              </Text>
            </View>
          </View>
        </>
      )}
      {!pastTests?.length && !test.biomarker?.test_results && (
        <Text style={styles.noPastDataText}>No previous data or analysis available for trend</Text>
      )}
    </>
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
    textTransform: 'uppercase',
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

  // Action Required
  actionRequiredCard: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusLg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Sizes.md,
    ...Platform.select({
      ios: { boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" },
      android: { elevation: 3 }
    })
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
  },
  actionItemContainer: {
    backgroundColor: Colors.white,
  },
  actionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.md,
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Sizes.sm,
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
  actionItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  pastValuesList: {
    gap: Sizes.xs,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Sizes.radiusMd,
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

  noPastDataText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: Sizes.sm,
  },
  currentPastValueItem: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusSm,
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
  
  // Optimal Results
  optimalResultsCard: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusLg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Sizes.md,
    ...Platform.select({
      ios: { boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)" },
      android: { elevation: 2 }
    })
  },
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

  // Biomarker Info
  biomarkerInfoContainer: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Sizes.radiusMd,
    padding: Sizes.md,
  },
  biomarkerDescription: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
