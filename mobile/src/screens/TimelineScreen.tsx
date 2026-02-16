import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, SafeAreaView, Dimensions, Platform, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  Extrapolation,
  SharedValue,
  useAnimatedScrollHandler
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { Document } from '../types/document';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes, Typography } from '../constants';

const { width } = Dimensions.get('window');

// --- Components ---

/**
 * A sleek, glassmorphic header
 */
/**
 * Header component matching Medications Screen style
 */
const Header = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Your Journey</Text>
        <Text style={styles.headerSubtitle}>Track your medical history</Text>
      </View>
      
      {/* Spacer to balance the back button if no action button exists */}
      <View style={{ width: 44 }} />
    </View>
  );
};

// --- Timeline Item Component ---

interface TimelineItemProps {
  doc: Document;
  index: number;
  isLast: boolean;
  onPress: (doc: Document) => void;
}

const TimelineItem = React.memo(({ doc, index, isLast, onPress }: TimelineItemProps) => {
  const { medications } = useMedicationsStore();
  
  // Memoized derived state
  const { status, statusColor, statusBg, iconName } = useMemo(() => {
    const docType = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    
    // Status Logic
    let statusText = 'Prescription';
    let color = '#6366F1'; // Indigo
    let bg = '#EEF2FF';
    let icon = 'file-text';

    if (docType.includes('report') || docType.includes('lab')) {
      statusText = 'Report';
      color = '#0EA5E9'; // Sky
      bg = '#F0F9FF';
      icon = 'activity';
    } else {
      const isVerified = medications.some((med: any) => med.source_document_id === doc.id);
      if (isVerified) {
        statusText = 'Verified';
        color = '#10B981'; // Emerald
        bg = '#ECFDF5';
        icon = 'check-circle';
      }
    }

    return { status: statusText, statusColor: color, statusBg: bg, iconName: icon as any };
  }, [doc, medications]);

  const date = new Date(doc.created_at);
  const day = date.getDate();
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Animation
  const scale = useSharedValue(1);
  
  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 50).duration(400)}
      style={styles.itemRow}
    >
      {/* Left: Date */}
      <View style={styles.dateColumn}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateWeek}>{dayOfWeek}</Text>
      </View>

      {/* Middle: Spine & Dot */}
      <View style={styles.spineColumn}>
        <View style={[styles.spineLine, { bottom: isLast ? 0 : -24 }]} />
        <View style={[styles.spineDot, { borderColor: statusColor, backgroundColor: '#fff' }]}>
            <View style={[styles.spineDotInner, { backgroundColor: statusColor }]} />
        </View>
      </View>

      {/* Right: Card */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          Haptics.selectionAsync();
          onPress(doc);
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardContainer}
      >
        <Animated.View style={[styles.card, animatedStyle]}>
           <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
           
           <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: statusBg }]}>
                  <Feather name={iconName} size={14} color={statusColor} />
                </View>
                <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                <Text style={styles.timeText}>{time}</Text>
              </View>

              <Text style={styles.cardTitle} numberOfLines={2}>
                {doc.ai_analysis_result?.file_name || doc.local_file_path?.split('/').pop() || 'Untitled Document'}
              </Text>
           </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SectionHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionHeaderContainer}>
     <BlurView intensity={Platform.OS === 'ios' ? 80 : 0} tint="light" style={StyleSheet.absoluteFill} />
     <Text style={styles.sectionHeaderTitle}>{title}</Text>
  </View>
);

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);


export default function TimelineScreen() {
  const navigation = useNavigation();
  const { documents } = useDocumentsStore();
  const { medications } = useMedicationsStore();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Grouping for SectionList
  const sections = useMemo(() => {
    const groups: { [key: string]: Document[] } = {};
    const sortedDocs = [...documents].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sortedDocs.forEach(doc => {
      const date = new Date(doc.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });

    return Object.entries(groups).map(([title, data]) => ({
      title,
      data
    }));
  }, [documents]);

  const handleDocumentPress = (doc: Document) => {
    const docType = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    if (docType.includes('report') || docType.includes('lab')) {
      (navigation as any).navigate('ReportSummary', { document: doc, documentId: doc.id });
    } else {
      const isVerified = medications.some((med: any) => med.source_document_id === doc.id);
      if (isVerified) {
        (navigation as any).navigate('PrescriptionRecord', { document: doc, documentId: doc.id });
      } else {
        (navigation as any).navigate('PrescriptionSummary', { document: doc, documentId: doc.id });
      }
    }
  };

  const renderSectionHeader = ({ section: { title } }: any) => (
    <SectionHeader title={title} />
  );

  const renderItem = ({ item, index, section }: any) => (
    <TimelineItem 
      doc={item} 
      index={index} 
      isLast={index === section.data.length - 1}
      onPress={handleDocumentPress}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Background */}
      {/* Background - Consistent with Medications Screen */}
      <LinearGradient
        colors={['#F8FAFC', '#EFF6FF', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={{ flex: 1 }}>
      <Header />

      <AnimatedSectionList
        sections={sections}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={null}
        ListEmptyComponent={() => (
           <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                 <Feather name="clock" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyText}>No records yet</Text>
              <Text style={styles.emptySub}>Your medical timeline will appear here.</Text>
           </View>
        )}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  blob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    backgroundColor: 'transparent',
    zIndex: 100,
    borderBottomWidth: 1, // The requested "line"
    borderBottomColor: '#E2E8F0', // Mild separation
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'flex-start', // Left align
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    // Removed background color (was rgba(255,255,255,0.5)) to match MedicationsScreen clean look
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Sizes.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.5,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'left',
  },
  scrollContent: {
    paddingTop: 0, // Remove space
    paddingBottom: 40,
  },
  headerSpacer: {
    height: 10,
  },
  sectionHeaderContainer: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(248, 250, 252, 0.85)', // Semi-transparent for blur effect
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 0, // Handled by padding in container/list
    paddingHorizontal: 20, // Reduced from 24
    minHeight: 100,
  },
  dateColumn: {
    width: 36, // Reduced from 40
    alignItems: 'center',
    paddingTop: 0,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '800', // Extra bold
    color: '#334155',
    lineHeight: 22,
  },
  dateWeek: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: -2,
  },
  spineColumn: {
    width: 24, // Reduced from 30
    alignItems: 'center',
    position: 'relative',
  },
  spineLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 0,
    left: 11, // Center of 24 is 12, minus 1 = 11
  },
  spineDot: {
    width: 12, // Slightly smaller dot
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginTop: 6, 
    backgroundColor: '#fff',
  },
  spineDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  cardContainer: {
    flex: 1,
    paddingLeft: 10, // Reduced from 12
    paddingBottom: 24, 
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusStrip: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 16,
    paddingTop: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 'auto',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
});
