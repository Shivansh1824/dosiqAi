/**
 * FollowUpRemindersSection Component
 * iOS-only picker for configuring follow-up reminder count (0-3)
 * Matches the design pattern of TuneSelectionModal
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Pressable,
    Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolate,
    Easing
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.5;

interface FollowUpRemindersSectionProps {
    value: number; // 0-3
    onChange: (value: number) => void;
    snoozeDuration: number; // For displaying timing info
}

// Follow-up options with descriptions
const FOLLOW_UP_OPTIONS = [
    { value: 0, label: 'No follow-ups', description: 'Only the primary reminder' },
    { value: 1, label: 'One follow-up', description: '1 additional reminder' },
    { value: 2, label: 'Two follow-ups', description: '2 additional reminders' },
    { value: 3, label: 'Three follow-ups', description: 'Maximum persistence' },
];

// Individual Option Item Component
const OptionItem = ({
    option,
    isSelected,
    onPress,
    snoozeDuration,
}: {
    option: typeof FOLLOW_UP_OPTIONS[0];
    isSelected: boolean;
    onPress: () => void;
    snoozeDuration: number;
}) => {
    const scale = useSharedValue(1);
    const backgroundColorProgress = useSharedValue(isSelected ? 1 : 0);

    useEffect(() => {
        backgroundColorProgress.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
        if (isSelected) {
            scale.value = withTiming(1.01, { duration: 150 });
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

    // Calculate timing description
    const getTimingText = () => {
        if (option.value === 0) return 'No additional reminders';
        const totalTime = option.value * snoozeDuration;
        return `Spread over ${totalTime} minutes`;
    };

    return (
        <Animated.View style={[styles.optionBar, animatedStyle]}>
            <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={onPress}
                activeOpacity={0.9}
            >
                <View style={styles.optionContent}>
                    <View style={[
                        styles.optionIcon,
                        { backgroundColor: isSelected ? Colors.primary : '#F1F5F9' }
                    ]}>
                        <Feather
                            name={isSelected ? "check" : "bell"}
                            size={20}
                            color={isSelected ? "white" : Colors.gray400}
                        />
                    </View>

                    <View style={styles.optionTextContainer}>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDescription}>{getTimingText()}</Text>
                    </View>

                    <View style={[
                        styles.countBadge,
                        { backgroundColor: isSelected ? Colors.primary : '#E2E8F0' }
                    ]}>
                        <Text style={[
                            styles.countBadgeText,
                            { color: isSelected ? 'white' : Colors.gray600 }
                        ]}>
                            {option.value}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export const FollowUpRemindersSection: React.FC<FollowUpRemindersSectionProps> = ({
    value,
    onChange,
    snoozeDuration,
}) => {
    const [showModal, setShowModal] = useState(false);
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (showModal) {
            translateY.value = withTiming(0, {
                duration: 450,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
        } else {
            translateY.value = withTiming(SCREEN_HEIGHT, {
                duration: 300,
                easing: Easing.in(Easing.exp)
            });
        }
    }, [showModal]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, context.value.y + event.translationY);
        })
        .onEnd((event) => {
            if (event.velocityY > 500 || translateY.value > SHEET_MAX_HEIGHT * 0.4) {
                runOnJS(handleClose)();
            } else {
                translateY.value = withTiming(0, {
                    duration: 300,
                    easing: Easing.out(Easing.quad)
                });
            }
        });

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const animatedOverlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [1, 0], Extrapolate.CLAMP),
    }));

    const handleClose = () => {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
            runOnJS(setShowModal)(false);
        });
    };

    const handleSelect = (newValue: number) => {
        onChange(newValue);
        // Auto-close after selection (matching TuneSelectionModal behavior)
    };

    // Get current selection label for display
    const currentOption = FOLLOW_UP_OPTIONS.find(opt => opt.value === value) || FOLLOW_UP_OPTIONS[2];

    return (
        <>
            {/* Trigger Bar - matches the style of tune selection */}
            <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Follow-Up Reminders</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                    Configure additional reminders if you miss the primary alert.
                </Text>

                <TouchableOpacity
                    style={styles.triggerBar}
                    onPress={() => setShowModal(true)}
                    activeOpacity={0.9}
                >
                    <View style={styles.triggerContent}>
                        <View style={styles.triggerIcon}>
                            <Feather name="repeat" size={22} color={Colors.primary} />
                        </View>
                        <View style={styles.triggerTextContainer}>
                            <Text style={styles.triggerLabel}>{currentOption.label}</Text>
                            <Text style={styles.triggerDescription}>
                                Every {snoozeDuration} min after primary
                            </Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={Colors.gray400} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Selection Modal */}
            <Modal
                visible={showModal}
                transparent={true}
                animationType="none"
                onRequestClose={handleClose}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, animatedOverlayStyle]}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                    </Animated.View>

                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.sheetContainer, animatedSheetStyle]}>
                            <View style={styles.dragHandleContainer}>
                                <View style={styles.dragHandle} />
                            </View>

                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle}>Follow-Up Reminders</Text>
                                <TouchableOpacity onPress={handleClose}>
                                    <Feather name="x" size={24} color={Colors.gray600} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.optionsContainer}>
                                {FOLLOW_UP_OPTIONS.map((option) => (
                                    <OptionItem
                                        key={option.value}
                                        option={option}
                                        isSelected={value === option.value}
                                        onPress={() => handleSelect(option.value)}
                                        snoozeDuration={snoozeDuration}
                                    />
                                ))}
                            </View>
                        </Animated.View>
                    </GestureDetector>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    // Section styles (matching PreferenceOnboardingScreen)
    sectionContainer: {
        marginBottom: 24,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.gray800,
        letterSpacing: -0.3,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: Colors.gray500,
        marginBottom: 16,
        lineHeight: 18,
    },

    // Trigger bar styles
    triggerBar: {
        backgroundColor: '#F0F9FF',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: Colors.primary + '30',
        overflow: 'hidden',
    },
    triggerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    triggerIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    triggerTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    triggerLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.gray800,
    },
    triggerDescription: {
        fontSize: 12,
        color: Colors.gray500,
        marginTop: 2,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SHEET_MAX_HEIGHT,
        width: '100%',
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
        paddingHorizontal: Sizes.lg,
        paddingBottom: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray800,
    },
    optionsContainer: {
        padding: 16,
        paddingBottom: 40,
    },

    // Option item styles
    optionBar: {
        height: 68,
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
    },
    optionContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
    },
    optionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.gray800,
    },
    optionDescription: {
        fontSize: 12,
        color: Colors.gray500,
        marginTop: 2,
    },
    countBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countBadgeText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
