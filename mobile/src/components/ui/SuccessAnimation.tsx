import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { 
    useSharedValue, 
    useAnimatedProps, 
    withTiming, 
    withSpring, 
    withDelay,
    Easing,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
    runOnJS
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants';
// import { Audio } from 'expo-av'; // Sound effect if needed later

const { width } = Dimensions.get('window');

// Create animated components properly
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(Text);

interface SuccessAnimationProps {
    visible: boolean;
    onAnimationFinish?: () => void;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({ visible, onAnimationFinish }) => {
    // Shared Values
    const scale = useSharedValue(0);
    const progress = useSharedValue(0);
    const opacity = useSharedValue(0);
    
    // Ripple Effect Values
    const rippleScale = useSharedValue(0.8);
    const rippleOpacity = useSharedValue(0);

    // Checkmark Path Length (Approx)
    const checkmarkLength = 100; 

    useEffect(() => {
        if (visible) {
            // Reset
            scale.value = 0;
            progress.value = 0;
            opacity.value = 1;
            rippleScale.value = 0.8;
            rippleOpacity.value = 0;

            // 1. Spring Scale Up (Bouncy "Pop")
            // Damping: 10, Stiffness: 100 for a nice organic bounce
            scale.value = withDelay(100, withSpring(1, { 
                damping: 12, 
                stiffness: 100,
                mass: 1 
            }));

            // 2. Ripple Effect (Explosion behind)
            // Starts slightly after scale begins
            rippleOpacity.value = withDelay(150, withTiming(0.4, { duration: 100 }));
            rippleScale.value = withDelay(150, withTiming(2, { duration: 600, easing: Easing.out(Easing.quad) }, () => {
                rippleOpacity.value = withTiming(0, { duration: 400 });
            }));

            // 3. Draw Checkmark (Sophisticated flow)
            // Sync with the impact of the spring
            progress.value = withDelay(300, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));

            // 4. Close Logic
            const timeout = setTimeout(() => {
                 // Fade Out before unmounting
                 opacity.value = withTiming(0, { duration: 300 }, (finished) => {
                     if (finished && onAnimationFinish) {
                         runOnJS(onAnimationFinish)();
                     }
                 });
            }, 2200); // slightly longer display to relish the bounce

            return () => clearTimeout(timeout);
        }
    }, [visible]);

    // Animated Props for Circle Path
    const circleAnimatedProps = useAnimatedProps(() => ({
        strokeDashoffset: interpolate(
            progress.value,
            [0, 0.6], // Draw circle first
            [283, 0],
            Extrapolation.CLAMP
        )
    }));

    // Animated Props for Checkmark Path
    const checkmarkAnimatedProps = useAnimatedProps(() => ({
        strokeDashoffset: interpolate(
            progress.value, 
            [0.5, 1], // Start drawing tick halfway through
            [100, 0], 
            Extrapolation.CLAMP
        )
    }));
    
    // ... (rest of styles)

    // Styles for Container Animation
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
    }));

    // Style for Ripple
    const rippleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: rippleScale.value }],
        opacity: rippleOpacity.value * opacity.value // Hide when parent fades
    }));

    // Style for Background Fade
    const bgStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));
    
    // Style for Text Fade In
    const textStyle = useAnimatedStyle(() => ({
        opacity: progress.value, // Sync with checkmark drawing
        transform: [{ translateY: interpolate(progress.value, [0, 1], [10, 0]) }]
    }));

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, justifyContent: 'center', alignItems: 'center' }]} pointerEvents="box-none">
            {/* Blurry Background Overlay */}
            <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)' }]} />
            </Animated.View>

            {/* Ripple Circle (Behind) */}
            <Animated.View style={[styles.ripple, rippleStyle]} />

            {/* Success Card */}
            <Animated.View style={[styles.card, containerStyle]}>
                <Svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                    {/* Ripple Effect (Optional internal glow) */}
                    
                    {/* Circle Outline */}
                    <Circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        stroke={Colors.success} 
                        strokeWidth="4"
                        fill="none" // Ensure transparent center as requested
                        strokeOpacity={0.2} // Base ring
                    />
                    
                     <AnimatedPath
                        d="M 50, 50 m -45, 0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0"
                        stroke={Colors.success}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={[283, 283]} // 2 * pi * 45 ≈ 282.7
                        animatedProps={circleAnimatedProps}
                    />

                    
                    {/* Animated Checkmark - Green */}
                    <AnimatedPath
                        d="M28 52 L42 66 L72 36" // Adjusted coordinates for better centering in outline
                        stroke={Colors.success} 
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={[100, 100]}
                        animatedProps={checkmarkAnimatedProps}
                    />
                </Svg>
                
                <AnimatedText style={[styles.successText, textStyle]}>
                    Medicine Added
                </AnimatedText>

                <AnimatedText style={[styles.subText, textStyle]}>
                    Taking care of yourself!
                </AnimatedText>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        borderRadius: 32,
        paddingVertical: 40,
        paddingHorizontal: 60,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.1,
        shadowRadius: 30,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)'
    },
    ripple: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: Colors.success,
        zIndex: -1, // Behind the card
    },
    successText: {
        marginTop: 24,
        fontSize: 20,
        fontWeight: '800', // Editorial Bold
        color: Colors.gray800,
        letterSpacing: -0.5,
    },
    subText: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '500',
        color: Colors.gray500,
        textAlign: 'center'
    }
});
