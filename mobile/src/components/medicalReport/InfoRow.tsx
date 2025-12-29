import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';

interface InfoRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  iconColor?: string;
}

export default function InfoRow({ icon, label, value, iconColor = Colors.primary }: InfoRowProps) {
  return (
    <View style={styles.container}>
      <Feather name={icon} size={20} color={iconColor} />
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
});
