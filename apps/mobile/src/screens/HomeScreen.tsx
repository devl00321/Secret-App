import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, TextInput, TouchableWithoutFeedback, ImageBackground } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/Card';
import { Heart, User, MessageCircle, Sparkles, Activity, Edit2, CalendarHeart, X, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  FadeInUp, 
  FadeOutUp,
  FadeInRight, 
  SlideInDown, 
  withRepeat, 
  withTiming, 
  withSequence,
  withDelay,
  Easing, 
  interpolate,
  useAnimatedSensor,
  SensorType,
  useDerivedValue
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { userService } from '../services/userService';
import { useChatStore } from '../store/chat';
import { useLocationStore } from '../store/useLocationStore';

const formatLastSeen = (lastActive: any) => {
  if (!lastActive) return 'Away';
  const date = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
  const now = new Date();
  const diffInMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `Last seen ${diffInMins}m ago`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `Last seen ${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Last seen ${diffInDays}d ago`;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const HomeScreen = () => {
  const theme = useTheme();
  const { user, partner, currentUserProfile, setCurrentUserProfile, coupleId, subscribeToPartner } = useAuthStore();
  const { messages } = useChatStore();
  const { isTripActive, incomingPing, setIncomingPing } = useLocationStore();
  const router = useRouter();

  const unreadCount = messages.filter(m => m.senderId !== user?.uid && !m.isRead).length;

  // Subscribe to partner presence
  useEffect(() => {
    if (partner?.id) {
      return subscribeToPartner(partner.id);
    }
  }, [partner?.id, subscribeToPartner]);
  const scale = useSharedValue(1);

  const [isNicknameModalVisible, setNicknameModalVisible] = React.useState(false);
  const [newNickname, setNewNickname] = React.useState('');
  
  const [isAnniversaryModalVisible, setAnniversaryModalVisible] = React.useState(false);
  const [anniversaryInput, setAnniversaryInput] = React.useState(currentUserProfile?.anniversaryDate || '');

  const partnerStatus = partner?.isOnline ? 'online' : 'offline';
  // Use custom nickname if set, otherwise partner's display name
  const partnerName = currentUserProfile?.partnerNickname || partner?.displayName || 'Partner';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 100 }); // Low frequency for zero heating impact
  
  // High damping spring to eliminate sensor jitter/noise when the phone is still
  const smoothedRoll = useDerivedValue(() => {
    return withSpring(sensor.sensor.value.roll, { damping: 50, stiffness: 100 });
  });

  const tiltStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      top: -50,
      left: -SCREEN_WIDTH * 0.5,
      right: -SCREEN_WIDTH * 0.5,
      bottom: -50,
      opacity: 0.4,
      transform: [
        { translateX: interpolate(smoothedRoll.value, [-0.7, 0.7], [-150, 150]) },
      ],
    };
  });


  const holoStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      top: -50,
      left: -SCREEN_WIDTH,
      right: -SCREEN_WIDTH,
      bottom: -50,
      opacity: 0.35,
      transform: [
        { translateX: interpolate(smoothedRoll.value, [-0.7, 0.7], [180, -180]) },
      ],
    };
  });

  // shimmerStyle removed

  const purpleOverlayStyle = useAnimatedStyle(() => {
    return {
      ...StyleSheet.absoluteFillObject,
      opacity: interpolate(smoothedRoll.value, [0.1, 0.7], [0, 1], 'clamp'),
    };
  });

  const goldOverlayStyle = useAnimatedStyle(() => {
    return {
      ...StyleSheet.absoluteFillObject,
      opacity: interpolate(smoothedRoll.value, [-0.7, -0.1], [1, 0], 'clamp'),
    };
  });

  const pinkOverlayStyle = useAnimatedStyle(() => {
    return {
      ...StyleSheet.absoluteFillObject,
      opacity: interpolate(smoothedRoll.value, [-0.6, 0, 0.6], [0, 1, 0], 'clamp'),
    };
  });


  const handleCardPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/(app)/chat/main');
  };

  const handleSaveNickname = async () => {
    if (!user?.uid) return;
    try {
      await userService.updatePartnerNickname(user.uid, newNickname.trim());
      // Optimistically update store
      if (currentUserProfile) {
        setCurrentUserProfile({ ...currentUserProfile, partnerNickname: newNickname.trim() });
      }
      setNicknameModalVisible(false);
    } catch (e) {
      console.warn("Failed to update nickname", e);
    }
  };

  const handleSaveAnniversary = async () => {
    if (!user?.uid || !coupleId) return;
    try {
      const dateStr = anniversaryInput.trim();
      // Write to both couple doc (shared) and user doc (for theme engine)
      await userService.updateCoupleData(coupleId, { anniversaryDate: dateStr });
      await userService.updateUserProfile(user.uid, { anniversaryDate: dateStr });
      // Optimistically update local store so theme engine sees it immediately
      if (currentUserProfile) {
        setCurrentUserProfile({ ...currentUserProfile, anniversaryDate: dateStr });
      }
      setAnniversaryModalVisible(false);
    } catch (e) {
      console.warn("Failed to update anniversary", e);
    }
  };

  const daysTogether = React.useMemo(() => {
    if (!currentUserProfile?.anniversaryDate) return '--';
    const parts = currentUserProfile.anniversaryDate.split('/');
    if (parts.length !== 3) return '--';
    
    const [dayStr, monthStr, yearStr] = parts;
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);
    
    if (isNaN(month) || isNaN(day) || isNaN(year)) return '--';
    
    const anniDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (today.getTime() < anniDate.getTime()) return '0'; // Future date
    
    const diffTime = Math.abs(today.getTime() - anniDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)).toString();
  }, [currentUserProfile?.anniversaryDate]);

  const daysToBirthday = React.useMemo(() => {
    if (!partner?.dob) return null;
    const dobParts = partner.dob.split('/');
    if (dobParts.length !== 3) return null; // Invalid format
    
    const [dayStr, monthStr, ] = dobParts;
    const month = parseInt(monthStr, 10) - 1; // 0-indexed
    const day = parseInt(dayStr, 10);
    
    if (isNaN(month) || isNaN(day)) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextBirthday = new Date(today.getFullYear(), month, day);
    
    if (today.getTime() > nextBirthday.getTime()) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    } else if (today.getTime() === nextBirthday.getTime()) {
      return 0; // Today is the day!
    }

    const diffTime = Math.abs(nextBirthday.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  }, [partner?.dob]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Heart Burst Animation */}
      {incomingPing && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[...Array(12)].map((_, i) => (
            <AnimatedHeart key={i} delay={i * 100} theme={theme} />
          ))}
        </View>
      )}

      {/* Thinking of You Banner */}
      {incomingPing && (
        <Animated.View 
          entering={FadeInUp.springify().damping(15)} 
          exiting={FadeOutUp.duration(300)}
          style={[styles.pingBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <LinearGradient
            colors={[theme.primary + '20', 'transparent']}
            style={[StyleSheet.absoluteFill, { borderRadius: 25 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <Heart size={18} color={theme.heartPink} fill={theme.heartPink} />
          <Text style={[styles.pingText, { color: theme.text }]}>
            <Text style={{ fontWeight: '900' }}>{partnerName}</Text> is thinking of you
          </Text>
        </Animated.View>
      )}

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
          <TouchableOpacity 
            onPress={() => router.push('/(app)/profile')} 
            activeOpacity={0.7}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <View style={[styles.avatarMini, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {currentUserProfile?.photoURL ? (
                <Image 
                  source={{ uri: currentUserProfile.photoURL }} 
                  style={styles.avatarMiniImage}
                  contentFit="cover"
                />
              ) : (
                <User size={20} color={theme.primary} />
              )}
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
                  <View style={styles.avatarContainerLarge}>
                    <View style={[styles.avatarLarge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      {partner?.photoURL ? (
                        <Image 
                          source={{ uri: partner.photoURL }} 
                          style={styles.avatarLargeImage}
                          contentFit="cover"
                        />
                      ) : (
                        <Heart size={32} color="white" fill="white" />
                      )}
                    </View>
                    <View style={[styles.statusIndicator, { backgroundColor: partnerStatus === 'online' ? theme.success : '#AAA' }]} />
                  </View>
                  
                  <View style={styles.infoContainer}>
                    <View style={styles.nameRow}>
                      <Text style={styles.partnerName} numberOfLines={1}>{partnerName}</Text>
                      <TouchableOpacity 
                        style={styles.editIconBtn}
                        onPress={() => {
                          setNewNickname(partnerName);
                          setNicknameModalVisible(true);
                        }}
                        hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                      >
                        <Edit2 size={14} color="rgba(255,255,255,0.7)" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={[styles.statusText, { color: partner?.isOnline ? theme.success : theme.textLight }]}>
                        {partner?.isOnline ? 'Active Now' : formatLastSeen(partner?.lastActive)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.chatIconCircle}>
                    <MessageCircle size={22} color="white" />
                    {unreadCount > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: theme.heartPink }]}>
                        <Text style={styles.unreadCountText}>{unreadCount}</Text>
                      </View>
                    )}
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

        {/* Anniversary Hero Section */}
        <Animated.View entering={FadeInUp.delay(300)}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => {
              setAnniversaryInput(currentUserProfile?.anniversaryDate || '');
              setAnniversaryModalVisible(true);
            }}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroBg}>
                {/* BASE GOLD LAYER */}
                <Animated.View style={goldOverlayStyle}>
                  <LinearGradient
                    colors={['#D4AF37', '#F7EF8A', '#FFD700']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                {/* MIDDLE PINK LAYER */}
                <Animated.View style={pinkOverlayStyle}>
                  <LinearGradient
                    colors={['#FF69B4', '#FFB6C1', '#FF1493']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                {/* OVERLAY PURPLE LAYER */}
                <Animated.View style={purpleOverlayStyle}>
                  <LinearGradient
                    colors={['#8A2BE2', '#4B0082', '#9400D3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                {/* HIGH-PERFORMANCE HOLOGRAPHIC TEXTURE (iOS only for performance) */}
                {Platform.OS === 'ios' ? (
                  <Animated.View style={holoStyle}>
                    <Image 
                      source={require('../../assets/images/holographic_texture.png')}
                      style={{ width: SCREEN_WIDTH * 2, height: 400, opacity: 0.3 }}
                      resizeMode="cover"
                    />
                  </Animated.View>
                ) : (
                  // Android: Use lightweight gradient shimmer instead
                  <Animated.View style={holoStyle}>
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.2)', 'rgba(255,200,255,0.15)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: SCREEN_WIDTH * 2, height: 400 }}
                    />
                  </Animated.View>
                )}

                {/* DYNAMIC TILT SHINE (Simplified) */}
                <Animated.View style={tiltStyle}>
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  style={styles.heroGradient}
                />

                <View style={styles.heroContent}>
                  <View style={styles.heroHeader}>
                    <View style={styles.milestoneBadge}>
                      <Sparkles size={14} color="#FFF" />
                      <Text style={styles.milestoneText}>Love Milestone</Text>
                    </View>
                    <CalendarHeart size={24} color="#FFF" />
                  </View>
                  
                  <View style={styles.daysContainer}>
                    <Text style={[
                      styles.daysCount,
                      daysTogether === '--' && { fontWeight: '300', letterSpacing: 4, opacity: 0.8 }
                    ]}>
                      {daysTogether}
                    </Text>
                    <Text style={styles.daysLabel}>Days of Love</Text>
                  </View>
                  
                  <Text style={styles.heroQuote}>
                    {currentUserProfile?.anniversaryDate 
                      ? "Every day is a new page in our story." 
                      : "Tap to set your anniversary and start counting your days together."}
                  </Text>
                </View>
                </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.spacing} />

        {/* Feature Grid */}
        <View style={styles.featureGrid}>
          <Animated.View entering={FadeInRight.delay(400)} style={styles.featureItem}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/location')}>
              <Card style={styles.insightBox}>
                <View style={[styles.featureIcon, { backgroundColor: theme.primarySoft }]}>
                  <MapPin size={20} color={theme.primary} />
                </View>
                <Text style={[styles.featureTitle, { color: theme.text }]}>Safe Journey</Text>
                <Text style={[styles.featureValue, { color: theme.primary }]}>
                   {isTripActive ? 'Live' : 'Ready'}
                </Text>
                <Text style={[styles.featureDesc, { color: theme.textLight }]}>Live path tracking</Text>
              </Card>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInRight.delay(500)} style={styles.featureItem}>
            <Card style={styles.insightBox}>
              <View style={[styles.featureIcon, { backgroundColor: '#F0F0FF' }]}>
                <Activity size={20} color={theme.secondary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.text }]}>Vibe Score</Text>
              <Text style={[styles.featureValue, { color: theme.secondary }]}>∞</Text>
              <Text style={[styles.featureDesc, { color: theme.textLight }]}>Deep Connection</Text>
            </Card>
          </Animated.View>
        </View>

        {daysToBirthday !== null && (
          <Animated.View entering={FadeInUp.delay(550)} style={{ marginTop: 16 }}>
            <Card style={[styles.bdayCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.bdayIconBox, { backgroundColor: theme.primarySoft }]}>
                <CalendarHeart size={24} color={theme.heartPink} />
              </View>
              <View style={styles.bdayInfo}>
                <Text style={[styles.bdayCount, { color: theme.primary }]}>
                  {daysToBirthday === 0 ? "It's today!" : `${daysToBirthday} days left`}
                </Text>
                <Text style={[styles.bdayDesc, { color: theme.text }]}>
                  to your {partnerName}'s birthday 🎉
                </Text>
              </View>
            </Card>
          </Animated.View>
        )}

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

      {/* Nickname Modal Overlay */}
      {isNicknameModalVisible && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setNicknameModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Set Nickname</Text>
              <TouchableOpacity 
                onPress={() => setNicknameModalVisible(false)}
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              >
                <X size={24} color={theme.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: theme.textLight }]}>
              Give your partner a cute nickname that only you will see.
            </Text>
            
            <View style={[styles.modalInputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={newNickname}
                onChangeText={setNewNickname}
                placeholder="Nickname"
                placeholderTextColor={theme.textLight}
                autoFocus
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSaveNickname}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Anniversary Modal Overlay */}
      {isAnniversaryModalVisible && (
        <Animated.View entering={FadeInUp.duration(300)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAnniversaryModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border, minHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Our Anniversary</Text>
              <TouchableOpacity 
                onPress={() => setAnniversaryModalVisible(false)}
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              >
                <X size={24} color={theme.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: theme.textLight }]}>
              When did your journey together begin?
            </Text>
            
            <View style={[styles.modalInputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={anniversaryInput}
                keyboardType="numeric"
                maxLength={10}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={theme.textLight}
                onChangeText={(text) => {
                  let cleaned = text.replace(/[^\d/]/g, '');
                  if (cleaned.length === 2 && anniversaryInput.length === 1 && !cleaned.includes('/')) {
                    cleaned += '/';
                  } else if (cleaned.length === 5 && anniversaryInput.length === 4 && cleaned.split('/').length === 2) {
                    cleaned += '/';
                  }
                  setAnniversaryInput(cleaned);
                }}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSaveAnniversary}
            >
              <Text style={styles.saveBtnText}>Start Counting</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const AnimatedHeart = ({ delay, theme }: { delay: number, theme: any }) => {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 200;
    
    tx.value = withTiming(Math.cos(angle) * distance, { duration: 2000, easing: Easing.out(Easing.quad) });
    ty.value = withTiming(Math.sin(angle) * distance - 100, { duration: 2000, easing: Easing.out(Easing.quad) });
    opacity.value = withSequence(
      withDelay(delay, withTiming(1, { duration: 400 })),
      withDelay(1000, withTiming(0, { duration: 600 }))
    );
    scale.value = withSequence(
      withDelay(delay, withSpring(1 + Math.random())),
      withDelay(1000, withTiming(0, { duration: 600 }))
    );
    rotate.value = withTiming(Math.random() * 360, { duration: 2000 });
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: '45%',
    left: '45%',
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` }
    ],
  }));

  return (
    <Animated.View style={style}>
      <Heart size={24} color={theme.heartPink} fill={theme.heartPink} />
    </Animated.View>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pingBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24,
    right: 24,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 2000,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  pingText: {
    fontSize: 15,
    marginLeft: 12,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
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
    overflow: 'hidden',
  },
  avatarMiniImage: {
    width: '100%',
    height: '100%',
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
  avatarContainerLarge: {
    width: 64,
    height: 64,
    marginRight: 16,
    position: 'relative',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLargeImage: {
    width: '100%',
    height: '100%',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  editIconBtn: {
    padding: 6,
    marginLeft: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
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
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    paddingHorizontal: 4,
  },
  unreadCountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
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
  bdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  bdayIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bdayInfo: {
    flex: 1,
  },
  bdayCount: {
    fontSize: 20,
    fontWeight: '900',
  },
  bdayDesc: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    marginTop: 2,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1000,
  },
  modalContent: {
    width: '100%',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalDesc: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  modalInput: {
    height: 56,
    fontSize: 18,
    fontWeight: '600',
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 32,
    overflow: 'hidden',
    height: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  heroBg: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)', // Golden tint
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,182,193,0.5)', // Rose gold border
  },
  milestoneText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 6,
  },
  daysContainer: {
    alignItems: 'center',
  },
  daysCount: {
    fontSize: 72,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -2,
    lineHeight: 72,
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  daysLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  heroQuote: {
    fontSize: 13,
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontStyle: 'italic',
    opacity: 0.9,
  },
});
