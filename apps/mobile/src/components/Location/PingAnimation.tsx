import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  withSequence,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HeartItem {
  id: string;
  x: number;
  delay: number;
  scale: number;
}

export const PingAnimation = ({ visible, onComplete }: { visible: boolean, onComplete: () => void }) => {
  const theme = useTheme();
  const [hearts, setHearts] = useState<HeartItem[]>([]);

  useEffect(() => {
    if (visible) {
      const newHearts = Array.from({ length: 40 }).map((_, i) => ({
        id: Math.random().toString(),
        x: (Math.random() * SCREEN_WIDTH * 0.8) + (SCREEN_WIDTH * 0.1),
        delay: Math.random() * 18000, // Spread over 18 seconds
        scale: 0.5 + Math.random() * 1.5
      }));
      setHearts(newHearts);

      const timer = setTimeout(() => {
        onComplete();
        setHearts([]);
      }, 20000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hearts.map((heart) => (
        <SingleHeart 
          key={heart.id} 
          x={heart.x} 
          delay={heart.delay} 
          scale={heart.scale} 
          color={theme.primary} 
        />
      ))}
    </View>
  );
};

const SingleHeart = ({ x, delay, scale, color }: { x: number, delay: number, scale: number, color: string }) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);
  const horizontalOffset = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: x + horizontalOffset.value },
      { scale: scale }
    ],
    opacity: opacity.value,
    position: 'absolute'
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withTiming(-100, { 
      duration: 2500, 
      easing: Easing.out(Easing.quad) 
    }));
    horizontalOffset.value = withDelay(delay, withSequence(
      withTiming(20, { duration: 600 }),
      withTiming(-20, { duration: 600 }),
      withTiming(20, { duration: 600 }),
      withTiming(0, { duration: 600 })
    ));
    opacity.value = withDelay(delay + 2000, withTiming(0, { duration: 500 }));
  }, []);

  return (
    <Animated.View style={animatedStyle}>
      <Heart size={24} color={color} fill={color} />
    </Animated.View>
  );
};
