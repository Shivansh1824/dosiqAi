import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay, Easing } from 'react-native-reanimated';
import { Sizes } from '../constants/Sizes';

/**
 * Animation utility functions for consistent animations across the app
 * Using React Native Reanimated for 60fps animations
 */

/**
 * Fade in animation
 * @param delay - Delay before animation starts (ms)
 * @param duration - Animation duration (ms)
 * @returns Animated style for opacity
 */
export const useFadeIn = (delay: number = 0, duration: number = Sizes.animation.normal) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Use requestAnimationFrame to ensure this runs after mount
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.ease),
      });
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return animatedStyle;
};

/**
 * Scale in animation (useful for logos, buttons)
 * @param fromScale - Starting scale (0-1)
 * @param delay - Delay before animation starts (ms)
 * @param duration - Animation duration (ms)
 * @returns Animated style for transform scale
 */
export const useScaleIn = (
  fromScale: number = 0.8,
  delay: number = 0,
  duration: number = Sizes.animation.slow
) => {
  const scale = useSharedValue(fromScale);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []); // Remove dependencies to prevent re-animation

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return animatedStyle;
};

/**
 * Slide up animation (useful for text, buttons)
 * @param fromY - Starting Y position offset
 * @param delay - Delay before animation starts (ms)
 * @param duration - Animation duration (ms)
 * @returns Animated style for translateY
 */
export const useSlideUp = (
  fromY: number = 20,
  delay: number = 0,
  duration: number = Sizes.animation.normal
) => {
  const translateY = useSharedValue(fromY);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration,
        easing: Easing.out(Easing.ease),
      })
    );
  }, []); // Remove dependencies to prevent re-animation

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
};

/**
 * Combined fade + slide up animation
 * @param fromY - Starting Y position offset
 * @param delay - Delay before animation starts (ms)
 * @param duration - Animation duration (ms)
 * @returns Animated style with both opacity and translateY
 */
export const useFadeSlideUp = (
  fromY: number = 20,
  delay: number = 0,
  duration: number = Sizes.animation.normal
) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(fromY);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.ease),
      })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration,
        easing: Easing.out(Easing.ease),
      })
    );
  }, []); // Remove dependencies to prevent re-animation

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
};

/**
 * Combined scale + fade animation (perfect for logos)
 * @param fromScale - Starting scale (0-1)
 * @param delay - Delay before animation starts (ms)
 * @param duration - Animation duration (ms)
 * @returns Animated style with both scale and opacity
 */
export const useScaleFadeIn = (
  fromScale: number = 0.8,
  delay: number = 0,
  duration: number = Sizes.animation.slow
) => {
  const scale = useSharedValue(fromScale);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.ease),
      })
    );
  }, []); // Remove dependencies to prevent re-animation

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return animatedStyle;
};

/**
 * Spring animation (bouncy, energetic)
 * @param delay - Delay before animation starts (ms)
 * @returns Animated style for scale with spring physics
 */
export const useSpringIn = (delay: number = 0) => {
  const scale = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 10,
        stiffness: 100,
      })
    );
  }, []); // Remove dependencies to prevent re-animation

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return animatedStyle;
};

/**
 * Stagger fade in for lists
 * Use this hook for each item in a list with different index
 * @param index - Item index in list
 * @param staggerDelay - Delay between each item (ms)
 * @param baseDuration - Animation duration (ms)
 * @returns Animated style with staggered opacity
 */
export const useStaggerFadeIn = (
  index: number,
  staggerDelay: number = 150,
  baseDuration: number = Sizes.animation.normal
) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    const delay = index * staggerDelay + 900; // Add base delay of 900ms for value props
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: baseDuration,
        easing: Easing.out(Easing.ease),
      })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: baseDuration,
        easing: Easing.out(Easing.ease),
      })
    );
  }, []); // Remove dependencies to prevent re-animation

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
};

/**
 * Button press animation
 * Returns functions to trigger scale down/up on press
 */
export const useButtonPress = () => {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, {
      damping: 10,
      stiffness: 300,
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
};
