import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Alert, ActionSheetIOS, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAppointmentsStore } from '../store/appointmentsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useFocusEffect } from '@react-navigation/native';
import { formatAppointmentDateTime } from '../types/appointment';
import { getFrequencyText } from '../types/medication';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { DocumentType } from '../types/document';
import { compressImage } from '../utils/imageCompression';
import { saveFileLocally } from '../utils/fileStorage';
import AddFamilyMemberModal from '../components/AddFamilyMemberModal';

// Removed: No longer uploading to Supabase Storage

interface HomeScreenProps {
  onNavigate: (screen: string, params?: any) => void;
  onProfileSwitch: () => void;
}

export default function HomeScreen({ onNavigate, onProfileSwitch }: HomeScreenProps) {
  const { user } = useAuthStore();
  const { documents, isLoading: isLoadingDocs, fetchDocuments, addDocument } = useDocumentsStore();
  const { medications, fetchMedications } = useMedicationsStore();
  const { appointments, fetchAppointments } = useAppointmentsStore();
  const { familyMembers, activeMember, isInitialized, fetchFamilyMembers, setActiveMember } = useFamilyMembersStore();

  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Fetch all data with cache-first approach
  const loadData = useCallback(async () => {
    if (user?.id) {
      // Step 0: CRITICAL - Ensure primary "Self" family member exists FIRST
      // This must happen before any data loading to avoid race conditions
      try {
        await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name || 'Me');
      } catch (error) {
        console.error('[HomeScreen] Failed to ensure primary member:', error);
      }

      // Step 1: Load from cache instantly (no loading spinner)
      await Promise.all([
        useDocumentsStore.getState().loadFromCache(user.id),
        useMedicationsStore.getState().loadFromCache(user.id),
        useAppointmentsStore.getState().loadFromCache(user.id),
        useFamilyMembersStore.getState().loadFromCache(user.id),
      ]);

      // Step 2: Refresh from Supabase silently in background
      await Promise.all([
        fetchDocuments(user.id, true), // silent=true
        fetchMedications(user.id, true),
        fetchAppointments(user.id, true),
        fetchFamilyMembers(user.id, true),
      ]);
    }
  }, [user?.id, user?.name, fetchDocuments, fetchMedications, fetchAppointments, fetchFamilyMembers]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Request permissions for image picker
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload images.'
      );
      return false;
    }
    return true;
  };

  // Pick image from photo library
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1.0, // Use max quality, we'll compress it ourselves
      });

      if (!result.canceled && result.assets[0]) {
        setIsCompressing(true);
        const compressedUri = await compressImage(result.assets[0].uri);
        setIsCompressing(false);

        if (compressedUri) {
          await uploadFile(compressedUri, 'image');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setIsCompressing(false);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your camera to take photos.'
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1.0, // Use max quality, we'll compress it ourselves
      });

      if (!result.canceled && result.assets[0]) {
        setIsCompressing(true);
        const compressedUri = await compressImage(result.assets[0].uri);
        setIsCompressing(false);

        if (compressedUri) {
          await uploadFile(compressedUri, 'image');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      setIsCompressing(false);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Pick document file
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const fileName = result.assets[0].name;

        // Check if it's an image (compress) or PDF (skip compression)
        const isImage = fileName?.toLowerCase().match(/\.(jpg|jpeg|png|heic|webp)$/i);

        if (isImage) {
          setIsCompressing(true);
          const compressedUri = await compressImage(uri);
          setIsCompressing(false);

          if (compressedUri) {
            await uploadFile(compressedUri, 'document', fileName);
          }
        } else {
          await uploadFile(uri, 'document', fileName);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      setIsCompressing(false);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  // Upload file - saves locally and stores metadata in Supabase
  const uploadFile = async (uri: string, type: 'image' | 'document', fileName?: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to upload documents.');
      return;
    }

    if (!isSupabaseConfigured()) {
      Alert.alert('Error', 'Database service not configured.');
      return;
    }

    // CRITICAL: Verify active Supabase session before upload
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('[HomeScreen] No active Supabase session for upload');
        Alert.alert(
          'Session Expired',
          'Your login session has expired. Please log out and log in again to continue uploading documents.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Optionally navigate to profile/logout
                console.log('[HomeScreen] User acknowledged session expiration');
              }
            }
          ]
        );
        return;
      }
    } catch (error) {
      console.error('[HomeScreen] Session check failed:', error);
      Alert.alert(
        'Authentication Error',
        'Unable to verify your login session. Please log out and log in again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // DEFENSIVE CHECK: If no active member, auto-create the primary "Self" member
    // This ensures the main user can ALWAYS upload their documents
    let memberForUpload = activeMember;
    if (!memberForUpload) {
      console.log('[HomeScreen] No active member found, auto-creating primary member...');
      try {
        memberForUpload = await useFamilyMembersStore.getState().ensurePrimaryMemberExists(
          user.id,
          user.name || 'Me'
        );

        if (!memberForUpload) {
          console.error('[HomeScreen] Failed to create primary member - no valid session');
          Alert.alert(
            'Setup Required',
            'Unable to set up your profile. Please log in again.',
            [{ text: 'OK' }]
          );
          return;
        }

        console.log('[HomeScreen] Primary member auto-created:', memberForUpload.id);
      } catch (error) {
        console.error('[HomeScreen] Failed to auto-create primary member:', error);
        Alert.alert('Error', 'Failed to set up your profile. Please try again.');
        return;
      }
    }

    // VALIDATION: Ensure family member has a valid UUID (not a placeholder)
    if (memberForUpload.id.startsWith('local-')) {
      console.error('[HomeScreen] Cannot upload with placeholder family member ID:', memberForUpload.id);
      Alert.alert(
        'Invalid Profile',
        'Your profile is not properly set up. Please log out and log in again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique document ID
      const documentId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Determine filename
      const originalFileName = fileName || `${type}_${Date.now()}.${uri.split('.').pop() || 'jpg'}`;

      // Save file locally to user's folder
      const { relativePath, fileSize, absolutePath } = await saveFileLocally(
        uri,
        memberForUpload.name,
        documentId,
        originalFileName
      );

      // Determine document type
      const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || '';
      const docType: DocumentType = fileExtension === 'pdf' ? 'Report' : 'Imaging';

      // Save document metadata to database (using relative path for persistence)
      const savedDocument = await addDocument({
        user_id: user.id,
        title: originalFileName.replace(/\.[^/.]+$/, '') || `Document ${new Date().toLocaleDateString()}`,
        type: docType,
        local_file_path: relativePath, // Store relative path for persistence across rebuilds
        family_member_id: memberForUpload.id,
        file_size: fileSize,
        is_local: true,
        color: '',
      });

      // Get the actual document ID from Supabase (UUID)
      const actualDocumentId = savedDocument?.id || documentId;
      console.log('[HomeScreen] Document saved with ID:', actualDocumentId);

      // Refresh documents list
      await fetchDocuments(user.id);

      // Get absolute path for analysis
      const { getAbsolutePath } = await import('../utils/fileStorage');
      const analysisPath = absolutePath || getAbsolutePath(relativePath);

      // Show success and trigger analysis
      Alert.alert(
        'Success',
        'Document uploaded successfully! Analyzing...',
        [
          {
            text: 'OK',
            onPress: () => {
              // Trigger analysis in background (non-blocking) with correct document ID
              console.log('[HomeScreen] Triggering analysis for document:', actualDocumentId);
              console.log('[HomeScreen] Analysis path:', analysisPath);

              const { triggerAnalysis } = useDocumentsStore.getState();
              triggerAnalysis(actualDocumentId, analysisPath).catch((error) => {
                console.error('[HomeScreen] Background analysis failed:', error);
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Show iOS action sheet for upload options
  const showUploadOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Take Photo or Video', 'Choose Files'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1:
              pickImage();
              break;
            case 2:
              takePhoto();
              break;
            case 3:
              pickDocument();
              break;
          }
        }
      );
    } else {
      // Android - show Alert with options
      Alert.alert(
        'Upload Document',
        'Choose an option',
        [
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose Files', onPress: pickDocument },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Get only the 3 most recent documents for display
  const recentDocuments = documents.slice(0, 3);

  // Get next upcoming appointment
  const nextAppointment = appointments.length > 0 ? appointments[0] : null;

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const stats = [
    { icon: 'file-text', label: 'Documents', value: String(documents.length), color: '#3B82F6', bgColor: '#EFF6FF' },
    { icon: 'activity', label: 'Medications', value: String(medications.length), color: '#10B981', bgColor: '#ECFDF5' },
    { icon: 'calendar', label: 'Appointments', value: String(appointments.length), color: '#F59E0B', bgColor: '#FEF3C7' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'} 👋</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <View style={styles.notificationBadge} />
          <Feather name="bell" size={24} color={Colors.gray700} />
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
        {/* Profile Card with Glassmorphism */}
        <TouchableOpacity onPress={() => setShowFamilyModal(true)} activeOpacity={0.9}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileCardContent}>
              <View style={styles.profileInfo}>
                <View style={styles.profileAvatar}>
                  <Feather name="user" size={28} color={Colors.white} />
                </View>
                <View style={styles.profileTextContainer}>
                  <Text style={styles.profileLabel}>Active Profile</Text>
                  <Text style={styles.profileName}>{activeMember?.name || user?.name || 'User'}</Text>
                </View>
              </View>
              <View style={styles.switchIconContainer}>
                <Feather name="chevron-down" size={20} color={Colors.white} />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Stats - Horizontal Scroll */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
            {stats.map((stat, index) => (
              <View key={index} style={[styles.statCard, index === stats.length - 1 && styles.statCardLast]}>
                <View style={[styles.statIconContainer, { backgroundColor: stat.bgColor }]}>
                  <Feather name={stat.icon as any} size={24} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Recent Documents Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Documents</Text>
            <TouchableOpacity onPress={() => onNavigate('documents')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.documentsList}>
            {isLoadingDocs ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading documents...</Text>
              </View>
            ) : recentDocuments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="file-text" size={48} color={Colors.gray300} />
                <Text style={styles.emptyText}>No documents yet</Text>
                <Text style={styles.emptySubtext}>Tap the upload button to add your first document</Text>
              </View>
            ) : (
              recentDocuments.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.documentCard}
                  onPress={() => onNavigate('document', { document: doc })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.documentIconContainer, { backgroundColor: doc.color + '15' }]}>
                    <Feather name="file-text" size={24} color={doc.color} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle}>{doc.title}</Text>
                    <View style={styles.documentMeta}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{doc.type}</Text>
                      </View>
                      <Text style={styles.documentDate}>{formatDate(doc.created_at)}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={Colors.gray400} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Extra padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modern Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={showUploadOptions}
        activeOpacity={0.8}
        disabled={isUploading}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Feather name="upload-cloud" size={28} color={Colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Modern Bottom Navigation */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <View style={styles.navItemActive}>
              <Feather name="home" size={24} color={Colors.primary} />
            </View>
            <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('medications')}>
            <View style={styles.navItemInactive}>
              <Feather name="package" size={24} color={Colors.gray400} />
            </View>
            <Text style={styles.navText}>Medications</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('health')}>
            <View style={styles.navItemInactive}>
              <Feather name="heart" size={24} color={Colors.gray400} />
            </View>
            <Text style={styles.navText}>Health</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
            <View style={styles.navItemInactive}>
              <Feather name="user" size={24} color={Colors.gray400} />
            </View>
            <Text style={styles.navText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Overlay */}
      {(isUploading || isCompressing) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.uploadingText}>
              {isCompressing ? 'Optimizing image...' : 'Uploading document...'}
            </Text>
          </View>
        </View>
      )}

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
                  <View style={styles.familyMemberAvatar}>
                    <Feather name="user" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.familyMemberInfo}>
                    <Text style={styles.familyMemberName}>{member.name}</Text>
                    {member.relationship && (
                      <Text style={styles.familyMemberRelationship}>{member.relationship}</Text>
                    )}
                  </View>
                  {activeMember?.id === member.id && (
                    <Feather name="check-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={() => {
                setShowFamilyModal(false);
                setShowAddMemberModal(true);
              }}
            >
              <Feather name="plus-circle" size={20} color={Colors.primary} />
              <Text style={styles.addMemberButtonText}>Add Family Member</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                setShowFamilyModal(false);
                // Add logout logic here if needed
              }}
            >
              <Feather name="log-out" size={20} color={Colors.error} />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Family Member Modal */}
      <AddFamilyMemberModal
        visible={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
      />
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.md,
    paddingBottom: Sizes.lg,
    backgroundColor: Colors.white,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.md,
    paddingBottom: Sizes.xxl,
  },

  // Profile Card
  profileCard: {
    borderRadius: 20,
    padding: Sizes.lg,
    marginBottom: Sizes.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  profileTextContainer: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  switchIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sections
  sectionContainer: {
    marginBottom: Sizes.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Stats
  statsScroll: {
    marginHorizontal: -Sizes.lg,
    paddingHorizontal: Sizes.lg,
  },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.lg,
    marginRight: Sizes.md,
    width: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardLast: {
    marginRight: 0,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Documents
  documentsList: {
    gap: Sizes.md,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
  },
  typeBadge: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray600,
  },
  documentDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 120,
    right: Sizes.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom Navigation
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: Sizes.md,
    paddingTop: Sizes.sm,
    paddingBottom: Sizes.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Sizes.xs,
  },
  navItemActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  navItemInactive: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  navText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  navTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Loading & Empty States
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Sizes.xl,
    gap: Sizes.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Sizes.xl,
    backgroundColor: Colors.white,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Sizes.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray400,
    marginTop: Sizes.xs,
    textAlign: 'center',
  },

  // Upload Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    color: Colors.textPrimary,
    fontWeight: '500',
  },

  // Family Member Modal
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    backgroundColor: Colors.primaryLight + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  familyMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  familyMemberRelationship: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    fontWeight: '600',
    color: Colors.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Sizes.sm,
    padding: Sizes.md,
    margin: Sizes.lg,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: Colors.error + '10',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
});
