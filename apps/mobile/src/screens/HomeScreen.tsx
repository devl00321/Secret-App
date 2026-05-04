import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, TextInput, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/Card';
import { Heart, User, MessageCircle, Sparkles, Activity, Edit2, CalendarHeart, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, FadeInUp, FadeInRight, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { userService } from '../services/userService';

export const HomeScreen = () => {
  const theme = useTheme();
  const { user, partner, currentUserProfile, setCurrentUserProfile, coupleId } = useAuthStore();
  const router = useRouter();
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
      await userService.updateCoupleData(coupleId, { anniversaryDate: anniversaryInput.trim() });
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
                    <View style={styles.nameRow}>
                      <Text style={styles.partnerName}>{partnerName}</Text>
                      <TouchableOpacity 
                        style={styles.editIconBtn}
                        onPress={() => {
                          setNewNickname(partnerName);
                          setNicknameModalVisible(true);
                        }}
                      >
                        <Edit2 size={14} color="rgba(255,255,255,0.7)" />
                      </TouchableOpacity>
                    </View>
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
              <Text style={[styles.featureValue, { color: theme.primary }]}>∞</Text>
              <Text style={[styles.featureDesc, { color: theme.textLight }]}>Deep Connection</Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInRight.delay(500)} style={styles.featureItem}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => {
              setAnniversaryInput(currentUserProfile?.anniversaryDate || '');
              setAnniversaryModalVisible(true);
            }}>
              <Card style={styles.insightBox}>
                <View style={[styles.featureIcon, { backgroundColor: '#F0F0FF' }]}>
                  <Heart size={20} color={theme.secondary} />
                </View>
                <Text style={[styles.featureTitle, { color: theme.text }]}>Days Together</Text>
                <Text style={[styles.featureValue, { color: theme.secondary }]}>{daysTogether}</Text>
                <Text style={[styles.featureDesc, { color: theme.textLight }]}>Stronger than ever</Text>
              </Card>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {daysToBirthday !== null && (
          <Animated.View entering={FadeInUp.delay(550)} style={{ marginTop: 16 }}>
            <Card style={[styles.bdayCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.bdayIconBox, { backgroundColor: theme.primarySoft }]}>
                <CalendarHeart size={24} color={theme.primary} />
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
              <TouchableOpacity onPress={() => setNicknameModalVisible(false)}>
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
              <TouchableOpacity onPress={() => setAnniversaryModalVisible(false)}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 30 : 50,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.5,
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
});
