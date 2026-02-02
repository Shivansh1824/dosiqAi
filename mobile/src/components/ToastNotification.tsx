import React, { useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring, 
  runOnJS,
  Easing,
  SlideInUp,
  SlideOutDown,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

interface ToastNotificationProps {
  visible: boolean;
  message: string;
  subMessage?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  visible,
  message,
  subMessage,
  type = 'success',
  duration = 6000, // User requested 5-10s
  onDismiss,
  actionLabel,
  onAction,
}) => {
  const translateY = useSharedValue(120); // Start slightly lower
  const opacity = useSharedValue(0);

  // Theme colors based on type
  const getTheme = () => {
    switch (type) {
      case 'success': return { icon: 'check-circle', color: '#10b981', bg: 'rgba(6, 78, 59, 0.95)' }; // Emerald
      case 'warning': return { icon: 'alert-triangle', color: '#f59e0b', bg: 'rgba(120, 53, 15, 0.95)' }; // Amber
      case 'error': return { icon: 'x-circle', color: '#ef4444', bg: 'rgba(127, 29, 29, 0.95)' }; // Red
      default: return { icon: 'info', color: '#3b82f6', bg: 'rgba(30, 58, 138, 0.95)' }; // Blue
    }
  };

  const theme = getTheme();

  // Animation Logic
  useEffect(() => {
    if (visible) {
      // Enter - Smooth Slide Up (No Bounce)
      translateY.value = withTiming(0, { 
        duration: 500, 
        easing: Easing.out(Easing.cubic) 
      });
      opacity.value = withTiming(1, { duration: 400 });

      // Auto-dismiss timer
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
        // Reset immediate if not visible
        translateY.value = 120;
        opacity.value = 0;
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    'worklet';
    opacity.value = withTiming(0, { duration: 300 });
    translateY.value = withTiming(100, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  }, [onDismiss]);

  // Gesture for swipe down to dismiss
  const pan = Gesture.Pan()
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 50) {
        handleDismiss();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Glassmorphism Background */}
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 0} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.backgroundFill, { backgroundColor: theme.bg }]} />

        <View style={styles.contentContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Feather name={theme.icon as any} size={20} color={theme.color} />
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.message}>{message}</Text>
            {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
          </View>

          {/* Manual Close / Action */}
          <TouchableOpacity 
            onPress={() => runOnJS(handleDismiss)()}
            style={styles.closeButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50, // Floating above bottom
    left: 20,
    right: 20,
    borderRadius: 24, // High-rounded pill shape (2025 trend)
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  backgroundFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95, // Solid enough for readability
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 6,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  message: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  subMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
});

export default ToastNotification;
