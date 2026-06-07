import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { X } from 'lucide-react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  onCancel?: () => void;
}

export const CircularProgress = ({
  progress,
  size = 54,
  strokeWidth = 3,
  onCancel
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const animatedProgress = useSharedValue(0);

  React.useEffect(() => {
    // Ensure progress is between 0 and 100
    const p = Math.min(Math.max(progress, 0), 100);
    animatedProgress.value = withTiming(p / 100, { duration: 300 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: circumference * (1 - animatedProgress.value),
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <TouchableOpacity 
        style={[styles.innerContainer, { borderRadius: size / 2 }]}
        onPress={onCancel}
        activeOpacity={0.8}
      >
        <Svg width={size} height={size} style={styles.svg}>
          {/* Background circle track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle stroke */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="white"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.iconContainer}>
          <X size={size * 0.35} color="white" strokeWidth={3} />
        </View>
      </TouchableOpacity>
      {/* Optional: Add percentage text below or inside if needed, but the user asked for circular progress with cancel in middle */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  svg: {
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  }
});
