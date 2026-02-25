import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { DocumentAnalysisResult } from '../../types/document';
import { formatDocumentType, formatDoctorName, formatDisplayDate } from '../../utils/prescriptionHelpers';
import AnalysisLoading from '../AnalysisLoading';

interface PrescriptionDetailsProps {
    analysisResult?: DocumentAnalysisResult;
    analysisStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    documentCreatedAt: string;
}

/**
 * PrescriptionDetails - Details card showing visit date, diagnosis, patient, doctor, type, status
 * Extracted from PrescriptionSummaryScreen.tsx
 */
export function PrescriptionDetails({
    analysisResult,
    analysisStatus,
    documentCreatedAt,
}: PrescriptionDetailsProps) {
    // We directly access properties from the flattened analysisResult

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Details</Text>
            <View style={styles.patientInfoContainer}>
                {/* Row 1: Date & Diagnosis */}
                <View style={styles.patientInfoChip}>
                    <View style={styles.patientIconBadge}>
                        <Feather name="calendar" size={14} color={Colors.secondary} />
                    </View>
                    <View>
                        <Text style={styles.patientInfoLabel}>VISIT DATE</Text>
                        <Text style={styles.patientInfoValue} numberOfLines={1}>
                            {analysisResult?.visit_date || formatDisplayDate(documentCreatedAt)}
                        </Text>
                    </View>
                </View>

                {analysisResult?.diagnosis?.condition && (
                    <View style={styles.patientInfoChip}>
                        <View style={styles.patientIconBadge}>
                            <Feather name="activity" size={14} color={Colors.error} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.patientInfoLabel}>DIAGNOSIS</Text>
                            <Text style={styles.patientInfoValue}>
                                {analysisResult.diagnosis.condition}
                            </Text>
                        </View>
                    </View>
                )}


                {analysisResult?.doctor?.name && (
                    <View style={styles.patientInfoChip}>
                        <View style={styles.patientIconBadge}>
                            <Feather name="user-plus" size={14} color={Colors.success} />
                        </View>
                        <View>
                            <Text style={styles.patientInfoLabel}>DOCTOR</Text>
                            <Text style={styles.patientInfoValue} numberOfLines={1}>
                                {formatDoctorName(analysisResult.doctor.name)}
                            </Text>
                        </View>
                    </View>
                )}


                <View style={styles.patientInfoChip}>
                    {analysisStatus === 'processing' || analysisStatus === 'pending' ? (
                        <View style={[styles.patientIconBadge, { backgroundColor: 'transparent' }]}>
                            <AnalysisLoading size={24} color={Colors.primary} />
                        </View>
                    ) : (
                        <View style={styles.patientIconBadge}>
                            <Feather name="check" size={14} color={Colors.success} />
                        </View>
                    )}
                    <View>
                        <Text style={styles.patientInfoLabel}>STATUS</Text>
                        {analysisStatus === 'processing' ? (
                            <Text style={[styles.patientInfoValue, { color: Colors.primary }]}>Processing</Text>
                        ) : analysisStatus === 'completed' ? (
                            <Text style={[styles.patientInfoValue, { color: Colors.success }]}>Analyzed</Text>
                        ) : analysisStatus === 'failed' ? (
                            <Text style={[styles.patientInfoValue, { color: Colors.error }]}>Failed</Text>
                        ) : (
                            <Text style={styles.patientInfoValue}>Pending</Text>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        padding: 16,
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    patientInfoContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    patientInfoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 0,
        gap: 8,
        minWidth: '45%',
        flex: 1,
    },
    patientIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: Colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    patientInfoLabel: {
        fontSize: 11,
        color: Colors.gray500,
        fontWeight: '600',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    patientInfoValue: {
        fontSize: 13,
        color: Colors.textPrimary,
        fontWeight: '700',
        flexShrink: 1,
        lineHeight: 18,
    },
});
