import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useTheme } from '../theme';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  transparent?: boolean;
  textColor?: string;
  onTitlePress?: () => void;
  avatarUrl?: string | null;
}

export const Header = ({ 
  title, 
  showBack = false, 
  rightElement, 
  transparent = false, 
  textColor,
  onTitlePress,
  avatarUrl
}: HeaderProps) => {
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
          backgroundColor: transparent ? 'transparent' : (Platform.OS === 'ios' ? 'transparent' : theme.bgSurface),
          borderBottomColor: transparent ? 'transparent' : theme.borderDefault,
          borderBottomWidth: transparent ? 0 : 1,
        }
      ]}
    >
      <View style={styles.content}>
        <TouchableOpacity 
          activeOpacity={onTitlePress ? 0.7 : 1}
          onPress={onTitlePress}
          style={styles.titleWrapper}
          disabled={!onTitlePress}
        >
          {avatarUrl && (
            <Image 
              source={{ uri: avatarUrl }} 
              style={styles.headerAvatar}
              contentFit="cover"
            />
          )}
          <Text 
            style={[styles.title, { color: textColor ?? theme.textPrimary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.rightSlot}>{rightElement ?? (showBack ? <View style={styles.placeholder} /> : null)}</View>

        {showBack && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            hitSlop={{ top: 35, bottom: 35, left: 50, right: 40 }}
          >
            <ArrowLeft size={24} color={textColor ?? theme.textPrimary} />
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
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 50,
    flex: 1,
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#eee',
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
