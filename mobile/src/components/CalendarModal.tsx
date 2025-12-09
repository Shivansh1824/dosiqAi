import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';

export type CalendarEventType = 'medication' | 'appointment' | 'both';

export interface CalendarEvent {
  type: CalendarEventType;
  count: number; // Number of items on this date
}

interface CalendarModalProps {
  visible: boolean;
  selectedDate: Date;
  events: Record<string, CalendarEvent>; // { "2025-12-09": { type: 'medication', count: 3 } }
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  filterType?: 'medication' | 'appointment' | 'all'; // What to show
}

export default function CalendarModal({
  visible,
  selectedDate,
  events,
  onClose,
  onDateSelect,
  filterType = 'medication',
}: CalendarModalProps) {

  // Convert events to calendar marking format
  const getMarkedDates = () => {
    const marked: any = {};

    Object.keys(events).forEach(dateStr => {
      const event = events[dateStr];
      const dots = [];

      // Apply filter
      if (filterType === 'medication' || filterType === 'all') {
        if (event.type === 'medication' || event.type === 'both') {
          dots.push({ key: 'medication', color: Colors.primary }); // Blue
        }
      }

      if (filterType === 'appointment' || filterType === 'all') {
        if (event.type === 'appointment' || event.type === 'both') {
          dots.push({ key: 'appointment', color: Colors.success }); // Green
        }
      }

      if (dots.length > 0) {
        marked[dateStr] = { dots };
      }
    });

    // Mark selected date
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    marked[selectedDateStr] = {
      ...marked[selectedDateStr],
      selected: true,
      selectedColor: Colors.primary,
    };

    return marked;
  };

  const handleDayPress = (day: DateData) => {
    const date = new Date(day.dateString);
    onDateSelect(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {(filterType === 'medication' || filterType === 'all') && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>Medication</Text>
              </View>
            )}
            {(filterType === 'appointment' || filterType === 'all') && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>Appointment</Text>
              </View>
            )}
          </View>

          {/* Calendar */}
          <Calendar
            current={selectedDate.toISOString().split('T')[0]}
            markedDates={getMarkedDates()}
            onDayPress={handleDayPress}
            markingType={'multi-dot'}
            theme={{
              backgroundColor: Colors.white,
              calendarBackground: Colors.white,
              textSectionTitleColor: Colors.textSecondary,
              selectedDayBackgroundColor: Colors.primary,
              selectedDayTextColor: Colors.white,
              todayTextColor: Colors.primary,
              dayTextColor: Colors.textPrimary,
              textDisabledColor: Colors.gray300,
              dotColor: Colors.primary,
              selectedDotColor: Colors.white,
              arrowColor: Colors.primary,
              monthTextColor: Colors.textPrimary,
              textMonthFontWeight: '600',
              textMonthFontSize: 18,
              textDayFontSize: 16,
              textDayHeaderFontSize: 14,
            }}
          />

          {/* Footer */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Sizes.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Sizes.xs,
  },
  legend: {
    flexDirection: 'row',
    gap: Sizes.lg,
    marginBottom: Sizes.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    marginTop: Sizes.lg,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
