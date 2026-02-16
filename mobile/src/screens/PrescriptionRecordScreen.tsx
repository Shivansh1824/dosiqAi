import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Sizes, Typography } from '../constants';
import { Document } from '../types/document';
import { useDocumentsStore } from '../store/documentsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { DocumentPreview } from '../components/prescription';
import { RootStackParamList } from '../../App';
import * as Sharing from 'expo-sharing';

type PrescriptionRecordNavigationProp = StackNavigationProp<RootStackParamList, 'PrescriptionRecord'>;

interface PrescriptionRecordScreenProps {
  onBack: () => void;
  document?: Document;
  documentId?: string;
  navigation: PrescriptionRecordNavigationProp;
}

export default function PrescriptionRecordScreen({ onBack, document: documentProp, documentId, navigation }: PrescriptionRecordScreenProps) {
  const { documents } = useDocumentsStore();
  const { familyMembers } = useFamilyMembersStore();

  // Resolve document
  const document = useMemo(() => {
    if (documentProp) return documentProp;
    if (documentId) return documents.find(d => d.id === documentId);
    return undefined;
  }, [documentProp, documentId, documents]);

  const analysis = document?.ai_analysis_result;
  const prescriptionData = analysis?.prescription_data;

  // Header Title Logic
  const { titleText, subtitleText } = useMemo(() => {
    if (!document) return { titleText: 'Prescription Record', subtitleText: '' };

    let title = prescriptionData?.medical_issue_diagnosis 
      ? `${prescriptionData.medical_issue_diagnosis} Prescription`
      : 'Prescription Record';
      
    const parts = [];
    if (analysis?.patient_info?.name) parts.push(analysis.patient_info.name);
    if (analysis?.common_data?.visit_date) parts.push(analysis.common_data.visit_date);
    
    return { titleText: title, subtitleText: parts.join(' • ') };
  }, [document, analysis, prescriptionData]);

  // Handle Share
  const handleShare = async () => {
    if (!document?.local_file_path) {
      Alert.alert('Error', 'File path not found');
      return;
    }
    // Implement share logic similar to Summary screen if needed
    // For now, basic placeholder or just alert
    Alert.alert('Info', 'Share functionality available in full view');
  };

  if (!document) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{titleText}</Text>
          {subtitleText ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitleText}</Text> : null}
        </View>
        <TouchableOpacity style={styles.headerButtonRight} onPress={handleShare}>
           <Feather name="share-2" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Doctor & Hospital Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="doctor" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Doctor & Hospital</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Doctor Name</Text>
            <Text style={styles.value}>{prescriptionData?.doctor_name || 'Not detected'}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Hospital</Text>
            <Text style={styles.value}>{prescriptionData?.hospital_name || 'Not detected'}</Text>
          </View>
        </View>

        {/* Medicines List */}
        <View style={styles.card}>
           <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="pill" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Medicines</Text>
          </View>
          
          {prescriptionData?.medicines && prescriptionData.medicines.length > 0 ? (
            prescriptionData.medicines.map((med, index) => (
              <View key={index} style={[styles.medicineItem, index > 0 && styles.medicineItemBorder]}>
                <Text style={styles.medicineName}>{med.exact_written_name}</Text>
                {med.dosage_instruction && (
                  <Text style={styles.medicineDosage}>{med.dosage_instruction}</Text>
                )}
                {med.duration && (
                   <Text style={styles.medicineDuration}>Duration: {med.duration}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No medicines detected.</Text>
          )}
        </View>

        {/* Document Preview */}
        <DocumentPreview 
          document={document} 
          onViewFull={() => {
            // Navigation to PDF viewer or Image viewer could be added here
            if (document.local_file_path?.endsWith('.pdf')) {
               navigation.navigate('PdfViewer', {
                 uri: document.local_file_path, // Note: needs absolute path logic in real app
                 title: titleText
               });
            } else {
               // Handle image view
            }
          }} 
        />
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerButtonRight: {
     padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  infoRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  medicineItem: {
    paddingVertical: 8,
  },
  medicineItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  medicineDosage: {
    fontSize: 14,
    color: '#475569',
  },
  medicineDuration: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  emptyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
  }
});
