import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Battery, BatteryLow, BatteryCharging } from 'lucide-react-native';
import { useTheme } from '../../theme';

interface BatteryIndicatorProps {
  level: number; // 0 to 1
  isCharging: boolean;
}

export function BatteryIndicator({ level, isCharging }: BatteryIndicatorProps) {
  const theme = useTheme();
  
  const percentage = Math.round(level);
  const isLow = percentage <= 20;

  const getColor = () => {
    if (isCharging) return theme.safeGreen;
    if (isLow) return theme.dangerRed;
    return theme.textSecondary;
  };

  const color = getColor();

  const renderIcon = () => {
    if (isCharging) return <BatteryCharging size={14} color={color} />;
    if (isLow) return <BatteryLow size={14} color={color} />;
    return <Battery size={14} color={color} />;
  };

  return (
    <View style={styles.container}>
      {renderIcon()}
      <Text style={[styles.text, { color }]}>{percentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
});
