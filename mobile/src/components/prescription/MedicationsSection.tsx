import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // Added LinearGradient import
import { Colors, Sizes, Typography } from '../../constants';
import { MedicineInfo } from '../../types/document';
import { ParsedMedication } from '../../types/medicationVerification';
import { Medication } from '../../types/medication';
import MedicationVerificationCard from '../MedicationVerificationCard';
import { VerifiedMedicationsGroup } from './VerifiedMedicationsGroup';
import { parseAIMedication, detectDuplicateMedication } from '../../utils/medicationParser';

import { Alert } from 'react-native';
import { useMedicationsStore } from '../../store/medicationsStore';
import { supabase } from '../../services/supabaseClient';

interface MedicationsSectionProps {
    medicines: MedicineInfo[];
    documentId: string;
    documentTitle: string;
    documentCreatedAt: string;
    dismissedMedicationIds: Set<string>;
    verifiedMedications: Set<string>;
    activeMedications: Medication[];
    userId: string;
    familyMemberId: string;
    onVerifyAndAdd: (medication: ParsedMedication, startDate: string) => Promise<void>;
    onDismiss: (index: number) => void;
    onRestore: (index: number) => void;
}

/**
 * MedicationsSection - Container for medication verification cards
 * Extracted from PrescriptionSummaryScreen.tsx
 */
export function MedicationsSection({
    medicines,
    documentId,
    documentTitle,
    documentCreatedAt,
    dismissedMedicationIds,
    verifiedMedications,
    activeMedications,
    userId,
    familyMemberId,
    onVerifyAndAdd,
    onDismiss,
    onRestore,
}: MedicationsSectionProps) {
    const visibleMedicationsCount = medicines.length - Array.from(dismissedMedicationIds).filter(id => id.startsWith(`${documentId}_`)).length;
    const [isVerifyingAll, setIsVerifyingAll] = useState(false);

    // Get all unverified medications for the "Verify & Add All" action
    const getUnverifiedMedications = () => {
        return medicines
            .map((medicine, index) => ({ medicine, index }))
            .filter(({ index }) => {
                const dismissId = `${documentId}_${index}`;
                const isDismissed = dismissedMedicationIds.has(dismissId);
                const parsedMed = parseAIMedication(medicines[index], documentId, documentTitle);
                const isVerified = verifiedMedications.has(parsedMed.name);
                
                // Only include in "Verify All" if it's NOT verified AND NOT dismissed
                return !isVerified && !isDismissed;
            })
            .map(({ medicine }) => parseAIMedication(medicine, documentId, documentTitle));
    };

    const { addMedicationsBatchFromAI, fetchMedications } = useMedicationsStore();

    // Handle verify all medications
    const handleVerifyAll = async () => {
        const unverifiedMeds = getUnverifiedMedications();
        if (unverifiedMeds.length === 0) return;

        setIsVerifyingAll(true);
        try {
            const suggestedStartDate = documentCreatedAt.split('T')[0];
            
            // Use batch addition for better performance and single alert
            await addMedicationsBatchFromAI(
                unverifiedMeds,
                userId,
                documentId,
                documentTitle,
                suggestedStartDate,
                familyMemberId
            );

            // Fetch to sync local state
            await fetchMedications(userId, true);

            Alert.alert(
                'Success',
                `${unverifiedMeds.length} medication${unverifiedMeds.length > 1 ? 's' : ''} added to tracker!`,
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('[MedicationsSection] Error adding medications:', error);
            Alert.alert('Error', 'Failed to add some medications. Please try again.');
        } finally {
            setIsVerifyingAll(false);
        }
    };

    const unverifiedCount = getUnverifiedMedications().length;
    const hasUnverifiedMedications = unverifiedCount > 0;
    const allVerified = medicines.length > 0 && unverifiedCount === 0 && dismissedMedicationIds.size < medicines.length;

    return (
        <View style={allVerified ? styles.cardAllVerified : styles.card}>
            {!allVerified && (
                <View style={styles.cardHeader}>
                    <View style={styles.titleColumn}>
                        <Text style={styles.cardTitle}>MEDS DETECTED</Text>
                        <Text style={styles.cardSubtitle}>
                            {medicines.length} {medicines.length === 1 ? 'medication is' : 'medications are'} identified from your prescription
                        </Text>
                    </View>
                    <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>{visibleMedicationsCount}</Text>
                    </View>
                </View>
            )}

            {/* Verified Medications Group */}
            {(() => {
                const verifiedMedNames = medicines
                    .map(medicine => parseAIMedication(medicine, documentId, documentTitle))
                    .filter(med => verifiedMedications.has(med.name))
                    .map(med => med.name);
                
                return <VerifiedMedicationsGroup medicationNames={verifiedMedNames} />;
            })()}

            {/* Unverified Medication Verification Cards */}
            {(() => {
                let unverifiedCardIndex = 0;
                return medicines
                    .map((medicine, index) => ({ medicine, index }))
                    .filter(({ medicine }) => {
                        const parsedMed = parseAIMedication(medicine, documentId, documentTitle);
                        return !verifiedMedications.has(parsedMed.name);
                    })
                    .map(({ medicine, index }, arrayIndex, filteredArray) => {
                        const parsedMed = parseAIMedication(medicine, documentId, documentTitle);
                        const suggestedStartDate = documentCreatedAt.split('T')[0];
                        const isLastItem = arrayIndex === filteredArray.length - 1;

                        const duplicateOf = detectDuplicateMedication(
                            parsedMed.name,
                            parsedMed.dosage,
                            activeMedications
                        );

                        const isFirstUnverifiedCard = unverifiedCardIndex === 0;
                        unverifiedCardIndex++;

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
                                    onRestore={() => onRestore(index)}
                                    isDismissed={dismissedMedicationIds.has(`${documentId}_${index}`)}
                                    isFirstItem={isFirstUnverifiedCard}
                                    isVerified={false}
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
    cardAllVerified: {
        backgroundColor: Colors.white,
        paddingTop: 16, // Add some top padding when header is gone
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
        backgroundColor: 'transparent',
    },
    titleColumn: {
        flex: 1,
        gap: 2,
    },
    cardTitle: {
        fontSize: 18,
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.bold,
        color: Colors.white,
    },
    cardSubtitle: {
        fontSize: 12,
        color: Colors.gray500,
        ...Typography.fontWeights.medium,
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
        ...Typography.fontWeights.semibold,
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
        ...Typography.fontWeights.extrabold,
        fontSize: 16,
        letterSpacing: 0.5,
    },
    verifyAllButtonDisabled: {
        opacity: 0.6,
    },
});
