import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../theme';

interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
}

export function Avatar({ url, name, size = 48 }: AvatarProps) {
  const theme = useTheme();

  const getInitials = (n?: string) => {
    if (!n) return '?';
    return n.substring(0, 2).toUpperCase();
  };

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.bgSurface },
        ]}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor: theme.accentRoseSoft 
        },
      ]}
    >
      <Text style={[styles.initials, { color: theme.accentRose, fontSize: size * 0.4 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: 'DMSans_500Medium',
  },
});
