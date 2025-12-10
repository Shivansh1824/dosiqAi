import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors, Sizes } from '../constants';

interface CalendarStripProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

interface DayItem {
    date: Date;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
    isSelected: boolean;
}

export default function CalendarStrip({ selectedDate, onDateSelect }: CalendarStripProps) {
    const scrollViewRef = useRef<ScrollView>(null);

    // Generate 7 days centered around selected date
    const getDaysArray = (): DayItem[] => {
        const days: DayItem[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Center the week around the selected date
        const centerDate = new Date(selectedDate);
        centerDate.setHours(0, 0, 0, 0);

        // Start from 3 days before selected date to 3 days after
        for (let i = -3; i <= 3; i++) {
            const date = new Date(centerDate);
            date.setDate(centerDate.getDate() + i);

            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();

            days.push({ date, dayName, dayNumber, isToday, isSelected });
        }

        return days;
    };

    const days = getDaysArray();

    // Auto-scroll to selected date when it changes
    useEffect(() => {
        const selectedIndex = days.findIndex(d => d.isSelected);
        if (selectedIndex !== -1 && scrollViewRef.current) {
            // Scroll to center the selected date
            const itemWidth = 60;
            const scrollPosition = (selectedIndex * itemWidth) - (itemWidth * 1.5);
            scrollViewRef.current.scrollTo({ x: Math.max(0, scrollPosition), animated: true });
        }
    }, [selectedDate]);

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {days.map((day, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.dayItem,
                            day.isSelected && styles.dayItemSelected,
                        ]}
                        onPress={() => onDateSelect(day.date)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.dayName,
                            day.isSelected && styles.dayNameSelected,
                        ]}>
                            {day.dayName}
                        </Text>
                        <View style={[
                            styles.dayNumberContainer,
                            day.isSelected && styles.dayNumberContainerSelected,
                            day.isToday && !day.isSelected && styles.dayNumberContainerToday,
                        ]}>
                            <Text style={[
                                styles.dayNumber,
                                day.isSelected && styles.dayNumberSelected,
                                day.isToday && !day.isSelected && styles.dayNumberToday,
                            ]}>
                                {day.dayNumber}
                            </Text>
                        </View>
                        {day.isToday && !day.isSelected && (
                            <View style={styles.todayDot} />
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        paddingVertical: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    scrollContent: {
        paddingHorizontal: Sizes.lg,
        gap: Sizes.sm,
    },
    dayItem: {
        alignItems: 'center',
        paddingVertical: Sizes.sm,
        paddingHorizontal: Sizes.md,
        borderRadius: 12,
        minWidth: 60,
    },
    dayItemSelected: {
        backgroundColor: Colors.primary + '10',
    },
    dayName: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 6,
        fontWeight: '500',
    },
    dayNameSelected: {
        color: Colors.primary,
        fontWeight: '600',
    },
    dayNumberContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    dayNumberContainerSelected: {
        backgroundColor: Colors.primary,
    },
    dayNumberContainerToday: {
        backgroundColor: Colors.gray100,
    },
    dayNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    dayNumberSelected: {
        color: Colors.white,
    },
    dayNumberToday: {
        color: Colors.primary,
    },
    todayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.primary,
        marginTop: 4,
    },
});
