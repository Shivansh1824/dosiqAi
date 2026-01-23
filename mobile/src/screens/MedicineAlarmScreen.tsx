/**
 * Full-Screen Medicine Alarm Screen (Android)
 * Redesigned with Premium '2026 Standard' Aesthetic
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  StatusBar,
  Dimensions,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notifee from '@notifee/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cancelReminder, snoozeReminder, MedicineReminderData } from '../services/notificationService';
import SponsoredSpace from '../components/notification/SponsoredSpace';
import { useMedicationLogsStore } from '../store/medicationLogsStore';
import { useAuthStore } from '../store/authStore';
import { toLocalDateString } from '../utils/dateUtils';
import { Colors } from '../constants';

const { width, height } = Dimensions.get('window');

interface NotificationData {
  medicationId?: string;
  medicationName?: string;
  dosage?: string;
  scheduleId?: string;
  instructions?: string;
}

interface Props {
  notification?: {
    data?: NotificationData;
  };
}

export default function MedicineAlarmScreen({ notification, route, navigation }: any) {
  console.log('='.repeat(60));
  console.log('[MedicineAlarmScreen] 🚨 COMPONENT RENDERING');
  
  // Detailed logging of incoming props
  try {
    if (notification) {
      console.log('[MedicineAlarmScreen] notification prop keys:', Object.keys(notification));
      console.log('[MedicineAlarmScreen] notification.data:', JSON.stringify(notification.data));
    } else {
      console.log('[MedicineAlarmScreen] notification prop is undefined');
    }
    
    if (route) {
      console.log('[MedicineAlarmScreen] route prop keys:', Object.keys(route));
      console.log('[MedicineAlarmScreen] route.params:', JSON.stringify(route.params));
    } else {
      console.log('[MedicineAlarmScreen] route prop is undefined');
    }
  } catch (err) {
    console.error('[MedicineAlarmScreen] Error logging props:', err);
  }

  const [isActionTaken, setIsActionTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const slideAnim = useState(new Animated.Value(300))[0];
  
  // Store hooks for database updates
  const { user } = useAuthStore();
  const { markAsTaken, markAsSkipped } = useMedicationLogsStore();
  
  console.log('[MedicineAlarmScreen] Auth User ID:', user?.id || 'UNDEFINED');
  
  // Snooze options
  const snoozeOptions = [
    { label: '5 minutes', value: 5 },
    { label: '10 minutes', value: 10 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
  ];
  
  // Helper to safely extract data
  const resolveMedicationData = (): NotificationData => {
    // 1. Try notification data
    if (notification?.data) {
      console.log('[MedicineAlarmScreen] Using notification.data');
      return notification.data;
    }
    
    // 2. Try route params
    if (route?.params) {
      console.log('[MedicineAlarmScreen] Using route.params');
      return route.params;
    }
    
    // 3. Fallback
    console.log('[MedicineAlarmScreen] Using default fallback data');
    return {
      medicationName: 'Metformin',
      dosage: '500mg',
      scheduleId: '',
      medicationId: '',
      instructions: 'Take with food'
    };
  };

  const medicationData = resolveMedicationData();
  
  // Extract scheduled time for logging
  const scheduledDate = toLocalDateString(new Date());
  const scheduledTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  
  console.log('[MedicineAlarmScreen] Final Resolved medicationData:', JSON.stringify(medicationData));
  
  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Start vibration pattern on mount
  useEffect(() => {
    if (Platform.OS === 'android') {
      const pattern = [0, 500, 300, 500, 300, 500]; // Heartbeat vibration
      Vibration.vibrate(pattern, true);
    }
    return () => Vibration.cancel();
  }, []);
  
  // Open snooze modal with animation
  const openSnoozeModal = () => {
    setShowSnoozeModal(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  // Close snooze modal with animation
  const closeSnoozeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowSnoozeModal(false));
  };

  const handleTaken = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    // Fallback name if undefined
    const name = medicationData.medicationName || 'your medication';
    console.log('[MedicineAlarm] Marking as taken:', name);
    
    // Update medication_logs table
    if (user?.id && medicationData.medicationId) {
      try {
        await markAsTaken(
          user.id,
          medicationData.medicationId,
          scheduledDate,
          scheduledTime
        );
        console.log('[MedicineAlarm] ✅ Database updated with taken status');
      } catch (error) {
        console.error('[MedicineAlarm] Failed to update database:', error);
      }
    } else {
      console.warn('[MedicineAlarm] ⚠️ Cannot update database - Missing User ID or Medication ID');
    }
    
    if (medicationData.scheduleId) {
      await cancelReminder(medicationData.scheduleId);
    }
    
    // Show confirmation toast/notification then CLOSE
    await notifee.displayNotification({
      title: '✓ Medication Taken',
      body: `Great job! You took ${name}`,
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        timeoutAfter: 5000,
        pressAction: { id: 'default' },
        lightUpScreen: true,
      },
    });

    // Close the alarm screen
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      // If we can't go back, maybe navigation reset or go Home?
      // Assuming this screen might be opened on top of everything
      console.log('[MedicineAlarm] Navigating back/home');
      navigation.navigate('Home');
    }
  };
  
  const handleSnoozeSelect = async (minutes: number) => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    closeSnoozeModal();
    Vibration.cancel();
    
    console.log('[MedicineAlarm] Snoozing for', minutes, 'minutes:', medicationData.medicationName);
    
    // Snooze does NOT update the database - only reschedules the alarm
    if (medicationData.scheduleId) {
      const reminderData: MedicineReminderData = {
        medicationId: medicationData.medicationId || '',
        medicationName: medicationData.medicationName || '',
        dosage: medicationData.dosage || '',
        scheduleId: medicationData.scheduleId,
        instructions: medicationData.instructions,
        scheduledTime: new Date(),
      };
      
      await snoozeReminder(medicationData.scheduleId, reminderData, minutes);
    }
    
    await notifee.displayNotification({
      title: '⏰ Snoozed',
      body: `Reminder for ${medicationData.medicationName} in ${minutes} minutes`,
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        timeoutAfter: 3000,
        pressAction: { id: 'default' },
        lightUpScreen: true,
      },
    });

    // Close the alarm screen
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };
  
  const handleSkip = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    // Fallback name if undefined
    const name = medicationData.medicationName || 'your medication';
    console.log('[MedicineAlarm] Skipping:', name);
    
    // Update medication_logs table with skipped status
    if (user?.id && medicationData.medicationId) {
      try {
        await markAsSkipped(
          user.id,
          medicationData.medicationId,
          scheduledDate,
          scheduledTime
        );
        console.log('[MedicineAlarm] ✅ Database updated with skipped status');
      } catch (error) {
        console.error('[MedicineAlarm] Failed to update database:', error);
      }
    } else {
      console.warn('[MedicineAlarm] ⚠️ Cannot update database (Skip) - Missing User ID or Medication ID');
    }
    
    if (medicationData.scheduleId) {
      await cancelReminder(medicationData.scheduleId);
    }

    // Close the alarm screen
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Premium Gradient Background */}
      <LinearGradient
        colors={['#FEF9C3', '#E0F2FE', '#C7D2FE', '#4338CA']}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.background}
      />

      {/* Top Header Section */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>FamilyCare Health</Text>
        <Text style={styles.subtitle}>Medication Reminder</Text>
      </View>

      {/* Main Card Container */}
      <View style={styles.cardContainer}>
        {/* Floating Icon Halo */}
        <View style={styles.iconHalo}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="pill" size={32} color="#1E293B" />
          </View>
        </View>

        {/* Card Content */}
        <View style={styles.card}>
          <Text style={styles.medicationName} numberOfLines={2}>
            {medicationData.medicationName}
          </Text>
          
          <View style={styles.detailsRow}>
            <MaterialCommunityIcons name="bottle-tonic-plus" size={16} color="#64748B" />
            <Text style={styles.dosageText}>{medicationData.dosage}</Text>
          </View>
          
          {medicationData.instructions && (
             <View style={styles.detailsRow}>
              <MaterialCommunityIcons name="text-box-outline" size={16} color="#64748B" />
              <Text style={styles.instructionText} numberOfLines={2}>{medicationData.instructions}</Text>
            </View>
          )}

          {/* Sponsored Space inside the card */}
          <SponsoredSpace />
          
          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            {/* Skip / Deny */}
            <View style={styles.actionItem}>
              <TouchableOpacity
                style={[styles.actionButton, styles.skipButton]}
                onPress={handleSkip}
                disabled={isActionTaken}
              >
                <MaterialCommunityIcons name="close" size={28} color="#EF4444" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Skip</Text>
            </View>

            {/* Snooze / Leave at Gate */}
            <View style={styles.actionItem}>
              <TouchableOpacity
                style={[styles.actionButton, styles.snoozeButton]}
                onPress={openSnoozeModal}
                disabled={isActionTaken}
              >
                <MaterialCommunityIcons name="clock-outline" size={28} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Snooze</Text>
            </View>

            {/* Taken / Approve */}
            <View style={styles.actionItem}>
              <TouchableOpacity
                style={[styles.actionButton, styles.takenButton]}
                onPress={handleTaken}
                disabled={isActionTaken}
              >
                <MaterialCommunityIcons name="check" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Taken</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Time Display */}
      <View style={styles.footer}>
        <Text style={styles.timeText}>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.dateText}>
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>
      {/* Snooze Options Modal */}
      <Modal
        visible={showSnoozeModal}
        transparent
        animationType="fade"
        onRequestClose={closeSnoozeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={closeSnoozeModal}
          />
          
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Snooze for...</Text>
              <TouchableOpacity onPress={closeSnoozeModal}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.optionsContainer}>
              {snoozeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.optionButton}
                  onPress={() => handleSnoozeSelect(option.value)}
                >
                  <View style={styles.optionIconContainer}>
                    <MaterialCommunityIcons name="clock-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.optionText}>{option.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  cardContainer: {
    width: width * 0.85,
    alignItems: 'center',
    marginTop: 20,
  },
  iconHalo: {
    zIndex: 10,
    marginBottom: -24, // Pull card up to float behind icon
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FDE047', // Yellow-400
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 40, // Space for floating icon
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  medicationName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dosageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  instructionText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 10,
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  skipButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  snoozeButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  takenButton: {
    backgroundColor: '#22C55E', // Green-500
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  dateText: {
    fontSize: 14,
    color: '#E0E7FF',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  optionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
});
