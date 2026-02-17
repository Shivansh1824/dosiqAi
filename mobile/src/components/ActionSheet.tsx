import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { BlurView } from 'expo-blur';

export interface ActionSheetOption {
  label: string;
  icon?: string;
  onPress: () => void;
  isDestructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
}

const { width } = Dimensions.get('window');

export default function ActionSheet({
  visible,
  onClose,
  onDismissed,
  title,
  subtitle,
  options,
}: ActionSheetProps) {
  // Animation Values
  const slideAnim = useRef(new Animated.Value(0)).current; 
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track visibility to handle closing animation
  const [showModal, setShowModal] = useState(visible);
  // Track whether we need to fire onDismissed after modal fully unmounts
  const pendingDismissCallback = useRef(false);

  useEffect(() => {
    if (visible) {
      console.log('[ActionSheet] 🟢 Opening modal');
      pendingDismissCallback.current = false;
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 90,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      console.log('[ActionSheet] 🔴 Close animation starting (250ms)');
      pendingDismissCallback.current = true;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('[ActionSheet] 📦 JS animation done — unmounting Modal');
        setShowModal(false);
        // After setShowModal(false), the <Modal> component unmounts from React tree.
        // But the NATIVE iOS UIViewController may still be in the presentedViewController chain.
        // We add a delay to let the native side fully clean up before firing onDismissed.
        if (pendingDismissCallback.current) {
          pendingDismissCallback.current = false;
          setTimeout(() => {
            console.log('[ActionSheet] ✅ Native VC settle delay done — firing onDismissed');
            onDismissed?.();
          }, 350);
        }
      });
    }
  }, [visible]);

  if (!showModal) return null;

  // Platform-specific animation configs
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0], 
  });

  // Calculate container style based on Platform
  const containerStyle = Platform.OS === 'ios' ? styles.iosSheetContainer : styles.androidSheetContainer;

  return (
    <Modal
      transparent
      visible={showModal}
      onRequestClose={onClose}
      statusBarTranslucent
      animationType="none"
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Action Sheet Container */}
        <Animated.View
          style={[
            containerStyle,
            { transform: [{ translateY }] },
          ]}
        >
          {Platform.OS === 'ios' ? (
            /* -------------------------------------------------------------------------- */
            /*                               iOS CLASSIC UI                               */
            /* -------------------------------------------------------------------------- */
            <View style={{ paddingBottom: 34 }}> 
               {/* Main Options Group */}
               <View style={styles.iosGroup}>
                  {/* Title / Subtitle Area */}
                  {(title || subtitle) && (
                    <View style={styles.iosHeader}>
                      {title && <Text style={styles.iosTitle}>{title}</Text>}
                      {subtitle && <Text style={styles.iosSubtitle}>{subtitle}</Text>}
                    </View>
                  )}

                  {/* Separator if title exists */}
                  {(title || subtitle) && <View style={styles.iosSeparator} />}

                  {/* Options */}
                  {options.map((option, index) => (
                    <View key={index}>
                      <TouchableOpacity
                        style={[styles.iosButton, { minHeight: 56 }]}
                        onPress={option.onPress}
                        activeOpacity={0.7}
                      >
                         <Text
                           style={[
                             styles.iosButtonText,
                             option.isDestructive && styles.destructiveLabel,
                           ]}
                         >
                           {option.label}
                         </Text>
                      </TouchableOpacity>
                      {index < options.length - 1 && <View style={styles.iosSeparator} />}
                    </View>
                  ))}
               </View>

               {/* Cancel Button - Separate Group */}
               <TouchableOpacity
                 style={[styles.iosGroup, styles.iosCancelButton]}
                 onPress={onClose}
                 activeOpacity={0.7}
               >
                 <Text style={[styles.iosButtonText, { fontWeight: '600' }]}>Cancel</Text>
               </TouchableOpacity>
            </View>
          ) : (
            /* -------------------------------------------------------------------------- */
            /*                               ANDROID UI                                   */
            /* -------------------------------------------------------------------------- */
            <>
               {/* Handle */}
               <View style={styles.handleContainer}>
                  <View style={styles.handle} />
               </View>

               {/* Header */}
               {(title || subtitle) && (
                 <View style={styles.header}>
                   {title && <Text style={styles.title}>{title}</Text>}
                   {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                 </View>
               )}

               {/* Options */}
               <View style={styles.optionsContainer}>
                 {options.map((option, index) => (
                   <TouchableOpacity
                     key={index}
                     style={[
                         styles.optionButton,
                         index < options.length - 1 && styles.optionDivider
                     ]}
                     onPress={option.onPress}
                     activeOpacity={0.7}
                   >
                     <View style={[styles.iconContainer, { backgroundColor: option.isDestructive ? '#FEE2E2' : '#F3F4F6' }]}>
                         <Feather
                         name={(option.icon as any) || 'circle'}
                         size={20}
                         color={option.isDestructive ? '#EF4444' : '#374151'}
                         />
                     </View>
                     <Text
                       style={[
                         styles.optionLabel,
                         option.isDestructive && styles.destructiveLabel,
                       ]}
                     >
                       {option.label}
                     </Text>
                     <Feather name="chevron-right" size={16} color="#D1D5DB" />
                   </TouchableOpacity>
                 ))}
               </View>

               {/* Cancel Button */}
               <TouchableOpacity
                 style={styles.cancelButton}
                 onPress={onClose}
                 activeOpacity={0.8}
               >
                 <Text style={styles.cancelLabel}>Cancel</Text>
               </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  
  // -- ANDROID STYLES --
  androidSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
      marginTop: 8,
  },
  handle: {
      width: 48,
      height: 5,
      backgroundColor: '#E5E7EB',
      borderRadius: 10,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionDivider: {
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  destructiveLabel: {
    color: '#EF4444',
  },
  cancelButton: {
    paddingVertical: 18,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },

  // -- iOS CLASSIC STYLES --
  iosSheetContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingBottom: 0, 
    width: '100%',
  },
  iosGroup: {
    backgroundColor: 'rgba(249, 249, 249, 0.94)', // Standard iOS milky white
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  iosHeader: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent', // Let group bg show
    borderBottomWidth: 0, // Separator handles it if needed
  },
  iosTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8F8F8F', // Grayish
    textAlign: 'center',
    marginBottom: 4,
  },
  iosSubtitle: {
    fontSize: 13,
    color: '#8F8F8F',
    textAlign: 'center',
  },
  iosButton: {
    height: 57,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', 
  },
  iosButtonText: {
    fontSize: 20,
    color: '#007AFF', // System Blue
    fontWeight: '400',
  },
  iosCancelButton: {
    height: 57,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Cancel is usually pure white
  },
  iosSeparator: {
    height: 1, // Hairline
    backgroundColor: 'rgba(60, 60, 67, 0.2)', // Standard iOS separator color
  },
});
