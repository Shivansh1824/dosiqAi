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
import { normalizeBiomarkerName } from '../../src/utils/stringUtils';

export default function LabReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const documentId = params.id as string;
  const insets = useSafeAreaInsets();

  const { document, reportData, pastValues, isLoading, error } = useLabReport(documentId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  React.useEffect(() => {
    if (!isLoading && !hasAutoExpanded && (reportData.actionRequired.length > 0 || reportData.optimalResults.length > 0)) {
      const firstActionBiomarker = reportData.actionRequired.find(t => t.biomarker_id);
      const firstOptimalBiomarker = reportData.optimalResults.find(t => t.biomarker_id);
      
      if (firstActionBiomarker || firstOptimalBiomarker) {
        setExpandedCards(prev => {
          const next = new Set(prev);
          if (firstActionBiomarker) next.add(firstActionBiomarker.id);
          if (firstOptimalBiomarker) next.add(firstOptimalBiomarker.id);
          return next;
        });
        setHasAutoExpanded(true);
      }
    }
  }, [isLoading, reportData, hasAutoExpanded]);

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

  const filterAndSort = (tests: TestResult[]) =>
    tests
      .filter(t => {
        const normalizedSearch = normalizeBiomarkerName(searchQuery);
        const matchesSearch = !normalizedSearch || normalizeBiomarkerName(t.test_name).includes(normalizedSearch);
        const matchesCategory = selectedCategory === 'All' || t.biomarker?.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.biomarker_id && !b.biomarker_id) return -1;
        if (!a.biomarker_id && b.biomarker_id) return 1;
        return 0;
      });

  const filteredActionRequired = filterAndSort(reportData.actionRequired);
  const filteredOptimalResults = filterAndSort(reportData.optimalResults);

  // Extract unique categories
  const categoryCounts = React.useMemo(() => {
    const allTests = [...reportData.actionRequired, ...reportData.optimalResults];
    const counts: Record<string, number> = { All: allTests.length };
    
    allTests.forEach(t => {
      if (t.biomarker?.category) {
        counts[t.biomarker.category] = (counts[t.biomarker.category] || 0) + 1;
      }
    });

    const categoriesList = ['All', ...Object.keys(counts).filter(c => c !== 'All').sort()];
    return { categoriesList, counts };
  }, [reportData]);

  const { categoriesList, counts: countsMap } = categoryCounts;

  const formatCategoryName = (category: string) => {
    if (category === 'All') return 'All';
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

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

          {/* Category Filter */}
          {categoriesList.length > 2 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            >
              {categoriesList.map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category && styles.categoryChipActive
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive
                  ]}>
                    {formatCategoryName(category)} ({countsMap[category]})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
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
                  <ResultRow 
                    test={test} 
                    expanded={expandedCards.has(test.id)}
                    onToggle={() => toggleExpand(test.id)}
                    pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []}
                    type="optimal"
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

const ResultRow = ({ 
  test, 
  expanded, 
  onToggle, 
  pastTests,
  type
}: { 
  test: TestResult, 
  expanded: boolean, 
  onToggle: () => void, 
  pastTests?: TestResult[],
  type: 'action' | 'optimal'
}) => {
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
              <Text style={isAction ? styles.actionItemName : styles.optimalTitleText}>{test.test_name}</Text>
              {isBiomarker && (
                <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.gray400} />
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
          <Text style={isAction ? [styles.actionItemValue, { color: statusColor }] : styles.optimalValueText}>{test.value}</Text>
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
            <ResultRow 
              test={test} 
              expanded={expandedCards.has(test.id)}
              onToggle={() => onToggleExpand(test.id)}
              pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []}
              type="action"
            />
            {index < tests.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </Animated.View>
  );
};



const CollapsibleText = ({ text, style, numberOfLines = 2 }: { text: string; style: any; numberOfLines?: number }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  return (
    <View>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={(e) => {
          if (!expanded) setNeedsTruncation(e.nativeEvent.lines.length >= numberOfLines);
        }}
      >
        {text}
      </Text>
      {(needsTruncation || expanded) && (
        <TouchableOpacity onPress={() => setExpanded(p => !p)} hitSlop={8} activeOpacity={0.6}>
          <Text style={styles.readMoreText}>{expanded ? 'Show less' : 'Read more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const BiomarkerExpandedContent = ({ test, pastTests }: { test: TestResult, pastTests?: TestResult[] }) => {
  return (
    <>
      {test.biomarker?.test_results && (
        <View style={styles.biomarkerInfoContainer}>
          <CollapsibleText text={test.biomarker.test_results} style={styles.biomarkerDescription} />
        </View>
      )}

      <BiomarkerTrendChart currentTest={test} pastTests={pastTests || []} />
      
      <View style={[styles.pastValuesList, { marginTop: Sizes.md }]}>
        {[test, ...(pastTests || [])]
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

      <DietarySuggestionsBlock 
        biomarker={test.biomarker} 
        testName={test.test_name} 
        isOptimal={test.status?.toUpperCase() === 'NORMAL' || !test.status}
      />
    </>
  );
};

const RefRangeText = ({ refMin, refMax, unit, style }: { refMin: number | null; refMax: number | null; unit: string | null; style: any }) => {
  if (refMin === null && refMax === null) return null;
  const range = refMin !== null
    ? (refMax !== null ? `${refMin} - ${refMax}` : `> ${refMin}`)
    : `< ${refMax}`;
  return <Text style={style}>Ref: {range} {unit}</Text>;
};

type DietType = 'nonveg' | 'veg';

const DietarySuggestionsBlock = ({ biomarker, testName, isOptimal }: { biomarker: TestResult['biomarker'], testName: string, isOptimal: boolean }) => {
  const hasNonVeg = !!(biomarker?.good_to_eat_nonveg || biomarker?.bad_to_eat_nonveg);
  const hasVeg = !!(biomarker?.good_to_eat_veg || biomarker?.bad_to_eat_veg);

  // Default to 'veg' so plant-based is pre-selected on page load
  const [activeDiet, setActiveDiet] = useState<DietType | null>('veg');

  if (!biomarker || (!hasNonVeg && !hasVeg)) return null;

  const goodText = activeDiet === 'nonveg' ? biomarker.good_to_eat_nonveg : (activeDiet === 'veg' ? biomarker.good_to_eat_veg : null);
  const badText  = activeDiet === 'nonveg' ? biomarker.bad_to_eat_nonveg  : (activeDiet === 'veg' ? biomarker.bad_to_eat_veg  : null);

  const goodTitle = isOptimal ? 'Supportive Foods' : 'Include More';
  const badTitle  = isOptimal ? 'Items to Moderate' : 'Limit / Avoid';
  const subtitle  = isOptimal 
    ? `Your ${testName} result is in the optimal range. To maintain these healthy levels, you may focus on these habits:`
    : `Based on your ${testName} result`;

  return (
    <View style={dietStyles.container}>
      {/* Header */}
      <View style={dietStyles.header}>
        <View style={dietStyles.headerLeft}>
          <View style={dietStyles.iconCircle}>
            <Image 
              source="sf:leaf.fill" 
              style={{ width: 14, height: 14 }} 
              tintColor={Colors.primary} 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dietStyles.title}>Dietary Insights</Text>
            <Text style={dietStyles.subtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>

      {/* Segmented Control */}
      {hasNonVeg && hasVeg && (
        <View style={dietStyles.segmentedBackground}>
          <TouchableOpacity
            style={[dietStyles.segment, activeDiet === 'veg' && dietStyles.segmentActive]}
            onPress={() => setActiveDiet('veg')}
            activeOpacity={0.8}
          >
            <Text style={[dietStyles.segmentLabel, activeDiet === 'veg' && dietStyles.segmentLabelActive]}>🥦 Plant-Based</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dietStyles.segment, activeDiet === 'nonveg' && dietStyles.segmentActive]}
            onPress={() => setActiveDiet('nonveg')}
            activeOpacity={0.8}
          >
            <Text style={[dietStyles.segmentLabel, activeDiet === 'nonveg' && dietStyles.segmentLabelActive]}>🥩 Meat & Dairy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cards - Only show if a diet type is selected */}
      {activeDiet && (
        <Animated.View key={activeDiet} entering={FadeIn.duration(300)}>
          <View style={dietStyles.cardsContainer}>
            {goodText ? (
              <View style={[dietStyles.card, { borderColor: Colors.successLight + '40', backgroundColor: Colors.successLight + '10' }]}>
                <View style={dietStyles.cardHeader}>
                  <Image source="sf:checkmark.circle.fill" style={dietStyles.cardIcon} tintColor={Colors.success} />
                  <Text style={[dietStyles.cardTitle, { color: Colors.successDark }]}>{goodTitle}</Text>
                </View>
                <Text style={dietStyles.cardText}>{goodText}</Text>
              </View>
            ) : null}

            {badText ? (
              <View style={[dietStyles.card, { borderColor: Colors.errorLight + '40', backgroundColor: Colors.errorLight + '10', marginTop: Sizes.sm }]}>
                <View style={dietStyles.cardHeader}>
                  <Image source="sf:exclamationmark.circle.fill" style={dietStyles.cardIcon} tintColor={Colors.error} />
                  <Text style={[dietStyles.cardTitle, { color: Colors.errorDark }]}>{badTitle}</Text>
                </View>
                <Text style={dietStyles.cardText}>{badText}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const dietStyles = StyleSheet.create({
  container: {
    marginTop: Sizes.md,
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusMd,
    padding: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      android: { elevation: 1 },
    }),
  },
  header: {
    marginBottom: Sizes.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  segmentedBackground: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 8,
    padding: 2,
    marginBottom: Sizes.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: Colors.white,
    ...Platform.select({
      ios: { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
      android: { elevation: 2 },
    }),
  },
  segmentLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  segmentLabelActive: {
    color: Colors.textPrimary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  cardsContainer: {
    gap: 0,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardIcon: {
    width: 14,
    height: 14,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

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
  
  // Categories
  categoriesContainer: {
    paddingBottom: Sizes.xs,
    gap: Sizes.sm,
  },
  categoryChip: {
    paddingHorizontal: Sizes.md,
    paddingVertical: 8,
    borderRadius: Sizes.radiusFull,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  categoryTextActive: {
    color: Colors.white,
    fontFamily: 'PlusJakartaSans-Bold',
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
  readMoreText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: Colors.primary,
    marginTop: 3,
  },
});
