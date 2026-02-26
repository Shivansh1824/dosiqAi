import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants';
import { ParsedMedication } from '../../types/medicationVerification';
import { getMealTimingLabel } from '../../utils/medicationParser';

interface AIAnalysisModalContentProps {
  medication: ParsedMedication;
  confidenceScore?: number;
}

export const AIAnalysisModalContent = ({ medication, confidenceScore }: AIAnalysisModalContentProps) => {
  const hasAttributes = !!(
    medication.source_raw?.instructions ||
    medication.dosage ||
    medication.duration_days ||
    medication.strength ||
    medication.form ||
    medication.generic_name ||
    medication.food_relationship
  );

  const itemConfidence = medication.source_raw?.confidence;
  const displayConfidence = itemConfidence !== undefined ? itemConfidence : confidenceScore;

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

            {/* Note Row */}
            {(medication.source_raw?.instructions || medication.dosage) && (
              <View style={styles.tableRow}>
                <View style={styles.tableHeaderCell}>
                  <Text style={styles.tableHeaderText}>Note</Text>
                </View>
                <View style={styles.tableValueCell}>
                  <Text style={styles.tableValueText}>
                    {medication.source_raw?.instructions || medication.dosage}
                  </Text>
                </View>
              </View>
            )}

            {/* Attributes Rows */}
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

const styles = StyleSheet.create({
  modalContent: {
    marginBottom: 20,
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
    marginTop: 0,
  },
  tableBorderContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: Colors.white,
  },
  tableHeaderCell: {
    width: '30%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
  },
  tableValueCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.gray500,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableValueText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.gray600,
    lineHeight: 18,
  },
});
