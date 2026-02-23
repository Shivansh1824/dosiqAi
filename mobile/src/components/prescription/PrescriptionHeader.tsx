import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { styles } from '../../screens/PrescriptionSummaryScreen.styles';

interface PrescriptionHeaderProps {
    onBack: () => void;
    titleText: string;
    subtitleText?: string;
    onShare: () => void;
    onOptionsPress: () => void;
}

export const PrescriptionHeader: React.FC<PrescriptionHeaderProps> = ({
    onBack,
    titleText,
    subtitleText,
    onShare,
    onOptionsPress,
}) => {
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.headerButton}
                onPress={onBack}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                    {titleText}
                </Text>
                {subtitleText ? (
                    <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                        {subtitleText}
                    </Text>
                ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                    style={styles.headerButtonRight}
                    onPress={onShare}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="share-2" size={22} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.headerButtonRight}
                    onPress={onOptionsPress}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="more-horizontal" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>
        </View>
    );
};
