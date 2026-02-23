import React, { useEffect } from 'react';
import Animated, { useSharedValue, withTiming, withRepeat, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export const IconGlow = () => {
    const opacity = useSharedValue(0.6);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1.0, { duration: 2500 }),
            -1,
            true
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ rotate: '25deg' }]
    }));

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: -20,
                    top: -40,
                    width: 140,
                    height: 180,
                },
                style
            ]}
            pointerEvents="none"
        >
            <LinearGradient
                colors={[
                    'rgba(59, 130, 246, 0.25)',  // Blue core
                    'rgba(124, 58, 237, 0.15)', // Violet mid
                    'rgba(96, 165, 250, 0.05)', // Sky-blue edge
                    'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
            />
        </Animated.View>
    );
};
