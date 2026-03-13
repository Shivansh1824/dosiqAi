import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
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
  Animated as RNAnimated,
  ScrollView,
  Easing as RNEasing, // Renamed to avoid conflict
  PanResponder,
  Image,
  PanResponderGestureState,
  useColorScheme // Added
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Fixed Import
import { useNavigation as useNativeNavigation } from '@react-navigation/native'; // Added for deeper nav access if needed
import { Gesture, GestureDetector } from 'react-native-gesture-handler'; // Added
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
  Easing
} from 'react-native-reanimated'; // Added
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notifee from '@notifee/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cancelReminder, cancelIOSFollowUps, snoozeReminder, MedicineReminderData } from '../src/services/notificationService';
import SponsoredSpace from '../src/components/notification/SponsoredSpace';
import { useMedicationLogsStore } from '../src/store/medicationLogsStore';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { useAuthStore } from '../src/store/authStore';
import { useFamilyMembersStore } from '../src/store/familyMembersStore'; // Added
import { toLocalDateString } from '../src/utils/dateUtils';
import { Colors } from '../src/constants';
import ToastNotification from '../src/components/ToastNotification';
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

// Helper to determine the theme based on color scheme
const getTheme = (isDark: boolean) => ({
  bg: isDark ? (['#0f1014', '#172554', '#0f1014'] as const) : (['#ffffff', '#eff6ff', '#ffffff'] as const),
  bubble: isDark ? '#1e3a8a' : '#bfdbfe',
  bubbleOpacity: isDark ? 0.5 : 0.6,
  textPrimary: isDark ? '#ffffff' : '#000000',
  textSecondary: isDark ? 'rgba(255,255,255,0.7)' : '#1f2937', 
  textMuted: isDark ? 'rgba(255,255,255,0.5)' : '#374151', 
  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  checkboxBorder: isDark ? '#475569' : '#64748b',
  checkboxCheck: '#2dd4bf',
  btnSnoozeBg: isDark ? 'rgba(30, 41, 59, 0.4)' : '#e2e8f0',
  btnSnoozeBorder: isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1',
  btnSnoozeText: isDark ? '#e2e8f0' : '#0f172a',
  btnActionText: isDark ? '#ffffff' : '#000000', 
  badgeText: isDark ? '#ffffff' : '#065f46', 
  badgeBg: isDark ? 'rgba(45, 212, 191, 0.2)' : 'rgba(45, 212, 191, 0.3)',
});

// Reusable Option Item Component for Snooze (Moved outside to prevent re-creation)
const SnoozeOptionItem = ({ option, isSelected, onPress }: {
  option: { count: number; label: string; desc: string };
  isSelected: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const backgroundColorProgress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    backgroundColorProgress.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
    if (isSelected) {
      scale.value = withTiming(1.02, { duration: 150 });
      setTimeout(() => { scale.value = withTiming(1, { duration: 150 }); }, 150);
    }
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: isSelected ? '#EFF6FF' : 'rgba(255,255,255,0.8)',
      borderColor: isSelected ? Colors.primary : 'rgba(255,255,255,0.8)',
    };
  });

  return (
    <Animated.View style={[styles.verificationBar, animatedStyle, { marginBottom: 12, height: 68 }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: isSelected ? Colors.primary : '#E0F2FE', 
            justifyContent: 'center', alignItems: 'center',
          }}>
            <MaterialCommunityIcons
              name={isSelected ? "check" : "clock-outline"}
              size={22}
              color={isSelected ? "white" : '#0284C7'} 
            />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.barLabel, { fontSize: 16, color: Colors.gray900 }]} numberOfLines={1}>{option.label}</Text>
            <Text style={{ fontSize: 13, color: Colors.gray500, marginTop: 2 }}>{option.desc}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// CHECKBOX COMPONENT (Moved outside)
const GlowCheckbox = ({ checked, theme }: { checked: boolean, theme: any }) => (
  <View style={[styles.glowCheckbox, { borderColor: theme.checkboxBorder }, checked && styles.glowCheckboxChecked]}>
    {checked && <MaterialCommunityIcons name="check" size={16} color={theme.checkboxCheck} />}
  </View>
);

// BACKGROUND COMPONENT (Moved outside)
const ProfessionalBackground = ({ isDark, theme }: { isDark: boolean, theme: any }) => {
  const floatAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(floatAnim, { toValue: 1, duration: 8000, useNativeDriver: true }),
        RNAnimated.timing(floatAnim, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20]
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={theme.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <RNAnimated.View
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
      </RNAnimated.View>

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

      <LinearGradient
        colors={['transparent', isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255,255,255,0.0)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
};

export default function MedicineAlarmScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const initialData = (params as any) as NotificationData;

  // --------------------------------------------------------------------------
  // LOGGING & SETUP
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // LOGGING & SETUP
  // --------------------------------------------------------------------------
  // Removed concise log to prevent flooding
  // console.log('[MedicineAlarmScreen] Render');

  const { user } = useAuthStore();
  const { activeMember } = useFamilyMembersStore(); // Access User Preference
  const { markAsTaken, markAsSkipped } = useMedicationLogsStore();
  const { medications: allMedications } = useMedicationsStore();

  // 1. Resolve Data Source (Notification vs Route)
  // Fix: Already handled by useLocalSearchParams at top of component

  // Custom Snooze Duration
  const userSnoozeDuration = activeMember?.snooze_duration || 0;

  // Determine relevant time to show - Robust helper to prevent "Invalid Date"
  const getInitialTime = () => {
    if (!initialData.scheduledTime) return new Date();

    // Attempt 1: Raw ISO string parse
    let date = new Date(initialData.scheduledTime);
    if (!isNaN(date.getTime())) return date;

    // Attempt 2: URL Decode
    try {
      date = new Date(decodeURIComponent(initialData.scheduledTime));
      if (!isNaN(date.getTime())) return date;
    } catch (e) {
      // console.log('[MedicineAlarm] Failed to parse encoded date');
    }

    return new Date();
  };

  const [displayTime, setDisplayTime] = useState(getInitialTime());

  // 2. Parse Medications (Clustered vs Single) - Use useMemo to avoid re-render loops
  const medicationList = React.useMemo<MedicationItem[]>(() => {
      const list: MedicationItem[] = [];

      // A. Check for Clustered Payload (Phase 3)
      if (initialData.activeMedicationIds || initialData.activeMedications) {
        try {
          const safeParse = (jsonStr: string | undefined): any => {
            if (!jsonStr) return null;
            try {
              return JSON.parse(jsonStr);
            } catch (e) {
              try {
                return JSON.parse(decodeURIComponent(jsonStr));
              } catch (e2) {
                console.error(`[MedicineAlarm] Critical Parse Error. Raw: ${jsonStr}`);
                return null;
              }
            }
          };

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
                  list.push({
                    id: id,
                    name: 'Loading Medication...',
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

      return list;
  }, [initialData.activeMedicationIds, initialData.activeMedications, initialData.medicationId, initialData.medicationName, allMedications, initialData.scheduleId, initialData.dosage, initialData.instructions]);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Initialize checks when list changes
  useEffect(() => {
    if (medicationList.length > 0) {
        setCheckedIds(new Set(medicationList.map(m => m.id)));
    }
  }, [medicationList]);

  // --------------------------------------------------------------------------
  // UI & ANIMATION STATE
  // --------------------------------------------------------------------------
  const [isActionTaken, setIsActionTaken] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ visible: boolean; message: string; sub: string }>({ visible: false, message: '', sub: '' });

  // Animations
  const contentFade = useRef(new RNAnimated.Value(0)).current;
  const contentSlide = useRef(new RNAnimated.Value(20)).current;
  const slideAnim = useState(new RNAnimated.Value(300))[0];

  // (Removed ticking clock effect to keep time stable/exact to schedule)

  // Entrance Animation
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(contentFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      RNAnimated.spring(contentSlide, {
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

  // -------------------------------------------------------------------------
  // Reanimated Modal Logic
  // -------------------------------------------------------------------------
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue({ y: 0 });

  useEffect(() => {
    if (showSnoozeModal) {
      translateY.value = withTiming(0, {
        duration: 450,
        easing: Easing.bezier(0.33, 1, 0.68, 1) // Custom ease out
      });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 300,
        easing: Easing.in(Easing.exp)
      });
    }
  }, [showSnoozeModal]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      // Only allow dragging downwards
      translateY.value = Math.max(0, context.value.y + event.translationY);
    })
    .onEnd((event) => {
      // Dismiss if dragged fast enough or far enough
      if (event.velocityY > 500 || translateY.value > SHEET_MAX_HEIGHT * 0.3) {
        runOnJS(closeSnoozeModal)();
      } else {
        // Snap back up
        translateY.value = withTiming(0, { duration: 300 });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [1, 0], Extrapolate.CLAMP),
    pointerEvents: showSnoozeModal ? 'auto' : 'none', // Ensure it doesn't block touches when hidden
  }));

  // Define Snooze Options
  const snoozeOptions = [
    { count: 5, label: '5 Minutes', desc: 'Quick snooze' },
    { count: 10, label: '10 Minutes', desc: 'Standard reminder' },
    { count: 15, label: '15 Minutes', desc: 'Short break' },
    { count: 30, label: '30 Minutes', desc: 'Long delay' },
  ];

  // Add User Preference if unique
  const displayOptions = [...snoozeOptions];
  if (userSnoozeDuration > 0 && !snoozeOptions.find(o => o.count === userSnoozeDuration)) {
    displayOptions.push({
      count: userSnoozeDuration,
      label: `${userSnoozeDuration} Minutes`,
      desc: 'Your custom preference'
    });
    // Sort by count
    displayOptions.sort((a, b) => a.count - b.count);
  }

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

    console.log(`[MedicineAlarm] TAKEN: ${takenMeds.map(m => m.name).join(', ')}`);
    console.log(`[MedicineAlarm] SKIPPED: ${skippedMeds.map(m => m.name).join(', ')}`);

    // DB Updates
    if (user?.id) {
      for (const med of takenMeds) {
        await markAsTaken(user.id, med.id, scheduledDate, scheduledTime);
      }
      for (const med of skippedMeds) {
        await markAsSkipped(user.id, med.id, scheduledDate, scheduledTime);
      }
    }

    if (initialData.scheduleId) {
      const baseId = initialData.scheduleId
        .replace(/_followup(_\d+(_\d{4}-\d{2}-\d{2})?)?/g, '')
        .replace(/_manual/g, '');
      await cancelReminder(baseId);
      await cancelIOSFollowUps(baseId);
      await cancelReminder(`${baseId}_manual`);
    }

    // User Feedback & Close
    const names = takenMeds.map(m => m.name).join(', ');
    const msg = takenMeds.length === medicationList.length ? 'All Clean!' : `${takenMeds.length}/${medicationList.length} Taken`;
    const sub = takenMeds.length > 0 ? `Tracked: ${names}` : 'Medications skipped.';

    // Show Toast then close
    setToast({ visible: true, message: msg, sub: sub });

    // Delay close to allow user to see the success message
    // User requested 5-10s. We'll give 6s for the toast to be readable.
    setTimeout(() => closeScreen(), 6000);
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
      const baseId = initialData.scheduleId
        .replace(/_followup(_\d+(_\d{4}-\d{2}-\d{2})?)?/g, '')
        .replace(/_manual/g, '');
      await cancelReminder(baseId);
      await cancelIOSFollowUps(baseId);
      await cancelReminder(`${baseId}_manual`);
    }

    setToast({ visible: true, message: 'Skipped!', sub: 'Medications will not be tracked.' });
    setTimeout(() => closeScreen(), 6000);
  };

  const handleSnooze = async (minutes: number) => {
    if (isActionTaken) return;
    setIsActionTaken(true);
    closeSnoozeModal();
    Vibration.cancel();

    if (initialData.scheduleId) {
      // Snooze logic needs a single ReminderData object. 
      // We create a wrapper that represents the "Group"
      const baseId = initialData.scheduleId
        .replace(/_followup(_\d+(_\d{4}-\d{2}-\d{2})?)?/g, '')
        .replace(/_manual/g, '');
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

      // Cancel entire pile before rescheduling
      await cancelIOSFollowUps(baseId);
      await snoozeReminder(baseId, reminderData, minutes);
    }

    setToast({ visible: true, message: 'Snoozed!', sub: `Reminding you in ${minutes} minutes.` });
    setTimeout(() => closeScreen(), 1500);
  };

  const closeScreen = () => {
    if (router.canGoBack()) router.back();
    else router.push('/home');
  };

  const closeSnoozeModal = () => {
    RNAnimated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => setShowSnoozeModal(false));
  };

  // --------------------------------------------------------------------------
  // COMPONENTS (INTERNAL)
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // COMPONENTS (INTERNAL)
  // --------------------------------------------------------------------------

  // 1. Theme Detection
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light'; 

  // Theme Colors
  const theme = React.useMemo(() => getTheme(isDark), [isDark]);

    // Removal of ProfessionalBackground and GlowCheckbox from here as they are moved outside

  // --------------------------------------------------------------------------
  // RENDERING
  // --------------------------------------------------------------------------

  // RENDERING
  // --------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: theme.bg[1] }]}>
      <StatusBar translucent barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ProfessionalBackground isDark={isDark} theme={theme} />

      {/* Toast Notification Layer (Z-Index High) */}
      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        subMessage={toast.sub}
        type="success"
        onDismiss={() => {
          setToast(prev => ({ ...prev, visible: false }));
        }}
      />

      {/* Main Content Wrapper - Safe Area for Layout */}
      <SafeAreaView style={{ flex: 1 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.brandingContainer}>
            <Image
              source={require('../assets/app-logo-long.png')}
              style={styles.logoIconLong}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.liveIndicator, { backgroundColor: theme.badgeBg }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: theme.badgeText }]}>ACTIVE</Text>
          </View>
        </View>

        {/* HERO & LIST */}
        <RNAnimated.View
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

          {/* List */}
          <View style={styles.listSection}>
            <View style={styles.listHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PRESCRIBED BUNDLE ({medicationList.length})</Text>
              {medicationList.length > 1 && (
                <TouchableOpacity onPress={() => {
                  const allSelected = checkedIds.size === medicationList.length;
                  if (allSelected) setCheckedIds(new Set());
                  else setCheckedIds(new Set(medicationList.map(m => m.id)));
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
                    style={[styles.listItem, { borderBottomColor: theme.borderColor }]}
                    onPress={() => toggleCheckbox(med.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.itemContent}>
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

                    <GlowCheckbox checked={isChecked} theme={theme} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </RNAnimated.View>

        {/* Bottom Actions - Now inside SafeAreaView for correct bottom padding */}
        <View style={styles.bottomActionsContainer}>
          <View style={styles.actionGrid}>
            {/* 1. TAKEN */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnTaken]}
              onPress={handleTaken}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check" size={24} color={isDark ? "white" : theme.btnActionText} />
              <Text style={[styles.btnTextWhite, { color: theme.btnActionText }]}>Taken ({checkedIds.size})</Text>
            </TouchableOpacity>

            {/* 2. SNOOZE */}
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

            {/* 3. SKIP */}
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

      </SafeAreaView>

      {/* Modern Snooze Modal */}
      <Modal
        visible={showSnoozeModal}
        transparent
        animationType="none" // Controlled by Reanimated
        onRequestClose={() => closeSnoozeModal()}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, animatedOverlayStyle]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSnoozeModal} />
          </Animated.View>

          {/* Draggable Sheet */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.snoozeSheet, animatedSheetStyle]}>
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Snooze Duration</Text>
                <TouchableOpacity onPress={closeSnoozeModal} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={24} color={Colors.gray600} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
                <Text style={styles.sectionHeaderText}>DURATION</Text>

                {displayOptions.map((opt) => (
                  <SnoozeOptionItem
                    key={opt.count}
                    option={opt}
                    isSelected={false}
                    onPress={() => handleSnooze(opt.count)}
                  />
                ))}

              </ScrollView>
            </Animated.View>
          </GestureDetector>
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
  // REPLACED safeArea -> header layout
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 60,
    marginHorizontal: 24, // Keep horz margin
    marginTop: 12, // Slight top spacing inside Safe Area
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconLong: {
    width: 140,
    height: 40,
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
    // Relative to Flex Parent (SafeAreaView), so just padding/margin
    marginTop: 'auto', // Push to bottom
    marginBottom: 20,  // Bottom spacing
    paddingHorizontal: 24,
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
    flex: 1, // Equal width
    borderRadius: 24,
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

  // MODAL & SNOOZE (Redesigned)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  snoozeSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 0, // Reduced from 40
    width: '100%',
    height: Dimensions.get('window').height * 0.5, // Fixed 50% height as requested
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.gray300,
    borderRadius: 3,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray900,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray500,
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: 1,
  },
  verificationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  barLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },

});
