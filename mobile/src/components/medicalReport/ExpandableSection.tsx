import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../../constants';

interface ExpandableSectionProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function ExpandableSection({
  title,
  subtitle,
  badge,
  isExpanded,
  onToggle,
  children,
}: ExpandableSectionProps) {
  return (
    <View style={styles.container}>
      {/* Header (Clickable) */}
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.headerRight}>
          {badge}
          <Feather
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={Colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Content (Conditional) */}
      {isExpanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusMd,
    overflow: 'hidden',
    marginBottom: 12,
    ...Sizes.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Sizes.md,
    backgroundColor: Colors.gray50,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    padding: Sizes.md,
  },
});
