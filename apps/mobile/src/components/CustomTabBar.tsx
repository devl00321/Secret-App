import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MapPin, Shield, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';



export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useTheme();

  const getIcon = (name: string, color: string) => {
    const size = 22;
    switch (name) {
      case 'index': return <Home color={color} size={size} />;
      case 'location': return <MapPin color={color} size={size} />;
      case 'safety': return <Shield color={color} size={size} />;
      case 'timeline': return <Heart color={color} size={size} />;
      default: return <Home color={color} size={size} />;
    }
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 10 }]}>
      <BlurView 
        intensity={Platform.OS === 'ios' ? 80 : 100} 
        tint={theme.isDark ? 'dark' : 'light'}
        style={[
          styles.tabBar, 
          { 
            backgroundColor: theme.glass,
            borderColor: theme.glassBorder,
            width: width * 0.88, // Dynamic width here
          }
        ]}
      >
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
            />
          );
        })}
      </BlurView>
    </View>
  );
};

type Theme = ReturnType<typeof useTheme>;

const TabItem = ({
  isFocused,
  onPress,
  icon,
  label,
  theme,
}: {
  isFocused: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  theme: Theme;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isFocused ? 1.15 : 1) }],
    opacity: withSpring(isFocused ? 1 : 0.7),
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    width: withSpring(isFocused ? 4 : 0),
    height: withSpring(isFocused ? 4 : 0),
    opacity: withSpring(isFocused ? 1 : 0),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.iconWrapper, animatedStyle]}>
        {icon}
      </Animated.View>
      <Text style={[styles.label, { color: isFocused ? theme.primary : theme.textLight }]}>
        {label}
      </Text>
      <Animated.View style={[styles.activeIndicator, { backgroundColor: theme.primary }, indicatorStyle]} />
    </TouchableOpacity>
  );
};

const SHADOWS = {
  premium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
    zIndex: 100,
  },
  tabBar: {
    flexDirection: 'row',
    height: 70,
    borderRadius: 35,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
    borderWidth: 1.5,
    ...SHADOWS.premium,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    marginTop: 4,
    borderRadius: 2,
  },
});
