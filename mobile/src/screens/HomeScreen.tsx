import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Alert, ActionSheetIOS, RefreshControl, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
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
import { saveFileLocally } from '../utils/fileStorage';
import AddFamilyMemberModal from '../components/AddFamilyMemberModal';

interface HomeScreenProps {
  onNavigate: (screen: string, params?: any) => void;
  onProfileSwitch: () => void;
}

export default function HomeScreen({ onNavigate, onProfileSwitch }: HomeScreenProps) {
  const { user } = useAuthStore();
  const { documents, isLoading: isLoadingDocs, fetchDocuments, addDocument } = useDocumentsStore();
  const { medications, fetchMedications } = useMedicationsStore();
  const { appointments, fetchAppointments } = useAppointmentsStore();
  const { familyMembers, activeMember, fetchFamilyMembers, setActiveMember } = useFamilyMembersStore();

  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

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
        allowsEditing: true,
        quality: 1.0,
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

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1.0,
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

  const uploadFile = async (uri: string, type: 'image' | 'document', fileName?: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to upload documents.');
      return;
    }

    if (!isSupabaseConfigured()) {
      Alert.alert('Error', 'Database service not configured.');
      return;
    }

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
      const documentId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const originalFileName = fileName || `${type}_${Date.now()}.${uri.split('.').pop() || 'jpg'}`;

      const { relativePath, fileSize, absolutePath } = await saveFileLocally(
        uri,
        memberForUpload.name,
        documentId,
        originalFileName
      );

      const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || '';
      const docType: DocumentType = fileExtension === 'pdf' ? 'Report' : 'Imaging';

      const savedDocument = await addDocument({
        user_id: user.id,
        title: originalFileName.replace(/\.[^/.]+$/, '') || `Document ${new Date().toLocaleDateString()}`,
        type: docType,
        local_file_path: relativePath,
        family_member_id: memberForUpload.id,
        file_size: fileSize,
        is_local: true,
        color: '',
      });

      const actualDocumentId = savedDocument?.id || documentId;
      await fetchDocuments(user.id);

      const { getAbsolutePath } = await import('../utils/fileStorage');
      const analysisPath = absolutePath || getAbsolutePath(relativePath);

      Alert.alert('Success', 'Document uploaded successfully! Analyzing...', [
        {
          text: 'OK',
          onPress: () => {
            const { triggerAnalysis } = useDocumentsStore.getState();
            triggerAnalysis(actualDocumentId, analysisPath).catch((error) => {
              console.error('[HomeScreen] Background analysis failed:', error);
            });
          },
        },
      ]);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

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
      Alert.alert('Upload Document', 'Choose an option', [
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose Files', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const recentDocuments = documents.slice(0, 3);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Capitalize first letter of each word
  const titleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header - Greeting + Notification */}
        <View style={styles.header}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{user?.name ? titleCase(user.name) : 'User'} 👋</Text>
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
                      {activeMember?.name || user?.name || 'Select Profile'}
                      {activeMember?.relationship && (
                        <Text style={styles.profileCardRelationship}> • {activeMember.relationship}</Text>
                      )}
                    </Text>
                  </View>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Feather name="chevron-down" size={20} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Stats Row - Compact Professional Cards */}
          <View style={styles.statsContainer}>
            {/* Documents Card - Blue Theme */}
            <TouchableOpacity
              style={styles.statCardWrapper}
              onPress={() => onNavigate('documents')}
              activeOpacity={0.85}
            >
              <View style={styles.statCardContent}>
                <View style={[styles.statIconCircle, { backgroundColor: '#E8F4FD' }]}>
                  <Feather name="file-text" size={18} color="#4A90E2" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{documents.length}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>Documents</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Medications Card - Orange Theme */}
            <TouchableOpacity
              style={styles.statCardWrapper}
              onPress={() => onNavigate('medications')}
              activeOpacity={0.85}
            >
              <View style={styles.statCardContent}>
                <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Feather name="package" size={18} color="#F59E0B" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{medications.length}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>Medications</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Appointments Card - Teal Theme */}
            <TouchableOpacity
              style={styles.statCardWrapper}
              onPress={() => onNavigate('appointments')}
              activeOpacity={0.85}
            >
              <View style={styles.statCardContent}>
                <View style={[styles.statIconCircle, { backgroundColor: '#CCFBF1' }]}>
                  <Feather name="calendar" size={18} color="#14B8A6" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{appointments.length}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>Appointments</Text>
                </View>
              </View>
            </TouchableOpacity>
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
                  const displayTitle = doc.ai_analysis_result?.file_name || doc.title;
                  const displayType = doc.ai_analysis_result?.document_type
                    ? doc.ai_analysis_result.document_type.charAt(0).toUpperCase() + doc.ai_analysis_result.document_type.slice(1).replace(/_/g, ' ')
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
                      onPress={() => onNavigate('document', { document: doc })}
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
                            <Text style={styles.documentDateNew}>{formatDate(doc.created_at)}</Text>
                          </View>
                        </View>
                        <View style={styles.documentStatusBadge}>
                          <Feather name="check-circle" size={16} color="#10B981" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
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
          </View>
        </View>
      </Modal>

      <AddFamilyMemberModal
        visible={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
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
    color: Colors.gray600,
    marginBottom: 4,
    fontWeight: '600',
  },
  userName: {
    fontSize: 34,
    fontWeight: '600',
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
    justifyContent: 'space-between',
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
    color: '#4B5563',
    marginBottom: 2,
    fontWeight: '600',
  },
  profileCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  profileCardRelationship: {
    fontSize: 14,
    fontWeight: '500',
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

  // Stats Container - Compact Professional
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCardWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  statCardGradient: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 20,
    position: 'relative',
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  statValueNew: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabelNew: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  // Old styles for backwards compatibility
  statCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  statCardOverlay: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 24,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 28,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 1,
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
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  insightsText: {
    fontSize: 13,
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
    fontWeight: '700',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '600',
    color: '#6B7280',
  },
  documentDateNew: {
    fontSize: 12,
    color: '#9CA3AF',
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
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
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
    color: Colors.gray400,
    marginTop: 4,
  },
  navTextActive: {
    color: Colors.primary,
    fontWeight: '600',
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
    color: Colors.gray700,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '600',
    color: Colors.gray900,
  },
  familyMemberRelationship: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
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
});
