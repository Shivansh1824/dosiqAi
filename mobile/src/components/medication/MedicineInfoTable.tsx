import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants';
import { ParsedMedication } from '../../types/medicationVerification';
import { formatFrequencyDisplay } from '../../utils/medicationParser';

interface MedicineInfoTableProps {
    medication: ParsedMedication;
}

/**
 * MedicineInfoTable - Table showing scientific name, medicine type, purpose, frequency, duration
 * Extracted from MedicationVerificationCard.tsx
 */
export function MedicineInfoTable({ medication }: MedicineInfoTableProps) {
    const hasMedicineInfo = medication.scientific_name || medication.medicine_type || medication.medicine_purpose;
    const hasTimingInfo = medication.source_raw?.timing || medication.timing_dosage ||
        medication.total_times_per_day || medication.interval_days !== undefined ||
        medication.duration_days || medication.source_raw?.duration_days;

    return (
        <>
            {/* Medicine Info Table - Scientific Name, Type, Purpose */}
            {hasMedicineInfo && (
                <View style={styles.medicineInfoTable}>
                    {/* Sci Name Row */}
                    {medication.scientific_name && (
                        <View style={styles.tableRow}>
                            <View style={styles.tableLabelCell}>
                                <Text style={styles.tableHeaderText}>Sci Name</Text>
                            </View>
                            <View style={styles.tableValueCell}>
                                <Text style={styles.tableDataText} numberOfLines={2}>
                                    {medication.scientific_name}
                                </Text>
                            </View>
                        </View>
                    )}
                    {/* Med Type Row */}
                    {medication.medicine_type && (
                        <View style={styles.tableRow}>
                            <View style={styles.tableLabelCell}>
                                <Text style={styles.tableHeaderText}>Med Type</Text>
                            </View>
                            <View style={styles.tableValueCell}>
                                <Text style={styles.tableDataText} numberOfLines={2}>
                                    {medication.medicine_type}
                                </Text>
                            </View>
                        </View>
                    )}
                    {/* Med Purpose Row */}
                    {medication.medicine_purpose && (
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                            <View style={styles.tableLabelCell}>
                                <Text style={styles.tableHeaderText}>Med Purpose</Text>
                            </View>
                            <View style={styles.tableValueCell}>
                                <Text style={styles.tableDataText} numberOfLines={2}>
                                    {medication.medicine_purpose}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Frequency & Duration Table */}
            {hasTimingInfo && (
                <View style={styles.medicineInfoTable}>
                    {/* Frequency Row */}
                    <View style={styles.tableRow}>
                        <View style={styles.tableLabelCell}>
                            <Text style={styles.tableHeaderText}>Frequency</Text>
                        </View>
                        <View style={styles.tableValueCell}>
                            <Text style={styles.tableDataText} numberOfLines={2}>
                                {formatFrequencyDisplay(
                                    medication.timing_dosage ?? medication.source_raw?.timing?.dosage,
                                    medication.total_times_per_day ?? medication.source_raw?.timing?.total_times_per_day,
                                    medication.interval_days ?? medication.source_raw?.interval_days
                                )}
                            </Text>
                        </View>
                    </View>

                    {/* Duration Row */}
                    {(medication.duration_days || medication.source_raw?.duration_days) && (
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                            <View style={styles.tableLabelCell}>
                                <Text style={styles.tableHeaderText}>Duration</Text>
                            </View>
                            <View style={styles.tableValueCell}>
                                <Text style={styles.tableDataText}>
                                    {medication.duration_days ?? medication.source_raw?.duration_days} Days
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    medicineInfoTable: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        borderRadius: 12,
        backgroundColor: Colors.gray50,
        borderWidth: 1,
        borderColor: Colors.gray200,
        overflow: 'hidden',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray200,
    },
    tableLabelCell: {
        minWidth: 105,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: Colors.gray50,
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: Colors.gray200,
    },
    tableValueCell: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    tableHeaderText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.gray500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'left',
    },
    tableDataText: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.gray700,
        textAlign: 'left',
        lineHeight: 16,
    },
});
