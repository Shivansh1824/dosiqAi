import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Sizes } from '../constants';

interface LogoProps {
  size?: number;
  iconOnly?: boolean;
}

export default function Logo({ size = Sizes.logoSize, iconOnly = false }: LogoProps) {
  if (iconOnly) {
    return (
      <Image
        source={require('../../assets/app-logo.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/app-logo-long.png')}
        style={{
          width: size * 3.5,
          height: size,
          resizeMode: 'contain',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
