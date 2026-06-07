import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps extends ViewProps {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'surface' | 'elevated' | 'gold' | 'rose';
}

export function Card({ children, style, padding = 'md', variant = 'surface', ...props }: CardProps) {
  const theme = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'elevated': return theme.bgElevated;
      case 'gold': return theme.accentGoldSoft;
      case 'rose': return theme.accentRoseSoft;
      case 'surface':
      default: return theme.bgSurface;
    }
  };

  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return 12;
      case 'lg': return 20;
      case 'md':
      default: return 16;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          padding: getPadding(),
          borderColor: theme.borderDefault,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
