import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';

interface DatePickerModalProps {
  visible: boolean;
  date: string; // YYYY-MM-DD format
  onConfirm: (date: string) => void;
  onCancel: () => void;
  minimumDate?: string;
  maximumDate?: string;
}

export default function DatePickerModal({
  visible,
  date,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
}: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date(date));

  const handleConfirm = () => {
    // Fix: Use local date formatting to avoid timezone conversion issues
    // Previously used toISOString() which applies timezone offset
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;

    onConfirm(localDateString);
  };

  if (Platform.OS === 'android') {
    return visible ? (
      <DateTimePicker
        value={selectedDate}
        mode="date"
        display="default"
        onChange={(event, date) => {
          if (event.type === 'set' && date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const localDateString = `${year}-${month}-${day}`;
            onConfirm(localDateString);
          } else if (event.type === 'dismissed') {
            onCancel();
          }
        }}
        minimumDate={minimumDate ? new Date(minimumDate) : undefined}
        maximumDate={maximumDate ? new Date(maximumDate) : undefined}
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
            <Text style={styles.title}>Select Start Date</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Feather name="x" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              if (date) setSelectedDate(date);
            }}
            minimumDate={minimumDate ? new Date(minimumDate) : undefined}
            maximumDate={maximumDate ? new Date(maximumDate) : undefined}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Sizes.lg,
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
    height: 200,
  },
  actions: {
    flexDirection: 'row',
    gap: Sizes.md,
    marginTop: Sizes.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray300,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
