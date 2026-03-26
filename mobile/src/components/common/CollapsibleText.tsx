import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { Colors } from '@/constants';

interface CollapsibleTextProps {
  text: string;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export const CollapsibleText = ({ text, style, numberOfLines = 2 }: CollapsibleTextProps) => {
  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  return (
    <View>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={(e) => {
          if (!expanded) setNeedsTruncation(e.nativeEvent.lines.length >= numberOfLines);
        }}
      >
        {text}
      </Text>
      {(needsTruncation || expanded) && (
        <TouchableOpacity onPress={() => setExpanded(p => !p)} hitSlop={8} activeOpacity={0.6}>
          <Text style={styles.readMoreText}>{expanded ? 'Show less' : 'Read more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  readMoreText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: Colors.primary,
    marginTop: 3,
  },
});
