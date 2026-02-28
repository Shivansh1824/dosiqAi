import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
    // ─── Layout ──────────────────────────────────────────────────────────────────
    container: {
        flex: 1,
        backgroundColor: Colors.bgSecondary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 70,
        gap: 12,
    },

    // ─── Header ──────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: Colors.bgPrimary,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-SemiBold',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Regular',
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 2,
    },
    headerButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.gray100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonRight: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.gray100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Legacy alias used in error state
    backButton: {
        padding: 4,
    },

    // ─── Verified Header Banner ───────────────────────────────────────────────────
    verifiedHeaderBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.success,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    verifiedHeaderText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-SemiBold',
        color: Colors.white,
    },

    // ─── Error State ──────────────────────────────────────────────────────────────
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 16,
    },
    errorTitle: {
        fontSize: 20,
        fontFamily: 'PlusJakartaSans-Bold',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    errorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    errorButtonText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-SemiBold',
        color: Colors.white,
    },

    // ─── Document Preview Card ────────────────────────────────────────────────────
    previewCard: {
        backgroundColor: Colors.bgPrimary,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    previewIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    previewText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-SemiBold',
        color: Colors.textPrimary,
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingBottom: 4,
    },
    errorText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
    },

    // ─── Hero Image ───────────────────────────────────────────────────────────────
    heroImage: {
        width: '100%',
        height: 220,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.04)',
    },

    // ─── PDF Preview ──────────────────────────────────────────────────────────────
    pdfPreviewWrapper: {
        width: '100%',
        height: 220,
        backgroundColor: Colors.gray100,
    },
    pdfPreview: {
        width: '100%',
        height: 220,
        backgroundColor: Colors.gray100,
    },

    // ─── Floating Action Pill ─────────────────────────────────────────────────────
    floatingButtonContainer: {
        position: 'absolute',
        bottom: 12,
        right: 12,
    },
    compactActionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 24,
        paddingHorizontal: 4,
        paddingVertical: 4,
        gap: 2,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pillAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    pillActionText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-SemiBold',
        color: Colors.primary,
    },
    pillDivider: {
        width: 1,
        height: 20,
        backgroundColor: Colors.border,
    },

    // ─── Verification Prompt ──────────────────────────────────────────────────────
    verificationPrompt: {
        backgroundColor: Colors.warningLight + '33',
        borderLeftWidth: 3,
        borderLeftColor: Colors.warning,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    verificationPromptText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Medium',
        color: Colors.warningDark,
        lineHeight: 20,
    },

    // ─── Medications Header Card ──────────────────────────────────────────────────
    medicationsHeaderCard: {
        backgroundColor: Colors.bgPrimary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    medicationsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    medicationsHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    medicationsCountText: {
        fontSize: 55,
        fontFamily: 'PlusJakartaSans-Bold',
        color: Colors.primary,
        minWidth: 42,
    },
    medicationsHeaderTitle: {
        fontSize: 17,
        fontFamily: 'PlusJakartaSans-Bold',
        color: Colors.textPrimary,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    medicationsHeaderSubtitle: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: Colors.textSecondary,
        lineHeight: 18,
    },

    // ─── Add Manually Button ──────────────────────────────────────────────────────
    addManuallyButtonContainer: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    addManuallyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Colors.white,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: Colors.borderDark,
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    addManuallyButtonText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-SemiBold',
        color: Colors.textSecondary,
    },

    // ─── Verify All Button ────────────────────────────────────────────────────────
    verifyAllButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    verifyAllButtonDisabled: {
        opacity: 0.6,
    },
    verifyAllGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    verifyAllButtonText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold',
        color: Colors.white,
    },

    // ─── General Card ─────────────────────────────────────────────────────────────
    card: {
        backgroundColor: Colors.bgPrimary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Bold',
        color: Colors.textPrimary,
    },
    cardSubtitle: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: 12,
    },
});
