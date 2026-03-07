import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Colors, Sizes } from '../constants';
import { toLocalDateString } from '../utils/dateUtils';

const ITEM_WIDTH = 64; // Slightly wider for better tap targets
const RANGE = 365;

// 2026 dark-green accent
const ACCENT = '#1B4332';

interface CalendarEvent {
    type: 'medication' | 'appointment' | 'both';
    count: number;
}

interface CalendarStripProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    events?: Record<string, CalendarEvent>;
}

interface DayItemData {
    id: string;
    date: Date;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
}

const DayItem = React.memo(({ item, isSelected, hasEvent, onSelect }: {
    item: DayItemData;
    isSelected: boolean;
    hasEvent: boolean;
    onSelect: (date: Date) => void;
}) => {
    return (
        <TouchableOpacity
            style={[
                styles.dayItem,
                isSelected && styles.dayItemSelected,
            ]}
            onPress={() => onSelect(item.date)}
            activeOpacity={0.7}
        >
            <Text style={[
                styles.dayName,
                isSelected && styles.dayNameSelected,
                item.isToday && !isSelected && styles.dayNameToday,
            ]}>
                {item.dayName.toUpperCase()}
            </Text>
            <View style={[
                styles.dayNumberContainer,
                isSelected && styles.dayNumberContainerSelected,
                item.isToday && !isSelected && styles.dayNumberContainerToday,
            ]}>
                <Text style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    item.isToday && !isSelected && styles.dayNumberToday,
                ]}>
                    {item.dayNumber}
                </Text>
            </View>
            {/* Event indicator dot */}
            {hasEvent && !isSelected && (
                <View style={styles.eventDot} />
            )}
            {hasEvent && isSelected && (
                <View style={[styles.eventDot, styles.eventDotSelected]} />
            )}
            {!hasEvent && (
                <View style={styles.eventDotSpacer} />
            )}
        </TouchableOpacity>
    );
});

export default function CalendarStrip({ selectedDate, onDateSelect, events = {} }: CalendarStripProps) {
    const listRef = useRef<FlatList>(null);

    const days = useMemo(() => {
        const result: DayItemData[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = -RANGE; i <= RANGE; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            result.push({
                id: toLocalDateString(date),
                date,
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: date.getDate(),
                isToday: date.getTime() === today.getTime(),
            });
        }
        return result;
    }, []);

    const todayIndex = RANGE;

    const selectedDateIndex = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sel = new Date(selectedDate);
        sel.setHours(0, 0, 0, 0);

        const diffTime = sel.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        const index = RANGE + diffDays;
        return (index >= 0 && index < days.length) ? index : todayIndex;
    }, [selectedDate, days.length]);

    useEffect(() => {
        if (listRef.current && selectedDateIndex !== -1) {
            const timer = setTimeout(() => {
                listRef.current?.scrollToIndex({
                    index: selectedDateIndex,
                    animated: true,
                    viewPosition: 0.5
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [selectedDateIndex]);

    const renderItem = useCallback(({ item, index }: { item: DayItemData, index: number }) => {
        const isSelected = index === selectedDateIndex;
        const hasEvent = !!events[item.id];

        return (
            <DayItem
                item={item}
                isSelected={isSelected}
                hasEvent={hasEvent}
                onSelect={onDateSelect}
            />
        );
    }, [selectedDateIndex, onDateSelect, events]);

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: ITEM_WIDTH,
        offset: ITEM_WIDTH * index,
        index,
    }), []);

    return (
        <View style={styles.container}>
            <FlatList
                ref={listRef}
                data={days}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                getItemLayout={getItemLayout}
                initialScrollIndex={todayIndex}
                initialNumToRender={10}
                windowSize={5}
                decelerationRate="fast"
                snapToInterval={ITEM_WIDTH}
                onScrollToIndexFailed={(info) => {
                    listRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: false
                    });
                    setTimeout(() => {
                        listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
                    }, 100);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        paddingTop: 10,
        paddingBottom: 8,
    },
    scrollContent: {
        paddingHorizontal: Sizes.lg,
    },
    dayItem: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 12,
        width: ITEM_WIDTH,
    },
    dayItemSelected: {
        backgroundColor: ACCENT + '12',
    },
    dayName: {
        fontSize: 10,
        color: Colors.textTertiary,
        marginBottom: 5,
        fontWeight: '600',
        letterSpacing: 1.2,
    },
    dayNameSelected: {
        color: ACCENT,
        fontWeight: '700',
    },
    dayNameToday: {
        color: Colors.textSecondary,
    },
    dayNumberContainer: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    dayNumberContainerSelected: {
        backgroundColor: ACCENT,
    },
    dayNumberContainerToday: {
        backgroundColor: Colors.gray100,
    },
    dayNumber: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    dayNumberSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    dayNumberToday: {
        color: ACCENT,
        fontWeight: '700',
    },
    eventDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: ACCENT,
        marginTop: 4,
        opacity: 0.7,
    },
    eventDotSelected: {
        backgroundColor: ACCENT,
        opacity: 0.5,
    },
    eventDotSpacer: {
        width: 4,
        height: 4,
        marginTop: 4,
    },
});
