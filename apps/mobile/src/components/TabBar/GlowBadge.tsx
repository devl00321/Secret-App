import React from 'react';
import { View } from 'react-native';
import { styles } from './TabBarStyles';

interface GlowBadgeProps {
  color: string;
}

export const GlowBadge = ({ color }: GlowBadgeProps) => (
  <View style={[styles.glowBadge, { backgroundColor: color, shadowColor: color }]} />
);
