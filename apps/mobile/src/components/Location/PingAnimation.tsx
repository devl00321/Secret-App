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
      const newHearts = Array.from({ length: 60 }).map((_, i) => ({
        id: Math.random().toString(),
        x: (Math.random() * SCREEN_WIDTH * 0.9) + (SCREEN_WIDTH * 0.05),
        delay: Math.random() * 1500, // Immediate burst within 1.5s
        scale: 0.3 + Math.random() * 2.0, // More varied sizes
        rotation: Math.random() * 360
      }));
      setHearts(newHearts as any);

      const timer = setTimeout(() => {
        onComplete();
        setHearts([]);
      }, 5000); // Short, intense burst

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
          color={theme.heartPink} 
          rotation={heart.rotation}
        />
      ))}
    </View>
  );
};

const SingleHeart = ({ x, delay, scale, color, rotation }: { x: number, delay: number, scale: number, color: string, rotation: number }) => {
  const translateY = useSharedValue(SCREEN_HEIGHT + 50);
  const opacity = useSharedValue(0);
  const horizontalOffset = useSharedValue(0);
  const heartRotation = useSharedValue(rotation);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: horizontalOffset.value },
      { scale: scale },
      { rotate: `${heartRotation.value}deg` }
    ],
    opacity: opacity.value,
    position: 'absolute',
    left: x
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(-150, { 
      duration: 3500 + Math.random() * 1000, 
      easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
    }));
    heartRotation.value = withDelay(delay, withTiming(rotation + (Math.random() > 0.5 ? 45 : -45), { duration: 3000 }));
    horizontalOffset.value = withDelay(delay, withSequence(
      withTiming(Math.random() * 40 - 20, { duration: 1000 }),
      withTiming(Math.random() * 40 - 20, { duration: 1000 }),
      withTiming(Math.random() * 40 - 20, { duration: 1000 })
    ));
    opacity.value = withDelay(delay + 2500, withTiming(0, { duration: 800 }));
  }, []);

  return (
    <Animated.View style={animatedStyle}>
      <Heart size={24} color={color} fill={color} />
    </Animated.View>
  );
};
