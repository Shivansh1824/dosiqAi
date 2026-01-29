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
  subText?: string;
  index: number; // For stagger animation
  staggerDelay?: number;
}

export const ValueProposition: React.FC<ValuePropositionProps> = ({
  icon,
  text,
  subText,
  index,
  staggerDelay = 150,
}) => {
  const animatedStyle = useStaggerFadeIn(index, staggerDelay);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconContainer}>
        <Feather name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text}>{text}</Text>
        {subText && <Text style={styles.subText}>{subText}</Text>}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align to top for multiline
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
    marginTop: 2, // Minor optical adjustment
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  text: {
    ...Typography.styles.body,
    fontWeight: '600',
    color: Colors.gray800,
  },
  subText: {
    ...Typography.styles.caption,
    color: Colors.gray500,
    lineHeight: 18,
  },
});
