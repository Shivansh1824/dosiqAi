import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { toLocalDateString, fromLocalDateString } from '../utils/dateUtils';

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

  // State for year picker
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(selectedDate);

  // State for month picker
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Generate array of years (10 years back, 10 years forward)
  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 10; year <= currentYear + 10; year++) {
      years.push(year);
    }
    return years;
  };

  // Month names
  const MONTHS = [
    { value: 0, label: 'January', short: 'Jan' },
    { value: 1, label: 'February', short: 'Feb' },
    { value: 2, label: 'March', short: 'Mar' },
    { value: 3, label: 'April', short: 'Apr' },
    { value: 4, label: 'May', short: 'May' },
    { value: 5, label: 'June', short: 'Jun' },
    { value: 6, label: 'July', short: 'Jul' },
    { value: 7, label: 'August', short: 'Aug' },
    { value: 8, label: 'September', short: 'Sep' },
    { value: 9, label: 'October', short: 'Oct' },
    { value: 10, label: 'November', short: 'Nov' },
    { value: 11, label: 'December', short: 'Dec' },
  ];

  const years = generateYears();
  const currentDisplayYear = calendarDate.getFullYear();
  const currentDisplayMonth = calendarDate.getMonth();
  const currentMonthName = MONTHS[currentDisplayMonth].short;

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

    // Mark selected date (using local date, not UTC)
    const selectedDateStr = toLocalDateString(selectedDate);
    marked[selectedDateStr] = {
      ...marked[selectedDateStr],
      selected: true,
      selectedColor: Colors.primary,
    };

    return marked;
  };

  const handleDayPress = (day: DateData) => {
    // Convert date string to local midnight (no timezone shift)
    const date = fromLocalDateString(day.dateString);
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
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Select Date</Text>

              {/* Month Button */}
              <TouchableOpacity
                style={styles.monthYearButton}
                onPress={() => setShowMonthPicker(true)}
              >
                <Text style={styles.monthYearButtonText}>{currentMonthName}</Text>
                <Feather name="chevron-down" size={16} color={Colors.primary} />
              </TouchableOpacity>

              {/* Year Button */}
              <TouchableOpacity
                style={styles.monthYearButton}
                onPress={() => setShowYearPicker(true)}
              >
                <Text style={styles.monthYearButtonText}>{currentDisplayYear}</Text>
                <Feather name="chevron-down" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {(filterType === 'medication' || filterType === 'all') && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { borderColor: Colors.primary }]} />
                <Text style={styles.legendText}>Medication</Text>
              </View>
            )}
            {(filterType === 'appointment' || filterType === 'all') && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { borderColor: Colors.success }]} />
                <Text style={styles.legendText}>Appointment</Text>
              </View>
            )}
          </View>

          {/* Calendar */}
          <Calendar
            key={toLocalDateString(calendarDate)}
            current={toLocalDateString(calendarDate)}
            markedDates={getMarkedDates()}
            onDayPress={handleDayPress}
            markingType={'multi-dot'}
            dayComponent={({ date, state, marking, onPress }: any) => {
              const isSelected = marking?.selected;
              const isToday = state === 'today';
              const isDisabled = state === 'disabled';
              const hasEvents = marking?.dots && marking.dots.length > 0;
              
              // Use the first dot's color for the ring if available, default to primary
              const ringColor = hasEvents ? (marking.dots[0].color || Colors.primary) : 'transparent';

              return (
                <TouchableOpacity
                  style={[
                    styles.dayContainer,
                    isSelected && styles.selectedDay,
                    hasEvents && !isSelected && { borderColor: ringColor, borderWidth: 2 },
                    hasEvents && isSelected && { borderColor: Colors.white, borderWidth: 2 }
                  ]}
                  onPress={() => onPress(date)}
                >
                  <View style={styles.dayInner}>
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                      isToday && !isSelected && styles.todayText,
                      isDisabled ? styles.disabledDayText : styles.dayTextPrimary
                    ]}>
                      {date?.day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            onMonthChange={(month) => {
              // Update local state when user navigates months
              const newDate = fromLocalDateString(month.dateString);
              setCalendarDate(newDate);
            }}
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

        {/* Year Picker Modal */}
        {showYearPicker && (
          <Modal
            visible={showYearPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowYearPicker(false)}
          >
            <View style={styles.yearPickerOverlay}>
              <View style={styles.yearPickerContainer}>
                <View style={styles.yearPickerHeader}>
                  <Text style={styles.yearPickerTitle}>Select Year</Text>
                  <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                    <Feather name="x" size={24} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.yearPickerScroll}>
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.yearOption,
                        year === currentDisplayYear && styles.yearOptionSelected
                      ]}
                      onPress={() => {
                        // Create new date with selected year, keeping current month
                        const newDate = new Date(calendarDate);
                        newDate.setFullYear(year);
                        setCalendarDate(newDate);
                        setShowYearPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.yearOptionText,
                        year === currentDisplayYear && styles.yearOptionTextSelected
                      ]}>
                        {year}
                      </Text>
                      {year === currentDisplayYear && (
                        <Feather name="check" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Month Picker Modal */}
        {showMonthPicker && (
          <Modal
            visible={showMonthPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowMonthPicker(false)}
          >
            <View style={styles.yearPickerOverlay}>
              <View style={styles.yearPickerContainer}>
                <View style={styles.yearPickerHeader}>
                  <Text style={styles.yearPickerTitle}>Select Month</Text>
                  <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                    <Feather name="x" size={24} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                  {MONTHS.map((month) => (
                    <TouchableOpacity
                      key={month.value}
                      style={[
                        styles.monthOption,
                        month.value === currentDisplayMonth && styles.monthOptionSelected
                      ]}
                      onPress={() => {
                        // Create new date with selected month, keeping current year
                        const newDate = new Date(calendarDate);
                        newDate.setMonth(month.value);
                        setCalendarDate(newDate);
                        setShowMonthPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.monthOptionText,
                        month.value === currentDisplayMonth && styles.monthOptionTextSelected
                      ]}>
                        {month.label}
                      </Text>
                      {month.value === currentDisplayMonth && (
                        <Feather name="check" size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Modal>
        )}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.md,
  },
  monthYearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    minWidth: 60,
  },
  monthYearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  yearPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  yearPickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Sizes.xl,
    maxHeight: '60%',
  },
  yearPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Sizes.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  yearPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  yearPickerScroll: {
    padding: Sizes.md,
  },
  yearOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Sizes.md,
    borderRadius: 12,
    marginBottom: Sizes.xs,
    backgroundColor: Colors.gray50,
  },
  yearOptionSelected: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  yearOptionText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  yearOptionTextSelected: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Sizes.md,
    gap: Sizes.sm,
  },
  monthOption: {
    width: '47%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Sizes.md,
    borderRadius: 12,
    backgroundColor: Colors.gray50,
  },
  monthOptionSelected: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  monthOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  monthOptionTextSelected: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  legendText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Calendar day styles
  dayContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    margin: 2,
  },
  dayInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDay: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 15,
    textAlign: 'center',
  },
  dayTextPrimary: {
    color: Colors.textPrimary,
  },
  selectedDayText: {
    color: Colors.white,
    fontWeight: '700',
  },
  todayText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  disabledDayText: {
    color: Colors.gray300,
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
