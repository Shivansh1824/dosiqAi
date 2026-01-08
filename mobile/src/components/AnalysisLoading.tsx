import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Colors } from '../constants';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface AnalysisLoadingProps {
  size?: number;
  color?: string;
}

export default function AnalysisLoading({
  size = 50,
  color = Colors.primary || '#4A90E2',
}: AnalysisLoadingProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Smooth continuous rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000, // Faster rotation for a snappy feel
        easing: Easing.linear,
      }),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
    };
  });

  // Modern thin stroke design
  const strokeWidth = 2; // Thinner for a cleaner look
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // 75% circle arc
  const strokeDasharray = `${circumference * 0.75} ${circumference * 0.25}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <AnimatedSvg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={animatedStyle}
      >
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={strokeDasharray}
        />
      </AnimatedSvg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
