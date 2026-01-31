import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, TextInput, Switch, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing, interpolateColor } from 'react-native-reanimated';
import { Colors, Sizes, Typography } from '../constants';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabaseClient';
import Svg, { Path, Line, G, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { TuneSelectionModal } from '../components/TuneSelectionModal';
import { FollowUpRemindersSection } from '../components/FollowUpRemindersSection';
import { Tune, getAppTunes, getDefaultTune, findTuneByFilename, getSystemTunes } from '../services/tuneService';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { rescheduleAllNotificationsForMember } from '../services/notificationService';


export default function PreferenceOnboardingScreen() {
    const navigation = useNavigation();

    // State for Time Preferences
    const [morningTime, setMorningTime] = useState(new Date());
    const [afternoonTime, setAfternoonTime] = useState(new Date());
    const [nightTime, setNightTime] = useState(new Date());

    // State for Snooze Preferences
    const [snoozeDuration, setSnoozeDuration] = useState(5); // default 5 mins
    const [customSnooze, setCustomSnooze] = useState('');
    const [isCustomSnooze, setIsCustomSnooze] = useState(false);
    const [isEditingCustom, setIsEditingCustom] = useState(false);

    // State for Reminder Style (Android)
    const [isAggressive, setIsAggressive] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [showAlertTooltip, setShowAlertTooltip] = useState(false);
    const [showSnoozeTooltip, setShowSnoozeTooltip] = useState(false);
    const [showDoseTooltip, setShowDoseTooltip] = useState(false);

    // State for iOS Follow-Up Reminders (iOS only)
    const [iosFollowUpCount, setIosFollowUpCount] = useState(0); // Default: 0 follow-ups

    const [selectedTune, setSelectedTune] = useState<Tune>(getDefaultTune());
    const [systemTunesCache, setSystemTunesCache] = useState<Tune[]>([]);
    const [showTuneModal, setShowTuneModal] = useState(false);
    const [showTuneTooltip, setShowTuneTooltip] = useState(false);


    // Picker visibility states (for Android mainly, but useful for logic separation)
    const [showMorningPicker, setShowMorningPicker] = useState(false);
    const [showAfternoonPicker, setShowAfternoonPicker] = useState(false);
    const [showNightPicker, setShowNightPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasInitialLoaded, setHasInitialLoaded] = useState(false);

    const snoozeOptions = [5, 10, 15];

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('family_members')
                .select('*')
                .eq('user_id', user.id)
                .eq('relationship', 'Self')
                .single();

            if (error) {
                console.error('Error fetching preferences from family_members:', error);
                return;
            }

            if (data) {
                const parseTime = (timeStr: string) => {
                    const [hours, minutes] = timeStr.split(':');
                    const d = new Date();
                    d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    return d;
                };

                setMorningTime(parseTime(data.morning_dose_time));
                setAfternoonTime(parseTime(data.afternoon_dose_time));
                setNightTime(parseTime(data.night_dose_time));

                setSnoozeDuration(data.snooze_duration);
                const presetIndex = snoozeOptions.indexOf(data.snooze_duration);

                if (presetIndex !== -1) {
                    setIsCustomSnooze(false);
                    indicatorPosition.value = presetIndex;
                } else {
                    setIsCustomSnooze(true);
                    setCustomSnooze(data.snooze_duration.toString());
                    indicatorPosition.value = 3;
                }

                setIsAggressive(data.reminder_style === 'assurance');

                // iOS Follow-Up Count
                if (typeof data.ios_followup_count === 'number') {
                    setIosFollowUpCount(data.ios_followup_count);
                }
                // Load tune preference (need to fetch system tunes first for matching)
                if (data.notification_tune) {
                    // First try to find in app tunes
                    let savedTune = findTuneByFilename(data.notification_tune);
                    if (savedTune) {
                        setSelectedTune(savedTune);
                    } else {
                        // Fetch system tunes to find match
                        const systemTunes = await getSystemTunes();
                        setSystemTunesCache(systemTunes);
                        savedTune = findTuneByFilename(data.notification_tune, systemTunes);
                        if (savedTune) {
                            setSelectedTune(savedTune);
                        }
                    }
                }
            }
            setTimeout(() => setHasInitialLoaded(true), 1000); // Delay to prevent immediate save on mount
        } catch (err) {
            console.error('Unexpected error fetching preferences:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (!hasInitialLoaded) return;

        const timer = setTimeout(() => {
            performSave();
        }, 1500); // 1.5s debounce

        return () => clearTimeout(timer);
    }, [morningTime, afternoonTime, nightTime, snoozeDuration, customSnooze, isCustomSnooze, isAggressive, iosFollowUpCount, selectedTune, hasInitialLoaded]);

    const performSave = async (silent = true) => {
        try {
            setSaveStatus('saving');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const formatTimeToDB = (date: Date) => {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}:00`;
            };

            const preferences = {
                user_id: user.id,
                morning_dose_time: formatTimeToDB(morningTime),
                afternoon_dose_time: formatTimeToDB(afternoonTime),
                night_dose_time: formatTimeToDB(nightTime),
                snooze_duration: effectiveSnooze,
                reminder_style: (isAggressive ? 'assurance' : 'standard') as 'assurance' | 'standard',
                notification_tune: selectedTune.filename,
                ios_followup_count: iosFollowUpCount,
                updated_at: new Date().toISOString(),
            };

            const { data: memberData, error: memberError } = await supabase
                .from('family_members')
                .select('id')
                .eq('user_id', user.id)
                .eq('relationship', 'Self')
                .single();

            if (memberError || !memberData) throw new Error('Could not find primary family profile');

            const { error } = await supabase
                .from('family_members')
                .update(preferences)
                .eq('id', memberData.id);

            if (error) throw error;

            // Update local store state immediately
            try {
                await useFamilyMembersStore.getState().updateFamilyMember(memberData.id, preferences);
                console.log('Local store updated with new preferences');
                
                // Reschedule all notifications for this member with new settings
                await rescheduleAllNotificationsForMember(memberData.id);
            } catch (localError) {
                console.warn('Failed to update local state/reschedule:', localError);
                // We don't throw here to avoid failing the "Save" UI feedback since DB save worked
            }

            setSaveStatus('saved');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Clear "Saved" status after 3 seconds
            setTimeout(() => {
                setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
            }, 3000);

        } catch (error) {
            console.error('Error auto-saving preferences:', error);
            setSaveStatus('error');
        }
    };


    const handleTimeChange = (event: any, selectedDate: Date | undefined, setter: (date: Date) => void, visibilitySetter: (v: boolean) => void) => {
        if (Platform.OS === 'android') {
            visibilitySetter(false);
        }
        if (selectedDate) {
            setter(selectedDate);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };


    const effectiveSnooze = isCustomSnooze && customSnooze ? (parseInt(customSnooze) || snoozeDuration) : snoozeDuration;

    // Animation for Snooze Selector
    const containerWidth = useSharedValue(0);
    const indicatorPosition = useSharedValue(0);

    const animatedIndicatorStyle = useAnimatedStyle(() => {
        // Precise content width calculation (Container - 2x Padding)
        const contentWidth = Math.max(0, containerWidth.value - 12);
        const stepWidth = contentWidth / 4;

        // If layout hasn't happened yet, hide logic to avoid jump
        if (contentWidth === 0) return { opacity: 0 };

        return {
            opacity: 1,
            transform: [{
                translateX: withSpring(indicatorPosition.value * stepWidth, {
                    damping: 15,
                    stiffness: 150,
                    mass: 0.8
                })
            }],
            width: stepWidth,
        };
    });

    const updateSnooze = (index: number) => {
        // Directly set shared value for responsiveness
        indicatorPosition.value = index;

        if (index < 3) {
            setSnoozeDuration(snoozeOptions[index]);
            setIsCustomSnooze(false);
            setIsEditingCustom(false);
        } else {
            setIsCustomSnooze(true);
            setIsEditingCustom(true);
        }
    };

    const renderTooltip = () => (
        <Modal
            visible={showTooltip}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowTooltip(false)}
        >
            <Pressable style={styles.tooltipOverlay} onPress={() => setShowTooltip(false)}>
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.tooltipContent}>
                    <View style={styles.tooltipHeader}>
                        <Feather name="info" size={20} color={Colors.primary} />
                        <Text style={styles.tooltipTitle}>Reminder Styles Explanation</Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipSectionTitle}>Standard Mode</Text>
                        <Text style={styles.tooltipText}>
                            Receive a notification at the scheduled time. If no action is taken, we'll send <Text style={{ fontWeight: '700' }}>one follow-up reminder</Text> after {effectiveSnooze} minutes. If still no response, the dose is marked as skipped.
                        </Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipSectionTitle}>Assurance Mode</Text>
                        <Text style={styles.tooltipText}>
                            The golden standard for critical meds. We'll send the initial alert, followed by <Text style={{ fontWeight: '700' }}>up to 4 follow-up reminders every {effectiveSnooze} minutes</Text> until your health is confirmed as tracked.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.closeTooltipButton} onPress={() => setShowTooltip(false)}>
                        <Text style={styles.closeTooltipButtonText}>Got it</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>
        </Modal>
    );

    const renderDoseTooltip = () => (
        <Modal
            visible={showDoseTooltip}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDoseTooltip(false)}
        >
            <Pressable style={styles.tooltipOverlay} onPress={() => setShowDoseTooltip(false)}>
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.tooltipContent}>
                    <View style={styles.tooltipHeader}>
                        <Feather name="clock" size={20} color={Colors.primary} />
                        <Text style={styles.tooltipTitle}>Dose Groups Explained</Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipText}>
                            Setting these times helps us organize your medications into <Text style={{ fontWeight: '700' }}>Morning, Afternoon, and Night groups</Text>.
                        </Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipText}>
                            These will be the <Text style={{ fontWeight: '700' }}>default times</Text> for any medication assigned to these groups in your verification card.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.closeTooltipButton} onPress={() => setShowDoseTooltip(false)}>
                        <Text style={styles.closeTooltipButtonText}>Got it</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>
        </Modal>
    );

    const renderSnoozeTooltip = () => (
        <Modal
            visible={showSnoozeTooltip}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowSnoozeTooltip(false)}
        >
            <Pressable style={styles.tooltipOverlay} onPress={() => setShowSnoozeTooltip(false)}>
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.tooltipContent}>
                    <View style={styles.tooltipHeader}>
                        <Feather name="clock" size={20} color={Colors.primary} />
                        <Text style={styles.tooltipTitle}>Default Snooze Logic</Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipText}>
                            Your selected duration becomes the <Text style={{ fontWeight: '700' }}>default time</Text> for all reminders.
                        </Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <Feather name="alert-circle" size={16} color={Colors.primary} style={{ marginTop: 2, marginRight: 8 }} />
                            <Text style={[styles.tooltipText, { flex: 1 }]}>
                                <Text style={{ fontWeight: '700' }}>Alarm Screen:</Text> You can quickly adjust the snooze time when the alarm rings.
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
                            <Feather name="bell" size={16} color={Colors.primary} style={{ marginTop: 2, marginRight: 8 }} />
                            <Text style={[styles.tooltipText, { flex: 1 }]}>
                                <Text style={{ fontWeight: '700' }}>Notifications:</Text> Simple banner alerts will use this default time as they don't support custom adjustments.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.closeTooltipButton} onPress={() => setShowSnoozeTooltip(false)}>
                        <Text style={styles.closeTooltipButtonText}>Got it</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>
        </Modal>
    );

    const renderTuneTooltip = () => (
        <Modal
            visible={showTuneTooltip}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowTuneTooltip(false)}
        >
            <Pressable style={styles.tooltipOverlay} onPress={() => setShowTuneTooltip(false)}>
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.tooltipContent}>
                    <View style={styles.tooltipHeader}>
                        <Feather name="music" size={20} color={Colors.primary} />
                        <Text style={styles.tooltipTitle}>Medication Tune</Text>
                    </View>

                    <View style={styles.tooltipSection}>
                        <Text style={styles.tooltipText}>
                            Select a notification sound that will play for all your medication reminders. Choose from different tune durations to suit your preference.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.closeTooltipButton} onPress={() => setShowTuneTooltip(false)}>
                        <Text style={styles.closeTooltipButtonText}>Got it</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>
        </Modal>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: Colors.gray600, fontWeight: '600' }}>Loading your preferences...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Soft Ambient Background */}
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient
                    colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
                    style={StyleSheet.absoluteFillObject}
                />
            </View>

            {renderTooltip()}
            {renderTuneTooltip()}
            <TuneSelectionModal
                visible={showTuneModal}
                onClose={() => setShowTuneModal(false)}
                selectedTune={selectedTune}
                onSelectTune={setSelectedTune}
            />
            {renderSnoozeTooltip()}
            {renderDoseTooltip()}

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                        <Feather name="arrow-left" size={24} color={Colors.gray800} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Customize Experience</Text>
                        <View style={styles.headerDot} />
                    </View>
                    <View style={styles.headerStatusContainer}>
                        {saveStatus === 'saving' && (
                            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.statusIndicator}>
                                <ActivityIndicator size="small" color={Colors.primary} style={{ transform: [{ scale: 0.8 }] }} />
                                <Text style={styles.statusText}>Saving...</Text>
                            </Animated.View>
                        )}
                        {saveStatus === 'saved' && (
                            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.statusIndicator}>
                                <Feather name="check-circle" size={14} color="#10B981" />
                                <Text style={[styles.statusText, { color: '#10B981' }]}>Saved</Text>
                            </Animated.View>
                        )}
                        {saveStatus === 'error' && (
                            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.statusIndicator}>
                                <Feather name="alert-circle" size={14} color="#EF4444" />
                                <Text style={[styles.statusText, { color: '#EF4444' }]}>Retry</Text>
                            </Animated.View>
                        )}
                    </View>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Dose Times Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Preferred Dose Times</Text>
                            <TouchableOpacity onPress={() => setShowDoseTooltip(true)} style={styles.infoButton}>
                                <Feather name="info" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionSubtitle}>Define your daily routine for automated dose grouping.</Text>

                        {/* Morning */}
                        <TouchableOpacity
                            style={[styles.verificationBar, { height: 54, marginBottom: 8 }]}
                            onPress={() => setShowMorningPicker(true)}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#FED7AA', '#FFF7ED']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.barGraphics}>
                                <Svg height="36" width="36" viewBox="0 0 40 40">
                                    <G opacity="0.6" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round">
                                        <Line x1="20" y1="2" x2="20" y2="8" />
                                        <Line x1="7" y1="9" x2="11" y2="13" />
                                        <Line x1="33" y1="9" x2="29" y2="13" />
                                        <Line x1="2" y1="20" x2="8" y2="20" />
                                        <Line x1="38" y1="20" x2="32" y2="20" />
                                    </G>
                                    <Path d="M 6 24 A 14 14 0 0 1 34 24 Z" fill="#F97316" />
                                    <Line x1="4" y1="26" x2="36" y2="26" stroke="#F97316" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" />
                                </Svg>
                            </View>
                            <View style={styles.barContent}>
                                <Text style={[styles.barLabel, { color: '#C2410C' }]}>Morning Dose</Text>
                                <View style={styles.barRight}>
                                    <Text style={[styles.barTime, { color: '#9A3412' }]}>{formatTime(morningTime)}</Text>
                                    <View style={{ width: 8 }} />
                                    <Feather name="chevron-right" size={16} color="#F97316" opacity={0.5} />
                                </View>
                            </View>
                        </TouchableOpacity>
                        {showMorningPicker && (
                            Platform.OS === 'ios' ? (
                                <Modal
                                    visible={showMorningPicker}
                                    transparent={true}
                                    animationType="slide"
                                    onRequestClose={() => setShowMorningPicker(false)}
                                >
                                    <View style={styles.iosPickerModalOverlay}>
                                        <View style={styles.iosPickerContainer}>
                                            <View style={styles.iosPickerHeader}>
                                                <TouchableOpacity onPress={() => setShowMorningPicker(false)}>
                                                    <Text style={styles.iosPickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <DateTimePicker
                                                value={morningTime}
                                                mode="time"
                                                display="spinner"
                                                onChange={(e, d) => handleTimeChange(e, d, setMorningTime, setShowMorningPicker)}
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={morningTime}
                                    mode="time"
                                    display="default"
                                    onChange={(e, d) => handleTimeChange(e, d, setMorningTime, setShowMorningPicker)}
                                />
                            )
                        )}

                        {/* Afternoon */}
                        <TouchableOpacity
                            style={[styles.verificationBar, { height: 54, marginBottom: 8 }]}
                            onPress={() => setShowAfternoonPicker(true)}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#FEF9C3', '#FFFFFF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.barGraphics}>
                                <Svg height="36" width="36" viewBox="0 0 40 40">
                                    <G opacity="0.6" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round">
                                        <Line x1="20" y1="2" x2="20" y2="6" />
                                        <Line x1="20" y1="38" x2="20" y2="34" />
                                        <Line x1="2" y1="20" x2="6" y2="20" />
                                        <Line x1="38" y1="20" x2="34" y2="20" />
                                        <Line x1="7.3" y1="7.3" x2="10" y2="10" />
                                        <Line x1="32.7" y1="7.3" x2="30" y2="10" />
                                        <Line x1="7.3" y1="32.7" x2="10" y2="30" />
                                        <Line x1="32.7" y1="32.7" x2="30" y2="30" />
                                    </G>
                                    <Circle cx="20" cy="20" r="9" fill="#D97706" />
                                </Svg>
                            </View>
                            <View style={styles.barContent}>
                                <Text style={[styles.barLabel, { color: '#B45309' }]}>Afternoon Dose</Text>
                                <View style={styles.barRight}>
                                    <Text style={[styles.barTime, { color: '#92400E' }]}>{formatTime(afternoonTime)}</Text>
                                    <View style={{ width: 8 }} />
                                    <Feather name="chevron-right" size={16} color="#D97706" opacity={0.5} />
                                </View>
                            </View>
                        </TouchableOpacity>
                        {showAfternoonPicker && (
                            Platform.OS === 'ios' ? (
                                <Modal
                                    visible={showAfternoonPicker}
                                    transparent={true}
                                    animationType="slide"
                                    onRequestClose={() => setShowAfternoonPicker(false)}
                                >
                                    <View style={styles.iosPickerModalOverlay}>
                                        <View style={styles.iosPickerContainer}>
                                            <View style={styles.iosPickerHeader}>
                                                <TouchableOpacity onPress={() => setShowAfternoonPicker(false)}>
                                                    <Text style={styles.iosPickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <DateTimePicker
                                                value={afternoonTime}
                                                mode="time"
                                                display="spinner"
                                                onChange={(e, d) => handleTimeChange(e, d, setAfternoonTime, setShowAfternoonPicker)}
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={afternoonTime}
                                    mode="time"
                                    display="default"
                                    onChange={(e, d) => handleTimeChange(e, d, setAfternoonTime, setShowAfternoonPicker)}
                                />
                            )
                        )}

                        {/* Night */}
                        <TouchableOpacity
                            style={[styles.verificationBar, { height: 54, marginBottom: 8 }]}
                            onPress={() => setShowNightPicker(true)}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#0F172A', '#F1F5F9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.barGraphics}>
                                <Svg height="36" width="36" viewBox="0 0 40 40">
                                    <Path d="M 28 20 A 10 10 0 1 1 15 7.5 A 8 8 0 0 0 28 20 Z" fill="#FCD34D" />
                                    <Circle cx="8" cy="12" r="1.5" fill="#FEF08A" opacity="0.8" />
                                    <Circle cx="32" cy="8" r="1" fill="#FEF08A" opacity="0.6" />
                                    <Circle cx="35" cy="25" r="1.5" fill="#FEF08A" opacity="0.7" />
                                </Svg>
                            </View>
                            <View style={styles.barContent}>
                                <Text style={[styles.barLabel, { color: '#F8FAFC' }]}>Night Dose</Text>
                                <View style={styles.barRight}>
                                    <Text style={[styles.barTime, { color: '#475569' }]}>{formatTime(nightTime)}</Text>
                                    <View style={{ width: 8 }} />
                                    <Feather name="chevron-right" size={16} color="#64748B" />
                                </View>
                            </View>
                        </TouchableOpacity>
                        {showNightPicker && (
                            Platform.OS === 'ios' ? (
                                <Modal
                                    visible={showNightPicker}
                                    transparent={true}
                                    animationType="slide"
                                    onRequestClose={() => setShowNightPicker(false)}
                                >
                                    <View style={styles.iosPickerModalOverlay}>
                                        <View style={styles.iosPickerContainer}>
                                            <View style={styles.iosPickerHeader}>
                                                <TouchableOpacity onPress={() => setShowNightPicker(false)}>
                                                    <Text style={styles.iosPickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <DateTimePicker
                                                value={nightTime}
                                                mode="time"
                                                display="spinner"
                                                onChange={(e, d) => handleTimeChange(e, d, setNightTime, setShowNightPicker)}
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={nightTime}
                                    mode="time"
                                    display="default"
                                    onChange={(e, d) => handleTimeChange(e, d, setNightTime, setShowNightPicker)}
                                />
                            )
                        )}
                    </View>

                    {/* Snooze Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Snooze Duration</Text>
                            <TouchableOpacity onPress={() => setShowSnoozeTooltip(true)} style={styles.infoButton}>
                                <Feather name="info" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionSubtitle}>Set your preferred frequency for follow-up alerts.</Text>

                        <View
                            style={styles.liquidContainer}
                            onLayout={(e) => {
                                containerWidth.value = e.nativeEvent.layout.width;
                            }}
                        >
                            <Animated.View style={[styles.liquidIndicator, animatedIndicatorStyle]} />
                            {snoozeOptions.map((option, index) => (
                                <TouchableOpacity
                                    key={option}
                                    style={styles.liquidChip}
                                    onPress={() => updateSnooze(index)}
                                >
                                    <Text style={[
                                        styles.liquidChipText,
                                        snoozeDuration === option && !isCustomSnooze && styles.liquidChipTextActive
                                    ]}>{option} min</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={styles.liquidChip}
                                onPress={() => updateSnooze(3)}
                            >
                                <Text style={[
                                    styles.liquidChipText,
                                    isCustomSnooze && styles.liquidChipTextActive
                                ]}>
                                    {isCustomSnooze && customSnooze && !isEditingCustom
                                        ? `${customSnooze} min`
                                        : 'Custom'
                                    }
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {isCustomSnooze && isEditingCustom && (
                            <View style={styles.customInputContainer}>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder="Enter minutes"
                                    keyboardType="number-pad"
                                    value={customSnooze}
                                    onChangeText={setCustomSnooze}
                                    placeholderTextColor={Colors.gray400}
                                    autoFocus={true}
                                    returnKeyType="done"
                                    onSubmitEditing={() => setIsEditingCustom(false)}
                                    blurOnSubmit={true}
                                />
                                <TouchableOpacity
                                    onPress={() => setIsEditingCustom(false)}
                                    style={styles.tickButton}
                                >
                                    <Feather name="check" size={20} color={Colors.white} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Reminder Style / Follow-Up Section - Platform Specific */}
                    {Platform.OS === 'android' ? (
                        // Android: Keep existing Reminder Style toggle
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Reminder Style</Text>
                                <TouchableOpacity onPress={() => setShowTooltip(true)} style={styles.infoButton}>
                                    <Feather name="info" size={18} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.reminderCard, !isAggressive && styles.reminderCardActive]}>
                                {!isAggressive && (
                                    <LinearGradient
                                        colors={['#BAE6FD', '#F0F9FF']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                )}
                                <View style={styles.reminderContent}>
                                    <View style={styles.reminderIcon}>
                                        <Feather name="bell" size={24} color="#0284C7" />
                                    </View>
                                    <View style={styles.reminderTextContent}>
                                        <Text style={styles.reminderTitle}>Standard Mode</Text>
                                        <Text style={styles.reminderDesc}>Two gentle reminders before auto-skip</Text>
                                    </View>
                                </View>
                                <Switch
                                    trackColor={{ false: "#D1D5DB", true: Colors.primary }}
                                    thumbColor="#FFFFFF"
                                    ios_backgroundColor="#D1D5DB"
                                    onValueChange={(val) => {
                                        setIsAggressive(!val);
                                    }}
                                    value={!isAggressive}
                                />
                            </View>

                            <View style={[styles.reminderCard, isAggressive && styles.reminderCardActiveAssurance, { marginTop: Sizes.md }]}>
                                {isAggressive && (
                                    <LinearGradient
                                        colors={['#C7D2FE', '#F5F3FF']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                )}
                                <View style={styles.reminderContent}>
                                    <View style={styles.reminderIcon}>
                                        <Feather name="shield" size={24} color="#6366F1" />
                                    </View>
                                    <View style={styles.reminderTextContent}>
                                        <Text style={styles.reminderTitle}>Assurance Mode</Text>
                                        <Text style={styles.reminderDesc}>Five persistent reminders for complete safety</Text>
                                    </View>
                                </View>
                                <Switch
                                    trackColor={{ false: "#D1D5DB", true: "#6366F1" }}
                                    thumbColor="#FFFFFF"
                                    ios_backgroundColor="#D1D5DB"
                                    onValueChange={(val) => {
                                        setIsAggressive(val);
                                    }}
                                    value={isAggressive}
                                />
                            </View>
                        </View>
                    ) : (
                        // iOS: Show Follow-Up Reminders picker
                        <FollowUpRemindersSection
                            value={iosFollowUpCount}
                            onChange={setIosFollowUpCount}
                            snoozeDuration={effectiveSnooze}
                        />
                    )}

                    {/* Tune Selection Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Tune Selection</Text>
                            <TouchableOpacity onPress={() => setShowTuneTooltip(true)} style={styles.infoButton}>
                                <Feather name="info" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionSubtitle}>Choose the sound for your medication reminders.</Text>

                        <TouchableOpacity
                            style={[styles.verificationBar, { height: 64, marginBottom: 8, backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
                            onPress={() => setShowTuneModal(true)}
                            activeOpacity={0.9}
                        >
                            <View style={[styles.reminderIcon, { marginLeft: 12, backgroundColor: '#E0F2FE' }]}>
                                <Feather name="music" size={24} color={Colors.primary} />
                            </View>
                            <View style={[styles.barContent, { paddingLeft: 12 }]}>
                                <Text style={[styles.barLabel, { color: Colors.gray800, fontSize: 16 }]}>{selectedTune.name}</Text>
                                <View style={styles.barRight}>
                                    <Feather name="chevron-right" size={20} color={Colors.primary} opacity={0.8} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 32 }} />

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    backgroundWash: {
        position: 'absolute',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingVertical: Sizes.md,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    headerTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.gray800,
        letterSpacing: -0.5,
    },
    headerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
        marginLeft: 6,
        marginTop: 10,
    },
    headerStatusContainer: {
        width: 70,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.gray600,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Sizes.lg,
        paddingBottom: Sizes.xl,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: Typography.h5,
        fontWeight: '700',
        color: Colors.gray800,
    },
    infoButton: {
        marginLeft: 8,
        padding: 4,
    },
    sectionSubtitle: {
        fontSize: Typography.bodySmall,
        color: Colors.gray500,
        marginBottom: Sizes.lg,
    },
    sectionContainer: {
        marginTop: 0,
    },
    // Unified interactive bars (2026 Glassmorphism style)
    verificationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    barGraphics: {
        position: 'absolute',
        top: 9,
        left: 10,
        zIndex: 1,
    },
    barContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 52,
        paddingRight: 12,
        zIndex: 2,
    },
    barLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    barRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    barTime: {
        fontSize: 13,
        fontWeight: '900',
    },
    // Legacy mapping (just in case they're still used elsewhere)
    timeCard: {
        // ... handled by verificationBar
    },
    timeLabel: {
        // ... handled by barLabel
    },
    timeText: {
        // ... handled by barTime
    },
    hiddenPicker: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.02,
    },
    // Chips
    chipContainer: {
        flexDirection: 'row',
        marginBottom: Sizes.md,
    },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 24,
        backgroundColor: Colors.gray100,
        marginRight: Sizes.sm,
        borderWidth: 1,
        borderColor: Colors.gray200,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: Typography.body,
        color: Colors.gray600,
        fontWeight: '500',
    },
    chipTextActive: {
        color: Colors.white,
    },
    // Liquid Chips
    liquidContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 20,
        padding: 6,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    liquidChip: {
        flex: 1,
        // Match the indicator's height (Container Padding = 6, Height = ~54 - 12 = 42)
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    liquidIndicator: {
        position: 'absolute',
        top: 6,
        left: 6,
        bottom: 6,
        backgroundColor: Colors.white,
        borderRadius: 14,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 3,
        zIndex: 1,
    },
    liquidChipText: {
        fontSize: 14,
        color: Colors.gray400,
        fontWeight: '700',
        letterSpacing: -0.2,
        width: '100%',
        textAlign: 'center',
    },
    liquidChipTextActive: {
        color: Colors.primary,
    },
    customInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Sizes.md,
        backgroundColor: Colors.white,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: Sizes.radiusMd,
        paddingHorizontal: Sizes.md,
        paddingVertical: Sizes.xs,
    },
    customInput: {
        flex: 1,
        fontSize: Typography.body,
        color: Colors.gray800,
        paddingVertical: 8,
    },
    tickButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Sizes.sm,
    },
    customInputSuffix: {
        fontSize: Typography.body,
        color: Colors.gray500,
        marginLeft: Sizes.sm,
    },
    // Reminder & Alert Cards (Glassmorphism style)
    reminderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.8)',
        minHeight: 54,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        overflow: 'hidden',
    },
    reminderCardActive: {
        borderColor: Colors.primary + '50',
    },
    reminderCardActiveAssurance: {
        borderColor: '#6366F1AA',
    },
    reminderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: Sizes.md,
        zIndex: 2,
    },
    reminderIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    reminderTextContent: {
        flex: 1,
    },
    reminderTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.gray800,
        letterSpacing: -0.3,
    },
    reminderDesc: {
        fontSize: 10,
        color: Colors.gray600,
        fontWeight: '500',
        marginTop: 0,
    },
    // Tooltip Styles
    tooltipOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Sizes.xl,
    },
    tooltipContent: {
        backgroundColor: Colors.white,
        borderRadius: Sizes.radiusLg,
        padding: Sizes.xl,
        width: '100%',
        maxWidth: 340,
        ...Sizes.shadows.xl,
    },
    tooltipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Sizes.lg,
    },
    tooltipTitle: {
        fontSize: Typography.h5,
        fontWeight: '700',
        color: Colors.gray800,
        marginLeft: Sizes.sm,
    },
    tooltipSection: {
        marginBottom: Sizes.lg,
    },
    tooltipSectionTitle: {
        fontSize: Typography.bodyLarge,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 6,
    },
    tooltipText: {
        fontSize: Typography.bodySmall,
        color: Colors.gray600,
        lineHeight: 20,
    },
    closeTooltipButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: Sizes.radiusFull,
        alignItems: 'center',
        marginTop: Sizes.sm,
    },
    closeTooltipButtonText: {
        color: Colors.white,
        fontSize: Typography.body,
        fontWeight: '600',
    },
    // Action Button Patterns (Redesigned to match Prescription Summary)
    actionButtonContainer: {
        alignItems: 'center',
        width: '100%',
        marginTop: 12,
    },
    saveButton: {
        width: 300,
        alignSelf: 'center',
        borderRadius: 16,
        // Shadow for iOS
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        // Elevation for Android
        elevation: 4,
        overflow: 'hidden',
    },
    saveGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    saveButtonText: {
        color: Colors.white,
        fontWeight: '800', // Heavy weight to match summary primary action
        fontSize: 16,
        letterSpacing: 0.5,
    },
    // iOS Picker Modal Styles
    iosPickerModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    iosPickerContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Sizes.xl,
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingVertical: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    iosPickerDoneText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '700',
    },
});
