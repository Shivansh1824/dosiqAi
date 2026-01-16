import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../../constants';
import { VerificationConfidence } from '../../types/medicationVerification';
import { InfoModal } from '../InfoModal';
import { MedicationIcon, getHeaderBackgroundColor } from './MedicationIcons';

interface MedicationHeaderProps {
    name: string;
    form: string | null;
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
    onNamePress?: (event: any) => void;
    serialNumber?: number;
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
    form,
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
    onNamePress,
    serialNumber,
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
            <View style={[styles.innerHeaderContainer, { backgroundColor: getHeaderBackgroundColor(form) }]}>
                <View style={styles.headerLeft}>
                    {serialNumber !== undefined && (
                        <>
                            <Text style={styles.serialNumber}>{serialNumber}</Text>
                            <View style={styles.serialNumberDivider} />
                        </>
                    )}
                    <View style={[styles.iconContainer, { backgroundColor: 'transparent' }]}>
                        <MedicationIcon form={form} size={28} />
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
                            <TouchableOpacity
                                onPress={onNamePress}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={styles.medicationName}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {name}
                                </Text>
                            </TouchableOpacity>
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
                                        style={styles.analysisContainer}
                                    >
                                        <LinearGradient
                                            colors={['#FFFFFF', '#EFF6FF']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 0, y: 1 }}
                                            style={styles.analysisBadge}
                                        >
                                            <Text style={styles.analysisText}>
                                                dosiq Ai Analysis
                                            </Text>
                                        </LinearGradient>
                                        <View style={styles.pointerWrapper}>
                                            <MaterialCommunityIcons name="cursor-default-click" size={14} color={Colors.primary} />
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <View style={styles.actionButtons}>
                        {isEditing ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: getHeaderBackgroundColor(form) }]}
                                    onPress={onCancel}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="x" size={18} color={Colors.gray500} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#E6F4EA' }]}
                                    onPress={onSave}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="check" size={18} color="#137333" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: getHeaderBackgroundColor(form) }]}
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
                                        onToggleEdit();
                                    }}
                                >
                                    <View style={[styles.menuIconContainer, { backgroundColor: '#EFF6FF' }]}>
                                        <Feather name="edit-3" size={14} color={Colors.primary} />
                                    </View>
                                    <View style={styles.menuTextContainer}>
                                        <View style={styles.menuLabelRow}>
                                            <Text style={[styles.menuItemText, styles.renameText]}>Rename</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>

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
        paddingBottom: 12,
    },
    innerHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 12,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    serialNumber: {
        fontSize: 26,
        ...Typography.fontWeights.extrabold,
        color: '#000000',
        letterSpacing: -0.5,
        marginRight: 6,
    },
    serialNumberDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        marginRight: 8,
        marginTop: -14, // Offset parent paddingTop
        marginBottom: -12, // Offset parent paddingBottom
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
        paddingRight: 16, // Clear gap before action buttons
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
        gap: 2,
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
        ...Typography.fontWeights.bold,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    nameScrollView: {
        flexGrow: 0,
        flexShrink: 1,
    },
    nameScrollContent: {
        alignItems: 'center',
    },
    medicationName: {
        fontSize: 20,
        ...Typography.fontWeights.extrabold,
        color: '#000000', // Deep Black Highlight
        letterSpacing: -0.7,
        marginBottom: 0,
    },
    nameInput: {
        fontSize: 18,
        ...Typography.fontWeights.bold,
        color: Colors.gray900,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
        paddingVertical: 2,
        minWidth: 150,
    },
    strengthFormText: {
        fontSize: 10,
        ...Typography.fontWeights.bold,
        color: Colors.gray500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    analysisContainer: {
        position: 'relative',
    },
    analysisBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 8,
        paddingRight: 12, // Increased padding to avoid text overlap with pointer on the right
        paddingVertical: 2,
        borderRadius: 20,
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
    pointerWrapper: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        zIndex: 10,
    },
    analysisText: {
        fontSize: 9,
        ...Typography.fontWeights.bold,
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
        ...Typography.fontWeights.bold,
        color: Colors.gray700,
    },
    deleteText: {
        color: '#DC2626',
    },
    renameText: {
        color: Colors.primary,
    },
    resetText: {
        color: Colors.gray500, // Muted/Blur color
    },
});
