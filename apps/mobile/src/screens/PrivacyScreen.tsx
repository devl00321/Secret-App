import React from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
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
  CheckCheck
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { privacyService } from '../services/privacyService';
import { useChatStore } from '../store/chat';

export const PrivacyScreen = () => {
  const theme = useTheme();
  const { isSharing, setSharing, sharingDuration, setSharingDuration } = useLocationStore();
  const { currentUserProfile, setCurrentUserProfile, coupleId, logout } = useAuthStore();
  const { readReceiptsEnabled, setReadReceiptsEnabled } = useSettingsStore();
  const { clearMessages } = useChatStore();

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
      'This will erase your profile, disconnect your partner, and delete all your data. This is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive', 
          onPress: async () => {
            const success = await privacyService.deleteAccount();
            if (success) {
              await logout();
              // Navigation to auth will happen automatically due to store listener
            } else {
              Alert.alert('Error', 'Failed to delete account. Please try logging in again first.');
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
      style={[styles.settingRow, { borderBottomColor: theme.border }]}
    >
      <View style={styles.settingMain}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconBg === theme.primarySoft ? theme.primary : '#FFF'} />
        </View>
        <View style={styles.textContent}>
          <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.desc, { color: theme.textLight }]}>{desc}</Text>
        </View>
      </View>
      {type === 'switch' ? (
        <Switch 
          value={value} 
          onValueChange={onValueChange}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={Platform.OS === 'android' ? 'white' : undefined}
        />
      ) : (
        <ChevronRight size={18} color={theme.textLight} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Privacy" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Visibility</Text>
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

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Location Privacy</Text>
          <Card style={styles.card}>
            {renderSettingRow({
              icon: MapPin,
              iconBg: theme.primary,
              label: 'Share Live Location',
              desc: 'Allow partner to see your real-time path',
              value: isSharing,
              onValueChange: setSharing
            })}
            
            {isSharing && (
              <View style={styles.durationSection}>
                <Text style={[styles.subLabel, { color: theme.textLight }]}>SHARING DURATION</Text>
                <View style={styles.durationGrid}>
                  {durations.map((d) => (
                    <TouchableOpacity 
                      key={d.value}
                      style={[
                        styles.durationBtn,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        sharingDuration === d.value && { borderColor: theme.primary, backgroundColor: theme.primarySoft }
                      ]}
                      onPress={() => handleChangeSharingDuration(d.value as any)}
                    >
                      <Clock size={14} color={sharingDuration === d.value ? theme.primary : theme.textLight} />
                      <Text style={[
                        styles.durationText,
                        { color: theme.textLight },
                        sharingDuration === d.value && { color: theme.primary, fontWeight: '700' }
                      ]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Shield size={16} color={theme.primary} />
              <Text style={[styles.infoText, { color: theme.textLight }]}>
                Your location data is end-to-end encrypted and only accessible by your paired partner.
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Data & Security</Text>
          <Card style={styles.card}>
            {renderSettingRow({
              icon: Download,
              iconBg: '#0EA5E9',
              label: 'Export My Data',
              desc: 'Get a copy of all your app data',
              type: 'link',
              onPress: () => Alert.alert('Request Sent', 'Your data export is being prepared.')
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

        <TouchableOpacity 
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
        >
          <Lock size={16} color="#F43F5E" />
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
