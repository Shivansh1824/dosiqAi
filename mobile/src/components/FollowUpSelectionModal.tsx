import React, { useEffect } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    Modal, 
    StyleSheet, 
    Pressable, 
    ScrollView, 
    Dimensions
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import Animated, { 
    useAnimatedStyle, 
    withTiming, 
    useSharedValue, 
    runOnJS,
    interpolate,
    Extrapolate,
    Easing
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.8;
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.5;

interface FollowUpOption {
    count: number;
    label: string;
    desc: string;
}

interface FollowUpSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    selectedValue: number;
    onSelect: (value: number) => void;
    snoozeDuration: number;
}

// Individual Option Item Component
const OptionItem = ({ option, isSelected, onPress }: { 
    option: FollowUpOption; 
    isSelected: boolean; 
    onPress: () => void;
}) => {
    // Animation shared values
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

    return (
        <Animated.View style={[styles.verificationBar, animatedStyle, { marginBottom: 10, height: 60 }]}>
            <TouchableOpacity 
                style={StyleSheet.absoluteFill}
                onPress={onPress}
                activeOpacity={0.9}
            >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                    <View style={{ 
                        width: 40, height: 40, borderRadius: 20, 
                        backgroundColor: isSelected ? Colors.primary : '#F1F5F9',
                        justifyContent: 'center', alignItems: 'center',
                    }}>
                        <Feather 
                            name={isSelected ? "check" : "bell"} 
                            size={20} 
                            color={isSelected ? "white" : Colors.gray400} 
                        />
                    </View>
                    
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.barLabel, { fontSize: 15 }]} numberOfLines={1}>{option.label}</Text>
                        <Text style={{ fontSize: 11, color: Colors.gray500 }}>{option.desc}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Section Header Component
const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
);

export const FollowUpSelectionModal: React.FC<FollowUpSelectionModalProps> = ({ 
    visible, 
    onClose, 
    selectedValue, 
    onSelect,
    snoozeDuration
}) => {
    const options: FollowUpOption[] = [
        { count: 0, label: 'None', desc: 'No follow-up reminders' },
        { count: 1, label: '1 Follow-up', desc: `Reminds again after ${snoozeDuration}m` },
        { count: 2, label: '2 Follow-ups', desc: `Recommended for reliability` },
        { count: 3, label: '3 Follow-ups', desc: `Maximum persistence` },
    ];

    const translateY = useSharedValue(SCREEN_HEIGHT);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (visible) {
            // Using for smooth entry without bounce
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
    }, [visible]);

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

    const animatedSheetStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    const animatedOverlayStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [1, 0], Extrapolate.CLAMP),
        };
    });

    const handleClose = () => {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
            runOnJS(onClose)();
        });
    };

    const handleSelectOption = (count: number) => {
        onSelect(count);
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="none" // Use custom animation
            onRequestClose={handleClose}
        >
            <View style={styles.iosPickerModalOverlay}>
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, animatedOverlayStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                </Animated.View>
                
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.iosPickerContainer, animatedSheetStyle]}>
                        <View style={styles.dragHandleContainer}>
                            <View style={styles.dragHandle} />
                        </View>
                        
                        <View style={styles.iosPickerHeader}>
                            <Text style={styles.sectionTitle}>Follow-Up Reminders</Text>
                            <TouchableOpacity onPress={handleClose}>
                                <Feather name="x" size={24} color={Colors.gray600} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView 
                            style={styles.scrollView} 
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={true}
                            bounces={false}
                        >
                            <SectionHeader title="FREQUENCY" />

                            {options.map((option) => (
                                <OptionItem 
                                    key={option.count}
                                    option={option}
                                    isSelected={selectedValue === option.count}
                                    onPress={() => handleSelectOption(option.count)}
                                />
                            ))}
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    iosPickerModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    iosPickerContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SHEET_MAX_HEIGHT,
        minHeight: SHEET_MIN_HEIGHT,
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingBottom: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
        backgroundColor: Colors.white,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray800,
    },
    sectionHeader: {
        marginTop: 16,
        marginBottom: 10,
        paddingLeft: 4,
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.gray500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    verificationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
    },
    barLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
        color: Colors.gray800,
    },
});
