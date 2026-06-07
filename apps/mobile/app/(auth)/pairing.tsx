import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Share,
  Dimensions,
  ScrollView,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart,
  Copy,
  Share2,
  ArrowRight,
  RefreshCw,
  Smartphone,
  LogOut,
  UploadCloud,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react-native';
import { authInstance, signOut, db, doc, setDoc, updateDoc } from '../../src/services/firebase';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, SlideInRight, ZoomIn } from 'react-native-reanimated';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useLocationStore } from '../../src/store/useLocationStore';
import { pairingService } from '../../src/services/pairingService';
import { useTheme } from '../../src/theme';
import { importBackup, BackupPayload } from '../../src/services/backupService';

const { height } = Dimensions.get('window');

export default function PairingScreen() {
  const theme = useTheme();
  const { user, logout, setCurrentUserProfile } = useAuthStore();
  const [inviteCode, setInviteCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<{ code: string, expiresAt: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Restore flow state
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoredBackup, setRestoredBackup] = useState<BackupPayload | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!generatedCode) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((generatedCode.expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) {
        setGeneratedCode(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedCode]);

  const handleGenerateCode = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User session not found. Please log in again.');
      return;
    }
    setLoading(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const result = await pairingService.createInviteCode(user.uid);
      setGeneratedCode(result);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate code.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (inviteCode.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }
    if (!user?.uid) return;
    setLoading(true);
    try {
      await pairingService.joinWithCode(inviteCode, user.uid);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Invalid Code', error.message || 'Could not pair. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedCode) {
      await Clipboard.setStringAsync(generatedCode.code);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const shareCode = async () => {
    if (generatedCode) {
      try {
        await Share.share({ message: `Join me on Luvv! Use my invite code: ${generatedCode.code}` });
      } catch {
        Alert.alert('Unable to share', 'Copy the code and send it manually.');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSignOut = () => {
    Alert.alert('Restart Signup?', 'Would you like to sign out and start over?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  // ── Restore flow ──────────────────────────────────────────────────────────

  const handlePickBackup = async () => {
    if (!user?.uid) return;
    const backup = await importBackup(user.uid);
    if (!backup) return;

    setRestoredBackup(backup);
    setRestoreModalVisible(true);
  };

  const applyBackupToProfile = async (backup: BackupPayload) => {
    if (!user?.uid) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const profileData: any = {
        displayName: backup.profile.displayName,
        photoURL: backup.profile.photoURL,
        anniversaryDate: backup.profile.anniversaryDate,
        gender: backup.profile.gender,
        partnerNickname: backup.profile.partnerNickname,
        isOnline: backup.profile.isOnline,
        phoneNumber: backup.profile.phoneNumber,
        emergencyContacts: backup.emergencyContacts,
        restoredAt: new Date().toISOString(),
      };
      await updateDoc(userRef, profileData);

      // Restore settings
      const settingsStore = useSettingsStore.getState();
      settingsStore.setBiometricLockEnabled(backup.settings.biometricLockEnabled);
      settingsStore.setReadReceiptsEnabled(backup.settings.readReceiptsEnabled);
      settingsStore.setRelationshipAiEnabled(backup.settings.relationshipAiEnabled);
      settingsStore.setTheme(backup.settings.theme as any);

      // Restore saved places
      const locationStore = useLocationStore.getState();
      if (backup.savedPlaces?.length > 0) {
        locationStore.setSavedPlaces(backup.savedPlaces);
      }

      // Update local profile store
      setCurrentUserProfile(profileData);
    } catch (err: any) {
      console.error('[Restore] Profile update failed:', err);
      throw err;
    }
  };

  const handleRestoreWithAutoConnect = async () => {
    if (!restoredBackup || !user?.uid) return;
    setRestoring(true);
    try {
      await applyBackupToProfile(restoredBackup);

      if (restoredBackup.coupleId && restoredBackup.partnerUid) {
        // Attempt to reconnect to existing couple document
        const coupleRef = doc(db, 'couples', restoredBackup.coupleId);
        await updateDoc(coupleRef, {
          [`users.${user.uid}`]: true,
          reconnectedAt: new Date().toISOString(),
        }).catch(() => {
          // Couple doc may not exist if partner deleted — silently fail, user will need to re-pair
          console.warn('[Restore] Could not reconnect to couple — partner may have deleted.');
        });
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestoreModalVisible(false);
      Alert.alert(
        '✅ Backup Restored!',
        restoredBackup.coupleId
          ? 'Your profile and settings are back. Attempting to reconnect with your partner automatically.'
          : 'Your profile and settings are back. You will need to re-pair with your partner.',
      );
    } catch (err: any) {
      Alert.alert('Restore Failed', err.message || 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreWithRePair = async () => {
    if (!restoredBackup || !user?.uid) return;
    setRestoring(true);
    try {
      await applyBackupToProfile(restoredBackup);
      setRestoreModalVisible(false);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Profile Restored!',
        'Your profile and settings are back. Please use the pairing code below to reconnect with your partner.',
      );
    } catch (err: any) {
      Alert.alert('Restore Failed', err.message || 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={[theme.accentRose, theme.accentRose + 'EE']}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <SafeAreaView style={styles.safeHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={handleSignOut}>
              <LogOut size={20} color="white" />
              <Text style={styles.backBtnText}>Exit</Text>
            </TouchableOpacity>
            <Animated.View entering={FadeIn.duration(800)} style={styles.headerContent}>
              <View style={styles.logoBadge}>
                <Heart size={32} color={theme.accentRose} fill={theme.accentRose} />
              </View>
              <Text style={styles.title}>Couple Pairing</Text>
              <Text style={styles.subtitle}>Connect with your partner to share your world.</Text>
            </Animated.View>
          </SafeAreaView>
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.mainContent}
        >
          {/* Enter code */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Have a code?</Text>
            <View style={[styles.inputGroup, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}>
              <Smartphone size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="000 000"
                placeholderTextColor={theme.textSecondary + '70'}
                keyboardType="number-pad"
                maxLength={6}
                value={inviteCode}
                onChangeText={(value) => setInviteCode(value.replace(/\D/g, '').slice(0, 6))}
              />
              <TouchableOpacity
                style={[styles.joinButton, { backgroundColor: theme.accentRose }, loading && styles.disabled]}
                onPress={handleJoin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" size="small" /> : <ArrowRight color="white" size={20} />}
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.borderDefault }]} />
            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.borderDefault }]} />
          </View>

          {/* Generate code */}
          <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
            {!generatedCode ? (
              <TouchableOpacity
                style={[styles.generateCard, { backgroundColor: theme.accentRoseSoft, borderColor: theme.accentRose + '20' }]}
                onPress={handleGenerateCode}
                disabled={loading}
              >
                <View style={[styles.genIconBox, { backgroundColor: theme.accentRose }]}>
                  <RefreshCw size={20} color="white" />
                </View>
                <View style={styles.genTextBox}>
                  <Text style={[styles.genTitle, { color: theme.accentRose }]}>Generate Invite Code</Text>
                  <Text style={[styles.genDesc, { color: theme.accentRose + '99' }]}>Create a code to send to your partner</Text>
                </View>
                {loading && <ActivityIndicator color={theme.accentRose} style={styles.genLoader} />}
              </TouchableOpacity>
            ) : (
              <Animated.View
                entering={SlideInRight}
                style={[styles.codeResultCard, { backgroundColor: theme.bgSurface, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 }]}
              >
                <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>Your Pairing Code</Text>
                <Text style={[styles.codeDisplay, { color: theme.accentRose }]}>{generatedCode.code}</Text>
                {timeLeft !== null && (
                  <View style={styles.expiryRow}>
                    <RefreshCw size={12} color={theme.accentRose} style={styles.expiryIcon} />
                    <Text style={[styles.expiryText, { color: theme.accentRose }]}>Expires in {formatTime(timeLeft)}</Text>
                  </View>
                )}
                <View style={styles.actionGrid}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.bgPrimary }]} onPress={copyToClipboard}>
                    <Copy size={18} color={theme.accentRose} />
                    <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.bgPrimary }]} onPress={shareCode}>
                    <Share2 size={18} color={theme.accentRose} />
                    <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </Animated.View>

          {/* ── Restore from Backup ── */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.borderDefault }]} />
            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.borderDefault }]} />
          </View>

          <Animated.View entering={FadeInDown.delay(600)} style={styles.section}>
            <TouchableOpacity
              style={[styles.restoreCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderDefault }]}
              onPress={handlePickBackup}
            >
              <View style={[styles.genIconBox, { backgroundColor: theme.accentGold }]}>
                <UploadCloud size={20} color="white" />
              </View>
              <View style={styles.genTextBox}>
                <Text style={[styles.genTitle, { color: theme.textPrimary }]}>Restore from Backup</Text>
                <Text style={[styles.genDesc, { color: theme.textSecondary }]}>Import your encrypted .luvvbackup file</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </ScrollView>

      {/* ── Restore Options Modal ── */}
      <Modal
        visible={restoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestoreModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn.duration(300)} style={[styles.modalCard, { backgroundColor: theme.bgSurface }]}>
            {/* Header */}
            <View style={[styles.modalIconRow, { backgroundColor: theme.accentGoldSoft }]}>
              <ShieldCheck size={32} color={theme.accentGold} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Backup Found!</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Exported on {restoredBackup ? new Date(restoredBackup.exportedAt).toLocaleDateString() : ''}
              {'\n'}Profile: {restoredBackup?.profile?.displayName || 'Unknown'}
            </Text>

            <View style={[styles.modalDivider, { backgroundColor: theme.borderDefault }]} />

            <Text style={[styles.modalQuestion, { color: theme.textPrimary }]}>
              How would you like to reconnect with your partner?
            </Text>

            {/* Option 1 — Auto reconnect */}
            <TouchableOpacity
              style={[styles.optionBtn, { backgroundColor: theme.accentRoseSoft, borderColor: theme.accentRose + '40' }]}
              onPress={handleRestoreWithAutoConnect}
              disabled={restoring}
            >
              <View style={[styles.optionIcon, { backgroundColor: theme.accentRose }]}>
                <Zap size={18} color="white" />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: theme.accentRose }]}>Auto-Reconnect</Text>
                <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  Try to restore the existing connection. Works if your partner still has their account.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2 — Re-pair */}
            <TouchableOpacity
              style={[styles.optionBtn, { backgroundColor: theme.bgElevated, borderColor: theme.borderDefault }]}
              onPress={handleRestoreWithRePair}
              disabled={restoring}
            >
              <View style={[styles.optionIcon, { backgroundColor: theme.textSecondary }]}>
                <Users size={18} color="white" />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Re-pair with New Code</Text>
                <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  Restore your profile then generate a fresh pairing code for your partner.
                </Text>
              </View>
            </TouchableOpacity>

            {restoring && (
              <ActivityIndicator size="large" color={theme.accentRose} style={{ marginTop: 16 }} />
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setRestoreModalVisible(false); setRestoredBackup(null); }}
              disabled={restoring}
            >
              <Text style={[styles.cancelText, { color: theme.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  headerContainer: { height: height * 0.38, width: '100%', justifyContent: 'flex-end', paddingBottom: 40 },
  headerGradient: { ...StyleSheet.absoluteFillObject, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  safeHeader: { flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, gap: 8, opacity: 0.9 },
  backBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  headerContent: { alignItems: 'center', paddingHorizontal: 30, marginTop: 10 },
  logoBadge: { width: 64, height: 64, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  title: { fontSize: 36, fontWeight: '900', color: 'white', letterSpacing: -1, textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8, fontWeight: '600', lineHeight: 22 },
  mainContent: { padding: 24, marginTop: -20 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  inputGroup: { flexDirection: 'row', borderRadius: 24, padding: 8, borderWidth: 1.5, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  inputIcon: { marginLeft: 15, marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  joinButton: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  dividerLine: { flex: 1, height: 1, opacity: 0.5 },
  dividerText: { paddingHorizontal: 16, fontWeight: '800', fontSize: 12 },
  generateCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
  restoreCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1.5 },
  genIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  genTextBox: { flex: 1 },
  genTitle: { fontSize: 17, fontWeight: '800' },
  genDesc: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  genLoader: { marginLeft: 10 },
  codeResultCard: { borderRadius: 32, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  codeLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: '900' },
  codeDisplay: { fontSize: 48, fontWeight: '900', letterSpacing: 8, marginVertical: 4 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  expiryIcon: { marginRight: 6 },
  expiryText: { fontSize: 13, fontWeight: '700' },
  actionGrid: { flexDirection: 'row', marginTop: 24, gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  actionBtnText: { fontWeight: '800', marginLeft: 10, fontSize: 14 },
  disabled: { opacity: 0.6 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 32, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 20 },
  modalIconRow: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalDivider: { height: 1, width: '100%', marginBottom: 20 },
  modalQuestion: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  optionBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1.5, marginBottom: 12 },
  optionIcon: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  optionDesc: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  cancelBtn: { marginTop: 12, padding: 10 },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
