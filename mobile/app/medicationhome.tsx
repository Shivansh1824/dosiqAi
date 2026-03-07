import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../src/constants';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { Medication } from '../src/types/medication';
import { getTodayLocal, fromLocalDateString } from '../src/utils/dateUtils';
import ActiveMedicationCard from '../src/components/ActiveMedicationCard';
import MedicationListItem from '../src/components/MedicationListItem';
import { MedicationIcon } from '../src/components/medication/MedicationIcons';

const ACCENT = '#1B4332';

export default function MedicationHomeScreen() {
  const router = useRouter();
  const { medications } = useMedicationsStore();

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

  const activeMedications = medications.filter(isActiveMedication);
  const allMedications = [...medications].sort((a, b) =>
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  const completedCount = allMedications.filter(m => {
    const today = getTodayLocal();
    const endDate = m.end_date ? fromLocalDateString(m.end_date) : null;
    return endDate && endDate < today;
  }).length;

  const ongoingCount = allMedications.filter(m => !m.end_date).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="chevron-left" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Medications</Text>
            <Text style={styles.headerSubtitle}>
              {activeMedications.length} active · {allMedications.length} total
            </Text>
          </View>

          <TouchableOpacity style={styles.addFab} onPress={() => router.push('/addmedication' as any)} activeOpacity={0.8}>
            <Feather name="plus" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── Stats bar ──────────────────────────────── */}
        <View style={styles.statsBar}>
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{activeMedications.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{ongoingCount}</Text>
            <Text style={styles.statLabel}>Ongoing</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* ── Content ────────────────────────────────── */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* Active medicines section */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: ACCENT }]} />
            <Text style={styles.sectionTitle}>ACTIVE MEDICINES</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{activeMedications.length}</Text>
            </View>
          </View>

          {activeMedications.length > 0 ? (
            <View style={styles.section}>
              {activeMedications.map((medication) => (
                <ActiveMedicationCard key={medication.id} medication={medication} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <MedicationIcon form="default" size={28} />
              </View>
              <Text style={styles.emptyTitle}>No Active Medications</Text>
              <Text style={styles.emptyText}>
                Verified medications from your documents will appear here
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* All medicines section */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: Colors.gray300 }]} />
            <Text style={styles.sectionTitle}>ALL MEDICINES</Text>
            <View style={[styles.sectionCount, { backgroundColor: Colors.gray100 }]}>
              <Text style={[styles.sectionCountText, { color: Colors.textSecondary }]}>{allMedications.length}</Text>
            </View>
          </View>

          {allMedications.length > 0 ? (
            <View style={styles.section}>
              {allMedications.map((medication) => (
                <MedicationListItem
                  key={medication.id}
                  medication={medication}
                  onPress={(id) => console.log('View medication detail:', id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <MedicationIcon form="tablet" size={28} />
              </View>
              <Text style={styles.emptyTitle}>No Medications Added</Text>
              <Text style={styles.emptyText}>Scan a prescription to get started</Text>
            </View>
          )}

          <View style={{ height: Sizes.xl * 3 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.sm,
    backgroundColor: '#FAFAF9',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    paddingLeft: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    marginTop: 1,
  },
  addFab: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    marginHorizontal: Sizes.lg,
    marginVertical: 14,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.gray200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.lg,
    paddingTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
    gap: 8,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
    flex: 1,
  },
  sectionCount: {
    backgroundColor: ACCENT + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: Sizes.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: Sizes.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Sizes.xl,
    marginBottom: Sizes.lg,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Sizes.xl,
    lineHeight: 18,
  },
});
