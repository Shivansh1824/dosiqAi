import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Sizes, Typography } from '../constants';
import { BlurView } from 'expo-blur';

export interface InfoSection {
    label?: string;
    text: string;
    icon?: keyof typeof Feather.glyphMap;
}

interface InfoModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    icon?: keyof typeof Feather.glyphMap;
    // Hybrid Props: Support both structured content and legacy children/body
    content?: InfoSection[];
    body?: string;
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
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                )}
                <Animated.View 
                    entering={FadeIn.duration(200).springify()} 
                    exiting={FadeOut.duration(200)} 
                    style={styles.modalContent}
                >
                    <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.header, hideIcon && { marginBottom: 24 }]}>
                            {!hideIcon && (
                                <View style={styles.iconContainer}>
                                    <Feather name={icon} size={20} color={Colors.primary} />
                                </View>
                            )}
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
                            {body && <Text style={styles.legacyBody}>{body}</Text>}

                            {/* Custom Children */}
                            {children}
                        </View>

                        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
                            <Text style={styles.closeButtonText}>Got it</Text>
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
        backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Sizes.xl,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F0F9FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray900,
        letterSpacing: -0.5,
    },
    contentContainer: {
        marginBottom: 24,
    },
    section: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.gray500,
        marginBottom: 4,
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
        fontSize: 15,
        lineHeight: 22,
        color: Colors.gray700,
        flex: 1,
    },
    legacyBody: {
        fontSize: 15,
        lineHeight: 22,
        color: Colors.gray600,
        fontWeight: '500',
    },
    closeButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        width: '100%',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
