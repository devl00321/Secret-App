import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface ThemeTokens {
  bgPrimary: string;
  bgSurface: string;
  bgElevated: string;
  accentRose: string;
  accentRoseSoft: string;
  accentGold: string;
  accentGoldSoft: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  borderDefault: string;
  borderStrong: string;
  safeGreen: string;
  warningAmber: string;
  dangerRed: string;
  isDark: boolean;
}

const lightTokens: ThemeTokens = {
  bgPrimary: '#FDFBF8',
  bgSurface: '#F5F1EA',
  bgElevated: '#FFFFFF',
  accentRose: '#E8526A',
  accentRoseSoft: '#FDEEF0',
  accentGold: '#C9922E',
  accentGoldSoft: '#FDF3E3',
  textPrimary: '#1A1614',
  textSecondary: '#6B5E57',
  textTertiary: '#A89990',
  borderDefault: '#E8E0D8',
  borderStrong: '#C8BAB0',
  safeGreen: '#2D9B6F',
  warningAmber: '#C97B2A',
  dangerRed: '#D63B3B',
  isDark: false,
};

const darkTokens: ThemeTokens = {
  bgPrimary: '#100D0C',
  bgSurface: '#1C1614',
  bgElevated: '#261E1C',
  accentRose: '#F0607A',
  accentRoseSoft: '#2C1419',
  accentGold: '#E5A93C',
  accentGoldSoft: '#261A0A',
  textPrimary: '#F5EDE8',
  textSecondary: '#C4A99F',
  textTertiary: '#7A6A64',
  borderDefault: '#2E2522',
  borderStrong: '#4A3830',
  safeGreen: '#3DBF87',
  warningAmber: '#E5943A',
  dangerRed: '#F04F4F',
  isDark: true,
};

export const ThemeContext = createContext<ThemeTokens>(lightTokens);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const scheme = useColorScheme(); // auto-detects system preference
  const tokens = scheme === 'dark' ? darkTokens : lightTokens;
  return (
    <ThemeContext.Provider value={tokens}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
