import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';
import { useTheme } from '../../theme';

interface SectionHeaderProps extends TextProps {
  title: string;
}

export function SectionHeader({ title, style, ...props }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <Text 
      style={[
        styles.text, 
        { color: theme.textTertiary, backgroundColor: theme.bgSurface },
        style
      ]} 
      {...props}
    >
      {title.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: 'DMSans_300Light',
    fontSize: 11,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 16,
    marginBottom: 4,
  },
});
