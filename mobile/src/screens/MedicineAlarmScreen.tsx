/**
 * Full-Screen Medicine Alarm Screen (Android)
 * 
 * Launched when medication reminder notification fires
 * Provides large, touch-friendly buttons for Taken/Snooze/Skip
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notifee from '@notifee/react-native';
import { cancelReminder, snoozeReminder, MedicineReminderData } from '../services/notificationService';

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

export default function MedicineAlarmScreen({ notification }: Props) {
  const [isActionTaken, setIsActionTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Extract medication data from notification
  const medicationData: NotificationData = notification?.data || {
    medicationName: 'Medication',
    dosage: '',
    scheduleId: '',
    medicationId: '',
  };
  
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
      const pattern = [0, 500, 300, 500, 300, 500];
      Vibration.vibrate(pattern, true);
    }
    
    return () => Vibration.cancel();
  }, []);
  
  const handleTaken = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    console.log('[MedicineAlarm] Marking as taken:', medicationData.medicationName);
    
    // Cancel the notification
    if (medicationData.scheduleId) {
      await cancelReminder(medicationData.scheduleId);
    }
    
    // Show confirmation notification
    await notifee.displayNotification({
      title: '✓ Medication Taken',
      body: `Great job! You took ${medicationData.medicationName}`,
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        timeoutAfter: 5000,
        pressAction: { id: 'default' },
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
      
      await snoozeReminder(
        medicationData.scheduleId,
        reminderData,
        10 // 10 minutes
      );
    }
    
    // Show snooze confirmation
    await notifee.displayNotification({
      title: '⏰ Snoozed',
      body: `Reminder for ${medicationData.medicationName} in 10 minutes`,
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        timeoutAfter: 3000,
        pressAction: { id: 'default' },
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
  
  const formattedTime = currentTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header - Current Time */}
      <View style={styles.header}>
        <Text style={styles.timeText}>{formattedTime}</Text>
        <Text style={styles.dateText}>
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>
      
      {/* Pill Icon */}
      <View style={styles.iconSection}>
        <View style={styles.pillIconContainer}>
          <MaterialCommunityIcons name="pill" size={80} color="#4F46E5" />
        </View>
        <Text style={styles.title}>Medication Reminder</Text>
      </View>
      
      {/* Medication Info */}
      <View style={styles.medicationInfo}>
        <Text style={styles.medicationName}>
          {medicationData.medicationName || 'Medication'}
        </Text>
        {medicationData.dosage && (
          <Text style={styles.dosage}>{medicationData.dosage}</Text>
        )}
        {medicationData.instructions && (
          <Text style={styles.instructions}>{medicationData.instructions}</Text>
        )}
      </View>
      
      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Taken Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.takenButton, isActionTaken && styles.disabledButton]}
          onPress={handleTaken}
          disabled={isActionTaken}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="check-circle" size={36} color="#fff" />
          <Text style={styles.actionButtonText}>Mark as Taken</Text>
        </TouchableOpacity>
        
        {/* Snooze Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.snoozeButton, isActionTaken && styles.disabledButton]}
          onPress={handleSnooze}
          disabled={isActionTaken}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="alarm-snooze" size={36} color="#fff" />
          <Text style={styles.actionButtonText}>Snooze 10 min</Text>
        </TouchableOpacity>
        
        {/* Skip Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton, isActionTaken && styles.disabledSkipButton]}
          onPress={handleSkip}
          disabled={isActionTaken}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="close-circle-outline" size={36} color="#6B7280" />
          <Text style={[styles.actionButtonText, styles.skipButtonText]}>
            Skip This Dose
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>FamilyCare Health</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 40 : 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -1,
  },
  dateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  iconSection: {
    alignItems: 'center',
  },
  pillIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4B5563',
  },
  medicationInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  medicationName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  dosage: {
    fontSize: 24,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 12,
  },
  instructions: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  actionsContainer: {
    width: '100%',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  takenButton: {
    backgroundColor: '#10B981', // Green
    shadowColor: '#10B981',
  },
  snoozeButton: {
    backgroundColor: '#F59E0B', // Orange
    shadowColor: '#F59E0B',
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
  skipButtonText: {
    color: '#6B7280',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledSkipButton: {
    opacity: 0.5,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
