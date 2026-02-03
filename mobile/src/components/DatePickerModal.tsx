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
  title?: string;
}

export default function DatePickerModal({
  visible,
  date,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
  title = "Select Date",
}: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date(date));

  // Sync state when prop updates
  React.useEffect(() => {
    if (visible && date) {
        // Ensure we parse the YYYY-MM-DD string as consistent local time or UTC to avoid shifts
        // Constructing 'new Date("2024-03-02")' in JS is treated as UTC, while "2024-03-02T00:00" is local.
        // Let's rely on standard parsing but be mindful.
        // New Date(date) works okay if date is YYYY-MM-DD.
        setSelectedDate(new Date(date));
    }
  }, [visible, date]);

  const handleConfirm = () => {
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
            <Text style={styles.title}>{title}</Text>
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
            themeVariant="light" 
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
    paddingBottom: Sizes.xl + 20,
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
