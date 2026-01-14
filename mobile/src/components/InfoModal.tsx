import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants';

interface InfoModalProps {
    visible: boolean;
    title: string;
    body: string;
    onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
    visible,
    title,
    body,
    onClose,
}) => {
    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.card}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Feather name="info" size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.title}>{title}</Text>
                    </View>
                    <Text style={styles.body}>{body}</Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>Got it</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 24, // Matches premium feel
        padding: 24,
        width: '100%',
        maxWidth: 340,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.gray800,
        letterSpacing: -0.5,
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.gray600,
        marginBottom: 28,
        fontWeight: '500',
    },
    button: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
    },
    buttonText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: 16,
    },
});
