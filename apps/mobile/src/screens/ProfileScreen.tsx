import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/useAuthStore';
import { User, Lock, MessageSquareText, Shield, Palette, Edit2, X } from 'lucide-react-native';
import { useTheme } from '../theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { userService } from '../services/userService';
import { TextInput, TouchableWithoutFeedback, StyleSheet, View, Text, ScrollView, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { biometricService } from '../services/biometricService';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

export const ProfileScreen = () => {
  const theme = useTheme();
  const { logout, user, currentUserProfile, setCurrentUserProfile, setCoupleId, setPartner, setUser } = useAuthStore();
  const { biometricLockEnabled, setBiometricLockEnabled, theme: themePreference, setTheme } = useSettingsStore();
  const router = useRouter();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [locationPermissions, setLocationPermissions] = useState(true);
  const [isAppearanceModalVisible, setAppearanceModalVisible] = useState(false);



  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      // Require auth before enabling
      const success = await biometricService.authenticate('Confirm to enable App Lock');
      if (success) {
        setBiometricLockEnabled(true);
      } else {
        // Switch will automatically revert if we don't update state
      }
    } else {
      // Require auth before disabling
      const success = await biometricService.authenticate('Confirm to disable App Lock');
      if (success) {
        setBiometricLockEnabled(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;

    Alert.alert(
      "Delete Account?",
      "This will permanently erase your profile and messages. Your partner will also be unpaired. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            // Second confirmation for such a destructive action
            Alert.alert(
              "Final Confirmation",
              "Are you absolutely sure? Everything will be lost.",
              [
                { text: "No, keep it", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      }
                      await userService.deleteUserAccount(user.uid, currentUserProfile?.partnerId || null, currentUserProfile?.coupleId || null);
                      // Clear store and redirect
                      setCoupleId(null);
                      setPartner(null);
                      setCurrentUserProfile(null);
                      setUser(null);
                      router.replace('/(auth)');
                    } catch (e: any) {
                      if (e.code === 'auth/requires-recent-login' || e.message?.includes('requires-recent-login')) {
                        Alert.alert(
                          "Security Check", 
                          "For your protection, deleting your account requires a recent login. Please log out and log back in, then try again.",
                          [{ text: "OK", onPress: () => logout() }]
                        );
                      } else {
                        Alert.alert("Error", "Failed to delete account. Please try again later.");
                      }
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInUp.duration(600)} style={styles.profileHeader}>
          <TouchableOpacity 
            activeOpacity={0.85}
            onPress={() => router.push('/(app)/edit-profile')}
            style={styles.avatarContainer}
            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
          >
            <View style={[styles.avatarLarge, { backgroundColor: theme.primarySoft, borderColor: theme.surface }]}>
              {currentUserProfile?.photoURL ? (
                <Image 
                  source={{ uri: currentUserProfile.photoURL }} 
                  style={styles.avatarImage} 
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.initialsCircle, { backgroundColor: theme.primary }]}>
                  <Text style={styles.initialsText}>
                    {(currentUserProfile?.displayName || user?.displayName || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.editAvatarBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Edit2 size={16} color={theme.primary} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: theme.text }]}>{currentUserProfile?.displayName || user?.displayName || 'User'}</Text>
          <Text style={[styles.userEmail, { color: theme.textLight }]}>{user?.email || 'Connected'}</Text>
        </Animated.View>

        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>App Experience</Text>
        <Card style={styles.settingsCard}>
          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                <MessageSquareText size={20} color="#0EA5E9" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Relationship AI</Text>
                <Text style={[styles.settingDesc, { color: theme.textLight }]}>Smart nudges & insights</Text>
              </View>
            </View>
            <Switch 
              value={aiEnabled} 
              onValueChange={setAiEnabled}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === 'android' ? 'white' : undefined}
            />
          </View>

          <View style={[styles.settingItem, styles.noBorder]}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                <Shield size={20} color="#22C55E" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Safe Share</Text>
                <Text style={[styles.settingDesc, { color: theme.textLight }]}>Private location requests</Text>
              </View>
            </View>
            <Switch 
              value={locationPermissions} 
              onValueChange={setLocationPermissions}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === 'android' ? 'white' : undefined}
            />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Privacy & Security</Text>
        <Card style={styles.settingsCard}>
          <View style={[styles.settingItem, styles.noBorder]}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                <Lock size={20} color="#EF4444" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Biometric App Lock</Text>
                <Text style={[styles.settingDesc, { color: theme.textLight }]}>Require FaceID to open app</Text>
              </View>
            </View>
            <Switch 
              value={biometricLockEnabled} 
              onValueChange={handleToggleBiometric}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === 'android' ? 'white' : undefined}
            />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Account</Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity 
            style={[styles.accountItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push('/(app)/privacy')}
          >
            <Lock size={20} color={theme.textLight} />
            <Text style={[styles.accountLabel, { color: theme.text }]}>Privacy Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.accountItem, styles.noBorder]}
            onPress={() => setAppearanceModalVisible(true)}
          >
            <Palette size={20} color={theme.textLight} />
            <Text style={[styles.accountLabel, { color: theme.text }]}>Appearance</Text>
            <Text style={[styles.accountValue, { color: theme.primary }]}>{themePreference}</Text>
          </TouchableOpacity>
        </Card>

        <Button 
          title="Logout" 
          onPress={logout} 
          variant="ghost" 
          style={styles.logoutButton}
          textStyle={{ color: '#FF4747', fontWeight: '800' }}
        />

        <Text style={[styles.sectionTitle, { color: '#FF4747', marginTop: 24 }]}>Danger Zone</Text>
        <Card style={[styles.settingsCard, { borderColor: 'rgba(255, 71, 71, 0.2)', borderWidth: 1 }]}>
          <TouchableOpacity 
            style={[styles.accountItem, styles.noBorder]}
            onPress={handleDeleteAccount}
          >
            <X size={20} color="#FF4747" />
            <Text style={[styles.accountLabel, { color: '#FF4747' }]}>Delete Account Permanently</Text>
          </TouchableOpacity>
        </Card>
        
        <Text style={styles.versionText}>LUVV Premium • v1.2.0</Text>
      </ScrollView>



      {/* Appearance Modal */}
      {isAppearanceModalVisible && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAppearanceModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Appearance</Text>
              <TouchableOpacity 
                onPress={() => setAppearanceModalVisible(false)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <X size={24} color={theme.textLight} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.themeOptionsRow}>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.themeOptionBtn,
                    { backgroundColor: theme.surface, borderColor: themePreference === t ? theme.primary : theme.border }
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setTheme(t);
                    setAppearanceModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.themeOptionText,
                    { color: themePreference === t ? theme.primary : theme.textLight }
                  ]}>
                    {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '🌗 System'}
                  </Text>
                  {themePreference === t && (
                    <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
                      <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>
                    </View>
                  )}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 40,
  },
  avatarContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    transform: [{ rotate: '5deg' }],
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  initialsCircle: {
    width: 70,
    height: 70,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
  },
  genderToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    zIndex: 10,
  },
  userName: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 6,
    letterSpacing: 1.5,
  },
  settingsCard: {
    marginBottom: 32,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContent: {
    marginLeft: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  accountLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 16,
    flex: 1,
  },
  accountValue: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 71, 71, 0.05)',
  },
  versionText: {
    textAlign: 'center',
    color: '#AAA',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 40,
    marginBottom: 60,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalInputWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalInput: {
    height: 40,
    fontSize: 18,
    fontWeight: '600',
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  themeOptionsRow: {
    gap: 12,
    marginTop: 8,
  },
  themeOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  themeOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
