import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WheelPicker } from './WheelPicker';

interface AndroidTimePickerProps {
    value: Date;
    onChange: (date: Date) => void;
}

export function AndroidTimePicker({ value, onChange }: AndroidTimePickerProps) {
    const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => (i + 1).toString()), []);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), []);
    const periods = useMemo(() => ['AM', 'PM'], []);

    // Derived values
    const currentHours24 = value.getHours();
    const currentMinutes = value.getMinutes();

    // Convert to 12h
    const period = currentHours24 >= 12 ? 'PM' : 'AM';
    const currentHour12 = currentHours24 % 12 || 12;

    const hStr = currentHour12.toString();
    const mStr = currentMinutes.toString().padStart(2, '0');

    const handleHourChange = (newHourStr: string) => {
        const newHour12 = parseInt(newHourStr, 10);
        let newHour24 = newHour12;

        if (period === 'PM' && newHour12 !== 12) newHour24 += 12;
        if (period === 'AM' && newHour12 === 12) newHour24 = 0;

        const newDate = new Date(value);
        newDate.setHours(newHour24);
        onChange(newDate);
    };

    const handleMinuteChange = (newMinStr: string) => {
        const newMin = parseInt(newMinStr, 10);
        const newDate = new Date(value);
        newDate.setMinutes(newMin);
        onChange(newDate);
    };

    const handlePeriodChange = (newPeriod: string) => {
        let newHour24 = currentHours24;
        if (newPeriod === 'AM' && currentHours24 >= 12) {
            newHour24 -= 12;
        } else if (newPeriod === 'PM' && currentHours24 < 12) {
            newHour24 += 12;
        }

        const newDate = new Date(value);
        newDate.setHours(newHour24);
        onChange(newDate);
    };

    return (
        <View style={styles.container}>
            <WheelPicker
                items={hours}
                value={hStr}
                onValueChange={handleHourChange}
                width={60}
            />
            <Text style={styles.separator}>:</Text>
            <WheelPicker
                items={minutes}
                value={mStr}
                onValueChange={handleMinuteChange}
                width={60}
            />
            <View style={{ width: 10 }} />
            <WheelPicker
                items={periods}
                value={period}
                onValueChange={handlePeriodChange}
                width={60}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 150, // 3 * 50
    },
    separator: {
        fontSize: 24,
        fontWeight: '600',
        marginHorizontal: 4,
        color: '#64748B' // Colors.gray500 equivalent
    }
});
