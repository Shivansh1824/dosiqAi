import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { HealthAlert } from '../types/healthMetrics';

interface AlertBannerProps {
    alert: HealthAlert;
    onDismiss?: () => void;
}

export default function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
    const getBackgroundColor = () => {
        switch (alert.type) {
            case 'danger':
                return Colors.error || '#EF4444';
            case 'warning':
                return Colors.warning || '#F59E0B';
            case 'info':
                return Colors.primary || '#3B82F6';
        }
    };

    const getIcon = () => {
        switch (alert.type) {
            case 'danger':
                return 'alert-circle';
            case 'warning':
                return 'alert';
            case 'info':
                return 'information';
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
            <MaterialCommunityIcons name={getIcon() as any} size={20} color={Colors.white} />
            <Text style={styles.message}>{alert.message}</Text>
            {onDismiss && (
                <TouchableOpacity onPress={onDismiss} style={styles.dismissButton} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="close" size={20} color={Colors.white} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Sizes.md,
        borderRadius: 12,
        marginBottom: Sizes.md,
        gap: Sizes.sm,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: Colors.white,
        lineHeight: 20,
    },
    dismissButton: {
        padding: 4,
    },
});
