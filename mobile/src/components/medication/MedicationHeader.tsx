import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants';
import { VerificationConfidence } from '../../types/medicationVerification';
import { InfoModal } from '../InfoModal';

interface MedicationHeaderProps {
    name: string;
    // Strength is now part of the name string
    confidence: VerificationConfidence;
    isEditing: boolean;
    editedName: string;
    onEditedNameChange: (name: string) => void;
    onToggleEdit: () => void;
    onDelete: () => void;
    onResetToAI: () => void;
    onSave: () => void;
    onCancel: () => void;
    onAnalysisPress?: () => void;
}

/**
 * Get confidence indicator styling based on confidence level
 */
const getConfidenceStyles = (confidence: VerificationConfidence) => {
    switch (confidence) {
        case 'high':
            return {
                badgeColor: '#E6F4EA',
                badgeTextColor: '#1E4620',
                iconColor: '#137333',
                icon: 'check-circle' as const,
                text: 'AI Confident',
            };
        case 'medium':
            return {
                badgeColor: '#FEF7E0',
                badgeTextColor: '#5F370E',
                iconColor: '#F9AB00',
                icon: 'alert-circle' as const,
                text: 'AI Uncertain',
            };
        case 'low':
            return {
                badgeColor: '#FCE8E6',
                badgeTextColor: '#8C1D18',
                iconColor: '#C5221F',
                icon: 'alert-triangle' as const,
                text: 'AI Assumed',
            };
    }
};

/**
 * MedicationHeader - Header with medication name, confidence badge, and action buttons
 * Extracted from MedicationVerificationCard.tsx
 */
export function MedicationHeader({
    name,
    confidence,
    isEditing,
    editedName,
    onEditedNameChange,
    onToggleEdit,
    onDelete,
    onResetToAI,
    onSave,
    onCancel,
    onAnalysisPress,
}: MedicationHeaderProps) {
    const confidenceStyle = getConfidenceStyles(confidence);
    const [showMenu, setShowMenu] = useState(false);
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [infoModalTitle, setInfoModalTitle] = useState('');
    const [infoModalBody, setInfoModalBody] = useState('');

    const handleInfoPress = (type: 'delete' | 'reset') => {
        if (type === 'delete') {
            setInfoModalTitle('About Delete');
            setInfoModalBody('This will permanently remove the medication from this prescription list.');
        } else {
            setInfoModalTitle('About Reset to AI');
            setInfoModalBody('This will revert all fields back to the original values detected by dosiq AI from your prescription document. Any manual edits you made will be lost.');
        }
        setInfoModalVisible(true);
    };


    return (
        <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                    <Feather name="package" size={20} color={Colors.primary} />
                </View>
                <View style={styles.headerTitleContainer}>
                    {isEditing ? (
                        <TextInput
                            style={styles.nameInput}
                            value={editedName}
                            onChangeText={onEditedNameChange}
                            placeholder="Medication name"
                            autoFocus
                            multiline
                        />
                    ) : (
                        <Text
                            style={styles.medicationName}
                            numberOfLines={1}
                            adjustsFontSizeToFit={false} // Strict single line
                        >
                            {name}
                        </Text>
                    )}

                    <View style={styles.subtitleRow}>
                        {!isEditing && (
                            <>
                                <View style={[styles.confidenceBadge, { backgroundColor: confidenceStyle.badgeColor, paddingVertical: 2, paddingHorizontal: 6 }]}>
                                    <Feather name={confidenceStyle.icon} size={10} color={confidenceStyle.iconColor} />
                                    <Text style={[styles.confidenceText, { color: confidenceStyle.badgeTextColor, fontSize: 9 }]}>
                                        {confidenceStyle.text}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={onAnalysisPress}
                                    activeOpacity={0.7}
                                >
                                    <LinearGradient
                                        colors={['#FFFFFF', '#EFF6FF']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 0, y: 1 }}
                                        style={styles.analysisBadge}
                                    >
                                        <MaterialCommunityIcons name="auto-fix" size={10} color={Colors.primary} />
                                        <Text style={styles.analysisText}>
                                            dosiq Ai Analysis
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.headerActions}>
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={isEditing ? onCancel : onToggleEdit}
                        activeOpacity={0.7}
                    >
                        <Feather name={isEditing ? 'x' : 'edit-3'} size={18} color={Colors.gray500} />
                    </TouchableOpacity>

                    {isEditing ? (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: '#E6F4EA' }]}
                            onPress={onSave}
                            activeOpacity={0.7}
                        >
                            <Feather name="check" size={18} color="#137333" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setShowMenu(!showMenu)}
                            activeOpacity={0.7}
                        >
                            <Feather name={showMenu ? 'x' : 'more-vertical'} size={18} color={Colors.gray500} />
                        </TouchableOpacity>
                    )}

                    {showMenu && (
                        <View style={styles.menuContainer}>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    setShowMenu(false);
                                    onDelete();
                                }}
                            >
                                <View style={[styles.menuIconContainer, { backgroundColor: '#FEE2E2' }]}>
                                    <Feather name="trash-2" size={14} color="#DC2626" />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <View style={styles.menuLabelRow}>
                                        <Text style={[styles.menuItemText, styles.deleteText]}>Delete</Text>
                                        <TouchableOpacity
                                            onPress={() => handleInfoPress('delete')}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={styles.infoIconWrapper}
                                        >
                                            <Feather name="info" size={13} color={Colors.gray400} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.menuItem, styles.resetMenuItem]}
                                onPress={() => {
                                    setShowMenu(false);
                                    onResetToAI();
                                }}
                            >
                                <View style={[styles.menuIconContainer, { backgroundColor: '#F3F4F6' }]}>
                                    <Feather name="repeat" size={14} color={Colors.gray500} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <View style={styles.menuLabelRow}>
                                        <Text style={[styles.menuItemText, styles.resetText]}>Reset to AI</Text>
                                        <TouchableOpacity
                                            onPress={() => handleInfoPress('reset')}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={styles.infoIconWrapper}
                                        >
                                            <Feather name="info" size={13} color={Colors.gray400} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            <InfoModal
                visible={infoModalVisible}
                title={infoModalTitle}
                body={infoModalBody}
                onClose={() => setInfoModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 12,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        paddingRight: 80, // Prevent overlap with action icons
        justifyContent: 'center',
    },
    // titleRow removed
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4, // Reduced gap for closer look
        marginTop: 0,
    },
    headerActions: {
        alignItems: 'flex-end',
        gap: 8,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.gray50,
        borderRadius: 10,
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4,
        alignSelf: 'flex-start',
    },
    confidenceText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    medicationName: {
        fontSize: 20,
        fontWeight: '900',
        color: '#000000', // Deep Black Highlight
        letterSpacing: -0.7,
        marginBottom: 0,
    },
    nameInput: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray900,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
        paddingVertical: 2,
        minWidth: 150,
    },
    strengthFormText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.gray500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    analysisBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 20,
        gap: 4,
        borderWidth: 0.5,
        borderColor: 'rgba(59, 130, 246, 0.15)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    analysisText: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 0.3,
    },
    menuContainer: {
        position: 'absolute',
        top: 40,
        right: 0,
        backgroundColor: Colors.white,
        borderRadius: 14,
        padding: 6,
        zIndex: 1000,
        width: 170, // Increased width
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        gap: 12,
        borderRadius: 10,
    },
    resetMenuItem: {
        backgroundColor: 'transparent',
    },
    menuIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuTextContainer: {
        flex: 1,
    },
    menuLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Align icons to the right
        flex: 1,
    },
    infoIconWrapper: {
        transform: [{ translateY: 1 }], // Geometric fix for visual centering
    },
    menuItemText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.gray700,
    },
    deleteText: {
        color: '#DC2626',
    },
    resetText: {
        color: Colors.gray500, // Muted/Blur color
    },
});
