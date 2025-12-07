import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Alert, ActionSheetIOS, RefreshControl, Modal, Dimensions, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInRight, FadeInUp } from 'react-native-reanimated';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Get time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

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

  // Get today's medications
  const todayMedications = medications.slice(0, 2);

  // Format date for display
  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Memoized greeting
  const greeting = useMemo(() => getGreeting(), []);

  const stats = [
    { icon: 'file-text', label: 'Documents', value: String(documents.length), color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
    { icon: 'heart', label: 'Health Records', value: String(documents.filter(d => d.ai_analysis_result).length), color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.15)' },
    { icon: 'users', label: 'Family', value: String(familyMembers.length), color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
  ];

  const quickActions = [
    { icon: 'camera', label: 'Scan', color: '#3B82F6', onPress: takePhoto },
    { icon: 'image', label: 'Gallery', color: '#10B981', onPress: pickImage },
    { icon: 'file-plus', label: 'Files', color: '#F59E0B', onPress: pickDocument },
    { icon: 'activity', label: 'Health', color: '#EC4899', onPress: () => onNavigate('health') },
  ];

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Glassmorphic Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowFamilyModal(true)}>
              <BlurView intensity={80} tint="light" style={styles.glassButton}>
                <Feather name="users" size={20} color={Colors.white} />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton}>
              <BlurView intensity={80} tint="light" style={styles.glassButton}>
                <View style={styles.notificationDot} />
                <Feather name="bell" size={20} color={Colors.white} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.white} />
          }
        >
          {/* Active Profile Card - Glassmorphic */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <TouchableOpacity onPress={() => setShowFamilyModal(true)} activeOpacity={0.9}>
              <BlurView intensity={40} tint="light" style={styles.profileCard}>
                <View style={styles.profileCardInner}>
                  <View style={styles.profileAvatarLarge}>
                    <LinearGradient
                      colors={['#fff', '#f0f0f0']}
                      style={styles.avatarGradient}
                    >
                      <Feather name="user" size={32} color="#667eea" />
                    </LinearGradient>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileLabel}>Managing Health For</Text>
                    <Text style={styles.profileName}>{activeMember?.name || user?.name || 'User'}</Text>
                    {activeMember?.relationship && activeMember.relationship !== 'Self' && (
                      <View style={styles.relationshipBadge}>
                        <Text style={styles.relationshipText}>{activeMember.relationship}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.switchButton}>
                    <Feather name="chevron-down" size={20} color="rgba(255,255,255,0.8)" />
                  </View>
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Main Scan CTA - Hero Button */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <TouchableOpacity
              style={styles.scanHeroButton}
              onPress={showUploadOptions}
              activeOpacity={0.9}
              disabled={isUploading}
            >
              <BlurView intensity={60} tint="light" style={styles.scanHeroInner}>
                <View style={styles.scanIconContainer}>
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    style={styles.scanIconGradient}
                  >
                    <Feather name="camera" size={32} color={Colors.white} />
                  </LinearGradient>
                </View>
                <View style={styles.scanTextContainer}>
                  <Text style={styles.scanHeroTitle}>Scan Document</Text>
                  <Text style={styles.scanHeroSubtitle}>Digitize your medical records instantly</Text>
                </View>
                <View style={styles.scanArrow}>
                  <Feather name="arrow-right" size={24} color="rgba(255,255,255,0.6)" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Actions Grid */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.quickActionsContainer}>
            <Text style={styles.sectionTitleLight}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickActionItem}
                  onPress={action.onPress}
                  activeOpacity={0.8}
                >
                  <BlurView intensity={50} tint="light" style={styles.quickActionGlass}>
                    <View style={[styles.quickActionIcon, { backgroundColor: action.color + '30' }]}>
                      <Feather name={action.icon as any} size={22} color={action.color} />
                    </View>
                    <Text style={styles.quickActionLabel}>{action.label}</Text>
                  </BlurView>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Stats Overview */}
          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.statsContainer}>
            <Text style={styles.sectionTitleLight}>Your Health at a Glance</Text>
            <View style={styles.statsRow}>
              {stats.map((stat, index) => (
                <BlurView key={index} intensity={40} tint="light" style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: stat.bgColor }]}>
                    <Feather name={stat.icon as any} size={20} color={stat.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </BlurView>
              ))}
            </View>
          </Animated.View>

          {/* Today's Schedule */}
          {(nextAppointment || todayMedications.length > 0) && (
            <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.scheduleContainer}>
              <Text style={styles.sectionTitleLight}>Today's Schedule</Text>
              <BlurView intensity={40} tint="light" style={styles.scheduleCard}>
                {nextAppointment && (
                  <TouchableOpacity
                    style={styles.scheduleItem}
                    onPress={() => onNavigate('appointments')}
                  >
                    <View style={[styles.scheduleIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                      <Feather name="calendar" size={18} color="#F59E0B" />
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleTitle}>{nextAppointment.title}</Text>
                      <Text style={styles.scheduleTime}>
                        {formatAppointmentDateTime(nextAppointment.date, nextAppointment.time)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                )}
                {todayMedications.map((med, index) => (
                  <TouchableOpacity
                    key={med.id}
                    style={[styles.scheduleItem, index === 0 && nextAppointment && styles.scheduleItemBorder]}
                    onPress={() => onNavigate('medications')}
                  >
                    <View style={[styles.scheduleIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                      <Feather name="package" size={18} color="#10B981" />
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleTitle}>{med.name}</Text>
                      <Text style={styles.scheduleTime}>{med.dosage} • {getFrequencyText(med.frequency)}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                ))}
              </BlurView>
            </Animated.View>
          )}

          {/* Recent Documents Section */}
          <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.documentsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleLight}>Recent Documents</Text>
              <TouchableOpacity onPress={() => onNavigate('documents')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {isLoadingDocs ? (
              <BlurView intensity={40} tint="light" style={styles.loadingCard}>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.loadingText}>Loading documents...</Text>
              </BlurView>
            ) : recentDocuments.length === 0 ? (
              <BlurView intensity={40} tint="light" style={styles.emptyCard}>
                <View style={styles.emptyIconContainer}>
                  <Feather name="file-text" size={40} color="rgba(255,255,255,0.5)" />
                </View>
                <Text style={styles.emptyTitle}>No documents yet</Text>
                <Text style={styles.emptySubtitle}>Scan your first medical document to get started</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={showUploadOptions}>
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyButtonGradient}
                  >
                    <Feather name="plus" size={18} color={Colors.white} />
                    <Text style={styles.emptyButtonText}>Add Document</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            ) : (
              <View style={styles.documentsList}>
                {recentDocuments.map((doc, index) => {
                  const displayTitle = doc.ai_analysis_result?.file_name || doc.title;
                  const formatDocType = (type: string) => type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
                  const displayType = doc.ai_analysis_result?.document_type
                    ? formatDocType(doc.ai_analysis_result.document_type)
                    : doc.type;
                  const isAnalyzed = !!doc.ai_analysis_result;

                  return (
                    <Animated.View
                      key={doc.id}
                      entering={FadeInRight.delay(100 * index).duration(400)}
                    >
                      <TouchableOpacity
                        style={styles.documentCard}
                        onPress={() => onNavigate('document', { document: doc })}
                        activeOpacity={0.8}
                      >
                        <BlurView intensity={40} tint="light" style={styles.documentCardInner}>
                          <View style={[styles.documentIcon, { backgroundColor: isAnalyzed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)' }]}>
                            <Feather
                              name={isAnalyzed ? 'check-circle' : 'file-text'}
                              size={22}
                              color={isAnalyzed ? '#10B981' : '#3B82F6'}
                            />
                          </View>
                          <View style={styles.documentInfo}>
                            <Text style={styles.documentTitle} numberOfLines={1}>{displayTitle}</Text>
                            <View style={styles.documentMeta}>
                              <View style={[styles.typeBadge, isAnalyzed && styles.typeBadgeAnalyzed]}>
                                <Text style={[styles.typeBadgeText, isAnalyzed && styles.typeBadgeTextAnalyzed]}>
                                  {isAnalyzed ? 'Analyzed' : displayType}
                                </Text>
                              </View>
                              <Text style={styles.documentDate}>{formatDateShort(doc.created_at)}</Text>
                            </View>
                          </View>
                          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
                        </BlurView>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* Bottom Padding */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Glassmorphic Bottom Navigation */}
        <View style={styles.bottomNavWrapper}>
          <BlurView intensity={80} tint="dark" style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem}>
              <View style={styles.navItemActive}>
                <Feather name="home" size={22} color={Colors.white} />
              </View>
              <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('documents')}>
              <View style={styles.navItemInactive}>
                <Feather name="folder" size={22} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={styles.navText}>Documents</Text>
            </TouchableOpacity>

            {/* Center Scan Button */}
            <TouchableOpacity style={styles.navCenterButton} onPress={showUploadOptions} disabled={isUploading}>
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                style={styles.navCenterGradient}
              >
                <Feather name="plus" size={28} color={Colors.white} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('health')}>
              <View style={styles.navItemInactive}>
                <Feather name="heart" size={22} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={styles.navText}>Health</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
              <View style={styles.navItemInactive}>
                <Feather name="user" size={22} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={styles.navText}>Profile</Text>
            </TouchableOpacity>
          </BlurView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.sm,
    paddingBottom: Sizes.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: Sizes.sm,
  },
  headerIconButton: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    zIndex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.sm,
  },

  // Profile Card
  profileCard: {
    borderRadius: 20,
    marginBottom: Sizes.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
  },
  profileAvatarLarge: {
    marginRight: Sizes.md,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  relationshipBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  relationshipText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '500',
  },
  switchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scan Hero Button
  scanHeroButton: {
    marginBottom: Sizes.lg,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scanHeroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  scanIconContainer: {
    marginRight: Sizes.md,
  },
  scanIconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTextContainer: {
    flex: 1,
  },
  scanHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  scanHeroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scanArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: Sizes.lg,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Sizes.sm,
  },
  quickActionItem: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGlass: {
    paddingVertical: Sizes.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.xs,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },

  // Section Titles
  sectionTitleLight: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Sizes.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  seeAllText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },

  // Stats
  statsContainer: {
    marginBottom: Sizes.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Sizes.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Sizes.md,
    paddingHorizontal: Sizes.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },

  // Schedule Section
  scheduleContainer: {
    marginBottom: Sizes.lg,
  },
  scheduleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
    padding: Sizes.sm,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.sm,
    borderRadius: 12,
  },
  scheduleItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: Sizes.xs,
    paddingTop: Sizes.md,
  },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.sm,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  scheduleTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Documents Section
  documentsSection: {
    marginBottom: Sizes.lg,
  },
  documentsList: {
    gap: Sizes.sm,
  },
  documentCard: {
    marginBottom: Sizes.xs,
    borderRadius: 16,
    overflow: 'hidden',
  },
  documentCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Sizes.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  typeBadgeAnalyzed: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  typeBadgeTextAnalyzed: {
    color: '#10B981',
  },
  documentDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Empty & Loading States
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Sizes.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    gap: Sizes.sm,
    overflow: 'hidden',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Sizes.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: Sizes.lg,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: Sizes.xs,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },

  // Bottom Navigation
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Sizes.md,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.sm,
    paddingHorizontal: Sizes.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 28,
    overflow: 'hidden',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Sizes.xs,
  },
  navItemActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemInactive: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCenterButton: {
    marginTop: -30,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  navCenterGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    marginTop: 2,
  },
  navTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },

  // Upload Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: Sizes.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  uploadingText: {
    marginTop: Sizes.md,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Family Member Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  familyModalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
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
    borderRadius: 16,
    marginBottom: Sizes.sm,
    backgroundColor: Colors.gray50,
  },
  familyMemberItemActive: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  familyMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Sizes.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  familyMemberInfo: {
    flex: 1,
  },
  familyMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  familyMemberRelationship: {
    fontSize: 13,
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  addMemberButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Sizes.sm,
    padding: Sizes.md,
    margin: Sizes.lg,
    marginTop: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
});
