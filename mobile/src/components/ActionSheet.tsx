import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { BlurView } from 'expo-blur';

export interface ActionSheetOption {
  label: string;
  icon?: string;
  onPress: () => void;
  isDestructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
}

const { width } = Dimensions.get('window');

export default function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  options,
}: ActionSheetProps) {
  // Animation Values
  const slideAnim = useRef(new Animated.Value(0)).current; 
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track visibility to handle closing animation
  const [showModal, setShowModal] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 90,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setShowModal(false));
    }
  }, [visible]);

  if (!showModal) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0], // Slide from bottom
  });

  return (
    <Modal
      transparent
      visible={showModal}
      onRequestClose={onClose}
      statusBarTranslucent
      animationType="none"
    >
      <View style={styles.overlay}>
        {/* Backdrop - Dims background */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Action Sheet Container */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY }] },
          ]}
        >
            {/* Handle/Indicator */}
            <View style={styles.handleContainer}>
                <View style={styles.handle} />
            </View>

          {/* Header */}
          {(title || subtitle) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}

          {/* Options */}
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                    styles.optionButton,
                    index < options.length - 1 && styles.optionDivider
                ]}
                onPress={() => {
                  // Optional: wait a microsecond for ripple or just fire
                  option.onPress();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: option.isDestructive ? '#FEE2E2' : '#F3F4F6' }]}>
                    <Feather
                    name={(option.icon as any) || 'circle'}
                    size={20}
                    color={option.isDestructive ? '#EF4444' : '#374151'}
                    />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    option.isDestructive && styles.destructiveLabel,
                  ]}
                >
                  {option.label}
                </Text>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    overflow: 'hidden',
    // Shadow for elevation feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
      marginTop: 8,
  },
  handle: {
      width: 48,
      height: 5,
      backgroundColor: '#E5E7EB',
      borderRadius: 10,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionDivider: {
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  destructiveLabel: {
    color: '#EF4444',
  },
  cancelButton: {
    paddingVertical: 18,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
});
