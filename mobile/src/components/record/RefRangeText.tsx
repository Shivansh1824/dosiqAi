import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

import { formatReferenceRange } from '@/utils/stringUtils';

interface RefRangeTextProps {
  refMin: number | string | null | undefined;
  refMax: number | string | null | undefined;
  unit: string | null | undefined;
  style: StyleProp<TextStyle>;
}

export const RefRangeText = ({ refMin, refMax, unit, style }: RefRangeTextProps) => {
  const range = formatReferenceRange(refMin, refMax, unit);
  if (!range) return null;
  return <Text style={style} selectable>Ref: {range}</Text>;
};
