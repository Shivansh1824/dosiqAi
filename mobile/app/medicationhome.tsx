import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../src/constants';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { Medication } from '../src/types/medication';
import { getTodayLocal, fromLocalDateString } from '../src/utils/dateUtils';
import ActiveMedicationCard from '../src/components/ActiveMedicationCard';
import MedicationListItem from '../src/components/MedicationListItem';

export default function MedicationHomeScreen() {
  const router = useRouter();
  const { medications } = useMedicationsStore();

  // Helper function to check if medication is active
  const isActiveMedication = (med: Medication): boolean => {
    const today = getTodayLocal();
    const startDate = fromLocalDateString(med.start_date);
    const endDate = med.end_date ? fromLocalDateString(med.end_date) : null;

    return (

      med.verified_by_user === true &&
      med.ai_extracted === true &&
      today >= startDate &&
      (!endDate || today <= endDate)
    );
  };

  // Filter and sort medications
  const activeMedications = medications.filter(isActiveMedication);
  const allMedications = [...medications].sort((a, b) =>
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  // Navigation handlers
  const handleBack = () => {
    router.back();
  };

  const handleSearch = () => {
    // TODO: Navigate to search screen (future enhancement)
    console.log('Search medications');
  };

  const handleMedicationPress = (id: string) => {
    // TODO: Navigate to medication detail screen
    console.log('View medication detail:', id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Medications</Text>

          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            activeOpacity={0.7}
          >
            <Feather name="search" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Active Medicines Section */}
          <Text style={styles.sectionHeader}>
            ACTIVE MEDICINES ({activeMedications.length})
          </Text>

          {activeMedications.length > 0 ? (
            <View style={styles.section}>
              {activeMedications.map((medication) => (
                <ActiveMedicationCard
                  key={medication.id}
                  medication={medication}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="check-circle" size={48} color={Colors.gray300} />
              </View>
              <Text style={styles.emptyTitle}>No Active Medications</Text>
              <Text style={styles.emptyText}>
                Verified medications from your documents will appear here
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* All Medicines Section */}
          <Text style={styles.sectionHeader}>
            ALL MEDICINES ({allMedications.length})
          </Text>

          {allMedications.length > 0 ? (
            <View style={styles.section}>
              {allMedications.map((medication) => (
                <MedicationListItem
                  key={medication.id}
                  medication={medication}
                  onPress={handleMedicationPress}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="package" size={48} color={Colors.gray300} />
              </View>
              <Text style={styles.emptyTitle}>No Medications Added</Text>
              <Text style={styles.emptyText}>
                Scan a prescription to get started
              </Text>
            </View>
          )}

          {/* Bottom Padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.lg,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Sizes.md,
  },
  section: {
    marginBottom: Sizes.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: Sizes.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Sizes.xl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Sizes.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Sizes.xl,
  },
  bottomPadding: {
    height: Sizes.xl * 2,
  },
});
