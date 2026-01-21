import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography } from '../constants';

const { width, height } = Dimensions.get('window');

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message = 'Generating PDF...' }: LoadingOverlayProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1500,
          easing: Easing.linear,
        }),
        -1, // infinite
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [visible, rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.container}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        
        <View style={styles.content}>
          <Animated.View style={[styles.loaderContainer, animatedStyle]}>
            <Feather name="loader" size={48} color={Colors.primary} />
          </Animated.View>
          
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.subMessage}>This will only take a moment</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  content: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    width: width * 0.8,
  },
  loaderContainer: {
    marginBottom: 20,
  },
  message: {
    ...Typography.styles.h4,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    ...Typography.styles.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
