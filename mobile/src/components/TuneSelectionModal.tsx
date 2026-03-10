import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    Modal, 
    StyleSheet, 
    Alert, 
    Pressable, 
    ScrollView, 
    Platform, 
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { Gesture, GestureDetector, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import Animated, { 
    useAnimatedStyle, 
    withSpring, 
    useSharedValue, 
    withTiming, 
    runOnJS,
    interpolate,
    Extrapolate,
    Easing
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.8;
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.5;
import { 
    Tune, 
    getAppTunes, 
    getSystemTunes, 
    getNoSoundOption, 
    playTunePreview, 
    stopPreview, 
    onPlaybackFinish 
} from '../services/tuneService';

interface TuneSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    selectedTune: Tune;
    onSelectTune: (tune: Tune) => void;
}

// Section Header Component
const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
);

// Individual Tune Item Component
const TuneItem = ({ tune, isSelected, onPress, isPlaying, onPreview, showPreview = true }: { 
    tune: Tune; 
    isSelected: boolean; 
    onPress: () => void;
    isPlaying: boolean;
    onPreview: () => void;
    showPreview?: boolean;
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

    const getIconName = () => {
        if (tune.type === 'none') return 'volume-x';
        if (tune.type === 'system') return 'smartphone';
        return 'music';
    };

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
                            name={isSelected ? "check" : getIconName()} 
                            size={20} 
                            color={isSelected ? "white" : Colors.gray400} 
                        />
                    </View>
                    
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.barLabel, { fontSize: 15 }]} numberOfLines={1}>{tune.name}</Text>
                        <Text style={{ fontSize: 11, color: Colors.gray500 }}>Duration: {tune.duration}</Text>
                    </View>

                    {showPreview && tune.type !== 'none' && !(tune.type === 'system' && Platform.OS === 'ios') ? (
                        <TouchableOpacity 
                            style={{ 
                                padding: 10,
                                backgroundColor: isPlaying ? '#FEE2E2' : '#F1F5F9',
                                borderRadius: 20
                            }}
                            onPress={(e) => {
                                e.stopPropagation();
                                onPreview();
                            }}
                        >
                            <Feather 
                                name={isPlaying ? "square" : "play"} 
                                size={18} 
                                color={isPlaying ? "#EF4444" : Colors.primary} 
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 38 }} />
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export const TuneSelectionModal: React.FC<TuneSelectionModalProps> = ({ 
    visible, 
    onClose, 
    selectedTune, 
    onSelectTune
}) => {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [systemTunes, setSystemTunes] = useState<Tune[]>([]);
    const [isLoadingSystem, setIsLoadingSystem] = useState(false);
    
    const appTunes = getAppTunes();
    const noSoundOption = getNoSoundOption();

    console.log('[TuneSelectionModal] Render - visible:', visible, 'selectedTune:', selectedTune?.id);
    console.log('[TuneSelectionModal] appTunes count:', appTunes.length);
    console.log('[TuneSelectionModal] systemTunes count:', systemTunes.length, 'isLoadingSystem:', isLoadingSystem);


    const translateY = useSharedValue(SCREEN_HEIGHT);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (visible) {
            fetchSystemTunes();
            // Using for smooth entry without bounce
            translateY.value = withTiming(0, { 
                duration: 450, 
                easing: Easing.bezier(0.33, 1, 0.68, 1) 
            });
        } else {
            setPlayingId(null);
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

    // Handle closing to ensure sound stops
    const handleClose = async () => {
        await stopPreview();
        setPlayingId(null);
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
            runOnJS(onClose)();
        });
    };

    const fetchSystemTunes = async () => {
        console.log('[TuneSelectionModal] Fetching system tunes...');
        setIsLoadingSystem(true);
        try {
            const tunes = await getSystemTunes();
            console.log('[TuneSelectionModal] Fetched system tunes:', tunes.length);
            setSystemTunes(tunes);
        } catch (error) {
            console.error('[TuneSelectionModal] Error fetching system tunes:', error);
        } finally {
            setIsLoadingSystem(false);
        }
    };

    const playPreview = async (tune: Tune) => {
        try {
            if (playingId === tune.id) {
                // Stop if currently playing this tune
                await stopPreview();
                setPlayingId(null);
                return;
            }

            // Stop previous and start new
            await stopPreview();
            setPlayingId(tune.id);
            
            await playTunePreview(tune);
            
            // Set up finish callback
            onPlaybackFinish(() => {
                setPlayingId(null);
            });

        } catch (error) {
            console.error('Error playing sound', error);
            setPlayingId(null);
            Alert.alert('Error', 'Could not play preview');
        }
    };

    const handleSelectTune = (tune: Tune) => {
        onSelectTune(tune);
    };

    const platformLabel = Platform.OS === 'ios' ? 'iOS Tune' : 'Device Tune';

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
                            <Text style={styles.sectionTitle}>Choose Reminder Tune</Text>
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
                            {/* App Tune Section */}
                            <SectionHeader title="App Tune" />
                            {appTunes.map((tune: any) => (
                                <TuneItem 
                                    key={tune.id}
                                    tune={tune}
                                    isSelected={selectedTune.id === tune.id}
                                    onPress={() => handleSelectTune(tune)}
                                    isPlaying={playingId === tune.id}
                                    onPreview={() => playPreview(tune)}
                                />
                            ))}

                            {/* System/Device Tune Section */}
                            <SectionHeader title={platformLabel} />
                            {isLoadingSystem ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                    <Text style={styles.loadingText}>Loading system sounds...</Text>
                                </View>
                            ) : systemTunes.length > 0 ? (
                                systemTunes.map((tune) => (
                                    <TuneItem 
                                        key={tune.id}
                                        tune={tune}
                                        isSelected={selectedTune.id === tune.id}
                                        onPress={() => handleSelectTune(tune)}
                                        isPlaying={playingId === tune.id}
                                        onPreview={() => playPreview(tune)}
                                        showPreview={tune.type === 'system' && Platform.OS === 'android'}
                                    />
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No system sounds available</Text>
                                </View>
                            )}

                            {/* No Sound Section */}
                            <SectionHeader title="No Sound" />
                            <TuneItem 
                                tune={noSoundOption}
                                isSelected={selectedTune.id === noSoundOption.id}
                                onPress={() => handleSelectTune(noSoundOption)}
                                isPlaying={false}
                                onPreview={() => {}}
                                showPreview={false}
                            />
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
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        color: Colors.gray500,
    },
    emptyContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.gray400,
        fontStyle: 'italic',
    },
});
