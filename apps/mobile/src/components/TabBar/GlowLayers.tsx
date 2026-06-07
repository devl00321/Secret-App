import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet } from 'react-native';
import Animated, { useDerivedValue, withSpring } from 'react-native-reanimated';

interface GlowLayersProps {
  state: any;
  theme: any;
  currentUserProfile: any;
}

export const GlowLayers = ({ state, theme, currentUserProfile }: GlowLayersProps) => {
  const isFemale = currentUserProfile?.gender === 'Female';
  const isTimeline = state.routes[state.index].name === 'timeline';

  const coralOpacity = useDerivedValue(() =>
    withSpring((!isTimeline && !isFemale) ? 1 : 0)
  );
  const pinkOpacity = useDerivedValue(() =>
    withSpring((isTimeline || isFemale) ? 1 : 0)
  );

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: coralOpacity }]}>
        <LinearGradient
          colors={Platform.select({
            android: ['transparent', theme.accentRose + '80', theme.accentRose + 'F5', theme.accentRose + '80', 'transparent'],
            default: ['transparent', theme.accentRose + '30', theme.accentRose + '60', theme.accentRose + '30', 'transparent'],
          })}
          locations={Platform.select({
            android: [0, 0.4, 0.5, 0.6, 1],
            default: [0, 0.1, 0.5, 0.9, 1],
          })}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: pinkOpacity }]}>
        <LinearGradient
          colors={Platform.select({
            android: ['transparent', theme.accentRose + '40', theme.accentRose + 'A5', theme.accentRose + 'FF', theme.accentRose + 'A5', theme.accentRose + '40', 'transparent'],
            default: ['transparent', theme.accentRose + '15', theme.accentRose + '40', theme.accentRose + '65', theme.accentRose + '40', theme.accentRose + '15', 'transparent'],
          })}
          locations={Platform.select({
            android: [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1],
            default: [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1],
          })}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
};
