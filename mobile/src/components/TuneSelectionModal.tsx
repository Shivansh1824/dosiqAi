import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { Audio } from 'expo-av';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withTiming } from 'react-native-reanimated';

// Define Tune Interface locally or import if shared (keeping local for now as per previous file)
interface Tune {
    id: string;
    name: string;
    duration: string;
    filename: string;
    file: any;
}

interface TuneSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    selectedTune: Tune;
    onSelectTune: (tune: Tune) => void;
    tunes: Tune[];
}

const TuneItem = ({ tune, isSelected, onPress, isPlaying, onPreview }: { 
    tune: Tune; 
    isSelected: boolean; 
    onPress: () => void;
    isPlaying: boolean;
    onPreview: () => void;
}) => {
    // Animation shared values
    const scale = useSharedValue(1);
    const backgroundColorProgress = useSharedValue(isSelected ? 1 : 0);

    useEffect(() => {
        backgroundColorProgress.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
        if (isSelected) {
            scale.value = withSpring(1.02, { damping: 10, stiffness: 100 });
            setTimeout(() => { scale.value = withSpring(1); }, 100);
        }
    }, [isSelected]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            backgroundColor: isSelected ? '#EFF6FF' : 'rgba(255,255,255,0.8)', // Fallback for color interpolation if needed, or drive directly
            borderColor: isSelected ? Colors.primary : 'rgba(255,255,255,0.8)',
        };
    });

    return (
        <Animated.View style={[styles.verificationBar, animatedStyle, { marginBottom: 12, height: 64 }]}>
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
                            name={isSelected ? "check" : "music"} 
                            size={20} 
                            color={isSelected ? "white" : Colors.gray400} 
                        />
                    </View>
                    
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.barLabel, { fontSize: 16 }]}>{tune.name}</Text>
                        <Text style={{ fontSize: 12, color: Colors.gray500 }}>Duration: {tune.duration}</Text>
                    </View>

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
                            fill={isPlaying ? "#EF4444" : "none"}
                        />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export const TuneSelectionModal: React.FC<TuneSelectionModalProps> = ({ 
    visible, 
    onClose, 
    selectedTune, 
    onSelectTune, 
    tunes 
}) => {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    // Cleanup sound when unmounting or changing
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    // Handle closing to ensure sound stops
    const handleClose = async () => {
        if (sound) {
            await sound.stopAsync();
            await sound.unloadAsync();
        }
        setPlayingId(null);
        onClose();
    };

    const playPreview = async (tune: Tune) => {
        try {
            if (playingId === tune.id) {
                // Stop if currently playing this tune
                if (sound) await sound.stopAsync();
                setPlayingId(null);
                return;
            }

            // Stop previous sound if any
            if (sound) {
                await sound.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(tune.file);
            setSound(newSound);
            setPlayingId(tune.id);
            
            await newSound.playAsync();
            
            // Reset playing state when playback finishes
            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingId(null);
                }
            });

        } catch (error) {
            console.error('Error playing sound', error);
            Alert.alert('Error', 'Could not play preview');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.iosPickerModalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                <View style={[styles.iosPickerContainer, { paddingBottom: 30 }]}>
                    <View style={styles.iosPickerHeader}>
                        <Text style={[styles.sectionTitle, { fontSize: 18 }]}>Choose Reminder Tune</Text>
                    </View>
                    
                    <View style={{ padding: 16 }}>
                        {tunes.map((tune) => (
                            <TuneItem 
                                key={tune.id}
                                tune={tune}
                                isSelected={selectedTune.id === tune.id}
                                onPress={() => onSelectTune(tune)}
                                isPlaying={playingId === tune.id}
                                onPreview={() => playPreview(tune)}
                            />
                        ))}
                    </View>
                </View>
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray800,
    },
    iosPickerDoneText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '700',
    },
    verificationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
        // Default styles, controlled by Reanimated now
    },
    barLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
        color: Colors.gray800,
    },
});
