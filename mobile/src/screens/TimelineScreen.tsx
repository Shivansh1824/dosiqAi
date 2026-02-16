import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  Layout, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  withSpring,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Sizes, Typography } from '../constants';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { Document } from '../types/document';

const { width } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// --- Micro-Interaction Components ---

const BreathingDot = ({ color }: { color: string }) => {
  const opacity = useSharedValue(0.4);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000 }),
        withTiming(0.4, { duration: 2000 })
      ),
      -1,
      true
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.dotContainer, { borderColor: color }]}>
       <Animated.View style={[
         StyleSheet.absoluteFill, 
         { backgroundColor: color, borderRadius: 6 },
         animatedStyle 
       ]} />
       <View style={[styles.dotCore, { backgroundColor: color }]} />
    </View>
  );
};

export default function TimelineScreen() {
  const navigation = useNavigation();
  const { documents } = useDocumentsStore();
  const { medications } = useMedicationsStore();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Group documents by Month/Year
  const groupedDocuments = useMemo(() => {
    const groups: { [key: string]: Document[] } = {};
    const sortedDocs = [...documents].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sortedDocs.forEach(doc => {
      const date = new Date(doc.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(doc);
    });
    return groups;
  }, [documents]);

  const handleDocumentPress = (doc: Document) => {
    const docType = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    if (docType === 'lab_report' || docType === 'report' || docType === 'lab report') {
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

  const getDocStatus = (doc: Document) => {
    const type = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    if (type.includes('report')) return 'Report';
    const isVerified = medications.some((med: any) => med.source_document_id === doc.id);
    return isVerified ? 'Verified' : 'Prescription';
  };

  return (
    <View style={styles.container}>
      {/* 2026 Organic Background */}
      <LinearGradient
        colors={['#FDFBF9', '#F4F6F8', '#EEF2FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative ambient blurred orbs */}
      <View style={[styles.ambientOrb, { top: -50, right: -50, backgroundColor: 'rgba(99, 102, 241, 0.08)' }]} />
      <View style={[styles.ambientOrb, { bottom: 100, left: -50, backgroundColor: 'rgba(16, 185, 129, 0.06)' }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Glassmorphic Header */}
        <BlurView intensity={80} tint="light" style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Timeline</Text>
          <TouchableOpacity style={styles.filterButton}>
             <Feather name="bar-chart-2" size={20} color="#64748B" />
          </TouchableOpacity>
        </BlurView>

        <Animated.ScrollView 
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {Object.keys(groupedDocuments).length === 0 ? (
             <Animated.View 
               entering={FadeInUp.delay(300).springify().damping(12)}
               style={styles.emptyContainer}
             >
               <View style={styles.emptyIconContainer}>
                 <Feather name="clock" size={40} color="#818CF8" />
               </View>
               <Text style={styles.emptyText}>Your Journey Starts Here</Text>
               <Text style={styles.emptySubtext}>Upload your first document to begin your\nmedical timeline.</Text>
             </Animated.View>
          ) : (
            <View style={styles.timelinePadding}>
              {Object.entries(groupedDocuments).map(([month, docs], groupIndex) => (
                <View key={month} style={styles.monthGroup}>
                  {/* Sticky-feel Month Header */}
                  <Animated.View 
                    entering={FadeInDown.delay(groupIndex * 150).springify()}
                    style={styles.monthHeaderContainer}
                  >
                     <Text style={styles.monthText}>{month}</Text>
                  </Animated.View>

                  <View style={styles.timelineList}>
                    {docs.map((doc, index) => {
                      const isLast = index === docs.length - 1;
                      const status = getDocStatus(doc);
                      const isVerified = status === 'Verified';
                      const isReport = status === 'Report';
                      
                      let statusColor: string;
                      let statusBg: string;
                      let iconName: any;
                      
                      if (isVerified) {
                        statusColor = '#10B981'; // Vivid Emerald
                        statusBg = 'rgba(16, 185, 129, 0.1)';
                        iconName = 'check-circle';
                      } else if (isReport) {
                        statusColor = '#0EA5E9'; // Vivid Sky
                        statusBg = 'rgba(14, 165, 233, 0.1)';
                        iconName = 'activity';
                      } else {
                        statusColor = '#6366F1'; // Vivid Indigo
                        statusBg = 'rgba(99, 102, 241, 0.1)';
                        iconName = 'file-text';
                      }

                      return (
                        <Animated.View 
                          key={doc.id} 
                          entering={FadeInDown.delay((groupIndex * 150) + (index * 80)).springify().damping(16).mass(0.8)}
                          style={styles.timelineItem}
                        >
                          {/* Left Connector */}
                          <View style={styles.timelineLeft}>
                            {!isLast && (
                              <LinearGradient
                                colors={[statusColor, 'rgba(203, 213, 225, 0.4)', 'rgba(203, 213, 225, 0.2)']}
                                style={styles.timelineLine}
                              />
                            )}
                            <BreathingDot color={statusColor} />
                          </View>

                          {/* Right Card */}
                          <AnimatedTouchable 
                            style={styles.timelineCard} 
                            onPress={() => handleDocumentPress(doc)}
                            activeOpacity={0.9}
                          >
                             {/* Card Background for Depth */}
                             <View style={[styles.cardBg, { shadowColor: statusColor }]} />
                             
                             <View style={styles.cardContent}>
                               <View style={styles.cardTopRow}>
                                 <View style={styles.docIconContainer}>
                                   <View style={[styles.docIconBg, { backgroundColor: statusBg }]}>
                                      <Feather name={iconName} size={20} color={statusColor} />
                                   </View>
                                 </View>
                                 
                                 <View style={styles.docInfo}>
                                   <View style={styles.dateRow}>
                                      <Text style={styles.cardDate}>
                                        {new Date(doc.created_at).toLocaleDateString('en-US', { day: 'numeric', weekday: 'short' })}
                                      </Text>
                                      <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                                         <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                                      </View>
                                   </View>
                                   
                                   <Text style={styles.docTitle} numberOfLines={2}>
                                      {doc.ai_analysis_result?.file_name || doc.local_file_path?.split('/').pop() || 'Medical Document'}
                                   </Text>
                                   <Text style={styles.docType}>
                                      {doc.ai_analysis_result?.document_type ? 
                                        doc.ai_analysis_result.document_type.replace(/_/g, ' ') 
                                        : 'Document'}
                                   </Text>
                                 </View>
                                 
                                 <Feather name="chevron-right" size={20} color="#CBD5E1" style={{ marginTop: 20 }} />
                               </View>
                             </View>
                          </AnimatedTouchable>
                        </Animated.View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF9',
  },
  ambientOrb: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    filter: 'blur(60px)', // Web support
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -0.4,
  },
  filterButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  timelinePadding: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 140,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  monthGroup: {
    marginBottom: 24,
  },
  monthHeaderContainer: {
    paddingVertical: 20,
  },
  monthText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.8,
  },
  timelineList: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
    marginRight: 16,
  },
  timelineLine: {
    position: 'absolute',
    top: 28,
    bottom: -40,
    width: 2,
    borderRadius: 1,
    left: 19, // Center in 40px width
  },
  dotContainer: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 8, // Align with card top
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: '#fff',
    zIndex: 2,
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Glass feeling
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden', // Contain the bg
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    borderRadius: 24,
    opacity: 0.6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  cardContent: {
    padding: 16,
    zIndex: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
  },
  docIconContainer: {
    marginRight: 16,
  },
  docIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 22,
    marginBottom: 4,
  },
  docType: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textTransform: 'capitalize',
  },
});
