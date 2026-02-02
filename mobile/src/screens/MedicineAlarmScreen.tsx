/**
 * Full-Screen Medicine Alarm Screen (Android)
 * Redesigned with Premium '2026 Standard' Aesthetic & Clustering Support (Phase 3)
 */

import React, { useEffect, useState, useRef } from 'react';
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
  ScrollView,
  SafeAreaView,
  Easing, // Added
  PanResponder, 
  Image, 
  PanResponderGestureState, 
  useColorScheme // Added
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notifee from '@notifee/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cancelReminder, cancelIOSFollowUps, snoozeReminder, MedicineReminderData } from '../services/notificationService';
import SponsoredSpace from '../components/notification/SponsoredSpace';
import { useMedicationLogsStore } from '../store/medicationLogsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAuthStore } from '../store/authStore';
import { toLocalDateString } from '../utils/dateUtils';
import { Colors } from '../constants';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface NotificationData {
  medicationId?: string;
  medicationName?: string;
  dosage?: string;
  scheduleId?: string;
  instructions?: string;
  // Phase 3: Clustering support
  activeMedicationIds?: string; // JSON string of IDs
  activeMedications?: string;   // JSON string of full objects (optional fallback)
  scheduledTime?: string;       // ISO string of scheduled time
}

interface MedicationItem {
  id: string; // medicationId
  name: string;
  dosage: string;
  instructions?: string;
  scheduleId?: string; // Derived base schedule ID
}

export default function MedicineAlarmScreen({ notification, route, navigation }: any) {
  // --------------------------------------------------------------------------
  // LOGGING & SETUP
  // --------------------------------------------------------------------------
  console.log('='.repeat(60));
  console.log('[MedicineAlarmScreen] 🚨 PHASE 3 CLUSTER ALARM RENDER');

  const { user } = useAuthStore();
  const { markAsTaken, markAsSkipped } = useMedicationLogsStore();
  const { medications: allMedications } = useMedicationsStore();
  
  // 1. Resolve Data Source (Notification vs Route)
  const resolveInitialData = (): NotificationData => {
    if (notification?.data) return notification.data;
    if (route?.params) return route.params;
    return {};
  };

  const initialData = resolveInitialData();
  
  // Determine relevant time to show - Robust helper to prevent "Invalid Date"
  const getInitialTime = () => {
    if (!initialData.scheduledTime) return new Date();
    
    // Attempt 1: Raw ISO string parse
    let date = new Date(initialData.scheduledTime);
    if (!isNaN(date.getTime())) return date;
    
    // Attempt 2: URL Decode (handles %3A and other encoding artifacts)
    try {
      date = new Date(decodeURIComponent(initialData.scheduledTime));
      if (!isNaN(date.getTime())) return date;
    } catch (e) {
      console.log('[MedicineAlarm] Failed to parse encoded date');
    }
    
    // Attempt 3: Default to current system time (User requested "Simple" fallback)
    console.log('[MedicineAlarm] Malformed scheduledTime, falling back to current system time');
    return new Date();
  };
  
  const [displayTime, setDisplayTime] = useState(getInitialTime());

  // 2. Parse Medications (Clustered vs Single)
  const [medicationList, setMedicationList] = useState<MedicationItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  
  // Load medications logic
  useEffect(() => {
    const parseMedications = () => {
      const list: MedicationItem[] = [];
      
      // A. Check for Clustered Payload (Phase 3)
      if (initialData.activeMedicationIds || initialData.activeMedications) {
        try {
          // Helper: Safe Parse with URL Decode fallback
          const safeParse = (jsonStr: string | undefined): any => {
            if (!jsonStr) return null;
            try {
              return JSON.parse(jsonStr);
            } catch (e) {
              // Retry with URL Decode (fix for Android Intent data oddities)
              console.log('[MedicineAlarm] JSON Parse failed, retrying with decodeURIComponent...');
              try {
                return JSON.parse(decodeURIComponent(jsonStr));
              } catch (e2) {
                console.error(`[MedicineAlarm] Critical Parse Error. Raw: ${jsonStr}`);
                throw e2; // Bubble up to outer catch
              }
            }
          };

          // Try to use rich objects first if available (for offline/test support)
          if (initialData.activeMedications) {
             const richMeds = safeParse(initialData.activeMedications);
             if (richMeds && Array.isArray(richMeds)) {
                richMeds.forEach((m: any) => {
                  list.push({
                    id: m.id,
                    name: m.name,
                    dosage: m.dosage || '',
                    instructions: m.instructions || m.notes || '',
                    scheduleId: initialData.scheduleId
                  });
                });
             }
          } 
          
          // Fallback to IDs + Store Lookup if Rich Data is missing or dry
          if (list.length === 0 && initialData.activeMedicationIds) {
            const ids: string[] = safeParse(initialData.activeMedicationIds);
            
            if (ids && Array.isArray(ids)) {
                ids.forEach(id => {
                  const medStoreItem = allMedications.find(m => m.id === id);
                  if (medStoreItem) {
                    list.push({
                      id: medStoreItem.id,
                      name: medStoreItem.name,
                      dosage: medStoreItem.dosage || '',
                      instructions: medStoreItem.notes || '',
                      scheduleId: initialData.scheduleId
                    });
                  } else {
                    // Critical Fallback: If store is empty (fresh boot), show at least the "Unknown" placeholder
                    // or try to fetch from DB? For now, Show ID/Placeholder.
                    console.log(`[MedicineAlarm] Med ID ${id} not found in store (Store size: ${allMedications.length})`);
                    list.push({
                      id: id,
                      name: 'Loading Medication...', // Better UX than "Unknown"
                      dosage: '',
                      scheduleId: initialData.scheduleId
                    });
                  }
                });
            }
          }
        } catch (e) {
          console.error('[MedicineAlarm] Failed to parse cluster data:', e);
        }
      } 
      
      // B. Fallback to Legacy Single Params
      if (list.length === 0) {
        if (initialData.medicationId || initialData.medicationName) {
           list.push({
             id: initialData.medicationId || 'unknown-id',
             name: initialData.medicationName || 'Medication',
             dosage: initialData.dosage || '',
             instructions: initialData.instructions || '',
             scheduleId: initialData.scheduleId
           });
        }
      }
      
      // C. Default fallback for testing
      if (list.length === 0) {
         list.push({
           id: 'mock-1',
           name: 'Metformin',
           dosage: '500mg',
           instructions: 'Take with food'
         });
      }
      
      setMedicationList(list);
      const allIds = new Set(list.map(m => m.id));
      setCheckedIds(allIds);
    };

    parseMedications();
  }, [initialData, allMedications]);

  // --------------------------------------------------------------------------
  // UI & ANIMATION STATE
  // --------------------------------------------------------------------------
  const [isActionTaken, setIsActionTaken] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  
  // Animations
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;
  const slideAnim = useState(new Animated.Value(300))[0];

  // (Removed ticking clock effect to keep time stable/exact to schedule)

  // Entrance Animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Vibration
  useEffect(() => {
    if (Platform.OS === 'android') {
      const pattern = [0, 500, 300, 500, 300, 500];
      Vibration.vibrate(pattern, true);
    }
    return () => Vibration.cancel();
  }, []);

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const toggleCheckbox = (id: string) => {
    const newSet = new Set(checkedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setCheckedIds(newSet);
  };

  const handleTaken = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();

    // 1. Process Logic
    const scheduledDate = toLocalDateString(new Date());
    const scheduledTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Group Actions
    const takenMeds = medicationList.filter(m => checkedIds.has(m.id));
    const skippedMeds = medicationList.filter(m => !checkedIds.has(m.id));
    
    console.log(`[MedicineAlarm] TAKEN: ${takenMeds.map(m=>m.name).join(', ')}`);
    console.log(`[MedicineAlarm] SKIPPED: ${skippedMeds.map(m=>m.name).join(', ')}`);

    // DB Updates
    if (user?.id) {
       for (const med of takenMeds) {
         await markAsTaken(user.id, med.id, scheduledDate, scheduledTime);
       }
       for (const med of skippedMeds) {
         await markAsSkipped(user.id, med.id, scheduledDate, scheduledTime);
       }
    }

    // Cancel Notifications (Unified)
    // We assume the scheduleId param belongs to the "cluster leader" or shared time slot
    if (initialData.scheduleId) {
      const baseId = initialData.scheduleId.replace('_followup', '').replace('_manual', '');
      await cancelReminder(baseId);
      await cancelIOSFollowUps(baseId);
      await cancelReminder(`${baseId}_manual`);
    }

    // User Feedback
    const names = takenMeds.map(m => m.name).join(', ');
    const feedbackTitle = takenMeds.length === medicationList.length 
      ? 'All Clean!' 
      : `${takenMeds.length}/${medicationList.length} Taken`;
      
    await notifee.displayNotification({
      id: `confirm-${Date.now()}`,
      title: '✓ Dose Logged',
      body: takenMeds.length > 0 ? `Tracked: ${names}` : 'Medications skipped for now.',
      android: {
        channelId: 'medication-reminders',
        autoCancel: true,
        pressAction: { id: 'default' },
      },
    });

    closeScreen();
  };

  const handleSkip = async () => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    Vibration.cancel();
    
    // Mark ALL as skipped
    const scheduledDate = toLocalDateString(new Date());
    const scheduledTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (user?.id) {
      for (const med of medicationList) {
        await markAsSkipped(user.id, med.id, scheduledDate, scheduledTime);
      }
    }
    
    if (initialData.scheduleId) {
      const baseId = initialData.scheduleId.replace('_followup', '').replace('_manual', '');
      await cancelReminder(baseId);
      await cancelIOSFollowUps(baseId);
      await cancelReminder(`${baseId}_manual`);
    }

    closeScreen();
  };

  const handleSnooze = async (minutes: number) => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    closeSnoozeModal();
    Vibration.cancel();
    
    if (initialData.scheduleId) {
       // Snooze logic needs a single ReminderData object. 
       // We create a wrapper that represents the "Group"
       const baseId = initialData.scheduleId.replace('_followup', '').replace('_manual', '');
       const reminderData: MedicineReminderData = {
         medicationId: medicationList[0]?.id || '', // Leader ID
         medicationName: medicationList.length > 1 ? `${medicationList.length} Medications` : medicationList[0]?.name,
         dosage: '',
         scheduleId: baseId,
         instructions: '',
         scheduledTime: new Date(),
         // Phase 3: Pass back the clustering data so the snooze alarm wakes up correctly!
         activeMedicationIds: initialData.activeMedicationIds 
           ? JSON.parse(initialData.activeMedicationIds) 
           : undefined,
       };
       
       await snoozeReminder(baseId, reminderData, minutes);
    }
    
    closeScreen();
  };
  
  const closeScreen = () => {
    if (navigation?.canGoBack()) navigation.goBack();
    else navigation.navigate('Home'); 
  };
  
  const closeSnoozeModal = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => setShowSnoozeModal(false));
  };

  // --------------------------------------------------------------------------
  // COMPONENTS (INTERNAL)
  // --------------------------------------------------------------------------
  
  // --------------------------------------------------------------------------
  // COMPONENTS (INTERNAL)
  // --------------------------------------------------------------------------
  
  // 1. Theme Detection
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light'; // Default to dark if undefined or dark
  
  // Theme Colors
  const theme = {
    bg: isDark ? (['#0f1014', '#172554', '#0f1014'] as const) : (['#ffffff', '#eff6ff', '#ffffff'] as const),
    bubble: isDark ? '#1e3a8a' : '#bfdbfe', 
    bubbleOpacity: isDark ? 0.5 : 0.6,
    // Text: PURE BLACK for Light Mode as requested
    textPrimary: isDark ? '#ffffff' : '#000000', 
    textSecondary: isDark ? 'rgba(255,255,255,0.7)' : '#1f2937', // Gray-800
    textMuted: isDark ? 'rgba(255,255,255,0.5)' : '#374151', // Gray-700
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
    checkboxBorder: isDark ? '#475569' : '#64748b', 
    checkboxCheck: '#2dd4bf', 
    // Buttons: Dark Text for Light Mode
    btnSnoozeBg: isDark ? 'rgba(30, 41, 59, 0.4)' : '#e2e8f0', 
    btnSnoozeBorder: isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1',
    btnSnoozeText: isDark ? '#e2e8f0' : '#0f172a',
    // Action Buttons (Taken/Skip) Text
    btnActionText: isDark ? '#ffffff' : '#000000', // White in Dark, Black in Light for contrast
    // Badge
    badgeText: isDark ? '#ffffff' : '#065f46', // Dark Green for Light Mode
    badgeBg: isDark ? 'rgba(45, 212, 191, 0.2)' : 'rgba(45, 212, 191, 0.3)',
  };

  const ProfessionalBackground = () => {
    // Subtle breathing/floating animation for the "Nature Bubble"
    const floatAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: 8000, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 8000, useNativeDriver: true }),
        ])
      ).start();
    }, []);

    const translateY = floatAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -20]
    });

    return (
      <View style={StyleSheet.absoluteFill}>
         {/* 1. Unified Rich Base (Brand Aligned) */}
         <LinearGradient
            colors={theme.bg} 
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
         />
         
         {/* 2. Top-Left "Nature Bubble" */}
         <Animated.View 
           style={{
             position: 'absolute',
             top: -120,
             left: -80,
             width: 500,
             height: 500,
             borderRadius: 250,
             backgroundColor: theme.bubble, 
             opacity: theme.bubbleOpacity,
             transform: [{ translateY }]
           }}
         >
            <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
         </Animated.View>

         {/* 3. Bottom-Right "Grounding Bubble" */}
         <View 
           style={{
             position: 'absolute',
             bottom: -180,
             right: -50,
             width: 600,
             height: 600,
             borderRadius: 300,
             backgroundColor: theme.bubble, 
             opacity: isDark ? 0.3 : 0.4
           }}
         />
         
         {/* OVERLAY: Texture/Noise if needed (Optional) */}
         <LinearGradient
            colors={['transparent', isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255,255,255,0.0)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
         />
      </View>
    );
  };
  
  // CHECKBOX COMPONENT
  const GlowCheckbox = ({ checked }: { checked: boolean }) => (
    <View style={[styles.glowCheckbox, { borderColor: theme.checkboxBorder }, checked && styles.glowCheckboxChecked]}>
       {checked && <MaterialCommunityIcons name="check" size={16} color={theme.checkboxCheck} />}
    </View>
  );

  // --------------------------------------------------------------------------
  // RENDERING
  // --------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: theme.bg[1] }]}>
      <StatusBar translucent barStyle={isDark ? "light-content" : "dark-content"} />
      <ProfessionalBackground />

      {/* Header Info - Logo & Branding */}
      <SafeAreaView style={styles.safeArea}>
         <View style={styles.header}>
            <View style={styles.brandingContainer}>
              <Image 
                source={require('../../assets/app-logo.png')} 
                style={styles.logoIcon}
                resizeMode="contain"
              />
              <Text style={[styles.headerLabel, { color: theme.textPrimary }]}>dosiqAi</Text>
            </View>
            <View style={[styles.liveIndicator, { backgroundColor: theme.badgeBg }]}>
               <View style={styles.liveDot} />
               <Text style={[styles.liveText, { color: theme.badgeText }]}>ACTIVE</Text>
            </View>
         </View>
      </SafeAreaView>

      {/* Main Content */}
      <Animated.View 
        style={[
          styles.mainContent,
          { 
            opacity: contentFade, 
            transform: [{ translateY: contentSlide }] 
          }
        ]}
      >
          {/* Hero Time Display */}
          <View style={styles.heroSection}>
             <Text style={[styles.heroTime, { color: theme.textPrimary }]}>
               {displayTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(' ', '')}
             </Text>
             <Text style={[styles.heroDate, { color: theme.textSecondary }]}>
               {displayTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
             </Text>
          </View>

          {/* Minimalist List */}
          <View style={styles.listSection}>
             <View style={styles.listHeaderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PRESCRIBED BUNDLE ({medicationList.length})</Text>
                {medicationList.length > 1 && (
                  <TouchableOpacity onPress={() => {
                     const allSelected = checkedIds.size === medicationList.length;
                     if (allSelected) setCheckedIds(new Set());
                     else setCheckedIds(new Set(medicationList.map(m=>m.id)));
                  }}>
                    <Text style={styles.toggleText}>{checkedIds.size === medicationList.length ? 'Clear' : 'All'}</Text>
                  </TouchableOpacity>
                )}
             </View>
             
             <ScrollView 
               style={{ maxHeight: 300 }} 
               showsVerticalScrollIndicator={false}
               contentContainerStyle={{ gap: 0 }}
             >
                {medicationList.map((med, index) => {
                  const isChecked = checkedIds.has(med.id);
                  return (
                    <TouchableOpacity
                      key={`${med.id}-${index}`}
                      style={[styles.listItem, { borderBottomColor: theme.borderColor }]} // No opacity change on check
                      onPress={() => toggleCheckbox(med.id)}
                      activeOpacity={0.8}
                    >
                       <View style={styles.itemContent}>
                          {/* Name: No change when checked (user request) */}
                          <Text style={[styles.itemName, { color: theme.textPrimary }]}>
                             {med.name}
                          </Text>
                          <View style={styles.itemMeta}>
                             {med.dosage ? <Text style={[styles.itemDetail, { color: theme.textSecondary }]}>{med.dosage}</Text> : null}
                             {med.instructions ? (
                                <>
                                 <View style={styles.metaDot} />
                                 <Text style={[styles.itemDetail, { color: theme.textSecondary }]}>{med.instructions}</Text>
                                </>
                             ) : null}
                          </View>
                       </View>
                       
                       <GlowCheckbox checked={isChecked} />
                    </TouchableOpacity>
                  );
                })}
             </ScrollView>
          </View>
      </Animated.View>

      {/* Bottom Actions - Simple Horizontal Layout */}
      <View style={styles.bottomActionsContainer}>
         
         <View style={styles.actionGrid}>
            {/* 1. TAKEN (Left) */}
            <TouchableOpacity 
               style={[styles.actionBtn, styles.btnTaken]} 
               onPress={handleTaken}
               activeOpacity={0.8}
            >
               <MaterialCommunityIcons name="check" size={24} color={isDark ? "white" : theme.btnActionText} />
               <Text style={[styles.btnTextWhite, { color: theme.btnActionText }]}>Taken ({checkedIds.size})</Text>
            </TouchableOpacity>

            {/* 2. SNOOZE (Middle) */}
            <TouchableOpacity 
               style={[
                 styles.actionBtn, 
                 styles.btnSnooze, 
                 { backgroundColor: theme.btnSnoozeBg, borderColor: theme.btnSnoozeBorder }
               ]} 
               onPress={() => setShowSnoozeModal(true)}
               activeOpacity={0.8}
            >
               <MaterialCommunityIcons name="clock-outline" size={24} color={theme.btnSnoozeText} />
               <Text style={[styles.btnTextLight, { color: theme.btnSnoozeText }]}>Snooze</Text>
            </TouchableOpacity>

            {/* 3. SKIP (Right) */}
            <TouchableOpacity 
               style={[styles.actionBtn, styles.btnSkip]} 
               onPress={handleSkip}
               activeOpacity={0.8}
            >
               <MaterialCommunityIcons name="close" size={24} color={isDark ? "white" : theme.btnActionText} />
               <Text style={[styles.btnTextWhite, { color: theme.btnActionText }]}>Skip</Text>
            </TouchableOpacity>
         </View>

      </View>

      {/* Modern Snooze Modal - Bottom Sheet Style */}
      <Modal
         visible={showSnoozeModal}
         transparent
         animationType="fade"
         onRequestClose={() => handleSnooze(5)}
      >
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSnoozeModal} />
           <Animated.View style={[styles.snoozeSheet, { transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.snoozeLabel}>SNOOZE DURATION</Text>
              <View style={styles.snoozeRow}>
                {[5, 10, 15, 30].map(min => (
                  <TouchableOpacity 
                    key={min} 
                    style={styles.snoozeChip} 
                    onPress={() => handleSnooze(min)}
                  >
                     <Text style={styles.snoozeChipText}>{min}m</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.cancelLink} onPress={closeSnoozeModal}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
           </Animated.View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },
  auroraOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.4,
  },
  safeArea: {
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
    marginHorizontal: 24,
  },
  
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 60,
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6, // soft square icon
  },
  headerLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // HERO TIME
  mainContent: {
    paddingHorizontal: 24,
    flex: 1,
  },
  heroSection: {
    marginBottom: 48,
  },
  heroTime: {
    fontSize: 92,
    fontWeight: '200',
    color: '#ffffff',
    letterSpacing: -4,
    lineHeight: 100,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 8,
    marginLeft: 4,
  },

  // LIST
  listSection: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  toggleText: {
    color: '#2dd4bf',
    fontSize: 12,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  listItemChecked: {
    opacity: 0.5,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '400',
    color: '#f8fafc',
    marginBottom: 4,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDetail: {
    color: '#64748b',
    fontSize: 14,
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#475569',
    marginHorizontal: 8,
  },
  
  // CUSTOM CHECKBOX
  glowCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCheckboxChecked: {
    borderColor: '#2dd4bf',
    shadowColor: '#2dd4bf',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  glowCheckboxInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2dd4bf',
  },

  // BOTTOM ACTIONS
  bottomActionsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  actionBtn: {
    height: 84,
    flex: 1, // Equal width for uniform look
    borderRadius: 24, // Squaricle
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 6,
    // Base Glass
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnTaken: {
    backgroundColor: 'rgba(20, 184, 166, 0.2)', // Teal-500 @ 20%
    borderColor: '#14b8a6', // Teal-500 border
  },
  btnSnooze: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)', // Slate-800 @ 40%
    borderColor: 'rgba(148, 163, 184, 0.3)', // Slate-400 border
  },
  btnSkip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)', // Red-500 @ 15%
    borderColor: 'rgba(239, 68, 68, 0.4)', // Red-500 border
  },
  btnTextWhite: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  btnTextLight: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  btnTextDanger: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
  },

  // SNOOZE SHEET
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  snoozeSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  snoozeLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 24,
    textAlign: 'center',
  },
  snoozeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  snoozeChip: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  snoozeChipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  cancelLinkText: {
    color: '#64748b',
    fontSize: 15,
  },
});
