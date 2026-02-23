import { StyleSheet, Platform } from 'react-native';
import { Colors, Sizes, Typography } from '../constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  verifiedHeaderText: {
    ...Typography.styles.body,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: Colors.white,
    marginLeft: 8,
    fontSize: 14,
  },
  verifiedHeaderBanner: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.04,
    // shadowRadius: 8,
    // elevation: 2,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonRight: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
    textAlign: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Hero Preview Card (2026 Style)
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 4,
    marginHorizontal: 16,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.gray50,
  },

  pdfIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfPreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pdfPreviewSubtitle: {
    fontSize: 14,
    color: Colors.gray500,
  },
  // PDF Preview styles
  pdfPreviewWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  pdfPreview: {
    flex: 1,
    width: '100%',
    height: 220,
    backgroundColor: Colors.white,
  },
  // New professional PDF preview card styles
  pdfPreviewCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  pdfPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pdfIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  pdfPreviewInfo: {
    flex: 1,
  },
  pdfPreviewType: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pdfPreviewHint: {
    fontSize: 14,
    color: Colors.gray500,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  heroBadgeContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 10,
  },
  pageCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageCountText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
  },
  zoomHintContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', // Dark blur
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButtonContainer: {
    padding: 18,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  previewIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 40, // Super soft
    backgroundColor: '#F0F9FF', // Lightest Blue
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  previewText: {
    fontSize: 16,
    color: Colors.gray500,
    marginBottom: 24,
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    gap: 8,
    width: '100%', // Full width button
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // 2026 Floating Action Buttons - Compact Pill Design
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  compactActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 100,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  pillAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  pillActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pillDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#94A3B8', // Increased visibility (Slate-400 equivalent)
    marginHorizontal: 4,
  },

  // Retain actionCard styles for potential reuse or legacy components if any
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 44,
  },
  actionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
    letterSpacing: 0.1,
  },




  // Medications Header Card (styled like AI Summary)
  medicationsHeaderCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  medicationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 16, // Add padding inside the container
    paddingVertical: 12,   // Add vertical padding
    backgroundColor: Colors.white, // Explicit white background
    borderRadius: 16,      // Rounded corners
    borderWidth: 1,
    borderColor: Colors.gray200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 16, // Add margin to float it
  },
  medicationsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  medicationsCountText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#000000',
    includeFontPadding: false,
    lineHeight: 64, // Adjusted for larger font
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -2,
    paddingHorizontal: 8,
  },
  medicationsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
  },
  medicationsHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    ...Typography.fontWeights.medium,
    marginTop: 2,
    lineHeight: 18,
    letterSpacing: 0.1,
  },

  // Cards
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  medicationsCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 0,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16, // MD3: Reduced from 20
    marginBottom: 20,
    // Flat design - removed shadow, elevation, border
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  viewMedicalReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.sm,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  viewMedicalReportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },

  // Details
  detailsGrid: {
    gap: Sizes.md,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
  },
  detailLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 12,
    gap: Sizes.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.sm,
  },
  tag: {
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 20,
  },
  tagBlue: {
    backgroundColor: '#EFF6FF',
  },
  tagGreen: {
    backgroundColor: '#ECFDF5',
  },
  tagPurple: {
    backgroundColor: '#F5F3FF',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagTextBlue: {
    color: '#3B82F6',
  },
  tagTextGreen: {
    color: '#10B981',
  },
  tagTextPurple: {
    color: '#7C3AED',
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 12,
    padding: Sizes.md,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 120,
    lineHeight: 22,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: Sizes.lg,
    gap: Sizes.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray200,
    backgroundColor: Colors.white,
    gap: Sizes.xs,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray700,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.md,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    gap: Sizes.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  // Image Preview
  previewImage: {
    width: '100%',
    height: 200, // Reduced from 250 (20% reduction for more vertical space)
    borderRadius: 12,
    marginBottom: Sizes.md,
  },

  // Error State
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Sizes.sm,
  },

  // Disabled States
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonTextDisabled: {
    color: Colors.gray400,
  },

  // Analysis Card
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  statusBadgeSuccess: {
    backgroundColor: Colors.successLight,
  },
  statusBadgeProcessing: {
    backgroundColor: Colors.primaryLight + '20',
  },
  statusBadgeError: {
    backgroundColor: Colors.errorLight,
  },
  statusTextSuccess: {
    color: Colors.success,
  },
  statusTextProcessing: {
    color: Colors.primary,
  },
  statusTextError: {
    color: Colors.error,
  },
  progressContainer: {
    marginBottom: Sizes.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Sizes.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
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
  criticalTitle: {
    color: Colors.error,
    marginBottom: 0,
  },
  criticalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Sizes.xs,
    paddingLeft: Sizes.sm,
    gap: Sizes.sm,
  },
  criticalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
    marginTop: Sizes.sm,
  },
  criticalText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
    gap: Sizes.sm,
  },
  medicationText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  vitalSignsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.sm,
  },
  vitalSignItem: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 8,
    minWidth: '45%',
  },
  vitalSignLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  vitalSignValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  labResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  labResultName: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  labResultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  diagnosisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
    gap: Sizes.sm,
  },
  diagnosisText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.lg,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Sizes.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.sm,
    gap: Sizes.xs,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.xl,
  },
  pendingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Sizes.sm,
  },

  // New Analysis Display Styles - Modern Grid (MD3 8dp spacing)
  patientInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // MD3 standard: 8dp between cards
  },
  patientInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    // Removed: backgroundColor, borderWidth, borderColor, shadow*, elevation
    paddingVertical: 10, // Reduced from 12
    paddingHorizontal: 0, // Removed horizontal padding since no box
    // borderRadius irrelevant without background
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
  // Legacy row support (removed but keeping placeholder if needed)
  patientInfoRow: {
    display: 'none',
  },

  // Medication Card Styles
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
  medicationScientific: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: Sizes.lg,
    marginBottom: Sizes.sm,
  },
  medicationDetails: {
    marginTop: Sizes.xs,
    gap: Sizes.xs,
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

  // NEW: Drug Interaction Warning
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

  // NEW: Strength Text
  strengthText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.gray500,
  },

  // NEW: Confidence Badge
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // NEW: Medication Subtitle Row
  medicationSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 40,
    marginBottom: 8,
  },

  // NEW: Medicine Type Badge
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

  // NEW: Purpose Banner
  purposeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '08',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  purposeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },

  // NEW: Details Grid
  medicationDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  detailGridItem: {
    minWidth: 70,
    padding: 8,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
  },
  detailGridLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  detailGridValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  // NEW: Time Dots Container
  timeDotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  timeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.4,
  },
  timeDotActive: {
    backgroundColor: Colors.primary + '20',
    opacity: 1,
  },
  timeDotIcon: {
    fontSize: 12,
  },

  // NEW: Duration Progress
  durationProgressContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  durationProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  durationText: {
    fontSize: 12,
    color: Colors.textSecondary,
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

  // NEW: Other Information Section
  otherInfoSection: {
    marginTop: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  otherInfoChipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  otherInfoCategory: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // NEW: Follow-up Section
  followUpSection: {
    backgroundColor: Colors.info + '10',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  followUpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.info,
    fontWeight: '500',
  },
  followUpNotes: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // NEW: Diagnosis Source Badge
  diagnosisSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    gap: 4,
  },
  diagnosisSourceText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // NEW: Handwriting Badge
  handwritingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  handwritingText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '500',
  },

  testItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Sizes.sm,
    paddingVertical: Sizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  testContent: {
    flex: 1,
  },
  testName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  testReason: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Sizes.xs,
  },

  // Lab Results Styles
  labName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Sizes.xs,
  },
  labResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.xs,
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
  viewLabAnalysisButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  viewLabAnalysisButtonDisabled: {
    backgroundColor: Colors.gray400,
    opacity: 0.6,
  },
  labGroup: {
    marginTop: Sizes.sm,
  },
  labGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Sizes.xs,
    paddingBottom: Sizes.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '30',
  },
  labMetricItem: {
    paddingVertical: Sizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  labMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labMetricName: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  labMetricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  labMetricReference: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Sizes.xs,
  },
  metricStatusBadge: {
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 4,
    marginLeft: Sizes.sm,
  },
  metricStatusCritical: {
    backgroundColor: Colors.errorLight,
  },
  metricStatusHigh: {
    backgroundColor: '#FEF3C7',
  },
  metricStatusLow: {
    backgroundColor: '#DBEAFE',
  },
  metricStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.error,
  },

  // Confidence Meter Styles
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
    paddingTop: Sizes.md,
    marginTop: Sizes.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  confidenceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.gray100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    minWidth: 35,
    textAlign: 'right',
  },

  // Medications Section Styles
  cardBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 12,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  medicationsContainer: {
    gap: Sizes.md,
    paddingHorizontal: Sizes.md,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    backgroundColor: Colors.successLight,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 12,
    marginBottom: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  medicationDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 0,
    marginHorizontal: 0,
  },

  // Dismissed Medication Banner Styles
  dismissedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray50,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm + 4,
    borderRadius: 12,
    marginBottom: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  dismissedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Sizes.sm,
  },
  serialNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    marginRight: 6,
  },
  serialNumberDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
  },
  dismissedSerialNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.gray300,
    letterSpacing: -0.5,
    marginRight: 6,
  },
  dismissedSerialNumberDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginRight: 8,
  },
  dismissedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissedTextContainer: {
    flex: 1,
  },
  dismissedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    marginBottom: 2,
  },
  dismissedMedicineName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray500,
    flexShrink: 1,
  },
  dismissedSubtext: {
    fontSize: 12,
    color: Colors.gray400,
  },
  restoreButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Error UI styles (errorContainer and errorMessage already defined above)
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Sizes.md,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Sizes.xl,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    gap: Sizes.sm,
    marginTop: Sizes.md,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },



  // AI Summary Card Styles
  aiSummaryCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 16,
    marginBottom: 0,
    padding: 16,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  aiSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  aiSummaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.gray700,
    fontWeight: '400',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    marginTop: Sizes.md,
    alignSelf: 'flex-start',
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  verifyAllButton: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  verifyAllGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
    borderRadius: 16,
  },
  verifyAllButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  verifyAllButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonContainer: {
    padding: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    width: '100%',
  },
  buttonShadow: {
    borderRadius: 16,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
    backgroundColor: 'transparent',
  },

  // Verification Prompt
  verificationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
  },
  verificationPromptText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  // Add Manually Button
  addManuallyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
    backgroundColor: Colors.primary + '05',
  },
  addManuallyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: -0.2,
  },
});

