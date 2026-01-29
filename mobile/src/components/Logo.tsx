import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Typography } from '../constants';

interface LogoProps {
  size?: number;
  iconOnly?: boolean;
}

export default function Logo({ size = 120, iconOnly = false }: LogoProps) {
  return (
    <View style={styles.container}>
      {/* Icon Logo */}
      <Image
        source={require('../../assets/app-logo.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />

      {/* Text Logo Image */}
      {!iconOnly && (
        <Image
          source={require('../../assets/dosiqAi-text-logo.png')}
          style={{
            width: size * 2.8,
            height: size * 1.0,
            resizeMode: 'contain',
            marginLeft: 14
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', // Aligned in 1 line
    alignItems: 'center',
    justifyContent: 'center',
  },
});
