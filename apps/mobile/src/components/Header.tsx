import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export const Header = ({ title, showBack = false, rightElement }: HeaderProps) => {
  const router = useRouter();
  const theme = useTheme();

  return (
    <BlurView 
      intensity={Platform.OS === 'ios' ? 80 : 0} 
      tint={theme.isDark ? 'dark' : 'light'}
      style={[
        styles.container, 
        { 
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surface,
          borderBottomColor: theme.border 
        }
      ]}
    >
      <View style={styles.content}>
        {showBack && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={styles.rightSlot}>{rightElement ?? (showBack ? <View style={styles.placeholder} /> : null)}</View>
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 44,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 40,
  },
  rightSlot: {
    position: 'absolute',
    right: 20,
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
