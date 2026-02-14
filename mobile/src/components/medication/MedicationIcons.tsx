import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Ellipse, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants';

interface MedicationIconProps {
    form: string | null;
    size?: number;
    color?: string;
}

/**
 * Type-specific theme definitions for Neo-Glass Icons
 */
export const ICON_THEMES: Record<string, { colors: readonly [string, string, ...string[]]; iconColor: string; shadowColor: string }> = {
    tablet: {
        colors: ['#EFF6FF', '#DBEAFE'], // Light Blue Frost
        iconColor: '#3B82F6',
        shadowColor: 'rgba(59, 130, 246, 0.2)',
    },
    capsule: {
        colors: ['#EFF6FF', '#DBEAFE'], // Light Blue Frost (Unified with Tablet)
        iconColor: '#3B82F6',
        shadowColor: 'rgba(59, 130, 246, 0.2)',
    },
    syrup: {
        colors: ['#FFFBEB', '#FEF3C7'], // Amber Sunlight
        iconColor: '#D97706',
        shadowColor: 'rgba(217, 119, 6, 0.2)',
    },
    injection: {
        colors: ['#FEF2F2', '#FEE2E2'], // Rose Glaze
        iconColor: '#EF4444',
        shadowColor: 'rgba(239, 68, 68, 0.2)',
    },
    drops: {
        colors: ['#F0FDFA', '#CCFBF1'], // Teal Crystal
        iconColor: '#0D9488',
        shadowColor: 'rgba(13, 148, 136, 0.2)',
    },
    cream: {
        colors: ['#F0FDF4', '#DCFCE7'], // Mint Fresh
        iconColor: '#059669',
        shadowColor: 'rgba(5, 150, 105, 0.2)',
    },
    ointment: {
        colors: ['#F0FDF4', '#DCFCE7'], // Mint Fresh
        iconColor: '#059669',
        shadowColor: 'rgba(5, 150, 105, 0.2)',
    },
    inhaler: {
        colors: ['#EEF2FF', '#E0E7FF'], // Indigo Sea
        iconColor: '#4F46E5',
        shadowColor: 'rgba(79, 70, 229, 0.2)',
    },
    sachet: {
        colors: ['#F9FAFB', '#F3F4F6'], // Neutral Pearl
        iconColor: '#4B5563',
        shadowColor: 'rgba(75, 85, 99, 0.2)',
    },
    nebulizer: {
        colors: ['#FDF2F8', '#FCE7F3'], // Pink Cloud
        iconColor: '#DB2777',
        shadowColor: 'rgba(219, 39, 119, 0.2)',
    },
    default: {
        colors: ['#F8FAFC', '#F1F5F9'], // Slate
        iconColor: '#64748B',
        shadowColor: 'rgba(100, 116, 139, 0.1)',
    }
};

/**
 * Get header background color based on medication form type.
 * Returns the lightest shade from the form's theme for subtle header background.
 */
export const getHeaderBackgroundColor = (form: string | null): string => {
    const normalizedForm = form?.toLowerCase() || 'default';
    const theme = ICON_THEMES[normalizedForm] || ICON_THEMES.default;
    // Use the second color of the gradient (slightly more prominent shade)
    return theme.colors[1];
};

/**
 * MedicationIcon - Dynamic Neo-Glass styled icons for different medication forms
 * Each icon includes a themed container and a refined multi-layer SVG.
 */
export const MedicationIcon = ({ form, size = 20, color }: MedicationIconProps) => {
    const normalizedForm = form?.toLowerCase() || 'default';
    const theme = ICON_THEMES[normalizedForm] || ICON_THEMES.default;
    const activeColor = color || theme.iconColor;
    const containerSize = size * 1.57;
    const svgSize = size;

    const renderIcon = () => {
        switch (normalizedForm) {
            case 'tablet':
            case 'capsule':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none">
                        {/* Capsule - Slightly tilted, with horizontal divider */}
                        <Path
                            d="M4.5 7.5a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h0a4 4 0 0 1-4-4v-9Z"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            transform="rotate(25, 8.5, 12)"
                        />
                        <Path
                            d="M4.5 12h8"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            transform="rotate(25, 8.5, 12)"
                        />

                        {/* Tablet - Bottom-right circle with diagonal divider */}
                        <Circle
                            cx="17.5"
                            cy="17.5"
                            r="4.5"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            fill="none"
                        />
                        <Path d="M14.5 20.5l6-6" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                    </Svg>
                );
            case 'syrup':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none">
                        {/* Medicine Bottle */}
                        {/* Cap */}
                        <Path
                            d="M6 4h5v2H6V4Z"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {/* Bottle Body - tapered neck, wider body */}
                        <Path
                            d="M6 6h5v2l1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9l1-1V6Z"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {/* Medical Cross on Bottle */}
                        <Path d="M8.5 13v4" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                        <Path d="M6.5 15h4" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />

                        {/* Spoon - oval head + handle */}
                        <Ellipse
                            cx="18"
                            cy="6"
                            rx="2.5"
                            ry="3.5"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            fill="none"
                        />
                        <Path d="M18 9.5v11.5" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                    </Svg>
                );
            case 'injection':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="m18 2 4 4" />
                        <Path d="M16 4l5 5" opacity="0.3" />
                        <Path d="M19 9l-9 9-4 4-4-4 9-9 8 8Z" fill={activeColor} fillOpacity="0.05" />
                        <Path d="m9 11 4 4" />
                        <Path d="m5 19-3 3" />
                    </Svg>
                );
            case 'drops':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7Z" />
                        <Path d="M12 18a2 2 0 0 0 2-2" opacity="0.4" />
                        <Circle cx="10" cy="14" r="1.5" fill={activeColor} fillOpacity="0.2" stroke="none" />
                    </Svg>
                );
            case 'cream':
            case 'ointment':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none">
                        {/* Tube Body - tapers toward bottom */}
                        <Path
                            d="M6 2h12l-2 15H8L6 2Z"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {/* Medical Cross */}
                        <Path d="M12 7v5" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                        <Path d="M9.5 9.5h5" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                        {/* Bottom Cap/Nozzle - simple rounded cap */}
                        <Rect
                            x="9"
                            y="17"
                            width="6"
                            height="5"
                            rx="1"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            fill="none"
                        />
                    </Svg>
                );
            case 'inhaler':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none">
                        {/* Canister - tilted cylinder with cap */}
                        <Path
                            d="M4 3h5a1 1 0 0 1 1 1v10l-1 1H5l-1-1V4a1 1 0 0 1 1-1Z"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            transform="rotate(-15, 7, 9)"
                        />
                        {/* Cap on canister */}
                        <Rect x="5" y="1" width="3" height="2" rx="0.5" stroke={activeColor} strokeWidth="1.5" fill="none" transform="rotate(-15, 7, 9)" />
                        {/* Shine line on canister */}
                        <Path d="M6 5v5" stroke={activeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" transform="rotate(-15, 7, 9)" />

                        {/* L-shaped inhaler body */}
                        <Path
                            d="M5 15h6a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5Z"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {/* Mouthpiece */}
                        <Path d="M13 18h4" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                        {/* Spray lines */}
                        <Path d="M18 16l2-1" stroke={activeColor} strokeWidth="1.5" strokeLinecap="round" />
                        <Path d="M18 18l2 0" stroke={activeColor} strokeWidth="1.5" strokeLinecap="round" />
                        <Path d="M18 20l2 1" stroke={activeColor} strokeWidth="1.5" strokeLinecap="round" />
                    </Svg>
                );
            case 'sachet':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <Rect width="14" height="18" x="5" y="3" rx="2.5" />
                        <Path d="M19 8l-4-4" opacity="0.5" />
                        <Path d="M10 12h4" strokeWidth="2" />
                        <Path d="M12 10v4" strokeWidth="2" />
                    </Svg>
                );
            case 'nebulizer':
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none">
                        {/* Head band - curved arc at top */}
                        <Path
                            d="M5 8a7 7 0 0 1 14 0"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            fill="none"
                        />
                        {/* Left connector */}
                        <Ellipse cx="5" cy="8" rx="1.5" ry="1" stroke={activeColor} strokeWidth="1.5" fill="none" />
                        {/* Right connector */}
                        <Ellipse cx="19" cy="8" rx="1.5" ry="1" stroke={activeColor} strokeWidth="1.5" fill="none" />

                        {/* Mask cup - dome shape */}
                        <Path
                            d="M8 10v3a4 4 0 0 0 8 0v-3"
                            stroke={activeColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {/* Nose piece */}
                        <Path d="M10 9a2 2 0 0 1 4 0" stroke={activeColor} strokeWidth="1.5" strokeLinecap="round" />

                        {/* Tube going down */}
                        <Path d="M12 17v3" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" />
                        <Path d="M12 20c0 1-2 2-4 2" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" fill="none" />
                    </Svg>
                );
            default:
                return (
                    <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="m7.5 4.27 9 5.15" />
                        <Path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                        <Path d="m3.3 7 8.7 5 8.7-5" />
                        <Path d="M12 22V12" />
                    </Svg>
                );
        }
    };

    return (
        <LinearGradient
            colors={theme.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
                styles.container,
                {
                    width: containerSize,
                    height: containerSize,
                    borderRadius: containerSize * 0.35,
                    shadowColor: theme.shadowColor,
                }
            ]}
        >
            <View style={styles.iconWrapper}>
                {renderIcon()}
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 4,
    },
    iconWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    }
});
