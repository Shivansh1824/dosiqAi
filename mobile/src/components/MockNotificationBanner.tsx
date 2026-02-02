import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Platform, TouchableOpacity, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants';

const { width } = Dimensions.get('window');

interface MockNotificationBannerProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  body?: string;
  appName?: string;
  timeText?: string;
}

export default function MockNotificationBanner({
  visible,
  onDismiss,
  title = '💊 Medication Reminder',
  body = 'Time to take Aspirin 100mg',
  appName = 'dosiqAi',
  timeText = 'now',
}: MockNotificationBannerProps) {
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 100,
        damping: 15,
        mass: 1,
      }).start();

      // Auto dismiss after 5 seconds (optional, mimicking real notification behavior)
      // const timer = setTimeout(() => {
      //   handleDismiss();
      // }, 5000);
      // return () => clearTimeout(timer);
    } else {
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={handleDismiss}>
        <BlurView intensity={90} tint="light" style={styles.blurContainer}>
          <View style={styles.contentContainer}>
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.appInfo}>
                {/* App Icon Placeholder - using a colored square with icon if no asset */}
                <View style={styles.appIconBg}>
                  <Feather name="activity" size={10} color="#FFFFFF" />
                </View>
                <Text style={styles.appName}>{appName}</Text>
              </View>
              <Text style={styles.timeText}>{timeText}</Text>
            </View>

            {/* Content */}
            <View style={styles.messageContainer}>
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.bodyText} numberOfLines={2}>
                {body}
              </Text>
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20, // Adjust for notch/status bar
    left: 10,
    right: 10,
    zIndex: 9999, // Ensure it's on top of everything
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  blurContainer: {
    borderRadius: 18, // iOS 15/16+ style rounded corners
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.95)' : undefined, // Fallback for android if blur is weird
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconBg: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: Colors.primary || '#4A90E2', // Fallback color
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  appName: {
    fontSize: 13,
    color: '#3C3C43', // iOS label color
    opacity: 0.6,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 13,
    color: '#3C3C43',
    opacity: 0.6,
    fontWeight: '400',
  },
  messageContainer: {
    gap: 2,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },
  bodyText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
});
