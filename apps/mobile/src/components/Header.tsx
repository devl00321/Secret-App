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
  transparent?: boolean;
  textColor?: string;
}

export const Header = ({ title, showBack = false, rightElement, transparent = false, textColor }: HeaderProps) => {
  const router = useRouter();
  const theme = useTheme();

  const Container = transparent ? View : BlurView;

  return (
    <Container 
      {...(!transparent ? {
        intensity: Platform.OS === 'ios' ? 80 : 0,
        tint: theme.isDark ? 'dark' : 'light'
      } : {})}
      style={[
        styles.container, 
        { 
          backgroundColor: transparent ? 'transparent' : (Platform.OS === 'ios' ? 'transparent' : theme.surface),
          borderBottomColor: transparent ? 'transparent' : theme.border,
          borderBottomWidth: transparent ? 0 : 1,
        }
      ]}
    >
      <View style={styles.content}>
        <Text 
          style={[styles.title, { color: textColor ?? theme.text, marginHorizontal: 60 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        
        <View style={styles.rightSlot}>{rightElement ?? (showBack ? <View style={styles.placeholder} /> : null)}</View>

        {showBack && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            hitSlop={{ top: 25, bottom: 25, left: 40, right: 30 }}
          >
            <ArrowLeft size={24} color={textColor ?? theme.text} />
          </TouchableOpacity>
        )}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
    paddingBottom: 15,
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
    zIndex: 100,
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
