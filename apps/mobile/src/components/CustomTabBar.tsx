import React from 'react';
import { View, Platform, useWindowDimensions, Dimensions, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MapPin, Shield, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring, useDerivedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { useLocationStore } from '../store/useLocationStore';
import { useChatStore } from '../store/chat';
import { GlowLayers } from './TabBar/GlowLayers';
import { GlowBadge } from './TabBar/GlowBadge';
import { TabItem } from './TabBar/TabItem';
import { styles } from './TabBar/TabBarStyles';

export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { user, currentUserProfile } = useAuthStore();
  const { activeSos } = useLocationStore();
  const { messages } = useChatStore();

  const unreadCount = messages.filter(m => m.senderId !== user?.uid && !m.isRead).length;
  const isSosActive = !!activeSos?.isActive;

  const tabWidth = ((width || Dimensions.get('window').width) * 0.9) / state.routes.length;

  const translateX = useDerivedValue(() =>
    withSpring(state.index * tabWidth, { damping: 20, stiffness: 90 })
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const getIcon = (name: string, color: string) => {
    const size = 20;
    switch (name) {
      case 'index':
        return (
          <View>
            <Home color={color} size={size} />
            {unreadCount > 0 && <GlowBadge color={theme.accentRose} />}
          </View>
        );
      case 'location':
        return <MapPin color={color} size={size} />;
      case 'safety':
        return <Shield color={isSosActive ? '#FF3B30' : color} size={size} />;
      case 'timeline':
        return (
          <Heart
            color={color}
            size={size}
            fill={color === theme.accentRose ? theme.accentRose : 'transparent'}
          />
        );
      default:
        return <Home color={color} size={size} />;
    }
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 10 }]}>
      <View style={[styles.shadowWrapper, { shadowOpacity: theme.isDark ? 0.4 : 0.15 }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? (theme.isDark ? 66 : 42) : 125}
          tint={theme.isDark ? 'dark' : 'light'}
          style={[
            styles.tabBar,
            {
              backgroundColor: Platform.OS === 'android'
                ? (theme.isDark ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.14)')
                : 'transparent',
              borderColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.05)',
              width: (width || Dimensions.get('window').width) * 0.9,
              minWidth: 320,
            },
          ]}
        >
          {/* Moving active-tab indicator with ambient glow */}
          <Animated.View style={[styles.movingIndicator, { width: tabWidth }, indicatorStyle]}>
            <View style={styles.indicatorContainer}>
              <Animated.View style={[styles.scatterGlow, { shadowColor: theme.accentRose }]}>
                <GlowLayers state={state} theme={theme} currentUserProfile={currentUserProfile} />
                {Platform.OS === 'android' && (
                  <>
                    <GlowLayers state={state} theme={theme} currentUserProfile={currentUserProfile} />
                    <GlowLayers state={state} theme={theme} currentUserProfile={currentUserProfile} />
                  </>
                )}
              </Animated.View>

              <Animated.View
                style={[
                  styles.activeBg,
                  { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'transparent' },
                  { borderColor: theme.accentRose + '40' },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.35)', 'transparent']}
                  style={styles.dropletHighlight}
                />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Tab buttons */}
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
            const isFocused = state.index === index;

            const onPress = () => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };

            return (
              <TabItem
                key={route.key}
                isFocused={isFocused}
                onPress={onPress}
                icon={getIcon(route.name, isFocused ? theme.accentRose : theme.textSecondary)}
                label={label}
                theme={theme}
              />
            );
          })}

          {/* Dark-mode edge depth shading */}
          {theme.isDark && (
            <>
              <LinearGradient
                colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.2)', 'transparent']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.edgeShading, { left: 0 }]}
              />
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
