import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { 
  FadeInLeft, 
  FadeInRight, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  useAnimatedScrollHandler
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { Document } from '../types/document';
// import Svg, { Path } from 'react-native-svg'; // Could use for advanced curves, but simple circles + lines is cleaner for now

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42; // Width of cards in snake layout
const MIDDLE_GAP = 40; // Space in middle for spine

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// --- Micro-Interaction Components ---

const BreathingDot = ({ color, size = 12 }: { color: string, size?: number }) => {
  const opacity = useSharedValue(0.4);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.8, { duration: 1500 }), withTiming(0.4, { duration: 1500 })), -1, true);
    scale.value = withRepeat(withSequence(withTiming(1.3, { duration: 1500 }), withTiming(1, { duration: 1500 })), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.dotContainer, { width: size + 4, height: size + 4, borderRadius: (size + 4)/2, borderColor: color }]}>
       <Animated.View style={[
         StyleSheet.absoluteFill, 
         { backgroundColor: color, borderRadius: (size + 4)/2 },
         animatedStyle 
       ]} />
       <View style={[styles.dotCore, { width: size - 2, height: size - 2, borderRadius: (size - 2)/2, backgroundColor: color }]} />
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
        colors={['#FDFBF9', '#F0F9FF', '#FDFBF9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Orbs */}
      <View style={[styles.ambientOrb, { top: -80, right: -40, backgroundColor: 'rgba(99, 102, 241, 0.06)' }]} />
      <View style={[styles.ambientOrb, { bottom: 200, left: -60, backgroundColor: 'rgba(16, 185, 129, 0.06)' }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Glassmorphic Header */}
        <BlurView intensity={90} tint="light" style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Journey</Text>
          <TouchableOpacity style={styles.filterButton}>
             <Feather name="more-horizontal" size={24} color="#64748B" />
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
                 <Feather name="activity" size={40} color="#818CF8" />
               </View>
               <Text style={styles.emptyText}>Start Your Timeline</Text>
               <Text style={styles.emptySubtext}>Medical events will appear here\nin a chronological journey.</Text>
             </Animated.View>
          ) : (
            <View style={styles.timelineWrapper}>
              
              {/* Central Spine Line */}
              <View style={styles.centralSpine} />

              {Object.entries(groupedDocuments).map(([month, docs], groupIndex) => (
                <View key={month} style={styles.monthGroup}>
                  
                  {/* Month Header Pillage */}
                  <View style={styles.monthHeaderContainer}>
                    <View style={styles.monthPill}>
                      <Text style={styles.monthText}>{month}</Text>
                    </View>
                  </View>

                  <View style={styles.snakeList}>
                    {docs.map((doc, index) => {
                      const status = getDocStatus(doc);
                      const isVerified = status === 'Verified';
                      const isReport = status === 'Report';
                      const isEven = index % 2 === 0; // Left side if even (0, 2, 4...)
                      
                      let statusColor: string;
                      let statusBg: string;
                      let iconName: any;
                      
                      if (isVerified) {
                        statusColor = '#10B981'; 
                        statusBg = '#ECFDF5';
                        iconName = 'check-circle';
                      } else if (isReport) {
                        statusColor = '#0EA5E9'; 
                        statusBg = '#F0F9FF';
                        iconName = 'activity';
                      } else {
                        statusColor = '#6366F1'; 
                        statusBg = '#EEF2FF';
                        iconName = 'file-text';
                      }

                      return (
                        <View key={doc.id} style={styles.snakeRow}>
                          
                          {/* Left Side */}
                          <View style={styles.sideContainer}>
                            {isEven && (
                              <Animated.View entering={FadeInLeft.delay(index * 100).springify().damping(14)}>
                                <AnimatedTouchable 
                                  style={[styles.snakeCard, { borderLeftColor: statusColor, borderLeftWidth: 4 }]} 
                                  onPress={() => handleDocumentPress(doc)}
                                  activeOpacity={0.9}
                                >
                                   <View style={styles.cardInternal}>
                                     <Text style={[styles.cardTitle, { textAlign: 'right' }]} numberOfLines={2}>
                                        {doc.ai_analysis_result?.file_name || doc.local_file_path?.split('/').pop() || 'Medical Document'}
                                     </Text>
                                     <Text style={[styles.cardSubtitle, { textAlign: 'right' }]}>{status}</Text>
                                   </View>
                                </AnimatedTouchable>
                              </Animated.View>
                            )}
                            {!isEven && (
                              <View style={styles.dateLabelRight}>
                                <Text style={styles.weekdayText}>
                                  {new Date(doc.created_at).toLocaleDateString('en-US', { weekday: 'long' })}
                                </Text>
                                <Text style={styles.dateText}>
                                  {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Center Spine Marker */}
                          <View style={styles.spineMarkerContainer}>
                             <BreathingDot color={statusColor} size={14} />
                             {/* Optional horizontal connector line */}
                             <View style={[
                               styles.horizontalConnector, 
                               { 
                                 backgroundColor: statusColor,
                                 left: isEven ? -20 : undefined,
                                 right: !isEven ? -20 : undefined,
                                 width: 20
                               } 
                             ]} />
                          </View>

                          {/* Right Side */}
                          <View style={styles.sideContainer}>
                            {!isEven && (
                              <Animated.View entering={FadeInRight.delay(index * 100).springify().damping(14)}>
                                <AnimatedTouchable 
                                  style={[styles.snakeCard, { borderRightColor: statusColor, borderRightWidth: 4 }]} 
                                  onPress={() => handleDocumentPress(doc)}
                                  activeOpacity={0.9}
                                >
                                   <View style={styles.cardInternal}>
                                     <Text style={[styles.cardTitle, { textAlign: 'left' }]} numberOfLines={2}>
                                        {doc.ai_analysis_result?.file_name || doc.local_file_path?.split('/').pop() || 'Medical Document'}
                                     </Text>
                                     <Text style={[styles.cardSubtitle, { textAlign: 'left' }]}>{status}</Text>
                                   </View>
                                </AnimatedTouchable>
                              </Animated.View>
                            )}
                            {isEven && (
                              <View style={styles.dateLabelLeft}>
                                <Text style={styles.weekdayText}>
                                  {new Date(doc.created_at).toLocaleDateString('en-US', { weekday: 'long' })}
                                </Text>
                                <Text style={styles.dateText}>
                                  {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                </Text>
                              </View>
                            )}
                          </View>

                        </View>
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
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 150,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  timelineWrapper: {
    position: 'relative',
    width: '100%',
    paddingBottom: 40,
  },
  centralSpine: {
    position: 'absolute',
    top: 60, // Start below first header
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: '#E2E8F0',
    marginLeft: -1, // Center exactly
    zIndex: 0,
  },
  monthGroup: {
    marginBottom: 10,
  },
  monthHeaderContainer: {
    alignItems: 'center',
    marginVertical: 24,
    zIndex: 2,
  },
  monthPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  snakeList: {
    width: '100%',
  },
  snakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32, // Space between items
    height: 100, // Fixed height area for easier alignment
  },
  sideContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 12,
    // Debug colors: backgroundColor: 'rgba(0,0,0,0.05)',
  },
  spineMarkerContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  horizontalConnector: {
    position: 'absolute',
    height: 2,
    opacity: 0.5,
  },
  snakeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 80,
    justifyContent: 'center',
  },
  cardInternal: {
    // 
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  dateLabelLeft: {
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  dateLabelRight: {
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155', // Slate 700
    marginTop: 2,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8', // Slate 400
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: '#fff',
    zIndex: 2,
  },
  dotCore: {
    //
  },
});
