import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Sizes, Typography } from '../../constants';
import { DocumentAnalysisResult } from '../../types/document';
import {
  MedicalReportAnalysis,
  calculateReportSummary,
  formatReportDate,
  getAbnormalCountInCategory,
  METRIC_STATUS_COLORS,
} from '../../types/medicalReport';
import { InfoRow, MetricCard, ExpandableSection } from '../../components/medicalReport';
import { GroupedTestsCard } from '../../components/prescription/GroupedTestsCard';
import { RootStackParamList } from '../../../App';

interface AnalysisResultsDisplayProps {
  result: DocumentAnalysisResult;
  labReportId: string | null;
}

export const AnalysisResultsDisplay = ({ result, labReportId }: AnalysisResultsDisplayProps) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Helper to toggle category expansion (accordion behavior - only one open at a time)
  const toggleCategory = (categoryName: string) => {
    if (expandedCategories.has(categoryName)) {
      // If clicking already open category, close it
      setExpandedCategories(new Set());
    } else {
      // If clicking closed category, open ONLY that one (close all others)
      setExpandedCategories(new Set([categoryName]));
    }
  };

  // Helper to get summary from new or legacy structure
  const getSummary = (analysisResult?: DocumentAnalysisResult): string | undefined => {
    return analysisResult?.common_data?.summary || analysisResult?.summary;
  };

  // Helper to format document type
  const formatDocumentType = (type: string): string => {
    if (type.toLowerCase() === 'invalid') return 'Invalid';
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  const summary = getSummary(result);
  const patientInfo = result.patient_info;
  const commonData = result.common_data;
  const prescriptionData = result.prescription_data;
  const reportData = result.report_data;
  const analysisMetadata = result.analysis_metadata;

  return (
    <View style={styles.analysisContent}>
      {/* Document Type & Visit Date */}
      {(result.document_type || commonData?.visit_date) && (
        <View style={styles.analysisGrid}>
          {result.document_type && (
            <View style={styles.analysisGridItem}>
              <Text style={styles.analysisLabel}>Type</Text>
              <Text style={styles.analysisValue}>{formatDocumentType(result.document_type)}</Text>
            </View>
          )}
          {commonData?.visit_date && (
            <View style={styles.analysisGridItem}>
              <Text style={styles.analysisLabel}>Visit Date</Text>
              <Text style={styles.analysisValue}>{commonData.visit_date}</Text>
            </View>
          )}
        </View>
      )}

      {/* Patient Info */}
      {patientInfo && (patientInfo.name || patientInfo.age || patientInfo.gender) && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Patient Information</Text>
          <View style={styles.patientInfoContainer}>
            {patientInfo.name && (
              <View style={styles.patientInfoChip}>
                <View style={styles.patientIconBadge}>
                  <Feather name="user" size={14} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.patientInfoLabel}>PATIENT</Text>
                  <Text style={styles.patientInfoValue}>{patientInfo.name}</Text>
                </View>
              </View>
            )}
            {patientInfo.age && (
              <View style={styles.patientInfoChip}>
                <View style={styles.patientIconBadge}>
                  <Feather name="calendar" size={14} color={Colors.secondary} />
                </View>
                <View>
                  <Text style={styles.patientInfoLabel}>AGE</Text>
                  <Text style={styles.patientInfoValue}>{patientInfo.age}</Text>
                </View>
              </View>
            )}
            {patientInfo.gender && (
              <View style={styles.patientInfoChip}>
                <View style={styles.patientIconBadge}>
                  <Feather name="users" size={14} color={Colors.info} />
                </View>
                <View>
                  <Text style={styles.patientInfoLabel}>GENDER</Text>
                  <Text style={styles.patientInfoValue}>{patientInfo.gender}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Doctor & Hospital Info */}
      {prescriptionData && (prescriptionData.doctor_name || prescriptionData.hospital_name) && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Healthcare Provider</Text>
          <View style={styles.patientInfoContainer}>
            {prescriptionData.doctor_name && (
              <View style={styles.patientInfoChip}>
                <View style={styles.patientIconBadge}>
                  <Feather name="user-plus" size={14} color={Colors.success} />
                </View>
                <View>
                  <Text style={styles.patientInfoLabel}>DOCTOR</Text>
                  <Text style={styles.patientInfoValue}>{prescriptionData.doctor_name}</Text>
                </View>
              </View>
            )}
            {prescriptionData.hospital_name && (
              <View style={styles.patientInfoChip}>
                <View style={styles.patientIconBadge}>
                  <MaterialCommunityIcons name="hospital-building" size={14} color={Colors.warning} />
                </View>
                <View>
                  <Text style={styles.patientInfoLabel}>HOSPITAL</Text>
                  <Text style={styles.patientInfoValue}>{prescriptionData.hospital_name}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}


      {/* Diagnosis - Enhanced with source badge */}
      {prescriptionData?.medical_issue_diagnosis && (
        <View style={styles.analysisSection}>
          <View style={styles.criticalHeader}>
            <Feather name="activity" size={18} color={Colors.primary} />
            <Text style={[styles.analysisSectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
              Diagnosis
            </Text>
            {/* Diagnosis Source Badge - NEW */}
            {prescriptionData.diagnosis_source && (
              <View style={[
                styles.diagnosisSourceBadge,
                { backgroundColor: prescriptionData.diagnosis_source === 'explicit' ? Colors.success + '15' : Colors.warning + '15' }
              ]}>
                <Feather
                  name={prescriptionData.diagnosis_source === 'explicit' ? 'check-circle' : 'help-circle'}
                  size={10}
                  color={prescriptionData.diagnosis_source === 'explicit' ? Colors.success : Colors.warning}
                />
                <Text style={[
                  styles.diagnosisSourceText,
                  { color: prescriptionData.diagnosis_source === 'explicit' ? Colors.success : Colors.warning }
                ]}>
                  {prescriptionData.diagnosis_source === 'explicit' ? 'Explicit' : 'AI Inferred'}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.analysisText, { marginTop: 12 }]}>
            {prescriptionData.medical_issue_diagnosis}
          </Text>
        </View>
      )}


      {/* Medications */}
      {prescriptionData?.medicines && prescriptionData.medicines.length > 0 && (
        <View style={styles.analysisSection}>
          {/* Drug Interaction Warning - NEW */}
          {prescriptionData.drug_interactions?.potential_interactions_flag && (
            <View style={styles.drugInteractionWarning}>
              <Feather name="alert-triangle" size={18} color={Colors.error} />
              <Text style={styles.drugInteractionText}>
                {prescriptionData.drug_interactions.interaction_note || 'Potential drug interaction detected'}
              </Text>
            </View>
          )}

          <Text style={styles.analysisSectionTitle}>Medications</Text>
          {prescriptionData.medicines.map((med, index) => {
            // Helper to get form icon
            const getFormIcon = (form?: string | null) => {
              switch (form) {
                case 'Syrup': return '🧴';
                case 'Tablet': return '💊';
                case 'Capsule': return '💊';
                case 'Injection': return '💉';
                case 'Drops': return '💧';
                case 'Cream': return '🧴';
                case 'Inhaler': return '🌬️';
                default: return '💊';
              }
            };

            // Helper to parse time_of_day "1-0-1" format
            const parseTimeOfDay = (timeStr?: string) => {
              if (!timeStr) return { morning: false, afternoon: false, night: false };
              const parts = timeStr.split('-').map(p => p === '1');
              return {
                morning: parts[0] || false,
                afternoon: parts[1] || false,
                night: parts[2] || false,
              };
            };

            // Helper to get meal timing text
            const getMealText = (relation?: string | null) => {
              switch (relation) {
                case 'before_food': return 'Before food';
                case 'after_food': return 'After food';
                case 'with_food': return 'With food';
                case 'empty_stomach': return 'Empty stomach';
                case 'any': return 'Any time';
                default: return null;
              }
            };

            // Helper to get interval text
            const getIntervalText = (days?: number) => {
              switch (days) {
                case 0: return 'As needed';
                case 1: return 'Daily';
                case 2: return 'Alternate days';
                case 7: return 'Weekly';
                default: return days ? `Every ${days} days` : null;
              }
            };

            // Helper for confidence color
            const getConfidenceColor = (conf?: number) => {
              if (!conf) return Colors.gray400;
              if (conf >= 0.9) return Colors.success;
              if (conf >= 0.7) return Colors.warning;
              return Colors.error;
            };

            // Helper for medicine type color
            const getTypeColor = (type?: string) => {
              switch (type?.toLowerCase()) {
                case 'antibiotic': return '#2563EB';
                case 'analgesic': return '#059669';
                case 'antacid/ppi': return '#7C3AED';
                case 'antihistamine': return '#DB2777';
                case 'vitamin/supplement': return '#F59E0B';
                default: return Colors.gray500;
              }
            };

            const timing = parseTimeOfDay(med.timing?.dosage);
            const confidence = med.assumed_enriched_data?.confidence;

            return (
              <View key={index} style={styles.medicationCard}>
                {/* Header: Name + Form + Confidence */}
                <View style={styles.medicationHeader}>
                  <View style={styles.medIconBadge}>
                    <Text style={{ fontSize: 16 }}>{getFormIcon(med.form)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medicationName} numberOfLines={2}>
                      {med.exact_written_name}
                      {med.strength && <Text style={styles.strengthText}> {med.strength}</Text>}
                    </Text>
                  </View>
                  {confidence && (
                    <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(confidence) + '20' }]}>
                      <Text style={[styles.confidenceBadgeText, { color: getConfidenceColor(confidence) }]}>
                        {Math.round(confidence * 100)}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Scientific Name + Type */}
                <View style={styles.medicationSubtitleRow}>
                  {med.assumed_enriched_data?.scientific_name && (
                    <Text style={styles.medicationScientific}>
                      {med.assumed_enriched_data.scientific_name}
                    </Text>
                  )}
                  {med.assumed_enriched_data?.medicine_type && (
                    <View style={[styles.medicineTypeBadge, { backgroundColor: getTypeColor(med.assumed_enriched_data.medicine_type) + '15' }]}>
                      <Text style={[styles.medicineTypeText, { color: getTypeColor(med.assumed_enriched_data.medicine_type) }]}>
                        {med.assumed_enriched_data.medicine_type}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Purpose Banner - NEW */}
                {med.assumed_enriched_data?.medicine_purpose && (
                  <View style={styles.purposeBanner}>
                    <Feather name="target" size={12} color={Colors.primary} />
                    <Text style={styles.purposeText}>{med.assumed_enriched_data.medicine_purpose}</Text>
                  </View>
                )}

                {/* Details Grid */}
                <View style={styles.medicationDetailsGrid}>
                  {/* Dosage */}
                  {med.dosage_instruction && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>DOSAGE</Text>
                      <Text style={styles.detailGridValue}>{med.dosage_instruction}</Text>
                    </View>
                  )}

                  {/* Schedule (Time of Day Visual) - NEW */}
                  {med.timing?.dosage && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>SCHEDULE</Text>
                      <View style={styles.timeDotsContainer}>
                        <View style={[styles.timeDot, timing.morning && styles.timeDotActive]}>
                          <Text style={styles.timeDotIcon}>🌅</Text>
                        </View>
                        <View style={[styles.timeDot, timing.afternoon && styles.timeDotActive]}>
                          <Text style={styles.timeDotIcon}>☀️</Text>
                        </View>
                        <View style={[styles.timeDot, timing.night && styles.timeDotActive]}>
                          <Text style={styles.timeDotIcon}>🌙</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Meal Timing - NEW */}
                  {getMealText(med.timing?.relation_to_meal) && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>MEAL</Text>
                      <Text style={styles.detailGridValue}>{getMealText(med.timing?.relation_to_meal)}</Text>
                    </View>
                  )}

                  {/* Interval - NEW */}
                  {getIntervalText(med.interval_days) && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>FREQUENCY</Text>
                      <Text style={styles.detailGridValue}>{getIntervalText(med.interval_days)}</Text>
                    </View>
                  )}
                </View>

                {/* Duration with Progress - NEW */}
                {med.duration_days && (
                  <View style={styles.durationProgressContainer}>
                    <View style={styles.durationProgressHeader}>
                      <Feather name="calendar" size={12} color={Colors.textSecondary} />
                      <Text style={styles.durationText}>{med.duration_days} days</Text>
                    </View>
                    <View style={styles.durationProgressBar}>
                      <View style={[styles.durationProgressFill, { width: '100%' }]} />
                    </View>
                  </View>
                )}

                {/* Legacy fallbacks */}
                {!med.timing?.dosage && med.frequency && (
                  <View style={styles.medicationDetailRow}>
                    <Feather name="clock" size={12} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.medicationDetail}>{med.frequency}</Text>
                  </View>
                )}
                {!med.duration_days && med.duration && (
                  <View style={styles.medicationDetailRow}>
                    <Feather name="calendar" size={12} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.medicationDetail}>{med.duration}</Text>
                  </View>
                )}
                {med.special_instructions && (
                  <View style={styles.medicationDetailRow}>
                    <Feather name="info" size={12} color={Colors.warning} style={{ marginRight: 6 }} />
                    <Text style={[styles.medicationDetail, { color: Colors.warning }]}>{med.special_instructions}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Advised Tests */}
      {prescriptionData?.recommended_tests && prescriptionData.recommended_tests.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Advised Tests</Text>
          <GroupedTestsCard
            tests={prescriptionData.recommended_tests}
          />
        </View>
      )}

      {/* Follow-up Section - NEW */}
      {prescriptionData?.follow_up?.follow_up_date && (
        <View style={styles.followUpSection}>
          <Feather name="calendar" size={20} color={Colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.followUpText}>
              Follow-up: {new Date(prescriptionData.follow_up.follow_up_date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            {prescriptionData.follow_up.follow_up_notes && (
              <Text style={styles.followUpNotes}>{prescriptionData.follow_up.follow_up_notes}</Text>
            )}
          </View>
        </View>
      )}

      {/* Other Information Section - NEW */}
      {prescriptionData?.other_information && prescriptionData.other_information.length > 0 && (
        <View style={styles.otherInfoSection}>
          <Text style={styles.analysisSectionTitle}>Other Information</Text>
          <View style={styles.otherInfoChipsContainer}>
            {prescriptionData.other_information.map((info, index) => {
              // Get category icon
              const getCategoryIcon = (category: string) => {
                switch (category) {
                  case 'Vitals': return '⚖️';
                  case 'Lifestyle': return '🏃';
                  case 'Diet': return '🥗';
                  case 'Allergy': return '⚠️';
                  case 'Notes': return '📝';
                  default: return '📋';
                }
              };

              return (
                <View key={index} style={styles.otherInfoChip}>
                  <Text style={{ fontSize: 14 }}>{getCategoryIcon(info.category)}</Text>
                  <View>
                    <Text style={styles.otherInfoCategory}>{info.category}</Text>
                    <Text style={styles.otherInfoChipText}>{info.value}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Lab Results (from report_data) */}
      {reportData?.grouped_metrics && reportData.grouped_metrics.length > 0 && (
        <View style={styles.analysisSection}>
          {reportData.lab_name && (
            <Text style={styles.labName}>{reportData.lab_name}</Text>
          )}
          <View style={styles.labResultsHeader}>
            <Text style={styles.analysisSectionTitle}>Lab Results</Text>
            <TouchableOpacity
              style={[
                styles.viewLabAnalysisButton,
                !labReportId && styles.viewLabAnalysisButtonDisabled,
              ]}
              onPress={() => {
                if (labReportId) {
                  navigation.navigate('LabReportDetail', { labReportId });
                } else {
                  Alert.alert(
                    'Lab Analysis Not Available',
                    'Interactive lab report data is being processed. Please check back in a moment.',
                    [{ text: 'OK' }]
                  );
                }
              }}
              activeOpacity={0.7}
              disabled={!labReportId}
            >
              <Feather name="trending-up" size={16} color={Colors.white} />
              <Text style={styles.viewLabAnalysisButtonText}>View Lab Analysis</Text>
            </TouchableOpacity>
          </View>
          {reportData.grouped_metrics.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.labGroup}>
              <Text style={styles.labGroupName}>{group.group_name}</Text>
              {group.metrics.map((metric, metricIndex) => (
                <View key={metricIndex} style={styles.labMetricItem}>
                  <View style={styles.labMetricHeader}>
                    <Text style={styles.labMetricName}>{metric.metric_name}</Text>
                    {metric.status && metric.status !== 'normal' && (
                      <View style={[
                        styles.metricStatusBadge,
                        metric.status === 'critical' && styles.metricStatusCritical,
                        metric.status === 'high' && styles.metricStatusHigh,
                        metric.status === 'low' && styles.metricStatusLow,
                      ]}>
                        <Text style={styles.metricStatusText}>
                          {metric.status.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.labMetricValue}>
                    {metric.value} {metric.unit || ''}
                  </Text>
                  {metric.reference_range && (
                    <Text style={styles.labMetricReference}>
                      Ref: {metric.reference_range}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Confidence Score */}
      {analysisMetadata?.confidence_score && (
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>Analysis Confidence</Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${analysisMetadata.confidence_score * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.confidenceValue}>
            {Math.round(analysisMetadata.confidence_score * 100)}%
          </Text>
        </View>
      )}

      {/* Raw Text Fallback */}
      {result.rawText && !summary && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Analysis</Text>
          <Text style={styles.analysisText}>{result.rawText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  analysisContent: {
    gap: Sizes.md,
  },
  analysisSection: {
    paddingVertical: Sizes.xs,
  },
  analysisSectionTitle: {
    fontSize: 16, // Unified section titles for symmetry
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Sizes.xs,
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  analysisGrid: {
    flexDirection: 'row',
    gap: Sizes.md,
  },
  analysisGridItem: {
    flex: 1,
  },
  analysisLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  analysisValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  criticalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    marginBottom: Sizes.xs,
  },
  // Diagnosis Source Badge
  diagnosisSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  diagnosisSourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Drug Interaction Warning
  drugInteractionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  drugInteractionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
  },
  // Medication Card Styles
  medicationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12, // MD3: Reduced from 16 for tighter layout
    marginBottom: 8, // MD3: 8dp between cards
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  medIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.gray500,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  medicationSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 40,
    marginBottom: 8,
  },
  medicationScientific: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  medicineTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  medicineTypeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  purposeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '10',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 40,
    marginBottom: 12,
    gap: 6,
  },
  purposeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  medicationDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 40, // Indent to align with name
    gap: 16,
    marginBottom: 12,
  },
  detailGridItem: {
    minWidth: '40%',
    marginBottom: 4,
  },
  detailGridLabel: {
    fontSize: 11,
    color: Colors.gray400,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailGridValue: {
    fontSize: 13,
    color: Colors.gray700,
    fontWeight: '600',
  },
  timeDotsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  timeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  timeDotActive: {
    backgroundColor: Colors.primaryLight + '20',
    opacity: 1,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  timeDotIcon: {
    fontSize: 12,
  },
  durationProgressContainer: {
    marginLeft: 40,
    marginTop: 4,
  },
  durationProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 12,
    color: Colors.gray500,
    fontWeight: '500',
    marginLeft: 6,
  },
  durationProgressBar: {
    height: 4,
    backgroundColor: Colors.gray100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  durationProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  medicationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingLeft: Sizes.sm,
  },
  // Follow Up
  followUpSection: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.info + '10', // Light blue bg
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  followUpText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray800,
    marginBottom: 4,
  },
  followUpNotes: {
    fontSize: 13,
    color: Colors.gray600,
    lineHeight: 18,
  },
  // Other Info
  otherInfoSection: {
    paddingVertical: Sizes.xs,
  },
  otherInfoChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  otherInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.gray100,
    minWidth: '45%',
    flex: 1,
  },
  otherInfoCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  otherInfoChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  // Lab Results
  labName: {
    fontSize: 14,
    color: Colors.gray500,
    fontWeight: '500',
    marginBottom: 8,
  },
  labResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewLabAnalysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.sm,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  viewLabAnalysisButtonDisabled: {
    backgroundColor: Colors.gray300,
  },
  viewLabAnalysisButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  labGroup: {
    marginBottom: 16,
  },
  labGroupName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray700,
    marginBottom: 8,
    backgroundColor: Colors.gray50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  labMetricItem: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  labMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  labMetricName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  metricStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.gray100,
  },
  metricStatusCritical: {
    backgroundColor: Colors.errorLight,
  },
  metricStatusHigh: {
    backgroundColor: '#FEF3C7', // Amber 100
  },
  metricStatusLow: {
    backgroundColor: '#DBEAFE', // Blue 100
  },
  metricStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gray700,
  },
  labMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  labMetricReference: {
    fontSize: 12,
    color: Colors.gray500,
  },
  // Confidence
  confidenceContainer: {
    marginTop: Sizes.md,
    paddingTop: Sizes.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.md,
  },
  confidenceLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  confidenceBar: {
    width: 60,
    height: 4,
    backgroundColor: Colors.gray100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Colors.success,
  },
  confidenceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },
  // Patient Info
  patientInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // MD3 standard: 8dp between cards
  },
  patientInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Reduced from 12
    paddingHorizontal: 0,
    gap: 8, // MD3 standard: 8dp internal spacing
    minWidth: '45%',
    flex: 1,
  },
  patientIconBadge: {
    width: 32, // Reduced from 36
    height: 32, // Reduced from 36
    borderRadius: 8, // Smaller radius
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfoLabel: {
    fontSize: 11, // MD3/iOS minimum for accessibility
    color: Colors.gray500,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patientInfoValue: {
    fontSize: 13, // Reduced from 14 for better fit
    color: Colors.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 18, // Better readability and prevents overflow
  },
});
