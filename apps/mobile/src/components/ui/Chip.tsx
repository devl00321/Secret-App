import React from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../../theme';
import { LucideIcon } from 'lucide-react-native';

interface ChipProps extends ViewProps {
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'rose' | 'gold' | 'safe' | 'warning' | 'danger';
}

export function Chip({ label, icon: Icon, variant = 'default', style, ...props }: ChipProps) {
  const theme = useTheme();

  const getThemeColors = () => {
    switch (variant) {
      case 'rose': return { bg: theme.accentRoseSoft, text: theme.accentRose };
      case 'gold': return { bg: theme.accentGoldSoft, text: theme.accentGold };
      case 'safe': return { bg: theme.safeGreen + '20', text: theme.safeGreen }; // 20 hex is 12% opacity
      case 'warning': return { bg: theme.warningAmber + '20', text: theme.warningAmber };
      case 'danger': return { bg: theme.dangerRed + '20', text: theme.dangerRed };
      case 'default':
      default: return { bg: theme.bgElevated, text: theme.textSecondary, border: theme.borderStrong };
    }
  };

  const colors = getThemeColors();

  return (
    <View
      style={[
        styles.chip,
        { 
          backgroundColor: colors.bg,
          borderColor: colors.border || 'transparent',
          borderWidth: colors.border ? 1 : 0,
        },
        style,
      ]}
      {...props}
    >
      {Icon && <Icon size={14} color={colors.text} style={styles.icon} />}
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
});
