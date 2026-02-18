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
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Fitts's Law: Larger touch target
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
  showDate: boolean;
}

const TimelineItem = React.memo(({ doc, index, isLast, onPress, showDate }: TimelineItemProps) => {
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

  // Determine display date
  const displayDate = useMemo(() => {
    if (doc.report_date) return new Date(doc.report_date);
    if (doc.visit_date) return new Date(doc.visit_date);
    return new Date(doc.ai_analyzed_at || new Date().toISOString());
  }, [doc]);

  const day = displayDate.getDate();
  const dayOfWeek = displayDate.toLocaleDateString('en-US', { weekday: 'short' });
  const time = displayDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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
      // Doherty Threshold: Cap delay to ensure perceived speed (<400ms)
      entering={FadeInUp.delay(Math.min(index * 30, 300)).duration(400).springify()}
      style={styles.itemRow}
    >
      {/* Left: Date */}
      <View style={styles.dateColumn}>
        {showDate && (
           <Animated.View entering={FadeInUp.duration(400)}>
             <Text style={styles.dateDay}>{day}</Text>
             <Text style={styles.dateWeek}>{dayOfWeek}</Text>
           </Animated.View>
        )}
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
        // Accessibility: Essential for universal access
        accessibilityLabel={`View details for ${status} document from ${dayOfWeek}, ${day}`}
        accessibilityRole="button"
        accessibilityHint="Double tap to open document details"
      >
        <Animated.View style={[styles.card, animatedStyle, { shadowColor: statusColor, shadowOpacity: 0.06 }]}>

           
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
    const getDocDate = (doc: Document) => {
      if (doc.report_date) return new Date(doc.report_date).getTime();
      if (doc.visit_date) return new Date(doc.visit_date).getTime();
      return new Date(doc.ai_analyzed_at || new Date().toISOString()).getTime();
    };

    const sortedDocs = [...documents].sort((a, b) => 
      getDocDate(b) - getDocDate(a)
    );

    sortedDocs.forEach(doc => {
      const date = new Date(getDocDate(doc));
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

  const renderItem = ({ item, index, section }: any) => {
    // Check if this is the first item of the day in this section
    const prevItem = index > 0 ? section.data[index - 1] : null;
    
    const getItemDate = (d: Document) => {
        if (d.report_date) return new Date(d.report_date).getDate();
        if (d.visit_date) return new Date(d.visit_date).getDate();
        return new Date(d.ai_analyzed_at || new Date().toISOString()).getDate();
    };

    const isFirstOfDay = !prevItem || getItemDate(prevItem) !== getItemDate(item);

    return (
      <TimelineItem 
        doc={item} 
        index={index} 
        isLast={index === section.data.length - 1}
        onPress={handleDocumentPress}
        showDate={isFirstOfDay}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Background */}
      {/* Background - Consistent with Medications Screen */}
      {/* Background - Fluid Depth (Aesthetic-Usability Effect) */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
            colors={['#F8FAFC', '#EFF6FF', '#FFFFFF']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        />
        {/* Organic shapes for depth */}
        <View style={[styles.blob, { backgroundColor: '#E0F2FE', top: -100, left: -60, opacity: 0.6 }]} />
        <View style={[styles.blob, { backgroundColor: '#F0FDFA', top: '40%', right: -100, opacity: 0.5 }]} />
        <View style={[styles.blob, { backgroundColor: '#EEF2FF', bottom: -50, left: -40, opacity: 0.6 }]} />
        
        {/* Glass overlay */}
        <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="light" />
      </View>
      
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
        ListFooterComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40, paddingBottom: 100 }}>
                {/* Peak-End Rule: End with a positive affirmation */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 }} />
                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500' }}>You're all caught up</Text>
            </View>
        }
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
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 1)', // Very subtle border
  },

  cardContent: {
    padding: 16,
    paddingVertical: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 8, // Soft square
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 'auto',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
    letterSpacing: -0.2,
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
