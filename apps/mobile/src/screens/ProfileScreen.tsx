import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, MessageSquareText, Shield, Palette, Edit2, X } from 'lucide-react-native';
import { useTheme } from '../theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TextInput, TouchableWithoutFeedback, StyleSheet, View, Text, ScrollView, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { biometricService } from '../services/biometricService';
import * as Haptics from 'expo-haptics';

export const ProfileScreen = () => {
  const theme = useTheme();
  const { logout, user, currentUserProfile } = useAuthStore();
  const { biometricLockEnabled, setBiometricLockEnabled, theme: themePreference, setTheme } = useSettingsStore();
  const router = useRouter();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [locationPermissions, setLocationPermissions] = useState(true);
  const [isAppearanceModalVisible, setAppearanceModalVisible] = useState(false);

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await biometricService.authenticate('Confirm to enable App Lock');
      if (success) setBiometricLockEnabled(true);
    } else {
      const success = await biometricService.authenticate('Confirm to disable App Lock');
      if (success) setBiometricLockEnabled(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInUp.duration(600)} style={styles.profileHeader}>
          <TouchableOpacity 
            activeOpacity={0.85}
            onPress={() => router.push('/edit-profile')}
            style={styles.avatarContainer}
          >
            <Avatar url={currentUserProfile?.photoURL} name={user?.displayName || 'User'} size={110} />
            <View style={[styles.editAvatarBtn, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}>
              <Edit2 size={16} color={theme.textPrimary} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: theme.textPrimary }]}>{currentUserProfile?.displayName || user?.displayName || 'User'}</Text>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user?.email || 'Connected'}</Text>
        </Animated.View>

        <SectionHeader title="App Experience" />
        <Card padding="none" variant="surface" style={styles.settingsCard}>
          <View style={[styles.settingItem, { borderBottomColor: theme.borderDefault }]}>
            <View style={styles.settingLabelContainer}>
              <MessageSquareText size={20} color={theme.textSecondary} />
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Relationship AI</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Smart nudges & insights</Text>
              </View>
            </View>
            <Switch value={aiEnabled} onValueChange={setAiEnabled} trackColor={{ false: theme.borderDefault, true: theme.accentRose }} thumbColor={Platform.OS === 'android' ? 'white' : undefined} />
          </View>
          <View style={[styles.settingItem, styles.noBorder]}>
            <View style={styles.settingLabelContainer}>
              <Shield size={20} color={theme.safeGreen} />
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Safe Share</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Private location requests</Text>
              </View>
            </View>
            <Switch value={locationPermissions} onValueChange={setLocationPermissions} trackColor={{ false: theme.borderDefault, true: theme.safeGreen }} thumbColor={Platform.OS === 'android' ? 'white' : undefined} />
          </View>
        </Card>

        <SectionHeader title="Privacy & Security" />
        <Card padding="none" variant="surface" style={styles.settingsCard}>
          <View style={[styles.settingItem, styles.noBorder]}>
            <View style={styles.settingLabelContainer}>
              <Lock size={20} color={theme.textSecondary} />
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Biometric App Lock</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Require FaceID to open app</Text>
              </View>
            </View>
            <Switch value={biometricLockEnabled} onValueChange={handleToggleBiometric} trackColor={{ false: theme.borderDefault, true: theme.accentRose }} thumbColor={Platform.OS === 'android' ? 'white' : undefined} />
          </View>
        </Card>

        <SectionHeader title="Account" />
        <Card padding="none" variant="surface" style={styles.settingsCard}>
          <TouchableOpacity style={[styles.accountItem, { borderBottomColor: theme.borderDefault }]} onPress={() => router.push('/privacy')}>
            <Lock size={20} color={theme.textSecondary} />
            <Text style={[styles.accountLabel, { color: theme.textPrimary }]}>Privacy Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.accountItem, styles.noBorder]} onPress={() => setAppearanceModalVisible(true)}>
            <Palette size={20} color={theme.textSecondary} />
            <Text style={[styles.accountLabel, { color: theme.textPrimary }]}>Appearance</Text>
            <Text style={[styles.accountValue, { color: theme.textSecondary }]}>{themePreference}</Text>
          </TouchableOpacity>
        </Card>

        {/* Danger Zone */}
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.dangerRed + '10' }]} onPress={logout}>
          <Text style={[styles.logoutText, { color: theme.dangerRed }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: theme.textTertiary }]}>LUVV Premium • v1.2.0</Text>
      </ScrollView>

      {/* Appearance Modal */}
      {isAppearanceModalVisible && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAppearanceModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Appearance</Text>
              <TouchableOpacity onPress={() => setAppearanceModalVisible(false)}>
                <X size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.themeOptionsRow}>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.themeOptionBtn, { backgroundColor: theme.bgElevated, borderColor: themePreference === t ? theme.textPrimary : theme.borderDefault }]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTheme(t);
                    setAppearanceModalVisible(false);
                  }}
                >
                  <Text style={[styles.themeOptionText, { color: themePreference === t ? theme.textPrimary : theme.textSecondary }]}>
                    {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '🌗 System'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  profileHeader: { alignItems: 'center', marginVertical: 40 },
  avatarContainer: { position: 'relative', marginBottom: 20 },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, zIndex: 10 },
  userName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, letterSpacing: -0.5 },
  userEmail: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 4 },
  settingsCard: { marginBottom: 24, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  settingLabelContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingTextContent: { marginLeft: 16 },
  settingLabel: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  settingDesc: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 2 },
  accountItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  accountLabel: { fontFamily: 'DMSans_500Medium', fontSize: 15, marginLeft: 16, flex: 1 },
  accountValue: { fontFamily: 'DMSans_700Bold', fontSize: 13, textTransform: 'uppercase' },
  noBorder: { borderBottomWidth: 0 },
  logoutBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16, marginBottom: 24 },
  logoutText: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  versionText: { fontFamily: 'DMSans_400Regular', textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginTop: 20, marginBottom: 40 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24, zIndex: 1000 },
  modalContent: { width: '100%', padding: 24, borderRadius: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22 },
  themeOptionsRow: { gap: 12 },
  themeOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 16, borderWidth: 1 },
  themeOptionText: { fontFamily: 'DMSans_500Medium', fontSize: 16 },
});
