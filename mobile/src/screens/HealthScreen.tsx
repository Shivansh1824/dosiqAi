import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAppointmentsStore } from '../store/appointmentsStore';
import { useHealthVitalsStore } from '../store/healthVitalsStore';
import { getFrequencyText } from '../types/medication';
import { formatAppointmentDateTime } from '../types/appointment';
import { HealthMetric, HealthAlert } from '../types/healthMetrics';
import VitalCard from '../components/VitalCard';
import FindingCard from '../components/FindingCard';
import AlertBanner from '../components/AlertBanner';
import BMICalculatorModal from '../components/BMICalculatorModal';

export default function HealthScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const { medications, isLoading: isLoadingMeds, fetchMedications } = useMedicationsStore();
    const { appointments, isLoading: isLoadingApts, fetchAppointments } = useAppointmentsStore();
    const { vitals: healthVitals, isLoading: isLoadingVitals, fetchVitals, addVital } = useHealthVitalsStore();
    const [refreshing, setRefreshing] = useState(false);
    const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
    const [showBMIModal, setShowBMIModal] = useState(false);
    const [currentBMI, setCurrentBMI] = useState<number | undefined>();

    // Load data with cache-first approach
    useEffect(() => {
        const loadData = async () => {
            if (user?.id) {
                // Step 1: Load from cache instantly
                await Promise.all([
                    useMedicationsStore.getState().loadFromCache(user.id),
                    useAppointmentsStore.getState().loadFromCache(user.id),
                    useHealthVitalsStore.getState().loadFromCache(user.id),
                ]);

                // Step 2: Refresh from Supabase silently in background
                await Promise.all([
                    fetchMedications(user.id, true),
                    fetchAppointments(user.id, true),
                    fetchVitals(user.id, true),
                ]);
            }
        };

        loadData();
    }, [user?.id, fetchMedications, fetchAppointments, fetchVitals]);

    // Get active medications
    const activeMedications = medications.filter(m => {

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check Start Date (must be in past or today)
        if (m.start_date) {
            const startDate = new Date(m.start_date);
            if (startDate > today) return false;
        }

        // Check End Date (must be in future or today, or null)
        if (m.end_date) {
            const endDate = new Date(m.end_date);
            return endDate >= today;
        }
        return true;
    });

    // Get upcoming appointments
    const upcomingAppointments = appointments.filter(apt => {
        const appointmentDate = new Date(apt.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return appointmentDate >= today && apt.status !== 'cancelled';
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // DYNAMIC HEALTH METRICS from database + demo data
    // Get current BMI from database
    const currentBMIVital = healthVitals.find(v => v.label === 'BMI');

    // Demo vitals (marked as demo) - shown for development
    // Only hide if real Blood Pressure or Heart Rate data exists
    const hasRealBP = healthVitals.some(v => v.label === 'Blood Pressure');
    const hasRealHR = healthVitals.some(v => v.label === 'Heart Rate');

    const demoVitals: HealthMetric[] = [];

    if (!hasRealBP) {
        demoVitals.push({
            id: 'demo-1',
            type: 'vital',
            label: 'Blood Pressure (DEMO)',
            value: '120/80',
            unit: 'mmHg',
            trend: 'stable',
            status: 'normal',
            iconName: 'heart-pulse',
            detail: '🧪 Demo data - Upload a medical report to see real vitals',
        });
    }

    if (!hasRealHR) {
        demoVitals.push({
            id: 'demo-2',
            type: 'vital',
            label: 'Heart Rate (DEMO)',
            value: '75',
            unit: 'bpm',
            trend: 'stable',
            status: 'normal',
            iconName: 'heart',
            detail: '🧪 Demo data - Upload a medical report to see real vitals',
        });
    }

    // Fixed BMI card - always shown
    const bmiCard: HealthMetric = currentBMIVital || {
        id: 'bmi-fixed',
        type: 'vital',
        label: 'BMI',
        value: '0',
        unit: '',
        status: 'normal',
        iconName: 'human',
        detail: 'Tap to calculate your BMI',
    };

    const healthMetrics: HealthMetric[] = [...healthVitals.filter(v => v.label !== 'BMI'), bmiCard, ...demoVitals];

    // Separate vitals and findings
    const vitals = healthMetrics.filter(m => m.type === 'vital');
    const findings = healthMetrics.filter(m => m.type === 'finding');

    // Dynamic alerts - only show for critical/warning status vitals
    const alerts: HealthAlert[] = healthMetrics
        .filter(m => m.status === 'critical' || m.status === 'warning')
        .filter(m => !m.id.startsWith('demo-')) // Exclude demo data from alerts
        .map(m => ({
            id: `alert-${m.id}`,
            message: `${m.label}: ${m.value}${m.unit ? ' ' + m.unit : ''} - ${m.status === 'critical' ? 'Critical' : 'Warning'} level detected`,
            type: m.status === 'critical' ? 'danger' as const : 'warning' as const,
        }))
        .filter(alert => !dismissedAlerts.includes(alert.id));

    const handleDismissAlert = (alertId: string) => {
        setDismissedAlerts([...dismissedAlerts, alertId]);
    };

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        if (user?.id) {
            await Promise.all([
                fetchMedications(user.id, true),
                fetchAppointments(user.id, true),
                fetchVitals(user.id, true),
            ]);
        }
        setRefreshing(false);
    }, [user?.id, fetchMedications, fetchAppointments, fetchVitals]);

    const handleFindingAction = (findingId: string) => {
        console.log('Finding action pressed:', findingId);
        // TODO: Navigate to appropriate screen
    };

    const handleVitalCardPress = (vitalId: string) => {
        const vital = healthMetrics.find(m => m.id === vitalId);
        if (vital?.label === 'BMI') {
            const bmiValue = typeof vital.value === 'string' ? parseFloat(vital.value) : vital.value;
            setCurrentBMI(bmiValue);
            setShowBMIModal(true);
        }
    };

    const handleSaveBMI = async (bmi: number, weight: number, height: number, weightUnit: string, heightUnit: string) => {
        if (!user?.id) return;

        // Get previous BMI for comparison
        const previousBMI = healthVitals.find(v => v.label === 'BMI');
        let trend: 'up' | 'down' | 'stable' | undefined;

        if (previousBMI) {
            const prevValue = typeof previousBMI.value === 'string' ? parseFloat(previousBMI.value) : previousBMI.value;
            if (bmi > prevValue + 0.5) trend = 'up';
            else if (bmi < prevValue - 0.5) trend = 'down';
            else trend = 'stable';
        }

        // Determine BMI status
        let status: 'normal' | 'warning' | 'critical';
        if (bmi < 18.5 || bmi >= 30) status = 'warning';
        else if (bmi >= 25) status = 'warning';
        else status = 'normal';

        // Create BMI vital
        const bmiVital: Omit<HealthMetric, 'id'> = {
            type: 'vital',
            label: 'BMI',
            value: bmi.toString(),
            unit: '',
            status,
            iconName: 'human',
            trend,
            detail: `Weight: ${weight} ${weightUnit}, Height: ${height} ${heightUnit}`,
            date: new Date().toISOString(),
        };

        try {
            await addVital(bmiVital, user.id);
            setCurrentBMI(bmi);
            console.log('✅ BMI saved successfully');
        } catch (error) {
            console.error('Error saving BMI:', error);
            Alert.alert('Error', 'Failed to save BMI. Please try again.');
        }
    };

    const isLoading = isLoadingMeds || isLoadingApts || isLoadingVitals;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health Overview</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
                }
            >
                {/* Alerts - Sticky at top */}
                {alerts.map((alert) => (
                    <AlertBanner
                        key={alert.id}
                        alert={alert}
                        onDismiss={() => handleDismissAlert(alert.id)}
                    />
                ))}

                {/* Health Metrics - DYNAMIC */}
                {vitals.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Health Metrics</Text>
                        <View style={styles.vitalsGrid}>
                            {vitals.map((vital) => (
                                <TouchableOpacity
                                    key={vital.id}
                                    style={styles.vitalCardWrapper}
                                    onPress={() => handleVitalCardPress(vital.id)}
                                    activeOpacity={vital.label === 'BMI' ? 0.7 : 1}
                                    disabled={vital.label !== 'BMI'}
                                >
                                    <VitalCard metric={vital} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* Findings - DYNAMIC */}
                {findings.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Recent Findings</Text>
                        {findings.map((finding) => (
                            <FindingCard
                                key={finding.id}
                                metric={finding}
                                onActionPress={() => handleFindingAction(finding.id)}
                            />
                        ))}
                    </>
                )}

                {/* Empty state if no metrics */}
                {vitals.length === 0 && findings.length === 0 && (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="chart-line" size={64} color={Colors.gray300} />
                        <Text style={styles.emptyText}>No health metrics available</Text>
                        <Text style={styles.emptySubtext}>Start tracking your vitals to see them here</Text>
                    </View>
                )}

                {/* Current Medications */}
                <Text style={styles.sectionTitle}>Current Medications</Text>
                {activeMedications.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <MaterialCommunityIcons name="pill" size={32} color={Colors.gray300} />
                        <Text style={styles.emptyText}>No active medications</Text>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {activeMedications.slice(0, 3).map((med) => (
                            <View key={med.id} style={styles.listCard}>
                                <View style={[styles.listIconContainer, { backgroundColor: med.color + '15' }]}>
                                    <MaterialCommunityIcons name="pill" size={20} color={med.color} />
                                </View>
                                <View style={styles.listInfo}>
                                    <Text style={styles.listTitle}>{med.name}</Text>
                                    <Text style={styles.listSubtitle}>{med.dosage} - {getFrequencyText(med.frequency)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Upcoming Appointments */}
                <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
                {upcomingAppointments.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <MaterialCommunityIcons name="calendar" size={32} color={Colors.gray300} />
                        <Text style={styles.emptyText}>No upcoming appointments</Text>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {upcomingAppointments.slice(0, 3).map((apt) => (
                            <View key={apt.id} style={styles.listCard}>
                                <View style={[styles.listIconContainer, { backgroundColor: apt.color + '15' }]}>
                                    <MaterialCommunityIcons name="calendar" size={20} color={apt.color} />
                                </View>
                                <View style={styles.listInfo}>
                                    <Text style={styles.listTitle}>{apt.doctor_name}</Text>
                                    <Text style={styles.listSubtitle}>{apt.appointment_type} - {formatAppointmentDateTime(apt.date, apt.time)}</Text>
                                    {apt.location && <Text style={styles.listLocation}>{apt.location}</Text>}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* BMI Calculator Modal */}
            <BMICalculatorModal
                visible={showBMIModal}
                onClose={() => setShowBMIModal(false)}
                onSave={handleSaveBMI}
                currentBMI={currentBMI}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: Sizes.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Sizes.md,
        marginTop: Sizes.lg,
    },
    vitalsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -Sizes.xs,
    },
    vitalCardWrapper: {
        width: '50%',
        paddingHorizontal: Sizes.xs,
    },
    emptyState: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.xl * 2,
        alignItems: 'center',
        marginVertical: Sizes.xl,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginTop: Sizes.md,
    },
    emptySubtext: {
        fontSize: 14,
        color: Colors.gray400,
        marginTop: Sizes.xs,
        textAlign: 'center',
    },
    emptyCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.xl,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    listContainer: {
        gap: Sizes.sm,
    },
    listCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Sizes.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    listIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Sizes.md,
    },
    listInfo: {
        flex: 1,
    },
    listTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    listSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    listLocation: {
        fontSize: 12,
        color: Colors.gray400,
        marginTop: 2,
    },
});
