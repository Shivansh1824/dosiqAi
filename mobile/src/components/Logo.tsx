import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography } from '../constants';

interface LogoProps {
  size?: number;
  iconOnly?: boolean;
}

export default function Logo({ size = 120, iconOnly = false }: LogoProps) {
  return (
    <View style={styles.container}>
      {/* Shield Icon with SVG */}
      <Svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        style={styles.svg}
      >
        {/* Gradient background */}
        <Rect
          width={120}
          height={120}
          rx={24}
          fill="url(#gradient)"
        />

        {/* Shield shape */}
        <Path
          d="M60 25C60 25 45 28 35 35C35 45 33 70 60 90C87 70 85 45 85 35C75 28 60 25 60 25Z"
          fill="white"
          stroke="white"
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* Medical cross - horizontal bar */}
        <Rect
          x={47}
          y={52}
          width={26}
          height={8}
          rx={2}
          fill="url(#gradient)"
        />

        {/* Medical cross - vertical bar */}
        <Rect
          x={56}
          y={43}
          width={8}
          height={26}
          rx={2}
          fill="url(#gradient)"
        />

        <Defs>
          <LinearGradient
            id="gradient"
            x1={0}
            y1={0}
            x2={120}
            y2={120}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={Colors.primary} />
            <Stop offset="100%" stopColor={Colors.secondary} />
          </LinearGradient>
        </Defs>
      </Svg>

      {/* App Name */}
      {!iconOnly && (
        <View style={styles.textContainer}>
          <Text style={styles.title}>FamilyCare</Text>
          <Text style={styles.title}>Health</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    marginRight: 16,
  },
  textContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: Typography.h1,
    fontWeight: '700',
    color: Colors.gray800,
    lineHeight: Typography.h1,
    letterSpacing: -0.5,
  },
});
