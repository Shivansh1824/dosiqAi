import { useState, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from './useNotifications';
import { parseAIMedication, detectDuplicateMedication } from '../utils/medicationParser';
import { Medication } from '../types/medication';
import { ParsedMedication } from '../types/medicationVerification';
import { DocumentAnalysisResult } from '../types/document';

interface PendingDuplicateData {
    newMed: ParsedMedication;
    existingMed: Medication;
    startDate: string;
    resolve: () => void;
    reject: (reason?: any) => void;
}

export const useDocumentMedications = (
    document: any,
    initialDocument: any,
    displayTitle: string,
    familyMember: any
) => {
    const { addMedicationFromAI, medications } = useMedicationsStore();
    const { user } = useAuthStore();
    const { scheduleAllForMedication } = useNotifications();

    const [verifiedMedications, setVerifiedMedications] = useState<Set<string>>(new Set());
    const [dismissedMedicationIds, setDismissedMedicationIds] = useState<Set<string>>(new Set());
    const [medicationLiveUpdates, setMedicationLiveUpdates] = useState<Record<number, {
        current_reminder_times?: string[];
        start_date?: string;
        end_date?: string;
        duration_days?: number;
    }>>({});

    const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
    const [pendingDuplicateData, setPendingDuplicateData] = useState<PendingDuplicateData | null>(null);
    const [manualMedicines, setManualMedicines] = useState<any[]>([]);

    const handleAddManualMedication = (name: string) => {
        const newManualMed = {
            name_as_written: name,
            is_identified: true,
            confidence: 1,
            category: 'medication'
        };
        setManualMedicines(prev => [...prev, newManualMed]);
    };

    // Check if this document has already been processed/added to tracker
    const isAlreadyAdded = useMemo(() => {
        if (!initialDocument?.id || !medications.length) return false;
        return medications.some(med => med.source_document_id === initialDocument.id);
    }, [initialDocument?.id, medications]);

    const onLiveUpdate = (index: number, updates: any) => {
        setMedicationLiveUpdates(prev => ({
            ...prev,
            [index]: { ...(prev[index] || {}), ...updates }
        }));
    };

    const DISMISSED_MEDS_STORAGE_KEY = useMemo(() => {
        return document ? `dismissed_medications_${document.id}` : '';
    }, [document?.id]);

    useEffect(() => {
        const loadDismissedMedications = async () => {
            if (!document || !DISMISSED_MEDS_STORAGE_KEY) return;
            try {
                const stored = await AsyncStorage.getItem(DISMISSED_MEDS_STORAGE_KEY);
                if (stored) {
                    const dismissed = JSON.parse(stored);
                    setDismissedMedicationIds(new Set(dismissed));
                    console.log('[useDocumentMedications] Loaded dismissed medications:', dismissed);
                }
            } catch (error) {
                console.error('[useDocumentMedications] Error loading dismissed medications:', error);
            }
        };

        loadDismissedMedications();
    }, [DISMISSED_MEDS_STORAGE_KEY]);

    const saveDismissedToStorage = async (dismissedSet: Set<string>) => {
        if (!DISMISSED_MEDS_STORAGE_KEY) return;
        try {
            await AsyncStorage.setItem(DISMISSED_MEDS_STORAGE_KEY, JSON.stringify(Array.from(dismissedSet)));
        } catch (error) {
            console.error('[useDocumentMedications] Error saving dismissed medications:', error);
        }
    };

    const handleDismissMedication = (index: number) => {
        if (!document) return;
        const dismissId = `${document.id}_${index}`;
        setDismissedMedicationIds(prev => {
            const updated = new Set(prev).add(dismissId);
            saveDismissedToStorage(updated);
            return updated;
        });
    };

    const handleRestoreMedication = (index: number) => {
        if (!document) return;
        const dismissId = `${document.id}_${index}`;
        setDismissedMedicationIds(prev => {
            const updated = new Set(prev);
            updated.delete(dismissId);
            saveDismissedToStorage(updated);
            return updated;
        });
    };

    const handleResolveDuplicate = async (action: 'replace' | 'add') => {
        if (!pendingDuplicateData || !user) return;
        const { newMed, existingMed, startDate, resolve, reject } = pendingDuplicateData;

        try {
            setDuplicateModalVisible(false);

            const addedMed = await addMedicationFromAI(
                newMed,
                user.id,
                document!.id,
                displayTitle,
                startDate,
                document!.family_member_id!
            );

            if (addedMed) {
                await scheduleAllForMedication(addedMed);
            }

            if (action === 'replace') {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                await useMedicationsStore.getState().updateMedication(existingMed.id, {
                    end_date: yesterday.toISOString().split('T')[0],
                });
            }

            setVerifiedMedications(prev => new Set(prev).add(newMed.name));
            resolve();
        } catch (error) {
            reject(error);
            Alert.alert('Error', 'Failed to resolve duplicate.');
        } finally {
            setPendingDuplicateData(null);
        }
    };

    const handleCancelDuplicate = () => {
        if (pendingDuplicateData) {
            pendingDuplicateData.reject(new Error('User cancelled'));
            setPendingDuplicateData(null);
        }
        setDuplicateModalVisible(false);
    };

    const handleVerifyAndAddMedication = async (parsedMed: ParsedMedication, startDate: string) => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to add medications');
            return;
        }

        try {
            const duplicate = detectDuplicateMedication(parsedMed.name, parsedMed.dosage, medications);

            if (duplicate) {
                return new Promise<void>((resolve, reject) => {
                    setPendingDuplicateData({
                        newMed: parsedMed,
                        existingMed: duplicate,
                        startDate,
                        resolve,
                        reject,
                    });
                    setDuplicateModalVisible(true);
                });
            }

            const addedMed = await addMedicationFromAI(
                parsedMed,
                user.id,
                document!.id,
                displayTitle,
                startDate,
                document!.family_member_id!
            );

            if (addedMed) {
                await scheduleAllForMedication(addedMed);
            }

            setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));
        } catch (error) {
            console.error('[useDocumentMedications] Error adding medication:', error);
            throw error;
        }
    };

    const innerMedicines = useMemo(() => {
        const aiMedicines = document?.ai_analysis_result?.medicines || [];
        return [...aiMedicines, ...manualMedicines];
    }, [document?.ai_analysis_result, manualMedicines]);

    const aiMedicinesCount = useMemo(() => {
        return document?.ai_analysis_result?.medicines?.length || 0;
    }, [document?.ai_analysis_result?.medicines]);

    const allUnverifiedMedsIdx = useMemo(() => {
        if (!document) return [];
        return innerMedicines
            .map((medicine: any, index: number) => ({ medicine, index }))
            .filter(({ medicine }: any) => {
                const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
                return !verifiedMedications.has(parsedMed.name);
            });
    }, [innerMedicines, document?.id, verifiedMedications, displayTitle, familyMember]);

    const activeMedsForBatch = useMemo(() => {
        if (!document) return [];
        return allUnverifiedMedsIdx.filter(({ index }: any) => {
            const dismissId = `${document.id}_${index}`;
            return !dismissedMedicationIds.has(dismissId);
        });
    }, [allUnverifiedMedsIdx, document?.id, dismissedMedicationIds]);

    const duplicateMedicationsMap = useMemo(() => {
        const map = new Map<number, Medication>();
        if (!document || !medications || medications.length === 0) return map;

        allUnverifiedMedsIdx.forEach(({ medicine, index }: any) => {
            const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
            const duplicate = detectDuplicateMedication(parsedMed.name, parsedMed.dosage, medications);
            if (duplicate) {
                map.set(index, duplicate);
            }
        });
        return map;
    }, [allUnverifiedMedsIdx, medications, document?.id, displayTitle, familyMember]);

    const hasUnverifiedMeds = activeMedsForBatch.length > 0;

    return {
        verifiedMedications,
        setVerifiedMedications,
        dismissedMedicationIds,
        medicationLiveUpdates,
        setMedicationLiveUpdates,
        duplicateModalVisible,
        setDuplicateModalVisible,
        pendingDuplicateData,
        isAlreadyAdded,
        innerMedicines,
        allUnverifiedMedsIdx,
        activeMedsForBatch,
        duplicateMedicationsMap,
        hasUnverifiedMeds,
        aiMedicinesCount,
        onLiveUpdate,
        handleDismissMedication,
        handleRestoreMedication,
        handleResolveDuplicate,
        handleCancelDuplicate,
        handleVerifyAndAddMedication,
        handleAddManualMedication,
    };
};
