import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Sizes, Typography } from '../constants';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { Document } from '../types/document';

export default function TimelineScreen() {
  const navigation = useNavigation();
  const { documents } = useDocumentsStore();
  const { medications } = useMedicationsStore();

  // Group documents by Month/Year
  const groupedDocuments = useMemo(() => {
    const groups: { [key: string]: Document[] } = {};
    
    // Sort documents by date (newest first)
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
      // For prescriptions, check if verified (medications added)
      const isVerified = medications.some((med: any) => med.source_document_id === doc.id);
      
      if (isVerified) {
        (navigation as any).navigate('PrescriptionRecord', { document: doc, documentId: doc.id });
      } else {
        (navigation as any).navigate('PrescriptionSummary', { document: doc, documentId: doc.id });
      }
    }
  };

  const getDocIcon = (doc: Document) => {
    const type = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    if (type.includes('report')) return 'activity';
    return 'file-text';
  };

  const getDocStatus = (doc: Document) => {
    const type = doc.ai_analysis_result?.document_type?.toLowerCase() || doc.type.toLowerCase();
    if (type.includes('report')) return 'Report';
    
    const isVerified = medications.some((med: any) => med.source_document_id === doc.id);
    return isVerified ? 'Verified' : 'Draft';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical Timeline</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {Object.keys(groupedDocuments).length === 0 ? (
           <View style={styles.emptyContainer}>
             <Feather name="clock" size={48} color={Colors.gray300} />
             <Text style={styles.emptyText}>No history yet</Text>
             <Text style={styles.emptySubtext}>Documents you upload will appear here chronologically.</Text>
           </View>
        ) : (
          Object.entries(groupedDocuments).map(([month, docs], groupIndex) => (
            <View key={month} style={styles.monthGroup}>
              <View style={styles.monthHeaderContainer}>
                <View style={styles.monthBadge}>
                   <Text style={styles.monthText}>{month}</Text>
                </View>
              </View>

              <View style={styles.timelineList}>
                {docs.map((doc, index) => {
                  const isLast = index === docs.length - 1;
                  const status = getDocStatus(doc);
                  const isVerified = status === 'Verified';
                  
                  return (
                    <View key={doc.id} style={styles.timelineItem}>
                      {/* Left Timeline Line */}
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, isVerified ? styles.dotVerified : styles.dotDraft]}>
                          <Feather name={getDocIcon(doc)} size={12} color={Colors.white} />
                        </View>
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>

                      {/* Right Content Card */}
                      <TouchableOpacity 
                        style={styles.timelineCard} 
                        onPress={() => handleDocumentPress(doc)}
                        activeOpacity={0.7}
                      >
                         <View style={styles.cardHeader}>
                           <Text style={styles.cardDate}>
                             {new Date(doc.created_at).toLocaleDateString('en-US', { day: 'numeric', weekday: 'short' })}
                           </Text>
                           <View style={[styles.statusBadge, isVerified ? styles.statusVerified : styles.statusDraft]}>
                              <Text style={[styles.statusText, isVerified ? styles.statusTextVerified : styles.statusTextDraft]}>
                                {status}
                              </Text>
                           </View>
                         </View>
                         
                         <Text style={styles.docTitle} numberOfLines={1}>
                            {doc.ai_analysis_result?.file_name || doc.local_file_path?.split('/').pop() || 'Medical Document'}
                         </Text>
                         
                         <Text style={styles.docSubtitle} numberOfLines={1}>
                            {doc.ai_analysis_result?.document_type ? 
                              doc.ai_analysis_result.document_type.charAt(0).toUpperCase() + doc.ai_analysis_result.document_type.slice(1).replace(/_/g, ' ') 
                              : 'Document'}
                         </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray800,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray500,
    marginTop: 8,
    maxWidth: 250,
    textAlign: 'center',
  },
  monthGroup: {
    marginBottom: 0,
  },
  monthHeaderContainer: {
     paddingVertical: 16,
     paddingHorizontal: 20,
     backgroundColor: '#F8F9FA',
     position: 'relative',
     zIndex: 1,
  },
  monthBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  timelineList: {
    paddingHorizontal: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0,
    minHeight: 100,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 30,
    marginRight: 12,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#F8F9FA',
  },
  dotVerified: {
    backgroundColor: '#10B981',
  },
  dotDraft: {
    backgroundColor: '#94A3B8',
  },
  timelineLine: {
    width: 2,
    backgroundColor: '#E2E8F0',
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
    minHeight: 20,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusVerified: {
    backgroundColor: '#ECFDF5',
  },
  statusDraft: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextVerified: {
    color: '#059669',
  },
  statusTextDraft: {
    color: '#64748B',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  docSubtitle: {
    fontSize: 14,
    color: Colors.gray500,
  },
});
