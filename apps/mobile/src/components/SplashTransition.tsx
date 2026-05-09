import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Image, View, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
  withRepeat,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart } from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface BokehHeartProps {
  delay: number;
  startX: number;
  scale: number;
  opacityTarget: number;
}

const BokehHeart: React.FC<BokehHeartProps> = ({ delay, startX, scale, opacityTarget }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay, withTiming(-H * 0.4, { duration: 4000, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(delay, withTiming(opacityTarget, { duration: 2000 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale }],
    position: 'absolute',
    left: startX,
    bottom: H * 0.1, // Start slightly above the bottom
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <Heart size={40} color="#FFFFFF" fill="#FFFFFF" opacity={0.2} />
    </Animated.View>
  );
};

interface SplashTransitionProps {
  onAnimationComplete: () => void;
}

export const SplashTransition: React.FC<SplashTransitionProps> = ({ onAnimationComplete }) => {
  const containerScale = useSharedValue(1);
  const containerOpacity = useSharedValue(1);
  
  const logoScale = useSharedValue(0);
  const textScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  
  const pulseOpacity = useSharedValue(0); // For color shift

  // Generate random hearts only once
  const bokehHearts = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      delay: Math.random() * 800 + 400, // Starts after initial entry (400ms+)
      startX: Math.random() * (W - 40),
      scale: Math.random() * 0.8 + 0.4, // Scale between 0.4 and 1.2
      opacityTarget: Math.random() * 0.4 + 0.1, // Max opacity 0.1 to 0.5
    }));
  }, []);

  useEffect(() => {
    // Phase 1 & 2: Entry (0ms -> 600ms)
    // Logo scales up with a bounce
    logoOpacity.value = withTiming(1, { duration: 300 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100, mass: 1 });
    
    // Text follows right after the logo
    textScale.value = withDelay(150, withSpring(1, { damping: 12, stiffness: 100, mass: 1 }));

    // Phase 4: Color Shift / Emotional Pulse
    // Slowly cycle the warm red gradient overlay
    pulseOpacity.value = withDelay(
      800,
      withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1, // infinite
        true // reverse
      )
    );

    // Phase 5: Exit / Burst (Triggers after 2200ms)
    const exitDelay = 2200; 

    containerScale.value = withDelay(
      exitDelay,
      withTiming(15, { duration: 500, easing: Easing.in(Easing.cubic) })
    );
    
    containerOpacity.value = withDelay(
      exitDelay,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: textScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Animated.View style={[styles.overlay, containerStyle]} pointerEvents="none">
      
      {/* Base Gradient: Deep Pink/Purple */}
      <LinearGradient
        colors={['#1A0B2E', '#9B2A5A']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Pulsing Gradient: Warm Red/Gold */}
      <AnimatedLinearGradient
        colors={['transparent', '#FF3366', '#FF9933']}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, pulseStyle]}
      />

      {/* Bokeh Hearts */}
      {bokehHearts.map((heart) => (
        <BokehHeart key={heart.id} {...heart} />
      ))}

      {/* Centerpiece */}
      <View style={styles.centerContainer}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Image
            source={require('../../assets/images/splash-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.Text style={[styles.brandText, textStyle]}>
          Luvv
        </Animated.Text>
      </View>

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20, // 20px gap
    marginTop: 20, // Shifted up 10px from before
  },
  logo: {
    width: 160, // Increased size
    height: 160, // Increased size
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  brandText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
});
