import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
  StyleProp,
  View
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false, 
  disabled = false,
  style,
  textStyle,
  icon
}: ButtonProps) => {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary': return { backgroundColor: '#8B7CFF' };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.accentRose };
      case 'danger': return { backgroundColor: '#FF4747' };
      case 'ghost': return { backgroundColor: 'transparent' };
      default: return { backgroundColor: theme.accentRose };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline': return { color: theme.accentRose };
      case 'ghost': return { color: theme.textSecondary };
      default: return { color: '#FFFFFF' };
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity 
        style={[styles.base, { borderRadius: 16, flex: style && (style as any).flex ? 1 : undefined }, getButtonStyle(), (disabled || loading) && styles.disabled]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? theme.accentRose : 'white'} />
        ) : (
          <>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text 
              style={[styles.textBase, getTextStyle(), textStyle, { textAlign: 'center' }]} 
              numberOfLines={2}
            >
              {title}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  textBase: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iconContainer: {
    marginRight: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
