import React, { useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Calendar, Smile, ArrowRight, Phone, LogOut } from 'lucide-react-native';
import { authInstance, signOut } from '../../src/services/firebase';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../src/store/useAuthStore';
import { userService } from '../../src/services/userService';
import { useTheme } from '../../src/theme';

export default function SetupProfileScreen() {
  const theme = useTheme();
  const { user, setCurrentUserProfile } = useAuthStore();
  const [name, setName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ? user.phoneNumber.replace('+91', '') : '');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    if (phoneNumber.trim().length !== 10) {
      Alert.alert('Required', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (dob) {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
        Alert.alert('Invalid Format', 'Please enter your DOB in DD/MM/YYYY format.');
        return;
      }
      const [d, m, y] = dob.split('/').map(Number);
      if (d > 31 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
        Alert.alert('Invalid Date', 'Please enter a realistic date of birth.');
        return;
      }
    }

    if (!user?.uid) return;

    setLoading(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const updates = {
        displayName: name.trim(),
        phoneNumber: phoneNumber.trim().startsWith('+') ? phoneNumber.trim() : `+91${phoneNumber.trim()}`,
        gender: gender.trim() as 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say' | '',
        dob: dob.trim(),
        profileSetupComplete: true,
      };

      await userService.updateUserProfile(user.uid, updates);
      
      // Update local store so the router moves us to the next screen
      const updatedProfile = await userService.getUserData(user.uid);
      if (updatedProfile) {
         setCurrentUserProfile(updatedProfile);
      }

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Restart Signup?',
      'Would you like to sign out and start over?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            try {
              if (authInstance.currentUser) {
                await signOut(authInstance);
              }
            } catch (err) {
              console.error('Sign out error:', err);
            }
          } 
        }
      ]
    );
  };

  const genders = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          bounces={true}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <LinearGradient
              colors={[theme.primary, theme.primary + 'EE']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <SafeAreaView style={styles.safeHeader}>
              <TouchableOpacity 
                style={styles.backBtn} 
                onPress={handleSignOut}
              >
                <LogOut size={20} color="white" />
                <Text style={styles.backBtnText}>Exit</Text>
              </TouchableOpacity>
              
              <Animated.View entering={FadeIn.duration(800)} style={styles.headerContent}>
                <View style={styles.logoBadge}>
                  <Smile size={32} color={theme.primary} />
                </View>
                <Text style={styles.title}>About You</Text>
                <Text style={styles.subtitle}>Let's set up your profile before connecting.</Text>
              </Animated.View>
            </SafeAreaView>
          </View>

          <View style={styles.mainContent}>
            {/* Name Input */}
            <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textLight }]}>What should we call you?</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <User size={20} color={theme.textLight} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Your Name"
                  placeholderTextColor={theme.textLight + '70'}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </Animated.View>

            {/* Phone Number Input */}
            <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textLight }]}>Phone Number</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Phone size={20} color={theme.textLight} style={styles.inputIcon} />
                <View style={styles.phonePrefixContainer}>
                  <Text style={[styles.phonePrefix, { color: theme.textLight }]}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="9876543210"
                  placeholderTextColor={theme.textLight + '70'}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={(val) => setPhoneNumber(val.replace(/\D/g, '').slice(0, 10))}
                />
              </View>
              <Text style={[styles.hintText, { color: theme.textLight }]}>Needed for security and pairing.</Text>
            </Animated.View>

            {/* Gender Selection */}
            <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textLight }]}>Gender (Optional)</Text>
              <View style={styles.genderGrid}>
                {genders.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderBtn,
                      { borderColor: theme.border, backgroundColor: theme.surface },
                      gender === g && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                    ]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[
                      styles.genderText, 
                      { color: theme.text },
                      gender === g && { color: theme.primary, fontWeight: '800' }
                    ]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* DOB Input */}
            <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textLight }]}>Date of Birth (Optional)</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Calendar size={20} color={theme.textLight} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={theme.textLight + '70'}
                  keyboardType="numeric"
                  maxLength={10}
                  value={dob}
                  onChangeText={(text) => {
                    let cleaned = text.replace(/[^\d/]/g, '');
                    
                    // Split into parts to validate numbers in real-time
                    const parts = cleaned.split('/');
                    
                    // Validate Day (Max 31)
                    if (parts[0] && parts[0].length === 2 && parseInt(parts[0]) > 31) {
                      parts[0] = '31';
                    }
                    
                    // Validate Month (Max 12)
                    if (parts[1] && parts[1].length === 2 && parseInt(parts[1]) > 12) {
                      parts[1] = '12';
                    }
                    
                    // Re-join for formatting logic
                    cleaned = parts.join('/');

                    if (cleaned.length === 2 && dob.length === 1 && !cleaned.includes('/')) {
                      cleaned += '/';
                    } else if (cleaned.length === 5 && dob.length === 4 && cleaned.split('/').length === 2) {
                      cleaned += '/';
                    }
                    setDob(cleaned);
                  }}
                />
              </View>
              <Text style={[styles.hintText, { color: theme.textLight }]}>Used to count down your birthday!</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(500)}>
              <TouchableOpacity
                style={[styles.continueBtn, { backgroundColor: theme.primary }, loading && styles.disabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.continueText}>Continue to Pairing</Text>
                    <ArrowRight color="white" size={20} />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  headerContainer: {
    height: 300,
    width: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  safeHeader: {
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
    opacity: 0.9,
  },
  backBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  headerContent: { alignItems: 'center', paddingHorizontal: 30, marginTop: 10 },
  logoBadge: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10,
  },
  title: { fontSize: 36, fontWeight: '900', color: 'white', letterSpacing: -1, textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center', marginTop: 8, fontWeight: '600', lineHeight: 22 },
  mainContent: { padding: 24, marginTop: -20 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  inputGroup: {
    flexDirection: 'row', borderRadius: 20, padding: 4, borderWidth: 1.5, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  inputIcon: { marginLeft: 16, marginRight: 12 },
  phonePrefixContainer: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
    marginRight: 12,
    paddingRight: 8,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, fontWeight: '600' },
  hintText: { fontSize: 12, marginTop: 8, marginLeft: 16, opacity: 0.8 },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genderBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5 },
  genderText: { fontSize: 14, fontWeight: '600' },
  continueBtn: { flexDirection: 'row', height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  continueText: { color: 'white', fontSize: 16, fontWeight: '800', marginRight: 8 },
  disabled: { opacity: 0.7 }
});
