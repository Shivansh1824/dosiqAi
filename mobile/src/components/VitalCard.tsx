import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { HealthMetric, getStatusColor } from '../types/healthMetrics';

interface VitalCardProps {
    metric: HealthMetric;
}

export default function VitalCard({ metric }: VitalCardProps) {
    const statusColor = getStatusColor(metric.status);

    const getTrendIcon = () => {
        if (!metric.trend) return null;
        switch (metric.trend) {
            case 'up':
                return 'trending-up';
            case 'down':
                return 'trending-down';
            case 'stable':
                return 'minus';
        }
    };

    const getTrendText = () => {
        if (!metric.trend) return '';
        switch (metric.trend) {
            case 'up':
                return 'Increasing';
            case 'down':
                return 'Decreasing';
            case 'stable':
                return 'Stable';
        }
    };

    return (
        <View style={[styles.container, { borderLeftWidth: 4, borderLeftColor: statusColor }]}>
            <View style={[styles.iconContainer, { backgroundColor: statusColor + '15' }]}>
                <MaterialCommunityIcons name={metric.iconName as any} size={24} color={statusColor} />
            </View>

            <View style={styles.content}>
                <View style={styles.valueRow}>
                    <Text style={styles.value}>{metric.value}</Text>
                    {metric.unit && <Text style={styles.unit}>{metric.unit}</Text>}
                </View>

                <Text style={styles.label}>{metric.label}</Text>

                {metric.trend && (
                    <View style={styles.trendContainer}>
                        <MaterialCommunityIcons name={getTrendIcon() as any} size={14} color={statusColor} />
                        <Text style={[styles.trendText, { color: statusColor }]}>
                            {getTrendText()}
                        </Text>
                    </View>
                )}
            </View>
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
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Sizes.sm,
    },
    content: {
        flex: 1,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 4,
    },
    value: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    unit: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
        marginLeft: 4,
    },
    label: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
