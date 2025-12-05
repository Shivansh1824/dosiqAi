import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { Sizes } from '../constants/Sizes';
import { useStaggerFadeIn } from '../utils/animations';

interface ValuePropositionProps {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  index: number; // For stagger animation
  staggerDelay?: number;
}

export const ValueProposition: React.FC<ValuePropositionProps> = ({
  icon,
  text,
  index,
  staggerDelay = 150,
}) => {
  const animatedStyle = useStaggerFadeIn(index, staggerDelay);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconContainer}>
        <Feather name={icon} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Sizes.md,
    paddingHorizontal: Sizes.xs,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight + '20', // 20% opacity
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  text: {
    ...Typography.styles.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
});
