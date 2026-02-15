import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Sizes } from '../../constants';
import { ParsedMedication } from '../../types/medicationVerification';
import { Medication } from '../../types/medication';

interface DuplicateMedicationModalProps {
  visible: boolean;
  onClose: () => void;
  newMedication: ParsedMedication | null;
  existingMedication: Medication | null;
  onReplace: () => void;
  onAddBoth: () => void;
}

export const DuplicateMedicationModal = ({
  visible,
  onClose,
  newMedication,
  existingMedication,
  onReplace,
  onAddBoth,
}: DuplicateMedicationModalProps) => {
  if (!visible || !newMedication || !existingMedication) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.warningIconContainer}>
              <Feather name="alert-triangle" size={24} color={Colors.warning} />
            </View>
            <Text style={styles.title}>Duplicate Detected</Text>
            <Text style={styles.subtitle}>
              This medication seems similar to one already in your tracker.
            </Text>
          </View>

          {/* Comparison Cards */}
          <View style={styles.comparisonContainer}>
            {/* Existing Medication */}
            <View style={styles.medicationCard}>
              <View style={styles.cardLabelRow}>
                <Feather name="database" size={12} color={Colors.gray500} />
                <Text style={styles.cardLabel}>CURRENTLY IN TRACKER</Text>
              </View>
              <Text style={styles.medName}>{existingMedication.name}</Text>
              <Text style={styles.medDetails}>
                {existingMedication.dosage} • {existingMedication.frequency || 'Custom Schedule'}
              </Text>
            </View>

            {/* Arrow Divider */}
            <View style={styles.arrowContainer}>
              <Feather name="arrow-down" size={20} color={Colors.gray400} />
            </View>

            {/* New Medication */}
            <View style={[styles.medicationCard, styles.newMedCard]}>
               <View style={styles.cardLabelRow}>
                <Feather name="file-text" size={12} color={Colors.primary} />
                <Text style={[styles.cardLabel, { color: Colors.primary }]}>FOUND IN PRESCRIPTION</Text>
              </View>
              <Text style={styles.medName}>{newMedication.name}</Text>
              <Text style={styles.medDetails}>
                {newMedication.dosage} • {newMedication.frequency || 'As Prescribed'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {/* Primary Action: Replace/Update */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onReplace}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4F46E5', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Feather name="refresh-cw" size={18} color={Colors.white} />
                <Text style={styles.primaryButtonText}>Update Existing</Text>
              </LinearGradient>
            </TouchableOpacity>

             <Text style={styles.recommendationText}>
                Recommended: Keeps your history but updates the schedule.
            </Text>

            {/* Secondary Action: Add Both */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onAddBoth}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Add as Separate Entry</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 500,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  warningIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7', // Amber-100
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    ...Typography.fontWeights.bold,
    color: Colors.gray900,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  comparisonContainer: {
    marginBottom: 32,
  },
  medicationCard: {
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  newMedCard: {
    backgroundColor: '#EFF6FF', // Blue-50
    borderColor: '#BFDBFE', // Blue-200
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 11,
    ...Typography.fontWeights.bold,
    color: Colors.gray500,
    letterSpacing: 0.5,
  },
  medName: {
    fontSize: 16,
    ...Typography.fontWeights.bold,
    color: Colors.gray900,
    marginBottom: 4,
  },
  medDetails: {
    fontSize: 14,
    color: Colors.gray600,
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: -8,
    zIndex: 10,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    ...Typography.fontWeights.bold,
  },
  recommendationText: {
      fontSize: 12,
      color: Colors.gray400,
      textAlign: 'center',
      marginBottom: 8,
  },
  secondaryButton: {
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.gray700,
    fontSize: 15,
    ...Typography.fontWeights.semibold,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.gray400,
    fontSize: 15,
    ...Typography.fontWeights.medium,
  },
});
