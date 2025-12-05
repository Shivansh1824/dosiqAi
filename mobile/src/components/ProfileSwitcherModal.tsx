import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { useAuthStore } from '../store/authStore';

interface ProfileSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const familyMembers = [
    { id: 1, name: 'Shivansh Rana', role: 'Admin', documents: 12, active: true },
    { id: 2, name: 'Priya Rana', role: 'Member', documents: 8, active: false },
    { id: 3, name: 'Arjun Rana', role: 'Member', documents: 5, active: false },
    { id: 4, name: 'Grandma Lakshmi', role: 'Member', documents: 15, active: false },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Family Member</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={24} color={Colors.gray700} />
            </TouchableOpacity>
          </View>

          {/* Family Members List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {familyMembers.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.memberItem,
                  member.active && styles.memberItemActive,
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.memberInfo}>
                  <View
                    style={[
                      styles.avatar,
                      member.active ? styles.avatarActive : styles.avatarInactive,
                    ]}
                  >
                    <Feather name="user" size={24} color={Colors.white} />
                  </View>
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>
                      {member.role} • {member.documents} documents
                    </Text>
                  </View>
                </View>
                {member.active && (
                  <Feather name="check" size={24} color={Colors.primary} strokeWidth={3} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Add Family Member & Logout */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.addButton} activeOpacity={0.8}>
              <Feather name="plus" size={20} color={Colors.secondary} />
              <Text style={styles.addButtonText}>Add Family Member</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                useAuthStore.getState().logout();
              }}
            >
              <Feather name="log-out" size={20} color={Colors.error} />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Sizes.radiusXl,
    borderTopRightRadius: Sizes.radiusXl,
    maxHeight: Dimensions.get('window').height * 0.8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
    minHeight: 56,
  },
  headerTitle: {
    fontSize: Typography.body,
    color: Colors.gray900,
    fontWeight: "600",
  },
  closeButton: {
    padding: Sizes.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Sizes.lg,
  },
  memberItem: {
    padding: Sizes.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray50,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 56,
  },
  memberItemActive: {
    backgroundColor: `${Colors.primary}1A`,
    borderColor: Colors.primary,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActive: {
    backgroundColor: Colors.primary,
  },
  avatarInactive: {
    backgroundColor: Colors.gray300,
  },
  memberName: {
    fontSize: Typography.body,
    color: Colors.gray900,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: Typography.caption,
    color: Colors.gray500,
  },
  footer: {
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.xl,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: Colors.secondary,
    borderRadius: Sizes.radiusFull,
    minHeight: 48,
  },
  addButtonText: {
    color: Colors.secondary,
    fontSize: Typography.body,
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.xl,
    paddingVertical: 12,
    marginTop: Sizes.md,
  },
  logoutButtonText: {
    color: Colors.error,
    fontSize: Typography.body,
    fontWeight: "600",
    marginLeft: Sizes.sm,
  },
});
