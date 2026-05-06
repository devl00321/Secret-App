import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useTheme } from '../../theme';

interface HeartMarkerProps {
  type: 'me' | 'partner';
  initial?: string;
  batteryLevel?: number;
  color?: string;
}

export const HeartMarker = React.memo(({ type, initial, batteryLevel, color: overrideColor }: HeartMarkerProps) => {
  const theme = useTheme();
  const defaultColor = type === 'me' ? theme.primary : theme.secondary;
  const color = overrideColor || defaultColor;

  return (
    <View style={styles.container}>
      {/* Battery Badge - Positioned outside to not interfere with bubble shadow */}
      {batteryLevel !== undefined && (
        <View style={[styles.batteryBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.batteryText, { color: theme.text }]}>{Math.round(batteryLevel)}%</Text>
        </View>
      )}
      
      <View style={[styles.bubble, { backgroundColor: color }]}>
        {initial ? (
          <Text style={styles.initial}>{initial}</Text>
        ) : (
          <Heart size={18} color="white" fill="white" />
        )}
      </View>
      <View style={[styles.arrow, { borderTopColor: color }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60, // Fixed size to prevent layout shifts
    height: 70,
  },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'white',
    // Ultra-clean circular shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 2,
  },
  initial: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  batteryBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  batteryText: {
    fontSize: 8,
    fontWeight: '900',
  },
});
