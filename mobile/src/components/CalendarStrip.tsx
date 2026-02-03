import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Colors, Sizes } from '../constants';
import { toLocalDateString } from '../utils/dateUtils';

const ITEM_WIDTH = 60; // Total width per day (60 width, no gap)
const RANGE = 365; // +/- 1 year for unrestricted scrolling

interface CalendarEvent {
    type: 'medication' | 'appointment' | 'both';
    count: number;
}

interface CalendarStripProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    events?: Record<string, CalendarEvent>; // Format: { "2025-10-25": { type: 'medication', count: 2 } }
}

interface DayItemData {
    id: string; 
    date: Date;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
}

/**
 * Memoized Day Component for maximum scroll performance
 */
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
            ]}>
                {item.dayName}
            </Text>
            <View style={[
                styles.dayNumberContainer,
                isSelected && styles.dayNumberContainerSelected,
                item.isToday && !isSelected && styles.dayNumberContainerToday,
                hasEvent && !isSelected && { borderColor: Colors.primary, borderWidth: 2 },
                hasEvent && isSelected && { borderColor: Colors.white, borderWidth: 2 },
            ]}>
                <Text style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    item.isToday && !isSelected && styles.dayNumberToday,
                ]}>
                    {item.dayNumber}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

export default function CalendarStrip({ selectedDate, onDateSelect, events = {} }: CalendarStripProps) {
    const listRef = useRef<FlatList>(null);

    // 1. Generate large timeline
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

    // 2. Index Calculation
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

    // 3. Scroll Sync
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

    // 4. Optimized Render
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
        backgroundColor: Colors.white,
        paddingVertical: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    scrollContent: {
        paddingHorizontal: Sizes.lg,
    },
    dayItem: {
        alignItems: 'center',
        paddingVertical: Sizes.sm,
        borderRadius: 12,
        width: 60,
    },
    dayItemSelected: {
        backgroundColor: Colors.primary + '15',
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
        fontWeight: '700',
    },
});
