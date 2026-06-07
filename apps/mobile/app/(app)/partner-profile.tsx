import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Heart,
  ShieldCheck,
  Battery,
  Clock,
  Zap,
  Calendar,
  MapPin,
  ArrowLeft,
  Sparkles,
  CloudRain,
  Thermometer,
  X,
  Send,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useChatStore } from '../../src/store/chat';
import { useLocationStore } from '../../src/store/useLocationStore';
import { useTheme } from '../../src/theme';
import { locationService } from '../../src/services/locationService';
import { activityService, Activity } from '../../src/services/activityService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Haversine formula for local distance calculation (Privacy-first)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
};

export default function PartnerProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, partner, currentUserProfile, coupleId } = useAuthStore();
  const { messages, sendMessage } = useChatStore();
  const { partnerLocation, userLocation, partnerWalkSafe } = useLocationStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isHeartGlowing, setIsHeartGlowing] = useState(false);

  useEffect(() => {
    if (partner?.photoURL && partner?.id) {
      AsyncStorage.getItem(`liked_photo_${partner.id}`).then(url => {
        if (url === partner.photoURL) {
          setIsHeartGlowing(true);
        } else {
          setIsHeartGlowing(false);
        }
      });
    }
  }, [partner?.photoURL, partner?.id]);

  const handleSendComment = async () => {
    if (!commentText.trim() || !coupleId || !user?.uid) return;
    await sendMessage(commentText.trim(), user.uid, coupleId, undefined, 'reaction');
    setCommentText('');
    setImageModalVisible(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSendHeartReaction = async () => {
    if (!coupleId || !user?.uid) return;
    
    if (isHeartGlowing) return; // Prevent spamming if already permanently liked
    
    setIsHeartGlowing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    await sendMessage('❤️', user.uid, coupleId, undefined, 'reaction');
    
    if (partner?.id && partner?.photoURL) {
      AsyncStorage.setItem(`liked_photo_${partner.id}`, partner.photoURL);
    }
  };
  
  const partnerName = currentUserProfile?.partnerNickname || partner?.displayName || 'Your Love';
  
  // ── Subscribe to activities ──
  useEffect(() => {
    if (!coupleId) return;
    return activityService.subscribeToActivities(coupleId, (data) => {
      setActivities(data);
    });
  }, [coupleId]);

  const distance = useMemo(() => {
    if (userLocation && partnerLocation) {
      return calculateDistance(
        userLocation.coords.latitude, userLocation.coords.longitude,
        partnerLocation.latitude, partnerLocation.longitude
      );
    }
    return null;
  }, [userLocation, partnerLocation]);

  const latestMemory = useMemo(() => {
    return activities[0]; // Activities are already sorted by date
  }, [activities]);

  // Stats Animation
  const heartScale = useSharedValue(1);
  const [pulseTime, setPulseTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  // ── Calculate Relationship Pulse ──
  useEffect(() => {
    const calculatePulse = () => {
      if (!currentUserProfile?.anniversaryDate) return;
      const parts = currentUserProfile.anniversaryDate.split('/');
      if (parts.length !== 3) return;
      
      const [d, m, y] = parts.map(p => parseInt(p, 10));
      const anniversary = new Date(y, m - 1, d);
      const now = new Date();
      
      const diff = Math.max(0, now.getTime() - anniversary.getTime());
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      
      setPulseTime({ days, hours, mins, secs });
    };

    calculatePulse();
    const interval = setInterval(calculatePulse, 1000);
    return () => clearInterval(interval);
  }, [currentUserProfile?.anniversaryDate]);

  // ── Stats ──
  const loveStats = useMemo(() => {
    const sentPings = 0; // In a real app, this would be tracked in user doc
    const totalMessages = messages.length;
    const memories = 0; // Tracked by activity count
    return { sentPings, totalMessages, memories };
  }, [messages.length]);

  const handleSendHeart = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    heartScale.value = withSequence(
      withSpring(1.5),
      withSpring(1)
    );
    
    if (partner?.id) {
      await locationService.sendPing(partner.id);
    }
  };

  const handleDigitalHandHold = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Trigger a special "vibration" ping to partner
      if (partner?.id) {
        locationService.sendPing(partner.id); // Reusing ping for now, can be specialized
      }
    }
  };

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const localTime = useMemo(() => {
    // In a real app, calculate based on partner's timezone
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Hero Gradient */}
      <View style={styles.heroBgContainer}>
        {partner?.photoURL && (
          <Image
            source={{ uri: partner.photoURL }}
            style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
            contentFit="cover"
            blurRadius={20}
          />
        )}
        <LinearGradient
          colors={[theme.accentRose + 'D9', theme.accentRose + '66', theme.bgPrimary]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Header */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.topNav}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.securityBadge}>
            <ShieldCheck size={14} color="white" />
            <Text style={styles.securityText}>E2EE SECURE</Text>
          </View>
        </Animated.View>

        {/* Profile Hero */}
        <View style={styles.profileHero}>
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.avatarWrapper}>
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => partner?.photoURL && setImageModalVisible(true)}
              onLongPress={handleDigitalHandHold}
              delayLongPress={500}
            >
              <View style={[styles.avatarOuter, { borderColor: 'rgba(255,255,255,0.4)' }]}>
                {partner?.photoURL ? (
                  <Image
                    source={{ uri: partner.photoURL }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.accentRoseSoft }]}>
                    <Heart size={48} color={theme.accentRose} fill={theme.accentRose} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <View style={[styles.statusIndicator, { backgroundColor: partner?.isOnline ? theme.safeGreen : '#AAA' }]} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.nameContainer}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            <View style={styles.proximityRow}>
              <MapPin size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.partnerStatus}>
                {distance ? `${distance}km away` : (partner?.isOnline ? 'Online now' : 'Resting')}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Relationship Pulse - Unique Feature */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={styles.pulseCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.pulseLabel}>Relationship Pulse</Text>
            <View style={styles.tickerRow}>
              <View style={styles.tickerItem}>
                <Text style={styles.tickerValue}>{pulseTime.days}</Text>
                <Text style={styles.tickerLabel}>Days</Text>
              </View>
              <Text style={styles.tickerDivider}>:</Text>
              <View style={styles.tickerItem}>
                <Text style={styles.tickerValue}>{pulseTime.hours.toString().padStart(2, '0')}</Text>
                <Text style={styles.tickerLabel}>Hrs</Text>
              </View>
              <Text style={styles.tickerDivider}>:</Text>
              <View style={styles.tickerItem}>
                <Text style={styles.tickerValue}>{pulseTime.mins.toString().padStart(2, '0')}</Text>
                <Text style={styles.tickerLabel}>Min</Text>
              </View>
              <Text style={styles.tickerDivider}>:</Text>
              <View style={styles.tickerItem}>
                <Text style={styles.tickerValue}>{pulseTime.secs.toString().padStart(2, '0')}</Text>
                <Text style={styles.tickerLabel}>Sec</Text>
              </View>
            </View>
            <View style={styles.pulseSparkle}>
              <Sparkles size={16} color="white" opacity={0.6} />
              <Text style={styles.pulseFooter}>Growing stronger every second</Text>
            </View>
          </BlurView>
        </Animated.View>

        {/* Live Status Grid */}
        <View style={styles.grid}>
          <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.gridItem}>
            <BlurView intensity={30} tint="dark" style={styles.statusBox}>
              <Battery size={20} color="white" />
              <Text style={styles.statusValue}>{partnerLocation?.batteryLevel ?? '--'}%</Text>
              <Text style={styles.statusLabel}>Battery</Text>
            </BlurView>
          </Animated.View>
          
          <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.gridItem}>
            <BlurView intensity={30} tint="dark" style={styles.statusBox}>
              <Clock size={20} color="white" />
              <Text style={styles.statusValue}>{localTime}</Text>
              <Text style={styles.statusLabel}>Local Time</Text>
            </BlurView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(700).springify()} style={styles.gridItem}>
            <BlurView intensity={30} tint="dark" style={styles.statusBox}>
              <ShieldCheck size={20} color={partnerWalkSafe?.isActive ? theme.safeGreen : "white"} />
              <Text style={[styles.statusValue, partnerWalkSafe?.isActive && { color: theme.safeGreen, fontSize: 18 }]} numberOfLines={1}>
                {partnerWalkSafe?.isActive ? 'Active' : 'Protected'}
              </Text>
              <Text style={styles.statusLabel}>Luvv Guard</Text>
            </BlurView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.gridItem}>
            <BlurView intensity={30} tint="dark" style={styles.statusBox}>
              <Zap size={20} color="white" />
              <Text style={styles.statusValue}>{loveStats.totalMessages}</Text>
              <Text style={styles.statusLabel}>Total Texts</Text>
            </BlurView>
          </Animated.View>
        </View>

        {/* Latest Memory - Unique Feature */}
        {latestMemory && (
          <Animated.View entering={FadeInDown.delay(850).springify()}>
            <BlurView intensity={20} tint="dark" style={styles.memoryCard}>
              <Text style={styles.memoryLabel}>Latest Shared Memory</Text>
              <View style={styles.memoryContent}>
                <View style={[styles.memoryIcon, { backgroundColor: theme.accentRose + '30' }]}>
                  <Sparkles size={18} color="white" />
                </View>
                <View style={styles.memoryInfo}>
                  <Text style={styles.memoryTitle} numberOfLines={1}>{latestMemory.content}</Text>
                  <Text style={styles.memoryDate}>
                    {latestMemory.timestamp ? (() => {
                      try {
                        const date = new Date(latestMemory.timestamp);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString();
                        }
                      } catch (e) {}
                      return 'Recently';
                    })() : 'Recently'}
                  </Text>
                </View>
              </View>
            </BlurView>
          </Animated.View>
        )}

        {/* Love Action Button */}
        <Animated.View entering={FadeInDown.delay(900).springify()} style={styles.actionContainer}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={handleSendHeart}
            style={styles.mainHeartBtn}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF8E8E']}
              style={styles.heartGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Animated.View style={animatedHeartStyle}>
                <Heart size={42} color="white" fill="white" />
              </Animated.View>
            </LinearGradient>
            <Text style={[styles.heartBtnText, { color: theme.textPrimary }]}>Send a heart</Text>
            <Text style={[styles.heartBtnDesc, { color: theme.textSecondary }]}>Send a high-intensity pulse to {partnerName}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalBackground} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setImageModalVisible(false)}
          >
            <X size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.modalCloseArea} 
            activeOpacity={1} 
            onPress={() => setImageModalVisible(false)}
          >
            {partner?.photoURL && (
              <Image
                source={{ uri: partner.photoURL }}
                style={styles.fullScreenImage}
                contentFit="contain"
              />
            )}
          </TouchableOpacity>
          
          <View style={styles.reactionFooter}>
            <TextInput
              style={styles.reactionInput}
              placeholder="Send a comment..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={commentText}
              onChangeText={setCommentText}
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            <TouchableOpacity 
              style={[styles.reactionBtn, commentText.trim().length > 0 && { backgroundColor: theme.accentRose }]}
              onPress={handleSendComment}
            >
              <Send size={20} color={commentText.trim().length > 0 ? "white" : "rgba(255,255,255,0.5)"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.heartReactionBtn, 
                isHeartGlowing && { 
                  shadowColor: '#FF3B30', 
                  shadowOffset: { width: 0, height: 0 }, 
                  shadowOpacity: 1, 
                  shadowRadius: 15,
                  elevation: 10,
                  backgroundColor: 'rgba(255,59,48,0.2)'
                }
              ]}
              onPress={handleSendHeartReaction}
            >
              <Heart size={28} color={isHeartGlowing ? '#FF3B30' : "white"} fill={isHeartGlowing ? '#FF3B30' : "transparent"} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  securityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  avatarOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    padding: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: 'white',
  },
  nameContainer: {
    alignItems: 'center',
  },
  partnerName: {
    fontSize: 32,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
  },
  partnerStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  proximityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pulseCard: {
    borderRadius: 32,
    padding: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 24,
  },
  pulseLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },
  tickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tickerItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  tickerValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
  },
  tickerLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  tickerDivider: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 24,
    fontWeight: '900',
    paddingBottom: 15,
  },
  memoryCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
    overflow: 'hidden',
  },
  memoryLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  memoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryInfo: {
    flex: 1,
  },
  memoryTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  memoryDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  pulseSparkle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  pulseFooter: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 32,
  },
  gridItem: {
    width: '50%',
    padding: 8,
  },
  statusBox: {
    height: 100,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  statusValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  actionContainer: {
    alignItems: 'center',
  },
  mainHeartBtn: {
    width: '100%',
    alignItems: 'center',
  },
  heartGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  heartBtnText: {
    fontSize: 18,
    fontWeight: '900',
  },
  heartBtnDesc: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.8,
    textAlign: 'center',
  },
  footerSpacing: {
    height: 100,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  reactionFooter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  reactionInput: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    paddingHorizontal: 20,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reactionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heartReactionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
