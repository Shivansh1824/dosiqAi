import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

export interface MedicineNotificationBannerProps {
  medication: string;
  time: string;
  strength: string;
  note: string;
  currentDose?: number;
  totalDoses?: number;
  onTake?: () => void;
  onSnooze?: () => void;
  onSkip?: () => void;
}

const CircularProgress = ({ current, total }: { current: number; total: number }) => {
  const size = 80;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Guard against divide by zero
  const progress = total > 0 ? current / total : 0;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#FFFFFF"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.progressTextContainer}>
        <Text style={styles.progressNumber}>{current}/{total}</Text>
        <Text style={styles.progressLabel}>Doses</Text>
      </View>
    </View>
  );
};

export default function MedicineNotificationBanner({
  medication,
  time,
  strength,
  note,
  currentDose = 1,
  totalDoses = 3,
  onTake,
  onSnooze,
  onSkip,
}: MedicineNotificationBannerProps) {
  return (
    <View style={styles.container}>
      {/* Widget Card */}
      <View style={styles.cardContainer}>
        {/* Main Glass Gradient Layer */}
        <LinearGradient
          colors={['#60A5FA', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Top Sheen Overlay */}
          <LinearGradient
            colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.05)']}
            locations={[0, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Top Section: Progress + Info */}
          <View style={styles.topSection}>
            <View style={styles.progressWrapper}>
              <CircularProgress current={currentDose} total={totalDoses} />
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.medicationName} numberOfLines={1}>{medication}</Text>
              <Text style={styles.timeText}>{time}</Text>
              <Text style={styles.detailsText} numberOfLines={1}>{strength} • {note}</Text>
            </View>
          </View>

          {/* Bottom Section: Action Buttons - Refined Intensity */}
          <View style={styles.actionRow}>
            {/* Taken Button - High Contrast Primary */}
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={styles.buttonWrapper}
              onPress={onTake}
            >
              <View style={[styles.glossyButton, styles.primaryButtonShadow]}>
                <LinearGradient
                  colors={['#EFF6FF', '#DBEAFE']} // Almost White/Ice Blue
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.buttonContent}>
                  <Feather name="check" size={16} color="#2563EB" />
                  <Text style={[styles.buttonText, { color: '#2563EB' }]}>Taken</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Snooze Button - Warm Secondary */}
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={styles.buttonWrapper}
              onPress={onSnooze}
            >
              <View style={[styles.glossyButton, styles.buttonShadow, { borderColor: 'rgba(252, 211, 77, 0.5)' }]}>
                <LinearGradient
                  colors={['rgba(251, 191, 36, 0.3)', 'rgba(217, 119, 6, 0.4)']} // Transparent Amber
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.2)', 'transparent']}
                  style={styles.highlight}
                />
                <View style={styles.buttonContent}>
                  <Feather name="clock" size={16} color="#FEF3C7" />
                  <Text style={[styles.buttonText, { color: '#FEF3C7' }]}>Snooze</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Skip Button - Subtle Tertiary */}
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={styles.buttonWrapper}
              onPress={onSkip}
            >
              <View style={[styles.glossyButton, styles.buttonShadow, { borderColor: 'rgba(255,255,255,0.15)' }]}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.2)']} // Darker glass
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.buttonContent}>
                  <Feather name="x" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={[styles.buttonText, { color: 'rgba(255,255,255,0.8)' }]}>Skip</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  cardContainer: {
    width: '100%',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    width: '100%',
    height: 160,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flex: 1,
  },
  progressWrapper: {
    marginRight: 18,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    top: 2,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  detailsText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  progressTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  progressNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: -2,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  buttonWrapper: {
    flex: 1,
    height: 44,
  },
  glossyButton: {
    flex: 1,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Strict centering
    gap: 5,
    zIndex: 1,
    width: '100%',
    paddingHorizontal: 4,
  },
  primaryButtonShadow: {
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  buttonText: {
    fontSize: 14, // Slightly reduced
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
