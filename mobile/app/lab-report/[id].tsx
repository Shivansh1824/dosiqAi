import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { useLabReportScreen } from '../../src/hooks/useLabReportScreen';
import { useDocumentFile } from '../../src/hooks/useDocumentFile';
import { useDocumentActions } from '../../src/hooks/useDocumentActions';
import { useAnalysisPDF } from '../../src/hooks/useAnalysisPDF';
import LoadingOverlay from '../../src/components/LoadingOverlay';
import ShareModal from '../../src/components/ShareModal';
import DocumentOptionsModal from '../../src/components/DocumentOptionsModal';
import { Colors, Sizes, Typography } from '../../src/constants';
import { StatusBar } from 'expo-status-bar';
import { DocumentPreviewCard } from '../../src/components/prescription/DocumentPreviewCard';
import FullScreenImageModal from '../../src/components/FullScreenImageModal';
import { LabReportActionSection, LabReportResultRow, ResultRowDivider } from '../../src/components/record';

export default function LabReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const documentId = params.id as string;

  const {
    document,
    reportData,
    pastValues,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    expandedCards,
    toggleExpand,
    filteredActionRequired,
    filteredOptimalResults,
    categoriesList,
    countsMap,
    patientName,
    reportDate,
    displayTitle,
    isAnalyzing,
    isEmpty,
    formatCategoryName,
  } = useLabReportScreen(documentId);

  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => router.back(), [router]);

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
    displayTitle,
  });

  const HeaderLeft = () => (
    <TouchableOpacity
      onPress={handleBack}
      activeOpacity={0.7}
      style={[
        styles.backButtonContainer,
        process.env.EXPO_OS === 'ios'
          ? { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' } as any
          : { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      ]}
    >
      {process.env.EXPO_OS === 'ios' ? (
        <Image source="sf:chevron.left" style={{ width: 22, height: 22 }} tintColor={Colors.textPrimary} />
      ) : (
        <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
      )}
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
        {process.env.EXPO_OS === 'ios' ? (
          <Image source="sf:exclamationmark.circle" style={{ width: 48, height: 48 }} tintColor={Colors.error} />
        ) : (
          <Feather name="alert-circle" size={48} color={Colors.error} />
        )}
        <Text style={styles.errorText} selectable>{error || 'Failed to load report'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => (
            <View style={{ gap: 2, alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: 'PlusJakartaSans-Bold', color: Colors.textPrimary }}>
                {patientName}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'PlusJakartaSans-Medium', color: Colors.textSecondary }}>
                {reportDate}
              </Text>
            </View>
          ),
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderLeft />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={handleShare} hitSlop={10} activeOpacity={0.7}>
                {process.env.EXPO_OS === 'ios' ? (
                  <Image source="sf:square.and.arrow.up" style={{ width: 22, height: 22 }} tintColor={Colors.primary} />
                ) : (
                  <Feather name="share-2" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowOptionsModal(true)} hitSlop={10} activeOpacity={0.7}>
                {process.env.EXPO_OS === 'ios' ? (
                  <Image source="sf:ellipsis" style={{ width: 22, height: 22 }} tintColor={Colors.textPrimary} />
                ) : (
                  <Feather name="more-vertical" size={22} color={Colors.textPrimary} />
                )}
              </TouchableOpacity>
            </View>
          ),
          ...(process.env.EXPO_OS === 'ios' ? {
            headerTransparent: true,
            headerBlurEffect: 'systemUltraThinMaterial',
            headerSearchBarOptions: {
              placeholder: 'Search tests (e.g. Glucose)',
              onChangeText: ({ nativeEvent }: { nativeEvent: { text: string } }) => setSearchQuery(nativeEvent.text),
              onCancelButtonPress: () => setSearchQuery(''),
              hideWhenScrolling: false,
            },
          } : {
            headerTransparent: true,
            headerBackground: () => (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.white }]} />
            ),
            headerShadowVisible: false,
          }),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          process.env.EXPO_OS !== 'ios' && { paddingTop: insets.top + 64 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <DocumentPreviewCard
          fileNotFound={fileNotFound}
          isPdf={!!isPdf}
          imageUri={imageUri}
          handleViewFullDocument={handleViewFullDocument}
          handleDownload={handleDownload}
          downloading={downloading}
        />

        <Animated.View layout={LinearTransition.duration(300)} style={styles.headerSection}>
          {/* Search Bar — Android only; iOS uses native headerSearchBarOptions */}
          {process.env.EXPO_OS !== 'ios' && (
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
          )}

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
                    selectedCategory === category && styles.categoryChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive,
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
            {process.env.EXPO_OS === 'ios' ? (
              <Image source="sf:doc.text.minus" style={{ width: 48, height: 48 }} tintColor={Colors.gray400} />
            ) : (
              <Feather name="file-minus" size={48} color={Colors.gray400} />
            )}
            <Text style={styles.emptyStateTitle}>No Test Results</Text>
            <Text style={styles.emptyStateDesc}>We couldn't detect any structured lab test results in this report.</Text>
          </View>
        ) : (
          <>
            {filteredActionRequired.length > 0 && (
              <LabReportActionSection
                tests={filteredActionRequired}
                expandedCards={expandedCards}
                onToggleExpand={toggleExpand}
                pastValues={pastValues}
              />
            )}

            {filteredOptimalResults.length > 0 && (
              <Animated.View layout={LinearTransition.duration(300)} style={[styles.sectionContainer, { marginTop: Sizes.md }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>OPTIMAL RESULTS</Text>
                  <View style={styles.optimalBadge}>
                    <Text style={styles.optimalBadgeText}>{reportData.optimalResults.length} Items</Text>
                  </View>
                </View>

                <View style={styles.optimalResultsCard}>
                  {filteredOptimalResults.map((test, index) => (
                    <View key={test.id}>
                      <LabReportResultRow
                        test={test}
                        expanded={expandedCards.has(test.id)}
                        onToggle={() => toggleExpand(test.id)}
                        pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []}
                        type="optimal"
                      />
                      {index < filteredOptimalResults.length - 1 && <ResultRowDivider />}
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentType={documentType}
        onShareDocument={handleShareDocument}
        onShareAnalysis={handleShareAnalysis}
      />

      <LoadingOverlay visible={isGeneratingAnalysis} message="Preparing your health analysis..." />

      <DocumentOptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        onDelete={confirmDelete}
      />

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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.md,
    paddingTop: Sizes.sm,
    paddingBottom: Sizes.xxxl * 2,
    gap: Sizes.md,
  },
  headerSection: {
    gap: Sizes.md,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.xxxl,
    paddingHorizontal: Sizes.md,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: Sizes.radiusLg,
    borderCurve: 'continuous',
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
  optimalBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizes.radiusSm,
    borderCurve: 'continuous',
  },
  optimalBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: Typography.tiny,
    color: Colors.successDark,
  },
  optimalResultsCard: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusLg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Sizes.md,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
  },
});
