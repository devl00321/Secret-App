import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Card = ({ children, style }: CardProps) => {
  const theme = useTheme();
  
  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: theme.radius.lg,
        ...theme.shadows.soft
      }, 
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
  },
});
