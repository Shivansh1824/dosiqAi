/**
 * TrendIndicator Component
 * Displays trend arrow and percentage change for lab metrics
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface TrendIndicatorProps {
  trend: 'improving' | 'worsening' | 'stable' | null;
  changePercentage: number | null;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  trend,
  changePercentage,
  size = 'medium',
  showLabel = false,
}) => {
  if (!trend || changePercentage === null) {
    return null;
  }

  // Determine icon and color based on trend
  const getTrendConfig = () => {
    switch (trend) {
      case 'improving':
        return {
          icon: 'trending-up' as const,
          color: Colors.success,
          label: 'Improving',
          backgroundColor: '#D1FAE5',
        };
      case 'worsening':
        return {
          icon: 'trending-down' as const,
          color: Colors.error,
          label: 'Worsening',
          backgroundColor: '#FEE2E2',
        };
      case 'stable':
        return {
          icon: 'trending-neutral' as const,
          color: Colors.textSecondary,
          label: 'Stable',
          backgroundColor: Colors.gray100,
        };
      default:
        return null;
    }
  };

  const config = getTrendConfig();
  if (!config) return null;

  // Size configurations
  const sizeConfig = {
    small: { iconSize: 16, fontSize: 12, padding: 4 },
    medium: { iconSize: 20, fontSize: 14, padding: 6 },
    large: { iconSize: 24, fontSize: 16, padding: 8 },
  };

  const { iconSize, fontSize, padding } = sizeConfig[size];

  // Format percentage
  const formattedPercentage = `${changePercentage > 0 ? '+' : ''}${changePercentage.toFixed(1)}%`;

  return (
    <View style={[styles.container, { padding }]}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: config.backgroundColor,
            borderRadius: iconSize / 2,
            padding: padding / 2,
          },
        ]}
      >
        <MaterialCommunityIcons name={config.icon} size={iconSize} color={config.color} />
      </View>

      <Text style={[styles.percentage, { fontSize, color: config.color }]}>
        {formattedPercentage}
      </Text>

      {showLabel && (
        <Text style={[styles.label, { fontSize: fontSize - 2, color: config.color }]}>
          {config.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentage: {
    fontWeight: '600',
  },
  label: {
    fontWeight: '500',
    marginLeft: 2,
  },
});
