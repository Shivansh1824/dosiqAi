import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Colors } from '../../constants';

// Constants
const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps {
    items: string[];
    value: string;
    onValueChange: (value: string) => void;
    width?: number | string;
    loop?: boolean;
}

export function WheelPicker({ items, value, onValueChange, width = 80, loop = false }: WheelPickerProps) {
    const scrollViewRef = useRef<ScrollView>(null);
    const [isScrolling, setIsScrolling] = useState(false);

    useEffect(() => {
        // Scroll to initial value
        const index = items.indexOf(value);
        if (index !== -1 && !isScrolling) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({
                    y: index * ITEM_HEIGHT,
                    animated: false
                });
            }, 50);
        }
    }, [value]); // careful with dependencies, we don't want to loop if value changes by scroll

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        setIsScrolling(false);
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

        const newValue = items[clampedIndex];
        if (newValue !== value) {
            onValueChange(newValue);
        }
    };

    const handleScrollBeginDrag = () => {
        setIsScrolling(true);
    };

    return (
        <View style={[styles.container, { width: width as any, height: PICKER_HEIGHT }]}>
            {/* Selection Overlay */}
            <View style={styles.selectionOverlay} pointerEvents="none" />

            <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                contentContainerStyle={{
                    paddingVertical: (PICKER_HEIGHT - ITEM_HEIGHT) / 2
                }}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                onScrollBeginDrag={handleScrollBeginDrag}
                nestedScrollEnabled={true}
            >
                {items.map((item, index) => {
                    const isSelected = item === value;
                    return (
                        <View key={index} style={styles.item}>
                            <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                                {item}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    item: {
        height: ITEM_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        fontSize: 18,
        color: Colors.gray400,
    },
    selectedItemText: {
        color: Colors.gray900,
        fontWeight: '600',
        fontSize: 20,
    },
    selectionOverlay: {
        position: 'absolute',
        top: ITEM_HEIGHT,
        height: ITEM_HEIGHT,
        width: '100%',
        backgroundColor: Colors.gray100,
        borderRadius: 8,
        opacity: 0.5,
        zIndex: -1,
    }
});
