import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Colors } from '../constants';

interface AnimatedTooltipProps {
    visible: boolean;
    content: string;
    targetPosition: { x: number; y: number } | null;
    onClose: () => void;
}

/**
 * AnimatedTooltip - A cloud-like animated popup
 * Uses a transparent modal to float above all content
 */
export const AnimatedTooltip: React.FC<AnimatedTooltipProps> = ({
    visible,
    content,
    targetPosition,
    onClose,
}) => {
    if (!visible || !targetPosition) return null;

    // Tooltip dimensions (estimated/fixed for simplicity or could be dynamic)
    // For improved positioning, we center it horizontally on the target X
    // and place it above the target Y.

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    {/* Tooltip Container */}
                    <Animated.View
                        entering={FadeInDown.duration(200).springify().damping(20).mass(0.8).stiffness(300)}
                        exiting={FadeOut.duration(150)}
                        style={[
                            styles.tooltipContainer,
                            {
                                top: targetPosition.y - 48, // Precise positioning: Closer but essentially safe
                                left: targetPosition.x - 100,
                            }
                        ]}
                    >
                        <View style={styles.bubble}>
                            <Text style={styles.text}>{content}</Text>
                        </View>
                        <View style={styles.arrow} />
                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    tooltipContainer: {
        position: 'absolute',
        width: 200,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    bubble: {
        backgroundColor: Colors.primary, // Theme primary color
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12, // Sleeker radius
    },
    text: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 16,
        letterSpacing: 0.3,
    },
    arrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 6, // Smaller arrow
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: Colors.primary,
        marginTop: -0.5,
    }
});
