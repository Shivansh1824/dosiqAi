import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/**
 * RecordDocumentPreviewLoading - Shimmering skeleton loader for document previews (Record screen)
 */
export function RecordDocumentPreviewLoading() {
    const shimmerValue = useSharedValue(0);

    useEffect(() => {
        shimmerValue.value = withRepeat(
            withTiming(1, {
                duration: 1500,
                easing: Easing.bezier(0.4, 0, 0.6, 1),
            }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(shimmerValue.value, [0, 1], [-width, width]);
        return {
            transform: [{ translateX }],
        };
    });

    return (
        <View style={styles.container}>
            {/* Background Base */}
            <View style={StyleSheet.absoluteFill}>
                <View style={styles.skeletonBase} />
            </View>

            {/* Shimmer Effect */}
            <Animated.View style={[styles.shimmerWrapper, animatedStyle]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.4)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                />
            </Animated.View>

            {/* Visual Content */}
            <View style={styles.centerContent}>
                <View style={styles.iconCircle}>
                    <Feather name="file-text" size={40} color={Colors.primary} />
                </View>
                <View style={styles.textSkeleton}>
                    <View style={styles.lineMedium} />
                    <View style={styles.lineShort} />
                </View>
            </View>

            {/* Abstract Document Shapes */}
            <View style={styles.cornerDecor} />
            <View style={styles.bottomDecor} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 208,
        backgroundColor: Colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    skeletonBase: {
        flex: 1,
        backgroundColor: Colors.gray50,
    },
    shimmerWrapper: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: width,
        zIndex: 1,
    },
    gradient: {
        flex: 1,
    },
    centerContent: {
        alignItems: 'center',
        zIndex: 2,
        gap: 12,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    textSkeleton: {
        alignItems: 'center',
        gap: 6,
    },
    lineMedium: {
        width: 140,
        height: 10,
        backgroundColor: Colors.gray200,
        borderRadius: 5,
    },
    lineShort: {
        width: 100,
        height: 8,
        backgroundColor: Colors.gray100,
        borderRadius: 4,
    },
    cornerDecor: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary + '08',
    },
    bottomDecor: {
        position: 'absolute',
        bottom: -30,
        left: -10,
        width: 120,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.secondary + '05',
        transform: [{ rotate: '-15deg' }],
    },
});
