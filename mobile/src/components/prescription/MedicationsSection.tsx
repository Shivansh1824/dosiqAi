import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Medications</Text>
                <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{visibleMedicationsCount}</Text>
                </View>
            </View>
            <Text style={styles.cardSubtitle}>
                Review and add medications to your tracker
            </Text>

            {/* Medication Verification Cards */}
            {medicines
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
                            <View key={index}>
                                <View style={styles.verifiedBanner}>
                                    <Feather name="check-circle" size={16} color={Colors.success} />
                                    <Text style={styles.verifiedText}>Added to tracker</Text>
                                </View>
                                {!isLastItem && <View style={styles.medicationDivider} />}
                            </View>
                        );
                    }

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
                            />
                            {!isLastItem && <View style={styles.medicationDivider} />}
                        </View>
                    );
                })}

            {/* Single Verify & Add All Button at the end */}
            {hasUnverifiedMedications && (
                <TouchableOpacity
                    style={[styles.verifyAllButton, isVerifyingAll && styles.verifyAllButtonDisabled]}
                    onPress={handleVerifyAll}
                    disabled={isVerifyingAll}
                    activeOpacity={0.7}
                >
                    {isVerifyingAll ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                        <>
                            <Feather name="check" size={18} color={Colors.white} />
                            <Text style={styles.verifyAllButtonText}>
                                Verify & Add {unverifiedCount > 1 ? `All (${unverifiedCount})` : ''}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Sizes.md,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 4,
        letterSpacing: -0.5,
    },
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
    cardSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 12,
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
        marginHorizontal: 16,
    },
    verifyAllButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
        marginTop: 16,
        marginHorizontal: 4,
    },
    verifyAllButtonText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.3,
    },
    verifyAllButtonDisabled: {
        backgroundColor: Colors.gray300,
    },
});

