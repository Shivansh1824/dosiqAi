import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Sizes } from '../../constants';

interface VerifiedMedicationsGroupProps {
  medicationNames: string[];
  onViewInTracker?: () => void;
}

/**
 * VerifiedMedicationsGroup - Displays a consolidated list of verified medications
 * with a single "Added to tracker" banner and a "Tree/Branch" visualization.
 */
export const VerifiedMedicationsGroup = ({ medicationNames, onViewInTracker }: VerifiedMedicationsGroupProps) => {
  if (medicationNames.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Success Banner */}
      <View style={styles.verifiedBanner}>
        <Feather name="check-circle" size={16} color={Colors.success} />
        <Text style={styles.verifiedText}>
          {medicationNames.length} {medicationNames.length === 1 ? 'Medication' : 'Medications'} Added to Tracker
        </Text>
      </View>

      {/* Vertical Connector Line from Banner to Tree */}
      <View style={styles.bannerConnector} />

      {/* Vertical Tree Visualization Container */}
      <View style={styles.treeContainer}>
        {medicationNames.map((name, index) => (
          <View key={index} style={styles.medicationNode}>
            {/* Vertical Main Branch segment */}
            <View
              style={[
                styles.verticalMainBranch,
                index === 0 && styles.firstBranch,
                index === medicationNames.length - 1 && styles.lastBranch
              ]}
            />

            {/* Horizontal Branch to Name */}
            <View style={styles.horizontalBranch} />

            {/* Medication Name Chip */}
            <View style={styles.nameChip}>
              <Text style={styles.medicationName} numberOfLines={1}>
                {name}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* View In Tracker Button - Match primary action style */}
      {onViewInTracker && (
        <TouchableOpacity
          style={styles.viewTrackerButton}
          onPress={onViewInTracker}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#3B82F6', '#60A5FA', '#93C5FD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewTrackerGradient}
          >
            <Feather name="eye" size={18} color={Colors.white} />
            <Text style={styles.viewTrackerButtonText}>View in Tracker</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'flex-start', // Align to left for better tree visualization
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.success + '20',
    marginLeft: -4, // Nudge to align check icon with vertical line
  },
  bannerConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#D1D5DB',
    marginLeft: 10, // Perfectly aligns with the check icon center and tree trunk
    marginTop: -2,
  },
  verifiedText: {
    fontSize: 14,
    ...Typography.fontWeights.bold,
    color: Colors.success,
  },
  treeContainer: {
    paddingLeft: 10,
    width: '100%',
    marginTop: -8,
  },
  medicationNode: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  verticalMainBranch: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#D1D5DB',
  },
  firstBranch: {
    top: 0,
  },
  lastBranch: {
    bottom: '50%',
  },
  horizontalBranch: {
    width: 20,
    height: 2,
    backgroundColor: '#D1D5DB',
  },
  nameChip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexShrink: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  medicationName: {
    fontSize: 13,
    ...Typography.fontWeights.semibold,
    color: Colors.gray700,
  },
  viewTrackerButton: {
    width: '100%',
    marginTop: 20,
    borderRadius: 14,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  viewTrackerGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  viewTrackerButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
