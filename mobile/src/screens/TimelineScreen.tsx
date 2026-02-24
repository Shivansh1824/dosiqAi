import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, SafeAreaView, Dimensions, StatusBar, Modal, Pressable, Alert, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  useAnimatedScrollHandler
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { Document, getDocumentTitle } from '../types/document';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes, Typography } from '../constants';
import { useAuthStore } from '../store/authStore';

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
        <Text style={styles.headerTitle}>Medical Timeline</Text>
        <Text style={styles.headerSubtitle}>Track Your Medical Journey</Text>
      </View>
      
      {/* Spacer to balance the back button if no action button exists */}
      <View style={{ width: 44 }} />
    </View>
  );
};

// --- Action Sheet Modal ---

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isReport: boolean;
}

const ActionSheet = ({ visible, onClose, onEdit, onDelete, isReport }: ActionSheetProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <Pressable style={styles.actionSheetOverlay} onPress={onClose}>
      <Pressable style={styles.actionSheetContainer} onPress={() => {}}>
        <View style={styles.actionSheetHandle} />
        <TouchableOpacity
          style={styles.actionSheetItem}
          onPress={() => { onClose(); onEdit(); }}
          activeOpacity={0.7}
        >
          <View style={[styles.actionSheetIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="edit-2" size={15} color="#3B82F6" />
          </View>
          <View style={styles.actionSheetTextGroup}>
            <Text style={styles.actionSheetTitle}>Edit Document</Text>
            <Text style={styles.actionSheetSub}>{isReport ? 'Review and modify report details' : 'Review and modify prescription details'}</Text>
          </View>
          <Feather name="chevron-right" size={14} color="#CBD5E1" />
        </TouchableOpacity>

        <View style={styles.actionSheetDivider} />

        <TouchableOpacity
          style={styles.actionSheetItem}
          onPress={() => { onClose(); onDelete(); }}
          activeOpacity={0.7}
        >
          <View style={[styles.actionSheetIconWrap, { backgroundColor: '#FEF2F2' }]}>
            <Feather name="trash-2" size={15} color="#EF4444" />
          </View>
          <View style={styles.actionSheetTextGroup}>
            <Text style={[styles.actionSheetTitle, { color: '#EF4444' }]}>Delete Document</Text>
            <Text style={styles.actionSheetSub}>Permanently remove this record and its data</Text>
          </View>
          <Feather name="chevron-right" size={14} color="#CBD5E1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionSheetCancel} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.actionSheetCancelText}>Cancel</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

// --- Timeline Item Component ---

interface TimelineItemProps {
  doc: Document;
  index: number;
  isLast: boolean;
  onPress: (doc: Document) => void;
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  showDate: boolean;
  isInitial?: boolean;
}

const TimelineItem = React.memo(({ doc, index, isLast, onPress, onEdit, onDelete, showDate, isInitial = false }: TimelineItemProps) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const { medications } = useMedicationsStore();

  
  // Memoized derived state
  const { status, statusColor, statusBg, statusGradient, iconName } = useMemo(() => {
    const docType = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    
    let statusText = 'Prescription';
    let color = '#8B5CF6'; // Violet
    let bg = '#F5F3FF';
    let gradient = ['#F5F3FF', '#EDE9FE'];
    let icon = 'file-text';

    if (docType.includes('report') || docType.includes('lab')) {
      statusText = 'Lab Report';
      color = '#F97316'; // Orange
      bg = '#FFF7ED';
      gradient = ['#FFF7ED', '#FFEDD5'];
      icon = 'activity';
    } else {
      const isVerified = medications.some((med: any) => med.source_document_id === doc.id);
      if (isVerified) {
        statusText = 'Verified Rx';
        color = '#10B981'; // Emerald
        bg = '#F0FDF4';
        gradient = ['#F0FDF4', '#DCFCE7'];
        icon = 'check-circle';
      }
    }

    return { 
      status: statusText, 
      statusColor: color, 
      statusBg: bg, 
      statusGradient: gradient,
      iconName: icon as any 
    };
  }, [doc, medications]);

  // Determine display date logic
  const { day, dayOfWeek } = useMemo(() => {
    const rawDateStr = doc.report_date || doc.visit_date;
    const fallbackDateStr = doc.ai_analyzed_at;

    const displayDate = rawDateStr
      ? new Date(rawDateStr)
      : fallbackDateStr
        ? new Date(fallbackDateStr)
        : new Date();

    return {
      day: displayDate.getDate(),
      dayOfWeek: displayDate.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  }, [doc]);

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  // Truncates at the last complete word boundary within charLimit
  // e.g. "Shivam Kumar Singh" with limit 15 → "Shivam Kumar"
  const truncateAtWord = (text: string, charLimit: number) => {
    if (text.length <= charLimit) return text;
    const trimmed = text.slice(0, charLimit);
    const lastSpace = trimmed.lastIndexOf(' ');
    return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
  };

  const scale = useSharedValue(1);
  const handlePressIn = () => { scale.value = withSpring(0.985, { damping: 25, stiffness: 300 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 25, stiffness: 300 }); };
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const hasFollowUp = !!doc.follow_up_date;

  return (
    <Animated.View
      entering={
        isInitial 
          ? FadeInUp.delay(Math.min(index * 40, 300)).duration(500)
          : FadeInUp.duration(400)
      }
      style={styles.itemRow}
    >
      {/* Date column — Gestalt Proximity: groups day stamp with its cards */}
      <View style={styles.dateColumn}>
        {showDate && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <Text style={styles.dateDay}>{day}</Text>
            <Text style={styles.dateWeek}>{dayOfWeek}</Text>
          </Animated.View>
        )}
      </View>

      {/* Spine — Gestalt Continuity: guides eye through timeline */}
      <View style={styles.spineColumn}>
        <View style={[styles.spineLine, { bottom: isLast ? 0 : -24, backgroundColor: '#E2E8F0', opacity: 0.7 }]} />
        <View style={[styles.spineDot, { borderColor: statusColor }]}>
          <View style={[styles.spineDotInner, { backgroundColor: statusColor, width: 4.5, height: 4.5, borderRadius: 2.25 }]} />
        </View>
      </View>

      {/* Card — Fitts's Law: full-width large touch target */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => { Haptics.selectionAsync(); onPress(doc); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardContainer}
        accessibilityLabel={`${status}: ${getDocumentTitle(doc)}`}
        accessibilityRole="button"
        accessibilityHint="Double tap to open document details"
      >
        <Animated.View style={[styles.card, animatedStyle]}>
          <LinearGradient
            colors={statusGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.cardInner}>
            {/* Row 1: Type badge with icon — color-coded for instant scanning */}
            <View style={styles.typeBadgeRow}>
              <View style={[styles.typeBadge, { backgroundColor: statusBg }]}>
                <Feather name={iconName} size={11} color={statusColor} style={{ marginRight: 4 }} />
                <Text style={[styles.typeBadgeText, { color: statusColor }]}>{status}</Text>
              </View>
            </View>

            {/* Row 2 removed: Patient name has been moved to the footer */}

            {/* 3-dot kebab menu — Absolute positioned for a subtle, secondary feel */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMenuVisible(true);
              }}
              style={styles.menuButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              accessibilityLabel="Document options"
              accessibilityRole="button"
            >
              <Feather name="more-vertical" size={15} color="#94A3B8" />
            </TouchableOpacity>

            <ActionSheet
              visible={menuVisible}
              onClose={() => setMenuVisible(false)}
              onEdit={() => onEdit(doc)}
              onDelete={() => onDelete(doc)}
              isReport={status === 'Lab Report'}
            />

            {/* Conditional Rendering based on Document Type for People/Lab Section */}
            {status === 'Lab Report' ? (
              <View style={{ marginBottom: 9 }}>
                {!!doc.patient_name ? (
                  <View>
                    <View style={styles.metaLabelRow}>
                      <Feather name="user" size={9} color="#94A3B8" style={{ marginRight: 3 }} />
                      <Text style={styles.followUpMetaLabel}>PATIENT</Text>
                    </View>
                    <Text style={styles.followUpMetaValue} numberOfLines={1}>
                      {truncateAtWord(
                        doc.patient_name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                        15
                      )}
                    </Text>
                  </View>
                ) : null}
                
                {!!(doc.ai_analysis_result as any)?.report_meta?.lab_name ? (
                  <View style={{ marginTop: doc.patient_name ? 9 : 0 }}>
                    <View style={styles.metaLabelRow}>
                      <Text style={styles.followUpMetaLabel}>LABORATORY</Text>
                    </View>
                    <Text style={styles.followUpMetaValue} numberOfLines={2}>
                      {(doc.ai_analysis_result as any).report_meta.lab_name}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              !!(doc.patient_name || doc.issued_by) ? (
                <View style={styles.peopleMetaContainer}>
                  {!!doc.patient_name ? (
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={styles.metaLabelRow}>
                        <Feather name="user" size={9} color="#94A3B8" style={{ marginRight: 3 }} />
                        <Text style={styles.followUpMetaLabel}>PATIENT</Text>
                      </View>
                      <Text style={styles.followUpMetaValue} numberOfLines={1}>
                        {truncateAtWord(
                          doc.patient_name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                          15
                        )}
                      </Text>
                    </View>
                  ) : null}
                  {!!doc.issued_by ? (
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                      <View style={styles.metaLabelRow}>
                        <Feather name="briefcase" size={9} color="#94A3B8" style={{ marginRight: 3 }} />
                        <Text style={styles.followUpMetaLabel}>DOCTOR</Text>
                      </View>
                      <Text style={styles.followUpMetaValue} numberOfLines={1}>
                        {truncateAtWord(doc.issued_by, 17)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null
            )}

            {/* Diagnosis Label — Only for Prescriptions (User preference) */}
            {status.includes('Prescription') && (
              <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
            )}
            
            {/* Test Type Label — For Lab Reports */}
            {status === 'Lab Report' && (
              <Text style={styles.diagnosisLabel}>TEST TYPE</Text>
            )}
            
            {/* Title — dominant element that stands out */}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {status === 'Lab Report' && (doc.ai_analysis_result as any)?.report_meta?.test_type
                ? (doc.ai_analysis_result as any).report_meta.test_type
                : (doc.diagnosis || doc.ai_analysis_result?.file_name || doc.type)}
            </Text>

            {/* Footer section: Next Visit */}
            {hasFollowUp && (
              <View style={styles.followUpMetaContainer}>
                <View style={styles.followUpMetaRow}>
                  <View style={{ flex: 1, alignItems: 'flex-start' }}>
                    <Text style={styles.followUpMetaLabel}>NEXT VISIT</Text>
                    <Text style={styles.followUpMetaValue}>{formatDate(doc.follow_up_date!)}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SectionHeader = ({ title }: { title: string }) => (
  <BlurView intensity={60} tint="light" style={styles.sectionHeaderContainer}>
    <View style={styles.sectionHeaderInner}>
      <Feather name="calendar" size={12} color="#64748B" style={{ marginRight: 6 }} />
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
  </BlurView>
);

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

// --- Skeleton Loader Component ---
const SkeletonCard = ({ index }: { index: number }) => (
  <Animated.View
    entering={FadeInUp.delay(index * 80).duration(500)}
    style={styles.itemRow}
  >
    <View style={styles.dateColumn}>
      <View style={styles.skeletonDateDay} />
      <View style={styles.skeletonDateWeek} />
    </View>
    <View style={styles.spineColumn}>
      <View style={[styles.spineLine, { bottom: -24, backgroundColor: '#E2E8F0', opacity: 0.7 }]} />
      <View style={[styles.spineDot, { borderColor: '#E2E8F0' }]}>
        <View style={[styles.spineDotInner, { backgroundColor: '#E2E8F0' }]} />
      </View>
    </View>
    <View style={styles.cardContainer}>
      <View style={[styles.card, { backgroundColor: '#F8FAFC' }]}>
        <View style={styles.cardInner}>
          <View style={styles.skeletonBadge} />
          <View style={styles.skeletonPeopleRow}>
            <View style={styles.skeletonPeopleBlock} />
            <View style={styles.skeletonPeopleBlock} />
          </View>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonTitleShort} />
        </View>
      </View>
    </View>
  </Animated.View>
);

const SkeletonLoader = () => (
  <View>
    {[0, 1, 2, 3].map(i => (
      <SkeletonCard key={i} index={i} />
    ))}
  </View>
);


export default function TimelineScreen() {
  const navigation = useNavigation();
  const { documents, isLoading } = useDocumentsStore();
  const fetchDocuments = useDocumentsStore((state: any) => state.fetchDocuments);
  const deleteDocument = useDocumentsStore((state: any) => state.deleteDocument);
  const { medications } = useMedicationsStore();
  const { user } = useAuthStore();
  const scrollY = useSharedValue(0);

  const [isInitial, setIsInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await fetchDocuments(user.id);
    } catch (e) {
      console.error('[Timeline] Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, fetchDocuments]);

  useEffect(() => {
    // Keep staggered animation for initial load, then remove delay for smooth scroll unmounting/remounting
    const timer = setTimeout(() => setIsInitial(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Grouping for SectionList — filter out non-medical documents (invalid, unrecognized)
  const sections = useMemo(() => {
    const groups: { [key: string]: Document[] } = {};
    const getDocDate = (doc: Document) => {
      if (doc.report_date) return new Date(doc.report_date).getTime();
      if (doc.visit_date) return new Date(doc.visit_date).getTime();
      return new Date(doc.ai_analyzed_at || new Date().toISOString()).getTime();
    };

    // Only include prescriptions and reports — exclude invalid/unrecognized docs
    const validDocs = documents.filter(doc => {
      const docType = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type?.toLowerCase() || '';
      if (docType === 'invalid' || docType === 'unrecognized') return false;
      // Must be a prescription or report/lab
      return docType.includes('prescription') || docType.includes('report') || docType.includes('lab');
    });

    const sortedDocs = [...validDocs].sort((a, b) => 
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

  const handleEdit = (doc: Document) => {
    const docType = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    if (docType.includes('report') || docType.includes('lab')) {
      (navigation as any).navigate('ReportSummary', { document: doc, documentId: doc.id });
    } else {
      (navigation as any).navigate('PrescriptionSummary', { document: doc, documentId: doc.id });
    }
  };

  const renderSectionHeader = ({ section: { title } }: any) => (
    <SectionHeader title={title} />
  );

  const handleDelete = useCallback((doc: Document) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.diagnosis || doc.type}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(doc.id);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete document. Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteDocument]);

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
        onEdit={handleEdit}
        onDelete={handleDelete}
        showDate={isFirstOfDay}
        isInitial={isInitial}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={() => (
          isLoading && !refreshing ? (
            <SkeletonLoader />
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="clock" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyText}>No records yet</Text>
              <Text style={styles.emptySub}>Your medical timeline will appear here.</Text>
            </View>
          )
        )}
        ListFooterComponent={
          sections.length > 0 ? (
            <View style={styles.footerContainer}>
                {/* Peak-End Rule: End with a positive affirmation */}
                <View style={styles.footerIcon}>
                  <Feather name="check-circle" size={18} color={Colors.success} />
                </View>
                <View style={styles.footerDivider} />
                <Text style={styles.footerText}>You're all caught up</Text>
            </View>
          ) : null
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
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
    ...Typography.styles.h2,
    color: Colors.textPrimary,
    textAlign: 'left',
  },
  headerSubtitle: {
    ...Typography.styles.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'left',
    marginTop: 2,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  headerSpacer: {
    height: 10,
  },
  // Section header — BlurView with accent for aesthetic depth
  sectionHeaderContainer: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.5)',
    marginBottom: 8,
  },
  sectionHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  sectionHeaderTitle: {
    ...Typography.styles.small,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 0,
    paddingHorizontal: 20,
    minHeight: 80,
  },
  // Date column — widened for readability (36→42px)
  dateColumn: {
    width: 42,
    alignItems: 'center',
    paddingTop: 0,
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#334155',
    lineHeight: 24,
  },
  dateWeek: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: -2,
  },
  peopleMetaContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  metaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followUpMetaContainer: {
    marginTop: 2,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.4)', // Subtle divider
  },
  followUpMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  followUpMetaIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpMetaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  followUpMetaValue: {
    fontSize: 12,
    fontWeight: '400',
    color: '#334155',
  },
  spineColumn: {
    width: 24,
    alignItems: 'center',
    position: 'relative',
  },
  spineLine: {
    position: 'absolute',
    top: 0,
    width: 1.5,
    backgroundColor: '#E2E8F0',
    opacity: 0.7,
    zIndex: 0,
    left: 11.25,
  },
  // Spine dot — aligned with first badge row for visual coherence
  spineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  spineDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cardContainer: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 12,
  },
  // Card — premium diffused shadow for modern depth
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 0.8,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },

  // Left accent bar — Gestalt Similarity: instant type scanning via color
  cardInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  // Row 1: type badge always alone
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  // 3-dot kebab menu button — subtle & integrated
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // --- Action Sheet Styles ---
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 20,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 18,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionSheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetTextGroup: {
    flex: 1,
  },
  actionSheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.1,
  },
  actionSheetSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
    marginHorizontal: 4,
  },
  actionSheetCancel: {
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  diagnosisLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  // Card title — Von Restorff Effect: dominant focal point (15px Bold)
  cardTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#0F172A',
    lineHeight: 18,
    letterSpacing: -0.1,
    marginTop: 0,
    marginBottom: 2,
  },

  // Footer — Peak-End Rule: styled component instead of inline
  footerContainer: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 5,
  },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  footerDivider: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
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
  // --- Skeleton Loader Styles ---
  skeletonDateDay: {
    width: 22,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginBottom: 3,
  },
  skeletonDateWeek: {
    width: 28,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  skeletonBadge: {
    width: 72,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  skeletonPeopleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  skeletonPeopleBlock: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  skeletonTitle: {
    width: '85%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  skeletonTitleShort: {
    width: '55%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
});
