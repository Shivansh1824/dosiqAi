import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { Sizes } from '../constants/Sizes';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
  secureTextEntry?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry = false,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = secureTextEntry;
  const showPasswordToggle = isPassword && !rightIcon;

  const handleRightIconPress = () => {
    if (showPasswordToggle) {
      setIsPasswordVisible(!isPasswordVisible);
    } else if (onRightIconPress) {
      onRightIconPress();
    }
  };

  const getRightIconName = (): keyof typeof Feather.glyphMap => {
    if (showPasswordToggle) {
      return isPasswordVisible ? 'eye-off' : 'eye';
    }
    return rightIcon || 'x';
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text
        style={[
          styles.label,
          isFocused && styles.labelFocused,
          error && styles.labelError,
        ]}
      >
        {label}
      </Text>

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {/* Left Icon */}
        {leftIcon && (
          <Feather
            name={leftIcon}
            size={20}
            color={error ? Colors.error : isFocused ? Colors.primary : Colors.gray400}
            style={styles.leftIcon}
          />
        )}

        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={Colors.gray400}
          secureTextEntry={isPassword && !isPasswordVisible}
          {...textInputProps}
        />

        {/* Right Icon */}
        {(rightIcon || showPasswordToggle) && (
          <TouchableOpacity
            onPress={handleRightIconPress}
            style={styles.rightIconContainer}
            accessibilityRole="button"
            accessibilityLabel={
              showPasswordToggle
                ? isPasswordVisible
                  ? 'Hide password'
                  : 'Show password'
                : 'Clear input'
            }
          >
            <Feather
              name={getRightIconName()}
              size={20}
              color={error ? Colors.error : Colors.gray400}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={14} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Sizes.md,
  },
  label: {
    ...Typography.styles.inputLabel,
    color: Colors.textPrimary,
    marginBottom: Sizes.sm,
  },
  labelFocused: {
    color: Colors.primary,
  },
  labelError: {
    color: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Sizes.radiusMd,
    height: Sizes.inputLg,
    paddingHorizontal: Sizes.md,
  },
  inputContainerFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.white,
    // Shadow removed to prevent keyboard dismissal bug on focus
    // Issue: Conditional shadow styles cause keyboard to close immediately
  },
  inputContainerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.white,
  },
  leftIcon: {
    marginRight: Sizes.sm,
  },
  input: {
    flex: 1,
    ...Typography.styles.input,
    lineHeight: undefined,
    height: '100%',
    textAlignVertical: 'center',
    color: Colors.textPrimary,
    // paddingVertical: 0, // Removed to allow native text layout
  },
  inputWithLeftIcon: {
    marginLeft: 0,
  },
  inputWithRightIcon: {
    marginRight: 0,
  },
  rightIconContainer: {
    marginLeft: Sizes.sm,
    padding: Sizes.xs,
    minWidth: Sizes.minTouchTarget,
    minHeight: Sizes.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Sizes.sm,
  },
  errorText: {
    ...Typography.styles.caption,
    color: Colors.error,
    marginLeft: Sizes.xs,
    flex: 1,
  },
});
