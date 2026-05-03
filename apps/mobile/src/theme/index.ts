import { useColorScheme } from 'react-native';

export const COLORS = {
  light: {
    primary: '#FF6B6B',
    primarySoft: '#FFF0F0',
    secondary: '#6B66FF',
    background: '#FDFDFD',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textLight: '#999999',
    border: '#F0F0F0',
    success: '#4CAF50',
    error: '#FF4747',
    warmBg: '#FFF9F9',
    bubbleMe: '#FF6B6B',
    bubblePartner: '#F3F4F6',
    glass: 'rgba(255, 255, 255, 0.8)',
    glassBorder: 'rgba(255, 255, 255, 0.5)',
  },
  dark: {
    primary: '#FF8E8E',
    primarySoft: '#2D1F1F',
    secondary: '#8E8AFF',
    background: '#0F0F0F',
    surface: '#1A1A1A',
    text: '#F5F5F5',
    textLight: '#A0A0A0',
    border: '#2A2A2A',
    success: '#66BB6A',
    error: '#FF5C5C',
    warmBg: '#1F1A1A',
    bubbleMe: '#FF8E8E',
    bubblePartner: '#2C2C2E',
    glass: 'rgba(26, 26, 26, 0.8)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
  }
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  return {
    ...theme,
    isDark: colorScheme === 'dark',
    spacing: SPACING,
    radius: RADIUS,
    shadows: colorScheme === 'dark' ? DARK_SHADOWS : SHADOWS,
  };
};

export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  medium: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  premium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  }
};

export const DARK_SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  premium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  }
};
