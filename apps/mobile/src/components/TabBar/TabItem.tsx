import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { styles } from './TabBarStyles';

interface TabItemProps {
  isFocused: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  theme: any;
}

export const TabItem = ({ isFocused, onPress, icon, label, theme }: TabItemProps) => {
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isFocused ? 1.1 : 1) }],
    shadowColor: isFocused ? theme.accentRose : '#000',
    shadowOpacity: withSpring(isFocused ? 0.3 : 0),
    shadowRadius: withSpring(isFocused ? 10 : 0),
    shadowOffset: { width: 0, height: withSpring(isFocused ? 4 : 0) },
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tabItem}
      activeOpacity={0.7}
      hitSlop={{ top: 30, bottom: 30, left: 20, right: 20 }}
    >
      <Animated.View style={[styles.iconWrapper, iconStyle]}>
        {icon}
      </Animated.View>
      <Text
        style={[
          styles.label,
          { color: isFocused ? theme.accentRose : theme.textSecondary, fontWeight: isFocused ? '900' : '600' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
