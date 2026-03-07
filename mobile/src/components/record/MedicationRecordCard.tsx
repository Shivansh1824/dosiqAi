// src/components/prescription/MedicationRecordCard.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout, useAnimatedStyle, useSharedValue, withTiming, withRepeat } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../../constants';
import { ParsedMedication } from '../../types/medicationVerification';
import { FamilyMember } from '../../types/familyMember';
import { parseDateOnly, calculateEndDate } from '../../utils/medicationParser';
import { MedicationHeader } from '../medication/MedicationHeader';
import { CoursePeriodSection } from '../medication/CoursePeriodSection';
import { ReminderTimesSectionLegacy } from '../medication/ReminderTimesSectionLegacy';
import { InfoModal } from '../InfoModal';
import { AnimatedTooltip } from '../AnimatedTooltip';

interface MedicationRecordCardProps {
  medication: ParsedMedication;
  documentId: string;
  documentTitle: string;
  suggestedStartDate: string;
  familyMember?: FamilyMember;
  confidenceScore?: number;
  index?: number;
}

// ─── Icon Glow — diagonal cut gradient ────────────────────────────────────────
const IconGlow = () => {
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1.0, { duration: 2500 }),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: '25deg' }]
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -20,
          top: -40,
          width: 140,
          height: 180,
        },
        style
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[
          'rgba(59, 130, 246, 0.25)',  // Blue core
          'rgba(124, 58, 237, 0.15)', // Violet mid
          'rgba(96, 165, 250, 0.05)', // Sky-blue edge
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
};

const getMealTimingLabel = (relation: string): string => {
  switch (relation) {
    case 'before_food': return 'Before Meal';
    case 'after_food': return 'After Meal';
    case 'with_food': return 'With Meal';
    case 'empty_stomach': return 'Empty Stomach';
    case 'anytime': return 'Anytime';
    default: return 'Anytime';
  }
};

export function MedicationRecordCard({
  medication,
  documentId,
  documentTitle,
  suggestedStartDate,
  familyMember,
  confidenceScore,
  index,
}: MedicationRecordCardProps) {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  // Floating Tooltip State
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [tooltipContent, setTooltipContent] = useState('');

  // Handle Tooltip Press
  const handleTooltipPress = (event: any, content: string) => {
    const { pageX, pageY } = event.nativeEvent;
    setTooltipPosition({ x: pageX, y: pageY });
    setTooltipContent(content);
    setTooltipVisible(true);
  };

  // We only show active reminders that were confirmed
  const activeReminderTimes = medication.time_of_day || [];
  
  // Extract relation to meal
  const relation = medication.food_relationship || medication.source_raw?.timing?.relation_to_meal;
  const foodNote = relation && relation !== 'anytime' && relation !== 'any' ? getMealTimingLabel(relation) : '';

  // Create default notes for read-only display based on final confirmed times
  const reminderDefaultNotes: Record<string, string> = {};
  if (foodNote) {
    activeReminderTimes.forEach((time: string) => {
      reminderDefaultNotes[time] = foodNote;
    });
  }

  // Calculate generic/fallback confidence if not present on item
  const displayConfidence = medication.source_raw?.assumed_enriched_data?.confidence !== undefined
    ? medication.source_raw.assumed_enriched_data.confidence
    : confidenceScore;

  const renderAIAnalysisContent = () => {
    const hasAttributes = !!(
      medication.source_raw?.dosage_instruction ||
      medication.dosage ||
      medication.duration_days ||
      medication.strength ||
      medication.form ||
      medication.generic_name ||
      medication.food_relationship
    );

    return (
      <View style={styles.modalContent}>
        <Text style={styles.summaryTextModal}>
          "{medication.name}" helps with {medication.medicine_purpose || 'Treatment'}.
        </Text>

        {hasAttributes && (
          <View style={styles.expandedContentModal}>
            <View style={styles.tableBorderContainer}>
              {/* AI Confidence Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableHeaderCell}>
                  <Text style={styles.tableHeaderText}>Ai</Text>
                </View>
                <View style={styles.tableValueCell}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather
                      name={medication.confidence === 'high' ? 'check-circle' : medication.confidence === 'medium' ? 'alert-circle' : 'alert-triangle'}
                      size={12}
                      color={medication.confidence === 'high' ? '#137333' : medication.confidence === 'medium' ? '#F9AB00' : '#C5221F'}
                    />
                    <Text style={[styles.tableValueText, { fontWeight: 'bold' }]}>
                      {displayConfidence !== undefined
                        ? `Ai Confidence: ${Math.round(displayConfidence * 100)}%`
                        : 'Ai'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Attributes Rows */}
              {medication.dosage && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Note</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.dosage}</Text>
                  </View>
                </View>
              )}

              {medication.duration_days && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Duration</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.duration_days} days</Text>
                  </View>
                </View>
              )}

              {medication.strength && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Strength</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.strength}</Text>
                  </View>
                </View>
              )}

              {medication.form && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Form</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.form}</Text>
                  </View>
                </View>
              )}

              {medication.generic_name && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Generic Name</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{medication.generic_name}</Text>
                  </View>
                </View>
              )}
              
              {medication.food_relationship && (
                <View style={styles.tableRow}>
                  <View style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>Directions</Text>
                  </View>
                  <View style={styles.tableValueCell}>
                    <Text style={styles.tableValueText}>{getMealTimingLabel(medication.food_relationship)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View layout={Layout.springify().mass(0.8)} style={[
      styles.card,
      {
        paddingBottom: 8,
        marginBottom: 12,
        marginHorizontal: 16,
        // Match MedicationVerificationCard container styles perfectly
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#1a1a2e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
        overflow: 'hidden',
        borderWidth: 0, // Remove border
      }
    ]}>
      <IconGlow />
      <MedicationHeader
        name={medication.name}
        form={medication.form || null}
        confidence={medication.confidence}
        isEditing={false}
        editedName={medication.name}
        onEditedNameChange={() => {}}
        onToggleEdit={() => {}}
        onDelete={() => {}}
        onResetToAI={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        onNamePress={() => setInfoModalVisible(true)}
        serialNumber={index !== undefined ? index + 1 : undefined}
      />

      <View style={{ paddingBottom: 8 }}>

        {/* AI Summary Static Labels / Badges */}
        <View style={styles.summaryContainer}>
          <View style={styles.aiButtonsRow}>
            {/* 1. Strength */}
            {medication.strength && (
              <TouchableOpacity
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => handleTooltipPress(e, 'Strength')}
              >
                <View style={styles.aiButton}>
                  <View style={styles.aiButtonIcon}>
                    <Feather name="zap" size={10} color={Colors.gray600} />
                  </View>
                  <Text style={styles.aiButtonText}>
                    {medication.strength}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 2. Purpose — highlighted */}
            {medication.medicine_purpose && (
              <TouchableOpacity
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => handleTooltipPress(e, 'Medication Purpose')}
              >
                <View style={styles.aiButtonPurpose}>
                  <View style={styles.aiButtonIcon}>
                    <Feather name="activity" size={10} color="#6D28D9" />
                  </View>
                  <Text style={styles.aiButtonTextPurpose}>
                    {medication.medicine_purpose}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 3. Type */}
            {medication.medicine_type && (
              <TouchableOpacity
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => handleTooltipPress(e, 'Medication Type')}
              >
                <View style={styles.aiButton}>
                  <View style={styles.aiButtonIcon}>
                    <Feather name="layers" size={10} color={Colors.gray600} />
                  </View>
                  <Text style={styles.aiButtonText}>
                    {medication.medicine_type}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 4. Note */}
            {(medication.source_raw?.dosage_instruction || medication.dosage) && (
              <TouchableOpacity
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => handleTooltipPress(e, 'Note')}
              >
                <View style={styles.aiButton}>
                  <View style={styles.aiButtonIcon}>
                    <Feather name="file-text" size={10} color={Colors.gray600} />
                  </View>
                  <Text style={styles.aiButtonText}>
                    {medication.source_raw?.dosage_instruction || medication.dosage}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 5. Duration */}
            {medication.duration_days && (
              <TouchableOpacity
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => handleTooltipPress(e, 'Duration')}
              >
                <View style={styles.aiButton}>
                  <View style={styles.aiButtonIcon}>
                    <Feather name="clock" size={10} color={Colors.gray600} />
                  </View>
                  <Text style={styles.aiButtonText}>
                    {medication.duration_days} Days
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 6. Meal Relation — highlighted */}
            {(medication.food_relationship || medication.source_raw?.timing?.relation_to_meal) && (
              <TouchableOpacity
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => handleTooltipPress(e, 'Meal Relation')}
              >
                <View style={styles.aiButtonMeal}>
                  <View style={styles.aiButtonIcon}>
                    <Feather name="coffee" size={10} color="#B45309" />
                  </View>
                  <Text style={styles.aiButtonTextMeal}>
                    {getMealTimingLabel(medication.food_relationship || medication.source_raw?.timing?.relation_to_meal!)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {(medication.medicine_type || medication.medicine_purpose) && <View style={styles.divider} />}

        {/* Read-only Course Period */}
        <View pointerEvents="none">
          <CoursePeriodSection
            startDate={medication.start_date || suggestedStartDate}
            endDate={calculateEndDate(medication.start_date || suggestedStartDate, medication.duration_days || 5)}
            isVerified={false} // Override to false to exactly mimic design, pointerEvents prevents interaction
            onStartDatePress={() => {}}
            onEndDatePress={() => {}}
          />
        </View>

        {/* Read-only Reminder Times using Legacy Section for presentation */}
        {activeReminderTimes.length > 0 && (
          <View style={styles.remindersWrapper} pointerEvents="none">
            <ReminderTimesSectionLegacy
              reminderTimes={activeReminderTimes}
              intervalText=""
              medicineName={medication.name}
              reminderToggles={activeReminderTimes.map(() => true)} // All active ones are legally toggled 'on'
              defaultNotes={reminderDefaultNotes}
              onToggleChange={() => {}}
              isVerified={false} // Force unverified styling to match perfectly visually
              totalTimesPerDay={medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day}
              timingDosage={medication.timing_dosage ?? medication.source_raw?.timing?.dosage}
              foodRelationship={medication.food_relationship || medication.source_raw?.timing?.relation_to_meal || undefined}
              preferredTimes={{
                morning: familyMember?.morning_dose_time || undefined,
                afternoon: familyMember?.afternoon_dose_time || undefined,
                night: familyMember?.night_dose_time || undefined,
              }}
            />
          </View>
        )}
      </View>

      <InfoModal
        visible={infoModalVisible}
        title="dosiq Ai Analysis"
        onClose={() => setInfoModalVisible(false)}
      >
        <ScrollView bounces={false} style={{ maxHeight: 500 }}>
          {renderAIAnalysisContent()}
        </ScrollView>
      </InfoModal>

      {/* Floating Tooltip specifically for medicine type and purpose */}
      <AnimatedTooltip
        visible={tooltipVisible}
        content={tooltipContent}
        targetPosition={tooltipPosition}
        onClose={() => setTooltipVisible(false)}
        backgroundColor="#BFDBFE"
        textColor="#000000"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    marginHorizontal: 16,
    paddingTop: 0,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  notesContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '0A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  summaryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  summaryToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  summaryContent: {
    backgroundColor: Colors.gray50,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: -12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  genericNameText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
  },
  remindersWrapper: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 80,
    marginTop: 12,
    marginBottom: 12,
  },
  summaryContainer: {
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 10,
  },
  aiButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
    paddingHorizontal: 8,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F3F4F6', // Colors.gray100
    gap: 6,
  },
  aiButtonIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#4B5563', // Colors.gray600
    letterSpacing: 0,
  },
  aiButtonPurpose: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#EDE9FE', // violet-100
    borderWidth: 1,
    borderColor: '#C4B5FD', // violet-300
    gap: 6,
  },
  aiButtonTextPurpose: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#5B21B6', // violet-800
    letterSpacing: 0,
  },
  aiButtonMeal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FEF3C7', // amber-100
    borderWidth: 1,
    borderColor: '#FCD34D', // amber-300
    gap: 6,
  },
  aiButtonTextMeal: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: '#92400E', // amber-800
    letterSpacing: 0,
  },
  // Modal Styles (copied from MedicationVerificationCard)
  modalContent: {
    paddingBottom: 20,
  },
  summaryTextModal: {
    fontSize: 15,
    color: Colors.gray600,
    lineHeight: 22,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 16,
    textAlign: 'left',
  },
  expandedContentModal: {
    marginTop: 8,
  },
  tableBorderContainer: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  tableHeaderCell: {
    width: 120,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.gray50,
    borderRightWidth: 1,
    borderRightColor: Colors.gray100,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tableValueCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  tableValueText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
});
