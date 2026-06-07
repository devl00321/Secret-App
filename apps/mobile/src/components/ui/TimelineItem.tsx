import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { LucideIcon } from 'lucide-react-native';

interface TimelineItemProps {
  icon: LucideIcon;
  title: string;
  timestamp: string;
  isLast?: boolean;
}

export function TimelineItem({ icon: Icon, title, timestamp, isLast = false }: TimelineItemProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Timeline Line */}
      {!isLast && (
        <View style={[styles.line, { backgroundColor: theme.borderDefault }]} />
      )}
      
      {/* Icon Circle */}
      <View style={[styles.iconContainer, { backgroundColor: theme.bgSurface, borderColor: theme.borderStrong }]}>
        <Icon size={14} color={theme.textSecondary} />
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.time, { color: theme.textTertiary }]}>{timestamp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingBottom: 24,
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: 11, // 24/2 - 1
    top: 24,
    bottom: 0,
    width: 2,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    marginBottom: 2,
  },
  time: {
    fontFamily: 'DMSans_300Light',
    fontSize: 12,
  },
});
