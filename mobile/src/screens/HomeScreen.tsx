import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Alert, RefreshControl, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { extractFirstName, formatProfileName } from '../utils/nameFormatting';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAppointmentsStore } from '../store/appointmentsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { DocumentType } from '../types/document';
import { compressImage } from '../utils/imageCompression';
import { saveFileLocallyWithUUID, getAbsolutePath } from '../utils/fileStorage';
import AddFamilyMemberModal from '../components/AddFamilyMemberModal';
import AnalysisLoading from '../components/AnalysisLoading';
import FilePreviewModal from '../components/FilePreviewModal';
import ActionSheet from '../components/ActionSheet';

import { reconcileReminders } from '../services/notificationService';

interface HomeScreenProps {
  onNavigate: (screen: 'scan' | 'document' | 'documents' | 'medications' | 'medicationList' | 'health' | 'profile' | 'medicineAlarm' | 'preferenceOnboarding' | 'PrescriptionRecord' | 'ReportSummary' | 'Timeline', params?: any) => void;
  onProfileSwitch: () => void;
}

export default function HomeScreen({ onNavigate, onProfileSwitch }: HomeScreenProps) {
  const { user } = useAuthStore();
  const { documents, isLoading: isLoadingDocs, fetchDocuments, addDocument } = useDocumentsStore();
  const { medications, fetchMedications } = useMedicationsStore();
  const { appointments, fetchAppointments } = useAppointmentsStore();
  const { familyMembers, activeMember, fetchFamilyMembers, setActiveMember } = useFamilyMembersStore();

  // Filtered counts for stat cards
  const documentsCount = documents.length;
  const activeMedicationsCount = medications.filter(med => {
    // Check if expired / ended
    if (med.end_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(med.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) return false;
    }
    return true;
  }).length;
  const upcomingAppointmentsCount = appointments.filter(apt => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const aptDate = new Date(apt.date);
      if (isNaN(aptDate.getTime())) return false;
      aptDate.setHours(0, 0, 0, 0);
      return apt.status === 'scheduled' && aptDate >= today;
    } catch {
      return false;
    }
  }).length;

  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // New State for Preview Modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; type: 'image' | 'document'; name: string } | null>(null);

  // Animations
  const fabScale = useRef(new Animated.Value(1)).current;
  const fabPulse = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    if (user?.id) {
      try {
        await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name || 'Me');
      } catch (error) {
        console.error('[HomeScreen] Failed to ensure primary member:', error);
      }

      await Promise.all([
        useDocumentsStore.getState().loadFromCache(user.id),
        useMedicationsStore.getState().loadFromCache(user.id),
        useAppointmentsStore.getState().loadFromCache(user.id),
        useFamilyMembersStore.getState().loadFromCache(user.id),
      ]);

      await Promise.all([
        fetchDocuments(user.id, true),
        fetchMedications(user.id, true),
        fetchAppointments(user.id, true),
        fetchFamilyMembers(user.id, true),
      ]);

      // Reconcile notifications with the latest fetched medications
      // This fixes the "Ghost Reminder" issue by clearing old ones and resetting valid ones
      const currentMeds = useMedicationsStore.getState().medications;
      await reconcileReminders(currentMeds);
    }
  }, [user?.id, user?.name, fetchDocuments, fetchMedications, fetchAppointments, fetchFamilyMembers]);

  useEffect(() => {
    loadData();

    // FAB pulsing animation - Subtle
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(fabPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile({
          uri: result.assets[0].uri,
          type: 'image',
          name: result.assets[0].fileName || 'Selected Image',
        });
        setPreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile({
          uri: result.assets[0].uri,
          type: 'image',
          name: 'Captured Photo',
        });
        setPreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const fileName = result.assets[0].name;
        const isImage = fileName?.toLowerCase().match(/\.(jpg|jpeg|png|heic|webp)$/i);

        setSelectedFile({
          uri: uri,
          type: isImage ? 'image' : 'document',
          name: fileName,
        });
        setPreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };



  const uploadFile = async (uri: string, type: 'image' | 'document', fileName?: string, isReport: boolean = false) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to upload documents.');
      return;
    }

    if (!isSupabaseConfigured()) {
      Alert.alert('Error', 'Database service not configured.');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[HomeScreen] 📁 UPLOAD FILE CALLED');
    console.log(`[HomeScreen] uploadType state: ${uploadType}`);
    console.log(`[HomeScreen] isReport parameter: ${isReport}`);
    console.log(`[HomeScreen] File type: ${type}`);
    console.log(`[HomeScreen] File name: ${fileName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        Alert.alert('Session Expired', 'Your login session has expired. Please log out and log in again.');
        return;
      }
    } catch (error) {
      Alert.alert('Authentication Error', 'Unable to verify your login session. Please log out and log in again.');
      return;
    }

    let memberForUpload = activeMember;
    if (!memberForUpload) {
      try {
        memberForUpload = await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name || 'Me');
        if (!memberForUpload) {
          Alert.alert('Setup Required', 'Unable to set up your profile. Please log in again.');
          return;
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to set up your profile. Please try again.');
        return;
      }
    }

    if (memberForUpload.id.startsWith('local-')) {
      Alert.alert('Invalid Profile', 'Your profile is not properly set up. Please log out and log in again.');
      return;
    }

    setIsUploading(true);

    try {
      // Get file extension from source URI or fileName
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';

      // Save file locally with UUID filename to flat documents folder
      const { filename, relativePath, fileSize, absolutePath, startR2Upload } = await saveFileLocallyWithUUID(
        uri,
        extension
      );

      // Determine document type based on user's explicit selection
      let docType: DocumentType = isReport ? 'Lab Report' : 'Prescription';

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[HomeScreen] 📋 DOCUMENT TYPE DETERMINATION');
      console.log(`[HomeScreen] Extension: ${extension}`);
      console.log(`[HomeScreen] isReport flag: ${isReport}`);
      console.log(`[HomeScreen] Final docType: ${docType}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Save document metadata to database
      // title = UUID filename for consistency across local, Supabase, and R2
      const savedDocument = await addDocument({
        user_id: user.id,
        type: docType,
        local_file_path: relativePath,
        family_member_id: memberForUpload.id,
        ai_analysis_result: {
          file_name: fileName || filename,
        },
        color: '', // Will be calculated by store from document type
      });

      const actualDocumentId = savedDocument?.id || filename;

      // Start R2 upload AFTER DB insert succeeds to avoid network contention
      // The upload runs in the background and saves cloud_file_key when done
      console.log('[HomeScreen] Setting up R2 upload promise handler...');
      console.log('[HomeScreen] Document ID for cloud key update:', actualDocumentId);

      startR2Upload()
        .then(async (cloudFileKey) => {
          console.log('[HomeScreen] R2 upload promise resolved with key:', cloudFileKey);

          if (cloudFileKey && actualDocumentId) {
            // Use DocumentsStore function which has the correct Supabase context
            const { updateCloudFileKey } = useDocumentsStore.getState();
            const success = await updateCloudFileKey(actualDocumentId, cloudFileKey);

            if (success) {
              console.log('[HomeScreen] ✅ Cloud file key saved via store!');
            } else {
              console.error('[HomeScreen] ❌ Failed to save cloud file key via store');
            }
          } else {
            console.warn('[HomeScreen] Skipping cloud key update - cloudFileKey:', cloudFileKey, 'documentId:', actualDocumentId);
          }
        })
        .catch((error) => {
          console.error('[HomeScreen] R2 upload promise rejected:', error);
        });


      await fetchDocuments(user.id);

      const analysisPath = absolutePath || getAbsolutePath(relativePath);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[HomeScreen] 🔬 TRIGGERING ANALYSIS');
      console.log(`[HomeScreen] Document ID: ${actualDocumentId}`);
      console.log(`[HomeScreen] Analysis path: ${analysisPath}`);
      console.log(`[HomeScreen] isReport flag: ${isReport}`);
      console.log('[HomeScreen] Expected prompt:', isReport ? 'REPORT_PROMPT' : 'DOCUMENT_ANALYSIS_PROMPT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Trigger analysis immediately in background (non-blocking)
      const { triggerAnalysis } = useDocumentsStore.getState();
      console.log('[HomeScreen] Triggering background analysis: id=', actualDocumentId, 'path=', analysisPath, 'isReport=', isReport);
      triggerAnalysis(actualDocumentId, analysisPath, undefined, isReport).catch((error) => {
        console.error('[HomeScreen] Background analysis failed:', error);
      });
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                Upload Logic                                */
  /* -------------------------------------------------------------------------- */

  /* -------------------------------------------------------------------------- */
  /*                                Upload Logic                                */
  /* -------------------------------------------------------------------------- */

  // Custom Action Sheet State
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    title?: string;
    subtitle?: string;
    options: import('../components/ActionSheet').ActionSheetOption[];
  }>({ options: [] });

  const [uploadType, setUploadType] = useState<'prescription' | 'report'>('prescription');
  const pendingAction = useRef<(() => void) | null>(null);

  const showUploadTypeSelection = () => {
    // Universal Custom Action Sheet (iOS & Android)
    setActionSheetConfig({
      title: 'Upload Document',
      subtitle: 'What would you like to upload?',
      options: [
        {
          label: 'Upload Prescription',
          icon: 'file-text',
          onPress: () => {
            setUploadType('prescription');
            pendingAction.current = () => showSourceOptions('prescription');
            setActionSheetVisible(false);
          },
        },
        {
          label: 'Upload Report',
          icon: 'activity',
          onPress: () => {
            setUploadType('report');
            pendingAction.current = () => showSourceOptions('report');
            setActionSheetVisible(false);
          },
        },
      ],
    });
    setActionSheetVisible(true);
  };

  const showSourceOptions = (type?: 'prescription' | 'report') => {
    const currentType = type || uploadType;
    const title = currentType === 'prescription' ? 'Upload Prescription' : 'Upload Medical Report';

    // Universal Custom Action Sheet (iOS & Android)
    setActionSheetConfig({
      title: title,
      subtitle: 'Choose an option',
      options: [
        {
          label: 'Photo Library',
          icon: 'image',
          onPress: () => {
            pendingAction.current = () => pickImage();
            setActionSheetVisible(false);
          },
        },
        {
          label: 'Take Photo',
          icon: 'camera',
          onPress: () => {
            pendingAction.current = () => takePhoto();
            setActionSheetVisible(false);
          },
        },
        {
          label: 'Choose Files',
          icon: 'folder',
          onPress: () => {
            pendingAction.current = () => pickDocument();
            setActionSheetVisible(false);
          },
        },
      ],
    });
    setActionSheetVisible(true);
  };

  // Replaces the old showUploadOptions
  const showUploadOptions = showUploadTypeSelection;

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    const { uri, type, name } = selectedFile;
    const isImage = type === 'image';
    const isReport = uploadType === 'report';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[HomeScreen] 🔄 CONFIRM UPLOAD');
    console.log(`[HomeScreen] uploadType state: ${uploadType}`);
    console.log(`[HomeScreen] Derived isReport: ${isReport}`);
    console.log(`[HomeScreen] File: ${name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      if (isImage) {
        setIsCompressing(true);
        const compressedUri = await compressImage(uri);
        setIsCompressing(false);

        if (compressedUri) {
          await uploadFile(compressedUri, 'image', name, isReport);
        }
      } else {
        await uploadFile(uri, 'document', name, isReport);
      }
    } catch (error) {
      console.error('Error in confirm upload:', error);
      setIsCompressing(false);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setPreviewModalVisible(false);
      setSelectedFile(null);
    }
  };

  const recentDocuments = documents.slice(0, 3);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderStatCards = () => {
    const cards = [
      {
        key: 'documents',
        icon: 'file-text',
        iconBg: '#E8F4FD',
        iconColor: '#4A90E2',
        value: documentsCount,
        label: 'Documents',
        onPress: () => onNavigate('documents'),
      },
      {
        key: 'medications',
        icon: 'activity',
        iconBg: '#FEF3C7',
        iconColor: '#F59E0B',
        value: activeMedicationsCount,
        label: 'Medications',
        onPress: () => onNavigate('medicationList'),
      },
      {
        key: 'appointments',
        icon: 'calendar',
        iconBg: '#CCFBF1',
        iconColor: '#14B8A6',
        value: upcomingAppointmentsCount,
        label: 'Appointments',
        onPress: () => {
          Alert.alert(
            'Coming Soon',
            'Appointments management is under development.',
            [{ text: 'OK' }]
          );
        },
      },
    ];

    return cards.map(card => (
      <TouchableOpacity
        key={card.key}
        style={styles.statCardWrapper}
        onPress={card.onPress}
        activeOpacity={0.85}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${card.label}: ${card.value}`}
        accessibilityHint={`View all ${card.label.toLowerCase()}`}
      >
        <View style={styles.statCardContent}>
          <View style={[styles.statIconCircle, { backgroundColor: card.iconBg }]}>
            <Feather name={card.icon as any} size={24} color={card.iconColor} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{card.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header - Greeting + Notification */}
        <View style={styles.header}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{user?.name ? extractFirstName(user.name) : 'User'} 👋</Text>
          </View>

          <TouchableOpacity style={styles.notificationButton}>
            <Feather name="bell" size={22} color={Colors.gray700} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >

          {/* Family Member Card - Full Width */}
          <View style={styles.profileCardContainer}>
            <TouchableOpacity
              style={styles.profileCardWrapper}
              onPress={() => setShowFamilyModal(true)}
              activeOpacity={0.85}
            >
              <View style={styles.profileCard}>
                <View style={styles.profileCardLeft}>
                  <View style={styles.profileCardAvatar}>
                    <Feather name="user" size={20} color="#4A90E2" />
                  </View>
                  <View style={styles.profileCardTextContainer}>
                    <Text style={styles.profileCardLabel}>Tracking health for</Text>
                    <Text style={styles.profileCardName}>
                      {formatProfileName(activeMember?.name || user?.name || 'Select Profile')}
                      {activeMember?.relationship && (
                        <Text style={styles.profileCardRelationship}> • {activeMember.relationship}</Text>
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.profileCardChevron}>
                  <Feather name="chevron-down" size={20} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Stats Row - Vertical Cards in Flexbox Row */}
          <View style={styles.statsOuterContainer}>
            <View style={styles.statsContainer}>
              {renderStatCards()}
            </View>
          </View>


          {/* AI Health Insights Card */}
          <TouchableOpacity style={styles.insightsCard} activeOpacity={0.85}>
            <View style={styles.insightsContent}>
              <View style={styles.insightsIcon}>
                <Feather name="zap" size={20} color="#4A90E2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightsTitle}>Health Insight</Text>
                <Text style={styles.insightsText}>
                  You've uploaded {documents.length} document{documents.length !== 1 ? 's' : ''} this month. Keep tracking your health!
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>



          {/* Recent Documents Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Documents</Text>
              <TouchableOpacity onPress={() => onNavigate('documents')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {isLoadingDocs ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading documents...</Text>
              </View>
            ) : recentDocuments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Feather name="file-text" size={32} color={Colors.gray300} />
                </View>
                <Text style={styles.emptyTitle}>No documents yet</Text>
                <Text style={styles.emptySubtitle}>Tap the + button to add your first document</Text>
              </View>
            ) : (
              <View style={styles.documentsList}>
                {recentDocuments.map((doc, index) => {
                  const displayTitle = doc.ai_analysis_status === 'processing' || doc.ai_analysis_status === 'pending'
                    ? "dosiq Ai • Analyzing..."
                    : (doc.ai_analysis_result?.document_type?.toLowerCase() === 'invalid'
                      ? "Unrecognized Document"
                      : (doc.ai_analysis_result?.file_name || doc.local_file_path || 'Untitled Document'));
                  const displayType = doc.ai_analysis_result?.document_type
                    ? (doc.ai_analysis_result.document_type.toLowerCase() === 'invalid'
                      ? 'Invalid'
                      : doc.ai_analysis_result.document_type.charAt(0).toUpperCase() + doc.ai_analysis_result.document_type.slice(1).replace(/_/g, ' '))
                    : doc.type;

                  // Dynamic card colors - Clean Professional
                  const cardColors = [
                    { borderColor: '#8B5CF6', iconBg: '#EDE9FE', iconColor: '#8B5CF6' },
                    { borderColor: '#EC4899', iconBg: '#FCE7F3', iconColor: '#EC4899' },
                    { borderColor: '#14B8A6', iconBg: '#CCFBF1', iconColor: '#14B8A6' },
                  ];
                  const colorScheme = cardColors[index % cardColors.length];

                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={[styles.documentCardNew, { borderLeftColor: colorScheme.borderColor }]}
                      onPress={() => onNavigate('document', { document: doc, documentId: doc.id })}
                      activeOpacity={0.85}
                    >
                      <View style={styles.documentCardContent}>
                        <View style={[styles.documentIconNew, { backgroundColor: colorScheme.iconBg }]}>
                          <Feather name="file-text" size={22} color={colorScheme.iconColor} />
                        </View>
                        <View style={styles.documentInfoNew}>
                          <Text style={styles.documentTitleNew} numberOfLines={1}>{displayTitle}</Text>
                          <View style={styles.documentMetaNew}>
                            <View style={styles.typeBadgeNew}>
                              <Text style={styles.typeBadgeTextNew}>{displayType}</Text>
                            </View>
                            <Text style={styles.documentDateNew}>{formatDate(doc.ai_analyzed_at || new Date().toISOString())}</Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.documentStatusBadge,
                            (doc.ai_analysis_status === 'processing' || doc.ai_analysis_status === 'pending') && { backgroundColor: 'transparent' }
                          ]}
                        >
                          {doc.ai_analysis_status === 'processing' || doc.ai_analysis_status === 'pending' ? (
                            <AnalysisLoading size={30} color="#4A90E2" />
                          ) : (
                            <Feather name="check-circle" size={16} color="#10B981" />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>







          {/* Developer Preview Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Developer Preview</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
              style={{ marginTop: 10 }}
            >
              <TouchableOpacity
                style={[styles.developerCard, { marginRight: 12, width: 160 }]}
                onPress={() => onNavigate('Timeline')}
              >
                <View style={[styles.developerIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Feather name="clock" size={20} color="#6366F1" />
                </View>
                <Text style={styles.developerLabel}>Medical Timeline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.developerCard, { marginRight: 12, width: 160 }]}
                onPress={() => {
                  // Find the first prescription document
                  const firstPrescription = documents.find(d => 
                    d.type === 'Prescription' || 
                    d.ai_analysis_result?.document_type?.toLowerCase() === 'prescription'
                  );
                  const documentId = firstPrescription?.id || '44415772-4442-48b2-b664-7ef9a1d077ea';
                  onNavigate('PrescriptionRecord', { documentId });
                }}
              >
                <View style={[styles.developerIcon, { backgroundColor: '#F0F9FF' }]}>
                  <Feather name="file-text" size={20} color="#0EA5E9" />
                </View>
                <Text style={styles.developerLabel}>Prescription Record</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.developerCard, { marginRight: 12, width: 160 }]}
                onPress={() => {
                  if (recentDocuments.length > 0) {
                    // Navigating to the summary screen for verification testing
                    // This would normally be accessed after upload, but we show it here for dev
                  }
                  Alert.alert('Info', 'Use the timeline to see verified records.');
                }}
              >
                <View style={[styles.developerIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Feather name="shield" size={20} color="#F97316" />
                </View>
                <Text style={styles.developerLabel}>Medical Summary</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Floating Action Button with Subtle Animation */}
        <Animated.View style={[styles.fabShadow, { transform: [{ scale: fabPulse }] }]}>
          <TouchableOpacity
            style={styles.fab}
            onPress={showUploadOptions}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            <Feather name="upload-cloud" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <View style={styles.navIconActive}>
              <Feather name="home" size={22} color={Colors.primary} />
            </View>
            <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('medications')}>
            <Feather name="package" size={22} color={Colors.gray400} />
            <Text style={styles.navText}>Medications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('health')}>
            <Feather name="heart" size={22} color={Colors.gray400} />
            <Text style={styles.navText}>Health</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
            <Feather name="user" size={22} color={Colors.gray400} />
            <Text style={styles.navText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Loading Overlay */}
      {
        (isUploading || isCompressing) && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.uploadingText}>
                {isCompressing ? 'Optimizing image...' : 'Uploading document...'}
              </Text>
            </View>
          </View>
        )
      }

      {/* Preview Modal */}
      <FilePreviewModal
        visible={previewModalVisible}
        fileUri={selectedFile?.uri || null}
        fileType={selectedFile?.type || 'image'}
        fileName={selectedFile?.name || ''}
        onConfirm={handleConfirmUpload}
        onCancel={() => {
          setPreviewModalVisible(false);
          setSelectedFile(null);
        }}
        isUploading={isUploading || isCompressing}
      />

      {/* Family Member Selection Modal */}
      <Modal
        visible={showFamilyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFamilyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.familyModalContainer}>
            <View style={styles.familyModalHeader}>
              <Text style={styles.familyModalTitle}>Select Family Member</Text>
              <TouchableOpacity onPress={() => setShowFamilyModal(false)}>
                <Feather name="x" size={24} color={Colors.gray700} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.familyMembersList}>
              {familyMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.familyMemberItem,
                    activeMember?.id === member.id && styles.familyMemberItemActive,
                  ]}
                  onPress={() => {
                    setActiveMember(member);
                    setShowFamilyModal(false);
                  }}
                >
                  <View style={styles.familyModalAvatar}>
                    <Feather name="user" size={24} color="#FFF" />
                  </View>
                  <View style={styles.familyModalInfo}>
                    <Text style={styles.familyModalName}>{formatProfileName(member.name)}</Text>
                    {member.relationship && (
                      <Text style={styles.familyModalRelation}>{member.relationship}</Text>
                    )}
                  </View>
                  {activeMember?.id === member.id && (
                    <Feather name="check" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.addFamilyMemberButton}
                onPress={() => {
                  setShowFamilyModal(false);
                  setTimeout(() => setShowAddMemberModal(true), 500);
                }}
              >
                <View style={styles.addMemberIcon}>
                  <Feather name="plus" size={24} color={Colors.primary} />
                </View>
                <Text style={styles.addMemberText}>Add New Profile</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AddFamilyMemberModal
        visible={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onSuccess={() => {
          fetchFamilyMembers(user?.id || '', true);
        }}
      />

      {/* Custom Action Sheet */}
      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        onDismissed={() => {
          if (pendingAction.current) {
            pendingAction.current();
            pendingAction.current = null;
          }
        }}
        title={actionSheetConfig.title}
        subtitle={actionSheetConfig.subtitle}
        options={actionSheetConfig.options}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  safeArea: {
    flex: 1,
  },

  // Header - Greeting Only (Prominent)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: Colors.white,
  },
  greetingSection: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    ...Typography.fontWeights.regular,
    color: Colors.gray600,
    marginBottom: 4,
  },
  userName: {
    fontSize: 34,
    ...Typography.fontWeights.semibold,
    color: Colors.gray900,
    letterSpacing: -0.5,
  },

  // Profile Card Container - No horizontal padding (aligned with ScrollView)
  profileCardContainer: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  profileCardWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EBF5FF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  profileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileCardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  profileCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A90E2',
    marginRight: 12,
  },
  profileCardLabel: {
    fontSize: 14,
    ...Typography.fontWeights.semibold,
    color: '#4B5563',
    marginBottom: 2,
  },
  profileCardName: {
    fontSize: 16,
    ...Typography.fontWeights.bold,
    color: '#1F2937',
  },
  profileCardRelationship: {
    fontSize: 14,
    ...Typography.fontWeights.medium,
    color: '#4A90E2',
  },
  profileCardChevron: {
    marginLeft: 8,
  },
  profileStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  profileStreakText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.lg,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // Stats Container - Vertical Cards in Flexbox Row (NO Scrolling)
  statsOuterContainer: {
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',       // 3 cards in horizontal row
    justifyContent: 'space-between',
    gap: 12,                    // 12px gap between cards
    // No paddingHorizontal - parent ScrollView provides it (Sizes.lg = 24px)
  },
  statCardWrapper: {
    flex: 1,                     // Equal width cards
    borderRadius: Sizes.radiusLg,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardContent: {
    flexDirection: 'column',     // VERTICAL layout (icon → value → label)
    alignItems: 'center',        // Center all content horizontally
    justifyContent: 'center',
    paddingVertical: 20,         // Increased for more breathing room
    paddingHorizontal: 10,       // Reduced to fit full "Appointments" text
    borderRadius: Sizes.radiusLg,
    backgroundColor: Colors.white,
    minHeight: 120,              // Increased to accommodate labels
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,            // Increased for more space below icon
  },
  statTextContainer: {
    alignItems: 'center',        // Center text horizontally
  },
  statValue: {
    fontSize: 24,
    ...Typography.fontWeights.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 6,             // Increased for more space below value
  },
  statLabel: {
    fontSize: 11,                // Compact font for label
    ...Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // AI Insights Card
  insightsCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  insightsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  insightsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  insightsTitle: {
    fontSize: 14,
    ...Typography.fontWeights.bold,
    color: '#1F2937',
    marginBottom: 4,
  },
  insightsText: {
    fontSize: 13,
    ...Typography.fontWeights.regular,
    color: '#6B7280',
    lineHeight: 18,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    ...Typography.fontWeights.bold,
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    ...Typography.fontWeights.semibold,
    color: '#4A90E2',
  },

  // Documents List - New Design
  documentsList: {
    gap: 12,
  },
  documentCardNew: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 3,
  },
  documentCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  documentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  documentIconNew: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentInfoNew: {
    flex: 1,
  },
  documentTitleNew: {
    fontSize: 15,
    ...Typography.fontWeights.bold,
    color: '#1F2937',
    marginBottom: 6,
  },
  documentMetaNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadgeNew: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeBadgeTextNew: {
    fontSize: 11,
    ...Typography.fontWeights.semibold,
    color: '#6B7280',
  },
  documentDateNew: {
    fontSize: 12,
    ...Typography.fontWeights.regular,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  documentStatusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Old document card styles for backwards compatibility
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    padding: Sizes.md,
    borderRadius: 12,
    marginBottom: Sizes.sm,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray900,
    marginBottom: 6,
    lineHeight: 18,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
  },
  typeBadge: {
    backgroundColor: Colors.gray200,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray600,
  },
  documentDate: {
    fontSize: 12,
    color: Colors.gray500,
  },

  // Loading & Empty States
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Sizes.xl,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    gap: Sizes.sm,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.gray500,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: Sizes.xl,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  emptyTitle: {
    fontSize: 16,
    ...Typography.fontWeights.semibold,
    color: Colors.gray700,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.gray500,
    textAlign: 'center',
  },

  // Floating Action Button - Clean Professional
  fabShadow: {
    position: 'absolute',
    right: 24,
    bottom: 100,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.sm,
    paddingHorizontal: Sizes.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingBottom: Platform.OS === 'ios' ? 24 : Sizes.sm,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Sizes.xs,
  },
  navIconActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontSize: 11,
    ...Typography.fontWeights.regular,
    color: Colors.gray400,
    marginTop: 4,
  },
  navTextActive: {
    color: Colors.primary,
    ...Typography.fontWeights.semibold,
  },

  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  uploadingText: {
    marginTop: Sizes.md,
    fontSize: 16,
    ...Typography.fontWeights.semibold,
    color: Colors.gray700,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  familyModalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  familyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Sizes.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  familyModalTitle: {
    fontSize: 18,
    ...Typography.fontWeights.bold,
    color: Colors.gray900,
  },
  familyMembersList: {
    padding: Sizes.lg,
  },
  familyMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
    borderRadius: 12,
    marginBottom: Sizes.sm,
    backgroundColor: Colors.gray50,
  },
  familyMemberItemActive: {
    backgroundColor: '#E8F0FE',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  familyMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  familyMemberInfo: {
    flex: 1,
  },
  familyMemberName: {
    fontSize: 16,
    ...Typography.fontWeights.semibold,
    color: Colors.gray900,
  },
  familyMemberRelationship: {
    fontSize: 13,
    ...Typography.fontWeights.regular,
    color: Colors.gray500,
    marginTop: 2,
  },
  // Family Modal Styles
  familyModalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6', // Blue background
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  familyModalInfo: {
    flex: 1,
  },
  familyModalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  familyModalRelation: {
    fontSize: 13,
    color: '#6B7280',
  },
  addFamilyMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    backgroundColor: '#EFF6FF',
  },
  addMemberIcon: {
    marginRight: 8,
  },
  addMemberText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Sizes.sm,
    padding: Sizes.md,
    margin: Sizes.lg,
    marginTop: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addMemberButtonText: {
    fontSize: 16,
    ...Typography.fontWeights.semibold,
    color: Colors.primary,
  },
  developerGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  developerCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  developerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  developerLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: Colors.gray800,
    textAlign: 'center',
  },
});
