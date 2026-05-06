import { useColorScheme } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

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
    heartPink: '#FF6B6B',
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
    heartPink: '#FF6B6B',
  },
  anniversary: {
    primary: '#D4AF37', // Metallic Gold
    primarySoft: '#FDF6E3',
    secondary: '#B8860B', // Dark Gold
    background: '#FFFDF0', // Creamy Gold
    surface: '#FFFFFF',
    text: '#2C1E0F', // Warm dark brown
    textLight: '#938B74',
    border: '#EEDC82',
    success: '#4CAF50',
    error: '#FF4747',
    warmBg: '#FEF9E7',
    bubbleMe: '#D4AF37',
    bubblePartner: '#F5F5F5',
    glass: 'rgba(255, 253, 240, 0.9)',
    glassBorder: 'rgba(212, 175, 55, 0.4)',
    heartPink: '#D4AF37',
  }
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const { currentUserProfile } = useAuthStore();
  
  let baseTheme = colorScheme === 'dark' ? { ...COLORS.dark } : { ...COLORS.light };

  // ── ANNIVERSARY THEME DETECTION ──
  if (currentUserProfile?.anniversaryDate) {
    const [d, m] = currentUserProfile.anniversaryDate.split('/');
    const today = new Date();
    const annDay = parseInt(d, 10);
    const annMonth = parseInt(m, 10) - 1; // 0-indexed month

    if (today.getDate() === annDay && today.getMonth() === annMonth) {
      baseTheme = { ...COLORS.anniversary };
    }
  }

  // Gender-based theme optimization (skipped if Anniversary theme is active for maximum focus)
  const isAnniversaryDay = baseTheme.primary === COLORS.anniversary.primary;
  
  if (!isAnniversaryDay && currentUserProfile?.gender === 'Male') {
    const pink = baseTheme.primary;
    const purple = baseTheme.secondary;
    baseTheme.primary = purple;
    baseTheme.secondary = pink;
    baseTheme.bubbleMe = purple;
    // Swap soft background if needed
    if (baseTheme.primarySoft) {
      baseTheme.primarySoft = colorScheme === 'dark' ? '#1F1F2D' : '#F0F0FF';
    }
  }

  return {
    ...baseTheme,
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
