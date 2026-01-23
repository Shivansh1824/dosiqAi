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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notifee from '@notifee/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cancelReminder, snoozeReminder, MedicineReminderData } from '../services/notificationService';
import SponsoredSpace from '../components/notification/SponsoredSpace';

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

export default function MedicineAlarmScreen({ notification, route }: any) {
  console.log('='.repeat(60));
  console.log('[MedicineAlarmScreen] 🚨 COMPONENT RENDERING');
  console.log('[MedicineAlarmScreen] notification prop:', JSON.stringify(notification));
  console.log('[MedicineAlarmScreen] route prop:', JSON.stringify(route));
  console.log('='.repeat(60));
  
  const [isActionTaken, setIsActionTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Extract medication data from notification or use fallbacks for preview
  // Priority: 
  // 1. Notifee notification prop (Full Screen Intent)
  // 2. React Navigation route params (Deep Link / Manual Navigation)
  const medicationData: NotificationData = notification?.data || route?.params || {
    medicationName: 'Metformin',
    dosage: '500mg',
    scheduleId: '',
    medicationId: '',
    instructions: 'Take with food'
  };
  
  console.log('[MedicineAlarmScreen] Resolved medicationData:', JSON.stringify(medicationData));
  
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
  
  const handleTaken = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    console.log('[MedicineAlarm] Marking as taken:', medicationData.medicationName);
    
    if (medicationData.scheduleId) {
      await cancelReminder(medicationData.scheduleId);
    }
    
    await notifee.displayNotification({
      title: '✓ Medication Taken',
      body: `Great job! You took ${medicationData.medicationName}`,
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        timeoutAfter: 5000,
        pressAction: { id: 'default' },
        lightUpScreen: true,
      },
    });
  };
  
  const handleSnooze = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    console.log('[MedicineAlarm] Snoozing:', medicationData.medicationName);
    
    if (medicationData.scheduleId) {
      const reminderData: MedicineReminderData = {
        medicationId: medicationData.medicationId || '',
        medicationName: medicationData.medicationName || '',
        dosage: medicationData.dosage || '',
        scheduleId: medicationData.scheduleId,
        instructions: medicationData.instructions,
        scheduledTime: new Date(),
      };
      
      await snoozeReminder(medicationData.scheduleId, reminderData, 10);
    }
    
    await notifee.displayNotification({
      title: '⏰ Snoozed',
      body: `Reminder for ${medicationData.medicationName} in 10 minutes`,
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        timeoutAfter: 3000,
        pressAction: { id: 'default' },
        lightUpScreen: true,
      },
    });
  };
  
  const handleSkip = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    console.log('[MedicineAlarm] Skipping:', medicationData.medicationName);
    
    if (medicationData.scheduleId) {
      await cancelReminder(medicationData.scheduleId);
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
                onPress={handleSnooze}
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
});
