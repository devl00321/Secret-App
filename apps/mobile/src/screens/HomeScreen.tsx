import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, TextInput, TouchableWithoutFeedback, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Avatar } from '../components/ui/Avatar';
import { PingButton } from '../components/ui/PingButton';
import { BatteryIndicator } from '../components/ui/BatteryIndicator';
import { InsightCard } from '../components/ui/InsightCard';
import { Heart, MessageCircle, MapPin, X, Edit2, CalendarHeart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { userService } from '../services/userService';
import { encryptionService } from '../services/encryptionService';
import { useChatStore } from '../store/chat';
import { useLocationStore } from '../store/useLocationStore';
import { db, doc, onSnapshot } from '../services/firebase';

export interface StreakInfo {
  streakCount: number;
  lastInteractionDate: string;
  lastInteractionTimestamp: number;
  messageCount: number;
  pingCount: number;
  imageCount: number;
  timelineCount: number;
}

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

export const HomeScreen = () => {
  const theme = useTheme();
  const { user, partner, currentUserProfile, setCurrentUserProfile, coupleId, sharedSecret, subscribeToPartner } = useAuthStore();
  const { messages } = useChatStore();
  const { isTripActive, incomingPing, partnerLocation } = useLocationStore();
  const router = useRouter();

  const unreadCount = messages.filter(m => m.senderId !== user?.uid && !m.isRead).length;

  const [partnerDobModalVisible, setPartnerDobModalVisible] = useState(false);
  const [partnerDobInput, setPartnerDobInput] = useState('');

  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);

  const [isNicknameModalVisible, setNicknameModalVisible] = React.useState(false);
  const [newNickname, setNewNickname] = React.useState('');
  
  const [isAnniversaryModalVisible, setAnniversaryModalVisible] = React.useState(false);
  const [anniversaryInput, setAnniversaryInput] = React.useState(currentUserProfile?.anniversaryDate || '');

  const partnerStatus = partner?.isOnline ? 'online' : 'offline';
  const partnerName = currentUserProfile?.partnerNickname || partner?.displayName || 'Partner';

  const handleSavePartnerDob = async () => {
    if (!partnerDobInput.trim() || !partner?.id) return;
    const dobRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dobRegex.test(partnerDobInput.trim())) {
      Alert.alert("Invalid DOB", "Please use DD/MM/YYYY format.");
      return;
    }
    try {
      setPartnerDobModalVisible(false);
      await userService.updateUserProfile(partner.id, { dob: partnerDobInput.trim() });
      Alert.alert("Success", "Partner's birthday saved!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save partner's birthday. " + (err as Error).message);
    }
  };

  useEffect(() => {
    if (partner?.id) {
      return subscribeToPartner(partner.id);
    }
  }, [partner?.id, subscribeToPartner]);

  useEffect(() => {
    if (!coupleId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'couples', coupleId),
      (snapshot) => {
        if (snapshot && snapshot.exists()) {
          const data = snapshot.data();
          if (data?.streakInfo) {
            setStreakInfo(data.streakInfo);
          }
        }
      },
      (error) => console.log('[HomeScreen] Couple streak error:', error.message)
    );
    return () => unsubscribe();
  }, [coupleId]);

  useEffect(() => {
    const decryptPartnerData = async () => {
      if (partner?.dob && partner.dob.includes('/') === false && partner.dob.length > 20) {
        const { sharedSecret, coupleId } = useAuthStore.getState();
        const secret = sharedSecret || (coupleId ? encryptionService.getLegacySecret(coupleId) : null);
        if (secret) {
          try {
            const decryptedDob = await encryptionService.decryptField(partner.dob, secret, partner.coupleId);
            if (decryptedDob && decryptedDob.includes('/')) {
              useAuthStore.setState((state) => ({
                partner: state.partner ? { ...state.partner, dob: decryptedDob } : null
              }));
            }
          } catch (e) {
            console.log('[HomeScreen] Decryption failed, waiting for key...');
          }
        }
      }
    };
    decryptPartnerData();
  }, [partner?.dob, coupleId, sharedSecret]);

  const handleSaveNickname = async () => {
    if (!user?.uid) return;
    try {
      await userService.updatePartnerNickname(user.uid, newNickname.trim());
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
      await userService.updateCoupleData(coupleId, { anniversaryDate: dateStr });
      await userService.updateUserProfile(user.uid, { anniversaryDate: dateStr });
      if (currentUserProfile) {
        setCurrentUserProfile({ ...currentUserProfile, anniversaryDate: dateStr });
      }
      setAnniversaryModalVisible(false);
    } catch (e) {
      console.warn("Failed to update anniversary", e);
    }
  };

  const handleSendPing = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const { activityService } = await import('../services/activityService');
    await activityService.logActivity('ping', `Sent a heartbeat ping`);
    
    if (coupleId && partner?.id) {
      const { locationService } = await import('../services/locationService');
      await locationService.sendPing(partner.id);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      
      {/* Top Warning Banner for incoming pings */}
      {incomingPing && (
        <Animated.View 
          entering={FadeInUp.springify().damping(15)} 
          exiting={FadeOutUp.duration(300)}
          style={[styles.pingBanner, { backgroundColor: theme.accentRoseSoft, borderColor: theme.accentRose }]}
        >
          <Heart size={18} color={theme.accentRose} fill={theme.accentRose} />
          <Text style={[styles.pingText, { color: theme.textPrimary }]}>
            <Text style={{ fontFamily: 'PlayfairDisplay_700Bold' }}>{partnerName}</Text> is thinking of you
          </Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.welcomeText, { color: theme.textPrimary }]}>Good evening, {user?.displayName?.split(' ')[0] || 'Love'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/profile')} activeOpacity={0.7}>
            <Avatar url={currentUserProfile?.photoURL} name={user?.displayName || 'User'} size={48} />
          </TouchableOpacity>
        </View>

        {/* Partner Core Info - Minimal Pill Chip & Battery */}
        <View style={styles.partnerInfoRow}>
          <TouchableOpacity onPress={() => router.push('/partner-profile' as any)} activeOpacity={0.8} style={styles.partnerInfoContent}>
            <Avatar url={partner?.photoURL} name={partnerName} size={64} />
            <View style={styles.partnerTextContainer}>
              <View style={styles.nameRow}>
                <Text style={[styles.partnerName, { color: theme.textPrimary }]}>{partnerName}</Text>
                <TouchableOpacity onPress={() => { setNewNickname(partnerName); setNicknameModalVisible(true); }}>
                  <Edit2 size={12} color={theme.textTertiary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.partnerMetaRow}>
                {partner?.isOnline ? (
                  <Chip label="Active Now" variant="safe" style={styles.statusChip} />
                ) : (
                  <Chip label={formatLastSeen(partner?.lastActive)} variant="default" style={styles.statusChip} />
                )}
                {partnerLocation?.batteryLevel !== undefined && (
                  <BatteryIndicator level={partnerLocation.batteryLevel} isCharging={false} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* AI Insight Placeholder */}
        {/* Assuming AI service updates this, we can render it. For now, we only render if a condition is met. */}
        {partnerLocation?.batteryLevel && partnerLocation.batteryLevel < 0.2 ? (
          <InsightCard 
            status="warning" 
            message={`${partnerName}'s battery is running low.`} 
            suggestion="They might go offline soon." 
          />
        ) : null}

        {/* Chat / Messages Row */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(app)/chat/main')} style={styles.chatSection}>
          <Card variant="surface" style={styles.chatCard}>
            <View style={styles.chatIconWrapper}>
              <MessageCircle size={20} color={theme.textSecondary} />
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.accentRose }]}>
                  <Text style={styles.unreadCountText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.chatTextWrapper}>
              <Text style={[styles.chatTitle, { color: theme.textPrimary }]}>Messages</Text>
              <Text style={[styles.chatPreview, { color: theme.textSecondary }]} numberOfLines={1}>
                {partner?.lastMessage || 'Tap to view conversation'}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>

        <View style={styles.spacingLarge} />

        {/* Centered Heartbeat Ping CTA */}
        <View style={styles.pingContainer}>
          <PingButton onPress={handleSendPing} size={80} />
          <Text style={[styles.pingLabel, { color: theme.textTertiary }]}>Send Heartbeat</Text>
        </View>

        <View style={styles.spacingLarge} />

      </ScrollView>

      {/* Nickname Modal Overlay */}
      {isNicknameModalVisible && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setNicknameModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Set Nickname</Text>
              <TouchableOpacity onPress={() => setNicknameModalVisible(false)}>
                <X size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>Give your partner a cute nickname.</Text>
            <View style={[styles.modalInputWrapper, { backgroundColor: theme.bgElevated, borderColor: theme.borderDefault }]}>
              <TextInput
                style={[styles.modalInput, { color: theme.textPrimary }]}
                value={newNickname}
                onChangeText={setNewNickname}
                placeholderTextColor={theme.textTertiary}
                autoFocus
              />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.textPrimary }]} onPress={handleSaveNickname}>
              <Text style={[styles.saveBtnText, { color: theme.bgPrimary }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Partner DOB Modal Overlay */}
      {partnerDobModalVisible && (
        <Animated.View entering={FadeInUp.duration(300)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setPartnerDobModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Set Birthday</Text>
              <TouchableOpacity onPress={() => setPartnerDobModalVisible(false)}>
                <X size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Enter {partner?.displayName || 'your partner'}'s Date of Birth.
            </Text>
            <View style={[styles.modalInputWrapper, { backgroundColor: theme.bgElevated, borderColor: theme.borderDefault }]}>
              <TextInput
                style={[styles.modalInput, { color: theme.textPrimary }]}
                value={partnerDobInput}
                keyboardType="numeric"
                maxLength={10}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={theme.textTertiary}
                onChangeText={(text) => {
                  let cleaned = text.replace(/[^\d/]/g, '');
                  if (cleaned.length === 2 && partnerDobInput.length === 1 && !cleaned.includes('/')) cleaned += '/';
                  else if (cleaned.length === 5 && partnerDobInput.length === 4 && cleaned.split('/').length === 2) cleaned += '/';
                  setPartnerDobInput(cleaned);
                }}
              />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.textPrimary }]} onPress={handleSavePartnerDob}>
              <Text style={[styles.saveBtnText, { color: theme.bgPrimary }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  pingBanner: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, right: 20,
    height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, zIndex: 2000, borderWidth: 1, elevation: 5,
  },
  pingText: { fontFamily: 'DMSans_500Medium', fontSize: 14, marginLeft: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  welcomeText: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, letterSpacing: -0.5 },
  partnerInfoRow: { marginBottom: 24 },
  partnerInfoContent: { flexDirection: 'row', alignItems: 'center' },
  partnerTextContainer: { marginLeft: 16, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  partnerName: { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 22 },
  partnerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4 },
  chatSection: { marginTop: 8, marginBottom: 16 },
  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  chatIconWrapper: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  unreadBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  unreadCountText: { color: '#FFF', fontSize: 10, fontFamily: 'DMSans_700Bold' },
  chatTextWrapper: { flex: 1 },
  chatTitle: { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 18, marginBottom: 2 },
  chatPreview: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  spacingLarge: { height: 48 },
  pingContainer: { alignItems: 'center', justifyContent: 'center' },
  pingLabel: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1.5 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24, zIndex: 1000 },
  modalContent: { padding: 24, borderRadius: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22 },
  modalDesc: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginBottom: 24 },
  modalInputWrapper: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 24 },
  modalInput: { height: 50, fontFamily: 'DMSans_500Medium', fontSize: 16 },
  saveBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 16 },
});
