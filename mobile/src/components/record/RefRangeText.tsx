import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

interface RefRangeTextProps {
  refMin: number | null;
  refMax: number | null;
  unit: string | null;
  style: StyleProp<TextStyle>;
}

export const RefRangeText = ({ refMin, refMax, unit, style }: RefRangeTextProps) => {
  if (refMin === null && refMax === null) return null;
  const range = refMin !== null
    ? (refMax !== null ? `${refMin} - ${refMax}` : `> ${refMin}`)
    : `< ${refMax}`;
  return <Text style={style} selectable>Ref: {range} {unit}</Text>;
};
