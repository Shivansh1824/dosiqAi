import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors } from '../../constants';

interface PrescriptionMetadataCardProps {
  patientName?: string;
  patientAge?: string;
  patientGender?: string;
  doctorName?: string;
  hospitalName?: string;
  visitDate?: string;
  followUpDate?: string;
  followUpDays?: number | null;
  diagnosis?: string;
}

export const PrescriptionMetadataCard: React.FC<PrescriptionMetadataCardProps> = ({
  patientName,
  patientAge,
  patientGender,
  doctorName,
  hospitalName,
  visitDate,
  followUpDate,
  followUpDays,
  diagnosis,
}) => {
  // Format details
  const patientDetails = [patientAge, patientGender].filter(Boolean).join(' • ');
  
  // Format follow up
  let followUpText = '-';
  if (followUpDate) followUpText = followUpDate;
  else if (followUpDays) followUpText = `In ${followUpDays} days`;

  // Helper to format date nicely (Simple version)
  const formatDate = (dateString?: string) => {
      if (!dateString) return '-';
      // If already readable or not standard YYYY-MM-DD, return as is
      return dateString; 
  };

  const renderGridItem = (label: string, value?: string, isFullWidth = false) => (
      <View style={[styles.gridItem, isFullWidth && styles.fullWidthItem]}>
          <Text style={styles.gridLabel}>{label}</Text>
          <Text style={styles.gridValue} numberOfLines={1}>{value || '-'}</Text>
      </View>
  );

  return (
    <View style={styles.container}>
      {/* HERO: Patient Identity */}
      <View style={styles.heroSection}>
          <Text style={styles.patientName} numberOfLines={1}>
            {patientName || 'Unknown Patient'}
          </Text>
          <Text style={styles.patientDetails}>{patientDetails}</Text>
      </View>

      <View style={styles.divider} />

      {/* DATA GRID */}
      <View style={styles.gridContainer}>
          {/* Row 1 */}
          <View style={styles.gridRow}>
              {renderGridItem('DIAGNOSIS', diagnosis || 'Unspecified')}
              {renderGridItem('VISIT DATE', formatDate(visitDate))}
          </View>

          {/* Row 2 */}
          <View style={styles.gridRow}>
              {renderGridItem('TREATING DOCTOR', doctorName)}
              {renderGridItem('NEXT REVIEW', followUpText)}
          </View>

          {/* Row 3 - Hospital (Full Widthish or just col 1) */}
          <View style={styles.gridRow}>
              {renderGridItem('CLINIC / HOSPITAL', hospitalName, true)}
          </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSecondary,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    width: '100%',
  },
  heroSection: {
      marginBottom: 20,
  },
  patientName: {
    fontSize: 26, 
    fontWeight: '800',
    color: Colors.gray900,
    letterSpacing: -0.5,
    marginBottom: 4,
    lineHeight: 32,
  },
  patientDetails: {
    fontSize: 15,
    color: Colors.gray500,
    fontWeight: '500',
  },
  divider: {
      height: 1,
      backgroundColor: Colors.gray100,
      marginBottom: 20,
  },
  gridContainer: {
      gap: 20,
  },
  gridRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
  },
  gridItem: {
      flex: 1,
      overflow: 'hidden',
  },
  fullWidthItem: {
      flex: 1, 
      // span both cols implied by being in a row alone or explicitly structured
  },
  gridLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.gray400,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
  },
  gridValue: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.gray900,
  }
});
