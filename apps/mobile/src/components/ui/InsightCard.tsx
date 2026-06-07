import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Card } from './Card';

export interface InsightCardProps {
  status: 'safe' | 'warning' | 'alert';
  message: string;
  suggestion?: string;
}

export function InsightCard({ status, message, suggestion }: InsightCardProps) {
  const theme = useTheme();

  if (!message) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'alert':
        return { color: theme.dangerRed, bg: theme.dangerRed + '10', Icon: ShieldAlert };
      case 'warning':
        return { color: theme.warningAmber, bg: theme.warningAmber + '10', Icon: ShieldAlert };
      case 'safe':
      default:
        return { color: theme.safeGreen, bg: theme.safeGreen + '10', Icon: ShieldCheck };
    }
  };

  const config = getStatusConfig();
  const { Icon } = config;

  return (
    <Card 
      style={[styles.container, { backgroundColor: config.bg, borderColor: config.color + '30' }]} 
      padding="sm"
    >
      <View style={styles.header}>
        <Icon size={16} color={config.color} />
        <Text style={[styles.message, { color: theme.textPrimary }]}>{message}</Text>
      </View>
      {suggestion && (
        <Text style={[styles.suggestion, { color: theme.textSecondary }]}>
          {suggestion}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  message: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    flex: 1,
  },
  suggestion: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 24, // Align with text
  },
});
