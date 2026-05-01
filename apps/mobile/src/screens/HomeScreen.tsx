import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/Card';
import { Heart, User, MessageCircle, Sparkles, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, FadeInUp, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

export const HomeScreen = () => {
  const theme = useTheme();
  const { user, partner } = useAuthStore();
  const router = useRouter();
  const scale = useSharedValue(1);

  const partnerStatus = partner?.isOnline ? 'online' : 'offline';
  const partnerName = partner?.displayName || 'Partner';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleCardPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/(app)/chat/main');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
          <View>
            <Text style={[styles.welcomeText, { color: theme.text }]}>Hello, {user?.displayName?.split(' ')[0] || 'Love'}</Text>
            <View style={styles.statusRow}>
              <Activity size={12} color={theme.success} />
              <Text style={[styles.dateText, { color: theme.textLight }]}> Everything is synced</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/profile')} activeOpacity={0.7}>
            <View style={[styles.avatarMini, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <User size={20} color={theme.primary} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Hero Section - Partner Card */}
        <Animated.View entering={FadeInUp.delay(200).duration(800)}>
          <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Your Connection</Text>
          <TouchableOpacity 
            onPress={handleCardPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
          >
            <Animated.View style={[styles.cardWrapper, animatedStyle]}>
              <LinearGradient
                colors={[theme.primary, theme.primary + 'DD']}
                style={[styles.partnerCard, { borderRadius: theme.radius.xl }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatarLarge}>
                    <Heart size={32} color={theme.primary} fill={theme.primary} />
                    <View style={[styles.statusIndicator, { backgroundColor: partnerStatus === 'online' ? theme.success : '#AAA' }]} />
                  </View>
                  
                  <View style={styles.infoContainer}>
                    <Text style={styles.partnerName}>{partnerName}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {partnerStatus === 'online' ? 'Active Now' : 'Away'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.chatIconCircle}>
                    <MessageCircle size={22} color="white" />
                  </View>
                </View>

                <View style={[styles.messagePreview, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {partner?.lastMessage || 'Tap to send a warm message ❤️'}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.spacing} />

        {/* Feature Grid */}
        <View style={styles.featureGrid}>
          <Animated.View entering={FadeInRight.delay(400)} style={styles.featureItem}>
            <Card style={styles.insightBox}>
              <View style={[styles.featureIcon, { backgroundColor: theme.primarySoft }]}>
                <Sparkles size={20} color={theme.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.text }]}>Vibe Score</Text>
              <Text style={[styles.featureValue, { color: theme.primary }]}>98%</Text>
              <Text style={[styles.featureDesc, { color: theme.textLight }]}>Deep Connection</Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInRight.delay(500)} style={styles.featureItem}>
            <Card style={styles.insightBox}>
              <View style={[styles.featureIcon, { backgroundColor: '#F0F0FF' }]}>
                <Heart size={20} color={theme.secondary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.text }]}>Days Together</Text>
              <Text style={[styles.featureValue, { color: theme.secondary }]}>128</Text>
              <Text style={[styles.featureDesc, { color: theme.textLight }]}>Stronger than ever</Text>
            </Card>
          </Animated.View>
        </View>

        <View style={styles.spacing} />

        {/* Daily Tip */}
        <Animated.View entering={FadeInUp.delay(600)}>
          <Card style={[styles.tipCard, { backgroundColor: theme.surface }]}>
            <View style={styles.tipHeader}>
              <Sparkles size={16} color={theme.primary} />
              <Text style={[styles.tipTitle, { color: theme.primary }]}>Pro Tip</Text>
            </View>
            <Text style={[styles.tipContent, { color: theme.text }]}>
              {'Small gestures lead to big memories. Send a sweet voice note today just to say hi.'}
            </Text>
          </Card>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 10 : 40,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  avatarMini: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  cardWrapper: {
    borderRadius: 32,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  partnerCard: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  infoContainer: {
    flex: 1,
  },
  partnerName: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.5,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'white',
    textTransform: 'uppercase',
  },
  chatIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagePreview: {
    marginTop: 20,
    borderRadius: 16,
    padding: 12,
  },
  lastMessage: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  spacing: {
    height: 32,
  },
  featureGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  featureItem: {
    flex: 1,
  },
  insightBox: {
    padding: 20,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  featureDesc: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tipCard: {
    padding: 20,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tipContent: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
});
