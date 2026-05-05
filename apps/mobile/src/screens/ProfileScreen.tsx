import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export const ProfileScreen = () => {
  const theme = useTheme();
  const { logout, user, currentUserProfile, setCurrentUserProfile } = useAuthStore();
  const { biometricLockEnabled, setBiometricLockEnabled } = useSettingsStore();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [locationPermissions, setLocationPermissions] = useState(true);

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(currentUserProfile?.displayName || user?.displayName || '');
  const [editGender, setEditGender] = useState(currentUserProfile?.gender || '');
  const [editDob, setEditDob] = useState(currentUserProfile?.dob || '');

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    try {
      const updates = {
        displayName: editName.trim(),
        gender: editGender.trim(),
        dob: editDob.trim(),
      };
      await userService.updateUserProfile(user.uid, updates);
      if (currentUserProfile) {
        setCurrentUserProfile({ ...currentUserProfile, ...updates });
      }
      setEditModalVisible(false);
    } catch (e) {
      console.warn("Failed to update profile", e);
    }
  };

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInUp.duration(600)} style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: theme.primarySoft, borderColor: theme.surface }]}>
            <User size={50} color={theme.primary} />
            <TouchableOpacity 
              style={[styles.editAvatarBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => {
                setEditName(currentUserProfile?.displayName || user?.displayName || '');
                setEditGender(currentUserProfile?.gender || '');
                setEditDob(currentUserProfile?.dob || '');
                setEditModalVisible(true);
              }}
            >
              <Edit2 size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
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
          <TouchableOpacity style={[styles.accountItem, { borderBottomColor: theme.border }]}>
            <Lock size={20} color={theme.textLight} />
            <Text style={[styles.accountLabel, { color: theme.text }]}>Privacy Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.accountItem, styles.noBorder]}>
            <Palette size={20} color={theme.textLight} />
            <Text style={[styles.accountLabel, { color: theme.text }]}>Appearance</Text>
            <Text style={[styles.accountValue, { color: theme.primary }]}>System</Text>
          </TouchableOpacity>
        </Card>

        <Button 
          title="Logout" 
          onPress={logout} 
          variant="ghost" 
          style={styles.logoutButton}
          textStyle={{ color: '#FF4747', fontWeight: '800' }}
        />
        
        <Text style={styles.versionText}>LUVV Premium • v1.2.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      {isEditModalVisible && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setEditModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color={theme.textLight} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.modalInputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textLight }]}>Name</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor={theme.textLight}
              />
            </View>

            <View style={[styles.modalInputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textLight }]}>Gender</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={editGender}
                onChangeText={setEditGender}
                placeholder="Gender"
                placeholderTextColor={theme.textLight}
              />
            </View>

            <View style={[styles.modalInputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textLight }]}>Date of Birth (DD/MM/YYYY)</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={editDob}
                keyboardType="numeric"
                maxLength={10}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={theme.textLight}
                onChangeText={(text) => {
                  let cleaned = text.replace(/[^\d/]/g, '');
                  if (cleaned.length === 2 && editDob.length === 1 && !cleaned.includes('/')) {
                    cleaned += '/';
                  } else if (cleaned.length === 5 && editDob.length === 4 && cleaned.split('/').length === 2) {
                    cleaned += '/';
                  }
                  setEditDob(cleaned);
                }}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSaveProfile}
            >
              <Text style={styles.saveBtnText}>Save</Text>
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
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 40,
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    transform: [{ rotate: '5deg' }],
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
    transform: [{ rotate: '-5deg' }],
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
});
