import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { Sizes } from '../constants/Sizes';

interface DividerProps {
  text?: string; // Optional text like "OR"
  spacing?: 'sm' | 'md' | 'lg';
}

export const Divider: React.FC<DividerProps> = ({ text, spacing = 'md' }) => {
  const getSpacing = () => {
    switch (spacing) {
      case 'sm':
        return Sizes.md;
      case 'md':
        return Sizes.lg;
      case 'lg':
        return Sizes.xl;
      default:
        return Sizes.lg;
    }
  };

  const spacingValue = getSpacing();

  if (text) {
    return (
      <View style={[styles.container, { marginVertical: spacingValue }]}>
        <View style={styles.line} />
        <Text style={styles.text}>{text}</Text>
        <View style={styles.line} />
      </View>
    );
  }

  return (
    <View style={[styles.simpleLine, { marginVertical: spacingValue }]} />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  simpleLine: {
    height: 1,
    backgroundColor: Colors.border,
  },
  text: {
    ...Typography.styles.caption,
    color: Colors.textTertiary,
    marginHorizontal: Sizes.md,
    fontWeight: Typography.medium,
  },
});
