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
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Copy, Share2, ArrowRight, RefreshCw, Smartphone } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { useAuthStore } from '../../src/store/useAuthStore';
import { pairingService } from '../../src/services/pairingService';
import { useTheme } from '../../src/theme';

const { height } = Dimensions.get('window');

export default function PairingScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [inviteCode, setInviteCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<{ code: string, expiresAt: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

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
    console.log('Generate Code button pressed. User:', user?.uid);
    if (!user?.uid) {
      Alert.alert('Error', 'User session not found. Please log in again.');
      return;
    }

    setLoading(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      console.log('Calling pairingService.createInviteCode...');
      const result = await pairingService.createInviteCode(user.uid);
      console.log('Code generated successfully:', result.code);
      setGeneratedCode(result);
    } catch (error: any) {
      console.warn('Generation error in UI:', error);
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
        await Share.share({
          message: `Join me on Luvv! Use my invite code: ${generatedCode.code}`,
        });
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={[theme.primary, theme.primary + 'EE']}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <SafeAreaView>
            <Animated.View entering={FadeIn.duration(800)} style={styles.headerContent}>
              <View style={styles.logoBadge}>
                <Heart size={32} color={theme.primary} fill={theme.primary} />
              </View>
              <Text style={styles.title}>Couple Pairing</Text>
              <Text style={styles.subtitle}>Connect with your partner to share your world.</Text>
            </Animated.View>
          </SafeAreaView>
        </View>

        {/* Content Section */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.mainContent}
        >
          <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textLight }]}>Have a code?</Text>
            <View style={[styles.inputGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Smartphone size={20} color={theme.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="000 000"
                placeholderTextColor={theme.textLight + '70'}
                keyboardType="number-pad"
                maxLength={6}
                value={inviteCode}
                onChangeText={(value) => setInviteCode(value.replace(/\D/g, '').slice(0, 6))}
              />
              <TouchableOpacity
                style={[styles.joinButton, { backgroundColor: theme.primary }, loading && styles.disabled]}
                onPress={handleJoin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" size="small" /> : <ArrowRight color="white" size={20} />}
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textLight }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
            {!generatedCode ? (
              <TouchableOpacity
                style={[styles.generateCard, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '20' }]}
                onPress={handleGenerateCode}
                disabled={loading}
              >
                <View style={[styles.genIconBox, { backgroundColor: theme.primary }]}>
                  <RefreshCw size={20} color="white" />
                </View>
                <View style={styles.genTextBox}>
                  <Text style={[styles.genTitle, { color: theme.primary }]}>Generate Invite Code</Text>
                  <Text style={[styles.genDesc, { color: theme.primary + '99' }]}>Create a code to send to your partner</Text>
                </View>
                {loading && <ActivityIndicator color={theme.primary} style={styles.genLoader} />}
              </TouchableOpacity>
            ) : (
              <Animated.View entering={SlideInRight} style={[styles.codeResultCard, { backgroundColor: theme.surface, ...theme.shadows.medium }]}>
                <Text style={[styles.codeLabel, { color: theme.textLight }]}>Your Pairing Code</Text>
                <Text style={[styles.codeDisplay, { color: theme.primary }]}>{generatedCode.code}</Text>
                {timeLeft !== null && (
                  <View style={styles.expiryRow}>
                    <RefreshCw size={12} color={theme.primary} style={styles.expiryIcon} />
                    <Text style={[styles.expiryText, { color: theme.primary }]}>Expires in {formatTime(timeLeft)}</Text>
                  </View>
                )}

                <View style={styles.actionGrid}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.background }]} onPress={copyToClipboard}>
                    <Copy size={18} color={theme.primary} />
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.background }]} onPress={shareCode}>
                    <Share2 size={18} color={theme.primary} />
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  headerContainer: {
    height: height * 0.4,
    width: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    lineHeight: 22,
  },
  mainContent: {
    padding: 24,
    marginTop: -20,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  inputGroup: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputIcon: {
    marginLeft: 15,
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
  },
  joinButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontWeight: '800',
    fontSize: 12,
  },
  generateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  genIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  genTextBox: {
    flex: 1,
  },
  genTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  genDesc: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  genLoader: {
    marginLeft: 10,
  },
  codeResultCard: {
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  codeLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    fontWeight: '900',
  },
  codeDisplay: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 8,
    marginVertical: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  expiryIcon: {
    marginRight: 6,
  },
  expiryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  actionBtnText: {
    fontWeight: '800',
    marginLeft: 10,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
});
