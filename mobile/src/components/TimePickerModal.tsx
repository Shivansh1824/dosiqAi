import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';

interface TimePickerModalProps {
  visible: boolean;
  time: Date;
  onConfirm: (time: Date) => void;
  onCancel: () => void;
  title?: string;
}

export default function TimePickerModal({
  visible,
  time,
  onConfirm,
  onCancel,
  title = "Select Time",
}: TimePickerModalProps) {
  const [selectedTime, setSelectedTime] = useState(time || new Date());

  // Sync state when prop updates
  useEffect(() => {
    if (visible && time) {
      setSelectedTime(time);
    }
  }, [visible, time]);

  const handleConfirm = () => {
    onConfirm(selectedTime);
  };

  // Android handling can remain simple or use this modal too if we want a unified UI.
  // But typically Android's native picker is fine. However, consistent UI is better.
  // For now, let's stick to the Platform specific behavior wrapper pattern if desired,
  // but typically 'spinner' is iOS only.
  
  if (Platform.OS === 'android') {
      // For Android, we generally use the imperative API via DateTimePicker visible prop logic in parent,
      // OR we can wrap it here.
      // Given the parent usually handles Android native picker visibility toggling differently,
      // let's assume this Modal is primarily for iOS usage where we need a container.
      // If we render DateTimePicker on Android here, it will just pop up the native dialog.
      return visible ? (
         <DateTimePicker
            value={selectedTime || new Date()}
            mode="time"
            display="default"
            onChange={(event, date) => {
               if (event.type === 'set' && date) {
                   onConfirm(date);
               } else {
                   onCancel();
               }
            }}
         />
      ) : null;
  }

  // iOS Implementation
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Feather name="x" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={selectedTime || new Date()}
            mode="time"
            display="spinner"
            onChange={(event, date) => {
              if (date) setSelectedTime(date);
            }}
            style={styles.picker}
            textColor="black"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Sizes.lg,
    paddingBottom: Sizes.xl + 20, // Add bottom padding for home indicator
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Sizes.xs,
  },
  picker: {
    width: '100%',
    height: 180,
  },
  actions: {
    flexDirection: 'row',
    gap: Sizes.md,
    marginTop: Sizes.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
