import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MapPin, Shield, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { DeviceMotion } from 'expo-sensors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { useLocationStore } from '../store/useLocationStore';
import { useChatStore } from '../store/chat';
import { withRepeat, withSequence, withTiming, interpolateColor } from 'react-native-reanimated';


export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { user, currentUserProfile } = useAuthStore();
  const { activeSos, partnerTrip, partnerWalkSafe } = useLocationStore();
  const { messages } = useChatStore();

  const unreadCount = messages.filter(m => m.senderId !== user?.uid && !m.isRead).length;
  const isSosActive = !!activeSos?.isActive;
  const isPartnerOnTrip = !!(partnerTrip?.isActive || partnerWalkSafe?.isActive);

  // Gyroscope tracking for reflection
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  React.useEffect(() => {
    DeviceMotion.setUpdateInterval(16); // 60fps
    const subscription = DeviceMotion.addListener((data) => {
      if (data.rotation) {
        // Map rotation to a subtle offset
        tiltX.value = withSpring(data.rotation.gamma * 80, { damping: 15 });
        tiltY.value = withSpring(data.rotation.beta * 10, { damping: 15 });
      }
    });
    return () => subscription.remove();
  }, []);

  const topReflectionStyle = useAnimatedStyle(() => {
    const maxOffset = ((width || Dimensions.get('window').width) * 0.45);
    const edgeDist = Math.abs(tiltX.value) / maxOffset;
    
    return {
      transform: [
        { translateX: -tiltX.value }, // Original direction
        { scaleX: withSpring(1 - (edgeDist * 0.5)) }, 
      ],
      opacity: withSpring(0.25 * (1 - (edgeDist * 0.4))), // Reduced from 0.8
    };
  });

  const bottomReflectionStyle = useAnimatedStyle(() => {
    const maxOffset = ((width || Dimensions.get('window').width) * 0.45);
    const edgeDist = Math.abs(tiltX.value) / maxOffset;
    
    return {
      transform: [
        { translateX: tiltX.value }, // Opposite direction
        { scaleX: withSpring(1 - (edgeDist * 0.5)) }, 
      ],
      opacity: withSpring(0.12 * (1 - (edgeDist * 0.4))), // Reduced from 0.4
    };
  });

  const tabWidth = ((width || Dimensions.get('window').width) * 0.9) / state.routes.length;
  
  const translateX = useDerivedValue(() => {
    return withSpring(state.index * tabWidth, { damping: 20, stiffness: 90 });
  });

  // Elastic stretch effect based on movement
  const prevIndex = useRef(state.index);
  const stretch = useDerivedValue(() => {
    const isMoving = Math.abs(translateX.value - state.index * tabWidth) > 1;
    return withSpring(isMoving ? 1.2 : 1, { damping: 15 });
  });

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scaleX: stretch.value } // Liquid stretch
    ],
  }));

  const indicatorColor = useDerivedValue(() => {
    if (isSosActive) return 'transparent';
    const isTimeline = state.routes[state.index].name === 'timeline';
    const isFemale = currentUserProfile?.gender === 'Female';
    return (isTimeline || isFemale) ? theme.heartPink : theme.primary;
  });

  const getIcon = (name: string, color: string) => {
    const size = 20;
    const isFocused = state.routes[state.index].name === name;

    switch (name) {
      case 'index': 
        return (
          <View>
            <Home color={color} size={size} />
            {unreadCount > 0 && <GlowBadge color={theme.primary} />}
          </View>
        );
      case 'location': 
        return <MapPin color={color} size={size} />;
      case 'safety': 
        return <Shield color={isSosActive ? '#FF3B30' : color} size={size} />;
      case 'timeline': 
        return (
          <View>
            <Heart color={color === theme.primary ? theme.heartPink : color} size={size} fill={color === theme.primary ? theme.heartPink : 'transparent'} />
            {/* Timeline glow could be added here based on a "new memory" state */}
          </View>
        );
      default: return <Home color={color} size={size} />;
    }
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 10 }]}>
      <View style={[styles.shadowWrapper, { shadowOpacity: theme.isDark ? 0.4 : 0.15 }]}>
        <BlurView 
          intensity={Platform.OS === 'ios' ? (theme.isDark ? 55 : 35) : 45} // Subtle frosting for elegant definition
          tint={theme.isDark ? 'dark' : 'light'}
          style={[
            styles.tabBar, 
            { 
              backgroundColor: 'transparent', // Fully transparent glass
              borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.05)',
              width: (width || Dimensions.get('window').width) * 0.9,
              minWidth: 320,
            }
          ]}
        >
          {/* GYROSCOPIC REFLECTIONS - Now inside the clipped BlurView */}
          <Animated.View style={[styles.gyroReflectionTop, topReflectionStyle]}>
            <LinearGradient
              colors={[
                'transparent', 
                'transparent', 
                'rgba(255,255,255,0.05)', 
                'rgba(255,255,255,0.25)', 
                theme.isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)', 
                'rgba(255,255,255,0.25)', 
                'rgba(255,255,255,0.05)', 
                'transparent', 
                'transparent'
              ]}
              locations={[0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          
          <Animated.View style={[styles.gyroReflection, bottomReflectionStyle]}>
            <LinearGradient
              colors={[
                'transparent', 
                'transparent', 
                'rgba(255,255,255,0.05)', 
                'rgba(255,255,255,0.25)', 
                theme.isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)', 
                'rgba(255,255,255,0.25)', 
                'rgba(255,255,255,0.05)', 
                'transparent', 
                'transparent'
              ]}
              locations={[0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          {/* LIQUID GLOW INDICATOR - Moving behind the tabs */}
          <Animated.View style={[styles.movingIndicator, { width: tabWidth }, indicatorStyle]}>
            <View style={styles.indicatorContainer}>
              <Animated.View style={[
                styles.scatterGlow, 
                { shadowColor: useDerivedValue(() => {
                  if (isSosActive) return 'transparent';
                  const isTimeline = state.routes[state.index].name === 'timeline';
                  const isFemale = currentUserProfile?.gender === 'Female';
                  return (isTimeline || isFemale) ? theme.heartPink : theme.primary;
                }) as any }
              ]}>
                {/* Primary Glow (Coral) - Only if not female AND not on timeline */}
                <Animated.View style={[StyleSheet.absoluteFill, { 
                  opacity: useDerivedValue(() => {
                    const isTimeline = state.routes[state.index].name === 'timeline';
                    const isFemale = currentUserProfile?.gender === 'Female';
                    return withSpring((!isTimeline && !isFemale) ? 1 : 0);
                  }) 
                }]}>
                  <LinearGradient
                    colors={['transparent', theme.primary + '30', theme.primary + '60', theme.primary + '30', 'transparent']}
                    locations={[0, 0.1, 0.5, 0.9, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
                {/* Pink Glow - If female OR on timeline (ELEGANT BALANCE) */}
                <Animated.View style={[StyleSheet.absoluteFill, { 
                  opacity: useDerivedValue(() => {
                    const isTimeline = state.routes[state.index].name === 'timeline';
                    const isFemale = currentUserProfile?.gender === 'Female';
                    return withSpring((isTimeline || isFemale) ? 1 : 0);
                  }) 
                }]}>
                  <LinearGradient
                    colors={[
                      'transparent', 
                      theme.heartPink + '15', 
                      theme.heartPink + '40', 
                      theme.heartPink + '65', // Soft, sophisticated core
                      theme.heartPink + '40', 
                      theme.heartPink + '15', 
                      'transparent'
                    ]}
                    locations={[0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </Animated.View>
              
              {/* WATER DROP STRUCTURE */}
              <Animated.View style={[
                styles.activeBg, 
                { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)' },
                { borderColor: useDerivedValue(() => withSpring(state.routes[state.index].name === 'timeline' || currentUserProfile?.gender === 'Female' ? theme.heartPink + '40' : 'rgba(255,255,255,0.2)')) as any }
              ]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.35)', 'transparent']}
                  style={styles.dropletHighlight}
                />
              </Animated.View>
            </View>
          </Animated.View>

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;
            const isFocused = state.index === index;

            const onPress = () => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <TabItem
                key={route.key}
                isFocused={isFocused}
                onPress={onPress}
                icon={getIcon(route.name, isFocused ? theme.primary : theme.textLight)}
                label={label as string}
                theme={theme}
                state={state}
                currentUserProfile={currentUserProfile}
              />
            );
          })}
        {theme.isDark && (
          <>
            {/* 3D EDGE SHADING - LEFT CURVE (Dark Mode Only) */}
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.2)', 'transparent']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.edgeShading, { left: 0 }]}
            />

            {/* 3D EDGE SHADING - RIGHT CURVE (Dark Mode Only) */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.edgeShading, { right: 0 }]}
            />
          </>
        )}
        </BlurView>
      </View>
    </View>
  );
};


const GlowBadge = ({ color }: { color: string }) => {
  return (
    <View style={[styles.glowBadge, { backgroundColor: color, shadowColor: color }]} />
  );
};

const TabItem = ({
  isFocused,
  onPress,
  icon,
  label,
  theme,
  state,
  currentUserProfile,
}: {
  isFocused: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  theme: any;
  state: any;
  currentUserProfile: any;
}) => {
  const iconStyle = useAnimatedStyle(() => {
    const isTimeline = state.routes[state.index].name === 'timeline';
    const isFemale = currentUserProfile?.gender === 'Female';
    const isPink = isFocused && (isTimeline || isFemale);
    
    return {
      transform: [{ scale: withSpring(isFocused ? 1.1 : 1) }],
      // Dynamic depth shadow for the icon itself
      shadowColor: isPink ? theme.heartPink : '#000',
      shadowOpacity: withSpring(isFocused ? (isPink ? 0.6 : 0.2) : 0),
      shadowRadius: withSpring(isFocused ? 10 : 0),
      shadowOffset: { width: 0, height: withSpring(isFocused ? 4 : 0) },
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tabItem}
      activeOpacity={0.7}
      hitSlop={{ top: 30, bottom: 30, left: 20, right: 20 }}
    >
      <Animated.View style={[styles.iconWrapper, iconStyle]}>
        {icon}
      </Animated.View>
      <Text style={[styles.label, { color: isFocused ? theme.primary : theme.textLight, fontWeight: isFocused ? '900' : '600' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const SHADOWS = {
  premium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 1000,
  },
  shadowWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4, // Darker for better separation in dark mode
    shadowRadius: 30,
    elevation: 20,
    borderRadius: 50,
    padding: 1,
  },
  sideFeather: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '20%',
    zIndex: 50,
    pointerEvents: 'none',
    borderRadius: 37,
  },
  gyroReflectionTop: {
    position: 'absolute',
    width: 306, // 70% longer than the bottom reflection (180 * 1.7)
    height: 1,
    top: 0,
    left: '50%',
    marginLeft: -153, // Half of 306 to center
    zIndex: 100,
    pointerEvents: 'none',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  edgeShading: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 65, // Increased significantly for a much smoother, slower fade
    zIndex: 50,
    pointerEvents: 'none',
  },
  tabBar: {
    flexDirection: 'row',
    height: 74,
    borderRadius: 50,
    paddingHorizontal: 0, // Reset padding for indicator alignment
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)', // Kept slightly brighter for top structural definition
  },
  gyroReflection: {
    position: 'absolute',
    width: 180, // Much wider for a more panoramic, soft shimmer
    height: 1, // Microscopic height
    bottom: 0, // Move to the bottom edge
    left: '50%',
    marginLeft: -90,
    zIndex: 100,
    pointerEvents: 'none',
    // Add vertical feathering to merge with the glass
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, // Lower opacity for better material blend
    shadowRadius: 6, // Much larger bloom for absolute smoothness
  },
  movingIndicator: {
    position: 'absolute',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  indicatorContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeBg: {
    width: 70,
    height: 52,
    borderRadius: 26,
    // Add ultra-soft depth to the active bubble
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 0.5,
    overflow: 'hidden', // To clip the dropletHighlight
  },
  dropletHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    opacity: 0.45,
  },
  scatterGlow: {
    position: 'absolute',
    width: 145, // Balanced width
    height: 95,
    borderRadius: 47,
    // Soft, delicate glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
});
