import React from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { useTheme } from '../theme';
import { useLocationStore } from '../store/useLocationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { 
  Shield, 
  MapPin, 
  Eye, 
  Trash2, 
  Download, 
  ChevronRight, 
  Clock,
  Lock,
  Wifi,
  WifiOff,
  CheckCheck,
  Heart
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { privacyService } from '../services/privacyService';
import { useChatStore } from '../store/chat';
import { exportBackup, BackupPayload } from '../services/backupService';

export const PrivacyScreen = () => {
  const theme = useTheme();
  const { isSharing, setSharing, sharingDuration, setSharingDuration } = useLocationStore();
  const { currentUserProfile, setCurrentUserProfile, coupleId, logout, user, partner } = useAuthStore();
  const { readReceiptsEnabled, setReadReceiptsEnabled } = useSettingsStore();
  const { clearMessages } = useChatStore();
  const [exporting, setExporting] = React.useState(false);

  const handleToggleOnlineStatus = async (value: boolean) => {
    if (currentUserProfile) {
      setCurrentUserProfile({ ...currentUserProfile, isOnline: value });
      await privacyService.updateOnlineStatus(value);
    }
  };

  const handleToggleLocationSharing = async (value: boolean) => {
    setSharing(value);
    await privacyService.updateLocationPrivacy(value, sharingDuration);
  };

  const handleChangeSharingDuration = async (duration: '15m' | '1h' | 'always') => {
    setSharingDuration(duration);
    await privacyService.updateLocationPrivacy(isSharing, duration);
  };

  const handleExportData = async () => {
    if (!user?.uid || !currentUserProfile) {
      Alert.alert('Error', 'Could not load your profile data.');
      return;
    }
    setExporting(true);
    try {
      const settings = useSettingsStore.getState();
      const locationStore = useLocationStore.getState();
      const payload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        uid: user.uid,
        coupleId: coupleId || null,
        partnerUid: partner?.id || null,
        profile: {
          displayName: currentUserProfile.displayName || null,
          email: user.email || null,
          photoURL: currentUserProfile.photoURL || null,
          anniversaryDate: currentUserProfile.anniversaryDate || null,
          gender: currentUserProfile.gender || null,
          partnerNickname: currentUserProfile.partnerNickname || null,
          isOnline: currentUserProfile.isOnline ?? true,
          phoneNumber: currentUserProfile.phoneNumber || null,
        },
        emergencyContacts: currentUserProfile.emergencyContacts || [],
        savedPlaces: locationStore.savedPlaces || [],
        settings: {
          biometricLockEnabled: settings.biometricLockEnabled,
          readReceiptsEnabled: settings.readReceiptsEnabled,
          relationshipAiEnabled: settings.relationshipAiEnabled,
          theme: settings.theme,
        },
      };
      await exportBackup(user.uid, payload);
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear All Messages?',
      'This will permanently delete the chat history for both you and your partner. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Everything', 
          style: 'destructive', 
          onPress: async () => {
            if (coupleId) {
              const success = await privacyService.clearChatHistory(coupleId);
              if (success) {
                clearMessages(); // Clear local store too
                Alert.alert('Success', 'Chat history has been cleared. 🧹');
              }
            }
          } 
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account Permanently?',
      'This will erase your profile, disconnect your partner, and delete all your data. This is irreversible.\n\nFor security, you may be asked to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const success = await privacyService.deleteAccount();
              if (success) {
                await logout();
              }
            } catch (err: any) {
              if (err.message?.includes('requires-recent-login') || err.code?.includes('requires-recent-login')) {
                Alert.alert(
                  'Re-authentication Required',
                  'For your security, please log out and log back in before deleting your account.',
                  [
                    { text: 'Log Out now', onPress: () => logout() },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              } else {
                Alert.alert('Error', 'Failed to delete account. Please try again later.');
              }
            }
          } 
        }
      ]
    );
  };

  const durations = [
    { label: '15 Minutes', value: '15m' },
    { label: '1 Hour', value: '1h' },
    { label: 'Always', value: 'always' },
  ];

  const renderSettingRow = ({ 
    icon: Icon, 
    iconBg, 
    label, 
    desc, 
    value, 
    onValueChange, 
    type = 'switch',
    onPress
  }: any) => (
    <TouchableOpacity 
      activeOpacity={type === 'link' ? 0.7 : 1}
      onPress={onPress}
      style={[styles.settingRow, { borderBottomColor: theme.borderDefault }]}
    >
      <View style={styles.settingMain}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconBg === theme.accentRoseSoft ? theme.accentRose : '#FFF'} />
        </View>
        <View style={styles.textContent}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{desc}</Text>
        </View>
      </View>
      {type === 'switch' ? (
        <Switch 
          value={value} 
          onValueChange={onValueChange}
          trackColor={{ false: theme.borderDefault, true: theme.accentRose }}
          thumbColor={Platform.OS === 'android' ? 'white' : undefined}
        />
      ) : (
        <ChevronRight size={18} color={theme.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <Header title="Privacy" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Visibility</Text>
          <Card style={styles.card}>
            {renderSettingRow({
              icon: currentUserProfile?.isOnline ? Wifi : WifiOff,
              iconBg: currentUserProfile?.isOnline ? '#22C55E' : '#94A3B8',
              label: 'Online Status',
              desc: 'Let partner see when you are active',
              value: currentUserProfile?.isOnline ?? true,
              onValueChange: handleToggleOnlineStatus
            })}
            {renderSettingRow({
              icon: CheckCheck,
              iconBg: '#8B5CF6',
              label: 'Read Receipts',
              desc: 'Let partner see when you have read messages',
              value: readReceiptsEnabled,
              onValueChange: setReadReceiptsEnabled,
              noBorder: true
            })}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>App Experience</Text>
          <Card style={styles.card}>
            {renderSettingRow({
              icon: Heart,
              iconBg: '#FF6B6B',
              label: 'Relationship AI',
              desc: 'Personalized date ideas & connection prompts',
              value: useSettingsStore().relationshipAiEnabled,
              onValueChange: useSettingsStore().setRelationshipAiEnabled,
              noBorder: true
            })}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Location Privacy</Text>
          <Card style={styles.card}>
            {renderSettingRow({
              icon: MapPin,
              iconBg: theme.accentRose,
              label: 'Share Live Location',
              desc: 'Allow partner to see your real-time path',
              value: isSharing,
              onValueChange: setSharing
            })}
            
            {isSharing && (
              <View style={styles.durationSection}>
                <Text style={[styles.subLabel, { color: theme.textSecondary }]}>SHARING DURATION</Text>
                <View style={styles.durationGrid}>
                  {durations.map((d) => (
                    <TouchableOpacity 
                      key={d.value}
                      style={[
                        styles.durationBtn,
                        { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault },
                        sharingDuration === d.value && { borderColor: theme.accentRose, backgroundColor: theme.accentRoseSoft }
                      ]}
                      onPress={() => handleChangeSharingDuration(d.value as any)}
                    >
                      <Clock size={14} color={sharingDuration === d.value ? theme.accentRose : theme.textSecondary} />
                      <Text style={[
                        styles.durationText,
                        { color: theme.textSecondary },
                        sharingDuration === d.value && { color: theme.accentRose, fontWeight: '700' }
                      ]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            <View style={[styles.infoBox, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}>
              <Shield size={16} color={theme.accentRose} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Your location data is end-to-end encrypted and only accessible by your paired partner.
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Data & Security</Text>
          <Card style={styles.card}>
            {renderSettingRow({
              icon: Download,
              iconBg: '#0EA5E9',
              label: exporting ? 'Preparing backup…' : 'Export My Data',
              desc: 'Encrypted .luvvbackup — restore anytime',
              type: 'link',
              onPress: handleExportData
            })}
            {renderSettingRow({
              icon: Trash2,
              iconBg: '#F43F5E',
              label: 'Clear Chat History',
              desc: 'Permanently delete all messages',
              type: 'link',
              onPress: handleClearChat
            })}
          </Card>
        </Animated.View>

        <Text style={[styles.sectionTitle, { color: '#F43F5E', marginTop: 10 }]}>Danger Zone</Text>
        <TouchableOpacity 
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
        >
          <Trash2 size={18} color="#F43F5E" />
          <Text style={styles.deleteAccountText}>Delete Account Permanently</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 6,
  },
  card: {
    marginBottom: 32,
    paddingVertical: 8,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  settingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    marginLeft: 16,
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  desc: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
    opacity: 0.8,
  },
  durationSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  durationGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  durationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 10,
  },
  deleteAccountText: {
    color: '#F43F5E',
    fontSize: 14,
    fontWeight: '800',
  },
});
