
import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SponsoredSpaceProps {
  appName?: string;
  adContent?: string;
}

const { width } = Dimensions.get('window');

/**
 * SponsoredSpace Component
 * 
 * Displays a sponsored ad or promotional content within the notification card.
 */
export default function SponsoredSpace({ 
  appName = 'HealthPlus', 
  adContent = 'Get 20% off your next prescription refill with HealthPlus Prime.' 
}: SponsoredSpaceProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>Sponsored</Text>
        </View>
        <Text style={styles.appName}>{appName}</Text>
      </View>
      
      <View style={styles.contentRow}>
        <View style={styles.iconBackground}>
          <MaterialCommunityIcons name="star-circle" size={24} color="#F59E0B" />
        </View>
        <Text style={styles.adContent} numberOfLines={2}>
          {adContent}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  badgeContainer: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBackground: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  adContent: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
});
