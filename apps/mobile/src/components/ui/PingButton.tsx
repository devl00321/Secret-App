import React, { useEffect } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  interpolate, 
  Extrapolate 
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { useTheme } from '../../theme';

interface PingButtonProps {
  onPress: () => void;
  size?: number;
}

export function PingButton({ onPress, size = 56 }: PingButtonProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2500 }), -1, false);
  }, []);

  const ringStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 1.6], Extrapolate.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.8, 1], [0.6, 0, 0], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Pressable onPress={onPress} style={[styles.container, { width: size, height: size }]}>
      {/* Animated Pulse Ring */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.ring,
          { 
            borderRadius: size / 2, 
            backgroundColor: theme.accentRoseSoft,
            borderWidth: 1,
            borderColor: theme.accentRose 
          },
          ringStyle,
        ]}
      />
      
      {/* Solid Center Button */}
      <Animated.View
        style={[
          styles.button,
          { 
            backgroundColor: theme.accentRose,
            borderRadius: size / 2,
            shadowColor: theme.accentRose,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
          },
        ]}
      >
        <Heart size={size * 0.4} color="#FFFFFF" fill="#FFFFFF" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
  },
  button: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
