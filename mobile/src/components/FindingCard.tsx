import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { HealthMetric } from '../types/healthMetrics';

interface FindingCardProps {
    metric: HealthMetric;
    onActionPress?: () => void;
}

export default function FindingCard({ metric, onActionPress }: FindingCardProps) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons name={metric.iconName as any} size={24} color={Colors.primary} />
                </View>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>{metric.label}</Text>
                    {metric.date && <Text style={styles.date}>{metric.date}</Text>}
                </View>
            </View>

            {metric.detail && <Text style={styles.detail}>{metric.detail}</Text>}

            {metric.value && (
                <View style={styles.valueContainer}>
                    <Text style={styles.value}>
                        {metric.value}{metric.unit ? ` ${metric.unit}` : ''}
                    </Text>
                </View>
            )}

            {metric.actionLabel && onActionPress && (
                <TouchableOpacity style={styles.actionButton} onPress={onActionPress} activeOpacity={0.7}>
                    <Text style={styles.actionLabel}>{metric.actionLabel}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.primary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: Sizes.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Sizes.sm,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Sizes.sm,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    date: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    detail: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Sizes.sm,
    },
    valueContainer: {
        marginBottom: Sizes.sm,
    },
    value: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Sizes.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.gray100,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
});
