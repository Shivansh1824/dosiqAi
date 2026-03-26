import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Sizes } from '@/constants';
import { TestResult } from '@/hooks/useLabReport';

type DietType = 'nonveg' | 'veg';

interface DietarySuggestionsBlockProps {
  biomarker: TestResult['biomarker'];
  testName: string;
  isOptimal: boolean;
}

export const DietarySuggestionsBlock = ({ biomarker, testName, isOptimal }: DietarySuggestionsBlockProps) => {
  const hasNonVeg = !!(biomarker?.good_to_eat_nonveg || biomarker?.bad_to_eat_nonveg);
  const hasVeg = !!(biomarker?.good_to_eat_veg || biomarker?.bad_to_eat_veg);

  const [activeDiet, setActiveDiet] = useState<DietType | null>('veg');

  if (!biomarker || (!hasNonVeg && !hasVeg)) return null;

  const goodText = activeDiet === 'nonveg' ? biomarker.good_to_eat_nonveg : (activeDiet === 'veg' ? biomarker.good_to_eat_veg : null);
  const badText  = activeDiet === 'nonveg' ? biomarker.bad_to_eat_nonveg  : (activeDiet === 'veg' ? biomarker.bad_to_eat_veg  : null);

  const goodTitle = isOptimal ? 'Supportive Foods' : 'Include More';
  const badTitle  = isOptimal ? 'Items to Moderate' : 'Limit / Avoid';
  const subtitle  = isOptimal
    ? `Your ${testName} result is in the optimal range. To maintain these healthy levels, you may focus on these habits:`
    : `Based on your ${testName} result`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            {process.env.EXPO_OS === 'ios' ? (
              <Image source="sf:leaf.fill" style={{ width: 14, height: 14 }} tintColor={Colors.primary} />
            ) : (
              <Feather name="activity" size={14} color={Colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Dietary Insights</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>

      {hasNonVeg && hasVeg && (
        <View style={styles.segmentedBackground}>
          <TouchableOpacity
            style={[styles.segment, activeDiet === 'veg' && styles.segmentActive]}
            onPress={() => setActiveDiet('veg')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentLabel, activeDiet === 'veg' && styles.segmentLabelActive]}>🥦 Plant-Based</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeDiet === 'nonveg' && styles.segmentActive]}
            onPress={() => setActiveDiet('nonveg')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentLabel, activeDiet === 'nonveg' && styles.segmentLabelActive]}>🥩 Meat & Dairy</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeDiet && (
        <Animated.View key={activeDiet} entering={FadeIn.duration(300)}>
          <View style={styles.cardsContainer}>
            {goodText ? (
              <View style={[styles.card, { borderColor: Colors.successLight + '40', backgroundColor: Colors.successLight + '10' }]}>
                <View style={styles.cardHeader}>
                  {process.env.EXPO_OS === 'ios' ? (
                    <Image source="sf:checkmark.circle.fill" style={styles.cardIcon} tintColor={Colors.success} />
                  ) : (
                    <Feather name="check-circle" size={14} color={Colors.success} />
                  )}
                  <Text style={[styles.cardTitle, { color: Colors.successDark }]}>{goodTitle}</Text>
                </View>
                <Text style={styles.cardText}>{goodText}</Text>
              </View>
            ) : null}

            {badText ? (
              <View style={[styles.card, { borderColor: Colors.errorLight + '40', backgroundColor: Colors.errorLight + '10', marginTop: Sizes.sm }]}>
                <View style={styles.cardHeader}>
                  {process.env.EXPO_OS === 'ios' ? (
                    <Image source="sf:exclamationmark.circle.fill" style={styles.cardIcon} tintColor={Colors.error} />
                  ) : (
                    <Feather name="alert-circle" size={14} color={Colors.error} />
                  )}
                  <Text style={[styles.cardTitle, { color: Colors.errorDark }]}>{badTitle}</Text>
                </View>
                <Text style={styles.cardText}>{badText}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Sizes.md,
    backgroundColor: Colors.white,
    borderRadius: Sizes.radiusMd,
    borderCurve: 'continuous',
    padding: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  header: {
    marginBottom: Sizes.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  segmentedBackground: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 8,
    borderCurve: 'continuous',
    padding: 2,
    marginBottom: Sizes.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  segmentActive: {
    backgroundColor: Colors.white,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  segmentLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  segmentLabelActive: {
    color: Colors.textPrimary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  cardsContainer: {
    gap: 0,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: 'continuous',
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardIcon: {
    width: 14,
    height: 14,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
