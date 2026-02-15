import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import Animated, { 
    useSharedValue, 
    useAnimatedProps, 
    withTiming, 
    withSpring, 
    withDelay,
    Easing,
    useAnimatedStyle,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants';

const { width, height } = Dimensions.get('window');

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
    
    // Checkmark Path Length (Approx)
    const checkmarkLength = 100; 

    useEffect(() => {
        if (visible) {
            // Reset
            scale.value = 0;
            progress.value = 0;
            opacity.value = 1;

            // 1. Elegant Scale Up (No Bounce)
            // Start slightly larger than 0 to avoid "pop"
            scale.value = 0.8; 
            scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });

            // 2. Draw Checkmark (Sophisticated flow)
            progress.value = withDelay(200, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }));

            // 3. Close Logic
            const timeout = setTimeout(() => {
                 // Fade Out before unmounting
                 opacity.value = withTiming(0, { duration: 300 }, (finished) => {
                     if (finished && onAnimationFinish) {
                         // Cannot call callback directly from UI thread context if purely reanimated callback, 
                         // but runOnJS works. Using simple setTimeout for now is often safer without runOnJS complexity here.
                     }
                 });
                 // Call parent finish slightly after fade starts or ends
                 setTimeout(() => onAnimationFinish && onAnimationFinish(), 300);
            }, 1800); // Display for ~1.8s total

            return () => clearTimeout(timeout);
        }
    }, [visible]);

    // Animated Props for SVG Path (DashOffset trick)
    const animatedPathProps = useAnimatedProps(() => {
        const strokeDashoffset = interpolate(
            progress.value, 
            [0, 1], 
            [checkmarkLength, 0], 
            Extrapolation.CLAMP
        );
        return {
            strokeDashoffset,
        };
    });

    // Styles for Container Animation
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
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
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
            {/* Blurry Background Overlay */}
            <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
            </Animated.View>

            {/* Success Card */}
            <Animated.View style={[styles.card, containerStyle]}>
                <Svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    {/* Green Circle Background */}
                    <Circle cx="50" cy="50" r="48" fill={Colors.success + '20'} /> 
                    <Circle cx="50" cy="50" r="40" fill={Colors.success} /> 
                    
                    {/* Animated Checkmark */}
                    <AnimatedPath
                        d="M28 50 L43 65 L72 35"
                        stroke="#FFFFFF"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={[checkmarkLength, checkmarkLength]}
                        animatedProps={animatedPathProps}
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
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)'
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
