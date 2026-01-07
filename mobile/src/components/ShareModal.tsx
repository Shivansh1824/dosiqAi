import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    Platform,
    TouchableWithoutFeedback,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Sizes } from '../constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ShareModalProps {
    visible: boolean;
    onClose: () => void;
    documentType: 'prescription' | 'report' | 'other';
    onShareDocument: () => void;
    onShareAnalysis: () => void;
}

export default function ShareModal({
    visible,
    onClose,
    documentType,
    onShareDocument,
    onShareAnalysis,
}: ShareModalProps) {
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    mass: 0.8,
                    stiffness: 100,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    const getModalContent = () => {
        switch (documentType) {
            case 'prescription':
                return {
                    title: 'Share Prescription',
                    description: 'Securely share this medical record with your healthcare provider or family.',
                    docButton: 'Share Original File',
                    analysisButton: 'Share AI Analysis',
                    icon: 'file-document-edit-outline',
                };
            case 'report':
                return {
                    title: 'Share Report',
                    description: 'Securely share this medical record with your healthcare provider or family.',
                    docButton: 'Share Original File',
                    analysisButton: 'Share AI Analysis',
                    icon: 'file-chart-outline',
                };
            default:
                return {
                    title: 'Share Document',
                    description: 'Securely share this medical record with your healthcare provider or family.',
                    docButton: 'Share Original File',
                    analysisButton: 'Share AI Analysis',
                    icon: 'file-document-outline',
                };
        }
    };

    const content = getModalContent();

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    return (
        <Modal transparent visible={visible} onRequestClose={handleClose} animationType="none">
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                    {Platform.OS === 'ios' && (
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    )}
                </Animated.View>
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.modalContainer,
                    {
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                <View style={styles.handleIndicator} />

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name={content.icon as any} size={32} color={Colors.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title}>{content.title}</Text>
                        <Text style={styles.description}>{content.description}</Text>
                    </View>
                </View>

                {/* Actions - Separate Cards */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => {
                            // Close modal first, then trigger action after animation
                            Animated.parallel([
                                Animated.timing(slideAnim, {
                                    toValue: SCREEN_HEIGHT,
                                    duration: 200,
                                    useNativeDriver: true,
                                }),
                                Animated.timing(fadeAnim, {
                                    toValue: 0,
                                    duration: 200,
                                    useNativeDriver: true,
                                }),
                            ]).start(() => {
                                onClose();
                                setTimeout(() => {
                                    onShareDocument();
                                }, 300);
                            });
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: Colors.bgSecondary }]}>
                            <Feather name="file-text" size={24} color={Colors.primary} />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>{content.docButton}</Text>
                            <Text style={styles.actionSubtitle}>Send as PDF or Image</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => {
                            // Close modal first, then trigger action after animation
                            Animated.parallel([
                                Animated.timing(slideAnim, {
                                    toValue: SCREEN_HEIGHT,
                                    duration: 200,
                                    useNativeDriver: true,
                                }),
                                Animated.timing(fadeAnim, {
                                    toValue: 0,
                                    duration: 200,
                                    useNativeDriver: true,
                                }),
                            ]).start(() => {
                                onClose();
                                setTimeout(() => {
                                    onShareAnalysis();
                                }, 300);
                            });
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: Colors.bgSecondary }]}>
                            <Feather name="activity" size={24} color={Colors.secondary} />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>{content.analysisButton}</Text>
                            <Text style={styles.actionSubtitle}>Key findings & summary</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <View style={{ height: 20 }} />
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.6)', // Darker on Android for better contrast
    },
    modalContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        borderTopLeftRadius: 28, // Increased radius
        borderTopRightRadius: 28,
        padding: Sizes.contentPadding, // Use standardized padding
        paddingBottom: Platform.OS === 'ios' ? 34 : Sizes.contentPadding,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    handleIndicator: {
        width: 40,
        height: 4,
        backgroundColor: Colors.gray200,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20, // Reduced from 24
    },
    header: {
        alignItems: 'center',
        marginBottom: 24, // Reduced from 32
    },
    iconContainer: {
        width: 56, // Reduced from 64 for cleaner look
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.bgSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTextContainer: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        ...Typography.styles.h4,
        color: Colors.textPrimary,
        marginBottom: 4, // Reduced from 8
        textAlign: 'center',
    },
    description: {
        ...Typography.styles.caption,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    actionsContainer: {
        gap: 8, // Reduced from 12 for professional tightness
        marginBottom: 20, // Reduced from 24
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16, // Increased internal padding
        backgroundColor: Colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray100,
        // Subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    actionSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    cancelButton: {
        paddingVertical: 18, // Taller touch target
        alignItems: 'center',
        backgroundColor: Colors.gray50,
        borderRadius: 16,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
});
