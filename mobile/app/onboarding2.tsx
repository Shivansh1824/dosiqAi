import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../src/constants';

import {     } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuthStore } from '../src/store/authStore';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import {
  useScaleIn,
  useFadeSlideUp,
  useFadeIn,
  useButtonPress,
} from '../src/utils/animations';



export default function Onboarding2Screen() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/onboarding3');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/onboarding1');
    }
  };

  // Swipe gesture configuration
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      const SWIPE_VELOCITY_THRESHOLD = 500;

      if (event.velocityX < -SWIPE_VELOCITY_THRESHOLD) {
        handleContinue();
      } else if (event.velocityX > SWIPE_VELOCITY_THRESHOLD) {
        handleBack();
      }
    });

  // Animation hooks with staggered delays
  const iconAnimation = useScaleIn(0.8, 200, 500);
  const titleAnimation = useFadeSlideUp(30, 400, 400);
  const descAnimation = useFadeSlideUp(30, 600, 400);
  const paginationAnimation = useFadeIn(700, 300);
  const buttonPressAnimation = useButtonPress();

  // Progress animation for active dot
  const progress = useSharedValue(0);

  // Auto-advance timer + progress animation
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: Sizes.animation.splash,
      easing: Easing.linear,
    });

    const autoAdvanceTimer = setTimeout(() => {
      router.push('/onboarding3');
    }, Sizes.animation.splash);

    return () => {
      cancelAnimation(progress);
      clearTimeout(autoAdvanceTimer);
    };
  }, [router]);

  const activeDotAnimation = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (progress.value * 0.3) }],
  }));

  return (
    <GestureDetector gesture={swipeGesture}>
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={24} color={Colors.gray800} />
      </TouchableOpacity>

      {/* Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => {
          useAuthStore.getState().completeOnboarding();
          router.push('/login');
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Feature Icon with Gradient Container */}
        <Animated.View style={[styles.iconContainer, iconAnimation]}>
          <LinearGradient
            colors={[Colors.secondary, Colors.secondaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientIconContainer}
          >
            <Feather name="users" size={140} color={Colors.white} strokeWidth={1.5} />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View style={titleAnimation}>
          <Text style={styles.title}>Multiple Profiles</Text>
        </Animated.View>

        {/* Description */}
        <Animated.View style={descAnimation}>
          <Text style={styles.description}>
            Create profiles for each family member and manage their health separately
          </Text>
        </Animated.View>

        {/* Pagination Dots with Progress Animation */}
        <Animated.View style={[styles.pagination, paginationAnimation]}>
          <View style={styles.dot} />
          <Animated.View style={[styles.dot, styles.dotActive, activeDotAnimation]} />
          <View style={styles.dot} />
        </Animated.View>
      </View>

      {/* Continue Button */}
      <Animated.View style={buttonPressAnimation.animatedStyle}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          onPressIn={buttonPressAnimation.onPressIn}
          onPressOut={buttonPressAnimation.onPressOut}
          activeOpacity={1}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Sizes.xl,
    paddingVertical: Sizes.xxl,
    justifyContent: 'space-between',
  },
  backButton: {
    position: 'absolute',
    top: Sizes.xxl,
    left: Sizes.lg,
    zIndex: 10,
    padding: Sizes.sm,
  },
  skipButton: {
    position: 'absolute',
    top: Sizes.xxl,
    right: Sizes.lg,
    zIndex: 10,
    padding: Sizes.sm,
  },
  skipText: {
    ...Typography.styles.body,
    color: Colors.gray500,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: Sizes.xxl,
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientIconContainer: {
    width: 240,
    height: 240,
    borderRadius: 120,
    justifyContent: 'center',
    alignItems: 'center',
    ...Sizes.shadows.xl,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  title: {
    fontSize: Typography.h2,
    fontWeight: "700",
    textAlign: 'center',
    marginBottom: Sizes.md,
    color: Colors.gray800,
  },
  description: {
    fontSize: Typography.body,
    color: Colors.gray500,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: Sizes.xl,
    lineHeight: Typography.body * Typography.lineHeightNormal,
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: Sizes.xl,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray300,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  button: {
    paddingHorizontal: Sizes.xxl,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Sizes.radiusFull,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: Colors.primary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});
