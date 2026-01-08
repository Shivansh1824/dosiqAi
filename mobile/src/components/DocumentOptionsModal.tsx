import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { BlurView } from 'expo-blur';

interface DocumentOptionsModalProps {
    visible: boolean;
    onClose: () => void;
    onDelete: () => void;
    onEditTitle?: () => void; // Optional for now
}

export default function DocumentOptionsModal({
    visible,
    onClose,
    onDelete,
    onEditTitle,
}: DocumentOptionsModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    {/* Bottom Sheet Content */}
                    <TouchableWithoutFeedback>
                        <View style={styles.contentContainer}>
                            {/* Drag Handle (Visual cue) */}
                            <View style={styles.dragHandle} />

                            <Text style={styles.headerTitle}>Options</Text>

                            {/* Edit Title Option (Placeholder for future or if provided) */}
                            {onEditTitle && (
                                <TouchableOpacity
                                    style={styles.optionRow}
                                    onPress={() => {
                                        onClose();
                                        onEditTitle();
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '15' }]}>
                                        <Feather name="edit-2" size={20} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.optionText}>Edit Title</Text>
                                </TouchableOpacity>
                            )}

                            {/* Delete Option */}
                            <TouchableOpacity
                                style={styles.optionRow}
                                onPress={() => {
                                    onClose();
                                    // Small delay to let modal close before alert
                                    setTimeout(onDelete, 300);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: Colors.error + '15' }]}>
                                    <Feather name="trash-2" size={20} color={Colors.error} />
                                </View>
                                <View>
                                    <Text style={[styles.optionText, { color: Colors.error }]}>Delete Document</Text>
                                    <Text style={styles.optionSubtext}>This action cannot be undone</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Cancel Button */}
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={onClose}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    contentContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.gray200,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 20,
        textAlign: 'center',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    optionSubtext: {
        fontSize: 13,
        color: Colors.gray500,
        marginTop: 2,
    },
    cancelButton: {
        marginTop: 24,
        backgroundColor: Colors.gray100,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
});
