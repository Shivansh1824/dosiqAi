import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ListRenderItemInfo, Platform } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    interpolate, 
    Extrapolate,
    useAnimatedScrollHandler,
    runOnJS,
    SharedValue
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants';

// Constants
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const LOOP_FACTOR = 5; // Reduced to 5 for faster initial render

interface WheelPickerProps {
    items: string[];
    value: string;
    onValueChange: (value: string) => void;
    width?: number | string;
    loop?: boolean;
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export function WheelPicker({ items, value, onValueChange, width = 70, loop = true }: WheelPickerProps) {
    const scrollY = useSharedValue(0);
    const flatListRef = useRef<FlatList>(null);
    const [isInternalUpdate, setIsInternalUpdate] = useState(false);
    const lastValue = useRef(value);
    const lastHapticIndex = useSharedValue(-1);

    const extendedItems = useMemo(() => {
        if (!loop) return items;
        let list: string[] = [];
        for (let i = 0; i < LOOP_FACTOR; i++) {
            list = [...list, ...items];
        }
        return list;
    }, [items, loop]);

    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const findInitialIndex = useCallback(() => {
        const itemIndex = items.indexOf(value);
        if (itemIndex === -1) return 0;
        if (!loop) return itemIndex;
        const middleFactor = Math.floor(LOOP_FACTOR / 2);
        return itemIndex + (items.length * middleFactor);
    }, [items, value, loop]);

    // Initial scroll - immediate jump for a "simple and normal" feel
    useEffect(() => {
        const index = findInitialIndex();
        // Minor delay to ensure FlatList is ready, but non-animated to avoid "dropping" look
        const timer = setTimeout(() => {
            flatListRef.current?.scrollToOffset({
                offset: index * ITEM_HEIGHT,
                animated: false
            });
            scrollY.value = index * ITEM_HEIGHT;
        }, 16); 
        return () => clearTimeout(timer);
    }, []);

    // Handle external updates
    useEffect(() => {
        if (value !== lastValue.current) {
            lastValue.current = value;
            if (isInternalUpdate) {
                setIsInternalUpdate(false);
                return;
            }
            const index = findInitialIndex();
            flatListRef.current?.scrollToOffset({
                offset: index * ITEM_HEIGHT,
                animated: true
            });
        }
    }, [value, findInitialIndex]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
            const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
            if (index !== lastHapticIndex.value) {
                lastHapticIndex.value = index;
                runOnJS(triggerHaptic)();
            }
        },
    });

    const handleScrollEnd = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, extendedItems.length - 1));

        const newValue = extendedItems[clampedIndex];
        if (newValue !== lastValue.current) {
            lastValue.current = newValue;
            setIsInternalUpdate(true);
            onValueChange(newValue);
        }

        if (loop) {
            const actualIndex = clampedIndex % items.length;
            const middleFactor = Math.floor(LOOP_FACTOR / 2);
            const middleIndex = actualIndex + (items.length * middleFactor);
            if (clampedIndex < items.length || clampedIndex >= items.length * (LOOP_FACTOR - 1)) {
                flatListRef.current?.scrollToOffset({
                    offset: middleIndex * ITEM_HEIGHT,
                    animated: false
                });
                scrollY.value = middleIndex * ITEM_HEIGHT;
            }
        }
    };

    const renderItem = useCallback(({ item, index }: ListRenderItemInfo<string>) => {
        return <PickerItem item={item} index={index} scrollY={scrollY} />;
    }, []);

    return (
        <View style={[styles.container, { width: width as any, height: PICKER_HEIGHT }]}>
            {/* Horizontal selection lines like the screenshot */}
            <View style={styles.topLine} pointerEvents="none" />
            <View style={styles.bottomLine} pointerEvents="none" />
            
            <AnimatedFlatList
                ref={flatListRef as any}
                data={extendedItems as any}
                renderItem={renderItem as any}
                keyExtractor={(_, index) => index.toString()}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                })}
                contentContainerStyle={{
                    paddingVertical: (PICKER_HEIGHT - ITEM_HEIGHT) / 2
                }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={handleScrollEnd}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={3}
                nestedScrollEnabled={true}
            />
        </View>
    );
}

const PickerItem = React.memo(({ item, index, scrollY }: { item: string, index: number, scrollY: SharedValue<number> }) => {
    const animatedStyle = useAnimatedStyle(() => {
        const centerOffset = index * ITEM_HEIGHT;
        const opacity = interpolate(
            scrollY.value,
            [centerOffset - ITEM_HEIGHT, centerOffset, centerOffset + ITEM_HEIGHT],
            [0.3, 1, 0.3],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            scrollY.value,
            [centerOffset - ITEM_HEIGHT, centerOffset, centerOffset + ITEM_HEIGHT],
            [0.9, 1.1, 0.9],
            Extrapolate.CLAMP
        );
        return { opacity, transform: [{ scale }] };
    });

    return (
        <Animated.View style={[styles.item, animatedStyle]}>
            <Text style={styles.itemText}>{item}</Text>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
    },
    item: {
        height: ITEM_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        fontSize: 22,
        color: Colors.gray900,
        fontWeight: '500',
    },
    topLine: {
        position: 'absolute',
        top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: Colors.gray400,
        zIndex: 1,
    },
    bottomLine: {
        position: 'absolute',
        top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2 + ITEM_HEIGHT,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: Colors.gray400,
        zIndex: 1,
    }
});
