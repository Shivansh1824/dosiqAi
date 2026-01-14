import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // Added LinearGradient import
import { Colors, Sizes } from '../../constants';
import { MedicineInfo } from '../../types/document';
import { ParsedMedication } from '../../types/medicationVerification';
import { Medication } from '../../types/medication';
import MedicationVerificationCard from '../MedicationVerificationCard';
import { parseAIMedication, detectDuplicateMedication } from '../../utils/medicationParser';

interface MedicationsSectionProps {
    medicines: MedicineInfo[];
    documentId: string;
    documentTitle: string;
    documentCreatedAt: string;
    dismissedMedicationIds: Set<string>;
    verifiedMedications: Set<string>;
    activeMedications: Medication[];
    onVerifyAndAdd: (medication: ParsedMedication, startDate: string) => Promise<void>;
    onDismiss: (index: number) => void;
}

/**
 * MedicationsSection - Container for medication verification cards
 * Extracted from DocumentDetailScreen.tsx
 */
export function MedicationsSection({
    medicines,
    documentId,
    documentTitle,
    documentCreatedAt,
    dismissedMedicationIds,
    verifiedMedications,
    activeMedications,
    onVerifyAndAdd,
    onDismiss,
}: MedicationsSectionProps) {
    const visibleMedicationsCount = medicines.length - dismissedMedicationIds.size;
    const [isVerifyingAll, setIsVerifyingAll] = useState(false);

    // Get all unverified medications for the "Verify & Add All" action
    const getUnverifiedMedications = () => {
        return medicines
            .map((medicine, index) => ({ medicine, index }))
            .filter(({ index }) => {
                const dismissId = `${documentId}_${index}`;
                return !dismissedMedicationIds.has(dismissId);
            })
            .filter(({ medicine }) => {
                const parsedMed = parseAIMedication(medicine, documentId, documentTitle);
                return !verifiedMedications.has(parsedMed.name);
            })
            .map(({ medicine }) => parseAIMedication(medicine, documentId, documentTitle));
    };

    // Handle verify all medications
    const handleVerifyAll = async () => {
        const unverifiedMeds = getUnverifiedMedications();
        if (unverifiedMeds.length === 0) return;

        setIsVerifyingAll(true);
        try {
            const suggestedStartDate = documentCreatedAt.split('T')[0];
            for (const medication of unverifiedMeds) {
                const finalMedication = {
                    ...medication,
                    verified_by_user: true,
                };
                await onVerifyAndAdd(finalMedication, suggestedStartDate);
            }
        } catch (error) {
            console.error('[MedicationsSection] Error adding medications:', error);
        } finally {
            setIsVerifyingAll(false);
        }
    };

    const unverifiedCount = getUnverifiedMedications().length;
    const hasUnverifiedMedications = unverifiedCount > 0;

    return (
        <View style={styles.card}>
            <LinearGradient
                colors={['rgba(59, 130, 246, 0.05)', 'rgba(59, 130, 246, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.cardHeader}
            >
                <View style={styles.titleColumn}>
                    <Text style={styles.cardTitle}>MEDS DETECTED</Text>
                    <Text style={styles.cardSubtitle}>
                        {medicines.length} {medicines.length === 1 ? 'medication is' : 'medications are'} identified from your prescription
                    </Text>
                </View>
                <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{visibleMedicationsCount}</Text>
                </View>
            </LinearGradient>

            {/* Medication Verification Cards */}
            {(() => {
                let unverifiedCardIndex = 0; // Track unverified cards separately
                return medicines
                    .map((medicine, index) => ({ medicine, index }))
                    .filter(({ index }) => {
                        const dismissId = `${documentId}_${index}`;
                        return !dismissedMedicationIds.has(dismissId);
                    })
                    .map(({ medicine, index }, arrayIndex, filteredArray) => {
                        const parsedMed = parseAIMedication(medicine, documentId, documentTitle);
                        const suggestedStartDate = documentCreatedAt.split('T')[0];
                        const duplicateOf = detectDuplicateMedication(
                            parsedMed.name,
                            parsedMed.dosage,
                            activeMedications
                        );
                        const isVerified = verifiedMedications.has(parsedMed.name);
                        const isLastItem = arrayIndex === filteredArray.length - 1;

                        if (isVerified) {
                            return (
                                <View key={index} style={{ marginHorizontal: 16 }}>
                                    <View style={styles.verifiedBanner}>
                                        <Feather name="check-circle" size={16} color={Colors.success} />
                                        <Text style={styles.verifiedText}>Added to tracker</Text>
                                    </View>
                                    {!isLastItem && <View style={styles.medicationDivider} />}
                                </View>
                            );
                        }

                        // This is an unverified card - check if it's the first one
                        const isFirstUnverifiedCard = unverifiedCardIndex === 0;
                        unverifiedCardIndex++; // Increment for next unverified card

                        return (
                            <View key={index}>
                                <MedicationVerificationCard
                                    medication={parsedMed}
                                    documentId={documentId}
                                    documentTitle={documentTitle}
                                    suggestedStartDate={suggestedStartDate}
                                    onVerifyAndAdd={onVerifyAndAdd}
                                    duplicateOf={duplicateOf || undefined}
                                    medicineIndex={index}
                                    onDismiss={() => onDismiss(index)}
                                    isFirstItem={isFirstUnverifiedCard}
                                />
                                {!isLastItem && <View style={[styles.medicationDivider, { marginHorizontal: 16 }]} />}
                            </View>
                        );
                    });
            })()}

            {/* Single Verify & Add All Button at the end */}
            {hasUnverifiedMedications && (
                <TouchableOpacity
                    style={[styles.verifyAllButton, isVerifyingAll && styles.verifyAllButtonDisabled]}
                    onPress={handleVerifyAll}
                    disabled={isVerifyingAll}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#4F46E5', '#3B82F6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.verifyAllGradient}
                    >
                        {isVerifyingAll ? (
                            <ActivityIndicator color={Colors.white} size="small" />
                        ) : (
                            <>
                                <Feather name="check-circle" size={18} color={Colors.white} />
                                <Text style={styles.verifyAllButtonText}>
                                    Confirm & Add {unverifiedCount > 1 ? `All (${unverifiedCount})` : ''}
                                </Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        paddingTop: 0,
        paddingBottom: 0,
        paddingHorizontal: 0,
        marginBottom: 0,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderRadius: 0,
        marginBottom: 0,
    },
    titleColumn: {
        flex: 1,
        gap: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.gray900,
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    cardBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        minWidth: 34,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    cardBadgeText: {
        fontSize: 13,
        fontWeight: '900',
        color: Colors.white,
    },
    cardSubtitle: {
        fontSize: 12,
        color: Colors.gray500,
        fontWeight: '500',
        lineHeight: 16,
        opacity: 0.8,
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
    verifyAllButton: {
        width: 300,
        alignSelf: 'center',
        marginTop: 24,
        marginBottom: 16,
        borderRadius: 16,
        // Shadow for iOS
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        // Elevation for Android
        elevation: 4,
        overflow: 'hidden',
    },
    verifyAllGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    verifyAllButtonText: {
        color: Colors.white,
        fontWeight: '800',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    verifyAllButtonDisabled: {
        opacity: 0.6,
    },
});
