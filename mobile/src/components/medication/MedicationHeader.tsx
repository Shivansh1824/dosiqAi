import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { VerificationConfidence } from '../../types/medicationVerification';

interface MedicationHeaderProps {
    name: string;
    // Strength is now part of the name string
    confidence: VerificationConfidence;
    isEditing: boolean;
    editedName: string;
    onEditedNameChange: (name: string) => void;
    onToggleEdit: () => void;
    onDelete: () => void;
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
}: MedicationHeaderProps) {
    const confidenceStyle = getConfidenceStyles(confidence);


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


                            </>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.headerActions}>
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onToggleEdit}
                        activeOpacity={0.7}
                    >
                        <Feather name={isEditing ? 'x' : 'edit-3'} size={18} color={Colors.gray500} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onDelete}
                        activeOpacity={0.7}
                    >
                        <Feather name="trash-2" size={18} color={Colors.gray500} />
                    </TouchableOpacity>
                </View>
            </View>
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
        paddingBottom: 10,
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
        paddingRight: 8,
        justifyContent: 'center',
    },
    // titleRow removed
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 0,
        width: '100%',
        paddingRight: 4,
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
        color: Colors.gray500,
        letterSpacing: -0.5,
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
});
