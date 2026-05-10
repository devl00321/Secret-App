import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  withSequence,
  Easing
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HeartItem {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  scale: number;
  rotation: number;
}

export const PingAnimation = ({ visible, onComplete }: { visible: boolean, onComplete: () => void }) => {
  const theme = useTheme();
  const [hearts, setHearts] = useState<HeartItem[]>([]);

  useEffect(() => {
    if (visible) {
      // Create a massive burst of hearts
      const newHearts = Array.from({ length: 120 }).map((_, i) => {
        // Spawn from center-bottom or scattered bottom
        const startX = (Math.random() * SCREEN_WIDTH * 1.2) - (SCREEN_WIDTH * 0.1); // -10% to 110% width
        const startY = SCREEN_HEIGHT + 100 + (Math.random() * 200);
        
        // Spread all over the screen
        const endX = startX + (Math.random() * 400 - 200); // drift left/right
        const endY = -150 - (Math.random() * 300); // float way up past the top
        
        return {
          id: Math.random().toString(),
          startX,
          startY,
          endX,
          endY,
          delay: Math.random() * 2000, // Burst continues for 2 seconds
          scale: 0.5 + Math.random() * 3.5, // Massive size variation
          rotation: Math.random() * 360
        };
      });
      setHearts(newHearts);

      const timer = setTimeout(() => {
        onComplete();
        setHearts([]);
      }, 6000); // Keep alive long enough for all to finish

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hearts.map((heart) => (
        <SingleHeart 
          key={heart.id} 
          heart={heart}
          color={theme.heartPink} 
        />
      ))}
    </View>
  );
};

const SingleHeart = ({ heart, color }: { heart: HeartItem, color: string }) => {
  const translateY = useSharedValue(heart.startY);
  const translateX = useSharedValue(heart.startX);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0); // Start at 0, pop to target scale
  const heartRotation = useSharedValue(heart.rotation);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${heartRotation.value}deg` }
    ],
    opacity: opacity.value,
    position: 'absolute',
    left: 0,
    top: 0
  }));

  useEffect(() => {
    // Pop in opacity and scale
    opacity.value = withDelay(heart.delay, withTiming(0.8 + Math.random() * 0.2, { duration: 300 }));
    scale.value = withDelay(heart.delay, withTiming(heart.scale, { duration: 500, easing: Easing.out(Easing.back(1.5)) }));
    
    // Float upwards and drift side to side
    const floatDuration = 3500 + Math.random() * 1500;
    
    translateY.value = withDelay(heart.delay, withTiming(heart.endY, { 
      duration: floatDuration, 
      easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
    }));
    
    translateX.value = withDelay(heart.delay, withTiming(heart.endX, { 
      duration: floatDuration, 
      easing: Easing.inOut(Easing.ease) 
    }));

    heartRotation.value = withDelay(heart.delay, withTiming(heart.rotation + (Math.random() > 0.5 ? 90 : -90), { duration: floatDuration }));
    
    // Fade out near the end
    opacity.value = withDelay(heart.delay + floatDuration - 1000, withTiming(0, { duration: 1000 }));
  }, []);

  return (
    <Animated.View style={animatedStyle}>
      <Heart size={24} color={color} fill={color} />
    </Animated.View>
  );
};
