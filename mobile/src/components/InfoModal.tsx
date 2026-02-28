import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Sizes, Typography } from '../constants';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export interface InfoSection {
    label?: string;
    text: React.ReactNode | string;
    icon?: keyof typeof Feather.glyphMap;
}

interface InfoModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    icon?: keyof typeof Feather.glyphMap;
    // Hybrid Props: Support both structured content and legacy children/body
    content?: InfoSection[];
    body?: React.ReactNode | string;
    children?: React.ReactNode;
    hideIcon?: boolean;
}

export const InfoModal: React.FC<InfoModalProps> = ({
    visible,
    onClose,
    title,
    icon = 'info',
    content,
    body,
    children,
    hideIcon = false,
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
                )}
                <Animated.View 
                    entering={FadeIn.duration(200).springify()} 
                    exiting={FadeOut.duration(200)} 
                    style={styles.modalContent}
                >
                    <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.header, hideIcon && { marginBottom: 24 }]}>
                            <Text style={styles.title}>{title}</Text>
                        </View>

                        <View style={styles.contentContainer}>
                            {/* Structured Content */}
                            {content && content.map((section, index) => (
                                <View key={index} style={styles.section}>
                                    {section.label && (
                                        <Text style={styles.sectionLabel}>{section.label}</Text>
                                    )}
                                    <View style={styles.textRow}>
                                        {section.icon && (
                                            <Feather name={section.icon} size={16} color={Colors.primary} style={styles.sectionIcon} />
                                        )}
                                        <Text style={styles.sectionText}>{section.text}</Text>
                                    </View>
                                </View>
                            ))}
                            
                            {/* Legacy Body */}
                            {body && (
                                typeof body === 'string' 
                                    ? <Text style={styles.legacyBody}>{body}</Text>
                                    : body
                            )}

                            {/* Custom Children */}
                            {children}
                        </View>

                        <TouchableOpacity style={styles.closeButtonContainer} onPress={onClose} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']} // Deep, rich blue
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.closeButton}
                            >
                                <Text style={styles.closeButtonText}>Got it</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.6)' : 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Sizes.xl,
    },
    modalContent: {
        width: '100%',
        maxWidth: 320, // Slightly narrower for a more elegant proportion
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)', // Just off-white for depth
        borderRadius: 28, // Scaled back from 32 for tighter geometry
        padding: 24, // Slightly reduced padding for a sharper, more precise feel
        shadowColor: '#1a1a2e', // Deeper, cooler shadow
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 32,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)', // Glass edge reflection
    },
    header: {
        flexDirection: 'row', // Horizontal alignment
        alignItems: 'center', 
        marginBottom: 20,
    },
    iconContainer: {
        width: 32, // Further reduced acting as an inline icon
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12, // Space between icon and text instead of below
        backgroundColor: '#F0F9FF', // Clean solid blue matching native feel
    },
    title: {
        fontSize: 20, // Scaled down to match inline aesthetic
        fontWeight: '800', 
        color: Colors.gray900,
        letterSpacing: -0.4, 
        textAlign: 'left', // Align text naturally
        flex: 1, // Take remaining space
    },
    contentContainer: {
        marginBottom: 16, // Tightened from 28 to reduce awkward gap before button
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.gray500,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    textRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    sectionIcon: {
        marginRight: 10,
        marginTop: 3,
    },
    sectionText: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.gray700,
        flex: 1,
    },
    legacyBody: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.gray700, // Dimmed slightly from black
        fontWeight: '500',
        textAlign: 'left', // Left aligned
        letterSpacing: 0.1,
    },
    closeButtonContainer: {
        width: '100%',
        shadowColor: '#3B82F6', // Colored shadow for premium feel
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    closeButton: {
        paddingVertical: 14,
        borderRadius: 16, // Change to squircle (iOS standard) instead of full pill
        alignItems: 'center',
        width: '100%',
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
